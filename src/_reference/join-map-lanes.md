---
title: Join Map Lanes
layout: page
redirect_from:
  - /tutorials/join-map-lanes/
---

In a [previous tutorial]({% link _reference/join-value-lanes.md %}), we discussed Join Value Lanes which aggregate value lanes from many agents. Similar to **Join Value Lanes**, **Join Map Lanes** aggregate **Map Lanes** across multiple agents.

A **Join Map Lane** uses [downlinks]({% link _reference/links.md %}) to create permanent links to **Map Lanes** and exhibits the same behaviour as [Map Lanes]({% link _reference/map-lanes.md %}). Some additional properties are present:

- Operations performed on a **Map Lane** are propagated via downlinks to the **Join Map Lane**.
- A **link form** must be specified.
- Customizable **lifecycle callbacks** that execute during the runtime of this join map lane.
- Every join map lane can be **linked** to multiple map lanes.
- A new **DownlinkMap** instance is returned containing an entryset containing the aggregated entrysets of the downlinked map lanes.
- The type parameters on a join map lane indicate: the link form type, key and value types.

### Declaration

**Join Map Lanes** are declared similarly to **Map Lanes** but require an additional type to be defined, the **link form type**. As follows:

```java
@SwimLane("join")
JoinMapLane<FormType, KeyType, ValueType> stateJoinMap = this.joinMapLane();
```

For the purposes of this cookbook all three types will be **String**. A join map lane is a map that can aggregate entry sets of many map lanes using downlinks. If aggregating maps of different types, a sufficient type must be used - such as a String. **Join Map Lanes** can perform **put** and **remove** operations on the map instance but the operations are not propagated via the downlinks.
    
Usage of **Join Map Lanes** mandates downlinks to be opened to the lanes that are to be aggregated and this can be performed easily through the **didStart()** method of an agent.

```java
// swim/basic/AggregatedStatisticsAgent.java
static class AggregatedStatisticsAgent extends AbstractAgent {
  @SwimLane("join")
  JoinMapLane<String, String, Integer> aggregatedStatistics = this.joinMapLane();

  @Override
  public void didStart() {
    aggregatedStatistics.downlink("california").hostUri(HOST_URI).nodeUri("/state/california").laneUri("state").open();
    aggregatedStatistics.downlink("texas").hostUri(HOST_URI).nodeUri("/state/texas").laneUri("state").open();
    aggregatedStatistics.downlink("florida").hostUri(HOST_URI).nodeUri("/state/florida").laneUri("state").open();
  }
}
```

From here, we are able to use the lifecycle events that occur on other data structures in the same fashion; such as registering a **didUpdate()** to process the data.

### A worked example

In this example, we will work through joining three **Map Lanes** that hold information regarding US states and aggregate the data into a **Join Map Lane**. This aggregated data will have a **didUpdate()** callback registered that checks entries that are added to see if they exceed a threshold. If it is, then the data is logged. 

One agent, **StreetStatisticsAgent**, will store a given state's street data. **AggregatedStatisticsAgent** will aggregate all the **StreetStatisticsAgents** and is accessible through a **MapDownlink** which is used further on.

```java
// swim/basic/StreetStatisticsAgent.java
static class StreetStatisticsAgent extends AbstractAgent {
  /*
    - Key: Street name
    - Value: Street population
  */
  @SwimLane("state")
  MapLane<String, Integer> streetStatistics = this.mapLane();
}

// swim/basic/AggregatedStatisticsAgent.java
static class AggregatedStatisticsAgent extends AbstractAgent {
  // Aggregated statistics of US states
  @SwimLane("join")
  JoinMapLane<String, String, Integer> aggregatedStatistics = this.joinMapLane();

  @Override
  public void didStart() {
    aggregatedStatistics.downlink("california").hostUri(HOST_URI).nodeUri("/state/california").laneUri("state").open();
    aggregatedStatistics.downlink("texas").hostUri(HOST_URI).nodeUri("/state/texas").laneUri("state").open();
    aggregatedStatistics.downlink("florida").hostUri(HOST_URI).nodeUri("/state/florida").laneUri("state").open();
  }
}
```

**Join Map Lanes** require downlinks to all of the **JoinMaps** that are to be aggregated and these can be opened using the agent's **didStart()** method; in this instance, the **didStart()** method is used for convenience, however, in more complex applications [command lanes]({% link _reference/command-lanes.md %}) would be more suitable. Here, downlinks are opened to three states using the Swim lane **'state'**.

Bringing this together, a plane is required with the two previous agents and the appropriate lane URIs.

```java
// swim/basic/BasicPlane.java
static class BasicPlane extends AbstractPlane {
  @SwimRoute("/state/:name")
  AgentRoute<StreetStatisticsAgent> mapRoute;

  @SwimRoute("/join/state/:name")
  AgentRoute<AggregatedStatisticsAgent> joinMapRoute;
}
```

By design, operations performed on a **Join Map Lane** are not propagated through the uplinks to the **Map Lanes**. Thus, the maps to be aggregated must be populated and not inversely. **Map Lanes** are opened on a plane as discussed in the [map lane]({% link _reference/map-lanes.md %}) cookbook and a **Join Map Lane** is no exception. This **Join Map Lane** logs streets that contain over 1000 residents using the **didUpdate()** method:

```java
// swim/basic/CustomClient.java
final MapDownlink<String, Integer> join = clientRuntime.downlinkMap()
  .keyClass(String.class)
  .valueClass(Integer.class)
  .hostUri(HOST_URI)
  .nodeUri("/join/state/all")
  .laneUri("join")
  .didUpdate((key, newValue, oldValue) -> {
      if (newValue > THRESHOLD) {
          logStreet(key, newValue);
      }
  }).open();
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/join_map_lanes).
