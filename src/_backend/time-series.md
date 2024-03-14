---
title: Time Series Data
short-title: Time Series Data
description: "How to represent and maintain time series data"
group: Swim App Templates
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/time_series
redirect_from:
  - /guides/time-series.html
---

A common form of data is time series data - that is data indexed by time (timestamped).

## Representation

Time series data is a perfect candidate for a Swim [`MapLane`]({% link _backend/map-lanes.md %}).
Using `Long` as the key type, you can create a streaming map indexed by timestamp:

```java
@SwimLane("history")
public MapLane<Long, Value> history = this.<Long, Value>mapLane();
```

This will create an empty map on agent instantiation with the name `history`.
In this example the data is stored as Swim `Value`s, but this can be changed to any type
(built-ins trivially, and custom types by using [`Forms`]({% link _backend/forms.md %})).

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

We can now make use of a `MapLane`'s callback functions to maintain the map and implement some form of windowing or retention policy.

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

We can implement a policy where the map will only store records within **N** amount of time of the most recent record.

First we create a method that when called will trim the map of any old records.
As `MapLane`s are ordered by key we can use the `lastKey()` method to obtain the most recent timestamp, subtracting our time interval we obtain a cut-off time for old records.

Using the lane's `iterator()` we can iterate through the records, starting at the oldest (as iterators are ordered by key), removing any records that are older than the cut-off time.
Once we reach a record more recent than the cut-off time, we can stop.

Next we just call the method from the `history` lane's `didUpdate` callback, this will trim the map after a new record is added.

```java
  private static final long TIME_INTERVAL_MS = 30000L;

  @SwimLane("history")
  public MapLane<Long, Value> history = this.<Long, Value>mapLane()
      .didUpdate((k,n,o) -> trimHistory());

  private void trimHistory() {
    final long oldestAllowedTimestamp = this.history.lastKey() - MAX_HISTORY_TIME_MS;
    final Iterator<Long> iterator = this.history.keyIterator();

    while (iterator.hasNext()) {
      final long key = iterator.next();
      if (key < oldestAllowedTimestamp) {
        // If the key is too old then remove it
        this.history.remove(key);
      } else {
        // Keys are ordered so stop when first key within the allowed time is found
        break;
      }
    }
  }
```

This will create a `history` time series lane and drop records that are not in a 30s (`TIME_INTERVAL_MS`) time interval of the most recent record.

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/time_series/src/main/java/swim/timeseries/TimeWindowAgent.java).

### By Recency

We can implement a policy where the map will only store records for **N** amount of time.

First we create a method that when called will trim the map of any old records.
Taking the current time and subtracting the maximum age of a record we want, we obtain a cut-off time for old records.

Using the lane's `iterator()` we can iterate through the records, starting at the oldest (as iterators are ordered by key), removing any records that are older than the cut-off time.
Once we reach a record more recent than the cut-off time, we can stop.

```java
  private void trimHistory() {
    final long oldestAllowedTimestamp = System.currentTimeMillis() - MAX_HISTORY_TIME_MS;
    final Iterator<Long> iterator = this.history.keyIterator();

    while (iterator.hasNext()) {
      final long key = iterator.next();
      if (key < oldestAllowedTimestamp) {
        // If the key is too old then remove it
        this.history.remove(key);
      } else {
        // Keys are ordered so stop when first key within the allowed time is found
        break;
      }
    }
  }
```

_Note: Unlike the previous section, it is not sufficient to just call this method whenever a new record is added - we still want to continue checking for old records, even if no new records are added._

Next we are going to create and manage a [`Timer`]({% link _backend/timers.md %}) that will handle the calling of the `trimHistory()` method we just created.
Ideally we want to manage one timer and that timer needs to trigger as soon as a record needs to be removed.

Calculating the time until the next record needs to be dropped can be done by taking the oldest record time (calling `firstKey()` on the lane) adding maximum age of a record, then subtracting the current time.

Using this calculated time we can now make use of the web agent's `setTimer(long millis, TimerFunction timer)` method to handle the scheduling of `trimHistory()`.

```java
  private static final long MAX_HISTORY_TIME_MS = 30000L;

  private TimerRef timer;

  private void rescheduleNextTrim() {
    final long timeUntilNextTrim = (this.history.firstKey() + MAX_HISTORY_TIME_MS) - System.currentTimeMillis();
    this.timer = setTimer(timeUntilNextTrim, this::trimHistory);
    
  }
```

We call the `rescheduleNextTrim()` method we just created from the `history` lane's `didUpdate` callback, this will schedule a timer to trim the map whenever a new record is added.

Finally, we need to account for a few things:

- If two records are added in quick succession, `rescheduleNextTrim()` will be called twice, creating two timers. 
To prevent this we add a check at the start of `rescheduleNextTrim()`, if there is already a timer scheduled, do nothing.
- Currently, after the timer triggers `trimHistory()`, it is not called again until a new record is added. 
What we would like to happen is for the timer to reschedule itself if the map is not empty after it is finished trimming.
Adding a call to `rescheduleNextTrim()` before the `break` in our loop will have this affect.
- It is possible to obtain a negative number when calculating the delay for the timer - meaning the oldest record should be removed immediately.
We simply check for this and call `trimHistory()` if the number calculated is less than zero.

```java
  private static final long MAX_HISTORY_TIME_MS = 30000L;

  private TimerRef timer;

  @SwimLane("history")
  public MapLane<Long, Value> history = this.<Long, Value>mapLane()
    .didUpdate((k,n,o) -> rescheduleNextTrim());

  private void trimHistory() {
    final long oldestAllowedTimestamp = System.currentTimeMillis() - MAX_HISTORY_TIME_MS;
    final Iterator<Long> iterator = this.history.keyIterator();

    while (iterator.hasNext()) {
      final long key = iterator.next();
      if (key < oldestAllowedTimestamp) {
        // If the key is too old then remove it
        this.history.remove(key);
      } else {
        // Keys are ordered so stop when first key within allowed time is found
        rescheduleNextTrim();
        break;
      }
    }
  }

  private void rescheduleNextTrim() {
    if (this.timer != null && this.timer.isScheduled()) {
      // The timer is already being handled
      return;
    }
    
    final long timeUntilNextTrim = (this.history.firstKey() + MAX_HISTORY_TIME_MS) - System.currentTimeMillis();
    if (timeUntilNextTrim > 0) {
      // Set a timer for when the next record needs to be dropped
      this.timer = setTimer(timeUntilNextTrim, this::trimHistory);
    } else if (!this.history.isEmpty()) {
      // A record needs to be dropped now
      trimHistory();
    }
  }
```

This will create a `history` time series lane and drop records after 30 seconds (`MAX_HISTORY_TIME_MS`).

See this in an agent in the [example](https://github.com/swimos/cookbook/blob/master/time_series/src/main/java/swim/timeseries/RecencyWindowAgent.java).

## Simultaneous Events

There's a catch to representing timeseries as timestamp-keyed `Maps`.
Because any `Map` key can appear at most once, processing multiple events with the same timestamp retains only the last-processed event.

### Compound Keys

If the aforementioned behavior is undesirable, we recommend instead using `Value`-typed _compound keys_ that wrap both a timestamp and some (unique) event identifier.
Two examples include:

```java
key = Record.create(2).slot("timestamp", timestamp).slot("id", id);
```

and

```java
key = Record.create(2).item(timestamp).item(id);
```

`MapLanes` are always ordered by key, and `Value`s are compared sequentially in field order (similarly to how _composite keys_ work in SQL).
Thus, the **Windowing** section remains relevant to compound-keyed `MapLane`s; just be sure to correctly extract timestamps from keys first.
For the above examples, this would look like

```java
key.get("timestamp").longValue();
```

and

```java
key.getItem(0).longValue();
```

respectively.

### Chained Values

Using compound keys precludes using `MapLane.get(timestamp)` to quickly seek entries under a provided timestamp.
If your application requires this _uncommon_ functionality, and _only if_ iterating over the compound-keyed `MapLane` proves too inefficient, implement the timeseries as a `MapLane<Long, List<Value>>` (or similar) instead.

_Note: this representation makes it trickier to both iterate over and join to the `MapLane`._
