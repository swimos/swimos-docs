---
title: Agent Lifecycles
short-title: Agent Lifecycles
description: "Agent Lifecycles."
group: Getting Started
layout: documentation
redirect_from:
  - /rust/developer-guide/agent-lifecycles
  - /rust/developer-guide/agent-lifecycles.html
---

Agent lifecycles provide the ability to build powerful, stateful, streaming data applications and they are where you will spend most of your time when writing SwimOS server applications. Inside an agent lifecycle implementation, a number of event handlers may be registered which are invoked at various stages within the lifecycle. There are two types of event handlers: agent handlers, and lane handlers.

Each lifecycle event handler accepts a `HandlerContext` (which aids in the creation of `EventHandlers`) and returns an `EventHandler` which is scoped to the agent that the lifecycle is bound to; this allows the handler to interact with the lanes within the agent. An `EventHandler` models an action that happens within an agent after an event is triggered; such as an agent starting or an event was received. Most handlers do not return a value but they may trigger an event to happen elsewhere within an agent, such as updating the state of a lane or running an async task; these handlers are created using the provided `HandlerContext`.

Event handlers are modelled as state machines and their execution closely resembles an implementation of the `Future` trait. A lane event handler may trigger the state of another lane to change and as a result, its event handler will also be executed. These events happen sequentially and the first handler will not complete until its handler's dependency chain has been executed. This ensures that event obserability is maintained and the first handler will correctly view the state of the lanes that it has mutated.

# Agent Handlers

Agent lifecycle event handlers are defined with the agent's lifecycle implementation and two handlers may be declared:

- The `on_start` handler: invoked exactly once when the agent has started. This handler may be useful if you need an agent to start polling an API once the agent has started.
- The `on_stop` handler: invoked exactly once just before the agent stops. This handler may be useful to clear up some resources before an agent stops.

There is no requirement for any agent lifecycle event handlers to be registered. Handlers are added to the implementation of the agent's lifecycle. For example, to attach `on_start` and `on_stop` handlers:

```rust
use swimos::agent::{lifecycle, agent_lifecycle::utility::HandlerContext, event_handler::EventHandler};

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> {
        context.effect(|| println!("Starting agent."))
    }

    #[on_stop]
    pub fn on_stop(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> {
        context.effect(|| println!("Stopping agent."))
    }
}
```

# Lane Handlers

Lane event handlers which are invoked when a lane receives an event. For example, for a `ValueLane` you may register a handler that is invoked after the state of the lane has changed. These handlers allow your agent to _react_ to the events that it receives and to trigger updates elsewhere.

There is no requirement for any handlers to be registered and you could just have a stateful representation of your streaming data. However, handlers provide the functionality to be notified of certain events that happen during the lifecycle of an agent.

To register an event handler for `ExampleAgent`'s value lane, the function would be:

```rust
#[on_event(lane)]
pub fn on_event(
    &self,
    context: HandlerContext<ExampleAgent>,
    value: &i32,
) -> impl EventHandler<ExampleAgent> {
    // Build and return an EventHandler.
    //
    // It is in these implementations where your application logic will reside.
}
```

Going over the implementation:

- `#[on_event(lane)]`: `on_event` is an event handler specific to value lanes and its argument is the name of the field in the `ExampleAgent` struct.
- `context`: handler context scoped to the agent.
- `value`: reference to the new state of the lane.
- `-> impl EventHandler<ExampleAgent>`: the side effect that you want this event to have. Here you could set the state of another lane or update a database.

Replace the lifecycle implementation with the following:

```rust
#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    // Handler invoked when the agent starts.
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> {
        context.effect(|| println!("Starting agent."))
    }

    // Handler invoked when the agent is about to stop.
    #[on_stop]
    pub fn on_stop(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> {
        context.effect(|| println!("Stopping agent."))
    }

    // Handler invoked after the state of 'lane' has changed.
    #[on_event(state)]
    pub fn on_event(
        &self,
        context: HandlerContext<ExampleAgent>,
        value: &i32,
    ) -> impl EventHandler<ExampleAgent> {
        let n = *value;
        // EventHandler::effect accepts a FnOnce()
        // which runs a side effect.
        context.effect(move || {
            println!("Setting value to: {}", n);
        })
    }
}
```

# Running the applications

Now that both the client and server applications have been built they can be run and both will produce outputs.

The client application will produce:

```
Downlink event: 0
Downlink event: 1
Downlink event: 2
Downlink event: 3
Downlink event: 4
Downlink event: 5
Downlink event: 6
Downlink event: 7
Downlink event: 8
Downlink event: 9
```

And the server will produce:

```
Starting agent.
Setting value to: 0
Setting value to: 1
Setting value to: 2
Setting value to: 3
Setting value to: 4
Setting value to: 5
Setting value to: 6
Setting value to: 7
Setting value to: 8
Setting value to: 9
```

After the agent timeout period has elapsed you will observe a message that the agent is stopping too:

```
Stopping agent.
```

# Expanding

The server will continue listening for events indefinately, starting and stopping the agents as required. Feel free to play around with what has been put together to get familar with what has been covered. You could:

- Add more `ValueLane`s that contain different types and push events using the client application.
- Read through the [`HandlerContext`](https://docs.rs/swimos/latest/swimos/agent/agent_lifecycle/utility/struct.HandlerContext.html) and [`EventHandler`](https://docs.rs/swimos/latest/swimos/agent/agent_lifecycle/event_handler/trait.EventHandler.html) reference documentation and expand the event handlers.
- Push events externally (perhaps to a database) using the existing event handler for the lane.

The next section in this developer guide will cover using custom types.
