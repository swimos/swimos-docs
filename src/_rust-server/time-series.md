---
title: Time Series
short-title: Time Series
description: "Time Series Data"
cookbook: https://github.com/swimos/swim-rust/tree/main/example_apps/time_series
group: Common Patterns
layout: documentation
redirect_from:
  - /guides/time-series.html
  - /backend/time-series/
---

A common form of data is time series data that is indexed by the event's timestamp. Time series data is most suited to a [Map Lanes]({% link _rust-server/map-lanes.md %}) where the key is the events timestamp and the value is the data itself. While this data accumulates over time, it is important to implement a form of retention policy to prevent building an unbounded data structure. There are many retention policies that may be implemented to evict entries in the map and this guide will cover two: by count and by time. Both policies will be event driven and only evict entries when an entry has been updated in the map itself.

# Representation

The agent used for this guide will contain a single `MapLane` to store the time series data and a [Command Lane]({% link _rust-server/command-lanes.md %}) which will receive the values to insert into the map and associate them with the current timestamp.

```rust
use std::time::{SystemTime, UNIX_EPOCH};
use swimos::{
    agent::agent_lifecycle::HandlerContext,
    agent::event_handler::EventHandler,
    agent::lanes::{CommandLane, MapLane},
    agent::{lifecycle, projections, AgentLaneModel},
};

#[derive(AgentLaneModel)]
#[projections]
pub struct ExampleAgent {
    history: MapLane<u64, String>,
    add: CommandLane<String>,
}

pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_command(add)]
    pub fn add(
        &self,
        context: HandlerContext<ExampleAgent>,
        cmd: &str,
    ) -> impl EventHandler<ExampleAgent> {
        context.update(ExampleAgent::HISTORY, now(), cmd.to_string())
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
```

If the the current implementation of the agent receives enough commands then the map would reach an unbounded size and cause the application to fail.

# Windowing

Entries into the map lane can be evicted using the `on_update` lifecycle event handler which can prune the map based on the retention policy. The first policy that we will cover is one which will evict the oldest entries when the size of the map has reached a defined limit.

## By Map Length

This retention policy will evict the oldest entries in the map once its length has reached a defined limit and requires a `VecDeque` to track the order that keys have been inserted into the map, therefore tracking the oldest keys in the map. Internally, Map Lanes are backed by the standard library's `HashMap` and therefore the keys are not ordered and an additional data structure is required in order to track the insertion order of entries.

```rust
use std::cell::RefCell;
use std::collections::VecDeque;

pub struct ExampleLifecycle {
    max: usize,
    keys: RefCell<VecDeque<u64>>,
}

impl ExampleLifecycle {
    pub fn new(policy: RetentionPolicy) -> ExampleLifecycle {
        ExampleLifecycle {
            max,
            keys: Default::default(),
        }
    }
}
```

The map lane's `on_update` lifecycle event handler may be used to trigger the eviction process to take place after an entry has been updated:

```rust
use std::collections::HashMap;
use swimos::agent::event_handler::Sequentially;
use swimos::{
    agent::{
        agent_lifecycle::HandlerContext,
        event_handler::EventHandler,
        lifecycle
    }
};

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_update(history)]
    pub fn on_update(
        &self,
        context: HandlerContext<ExampleAgent>,
        _map: &HashMap<u64, String>,
        key: u64,
        _prev: Option<String>,
        _new_value: &str,
    ) -> impl EventHandler<ExampleAgent> {
        let ExampleAgent { max, keys } = self;
        let timestamps = &mut *keys.borrow_mut();
        timestamps.push_front(key);

        let len = timestamps.len();
        let to_drop = if len > *max { len - *max } else { 0 };

        let handler = if to_drop > 0 {
            let keys = timestamps
                .split_off(to_drop)
                .into_iter()
                .take(to_drop)
                .map(move |key| context.remove(ExampleAgent::HISTORY, key));
            Some(Sequentially::new(keys))
        } else {
            None
        };

        handler.discard()
    }
}
```

When the agent's `on_update` function is invoked, it inserts the key of the most recently updated entry into the queue of timestamps and then calculates how many entries need to be dropped. An event handler is then built from an iterator which yields Map Lane remove handlers. Using the queue, the policy ensures that only the oldest entries are pruned from the map and it never maintains a capacity greater than the defined number.

## By Time

Another map lane eviction policy that may be implemented is one which will only store entries which are within `T` amount of time of the most recently updated entry. This policy works in a similar way to the previous one, however, the entries to be evicted are calculated using the key (timestamp) of the entry which was updated.

```rust
use std::cell::RefCell;
use std::collections::VecDeque;

use swimos::{
    agent::event_handler::{HandlerActionExt, Sequentially},
    agent::{agent_lifecycle::HandlerContext, event_handler::EventHandler},
};

pub struct ExampleLifecycle {
    interval: u64,
    keys: RefCell<VecDeque<u64>>,
}

#[lifecycle(ExampleAgent, no_clone)]
impl ExampleLifecycle {
    #[on_update(history)]
    pub fn on_update(
        &self,
        context: HandlerContext<ExampleAgent>,
        _map: &HashMap<u64, String>,
        key: u64,
        _prev: Option<String>,
        _new_value: &str,
    ) -> impl EventHandler<ExampleAgent> {
        let TimeLifecycle { interval, keys } = self;
        let timestamps = &mut *keys.borrow_mut();
        timestamps.push_back(key);
        let mut to_remove = Vec::new();

        let start = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        timestamps.retain(|timestamp| {
            if start - *timestamp > *interval {
                to_remove.push(context.remove(ExampleAgent::HISTORY, *timestamp));
                false
            } else {
                true
            }
        });
        let handler = if to_remove.is_empty() {
            None
        } else {
            Some(Sequentially::new(to_remove))
        };

        handler.discard()
    }
}

```

Unlike the previous policy, a time-based policy checks the age of the keys against the maximum permitted age of a key. This is done by subtracting the entry's timestamp from the time that the handler ran and checking if the result is an age which is greater than permitted. The result of this operation is used to both build up a vector of entries that need to be removed and to prune the `VecDeque` of timestamps.

Both of the retention policy's return statements box the handlers as they are of a different type.

# Try It Yourself

A standalone project that demonstrates time series data is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/time_series).
