---
title: Demand Map Lanes
short-title: Demand Map Lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/demand_map_lanes
redirect_from:
  - /tutorials/demand-map-lanes/
  - /reference/demand-map-lanes.html
  - /backend/demand-map-lanes/
---

This page covers the specifics of Demand Map Lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page.

# Overview

Demand Map Lanes are stateless lanes that compute a value for an associated key only when explicitly requested and use the lane's lifecycle event handler, `on_cue_key` to retreive a value to send to attached uplinks. Requests to calculate a new value are made using the [Handler Context's](https://docs.rs/swimos_agent/{{ site.data.rust.swimos-agent-version }}/swimos_agent/agent_lifecycle/struct.HandlerContext.html) `cue_key` function. A Demand Value Lane has the following properties:

- Values for keys are `cue`-ed into the Demand Map Lane by calling the [Handler Context's](https://docs.rs/swimos_agent/{{ site.data.rust.swimos-agent-version }}/swimos_agent/agent_lifecycle/struct.HandlerContext.html) `cue_key` function.
- Following a `cue` invocation, the Demand Map Lane's `on_cue_key` lifecycle event handler will be invoked for a value to be produced for the given key.
- The cued key-value will be sent to all attached uplinks as an update envelope

Demand Map Lanes are ideal for publishing statistical events, where it isn’t important that a client receives every incremental update, only that the client eventually receives the latest state, that the state clients receive is real-time (within the latency of the network), and that updates are desired as often as possible. `cue_key` invocations may happen at scheduled intervals (using timers) or after another event has been triggered by an agent (such as after another lane receives an update and its lifecycle event handler invokes `cue_key`).

For instances where a value type is required, a [Demand Value Lane]({% link _rust-server/demand-value-lanes.md %}) exists where a `cue` function queues a value into the lane.

Example: using a Demand Map Lane event handler extract a subset of data from a Map Lane:

```rust

use std::collections::HashMap;

use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerAction, HandlerActionExt},
    lanes::{DemandMapLane, MapLane},
    lifecycle, projections, AgentLaneModel,
};
use swimos_form::Form;

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    orders: MapLane<usize, Order>,
    values: DemandMapLane<usize, usize>,
}

#[derive(Clone, Default)]
pub struct ExampleLifecycle;

#[derive(Clone, Form, Default, Debug)]
pub struct Order {
    name: String,
    value: usize,
}

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_update(orders)]
    pub fn on_update(
        &self,
        context: HandlerContext<ExampleAgent>,
        _map: &HashMap<usize, Order>,
        key: usize,
        _prev: Option<Order>,
        _new_value: &Order,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        context.cue_key(ExampleAgent::VALUES, key)
    }

    #[on_cue_key(values)]
    pub fn on_cue_key(
        &self,
        context: HandlerContext<ExampleAgent>,
        key: usize,
    ) -> impl HandlerAction<ExampleAgent, Completion = Option<usize>> {
        context
            .get_entry(ExampleAgent::ORDERS, key)
            .map(|value: Option<Order>| value.map(|order| order.value))
    }
}
```

# Use cases

Demand Map Lanes are suitable for situations where you aren't interested in the data immediately and can handle the delay between linking to the lane and the `cue_key` invocation. Common usecases are:

- Generating data on-demand using [Command Lanes]({% link _rust-server/command-lanes.md %}). A Command Lane may react to a command and invoke the `cue_key` function to return a response.
- Propagating a subset of data. A Demand Map Lane may generate a subset of data from the state of another lane and propagate this to linked peers rather than duplicating the state of a lane. The lane's superset may invoke the `cue_key` operation after its state changes to avoid this duplication.

# Event handler

The Demand Map Lane lifecycle event handler has the following signature for a map with a key-value type of `i32`

```rust
#[on_cue_key(lane_name)]
fn handler(&self, context: HandlerContext<ExampleAgent>, key: i32) -> impl EventHandler<ExampleAgent, Completion = Option<i32>> {
    //...
}
```

Only one may be registered for the lane and it is invoked exactly once when a `on_cue_key` operation has been requested and the returned `EventHandler` must complete with an `Option` containing the same value type as the lane.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provide a `cue_key` function for cueing a key-value pair to the Demand Map Lane:

```rust
use std::collections::HashMap;

use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerAction},
    lanes::{CommandLane, DemandMapLane},
    lifecycle, projections, AgentLaneModel,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    command: CommandLane<String>,
    demand_map: DemandMapLane<String, i32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle(HashMap<String, i32>);

impl Default for ExampleLifecycle {
    fn default() -> Self {
        let content = [("Red", 12), ("Green", 56), ("Blue", 78)]
            .into_iter()
            .map(|(s, n)| (s.into(), n))
            .collect::<HashMap<_, _>>();
        ExampleLifecycle(content)
    }
}

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_command(command)]
    pub fn trigger_cue(
        &self,
        context: HandlerContext<ExampleAgent>,
        message: &str,
    ) -> impl EventHandler<ExampleAgent> {
        context.cue_key(ExampleAgent::DEMAND_MAP, message.to_string())
    }

    #[on_cue_key(demand_map)]
    pub fn on_cue_key(
        &self,
        context: HandlerContext<ExampleAgent>,
        key: String,
    ) -> impl HandlerAction<ExampleAgent, Completion = Option<i32>> + '_ {
        context.effect(move || {
            let ExampleLifecycle(content) = self;
            content.get(&key).copied()
        })
    }
}
```

# Subscription

A subscription to a Demand Map Lane can only be achieved via a [Map Downlink]({% link _rust-server/map-downlinks.md %}). An example client for the previous agent example:

```rust
use std::time::Duration;

use swimos_client::{
    BasicMapDownlinkLifecycle, BasicValueDownlinkLifecycle, DownlinkConfig, RemotePath,
    SwimClientBuilder,
};

#[tokio::main]
async fn main() {
    let (client, task) = SwimClientBuilder::default().build().await;
    let _client_task = tokio::spawn(task);
    let handle = client.handle();

    let command_path = RemotePath::new("ws://0.0.0.0:60926", "/example/1", "command");
    let command_lifecycle = BasicValueDownlinkLifecycle::default()
        .on_event_blocking(|command: &String| println!("{command:?}"));
    let command_downlink = handle
        .value_downlink::<String>(command_path)
        .lifecycle(command_lifecycle)
        .downlink_config(DownlinkConfig::default())
        .open()
        .await
        .expect("Failed to open downlink");

    let demand_map_path = RemotePath::new("ws://0.0.0.0:60926", "/example/1", "demand_map");
    let demand_map_lifecycle = BasicMapDownlinkLifecycle::default().on_update_blocking(
        |key: String, _map, _previous, value: &i32| println!("Key: {key:?} -> value: {value:?}"),
    );
    let _demand_map_downlink = handle
        .map_downlink::<String, i32>(demand_map_path)
        .downlink_config(DownlinkConfig::default())
        .lifecycle(demand_map_lifecycle)
        .open()
        .await
        .expect("Failed to open downlink");

    let keys = ["Red".to_string(), "Green".to_string(), "Blue".to_string()]
        .into_iter()
        .cycle();

    for key in keys {
        command_downlink.set(key).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl-c.");
}
```

Further reading: [Downlinks]({% link _rust-server/downlinks.md %})

# Try It Yourself

A standalone project that demonstrates Demand Map Lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/demand_map_lane).
