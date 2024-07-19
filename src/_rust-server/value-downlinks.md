---
title: Server Value Downlinks
short-title: Server Value Downlinks
description: "Share data across Web Agents and clients through persistent, bidirectionally-streaming lane references."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/swim-rust/tree/main/example_apps/value_downlink
redirect_from:
  - /tutorials/value-downlinks/
  - /reference/value-downlinks.html
  - /backend/value-downlinks/
---

This page covers the specifics of Value Downlinks and does not cover the more general aspects of Server Downlinks. For more general information about Server Downlinks, see the [Server Downlinks]({% link _rust-server/server-downlinks.md %}) page.

# Overview

A Value Downlink synchronises a shared, real-time, value with a lane outside of the current [agent]({% link _rust-server/web-agents.md %}); this may be a lane that is local or remote. A Value Downlink exposes a variety of lifecycle event handlers that may be registered and are invoked during the lifetime of the downlink.

# Use Cases

Value Downlinks allow you to modify the state of a remote lane and observe state changes by registering lifecycle event handlers. Common usecases of Value Downlinks are:

- Replicating state across agents: instead of replicating data manually, a downlink may be used to replicate state into a agent.
- Aggregating state: aggregate the state of multiple lanes across multiple agents into a single [Value Lane]({% link _rust-server/value-lanes.md %}) using Value Downlinks.

# Instantiation

Value Downlinks are created using a [Handler Context](https://docs.rs/swimos_agent/{{ site.data.rust.swimos-agent-version }}/swimos_agent/agent_lifecycle/struct.HandlerContext.html) instance which is provided to any lifecycle implementation. While a downlink may not be created the same way as lanes, they may be created when the agent starts or when an event is received by a lane; a handle to a downlink may be stored in a lifecycle instance.

Like all downlinks, they are opened by invoking the corresponding function on the [Handler Context](https://docs.rs/swimos_agent/{{ site.data.rust.swimos-agent-version }}/swimos_agent/agent_lifecycle/struct.HandlerContext.html) which returns a `HandlerAction` which will perform the actual construction of the downlink. There are two options available on the context for creating a Value Downlink: using a builder pattern which provides a flexible approach for defining the lifecycle of the downlink or by providing the lifecycle as an argument directly.

A Value Downlink may be built using the `HandlerContext::value_downlink_builder` function. Which is defined as follows:

```rust
use swimos::agent::{
  config::SimpleDownlinkConfig,
  agent_lifecycle::utility::StatelessValueDownlinkBuilder
};

impl HandlerContext<Agent> {
    // Additional bounds redacted for brevity.
    pub fn value_downlink_builder<T>(
        &self,
        host: Option<&str>,
        node: &str,
        lane: &str,
        config: SimpleDownlinkConfig,
    ) -> StatelessValueDownlinkBuilder<Agent, T>
    {
      ...
    }
}
```

The following arguments must be provided:

- `host`: the remote host at which the agent resides (a local agent if not specified).
- `node`: the node URI of the agent.
- `lane`: the lane to downlink from.
- `config`: configuration parameters for the downlink.

Invoking this function will return a `HandlerAction` that completes with a handle which may be used to set the state of the downlink as well as terminate it. This function will return immediately but internally the handle will spawn a task that attempts to open the link. Dropping the returned handle will result in the downlink terminating; a common place to keep the handle is inside the agent's lifecycle.

A complete example for opening a Value Downlink:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::ValueDownlinkHandle,
    config::SimpleDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
}

#[derive(Debug, Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<ValueDownlinkHandle<i32>>>,
}

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let ExampleLifecycle { handle } = self;

        context
            .value_downlink_builder(None, "/example/2", "lane", SimpleDownlinkConfig::default())
            .on_linked(|context| context.effect(|| println!("Link opened.")))
            .on_synced(|context, v| {
                let value = *v;
                context.effect(move || println!("Link synchronized: {}", value))
            })
            .on_event(|context, v| {
                let value = *v;
                context.effect(move || println!("Received value on link: {}", value))
            })
            .on_unlinked(|context| context.effect(|| println!("Link closed.")))
            .on_failed(|context| context.effect(|| println!("Link failed.")))
            .done()
            .and_then(move |downlink_handle| handle.set(Some(downlink_handle)))
    }
}

```

## Configuration

When creating a Value Downlink, a `swimos::agent::config::SimpleDownlinkConfig` must be provided that configures two behavioural properties of the Downlink:

- `events_when_not_synced`: if this is set, lifecycle handlers will be invoked for events before the downlink is synchronized with the lane. Defaults to `false`.
- `terminate_on_unlinked`: if this is set, the downlink will stop if it enters the unlinked state. Defaults to: `true`. If set to `false`, the downlink will attempt to reconnect to the lane.

# Lifecycle Event Handlers

Lifecycle event handlers may be registered with a Value Downlink to be notified when an event takes places in the downlink. Most commonly, an On Set and On Event handler will be registered to be notified when the downlink's state changes.

Any lifecycle event handler that is registered is run within the context of the agent that opened it and has access to the agent's `HandlerContext`. As such, the handlers may invoke operations that read or mutate the state of the agent. All handlers are invoked exactly once after an event has occurred.

A variety of event handlers are available:

- On Linked. Invoked when the link with the lane has been established. The handler takes no parameters.
- On Synced. Invoked when the downlink has synchronised with the lane. The handler takes a reference to the state of the downlink.
- On Set. Invoked when the state of the downlink has changed. The handler takes an optional value to the previous state and a reference to the new state of the downlink.
- On Event. Invoked when the state of the downlink has changed. The handler takes a reference to the new state of the downlink.
- On Unlinked. Invoked when the link with the lane has been closed. The handler takes no parameters.
- On Failed. Invoked when the link with the lane fails; this may be caused if downlink fails to deserialize a frame or the link has been terminated. The handler takes no parameters.

## Stateful Lifecycles

It is possible to share state between the handlers of a value downlink by invoking the `with_shared_state` function when building the lifecycle. The state provided to the function will be provided to all handlers when they are invoked alongside any other parameters the handler accepts. Like with agent lifecycles, the downlink lifecycle can only access its state through a shared reference and so interior mutability must be used.

Stateful lifecycles are useful in instances where you may need to build a local history of the downlink's state, track metrics or scope functionality to the handlers themselves as opposed to the agent's lifecycle.

A worked example for publishing a downlink's event count:

```rust

use std::cell::Cell;
use swimos::agent::{
    agent_lifecycle::HandlerContext,
    agent_model::downlink::hosted::ValueDownlinkHandle,
    config::SimpleDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    event_count: ValueLane<u64>,
}

#[derive(Debug, Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<ValueDownlinkHandle<i32>>>,
}

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let ExampleLifecycle { handle } = self;
        let state: Cell<u64> = Default::default();

        context
            .value_downlink_builder(None, "node", "lane", SimpleDownlinkConfig::default())
            .with_shared_state(state)
            .on_event(|state: &Cell<_>, context: HandlerContext<_>, _: &i32| {
                let count = state.get() + 1;
                state.set(count);
                context.set_value(ExampleAgent::EVENT_COUNT, count)
            })
            .done()
            .and_then(move |downlink_handle| handle.set(Some(downlink_handle)))
    }
}

```

# Value Downlink Handles

After opening a Value Downlink, you are provided with a handle which may be used to set the current state of the downlink and its remote lane, and to stop the downlink. While operations may be executed using the handle, the downlink may not have necessarily opened a link to the lane and care should be taken to ensure that dispatched operations are executing on a valid link; this is possible by implementing synchronisation using the lifecycle event handlers and a barrier on the receiving end using the handle.

If it is desirable to keep the handle to the downlink by placing it inside of the agent's lifecycle after it has been created:

```rust

use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::ValueDownlinkHandle,
    config::SimpleDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    lane: ValueLane<u64>,
}

#[derive(Debug, Default)]
pub struct ExampleLifecycle {
    /// Here we use a State instance which enables using interior
    /// mutability in agent lifecycles. Since the downlink is not
    /// opened until the agent has started the handle must be wrapped
    /// in an Option.
    handle: State<ExampleAgent, Option<ValueDownlinkHandle<i32>>>,
}

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let ExampleLifecycle { handle } = self;

        context
            .value_downlink_builder(None, "node", "lane", SimpleDownlinkConfig::default())
            .done()
            .and_then(move |downlink_handle| {
              /// Set the value of the State to be the downlink handle.
              handle.set(Some(downlink_handle))
            })
    }
}
```

## Set

Sets the current state of the downlink, ensuring that the new state is synchronised with the remote lane. Invoking this function only _queues_ the new value to be set and then returns immediately. It does not wait for the state to be synchronised with the lane.

An example for setting the state of a downlink to double what a lane receives:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::ValueDownlinkHandle,
    AgentLaneModel,
    config::SimpleDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane, lifecycle,
    projections,
    state::State,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    lane: ValueLane<u64>,
}

#[derive(Debug, Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<ValueDownlinkHandle<u64>>>,
}

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let ExampleLifecycle { handle } = self;
        context
            .value_downlink_builder(None, "node", "lane", SimpleDownlinkConfig::default())
            .done()
            .and_then(move |downlink_handle| handle.set(Some(downlink_handle)))
    }

    #[on_event(lane)]
    pub fn on_event<'s>(
        &'s self,
        _context: HandlerContext<ExampleAgent>,
        value: &u64,
    ) -> impl EventHandler<ExampleAgent> + 's {
        let value = *value;
        self.handle.with_mut(move |state| {
            if let Some(handle) = state.as_mut() {
                // If the there is an error setting the state of the downlink
                // then clear it from the State.
                if handle.set(value * 2).is_err() {
                    *state = None;
                }
            }
        })
    }
}
```

## Stop

Triggers the downlink to begin its shutdown sequence. Any pending reads may still be read by the downlink and any pending writes may be flushed to the lane.

Example for terminating a downlink if a sentinel value is received:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::ValueDownlinkHandle,
    config::SimpleDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
}

#[derive(Debug, Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<ValueDownlinkHandle<i32>>>,
}

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let ExampleLifecycle { handle } = self;
        context
            .value_downlink_builder(None, "node", "lane", SimpleDownlinkConfig::default())
            .done()
            .and_then(move |downlink_handle| handle.set(Some(downlink_handle)))
    }

    #[on_event(lane)]
    pub fn on_event<'s>(
        &'s self,
        _context: HandlerContext<ExampleAgent>,
        value: &i32,
    ) -> impl EventHandler<ExampleAgent> + 's {
        let value = *value;
        self.handle.with_mut(move |state| {
            if let Some(handle) = state.as_mut() {
                if value == -1 {
                    handle.stop();
                    *state = None;
                }
            }
        })
    }
}
```

# Try It Yourself

A standalone project that demonstrates Value Downlinks is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/value_downlink).
