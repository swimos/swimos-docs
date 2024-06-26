---
title: Value Stores
short-title: Value Stores
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
redirect_from:
  - /tutorials/value-stores/
  - /reference/value-stores.html
  - /backend/value-stores/
---

# Overview

A Value Store provides an agent with a store for state that is not publically addressable. If persistence is enabled and the application restarts, the state of the store will be reloaded from the underlying persistence engine. If persistence is not enabled, the state of the store will be reloaded from the in-memory store in between agent restarts but not application restarts. If you require addressable state, then a [Value Lane]({% link _rust-server/value-lanes.md %}) will be suitable.

A Value Store meets the following requirements:

- The state of the store can be updated by calling the `set_value` and retreived using the `get_value` functions on the [Handler Context]({% link _rust-server/handler-context.md %}).
- The state of the store is only accessible from within the agent that it is defined.
- If persistence is enabled, the state of the store will be retreived from the persistence engine when the agent first starts.

For instances where a map structure is required, a [Map Store]({% link _rust-server/map-stores.md %}) is available.

Example: using a Value Store to store the highest value received by a Value Lane:

```rust

use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{EventHandler, HandlerActionExt},
    lanes::ValueLane,
    lifecycle, projections,
    stores::ValueStore,
    AgentLaneModel,
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
    store: ValueStore<i32>,
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
            .get_value(ExampleAgent::STORE)
            .and_then(move |state| {
                let new_state = if n > state { n } else { state };
                context.set_value(ExampleAgent::STORE, new_state)
            })
    }
}
```

# Use cases

Value Stores are useful in situtations where you need to persist data that is derived from lane events received but you do not wish for it to be available outside of the scope of the agent. While it is possible to keep state in the agent's lifecycle, this is lost when the agent is stopped and must be rebuilt each time the agent is started. Using a Value Store, the state is retreived from the underlying persistence engine when the agent first starts.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provides access to two functions which are used to retreive or update the state of the store.

- `HandlerContext::get_value`: retreives the current state of the store.
- `HandlerContext::set_value`: sets the current state of the store to the provided value.

# Further reading

It is recommended to understand server [persistence]({% link _rust-server/persistence.md %}) to understand how stores are loaded and how state changes are persisted.

# Try It Yourself

A standalone project that demonstrates Value Stores is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/value_store).
