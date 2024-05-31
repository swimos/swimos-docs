---
title: Server Map Downlinks
short-title: Server Map Downlinks
description: "Share scalar data across Web Agents and clients through persistent, bidirectionally-streaming lane references."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/swim-rust/tree/main/example_apps/map_downlink
redirect_from:
  - /tutorials/map-downlinks/
  - /reference/map-downlinks.html
  - /backend/map-downlinks/
---

This page covers the specifics of Map Downlinks and does not cover the more general aspects of Server Downlinks. For more general information about Server Downlinks, see the [Server Downlinks]({% link _rust-server/server-downlinks.md %}) page.

# Overview

A Map Downlink synchronises a shared, real-time, scalar value with a lane outside of the current [Web Agent]({% link _rust-server/web-agents.md %}); this may be a lane that is local or remote. A Map Downlink exposes a variety of lifecycle event handlers that may be registered and are invoked during the lifetime of the downlink.

# Use Cases

Map Downlinks provide a Web Agent with a view into remote key-value map state. Allowing you to be notified of state changes elsewhere in a system and react to them, incrementally mutating it as required. Common usecases of Map Downlinks are:

- Replicating state across agents. Using a Map Downlink, you can replicate the state of another lane into your Web Agent. This is useful in instances where a datapoint is shared across Web Agents and is more cleanly defined in a parent Web Agent and a downlink is instead used to replicate it; consider designing a Web Agent for a road and the flow state of the road is defined by a traffic light which is its own Web Agent.
- Aggregating state. Aggregate the state of multiple lanes across multiple Web Agents into a single [Map Lane]({% link _rust-server/map-lanes.md %}) using Map Downlinks.

# Instantiation

Map Downlinks are created using a [Handler Context]({% link _rust-server/handler-context.md %}) instance which is provided to any lifecycle implementation. While a downlink may not be created the same way as lanes, they may be created when the first starts or an event is received by another lane and a handle to the downlink may be stored in the lifecycle's instance.

Like all downlinks, they are opened by invoking the corresponding function on the [Handler Context]({% link _rust-server/handler-context.md %}) which returns a `HandlerAction` which will perform the actual construction of the downlink. There are two options available on the context for creating a Map Downlink: using a builder pattern which provides a flexible approach for defining the lifecycle of the downlink or by providing the lifecycle as an argument directly.

A Map Downlink may be built using the `HandlerContext::value_downlink_builder` function. Which is defined as follows:

```rust
use swimos::agent::{
  config::MapDownlinkConfig,
  agent_lifecycle::utility::StatelessMapDownlinkBuilder
};

impl HandlerContext<Agent> {
    // Additional bounds redacted for brevity.
    pub fn map_downlink_builder<K, V>(
        &self,
        host: Option<&str>,
        node: &str,
        lane: &str,
        config: MapDownlinkConfig,
    ) -> StatelessMapDownlinkBuilder<Agent, K, V>
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

A complete example for opening a Map Downlink:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::MapDownlinkHandle,
    config::SimpleDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
}

#[derive(Debug, Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<MapDownlinkHandle<String, i32>>>,
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
            .map_downlink_builder::<String, i32>(
                None,
                "/example/2",
                "lane",
                MapDownlinkConfig::default(),
            )
            .on_linked(|context| context.effect(move || println!("Link opened.")))
            .on_synced(move |context, map| {
                let map = map.clone();
                context.effect(move || println!("Link synchronized: {:?}", map))
            })
            .on_update(move |context, key, _map, _prev, new_value| {
                let new_value = *new_value;
                context
                    .effect(move || println!("Link received new value: {:?} -> {:?}", key, new_value))
            })
            .on_remove(move |context, key, map, value| {
                context.effect(move || {
                    println!("Link removed value: {:?} -> {:?}", key, value)
                })
            })
            .on_clear(move |context, _map| context.effect(move || println!("Map cleared")))
            .on_unlinked(|context| context.effect(|| println!("Link closed.")))
            .on_failed(|context| context.effect(|| println!("Link failed.")))
            .done()
            .and_then(move |downlink_handle| handle.set(Some(downlink_handle)))
    }
}

```

## Configuration

When creating a Map Downlink, a `swimos::agent::config::MapDownlinkConfig` must be provided that configures two behavioural properties of the Downlink:

- `events_when_not_synced`: if this is set, lifecycle handlers will be invoked for events before the downlink is synchronized with the lane. Defaults to `false`.
- `terminate_on_unlinked`: if this is set, the downlink will stop if it enters the unlinked state. Defaults to: `true`.

# Lifecycle Event Handlers

Lifecycle event handlers may be registered with a Map Downlink to be notified when an event takes places in the downlink. Most commonly, an On Set and On Event handler will be registered to be notified when the downlink's state changes.

Any lifecycle event handler that is registered is run within the context of the agent that opened it and has access to the agent's `HandlerContext`. As such, the handlers may invoke operations that read or mutate the state of the agent. All handlers are invoked exactly once after an event has occurred.

A variety of event handlers are available:

- On Linked. Invoked when the link with the lane has been established. The handler takes no parameters.
- On Synced. Invoked when the downlink has synchronised with the lane. The handler takes a reference to the state of the downlink.
- On Update. Invoked when a new key-value pair has been inserted into the map. The handler is provided with the key, a reference to the state of the map, the previous value and a reference to the new value.
- On Remove. Invoked when an entry has been removed from the map. The handler is provided with the key that was removed, a reference to the state of the map and the value associated with the key.
- On Clear. Invoked when the state of the map has been cleared. The handler is provided with the state of the map prior to it being cleared.
- On Unlinked. Invoked when the link with the lane has been closed. The handler takes no parameters.
- On Failed. Invoked when the link with the lane fails. The handler takes no parameters.

## Stateful Lifecycles

It is possible to share state between the handlers of a map downlink by invoking the `with_shared_state` function when building the lifecycle. The state provided to the function will be provided to all handlers when they are invoked alongside any other parameters the handler accepts. Like with agent lifecycles, the downlink lifecycle can only access its state through a shared reference and so interior mutability must be used.

Stateful lifecycles are useful in instances where you may need to build a local history of the downlink's state, track metrics or scope functionality to the handlers themselves as opposed to the agent's lifecycle.

A worked example for tracking all of the values seen by the downlink:

```rust

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::MapDownlinkHandle,
    config::MapDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
}

#[derive(Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<MapDownlinkHandle<String, i32>>>,
    history: Arc<Mutex<HashMap<String, i32>>>,
}

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let ExampleLifecycle { handle, history } = self;
        let history = history.clone();

        context
            .map_downlink_builder::<String, i32>(
                None,
                "/example/2",
                "lane",
                MapDownlinkConfig::default(),
            )
            .on_update(move |context, key, _map, _prev, new_value| {
                let new_value = *new_value;
                let history = history.clone();
                context.effect(move || {
                    let _ = *&mut history.lock().unwrap().insert(key, new_value);
                })
            })
            .done()
            .and_then(move |downlink_handle| handle.set(Some(downlink_handle)))
    }
}
```

# Map Downlink Handles

After opening a Map Downlink, you are provided with a handle which may be used to set the current state of the downlink and its remote lane, and to stop the downlink. While operations may be executed using the handle, the downlink may not have necessarily opened a link to the lane and care should be taken to ensure that dispatched operations are executing on a valid link; this is possible by implementing synchronisation using the lifecycle event handlers and a barrier on the receiving end using the handle.

Dropping the downlink handle will cause the downlink to terminate. It is possible to prevent this by keeping the downlink handle inside the agent's lifecycle after creating it:

```rust

use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::ValueDownlinkHandle,
    config::MapDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<u64>,
}

#[derive(Debug, Default)]
pub struct ExampleLifecycle {
    /// Here we use a State instance which enables using interior
    /// mutability in agent lifecycles. Since the downlink is not
    /// opened until the agent has started the handle must be wrapped
    /// in an Option.
    handle: State<ExampleAgent, Option<MapDownlinkHandle<String, i32>>>,
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
            .map_downlink_builder(None, "node", "lane", MapDownlinkConfig::default())
            .done()
            .and_then(move |downlink_handle| {
              /// Set the value of the State to be the downlink handle.
              handle.set(Some(downlink_handle))
            })
    }
}
```

## Clear

Clears the current state of the downlink, ensuring that the new state is synchronised with the remote lane. Invoking this function only _queues_ the clear operation and then returns immediately. It does not wait for the operation to be synchronised with the lane.

An example for clearing the downlink's state when a sentinel value is received:

```rust

use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::MapDownlinkHandle,
    AgentLaneModel,
    config::MapDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane, lifecycle,
    projections,
    state::State,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<u64>,
}

#[derive(Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<MapDownlinkHandle<String, u64>>>,
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
            .map_downlink_builder::<String, u64>(
                None,
                "/example/2",
                "lane",
                MapDownlinkConfig::default(),
            )
            .on_clear(move |context, _map| context.effect(|| println!("Downlink cleared")))
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
                if value == -1 {
                    handle.clear().expect("Failed to clear downlink");
                }
            }
        })
    }
}
```

## Remove

Removes a key-value pair from the downlink, ensuring that the new state is synchronised with the remote lane. Invoking this function only _queues_ the remove operation and then returns immediately. It does not wait for the operation to be synchronised with the lane.

An example for removing a key-value pair from the downlink:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::MapDownlinkHandle,
    config::MapDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<u64>,
}

#[derive(Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<MapDownlinkHandle<String, u64>>>,
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
            .map_downlink_builder::<String, u64>(
                None,
                "/example/2",
                "lane",
                MapDownlinkConfig::default(),
            )
            .on_remove(move |context, key, _map, value| {
                context.effect(move || println!("Downlink removed entry: {:?} -> {:?}", key, value))
            })
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
                if value == 13 {
                    handle
                        .remove(value.to_string())
                        .expect("Failed to update downlink");
                }
            }
        })
    }
}
```

## Update

Updates or inserts an associated value in the downlink, ensuring that the new state is synchronised with the remote lane. Invoking this function only _queues_ the update operation and then returns immediately. It does not wait for the operation to be synchronised with the lane.

An example for updating an associated value in the downlink:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    agent_model::downlink::hosted::MapDownlinkHandle,
    config::MapDownlinkConfig,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    state::State,
    AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<u64>,
}

#[derive(Default)]
pub struct ExampleLifecycle {
    handle: State<ExampleAgent, Option<MapDownlinkHandle<String, u64>>>,
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
            .map_downlink_builder::<String, u64>(
                None,
                "/example/2",
                "lane",
                MapDownlinkConfig::default(),
            )
            .on_update(move |context, key, _map, _previous_value, new_value| {
                let new_value = *new_value;
                context.effect(move || {
                    println!("Downlink updated entry: {:?} -> {:?}", key, new_value)
                })
            })
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
                if value == 13 {
                    handle
                        .update(value.to_string(), value)
                        .expect("Failed to update downlink");
                }
            }
        })
    }
}
```

# Try It Yourself

A standalone project that demonstrates Map Downlinks is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/map_downlink).
