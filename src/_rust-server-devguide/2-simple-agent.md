---
title: Simple Agent
short-title: Simple Agent
description: "Instantiate some SwimOS Web Agents."
group: Getting Started
layout: documentation
redirect_from:
  - /rust/developer-guide/simple-agent
  - /rust/developer-guide/simple-agent.html
---

This section of the guide will walk through creating a simple SwimOS server application that stores the state of a single 32 bit signed integer in an agent.

# Agents

A Swim application contains a number of stateful Web Agents which live amonst your streaming data. These Web Agents contain both private and public state which may either be held in memory or in persistent storage. The public state of a Web Agent consisents of a number of lanes, which are analoagous to fields in a record, and are addressed by a URI; URIs may be static (such as `/example/1`) or dynamic (such as `/example/:id`). Using these URIs, peers may register their interest in lanes and consume events from them as well as update the state of the lane. Web Agents continuously consume updates of synced state from peers and for each update, it computes new state that automatically gets synced to listeners.

Web Agents are declared by defining a struct and adding lanes which represent the state. For this guide, an i32 is stored in a lane which holds scalar types, a `ValueLane`. Replace the contents of `tutorial_server/src/main.rs` with the following:

```rust
use swimos::agent::{lifecycle, projections, lanes::ValueLane, AgentLaneModel};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    state: ValueLane<i32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {

}
```

Lets go over the block of code above.

```rust
#[derive(AgentLaneModel)]
```

The `#[derive(AgentLaneModel)]` macro derives a descriptor of the agent so the agent's runtime is aware of its lane URIs, whether they are transient, how to route messages to each lane and the agent's constructor; a Web Agent may only contain SwimOS core types such as the `ValueLane` above.

```rust
state: ValueLane<i32>
```

This declares a single Value Lane which stores the state of an `i32` instance where the initial state of the lane will be `i32::default()`. The URI of the lane defaults to the name of the field in the struct but it is possible to override this by applying a field-level attribute of `#[lane(name = "new_name")]`; all URIs must be unique within the agent. Declaring the agent URI is covered later in this guide.

```rust
#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {

}
```

Every agent has a lifecycle associated with it and here one is declared and `ExampleLifecycle`'s implementation is bound to the `ExampleAgent`; lifecycles are decoupled from the agent implementation and are bound using `#[lifecycle(ExampleAgent)]`. While an empty lifecycle has been declared, it is possible to add functions which will be invoked throughout the lifecycle of the agent, such as when the agent starts, a lane receives an update, as well as many other events; one is added later in this guide.

# Server

Now that the `ExampleAgent` has been declared, a SwimOS Server needs to be built and the agent must be registered along with its URI. Two agent URI formats are available:

- Static: such as `"/example"`. If a static path is used, only one agent will ever exist at that address.
- Dynamic: such as `"/example/:id"`. For each unique address, a new agent will be instantiated.

For this guide, a dynamic route of `"/example/:id"` will be used.

Append the following to `tutorial_server/src/main.rs`:

```rust
use std::error::Error;
use swimos::{
    agent::agent_model::AgentModel,
    route::RoutePattern,
    server::{ServerBuilder, Server},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    let route = RoutePattern::parse_str("/example/:id")?;
    // Create an agent model which contains the factory for creating the agent as well
    // as the lifecycle which will be run.
    let agent = AgentModel::new(ExampleAgent::default, ExampleLifecycle.into_lifecycle());

    let server = ServerBuilder::with_plane_name("Plane")
        .set_bind_addr("127.0.0.1:8080".parse().unwrap())
        // Bind the agent to the route.
        .add_route(route, agent)
        .build()
        .await?;

    let (task, _handle) = server.run();
    task.await?;

    println!("Server stopped successfully.");
    Ok(())
}
```

You can now run the SwimOS server application:

```shell
$ cd tutorial_server
$ cargo run
```

At this point, nothing will be seen in the console output as the server is listening for events and none are being produced. The following section in this guide will walk through using the SwimOS client library to build an application which will interact with the agent.
