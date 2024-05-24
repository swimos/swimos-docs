---
title: Command Lanes
short-title: Command Lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/command_lanes
redirect_from:
  - /tutorials/command-lanes/
  - /reference/command-lanes.html
  - /backend/command-lanes/
---

This page covers the specifics of Command Lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page.

# Overview

Command Lanes are the simplest type of lanes in SwimOS. They are stateless lanes that receive _command_ envelopes and invoke their registered `on_command` lifecycle callback with the received command envelope. While command lanes are stateless, any commands received are broadcast to any linked peers.

Example: using a Command Lane to update the state of another lane:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::{HandlerActionExt, EventHandler},
    lifecycle, projections, AgentLaneModel,
    lanes::{ValueLane, CommandLane}
};

use swimos_form::Form;

#[derive(Copy, Clone, Form)]
enum Operation {
    Add(i32),
    Sub(i32)
}

#[derive(AgentLaneModel)]
#[projections]
struct ExampleAgent {
    command: CommandLane<Operation>,
    state: ValueLane<i32>
}

#[derive(Clone)]
struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    pub fn on_command(&self, context: HandlerContext<ExampleAgent>, operation: &Operation) -> impl EventHandler<ExampleAgent> {
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

# Use cases

Command Lanes can be used to run any user-defined logic within a Web Agent when a `command` has been received. Common usecases are:

- Updating the state of a lane. E.g, when a `command` has been received, its payload is used to add an entry into a [Map Lane]({% link _rust-server/map-lanes.md %}).
- Opening a new downlink. The command may be a target node to listen to and this can be used to open a new downlink and listen for events from a peer.
- Notify an external system that an event has taken place. As Command Lanes execute arbitary handlers, these handlers may trigger events in external systems.

# Event handler

The command lane lifecycle event handler has the following signature for an `i32` command:

```rust
#[on_command(lane_name)]
fn handler(&self, context: HandlerContext<ExampleAgent>, value: &i32) -> impl EventHandler<ExampleAgent> {
    //...
}
```

Only one may be registered for the lane and it is invoked exactly once with a reference to the command after it has been received.

# Handler Context Operations

The `HandlerContext` provided as an argument to lifecycle event handlers provides a `command` function for sending commands to a `CommandLane` local to the agent:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::EventHandler,
    lanes::CommandLane,
    lifecycle, AgentLaneModel, projections
};

#[derive(AgentLaneModel)]
#[projections]
struct ExampleAgent {
    command: CommandLane<i32>,
    add: CommandLane<i32>
}

struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_command(command)]
    fn command_handler(&self, context: HandlerContext<ExampleAgent>, value: &i32) -> impl EventHandler<ExampleAgent> {
        context.command(ExampleAgent::ADD, value)
    }

    #[on_command(add)]
    fn add_handler(&self, context: HandlerContext<ExampleAgent>, value: &i32) -> impl EventHandler<ExampleAgent> {
        unimplemented!()
    }
}
```

A `send_command` function is available for issuing commands to a local or remote agent:

```rust
use swimos::agent::{
    agent_lifecycle::utility::HandlerContext,
    event_handler::EventHandler,
    lanes::CommandLane,
    lifecycle, AgentLaneModel, projections
};

#[derive(AgentLaneModel)]
#[projections]
struct ExampleAgent {
    command: CommandLane<i32>,
}

struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_command(command)]
    fn handler(&self, context: HandlerContext<ExampleAgent>, value: &i32) -> impl EventHandler<ExampleAgent> {
        context.send_command(Some("ws://example.com"), "node", "lane", "command")
    }
}
```

# Subscription

A subscription to a Command Lane can only be achieved via a [Value Downlink]({% link _rust-server/value-downlinks.md %}). Commands are issued using the `set` operation:

```rust
use swimos_client::{BasicValueDownlinkLifecycle, DownlinkConfig, RemotePath, SwimClientBuilder};
use swimos_form::Form;

#[derive(Debug, Form, Copy, Clone)]
pub enum Operation {
    Add(i32),
    Sub(i32),
}

#[tokio::main]
async fn main() {
    let (client, task) = SwimClientBuilder::default().build().await;
    let _client_task = tokio::spawn(task);
    let handle = client.handle();

    let exec_path = RemotePath::new("ws://0.0.0.0:8080", "/example/1", "command");
    let exec_lifecycle = BasicValueDownlinkLifecycle::<Operation>::default()
        // Register an event handler that is invoked when the downlink connects to the agent.
        .on_linked_blocking(|| println!("Downlink linked"))
        // Register an event handler that is invoked when the downlink receives a command.
        .on_event_blocking(|value| println!("Downlink event: {value:?}"));

    let exec_downlink = handle
        .value_downlink::<Operation>(exec_path)
        .downlink_config(DownlinkConfig::default())
        .lifecycle(exec_lifecycle)
        .open()
        .await
        .expect("Failed to open downlink");

    exec_downlink.set(Operation::Add(1000)).await.unwrap();
    exec_downlink.set(Operation::Sub(13)).await.unwrap();

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl-c.");
}
```

Further reading: [Downlinks]({% link _java-server/downlinks.md %})

# Try It Yourself

A standalone project that demonstrates Command Lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/command_lane).
