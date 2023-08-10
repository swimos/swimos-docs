---
title: Time Series Data
layout: page
description: "How to represent and maintain time series data"
---

A common form of data is time series data - that is data indexed by time (timestamped).

All code with a running example can be found [here](https://github.com/swimos/cookbook/tree/master/time-series).

## Representation

Time series data is a perfect candidate for a Swim [`MapLane`]({% link _reference/map-lanes.md %}).
Using `Long` as the key type, you can create a streaming map indexed by timestamp:

```java
@SwimLane("history")
public MapLane<Long, Value> history = this.<Long, Value>mapLane();
```

This will create an empty map on agent instantiation with the name `history`.
In this example the data is stored as Swim `Value`s but this can be changed to any supported type.

## Adding Data

Adding to a Swim `MapLane` is almost identical to adding to an ordinary Java `Map`.
Simply call the `put(K key, V value)` method to add the key-value data into the map:

```java
this.history.put(
    System.currentTimeMillis(),
    Record.create(2).slot("id", 1).slot("status", "enabled")
);
```

This will insert a dummy value into the above `history` map lane with the current time as key.

## Windowing

We can now make use of a `MapLane`'s callback functions to maintain the map and implement some form of windowing or retention policy

### By Record Count

We can implement a policy where the map will only store the **N** most recent records.

First we create a method that when called will trim the map to the desired size. 
As `MapLane`s are ordered by key we can use the `drop(int count)` method to drop the oldest `count` records. 

Next we just call the method from the `history` lane's `didUpdate` callback, this will trim the map after a new record is added.

```java
  private final static int MAX_HISTORY_SIZE = 10;

  @SwimLane("history")
  public MapLane<Long, Value> history = this.<Long, Value>mapLane()
    .didUpdate((k,n,o) -> trimHistory());

  private void trimHistory() {
    final int dropCount = this.history.size() - MAX_HISTORY_SIZE;
    if (dropCount > 0) {
      this.history.drop(dropCount);
    }
  }
```

This will create a `history` time series lane and maintains a record count of 10 (`MAX_HISTORY_SIZE`).

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/time_series/src/main/java/swim/timeseries/CountWindowAgent.java).

### By Time

We can implement a policy where the map will only store records for **N** amount of time.

First we create a method that when called with a `long key` will drop the corresponding record after a given amount of time.
We can make use of web agent's `setTimer(long millis, TimerFunction timer)` method to handle the timing.
The `MapLane`'s `remove(K key)` function will remove the record.

Next we just call the method from the `history` lane's `didUpdate` callback, this will start the remove timer when a new record is added.

```java
  private static final long MAX_HISTORY_TIME_MS = 30000L;

  @SwimLane("history")
  public MapLane<Long, Value> history = this.<Long, Value>mapLane()
      .didUpdate((k,n,o) -> startRemoveTimer(k));

  private void startRemoveTimer(final long key) {
    setTimer(MAX_HISTORY_TIME_MS, () -> {
      this.history.remove(key);
    });
  }
```

This will create a `history` time series lane and drop records after 30 seconds (`MAX_HISTORY_TIME_MS`).

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/time_series/src/main/java/swim/timeseries/TimeWindowAgent.java).
