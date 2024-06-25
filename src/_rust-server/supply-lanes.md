---
title: Supply Lanes
short-title: Supply Lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
redirect_from:
  - /tutorials/supply-lanes/
  - /reference/supply-lanes.html
  - /backend/supply-lanes/
---

This page covers the specifics of Supply Lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page.

# Overview

Supply Lanes have no accessible state and instead are fed values to propagate to attached uplinks. Internally, they are backed by a queue of pending messages that are guaranteed to be dispatched. A Supply Lane has the following properties:

- Values are supplied to the lane by calling the [Handler Context's]({% link _rust-server/handler-context.md %}) `supply` function.
- The supplied value will be sent to all attached uplinks.

Similar to [Demand Value Lanes]({% link _rust-server/demand-value-lanes.md %}), values in Supply Lanes are computed using lifecycle event handlers. However, in Supply Lanes, values are directly provided to the supply function, and no lifecycle event handler can be registered.

Supply Lanes are ideal for publishing statistical events, where it is important that a client receives every incremental update, that the state clients receive is real-time, and that updates are desired as often as possible. `supply` invocations may happen at scheduled intervals (using timers) or after another event has been triggered by an agent (such as after another lane receives an update and its lifecycle event handler invokes `supply`).

The following example demonstrates using a Supply Lane as well as how the same functionality would look using a Demand Lane:

```rust
use swimos::agent::event_handler::HandlerAction;
use swimos::agent::lanes::{DemandLane, SupplyLane};
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections, AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
    supply: SupplyLane<i32>,
    demand: DemandLane<i32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_event(lane)]
    pub fn on_event(
        &self,
        context: HandlerContext<ExampleAgent>,
        value: &i32,
    ) -> impl EventHandler<ExampleAgent> {
        let n = *value;
        context
            .supply(ExampleAgent::SUPPLY, n * 2)
            .followed_by(context.cue(ExampleAgent::DEMAND))
    }

    #[on_cue(demand)]
    pub fn on_cue(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl HandlerAction<ExampleAgent, Completion = i32> {
        context.get_value(ExampleAgent::LANE).map(|n| 2 * n)
    }
}
```

# Use cases

Supply Lanes are appropriate for scenarios where immediate data access isn't critical, and you can accommodate the delay between linking to the lane and invoking the supply operation. Typical use cases include:

- Generating data on-demand using [Command Lanes]({% link _rust-server/command-lanes.md %}). A Command Lane may react to a command and invoke the `supply` function to return a response.
- Propagating a subset of data. A Supply Lane may generate a subset of data from the state of another lane and propagate this to linked peers rather than duplicating the state of a lane. The lane's superset may invoke the `supply` operation after its state changes to avoid this duplication.

# Event handler

No lifecycle event handler is provided for a Supply Lane. Values are fed to the lane using the [Handler Context's]({% link _rust-server/handler-context.md %}) `supply` function.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provide a `supply` function for feeding a value to the Supply Lane. An example client which uses a Supply Lane for pushing log events:

```rust
use swimos::agent::lanes::SupplyLane;
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections, AgentLaneModel,
};
use swimos_form::Form;

#[derive(Form, Clone, Debug)]
pub struct LogEntry {
    message: String,
}

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    state: ValueLane<i32>,
    logs: SupplyLane<LogEntry>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_event(state)]
    pub fn on_event(
        &self,
        context: HandlerContext<ExampleAgent>,
        value: &i32,
    ) -> impl EventHandler<ExampleAgent> {
        let n = *value;
        context.supply(
            ExampleAgent::LOGS,
            LogEntry {
                message: format!("{n}"),
            },
        )
    }
}
```

# Subscription

A subscription to a Supply Lane can only be achieved via an [Event Downlink]({% link _rust-server/event-downlinks.md %}). A client for the previous agent example:

```rust
use swimos_client::{BasicValueDownlinkLifecycle, DownlinkConfig, RemotePath, SwimClientBuilder};
use swimos_form::Form;

#[derive(Form, Clone, Debug)]
pub struct LogEntry {
    message: String,
}

#[tokio::main]
async fn main() {
    let (client, task) = SwimClientBuilder::default().build().await;
    let _client_task = tokio::spawn(task);
    let handle = client.handle();

    let log_path = RemotePath::new("ws://0.0.0.0:52284", "/example/1", "logs");
    let log_lifecycle = BasicValueDownlinkLifecycle::default()
        .on_event_blocking(|log: &LogEntry| println!("{log:?}"));
    let _log_downlink = handle
        .event_downlink::<LogEntry>(log_path)
        .lifecycle(log_lifecycle)
        .downlink_config(DownlinkConfig::default())
        .open()
        .await
        .expect("Failed to open downlink");

    let state_path = RemotePath::new("ws://0.0.0.0:52284", "/example/1", "state");
    let state_downlink = handle
        .value_downlink::<i32>(state_path)
        .downlink_config(DownlinkConfig::default())
        .open()
        .await
        .expect("Failed to open downlink");

    for i in 0..10 {
        state_downlink.set(i).await.unwrap()
    }

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl-c.");
}

```

Further reading: [Downlinks]({% link _rust-server/downlinks.md %})

# Try It Yourself

A standalone project that demonstrates Supply Lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/supply_lane).
