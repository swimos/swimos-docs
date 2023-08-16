---
title: Group and Aggregate Agents
layout: page
description: "How to group agents and calculate aggregate stats"
cookbook: https://github.com/swimos/cookbook/tree/master/aggregations
---

It is common to want to group agents together and calculate some aggregate stats across that set of agents.

This pattern can really be extended to any kind of grouping where the members share some property, but some specific examples include:

- Grouping vehicles by city
  
- Grouping products by manufacturer
  
- Grouping users by role
  
- Grouping orders by customer

Throughout this guide, for demonstration, we are going to build out the vehicle example, grouping the vehicles by the state (in the USA) they are currently in.

Let's take a simple vehicle agent as a starting point, the main component of which being a [`ValueLane`]({% link _reference/value-lanes.md %}) that stores the vehicle's status.

```java
public class VehicleAgent extends AbstractAgent {
    
  @SwimLane("addEvent")
  public CommandLane<Value> addEvent = this.<Value>commandLane()
      .onCommand(v -> this.status.set(v));

  @SwimLane("status")
  public ValueLane<Value> status = this.<Value>valueLane();
    
}
```

In this example the status of a vehicle is stored as a Swim `Value` but this can be changed to any supported type.

### Group Agent

First we are going to construct a simple group/aggregate agent, in our example a `StateAgent`.

A [`JoinValueLane`]({% link _reference/join-value-lanes.md %}) inside the `StateAgent` will become a map, the key being some unique identifier of a vehicle, and the value being the vehicle's current status.
The lane will keep itself up to date with the `status` of the vehicle through the use of [`downlinks`]({% link _reference/downlinks.md %}).

```java
public class StateAgent extends AbstractAgent {

  @SwimLane("vehicles")
  public JoinValueLane<Uri, Value> vehicles = this.<Uri, Value>joinValueLane();
    
}
```

Notice the type parameters of the lane in the above example.

- The first parameter is the type of the unique identifier of the vehicle.
As a node URI is unique to each agent we will be using that (but this could be anything else unique to the vehicle, e.g. `id: String`).
  
- The second parameter is the type of the value to be downlinked, this should match the type of the `status` `ValueLane` in the vehicle agent.

Now we need some way for a vehicle to register itself with the state and join the lane.
To do this we open a [`CommandLane`]({% link _reference/command-lanes.md %}) named `addVehicle` accepting a `Uri` - which will be the vehicle's node URI.
The `downlink(K key)` method on the join value lane creates a downlink with the given unique key.
We also specify the `nodeUri` and `laneUri` then start the downlink with `open()`.

```java
  @SwimLane("addVehicle")
  public CommandLane<Uri> addVehicle = this.<Uri>commandLane()
      .onCommand(v ->
          this.vehicles
              .downlink(v)
              .nodeUri(v)
              .laneUri("status")
              .open());
```

We now have a working `StateAgent` that can accept a vehicle's node URI and will keep an up to date map of all registered vehicle's `status` lanes.

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/aggregations/src/main/java/swim/aggregations/StateAgent.java).

### Joining

Next we need to add some logic to the `VehicleAgent` to command the `StateAgent`'s `addVehicle` lane we created in the previous section.

Assuming the URI pattern for state agents is `/state/:name` then we can create a `joinState` method in the `VehicleAgent`.
The method will accept a state's name and then command the state's `addVehicle` lane with the vehicle's node URI.

```java
  private void joinState(final String state) {
    command(
        "/state/" + state,
        "addVehicle",
        Uri.form().mold(nodeUri()).toValue()
    );
  }
```

_Note: We have to convert the vehicle's node URI to a `Value` to send it via a command. For more information on this see [Forms]({% link _reference/forms.md %})._

We now need to call the above method, exactly when you will want to do this will depend on the use case.
The most common cases are:

- **Agent Start**: Call within the agent's `didStart()` lifecycle callback to join immediately on agent start.
The value ('state' in this example) can be static or loaded from a property of some kind.
  
- **On Event**: Call from a lane's callback functions, this will allow the agent to join the group agent when some condition is met.

Both approaches have a similar implementation, but we will show both.

#### Agent Start

We simply call `joinState` in the agent's `didStart()` lifecycle callback.

```java
  @Override
  public void didStart() {
    joinState("California");
  }
```

This will join the `/state/California` `StateAgent` on start up and any updates to the vehicle's `status` lane will be reflected in the `vehicles` lane of the California state agent.

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/aggregations/src/main/java/swim/aggregations/StationaryVehicleAgent.java).

#### On Event

We add a `didSet` callback to the `status` lane of the `VehicleAgent`, extracting the `state` field from the new status and passing it to the `joinState` method - if the `state` field is not present then pass `null`.

```java
  @SwimLane("status")
  public ValueLane<Value> status = this.<Value>valueLane()
      .didSet((nv, ov) -> joinState(nv.get("state").stringValue(null)));
```

This introduces a problem; whenever the vehicle `status` is updated, the vehicle will try to join the state, even if it already has.
Ideally we only want the vehicle to try to join if the `state` field in the `status` lane changes.
We do this by keeping track of the state agent that the vehicle is currently joined and modifying `joinState` to only command if the state has changed.

```java
  private String currentState;

  private void joinState(final String state) {
    if (isSameAsCurrentState(state)) {
      // If the new state is the same as the current state, then do nothing
      return;
    }
    if (state != null) {
      command(
          "/state/" + state,
          "addVehicle",
          Uri.form().mold(nodeUri()).toValue()
      );
    }
    this.currentState = state;
  }

  private boolean isSameAsCurrentState(final String state) {
    return (this.currentState == null && state == null) ||
        (this.currentState != null && this.currentState.equals(state));
  }
```

We now have a `VehicleAgent` that will join any `StateAgent` when the vehicle moves into it.

_Note: You may have noticed that if the vehicle moves between states, then it will be joined to multiple `StateAgent`s - we will address this in the next section._

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/aggregations/src/main/java/swim/aggregations/VehicleAgent.java).

### Leaving

Currently, vehicles join a new `StateAgent` whenever their status changes state, however, they do not leave the old one.
We can fix this by implementing a way for the vehicles to leave or deregister from a state.

Much like the `addVehicle` lane on the `StateAgent`, we can add a `removeVehicle` lane.
This, when commanded with a vehicle's node URI, will remove it from the join lane and stop the downlink associated with it.

```java
  @SwimLane("removeVehicle")
  public CommandLane<Uri> removeVehicle = this.<Uri>commandLane()
      .onCommand(v ->
          this.vehicles
              .remove(v));
```

Next, in the `VehicleAgent` we can command this lane right before we join a new state (in the `joinState` method).

```java
  private void joinState(final String state) {
    if (isSameAsCurrentState(state)) {
      // If the new state is the same as the current state, then do nothing
      return;
    }

    if (this.currentState != null) {
      command("/state/" + this.currentState,
          "removeVehicle",
          Uri.form().mold(nodeUri()).toValue()
      );
    }

    if (state != null) {
      command(
          "/state/" + state,
          "addVehicle",
          Uri.form().mold(nodeUri()).toValue()
      );
    }

    this.currentState = state;
  }
```

We now have a `VehicleAgent` that can move between `StateAgent`s whenever the `state` field in the `status` lane changes.

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/aggregations/src/main/java/swim/aggregations/VehicleAgent.java).

### Aggregating

Now we have an automatically updating, streaming map, we can continuously compute some metrics across the whole group.
We can aggregate the status of all the vehicle agents into a status of the whole state.

Working entirely inside the `StateAgent` from now on, we add a few things:

- A `ValueLane` named `status` we can use to hold the status of the state.
- A method `computeStatus()` that will be used to compute and set the state's status.
- A `didUpdate` callback to the `vehicles` lane that calls `computeStatus()`.

```java
  @SwimLane("vehicles")
  public JoinValueLane<Uri, Value> vehicles = this.<Uri, Value>joinValueLane()
      .didUpdate((k, nv, ov) -> computeStatus());

  @SwimLane("status")
  public ValueLane<Value> status = this.<Value>valueLane();

  private void computeStatus() {
    /// Compute and set the state's status
  }
```

Whenever a vehicle's `status` changes, the `status` of the state will be recomputed.

All that's left to do now is decide on the content of the state's status.
There are a various computations we can do to create an aggregated status, but we will show a few of the most common.

Each one is in the [example](https://github.com/swimos/cookbook/blob/master/aggregations/src/main/java/swim/aggregations/VehicleAgent.java).

#### Count

Getting a count of all vehicles in the state is the same as getting the size of the join value lane which can be done with the `size()` method on the lane.
For any other count, for example, a count of vehicles currently moving, we can loop through the map, keeping a counter of all vehicles that meet this condition.

```java
  private void computeStatus() {
    
    int movingVehicles = 0;
    for (final Uri vehicleUri : this.vehicles.keySet()) {
      if (this.vehicles.get(vehicleUri).get("isMoving").booleanValue(false)) {
        movingVehicles++;
      }
    }
    
    this.status.set(
        Record.create(2)
            .slot("vehicle_count", this.vehicles.size())
            .slot("moving_vehicle_count", movingVehicles)
    );
  }
```

#### Mean

Calculating a mean is done by looping through all the entries of the join value lane, keeping a total and dividing by the count at the end.

```java
  private void computeStatus() {

    int totalSpeed = 0, movingVehicles = 0;
    
    for (final Uri vehicleUri : this.vehicles.keySet()) {
      totalSpeed += this.vehicles.get(vehicleUri).get("speed").intValue(0);
      
      if (this.vehicles.get(vehicleUri).get("isMoving").booleanValue(false)) {
        movingVehicles++;
      }
    }

    this.status.set(
        Record.create(2)
          .slot("mean_speed", this.vehicles.size() == 0 ? 0 : totalSpeed / this.vehicles.size())
          .slot("mean_speed_of_moving_vehicles", movingVehicles == 0 ? 0 : totalSpeed / movingVehicles)
    );
  }
```

Here we calculate the `mean_speed` across all vehicles and the `mean_speed_of_moving_vehicles` across a subset of the vehicles.

#### Max/Min

Finding the max or min of some value across all the entries in the join lane can be done by looping through the entries and keeping track of the max/min.

```java
  private void computeStatus() {

    int topSpeed = 0;
    for (final Uri vehicleUri : this.vehicles.keySet()) {
      int currentVehiclesSpeed = this.vehicles.get(vehicleUri).get("speed").intValue(0);
      if (currentVehiclesSpeed > topSpeed) {
        topSpeed = currentVehiclesSpeed;
      }
    }

    this.status.set(
        Record.create(1)
          .slot("top_speed", topSpeed)
    );
  }
```
