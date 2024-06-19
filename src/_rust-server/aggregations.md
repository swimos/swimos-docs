---
title: Group and Aggregate Agents
short-title: Agent Groups
description: "How to group agents and calculate aggregate stats"
cookbook: https://github.com/swimos/cookbook/tree/master/aggregations
group: Common Patterns
layout: documentation
redirect_from:
  - /guides/aggregations.html
  - /backend/aggregations/
---

# Overview

It is common to group a family of agents together in order to perform some data aggregation and this is possible using SwimOS's [Join Value]({% link _rust-server/join-value-lanes.md %}) and [Join Map]({% link _rust-server/join-map-lanes.md %}) lanes. Using these lanes it is possible to combine a set of homogenous data into a single lane and for every update the lane receives, execute some data aggregation logic. This guide will walk through aggregating agents and calculating statistics at different levels.

This functionality may be required in situations such as:

- Grouping vehicles by city; group all of the vehicles that are currently inside of a city into another agent that performs some aggregation and exposes the current number of vehicles that are in a city.
- Grouping the current state of an intersection; an intersection may be modelled by having a number of agents that represent traffic lights, then another agent that models the intersection which aggregates the state of the traffic lights contained within it. This pattern could then be repeated a number of times upwards; perhaps for a block and then the city, detailing the average wait time at each level.
- Grouping the players currently playing a game on a server; consider a match for a game where the current players are grouped together for a match so that some monitoring can take place for the session.

This guide will cover tracking cars throughout a city and focus on the implementation details of the agent design and the lifecycle event handlers and not the setup of generating the data; the complete code is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/aggregations).

# Specifications

We'll be building a Swim server application that details a number of data points:

- The current location of a car in a city and its current speed, defined in `CarAgent`. When this agent starts, it will connect to its corresponding `AreaAgent` and send current speed updates to it. When its current area changes, it will deregister from the `AreaAgent` and connect to a new one.
- `AreaAgent` which details the number of cars that are in a given area and the average speed of them. When this agent receives a new speed update from a car it will calculate the new average speed for the area.
- `CityAgent` which will aggregate the average speed across all of the areas and detail the total number of cars across the city.

All of the data across the city will be generated and we will just simulate some data across a range as it is a byproduct of what we are demonstrating here, aggregations.

# Implementation

Each car is assigned to a random area when the `CarAgent` first starts using the [rand](https://crates.io/crates/rand) crate. This is modelled as follows:

```rust
use std::str::FromStr;
use rand::prelude::SliceRandom;

#[derive(Debug, Copy, Clone, Eq, PartialEq, Form)]
pub enum Area {
    Arbury,
    CherryHinton,
    KingsHedges,
    Petersfield,
}

impl Area {
    pub fn universe() -> [Area; 4] {
        [
            Area::Arbury,
            Area::CherryHinton,
            Area::KingsHedges,
            Area::Petersfield,
        ]
    }
}

impl Default for Area {
    fn default() -> Self {
        Area::select_random()
    }
}

impl FromStr for Area {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "arbury" => Ok(Area::Arbury),
            "cherryhinton" => Ok(Area::CherryHinton),
            "kingshedges" => Ok(Area::KingsHedges),
            "petersfield" => Ok(Area::Petersfield),
            _ => Err(()),
        }
    }
}

impl Display for Area {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Area::Arbury => write!(f, "arbury"),
            Area::CherryHinton => write!(f, "cherryhinton"),
            Area::KingsHedges => write!(f, "kingshedges"),
            Area::Petersfield => write!(f, "petersfield"),
        }
    }
}

impl Area {
    pub fn select_random() -> Self {
        [
            Area::Arbury,
            Area::CherryHinton,
            Area::KingsHedges,
            Area::Petersfield,
        ]
        .choose(&mut rand::thread_rng())
        .copied()
        .expect("Slice was not empty")
    }
}
```

The following sections will walk through defining the agents from the bottom and working their way up to the top-level aggregation for the whole city.

## Car Agent

The `CarAgent` will track a vehicles current speed using a Value Lane and register with its assigned area to provide it with updates so that the `AreaAgent` can aggregate the average speed for the area. The `CarAgent` uses a single Value Lane to store the car's current speed and a Value Store for storing the car's assigned area. The `CarAgent` is defined as follows:

```rust
use std::sync::{Arc, Mutex};
use swimos::agent::{AgentLaneModel, projections};
use swimos::agent::lanes::ValueLane;
use swimos::agent::stores::ValueStore;
use crate::area::Area;

#[derive(AgentLaneModel)]
#[projections]
pub struct CarAgent {
    speed: ValueLane<u64>,
    #[item(transient)]
    area: ValueStore<Area>,
}

#[derive(Debug, Clone)]
pub struct CarLifecycle;
```

Using the `AgentContext`, a sequence of handlers may be executed with a fixed delay between them using the `schedule_repeatedly` function; henceforth referred to as 'tasks'. Once the agent has started, two tasks will be scheduled using `schedule_repeatedly` to manage its state:

- A task to periodically update the car's current speed.
- A task to periodically change the car's area. Managing the registration of the area that it is assigned to.

Both of these tasks can be scheduled in the agent's `on_start` lifecycle event handler and no other handlers will be required for the agent.

### Speed Handler

The current speed handler will simply generate the random speed within a range and update the corresponding Value Lane with the generated value:

```rust
use rand::Rng;
use std::time::Duration;

let speed_handler = context.schedule_repeatedly(Duration::from_secs(5), move || {
    let mut rng = rand::rngs::OsRng;
    Some(context.set_value(CarAgent::SPEED, rng.gen_range(10..=70)))
});
```

### Area Handler

The area handler works in a similar way and randomly generates a new area for the agent and if it is not equal to the current one it will update the registrations; the command type is an `Action` that is covered later in this guide.

```rust
let area_handler = move |car_id: u64| {
    context.schedule_repeatedly(Duration::from_secs(5), move || {
        Some(context.get_value(CarAgent::AREA).and_then(move |old_area| {
            let new_area = Area::select_random();
            let handler = if old_area != new_area {
                // deregister this car with its current area
                let deregister_handler = context.send_command(
                    None,
                    format!("/area/{old_area}"),
                    "registrations".to_string(),
                    Action::Deregister(car_id),
                );
                // register this car with its new assigned area
                let register_handler = context.send_command(
                    None,
                    format!("/area/{new_area}"),
                    "registrations".to_string(),
                    Action::Register(car_id),
                );

                let handler = deregister_handler
                    .followed_by(register_handler)
                    .followed_by(context.set_value(CarAgent::AREA, new_area));
                Some(handler)
            } else {
                // noop handler as the car didn't switch area
                None
            };

            handler.discard()
        }))
    })
};
```

### Complete Lifecycle

Putting it all together we get the following lifecycle for the `CarAgent`:

```rust
use std::mem::replace;
use std::str::FromStr;
use std::time::Duration;
use rand::Rng;
use swimos::{
    agent::agent_lifecycle::utility::HandlerContext,
    agent::event_handler::{EventHandler, HandlerActionExt},
    agent::lifecycle
};
use crate::{
    area::Area,
    car::{CarAgent, CarLifecycle}
};

#[lifecycle(CarAgent)]
impl CarLifecycle {
    #[on_start]
    pub fn on_start(&self, context: HandlerContext<CarAgent>) -> impl EventHandler<CarAgent> {
        let speed_handler = context.schedule_repeatedly(Duration::from_secs(5), move || {
            let mut rng = rand::rngs::OsRng;
            Some(context.set_value(CarAgent::SPEED, rng.gen_range(10..=70)))
        });
        let area_handler = move |car_id: u64| {
            context.schedule_repeatedly(Duration::from_secs(5), move || {
                Some(context.get_value(CarAgent::AREA).and_then(move |old_area| {
                    let new_area = Area::select_random();
                    let handler = if old_area != new_area {
                        // deregister this car with its current area
                        let deregister_handler = context.send_command(
                            None,
                            format!("/area/{old_area}"),
                            "registrations".to_string(),
                            Action::Deregister(car_id),
                        );
                        // register this car with its new assigned area
                        let register_handler = context.send_command(
                            None,
                            format!("/area/{new_area}"),
                            "registrations".to_string(),
                            Action::Register(car_id),
                        );

                        let handler = deregister_handler
                            .followed_by(register_handler)
                            .followed_by(context.set_value(CarAgent::AREA, new_area));
                        Some(handler)
                    } else {
                        // noop handler as the car didn't switch area
                        None
                    };

                    handler.discard()
                }))
            })
        };

        context
            .get_parameter("car_id")
            .map(|param: Option<String>| {
                let car_id = param.expect("Missing car_id URI parameter");
                u64::from_str(car_id.as_str()).expect("Failed to parse car ID into u64")
            })
            .and_then(area_handler)
            .followed_by(speed_handler)
    }
}
```

## Area Agent

The `AreaAgent` will track all of the cars within a given area and calculate the average speed of all of them. Exposing a `ValueLane<f64>` with the average speed and pushing the average speed upwards to the `CityAgent`. This will require four lanes within the agent:

- A [Command Lane]({% link _rust-server/command-lanes.md %}) to handle both registering and deregistering cars from the area. If a registration request is received, the lifecycle event handler will then open a [Value Downlink]({% link _rust-server/value-downlinks.md %}) to the `CarAgent` that send the request. If a deregistration request if received, the lifecycle event handler will then remove the downlnink from the Join Value Lane.
- A [Value Lane]({% link _rust-server/value-lanes.md %}) exposing the average speed of all of the cars in the area.
- A [Join Value Lane]({% link _rust-server/join-value-lanes.md %}) containing the downlinks to all of the cars in the area. Each time the lane receives an update it will calculate a new average speed for all of the cars in the area and set the state of the average speed lane. This will be keyed by the ID of the car that is registered in the area and the value will be its current speed.

```rust
use crate::area::Area;
use swimos::{
    agent::lanes::{CommandLane, JoinValueLane, ValueLane},
    agent::{projections, AgentLaneModel},
};

#[derive(AgentLaneModel)]
#[projections]
pub struct AreaAgent {
    registrations: CommandLane<Action>,
    cars: JoinValueLane<u64, u64>,
    average_speed: ValueLane<f64>,
}

#[derive(Clone, Default)]
pub struct AreaLifecycle {
    area: Area,
}

impl AreaLifecycle {
    pub fn new(area: Area) -> AreaLifecycle {
        AreaLifecycle { area }
    }
}
```

Each `AreaAgent` is assigned its own area to manage when it is first instantiated; see the complete code for how this is handled [here](https://github.com/swimos/swim-rust/blob/main/example_apps/aggregations/src/main.rs).

### On Start

First, the agent's `on_start` lifecycle event handler will be defined to send a command to the `CityAgent` to trigger it to listen to the `cars` lane for updates so it can include this `AreaAgent`'s data in its calculations.

```rust
use std::str::FromStr;
use swimos::{
    agent::agent_lifecycle::utility::HandlerContext,
    agent::event_handler::{EventHandler, HandlerActionExt},
    agent::lifecycle,
};

#[lifecycle(AreaAgent)]
impl AreaLifecycle {
    #[on_start]
    pub fn on_start(&self, context: HandlerContext<AreaAgent>) -> impl EventHandler<AreaAgent> {
        context.send_command(None, "/aggregate", "register", self.area.to_string())
    }
}
```

### Car Registration and Deregistration

A single Command Lane will be used to handle registering and deregistering a car from the current agent. Both the registration and deregistration can be handled using a single Command Lane by combining the events into a single enumeration with two variants that both have a field corresponding to the car's unique identifier; as a custom event type is being defined it implements the [Form]({% link _rust-server/forms.md %}) trait. This unique identifier will be used to either add or remove a downlink from the Join Value Lane:

```rust
use swimos::{
    agent::agent_lifecycle::utility::HandlerContext, agent::event_handler::EventHandler,
    agent::lifecycle,
};
use swimos_form::Form;

#[derive(PartialEq, Copy, Clone, Form)]
pub enum Action {
    Register(u64),
    Deregister(u64),
}

#[lifecycle(AreaAgent)]
impl AreaLifecycle {
    #[on_command(registrations)]
    pub fn registrations(
        &self,
        context: HandlerContext<AreaAgent>,
        action: &Action,
    ) -> impl EventHandler<AreaAgent> {
        match action {
            Action::Register(car_id) => context
                .add_downlink(
                    AreaAgent::CARS,
                    *car_id,
                    None,
                    format!("/cars/{car_id}").as_str(),
                    "speed",
                )
                .boxed(),
            Action::Deregister(car_id) => context.remove_downlink(AreaAgent::CARS, *car_id).boxed(),
        }
    }
}
```

This lifecycle event handler now creates a group of all of the cars that have been assigned to this area and is what enables aggregations to be performed.

### Average Speed

Now that the `AreaAgent` has an event stream of speeds coming from all of the agents, the Join Value Lane's lifecycle event handler can compute the average speed of all of the linked cars each time a downlink receives an update. A Join Value Lane's lifecycle event handler is provided with a reference to the underlying map which contains the current speed of each car and this may be used to compute the average. Once this has been calculated, the `average_speed` lane is updated:

```rust
use std::collections::HashMap;
use swimos::{
    agent::agent_lifecycle::utility::HandlerContext, agent::event_handler::EventHandler,
    agent::event_handler::HandlerActionExt, agent::lifecycle,
};

#[lifecycle(AreaAgent)]
impl AreaLifecycle {
    #[on_update(cars)]
    fn cars(
        &self,
        context: HandlerContext<AreaAgent>,
        speeds: &HashMap<u64, u64>,
        _key: u64,
        _prev: Option<u64>,
        _new_value: &u64,
    ) -> impl EventHandler<AreaAgent> {
        let average = speeds.values().sum::<u64>() as f64 / speeds.len() as f64;
        context.set_value(AreaAgent::AVERAGE_SPEED, average)
    }
}
```

To recap on the event flow that leads to this handler being invoked, a `CarAgent` periodically changes its current area and registers with the corresponding `AreaAgent` to that it listens for events. The `CarAgent` also periodically sets its current speed and as the `AreaAgent` has downlinked to its `speed` lane, the Join Value Lane's `on_update` lifecycle event handler is invoked and a new average speed across the area can be calculated.

## City Agent

The `CityAgent` calculates the average speed across all of the `AreaAgent`. The structure of this agent is similar to the `AreaAgent` except there is no `deregister` lane as registration is not transient. Three lanes are required in the agent:

- A Join Value Lane to aggregate the average speed in the `AreaAgent`s. This will be keyed by the area's name and the value will be the average speed in the area.
- A Value Lane to expose the current average speed.
- A Command Lane to handle registrations by the areas. When an `AreaAgent` first starts, it will send a command to register itself.

The agent `CityAgent` is defined as:

```rust
use swimos::{
    agent::lanes::{CommandLane, JoinValueLane},
    agent::{projections, AgentLaneModel},
};

#[derive(AgentLaneModel)]
#[projections]
pub struct CityAgent {
    aggregated: JoinValueLane<String, f64>,
    register: CommandLane<String>,
}

#[derive(Clone, Default)]
pub struct CityLifecycle;
```

### Aggregation

Similar to how `AreaAgent` downlinks to the `CarAgent`s, the `CityAgent` will downlink to the average speed lane in the `AreaAgent`. This will provide the agent with a continuous stream of events from the `AreaAgent`s so that the agent can calculate the average speed of all the cars in the city.

```rust
use std::collections::HashMap;
use swimos::{
    agent::event_handler::HandlerActionExt,
    agent::{agent_lifecycle::utility::HandlerContext, event_handler::EventHandler, lifecycle},
};

#[lifecycle(CityAgent)]
impl CityLifecycle {
    #[on_update(aggregated)]
    fn aggregated(
        &self,
        context: HandlerContext<CityAgent>,
        averages: &HashMap<String, f64>,
        _key: String,
        _prev: Option<f64>,
        _new_value: &f64,
    ) -> impl EventHandler<CityAgent> {
        let average = averages.values().sum::<f64>() / averages.len() as f64;
        context.set_value(CityAgent::AVERAGE_SPEED, average)
    }
}
```

### Area Registration

When an `AreaAgent` first starts, registers with the `CityAgent` so that the agent opens a downlink to receive updates. This is done using a Command Lane's lifecycle event handler:

```rust
use std::collections::HashMap;
use swimos::{
    agent::event_handler::HandlerActionExt,
    agent::{agent_lifecycle::utility::HandlerContext, event_handler::EventHandler, lifecycle},
};

#[lifecycle(CityAgent)]
impl CityLifecycle {
    #[on_command(register)]
    pub fn register(
        &self,
        context: HandlerContext<CityAgent>,
        area_id: &String,
    ) -> impl EventHandler<CityAgent> {
        context.add_downlink(
            CityAgent::AGGREGATED,
            area_id.clone(),
            None,
            format!("/area/{}", area_id).as_str(),
            "average_speed",
        )
    }
}
```

# Conclusion

The final design of this example application exposes three levels of resolution into the speed of cars within a city: at car, area and city levels. We recommend playing around with the complete code for this guide, available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/aggregations) to understand how this design works and to view the routes available for the agents. There are a number of additions that could be made to this design:

- Exposing the total number of cars within an area.
- Calculating the minimum and maximum speed of a car within an area.
- Adding and removing cars.
