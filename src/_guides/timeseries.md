---
title: Time Series Data
layout: page
description: "How to represent and maintain time series data"
---

A common form of data is time series data - that is data indexed by time (timestamped).

### Representation

Time series data is a perfect candidate for a Swim `MapLane`.
Using `Long` as the key type, you can create a streaming map indexed by timestamp:

```java
@SwimLane("history")
public MapLane<Long, Value> history = this.<Long, Value>mapLane();
```

This will create an empty map on agent instantiation with the name `history`.
In this example the data is stored as Swim `Value`s but this can be changed to any supported type.

### Adding Data

Adding to a Swim `MapLane` is almost identical to adding to an ordinary Java `Map`.
Simply call the `put(K key, V value)` method to add the key-value data into the map:

```java
this.history.put(
    System.currentTimeMillis(),
    Record.create(2).slot("id", 1).slot("status", "enabled")
);
```

This will insert a dummy value into the above `history` map lane with the current time as key.

### Windowing

We can now make use of a `MapLane`'s callback functions to maintain the map and implement a maximum record count.

First we create a method that when called will trim the map to the desired size. 
As `MapLane`s are ordered by key we can use the `drop(int count)` method to drop the oldest `count` records. 

Next we just call the method from the `history` lane's `didUpdate` callback, this will trim the map after a new record is added.

```java
@SwimLane("history")
public MapLane<Long, Value> history = this.<Long, Value>mapLane()
    .didUpdate((k,n,o) -> trimHistory());

private final static int MAX_HISTORY_SIZE = 10;

private void trimHistory() {
  final int dropCount = MAX_HISTORY_SIZE - this.history.size();
  if (dropCount > 0) {
    this.history.drop(dropCount);
  }
}

```

### Put It All Together

Putting all the above together, we can create a `HistoryAgent` that can be commanded to add an event to a timestamp indexed map, while maintaining a maximum record count.

```java
public class HistoryAgent extends AbstractAgent {
  
  private final static int MAX_HISTORY_SIZE = 10;

  @SwimLane("history")
  public MapLane<Long, Value> history = this.<Long, Value>mapLane()
      .didUpdate((k,n,o) -> trimHistory());
  
  private void trimHistory() {
    final int dropCount = MAX_HISTORY_SIZE - this.history.size();
    if (dropCount > 0) {
      this.history.drop(dropCount);
    }
  }

  @SwimLane("addEvent")
  protected CommandLane<Value> addEvent = this.<Value>commandLane()
      .onCommand(v -> this.history.put(System.currentTimeMillis(), v));

}
```
