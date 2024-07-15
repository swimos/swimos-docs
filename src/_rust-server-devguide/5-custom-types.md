---
title: Custom Types
short-title: Custom Types
description: "Using Custom Types With SwimOS Lanes."
group: Getting Started
layout: documentation
redirect_from:
  - /rust/developer-guide/custom-types
  - /rust/developer-guide/custom-types.html
---

This section of the guide will cover exposing functionality to add or subtract from the state of the lane added in the previous section. To do this, a new lane type will be introduced, a `CommandLane`.

# Command Lanes

Command lanes are stateless lanes that provide a single event handler that may be registered, which, when invoked with the request payload (the _command_), returns an effect which may trigger updates to other lanes, update a database or any other functionality required.

The _command_ type can be any type that implements the [Form]({% link _rust-server/forms.md %}) trait and this may include enumerations which enable the lane to react to many different types of commands. Lanes exchange messages using a structured data model called Recon and this places the constraint on a lane's type that it implements the the [Form]({% link _rust-server/forms.md %}) trait. An implementation of the `Form` trait describes the transformation between the lane's type and the Recon data model and is implemented for most of the standard library types that are used with lanes.

# Building the Agent

There are two approachs that could be taken to achieve the requirements of being able to add or subtract from the state of the previously implemented lane:

- Two separate `CommandLane<i32>`s; one addressable at a URI of `"add"` and the other at `"sub"`.
- One command lane `CommandLane<Operation>` that is addressable at `"exec"`. Where `Operation` is an enumeration with two variants: `Add(i32)` and `Sub(i32)`.

The latter option is more sensible as it is simpler and all envelopes to agents are processed sequentially so there is no benefit to splitting this out. An event handler will be registered with the lane that when invoked, matches the `Operation` enumeration and executes an add or subtract operation on the corresponding lane.

Add the following to `tutorial_server/src/main.rs`:

```rust
use swimos_form::Form;

// Note how as this is a custom type we need to derive `Form` for it.
// For most types, simply adding the derive attribute will suffice.
#[derive(Debug, Form, Copy, Clone)]
pub enum Operation {
    Add(i32),
    Sub(i32),
}
```

Replace the agent declaration with the following:

```rust
use swimos_server::agent::{projections, lanes::{CommandLane, ValueLane}};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    state: ValueLane<i32>,
    exec: CommandLane<Operation>,
}
```

An on command handler can now be added in the implementation of `ExampleLifecycle`:

```rust
use swimos::agent::event_handler::HandlerActionExt;

impl ExampleLifecycle {
    ...

    #[on_command(exec)]
    pub fn on_command(
        &self,
        context: HandlerContext<ExampleAgent>,
        // Notice a reference to the deserialized command envelope is provided.
        operation: &Operation,
    ) -> impl EventHandler<ExampleAgent> {
        let operation = *operation;
        context
            // Get the current state of our `state` lane.
            .get_value(ExampleAgent::STATE)
            .and_then(move |state| {
                // Calculate the new state.
                let new_state = match operation {
                    Operation::Add(val) => state + val,
                    Operation::Sub(val) => state - val,
                };
                // Return a event handler which updates the state of the `state` lane.
                context.set_value(ExampleAgent::STATE, new_state)
            })
    }
}
```

Many handlers can be combined using the `swimos_server::agent::event_handler::HandlerActionExt` trait as demonstrated above and these combinators are similar to what you would find when working with iterators or futures. The `on_command` handler above builds up a handler chain that retreives the current state of the `state` lane, calculates the new state of the lane and then sets the state of the `state` lane.

Event handlers which access state must provide a projection from the agent's declaration to the field that contains the state. For convinience, the `#[projections]` macro used on `ExampleAgent`'s declaration derives this. This projection is then used when calling `HandlerContext::set_value` so the event handler knows which field to apply the effect to.

# Client

In order to interact with the new `CommandLane` that has been added, a new value downlink needs to be opened to the `exec` lane. While this downlink will never receive any state updates, it is capable of sending scalar values to the linked lane.

Replace the contents of `src/bin/client.rs` with the following:

```rust
use swimos_client::{BasicValueDownlinkLifecycle, RemotePath, SwimClientBuilder};
use swimos_form::Form;
use std::error::Error;

#[derive(Debug, Form, Copy, Clone)]
pub enum Operation {
    Add(i32),
    Sub(i32),
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let (client, task) = SwimClientBuilder::default().build().await;
    let client_task = tokio::spawn(task);
    let handle = client.handle();

    let state_path = RemotePath::new(
        "ws://0.0.0.0:8080",
        "/example/1",
        "state",
    );

    let lifecycle = BasicValueDownlinkLifecycle::<usize>::default()
        .on_event_blocking(|value| println!("Downlink event: {value:?}"));

    handle
        .value_downlink::<i32>(state_path)
        .lifecycle(lifecycle)
        .open()
        .await?;

    let exec_path = RemotePath::new(
        "ws://0.0.0.0:8080",
        "/example/1",
        "exec",
    );

    let exec_downlink = handle
        .value_downlink::<Operation>(exec_path)
        .open()
        .await?;

    exec_downlink.set(Operation::Add(1000)).await?;
    exec_downlink.set(Operation::Sub(13)).await?;

    client_task.await?;
    Ok(())
}
```

# Running

Run the server and client applications and you will see the following output:

```
Downlink event: 1000
Downlink event: 987
```

# Full code

The full code for this guide is available [here](https://github.com/swimos/swim-rust/tree/v0.1.0/example_apps/devguide).
