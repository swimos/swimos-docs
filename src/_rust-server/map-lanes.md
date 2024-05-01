---
title: Map lanes
short-title: Map lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/demand_value_lanes
redirect_from:
  - /tutorials/map-lanes/
  - /reference/map-lanes.html
  - /backend/map-lanes/
---

This page covers the specifics of map lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page.

# Overview

A Map Lane stores a list of key-value mappings. When the map has an entry updated or removed the change is propagated to all attached uplinks and this differs to [Value Lanes]({% link _rust-server/value-lanes.md %}) where the entire state of the lane is propagated. A Map Lane meets the following requirements:

- A Map Lane stores key-value mappings. Internally, the Map Lane is backed by a [HashMap](https://doc.rust-lang.org/std/collections/struct.HashMap.html) and places the additional constraint that both the key and value types must implement the [Form]({% link _rust-server/forms.md %}) trait.
- Following an entry being inserted or removed, a corresponding `on_update` or `on_remove` lifecycle event handler will be invoked.
- The Map Lane may be cleared using the `clear` function on the [Handler Context's]({% link _rust-server/handler-context.md %}) and a registered `on_clear` lifecycle event handler will be invoked.
- A Map Lane may be subscribed to using a [Map Downlink]({% link _rust-server/map-downlinks.md %}).

Example Map Lane usage:

```rust
use std::collections::HashMap;

use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::MapLane,
    lifecycle, projections, AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: MapLane<i32, String>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_update(lane)]
    pub fn on_update(
        &self,
        context: HandlerContext<ExampleAgent>,
        _map: &HashMap<i32, String>,
        key: i32,
        prev: Option<String>,
        new_value: &str,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let v = new_value.to_string();
        context.effect(move || {
            if let Some(p) = prev {
                println!("Updating entry for {} from '{}' to '{}'.", key, p, v);
            } else {
                println!("Setting entry for {} to '{}'.", key, v);
            }
        })
    }

    #[on_remove(lane)]
    pub fn on_remove(
        &self,
        context: HandlerContext<ExampleAgent>,
        _map: &HashMap<i32, String>,
        key: i32,
        prev: String,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        context.effect(move || {
            println!("Removing entry for {}. Previous value was '{}'.", key, prev);
        })
    }

    #[on_clear(lane)]
    pub fn on_clear(
        &self,
        context: HandlerContext<ExampleAgent>,
        _prev: HashMap<i32, String>,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        context.effect(|| {
            println!("Map was cleared.");
        })
    }
}
```

# Use cases

Map Lanes are used for maintaining key-value state mappings. They are useful for storing and propagating changes to record-like data structures at a granular level. Common usecases are:

- Storing key-value mapping that are replicated to all uplinks attached to the lane.
- Storing time series data. The key in the map may be used to represent the time of an event and the value may be the corresponding event.
- Mapping a collection of keyed data that does not warrant being its own Web Agent. For example, a collection of sensors on an object that require no additional functionality other than state storage.

# Event handlers

A Map Lane has three lifecycle event handlers that may be registered:

- `on_update`: invoked after an entry in the map has been updated.
- `on_remote`: invoked after an entry in the map has been removed.
- `on_clear`: invoked after the map has been cleared.

It's important to pay close attention to any side effects that a Map Lane's event handler may have while writing a handler. It's possible that a Map Lane's event handler may cause another lane's event handler to mutate the state of the Map while it is executing and this may invalidate the logic of the handler. While contrived, consider the following example:

```rust
use std::collections::HashMap;

use swimos::agent::event_handler::{ConstHandler, HandlerAction, Sequentially};
use swimos::agent::lanes::{DemandLane, DemandMapLane};
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::MapLane,
    lifecycle, projections, AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    map: MapLane<i32, String>,
    demand: DemandLane<Vec<String>>,
    demand_map: DemandMapLane<i32, String>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_cue(demand)]
    pub fn on_cue(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl HandlerAction<ExampleAgent, Completion = Vec<String>> {
        context
            // Get the current state of the map. At this point in time,
            // the state of the map is valid.
            .get_map(ExampleAgent::MAP)
            .and_then(move |map: HashMap<i32, String>| {
                context
                    // Clear the map
                    .clear(ExampleAgent::MAP)
                    // Return the values that existed in the map
                    .followed_by(context.value(map.into_values().collect()))
            })
    }

    #[on_cue_key(demand_map)]
    pub fn on_cue_key(
        &self,
        context: HandlerContext<ExampleAgent>,
        key: i32,
    ) -> impl HandlerAction<ExampleAgent, Completion = Option<String>> + '_ {
        // Every call to this event handler is now pointing to an entry that
        // no longer exists in the map.
        context.get_entry(ExampleAgent::MAP, key)
    }

    #[on_update(map)]
    pub fn on_update(
        &self,
        context: HandlerContext<ExampleAgent>,
        map: &HashMap<i32, String>,
        _key: i32,
        _prev: Option<String>,
        _new_value: &str,
    ) -> impl EventHandler<ExampleAgent> {
        let len = map.len();
        // Ensure that the map has some entries.
        if len > 10 {
            // Collect all of the keys that we want to cue into the demand map lane.
            // At this point in time, these are valid keys and their entries exist
            // in the map.
            let cue_handlers = map
                .keys()
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .map(move |key| context.cue_key(ExampleAgent::DEMAND_MAP, key));

            context
                // Cue the demand lane. Calling this will invoke `on_cue` above
                // and this will clear the state of the map lane.
                .cue(ExampleAgent::DEMAND)
                // Now this event handler will have no effect.
                // At this point in time, `len` is also incorrect as the map
                // has been cleared.
                .followed_by(Sequentially::new(cue_handlers))
                .boxed()
        } else {
            ConstHandler::default().boxed()
        }
    }
}
```

The order of the `on_update` event handler above is incorrect. It executes as follows:

- Build a vector of keys in the map to cue into the `DemandMapLane`.
- Cue the `DemandLane`. This causes its registered lifecycle event handler to be invoked which clones the state of the map and then clears the state of the map lane.
- Cue each of the keys into the `DemandMapLane` from the initial vector. This causes the `DemandMapLane`'s registered lifecycle event handler to be invoked which fetches the corresponding value to be retreived from the map lane, which is empty.

It's possible to build the desired functionality but it requires swapping the order that the event handlers are executed. The keys must be cued _before_ the Demand Lane `cue` call is made.

Situations such as this can arise if care is not taken when designing event handlers. In the aforementioned example, the logic is scoped to the agent itself but similar situations can arise when state is mutated outside of the current agent.

## On Update

The `on_update` event handler has the following signature for a map lane type of `MapLane<i32, i32>`:

```rust
#[on_event(lane_name)]
fn handler(
    &self,
    context: HandlerContext<ExampleAgent>,
    map: &HashMap<i32, i32>,
    key: i32,
    prev: Option<i32>,
    new_value: &i32,
) -> impl EventHandler<ExampleAgent> {
    //...
}
```

The handler is provided with a reference to the current state of the map, the key that was updated, the previous value associated with the key (if one existed) and a reference to the updated value.

Only one may be registered for the lane and it is invoked exactly once after an entry has been updated.

## On Remove

The `on_remove` event handler has the following signature for a map lane type of `MapLane<i32, i32>`:

```rust
#[on_remove(lane_name)]
fn on_remove(
    &self,
    context: HandlerContext<ExampleAgent>,
    map: &HashMap<i32, i32>,
    key: i32,
    prev: i32,
) -> impl EventHandler<ExampleAgent> {
    //...
}
```

The handler is provided with a reference to the current state of the map, the key that was updated and the value that was removed.

Only one may be registered for the lane and it is invoked exactly once after an entry has been removed.

## On Clear

The `on_clear` event handler has the following signature for a map lane type of `MapLane<i32, i32>`:

```rust
#[on_clear(lane_name)]
fn on_clear(
    &self,
    context: HandlerContext<ExampleAgent>,
    prev: HashMap<i32, i32>,
) -> impl EventHandler<ExampleAgent> {
    //...
}
```

The handler is provided with the state of the map.

Only one may be registered for the lane and it is invoked exactly once after the map has been cleared.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provides a number of handlers which are for retreiving values and updating the state of the map:

- [HandlerContext#get_entry](https://docs.rs/swimos/{{ site.data.rust.swimos-version }}/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html#method.get_entry): creates an event handler that will retreive the value of an associated key, if one exists.
- [HandlerContext#get_map](https://docs.rs/swimos/{{ site.data.rust.swimos-version }}/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html#method.get_map): creates an event handler that will clone the state of a map lane.
- [HandlerContext#update](https://docs.rs/swimos/{{ site.data.rust.swimos-version }}/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html#method.update): creates an event handler that will update an entry associated with a key in a map lane.
- [HandlerContext#with_entry](https://docs.rs/swimos/{{ site.data.rust.swimos-version }}/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html#method.with_entry): creates an event handler that will mutate a value associated with a key in a map lane.
- [HandlerContext#remove](https://docs.rs/swimos/{{ site.data.rust.swimos-version }}/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html#method.remove): creates an event handler that will remove an entry from a map lane.
- [HandlerContext#clear](https://docs.rs/swimos/{{ site.data.rust.swimos-version }}/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html#method.clear): creates an event handler that will clear a map lane.
- [HandlerContext#replace_map](https://docs.rs/swimos/{{ site.data.rust.swimos-version }}/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html#method.replace_map): creates an event handler that will replace the contents of a map lane.

# Subscription

A subscription to a map lane can only be achieved via a [Map Downlink]({% link _rust-server/map-downlinks.md %}). An example client for the first agent example:

```rust
use std::time::Duration;

use swimos_client::{BasicMapDownlinkLifecycle, DownlinkConfig, RemotePath, SwimClientBuilder};

#[tokio::main]
async fn main() {
    let (client, task) = SwimClientBuilder::default().build().await;
    let _client_task = tokio::spawn(task);
    let handle = client.handle();

    let path = RemotePath::new("ws://0.0.0.0:50170", "/example/1", "lane");
    let lifecycle = BasicMapDownlinkLifecycle::<i32, String>::default()
        .on_update_blocking(|key, _map, _previous, new| {
            println!("Entry updated: {key:?} -> {new:?}")
        })
        .on_removed_blocking(|key, _map, value| println!("Entry updated: {key:?} -> {value:?}"))
        .on_clear_blocking(|map| println!("Map cleared: {map:?}"));

    let downlink = handle
        .map_downlink::<i32, String>(path)
        .lifecycle(lifecycle)
        .downlink_config(DownlinkConfig::default())
        .open()
        .await
        .expect("Failed to open downlink");

    for i in 0..10 {
        downlink.update(i, i.to_string()).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    for i in 0..10 {
        downlink.remove(i).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    downlink.clear().await.unwrap();

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl-c.");
}
```

Further reading: [Map Downlinks]({% link _rust-server/map-downlinks.md %})

# Try It Yourself

A standalone project that demonstrates map lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/map_lane).
