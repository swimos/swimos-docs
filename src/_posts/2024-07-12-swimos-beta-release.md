---
title: SwimOS On Rust Release
redirect_from:
  - /blog/2024/7/12/munin.html
---

# Announcing SwimOS on Rust

NStream is excited to announce the beta version of the open SwimOS platform, written entirely in Rust. As with the original Java implementation, SwimOS on Rust is entirely open source and the code is available [on Github](https://github.com/swimos/swim-rust).

SwimOS is a framework for building applications for real-time streaming data processing. When using SwimOS on Rust, your application will compile to a single executable that does not need any additional infrastructure to run (no external runtimes, distributed filesystems or job schedulers are required).

## What is Real-Time Stream Processing?

A large proportion of data analysis is performed on static data sets. Data is accumulated over time and stored, either as files or in a database. To gain insight into the data, queries can then be run against the data store and for very large repositories or complex queries this can involve very long running batch processes to produce the result. This approach has several advantages:

1. Simplicity: Collecting all of the data requires little planning.
2. Flexibility: The questions you ask of the data are retrospective so can be changed after the fact.
3. Familiarity: Most people are familiar with how to query a database with SQL, for example.

However, there are also significant disadvantages:

1. Delay: Ingesting the data takes time.
2. Limited Feedback: Information from the data cannot be used to influence the process producing the data or the process collecting it as the results are not known until later.
3. Space Consumption: As you do no know what questions you might ask, you must store all of the data.

An alternative approach is to perform analysis on the data as it is generated. If the data we are analyzing can be viewed as a sequence of events, occurring over time, we can aim to process and extract information from those events as soon as they are observed. This is real-time streaming data processing.

As with most things, this presents us with a trade-off; it addresses many of the limitations of static data analysis whilst also losing its advantages. The contrasting advantages of streaming data-processing are:

1. Immediate Results: It's not necessary to wait until the data is all ingested.
2. Rapid Feedback: Insights can be used to adjust the behaviour of the system generating the events or how they are collected.
3. Low Space Consumption: Even where a streaming application needs to keep state, this can often be bounded and much lower than the size of the data.

However, comparing with the advantages of static data analysis:

1. Complexity: Processing events as they are received requires more up-front thought. What can we learn from a single observation? Do we need to maintain state over time?
2. Inflexibility: The events are only observed once so you cannot retrospectively change the questions you are asking.
3. Unfamiliarity: It is generally harder to describe the queries you need to make of streaming data. Streaming query languages do exist but they provide a subset of the features available for static querying.

## What Does a SwimOS Application Do?

A SwimOS applications observes one, or more, streams of events and uses them to build up a model of some other system in the external world and it mains an internal state which in many cases will be bounded in size. As each event is observed by the application, it updates its knowledge of the system and records that information in the state.

The state of the application is partitioned into a number of independent "agents" each of which consists of a collection of "lanes" which store either single values or maps of key-value pairs. For very large applications, the agents can be split across multiple processes over multiple hosts. Every lane is individually addressable, both from within the applications and externally using a websocket connection. It is possible for a client to both alter the state of a lane and to subscribe to a feed of changes from it. Subscribers receive push notifications each time a changes is made and do no need to poll to receive them.

Agents are not passive repositories of state and can also have user-specified behaviour. Each agent, and lane, has a number of "lifecycle events" to which event handlers can be attached. For example, it would be possible to assign a handler to be executed each time the value of a lane changes. These event handlers can alter the values of other lanes within the agent, establish communication links to other agents or cause side effects external to the application.

In addition to observing externally provided events, agents may also observe the states of the lanes of other agents. A common use of this is the build up a hierarchical view of a system by setting up a tree of agents where each node observes the state of its children. For example, consider an application that observes a stream of measurements from sensors on a fleet of buses. Each sensor could be represented by an agent which then aggregates to an agent representing a bus, then an agent for the bus route and one representing the city. At each level of the tree, aggregate statistics could be computed on the fly.

## What Does a SwimOs Application _Not_ Do?

Perhaps counterintuitively, many of the advantages of using SwimOS come from what it _does not_ do rather than what it _does_. SwimOS does not provides guarantees that every agent and lane within a system will observe every message. Instead it provides much weaker guarantees which allow it to minimize how much data is held in buffers. In fact, it is possible to write a Swim application with entirely bounded memory usage. Particularly:

1. Each agent runs within a single logical task. Within the agent, the values of lanes are strongly consistent. Event handlers attached to the state of lanes run in a predictable way, cannot interfere with each other and require no synchronisation to access the state of the lanes.
2. Outside of an agent, the view of its state is weakly consistent within the entire system. There is no guarantee of the global order of external events observed by an agent (or an external client) but, in the absence of further changes, they are guaranteed to observe the same final state.

By default, a SwimOS application does not require any external persistent storage; its state will be held entirely in memory. Additionally, as mentioned in the introduction, SwimOS runs as an independent executable and no external job scheduler is required to run it.

## Why SwimOS on Rust?

Porting SwimOS to Rust provides several key benefits, as compared to the running in the JVM:

1. No JVM Required: A typical SwimOS Rust application compiles to a small executable with no additional dependencies.
2. Deterministic Memory Management: Without the need for garbage collection, the performance of SwimOS applications can be much more predictable under heavy load.
3. Performance: Applications can take advantage of potential performance gains by implementing their agents in Rust rather than Java.
4. Rust Ecosystem: SwimOS on Rust is implemented using the [Tokio asynchronous runtime](https://tokio.rs/) and numerous other high quality Rust libraries making maintenance of the SwimOS code-base much simpler.

## Optional Persistence Support

By default, SwimOS applications do not provide any persistent storage, however, sometimes it is desirable to be able to keep some of the application's state between executions. To support this, there is support for persisting the state of agents to disk, using RocksDB as a backend. This is entirely optional, gated behind a feature flag, and will not be included in your executable unless requested.

It is possible to have fine grained control, at the level of individual lanes, over what components of your state are persisted, or not.

## Switching to SwimOS on Rust

It will be possible to port the vast majority of applications, written with the JVM version of SwimOS, to Rust. The protocol used by both is entirely identical and so a Rust application would be a drop-in replacement for an equivalent JVM application.

If the application uses any third-party libraries, for example to provide a Stream of data to populate its agents, it will be necessary to ensure that an equivalent exists for Rust.

SwimOS can be integrated easily with other open source products that you are already using, for example using Apache Kafka as a data source or sink. In future, we intend to add built in connectors to make this easier. For now, it is straightforward to use the SwimOS client to push data into your application.

To learn how to write Swim applications in Rust a selection of tutorials are provided [here](https://www.swimos.org/server/rust/) and example applications are available [here](https://github.com/swimos/swim-rust/tree/v0.1.0/example_apps).
