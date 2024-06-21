---
title: Map Stores
short-title: Map Stores
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
redirect_from:
  - /tutorials/value-stores/
  - /reference/value-stores.html
  - /backend/value-stores/
---

# Overview

A Map Store provides an agent with a store for map state that is not publically addressable. If you require addressable value state, then a [Value Lane]({% link _rust-server/value-lanes.md %}) will be suitable.

A Map Store has the following properties:

- The state of the store can be updated by calling `update`, removed using `remove`, retreived using the `get_entry` and cleared using the `clear` functions on the [Handler Context]({% link _rust-server/handler-context.md %}).
- The state of the store is only accessible from within the agent that it is defined.
- If persistence is enabled, the state of the store will be retreived from the persistence engine when the agent first starts.

For instances where a value structure is required, a [Value Store]({% link _rust-server/value-stores.md %}) is available.

Example: using a Map Store to store the highest value associated with a key using a Map Lane:

```rust
use std::collections::HashMap;
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::MapLane,
    lifecycle, projections,
    stores::MapStore,
    AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: MapLane<String, i32>,
    store: MapStore<String, i32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_update(lane)]
    pub fn on_update(
        &self,
        context: HandlerContext<ExampleAgent>,
        _map: &HashMap<String, i32>,
        key: String,
        _prev: Option<i32>,
        new_value: &i32,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let new_value = *new_value;

        context
            .get_entry(ExampleAgent::STORE, key.clone())
            .and_then(move |opt: Option<i32>| {
                let state = opt.unwrap_or_default();
                context.update(ExampleAgent::STORE, key, i32::max(state, new_value))
            })
    }
}

```

# Bounds and Initialisation

Map Stores place similar bounds to the standard library's `HashMap` but with the addition of requiring both the key and value types to implement the `swimos_form::Form` and `Send` traits. When the store is first intiialised, the store is initialised to an empty map. If the state of the store is to be populated using the `on_start` handler, then care must be taken to not overwrite any previously held state, as it is not currently possible to detect restarts; a workaround is to add a `ValueStore<bool>` which is set high after the store has been initialised and then it is checked during the `on_start` call to avoid a duplicate initialisation.

# Use cases

Map Stores are useful in situtations where you need to persist data that is derived from lane events received but you do not wish for it to be available outside of the scope of the agent. While it is possible to keep state in the agent's lifecycle, this is lost when the agent is stopped and must be rebuilt each time the agent is started. Using a Map Store, the state is retreived from the underlying persistence engine when the agent first starts. Stores have the added benefit of their usability with the `HandlerContext` and do not require the use of interior mutability and are usable within futures.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provides access to two functions which are used to retreive or update the state of the store.

## Update

Updates an entry in the map, replacing the value if it already existed. This does not return the previous value associated with the entry and if this is required, then a preceding call to retreive the value must be made; this is because it would require an additional operation to be made against the underlying persistence engine that would not be requried if the value is discarded. Defined as:

```rust
pub fn update<Item, K, V>(
    &self,
    lane: fn(&Agent) -> &Item,
    key: K,
    value: V,
) -> impl HandlerAction<Agent, Completion = ()> + Send + 'static
where
    Item: MutableMapLikeItem<K, V>,
    K: Send + Clone + Eq + Hash + 'static,
    V: Send + 'static,
{
    //...
}
```

Example:

```rust
#[on_start]
pub fn on_start(
    &self,
    context: HandlerContext<ExampleAgent>,
) -> impl EventHandler<ExampleAgent> {
    context.update(ExampleAgent::STORE, "a".to_string(), 1)
}
```

## With Entry

Updates an entry in the store. Accepts a closure that is used to update the value associatedf with the key:

```rust
pub fn with_entry<'a, Item, K, V, F>(
    &self,
    lane: fn(&Agent) -> &Item,
    key: K,
    f: F,
) -> impl HandlerAction<Agent, Completion = ()> + Send + 'a
where
    Agent: 'static,
    Item: TransformableMapLikeItem<K, V> + 'static,
    K: Send + Clone + Eq + Hash + 'static,
    V: Clone + 'static,
    F: FnOnce(Option<V>) -> Option<V> + Send + 'a,
{
    //..
}
```

Example:

```rust
#[on_start]
pub fn on_start(
    &self,
    context: HandlerContext<ExampleAgent>,
) -> impl EventHandler<ExampleAgent> {
    context.with_entry(
        ExampleAgent::STORE,
        "a".to_string(),
        |entry: Option<i32>| entry.map(|current| current * 2),
    )
}
```

## Remove

Removes an entry in the map. This does not return the previous value associated with the entry and if this is required, then a preceding call to retreive the value must be made; this is because it would require an additional operation to be made against the underlying persistence engine that would not be requried if the value is discarded. Defined as:

```rust
pub fn remove<Item, K, V>(
    &self,
    lane: fn(&Agent) -> &Item,
    key: K,
) -> impl HandlerAction<Agent, Completion = ()> + Send + 'static
where
    Item: MutableMapLikeItem<K, V>,
    K: Send + Clone + Eq + Hash + 'static,
    V: Send + 'static,
{
    //..
}
```

Example:

```rust
#[on_start]
pub fn on_start(
    &self,
    context: HandlerContext<ExampleAgent>,
) -> impl EventHandler<ExampleAgent> {
    context.remove(ExampleAgent::STORE, "a".to_string())
}
```

## Clear

Clears the store. This does not return the current state of the store and if this is required, then a preceding call to retreive the current state must be made; this is because it would require an additional operation to be made against the underlying persistence engine that would not be requried if the map is discarded. Defined as:

```rust
pub fn clear<Item, K, V>(
    &self,
    lane: fn(&Agent) -> &Item,
) -> impl HandlerAction<Agent, Completion = ()> + Send + 'static
where
    Item: MutableMapLikeItem<K, V>,
    K: Send + Clone + Eq + Hash + 'static,
    V: Send + 'static,
{
    //..
}
```

Example:

```rust
#[on_start]
pub fn on_start(
    &self,
    context: HandlerContext<ExampleAgent>,
) -> impl EventHandler<ExampleAgent> {
    context.clear(ExampleAgent::STORE)
}
```

## Replace Map

Replaces the contents of the store with the provided iterator's elements. Defined as:

```rust
pub fn replace_map<Item, K, V, I>(
    &self,
    lane: fn(&Agent) -> &Item,
    entries: I,
) -> impl HandlerAction<Agent, Completion = ()> + Send + 'static
where
    Item: MutableMapLikeItem<K, V> + 'static,
    K: Send + Clone + Eq + Hash + 'static,
    V: Send + 'static,
    I: IntoIterator<Item = (K, V)>,
    I::IntoIter: Send + 'static,
{
    //..
}
```

Example:

```rust
#[on_start]
pub fn on_start(
    &self,
    context: HandlerContext<ExampleAgent>,
) -> impl EventHandler<ExampleAgent> {
    context.replace_map(ExampleAgent::STORE, HashMap::from([("a".to_string(), 13)]))
}
```

## Get Entry

Gets an entry from the store. Defined as:

```rust
pub fn get_entry<Item, K, V>(
    &self,
    lane: fn(&Agent) -> &Item,
    key: K,
) -> impl HandlerAction<Agent, Completion = Option<V>> + Send + 'static
where
    Item: MapLikeItem<K, V>,
    K: Send + Clone + Eq + Hash + 'static,
    V: Send + Clone + 'static,
{
    //..
}
```

Example:

```rust
#[on_start]
pub fn on_start(
    &self,
    context: HandlerContext<ExampleAgent>,
) -> impl EventHandler<ExampleAgent> {
    context
        .get_entry(ExampleAgent::STORE, "a".to_string())
        .discard()
}
```

## Get Map

Retreives the entire contents of the store. Defined as:

```rust
pub fn get_map<Item, K, V>(
    &self,
    lane: fn(&Agent) -> &Item,
) -> impl HandlerAction<Agent, Completion = HashMap<K, V>> + Send + 'static
where
    Item: MapLikeItem<K, V>,
    K: Send + Clone + Eq + Hash + 'static,
    V: Send + Clone + 'static,
{
    //..
}
```

Example:

```rust
 #[on_start]
pub fn on_start(
    &self,
    context: HandlerContext<ExampleAgent>,
) -> impl EventHandler<ExampleAgent> {
    context.get_map(ExampleAgent::STORE).discard()
}
```

# Choosing The Right Store

Two stores are available for agents, a Map Store and a [Value Store]({% link _rust-server/value-stores.md %}) and it's important to consider how you will be interacting with the type that is stored. Like [Map Lanes]({% link _rust-server/map-lanes.md %}), changes are scoped to the entries and so only these changes are propagated to the underlying persistence engine. If only a small amount of data is contained in the store, it may be more efficient to use a [Value Store]({% link _rust-server/value-stores.md %}) as map stores require some additional bookkeeping.

An example demonstrating using a [Value Store]({% link _rust-server/value-stores.md %}) instead of a Map Store for map-like data:

```rust
use std::collections::HashMap;
use swimos::{
    agent::lanes::MapLane,
    agent::stores::MapStore,
    agent::{
        agent_lifecycle::utility::HandlerContext,
        event_handler::{EventHandler, HandlerActionExt},
        lifecycle, projections,
        stores::MapStore,
        AgentLaneModel,
    },
};
use swimos_form::Form;

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    state: MapLane<String, i32>,
    map_store: MapStore<String, i32>,
    value_store: MapStore<Record>,
}

#[derive(Default, Form, Clone)]
struct Record {
    a: i32,
    b: i32,
    c: i32,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_update(state)]
    pub fn on_update(
        &self,
        context: HandlerContext<ExampleAgent>,
        _map: &HashMap<String, i32>,
        key: String,
        _prev: Option<i32>,
        new_value: &i32,
    ) -> impl EventHandler<ExampleAgent> + '_ {
        let new_value = *new_value;
        context
            .get_value(ExampleAgent::VALUE_STORE)
            .and_then(move |mut current: Record| {
                match key.as_str() {
                    "a" => current.a = new_value,
                    "b" => current.b = new_value,
                    "c" => current.c = new_value,
                    key => panic!("unknown key: {key}"),
                }

                // While we have only updated a single field in Record
                // the entire type will be flushed to the underlying
                // persistence engine.
                context
                    .set_value(ExampleAgent::VALUE_STORE, current)
                    .map(|_| key)
            })
            .and_then(move |key| {
                // Here we only update the corresponding key in the map
                // store and only that portion of the map will be
                // flushed to the underlying persistence engine.
                context.update(ExampleAgent::MAP_STORE, key, new_value)
            })
    }
}
```

# Further reading

It is recommended to understand server [persistence]({% link _rust-server/persistence.md %}) to understand how stores are loaded and how state changes are persisted.

# Try It Yourself

A standalone project that demonstrates Map Stores is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/map_store).
