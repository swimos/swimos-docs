---
title: Join Value Lanes
short-title: Join Value Lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/demand_value_lanes
redirect_from:
  - /tutorials/join-value-lanes/
  - /reference/join-value-lanes.html
  - /backend/join-value-lanes/
---

This page covers the specifics of Join Value Lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page. If you are not familar with Value Downlinks, it is recommended to first read the [Value Downlinks]({% link _rust-server/value-downlinks.md %}) guide.

# Overview

A Join Value Lane provides a view into the state of multiple [Value Lanes]({% link _rust-server/value-lanes.md %}) by using [Value Downlinks]({% link _rust-server/value-downlinks.md %}) and associating a received value with a user-defined key in a map data structure. This allows you to aggregate the state of multiple data sources into a single data structure and be notified when a key changes. It is not possible to directly mutate the state of the map and instead the value associated with a key is mutated by the underlying downlink receiving an event.

A Join Value Lane meets the following requirements:

- A Join Value Lane may be linked to multiple value lanes and is opened using `HandlerContext::add_downlink`.
- The state of the Join Value Lane is represented as a map of entries where the key is a unique identifier which is provided when opening the downlink. This allows you to identify which downlink has received an event.
- A Join Value Lane has the same lifecycle event handlers as a [Map Lane]({% link _rust-server/map-lanes.md %}) and an additional lifecycle handler for the underlying downlinks.

For instances where a map structure is required, a [Join Map Lane]({% link _rust-server/join-map-lanes.md %}) exists where the value associated with an entry is a map.

Example: using a Join Value Lane to aggregate the state of multiple Value Lanes:

```rust
use std::time::Duration;

use rand::RngCore;

use swimos::{
    agent::event_handler::{EventHandler, HandlerActionExt},
    agent::agent_lifecycle::utility::HandlerContext,
    agent::lanes::{JoinValueLane, ValueLane},
    agent::projections,
    agent::{lifecycle, AgentLaneModel}
};

// Mock agent that simply produces data.
#[derive(AgentLaneModel)]
#[projections]
pub struct GeneratorAgent {
    state: ValueLane<u32>,
}

#[derive(Clone)]
pub struct GeneratorLifecycle;

#[lifecycle(GeneratorAgent)]
impl GeneratorLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<GeneratorAgent>,
    ) -> impl EventHandler<GeneratorAgent> {
        // When this agent starts, schedule a task to update the state of
        // the lane so there is some data to work with in our ConsumerAgent.
        context.schedule_repeatedly(Duration::from_millis(500), move || {
            let mut rnd = rand::thread_rng();
            Some(context.set_value(GeneratorAgent::STATE, rnd.next_u32()))
        })
    }
}

#[derive(AgentLaneModel)]
#[projections]
pub struct ConsumerAgent {
    // Our aggregated value lanes will be
    // available under a lane with a URI
    // of 'lanes'.
    lanes: JoinValueLane<String, u32>,
}

#[derive(Clone)]
pub struct ConsumerLifecycle;

#[lifecycle(ConsumerAgent)]
impl ConsumerLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ConsumerAgent>,
    ) -> impl EventHandler<ConsumerAgent> {
        // Issue commands to three different 'state' lanes so the
        // agents start.
        let commands = context
            .send_command(None, "/node/a", "state", 0)
            .followed_by(context.send_command(None, "/node/b", "state", 0))
            .followed_by(context.send_command(None, "/node/c", "state", 0));

        // Next, create the downlinks to the 'state' lanes and
        // associate each downlink with a key. This key will be
        // provided to any lifecycle event handlers so you can
        // uniquely identify the source of an event.
        let downlinks = context
            .add_downlink(
                // Projection to the JoinValueLane
                ConsumerAgent::LANES,
                // Unique key for this downlink
                "a".to_string(),
                // `None` as the target lane is local
                None,
                // Node that we're downlinking to
                "/node/a",
                // Lane that we're downlinking to
                "state",
            )
            .followed_by(context.add_downlink(
                ConsumerAgent::LANES,
                "b".to_string(),
                None,
                "/node/b",
                "state",
            ))
            .followed_by(context.add_downlink(
                ConsumerAgent::LANES,
                "c".to_string(),
                None,
                "/node/c",
                "state",
            ));
        // Chain the actions together into a single event handler
        // that will issue the commands and then open the downlinks.
        commands.followed_by(downlinks)
    }
}
```

# Use cases

Join Value Lanes are suitable for situations where you want to aggregate the state of multiple lanes into a single map and are generally used to produce a wider view of a dataset which is spread across a number of agents. Common usecases for Join Value Lanes are:

- Reducing the state of the map to perform calculations for statistics. When an entry in the map changes, a reduction of the map is performed and the result can be pushed to another lane. An example of this is available [here]({{ site.data.rust.github_base }}/example_apps/transit/src/agents/state.rs#L142).
- Simplifying aggregations for clients. Exposing a single Join Value Lane which aggregates a superset of data results in a simplified topology as opposed to clients opening a large number of downlinks remotely.

# Event handlers

Join Value Lanes use the same lifecycle event handlers as [Map Lanes]({% link _rust-server/map-lanes.md %}) and provide an additional handler which can be registered to create a handler for the downlinks of the lane.

## On Update

The `on_update` event handler has the following signature for a join value lane type of `JoinValueLane<i32, i32>`:

```rust
#[on_event(lane_name)]
fn handler(
    &self,
    context: HandlerContext<ExampleAgent>,
    map: &HashMap<i32, i32>,
    downlink_key: i32,
    prev: Option<i32>,
    new_value: &i32,
) -> impl EventHandler<ExampleAgent> {
    //...
}
```

The handler is provided with a reference to the current state of the underlying map, the downlink key that was updated, the previous value associated with the downlink (if one existed) and a reference to the updated value.

Only one may be registered for the lane and it is invoked exactly once after an entry has been updated.

## On Remove

The `on_remove` event handler has the following signature for a join value lane type of `JoinValueLane<i32, i32>`:

```rust
#[on_remove(lane_name)]
fn on_remove(
    &self,
    context: HandlerContext<ExampleAgent>,
    map: &HashMap<i32, i32>,
    downlink_key: i32,
    prev: i32,
) -> impl EventHandler<ExampleAgent> {
    //...
}
```

The handler is provided with a reference to the current state of the underlying map, the downlink key that was updated and the value that was removed.

Only one may be registered for the lane and it is invoked exactly once after an entry has been removed.

## Join Value Lifecycle

The `join_value_lifecycle` event handler has the following signature for a join value lane type of `JoinValueLane<i32, i32>`:

```rust
#[join_value_lifecycle(lane_name)]
fn register_count_lifecycle(
    &self,
    context: JoinValueContext<ExampleAgent, i32, i32>,
) -> impl JoinValueLaneLifecycle<i32, i32, ExampleAgent> + 'static {
    //...
}
```

The handler is invoked to create a new lifecycle event handler for each downlink used in the lane. The returned lifecycle may specify lifecycle event handlers for:

- `on_linked`: invoked when the link with the lane is successfully opened.
- `on_synced`: invoked when the downlink has synchronised with the lane. The handler is provided with a reference to the state of the lane.
- `on_unlinked`: invoked when the link with the lane has closed. The handler must return a `swimos::agent::lanes::LinkClosedResponse` which specifies how the lane should proceed.
- `on_failed`: invoked when the link with the lane has failed with an error. The handler must return a `swimos::agent::lanes::LinkClosedResponse` which specifies how the lane should proceed.

A complete example for a Join Value downlink lifecycle:

```rust
use swimos::{
    agent::agent_lifecycle::utility::JoinValueContext,
    agent::lanes::join_value::lifecycle::JoinValueLaneLifecycle,
    agent::lanes::LinkClosedResponse
};

#[join_value_lifecycle(lane_name)]
fn lifecycle(
    &self,
    context: JoinValueContext<ExampleAgent, i32, i32>,
) -> impl JoinValueLaneLifecycle<i32, i32, ExampleAgent> + 'static {
    context
        .builder()
        .on_linked(move |context, key, remote| {
            let remote_fmt = remote.to_string();
            context.effect(move || {
                println!("{key} linked to {remote_fmt}");
            })
        })
        .on_synced(move |context, key, _remote, value| {
            let value = value.cloned();
            context.effect(move || {
                println!("{key} synced. State: {key:?} -> {value:?}");
            })
        })
        .on_unlinked(move |context, key, remote| {
            let remote_fmt = remote.to_string();
            context.effect(move || {
                println!("{key} unlinked to {remote_fmt}");
                // `Abandon` will remove the underlying link and maintain the data in the
                // underlying map.
                LinkClosedResponse::Abandon
            })
        })
        .on_failed(move |context, key, remote| {
            let remote_fmt = remote.to_string();
            context.effect(move || {
                println!("{key} failed to {remote_fmt}");
                // `Delete` will remove the underlying link and remove the data from the
                // underlying map.
                LinkClosedResponse::Delete
            })
        })
        .done()
}
```

# Subscription

A subscription to a Join Value Lane can only be achieved via a [Map Downlink]({% link _rust-server/map-downlinks.md %}). An example client for the first agent example:

```rust
use swimos_client::{BasicMapDownlinkLifecycle, RemotePath, SwimClientBuilder};

#[tokio::main]
async fn main() {
    let (client, task) = SwimClientBuilder::default().build().await;
    let _client_task = tokio::spawn(task);
    let handle = client.handle();

    let lifecycle = BasicMapDownlinkLifecycle::<String, u32>::default()
        .on_update_blocking(|key, _map, _previous, new| {
            println!("Entry updated: {key:?} -> {new:?}")
        })
        .on_removed_blocking(|key, _map, value| println!("Entry removed: {key:?} -> {value:?}"))
        .on_clear_blocking(|map| println!("Map cleared: {map:?}"));

    let _handle = handle
        .map_downlink::<String, u32>(RemotePath::new("ws://0.0.0.0:59673", "/consumer", "lanes"))
        .lifecycle(lifecycle)
        .open()
        .await
        .expect("Failed top open downlink");

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl-c.");
}
```

Further reading: [Downlinks]({% link _rust-server/downlinks.md %})

# Try It Yourself

A standalone project that demonstrates Join Value Lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/join_value).
