---
title: Demand Value Lanes
short-title: Demand Value Lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/demand_value_lanes
redirect_from:
  - /tutorials/demand-value-lanes/
  - /reference/demand-value-lanes.html
  - /backend/demand-value-lanes/
---

This page covers the specifics of Demand Value Lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page.

# Overview

Demand Lanes are stateless lanes that compute a value only when explicitly requested and use the lane's lifecycle event handler, `on_cue` to retreive a value to send to attached uplinks. Requests to calculate a new value are made using the [Handler Context's](https://docs.rs/swimos_agent/{{ site.data.rust.swimos-agent-version }}/swimos_agent/agent_lifecycle/struct.HandlerContext.html) `cue` function. A Demand Value Lane has the following properties:

- Values are `cue`-ed into the Demand Value Lane by calling the [Handler Context's](https://docs.rs/swimos_agent/{{ site.data.rust.swimos-agent-version }}/swimos_agent/agent_lifecycle/struct.HandlerContext.html) `cue` function.
- Following a `cue` invocation, the Demand Value Lane's `on_cue` lifecycle event handler will be invoked for a value to be produced.
- The cued value will be sent to all attached uplinks.

Demand Value Lanes are perfect for handling expensive computations that should not be executed with every update. They ensure clients receive the latest state in real-time, without needing every incremental update, and allow for updates as frequently as possible. `cue` invocations may happen at scheduled intervals (using timers) or after another event has been triggered by an agent (such as after another lane receives an update and its lifecycle event handler invokes `cue`).

For instances where a map structure is required, a [Demand Map Lane]({% link _rust-server/demand-map-lanes.md %}) exists where a `cue_key` function queues a key-value pair into the lane.

Example: using a Value Lane event handler to cue a value:

```rust
use swimos::agent::event_handler::EventHandler;
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{HandlerAction, HandlerActionExt},
    lanes::{DemandLane, ValueLane},
    lifecycle, projections, AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    state: ValueLane<i32>,
    demand: DemandLane<i32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_event(state)]
    pub fn on_event(
        &self,
        context: HandlerContext<ExampleAgent>,
        _value: &i32,
    ) -> impl EventHandler<ExampleAgent> {
        context.cue(ExampleAgent::DEMAND)
    }

    #[on_cue(demand)]
    pub fn on_cue(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl HandlerAction<ExampleAgent, Completion = i32> {
        context.get_value(ExampleAgent::STATE).map(|n| 2 * n)
    }
}
```

# Use cases

Demand Value Lanes are suitable for scenarios where immediate data access isn't crucial, and a delay between linking to the lane and invoking cue is acceptable. Common usecases are:

- Generating data on-demand using [Command Lanes]({% link _rust-server/command-lanes.md %}). A Command Lane may react to a command and invoke the `cue` function to return a response.
- Propagating a subset of data. A Demand Lane may generate a subset of data from the state of another lane and propagate this to linked peers rather than duplicating the state of a lane. The lane's superset may invoke the `cue` operation after its state changes to avoid this duplication.

# Event handler

The Demand Value Lane lifecycle event handler has the following signature for an `i32` type:

```rust
#[on_cue(lane_name)]
fn handler(&self, context: HandlerContext<ExampleAgent>) -> impl EventHandler<ExampleAgent, Completion = i32> {
    //...
}
```

Only one may be registered for the lane and it is invoked exactly once when a `cue` operation has been requested and the returned `EventHandler` must complete with the same type as the lane.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provide a `cue` function for cueing a value to the Demand Value Lane:

```rust
use std::sync::{Arc, Mutex};
use std::time::Duration;
use swimos::agent::event_handler::EventHandler;
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::HandlerAction,
    lanes::{DemandLane, ValueLane},
    lifecycle, projections, AgentLaneModel,
};
use swimos_form::Form;

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    state: ValueLane<i32>,
    metrics: DemandLane<Metrics>,
}

#[derive(Clone, Default)]
pub struct ExampleLifecycle {
    metrics: Arc<Mutex<Metrics>>,
}

#[derive(Copy, Clone, Form, Default, Debug)]
pub struct Metrics {
    event_count: usize,
}

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> {
        context.schedule_repeatedly(Duration::from_secs(2), move || {
            Some(context.cue(ExampleAgent::METRICS))
        })
    }

    #[on_event(state)]
    pub fn on_event(
        &self,
        context: HandlerContext<ExampleAgent>,
        _value: &i32,
    ) -> impl EventHandler<ExampleAgent> {
        let metrics = self.metrics.clone();
        context.effect(move || {
            let metrics = &mut *metrics.lock().unwrap();
            metrics.event_count += 1;
        })
    }

    #[on_cue(metrics)]
    pub fn on_cue(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl HandlerAction<ExampleAgent, Completion = Metrics> {
        let metrics = self.metrics.clone();
        context.effect(move || *metrics.lock().unwrap())
    }
}
```

# Subscription

A subscription to a Demand Value Lane can only be achieved via a [Value Downlink]({% link _rust-server/value-downlinks.md %}). An example client for the previous agent example:

```rust
use swimos_client::{BasicValueDownlinkLifecycle, DownlinkConfig, RemotePath, SwimClientBuilder};
use swimos_form::Form;

#[derive(Copy, Clone, Form, Default, Debug)]
pub struct Metrics {
    event_count: usize,
}

#[tokio::main]
async fn main() {
    let (client, task) = SwimClientBuilder::default().build().await;
    let _client_task = tokio::spawn(task);
    let handle = client.handle();

    let metrics_path = RemotePath::new("ws://0.0.0.0:54470", "/example/1", "metrics");
    let metrics_lifecycle = BasicValueDownlinkLifecycle::default()
        .on_event_blocking(|metrics: &Metrics| println!("{metrics:?}"));
    let _metrics_downlink = handle
        .value_downlink::<Metrics>(metrics_path)
        .lifecycle(metrics_lifecycle)
        .downlink_config(DownlinkConfig::default())
        .open()
        .await
        .expect("Failed to open downlink");

    let state_path = RemotePath::new("ws://0.0.0.0:54470", "/example/1", "state");
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

A standalone project that demonstrates Command Lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/demand_lane).
