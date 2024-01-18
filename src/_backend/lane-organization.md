---
title: Lane Organization
short-title: Lane Organization
description: Best practices for lane organization
group: Getting Started
layout: documentation
redirect_from:
  - /concepts/lane-organization.html
---

Lanes expose an API for agents, allowing the state of an agent to be downlinked and streamed.
Good lane organization allows for desired state to be viewed with as few downlinks and redundant data as possible.

In this guide we will discuss the different lane types, what should be stored in them and how to organize them.

## Value Lanes

_For more details on usage and syntax see the [Value Lanes reference]({% link _backend/value-lanes.md %})._

Value lanes are the simplest form of a lane as they store flat data, a single **scalar value**.
While this may seem limiting, remember that the scalar value can be an object with multiple fields, we commonly use the `Value` type as it is general purpose and all lanes are backed by it.
If the data has a strict structure, consider strongly typing the lanes, see [Forms]({% link _backend/forms.md %}).

Value lanes should be organized into groups of highly related data.
Frequency of change should also be considered, it is not efficient to send fields that rarely update with every state change of the agent.

Avoid storing individual fields (a string, boolean, int) in a value lane, a single field is often not sufficient to build anything meaningful downstream and so another downlink will likely need to be opened.
For example, street can be included in address, address in contact details, contact details in user info.

At the other extreme, you should also avoid storing the entirety of an agent's state in a single value lane.
Every subscription (i.e. downlink) to a value lane _at minimum_ transfers each new value to the lane (backpressure regulation aside).
If your agent design stores `n` attributes in a single value lane, updates to a single attribute force downlinks to transfer the entire collection, leading to unnecessarily large message sizes for larger values of `n`.

**Example**

Let's say we have an agent representing something with a geographic location that can move (car, ship, plane).

- The **status** lane will store current values of sensors, metrics and kpis (speed, altitude, fuel, ETA).
Current status fields change frequently and so this lane allows for real time insights into the agents performance.

- The **info** lane will store some metadata about the agent (ID, model number, make, brand).
Metadata about the agent does not change frequently and so while it should still be available, we do not need to receive it with every state change, hence we separate it from the 'status' lane.

- The **geo** lane will store key fields for rendering the agent on a map GUI (longitude, latitude, ID, colour).
This lane is specifically created for a component downstream, a map of all the agents.
The map only updates when an agent moves, and so we cherry-pick the fields the map requires to expose a bespoke lane.

```java
@SwimLane("status")
public ValueLane<Value> status = this.<Value>valueLane();

@SwimLane("info")
public ValueLane<Value> info = this.<Value>valueLane();

@SwimLane("geo")
public ValueLane<Value> geo = this.<Value>valueLane();
```

## Map Lanes

_For more details on usage and syntax see the [Map Lanes reference]({% link _backend/map-lanes.md %})._

Map Lanes store **collections** of data ordered by a **unique key** (key-value pairs), hence it is a little more intuitive what to store in map lanes.

When one data point is updated, only the state change for that key-value pair (not the whole map) is streamed to downlinks, hence it is more efficient than storing all the data in a single value lane.

**Example**

Some examples of keyed data that can be stored in a map lane include:

- Data with **IDs** (customer ID, order ID, vehicle ID)

- Data with **unique names** ('Meeting Room 1', username, email)

- **Timestamped** data (logs, history)

- **Ordered** data where a unique key can be created ('Destination 1, 2, ...')

```java
@SwimLane("sensors")
public MapLane<String, Value> sensors = this.<String, Value>mapLane();

@SwimLane("log")
public MapLane<Long, String> log = this.<Long, String>mapLane();

@SwimLane("schedule")
public MapLane<Integer, String> schedule = this.<Integer, String>mapLane();
```

## Join Value Lanes

_For more details on usage and syntax see the [Join Value Lanes reference]({% link _backend/join-value-lanes.md %})._

Join value lanes are lanes that **aggregate** value lanes of other agents using downlinks, creating **one-to-many relationships** between agents.
They essentially create a map lane, the key being some unique identifier of an agent (node URI being the obvious candidate), the value being the current value of another agent's value lane.
The map can also be used to calculate aggregate metrics across the whole set of child agents.

For a guide on how to implement an aggregate agent see the [aggregations guide]({% link _backend/aggregations.md %}).

**Example**

Let's say we have a vehicle agent of some kind (a ship), that has a crew and is delivering orders of some kind.
Each crew member and order has a corresponding agent, each with some kind of summary lane.
Join value lanes will give us access to a single map for all crew or all orders, a single endpoint for all child agents of the aggregate agent.
Aggregations across the whole set can now be performed, such as number of crew or total value of all orders on board.

```java
@SwimLane("crew")
protected JoinValueLane<Value, Value> crew = this.<Value, Value>joinValueLane();

@SwimLane("orders")
protected JoinValueLane<Value, Value> orders = this.<Value, Value>joinValueLane();
```

## Demand Value Lanes

_For more details on usage and syntax see the [Demand Value Lanes reference]({% link _backend/demand-value-lanes.md %})._

A demand value lane does not store a value, instead they are backed by a value lane and retrieve the value purely **on demand**.
Demand value lanes **lazily generate events** for the value lane, only when there is an uplink ready to receive the event.

Consider using a demand value lane if the input value of an agent requires significant processing or transformation before being stored in a value lane.
In this case, storing the input value in a value lane and performing the transformation in a demand value lane can reduce unnecessary processing and the memory footprint of the agent.

**Example**

Let's say we have a 'compressed' value lane that stores some compressed data.
We want to be able to downlink a lane that will stream uncompressed values for use downstream.
We could decompress every value and store it in a new value lane but this would lead unnecessary processing and memory usage.
The solution is to create a demand value lane that on demand will decompress the 'compressed' lane.

```java
@SwimLane("compressed")
public ValueLane<String> compressed = this.<String>valueLane().didSet((n, o) -> this.data.cue());

@SwimLane("data")
public DemandLane<String> data = this.<String>demandLane().onCue(uplink -> uncompress());
```

## Demand Map Lanes

_For more details on usage and syntax see the [Demand Map Lanes reference]({% link _backend/demand-map-lanes.md %})._

A demand map lane does not store a collection, instead they are backed by a map lane and retrieve values purely **on demand**.
Demand map lanes **lazily generate events** for the map lane, only when there is an uplink ready to receive the event.

Consider using a demand map lane if the input value of an agent requires significant processing or transformation before being stored in a map lane.
In this case, storing the input value in a map lane and performing the transformation in a demand map lane can reduce unnecessary processing and the memory footprint of the agent.

Demand map lanes also have access to the query parameters of the uplink it is serving.
This enables on demand querying of map lanes, therefore also consider a demand map lane if it is likely that downlinks of a map lane only require events for a subset of the records.

**Example**

Let's say we have an agent with a 'user' map lane storing user metrics against username.
In the application it is common to want to downlink a single user's metrics, receiving events for every user is far too many messages and wastes bandwidth.
The solution is to create a demand map lane that on demand will filter events from the 'users' map lane.

```java
@SwimLane("users")
public MapLane<String, Value> users = this.<String, Value>mapLane()

@SwimLane("usersQuery")
public DemandMapLane<String, Value> usersQuery = this.<String, Value>demandMapLane()
    .onCue((key, uplink) -> {
        final String username = uplink.laneUri().query().get("username");
        return (key.equals(username)) ? this.users.get(username) : null;
    })
    .onSync(uplink -> {
        final String username = uplink.laneUri().query().get("username");
        return (this.users.containsKey(username)) ? 
            Collections.singletonList(username).iterator() : Collections.emptyIterator();
    });
```