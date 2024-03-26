---
title: Web Agents
short-title: Web Agents
description: "Learn about declaring, defining and utilizing Web Agents and their properties using configuration files."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/web_agents
redirect_from:
  - /rust/tutorials/web-agents/
  - /rust/reference/web-agents.html
---

Swim servers utilize a general purpose distributed object model in which the objects are called **Web Agents**.
Programming with this model feels like typical object-oriented programming with additional key innovations in addressability, statefulness, consistency, boundedness, and composability.

Although this analogy holds very well for the most part, there are two important catches:

- Methods, while still being able to define arbitrarily complicated logic, are not directly invoked. Instead, Web agents come with **lifecycle callback** functions that are called during specified stages of a Web Agent's lifetime
- Web Agent **instantiation** is not accomplished by invoking a constructor (at least from the programmer's perspective)

Don't worry if these points feel restrictive through this article; much finer control becomes available once we discuss **lanes**.

### Declaration

Just like with (instantiable) `struct` declarations in Rust, **Agent declarations** in Swim define the behavior for **instances** of those Agents.
Declarations alone don't actually instantiate anything.

To declare a Web Agent, both agent and lifecycle structs must be declared:

```rust
use swim_os::agent::{projections, AgentLaneModel, lifecycle};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    lane: ValueLane<i32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle;
```

`#[derive(AgentLaneModel)]` derives the necessary traits for the agent; its schema and a constructor. To interact with lanes and their state, operations are performed through lifecycle handlers which provide access to a `HandlerContext` which requires a projection to the lane that you wish to perform some action against; this is covered in more detail in the [lanes]({% link _rust_backend/lanes.md %}) page. The `#[projections]` macro generates these projections for you which in the above example generates:

```rust
impl ExampleAgent {
    pub LANE: fn(&ExampleAgent) -> &ValueLane<i32>
}
```

If the lifecycle contains no fields, then the `#[lifecycle(ExampleAgent)]` macro is used to automatically generate the specified agent's lifecycle. Agents must **only** contain lanes and no other state. If this is required, it must be placed within the lifecycle of the agent and its constructor must be manually provided - which is covered later in this guide.

### Addressability

A Web Agent is only instantiated when it's `nodeUri` is invoked for the first time through addressing one of the lanes contained within the agent; though, an incorrectly addressed lane will still cause the agent to be instantiated.

Node addresses come in two flavours:

- Static: such as `"/sensors"`. If a static path is used, only one agent will ever exist at that address.
- Dynamic: such as `"/sensor/:id`. For each unique address, a new agent will be instantiated. It is possible to get the route parameters (in our example, `"id`) that the agent was started with through the `HandlerContext` which is provided to agent lifecycle functions.

When designing your Web Agents, carefully consider how you will be producing and consuming your data. If you were designing a system that contained a large number of sensors, it may make more sense to have sensor be its own Web Agent that is addressed through a dynamic address of `"/sensor/:id"` rather than rolling them all up into a static path. This would allow for a subscriber to receive only the specific state updates that they require rather than subscribing to the state changes of every sensor.

### Agent Lifecycle Callbacks

There are two lifecycle callbacks associated with a Web Agent:

`on_start`: executed once immediately after this Agent has started:

```rust
use swim_os::agent::agent_lifecycle::utility::HandlerContext;

impl ExampleAgent {
    #[on_start]
    pub fn on_start(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> {
        context.get_agent_uri().and_then(move |uri| {
            context.effect(move || {
                println!("Starting agent at: {}", uri);
            })
        })
    }
}
```

`on_stop`: executed once immediately before this Agent will stop:

```rust
use swim_os::agent::agent_lifecycle::utility::HandlerContext;

impl ExampleAgent {
    #[on_start]
    pub fn on_stop(
        &self,
        context: HandlerContext<ExampleAgent>,
    ) -> impl EventHandler<ExampleAgent> {
        context.get_agent_uri().and_then(move |uri| {
            context.effect(move || {
                println!("Stopping at: {}", uri);
            })
        })
    }
}
```

A Web Agent may stop if it has not received a message after a configurable period of time has elapsed; this is configurable through (todo rust doc link). If an agent has stopped and it receives a message, then the agent will restart and the `on_start` method will be invoked.

### Persistence

When enabled, messages propagated by a lane are guaranteed to have been persisted to the configured store. By default, all lanes within a Web Agent will have their state persisted to the store. If this is not desired, it is possible to disable persistence for a lane by applying the `#[lane(transient)]` attribute to a lane or apply disable persistence at the agent level by using `#[agent(transient)]`

For a single lane:

```rust
use swim_os::{agent::lanes::MapLane, AgentLaneModel};

#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    #[lane(transient)]
    temporary: MapLane<String, i32>
}
```

To disable persistence for every lane you could apply the `#[lane(transient)]` attribute to every lane or use:

```rust
use swim_os::{agent::{lanes::MapLane, ValueLane}, AgentLaneModel};

#[derive(AgentLaneModel)]
#[agent(transient)]
pub struct ExampleAgent {
    count: ValueLane<i32>,
    names: MapLane<String, String>
}
```

When an agent first starts, it will attempt to load the state of all the lanes from the configured store. Any lanes marked as `transient` will not have any state reloaded.

For more details on Web Agent persistence see the [persistence]({% link _rust_backend/persistence.md %}) page.
