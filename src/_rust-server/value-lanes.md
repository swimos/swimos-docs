---
title: Value Lanes
short-title: Value Lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/demand_value_lanes
redirect_from:
  - /tutorials/value-lanes/
  - /reference/value-lanes.html
  - /backend/value-lanes/
---

This page covers the specifics of Value Lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page.

# Overview

A Value Lane stores a value that can be mutated and retreived. Each time the state is updated, the updated state is sent to all uplinks attached to it. A Value Lane meets the following requirements:

- The state of the lane can be updated by calling the `set` function on the [Handler Context's](https://docs.rs/swimos_agent/{{ site.data.rust.swimos-agent-version }}/swimos_agent/agent_lifecycle/struct.HandlerContext.html).
- Following a `set` invocation, the Value Lane's `on_event` lifecycle event handler will be invoked with the updated state and the `on_set` lifecycle event handler will be invoked with the previous and current state of the lane.
- The updated state will be sent to all attached uplinks as an event envelope.

Example: using a Value Lane to store an `i32`:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections, AgentLaneModel,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
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
        context.effect(move || {
            println!("Setting value to: {}", n);
        })
    }
}
```

# Use cases

Value Lanes are used for maintaining state and propagating updates to the state immediately. Common usecases are:

- Forming a digital representation of a physical object; such as the [state of a vehicle](https://github.com/swimos/transit/blob/57f1750af6d1de1f29487a73db18d718ab0d2834/server/src/main/java/swim/transit/agent/VehicleAgent.java#L32).
- Persisting state in stream computing. If the SwimOS Server is configured to use a persistent store and the agent times out, the state of the Value Lane will be reloaded from the persistence engine. See [persistence]({% link _rust-server/persistence.md %}) for more information.
- Propagating state in real time. When a downlink first links to a Value Lane, its current state is sent to the downlink. Value Lanes differ to [Demand Lanes]({% link _rust-server/demand-lanes.md %}) as they are backed by computation where Value lanes are backed by a value that is kept in memory.

# Event handler

Value Lanes expose two event handlers. An `on_set` handler which is provided a reference to the updated state of the lane, and `on_event` which is provided a reference to the previous and the updated state of the lane.

## On Event

The `on_event` event handler has the following signature for an `i32` lane type:

```rust
#[on_event(lane_name)]
fn handler(&self, context: HandlerContext<ExampleAgent>, state: &i32) -> impl EventHandler<ExampleAgent> {
    //...
}
```

Only one may be registered for the lane and it is invoked exactly once after the state of the lane has changed.

## On Set

The `on_set` event handler has the following signature for an `i32` lane type:

```rust
#[on_set(lane_name)]
fn handler(&self, context: HandlerContext<ExampleAgent>, new_value: &i32, previous_value: Option<i32>) -> impl EventHandler<ExampleAgent> {
    //...
}
```

Only one may be registered for the lane and it is invoked exactly once when the state of the lane has changed and is invoked after any registered `on_event` handler has been invoked.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provide a `set_value` function for updating the state of a Value Lane and a `get_value` for retreiving the state of a Value Lane. The following example demonstrates retreiving and updating the state of a Value Lane:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    AgentLaneModel,
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    state: ValueLane<i32>,
    event_count: ValueLane<u32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_event(state)]
    pub fn on_event(
        &self,
        context: HandlerContext<ExampleAgent>,
        _state: &i32,
    ) -> impl EventHandler<ExampleAgent> {
        context
            .get_value(ExampleAgent::EVENT_COUNT)
            .and_then(move |event_count: u32| {
                context.set_value(ExampleAgent::EVENT_COUNT, event_count.wrapping_add(1))
            })
    }
}
```

# Subscription

A subscription to a Value Lane can only be achieved via a [Value Downlink]({% link _rust-server/value-downlinks.md %}). An example client for the previous agent example:

```rust
use std::time::Duration;

use swimos_client::{
    BasicValueDownlinkLifecycle, DownlinkConfig, RemotePath,
    SwimClientBuilder,
};

#[tokio::main]
async fn main() {
    let (client, task) = SwimClientBuilder::default().build().await;
    let _client_task = tokio::spawn(task);
    let handle = client.handle();

    let path = RemotePath::new("ws://0.0.0.0:65098", "/example/1", "lane");
    let lifecycle = BasicValueDownlinkLifecycle::default()
        .on_event_blocking(|command: &i32| println!("{command:?}"));
    let downlink = handle
        .value_downlink::<String>(path)
        .lifecycle(lifecycle)
        .downlink_config(DownlinkConfig::default())
        .open()
        .await
        .expect("Failed to open downlink");

    for i in 0..10 {
        downlink.set(i).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl-c.");
}

```

Further reading: [Downlinks]({% link _rust-server/downlinks.md %})

# Try It Yourself

A standalone project that demonstrates Value Lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/value_lane).
