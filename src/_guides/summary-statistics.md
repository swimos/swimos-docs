---
title: Summary Statistics
layout: page
description: "How to efficiently abridge a Web Agent's history into summary statistics"
cookbook: https://github.com/swimos/cookbook/tree/master/summary_statistics
---

Real-time applications frequently need to produce summaries of ingested data.
An especially common requirement is producing multiple reports, each representing one entity within a system being monitored.

## Representation

Suppose we wish to monitor the health of multiple cell towers that continuously post their current state.
Each update might look like (JSON):

```
{
  "tower_id": (unique identifier)
  "timestamp": (epoch in ms),
  "mean_ul_sinr": (signal-noise ratio),
  "rrc_re_establishment_failures": (issues since previous post)
  ...
}
```

Each tower needs a corresponding Web Agent capable of receiving these updates, accounting for them in the calculation of some summary.
For any application, it will nearly always make sense to assign a corresponding Web Agent to every entity being monitored.

A skeletal `AbstractTowerAgent` could look like:

```java
// AbstractTowerAgent.java
import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.structure.Value;

public abstract class AbstractTowerAgent extends AbstractAgent {

  @SwimLane("addMessage")
  CommandLane<Value> addMessage = this.<Value>commandLane()
      .onCommand(v -> {
        updateSummary(messageTimestamp(v), v);
      });

  protected long messageTimestamp(Value v) {
    // System.currentTimeMillis() if your incoming msgs lack time info
    return v.get("timestamp").longValue();
  }

  protected abstract void updateSummary(long timestamp, Value newValue);

}
```

## Stream-Optimized Algorithms

Efficiency is important if we call `updateSummary()` against every incoming message, especially if message rates are high.
[Offline algorithms](https://en.wikipedia.org/wiki/Online_algorithm) against a [time series]({% link _guides/time-series.md %}) of every received message can compute _any_ (solvable) statistic of interest, but this approach incurs linearly-increasing memory and time costs.

Suppose that each `TowerAgent` must report the minimum, maxium, average, and variance (i.e. squared standard deviation) of all `mean_ul_sinr` values that it ingests; as well as the sum of all `rrc_re_establishment_failures` values.
Upon receiving a status update:

- Updating the minimum and maximum is easy if we already know the old minimum and maximum (e.g. `newMin=min(oldMin, newVal)`)
- Updating the average is easy if we already know the old running sum and the number of messages received (`newSum=oldSum+newVal; newCount+=1; newAvg=newSum/newCount`)
- [Welford's online algorithm](https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm) outlines how to update the variance by reading only three accumulated values.
- Updating the sum is easy if we already know the old sum (`newSum+=newFailures`)

For cleanliness, let's wrap functionality in a separate class:

```java
// TowerSummaryState.java
import swim.structure.Record;
import swim.structure.Value;

class TowerSummaryState {

  // sinr
  private double min = Double.MAX_VALUE;
  private double max = -Double.MIN_VALUE;
  private int count = 0;
  private double mean = 0.0;
  private double agg = 0.0;
  // failures
  private int failures = 0;

  public void addValue(double d, int f) {
    this.min = Math.min(this.min, d);
    this.max = Math.max(this.max, d);
    this.count += 1;
    // Welford's online algorithm for computing variance also handles mean.
    // The mean part may seem cryptic. Start from the fact that:
    //   newMean = (oldMean * (newCount - 1) + d) / newCount
    // Now let delta = d - oldMean, and these two lines should make sense.
    final double delta = d - this.mean;
    this.mean += delta / this.count;
    // delta is required to update Welford's algorithm's critical accumulator.
    this.agg += delta * (d - this.mean);

    this.failures += f;
  }

  public Value getSummary() {
    if (this.count == 0) {
      return Value.extant();
    }
    return Record.create(6)
        .slot("count", this.count)
        .slot("min", this.min)
        .slot("max", this.max)
        .slot("avg", this.mean)
        .slot("variance", this.agg / this.count)
        .slot("failures", this.failures);
    // Note: agg and count trivially transform into more than just variance:
    // - agg / count = variance
    // - sqrt(agg/count) = stdev
    // - agg / (count - 1) = sample variance
    // - sqrt(agg / (count - 1)) = sample stdev
  }

}
```

_Note: The average could just as effectively have been calculated with a rolling sum divided by the count, as suggested earlier._
_We only chose this approach because we require `delta` to calculate variance anyway._

_Note: Not every statistic can be optimized this perfectly._
_For example, any (non-heuristic) median over floating points will require reading past values at some point, leading to `O(n)` space complexity (choice of representation may still reduce time complexity)._

This yields a very compact `TowerAgent` implementation:

```java
// TowerAgent.java
import swim.api.lane.ValueLane;
import swim.recon.Recon;
import swim.structure.Value;

public class TowerAgent extends AbstractTowerAgent {

  private TowerSummaryState state;

  @SwimLane("summary")
  ValueLane<Value> summary = this.<Value>valueLane()
      .didSet((n, o) ->
          System.out.println(nodeUri() + ": updated summary to " + Recon.toString(n)));

  @Override
  protected void updateSummary(long timestamp, Value v) {
    this.state.addValue(v.get("mean_ul_sinr").doubleValue(),
        v.get("rrc_re_establishment_failures").intValue());
    this.summary.set(this.state.getSummary());
  }

  @Override
  public void didStart() {
    this.state = new TowerSummaryState();
  }

}
```

_Note: we can trivially attach a [time series]({% link _guides/time-series.md %}) of raw history to this `TowerAgent` or either of its variations below._
_Doing so provides a set of powerful streaming APIs that inform of both comprehensive statistics and raw events._
_Better still if the time series configures a retention policy, prioritizing only the important raw events._

## Bucketed Summaries

Currently, each `TowerAgent` computes one set of statistics that summarizes its entire lifetime.
We can also track muliple statistics, each representing a subset of the entity's data.
To do this, simply track a separate set of states for every such subset (as opposed to a single set like before).

An especially common requirement is time bucketing, i.e. maintaining a separate summary for, say, every 15-minute period.
To create a variant of `TowerAgent` that generates separate summaries for every one-minute window, the only changes are to 1) maintain a `Map` of `TowerSummaryStates` 2) publish summaries to a `MapLane` instead of a `ValueLane`:

```java
// BucketedTowerAgent.java
import java.util.HashMap;
import java.util.Map;
import swim.api.lane.MapLane;

public class BucketedTowerAgent extends AbstractTowerAgent {

  // one minute period so you can quickly test this yourself
  private static final long SAMPLE_PERIOD_MS = 60000L;

  // Each key to this MapLane is the top of the minute covered by the value.
  // For example the TowerSummaryState for the left-inclusive time period
  //   [2023-08-21 17:09:00, 2023-08-21 17:10:00) (in UTC)
  // will be under the key 1692637740000L.
  private Map<Long, TowerSummaryState> summaryStates;

  // Same keys as the summaryStates map
  @SwimLane("summaries")
  MapLane<Long, Value> summaries = this.<Long, Value>mapLane()
      .didUpdate((k, n, o) ->
          System.out.println(nodeUri() + ": updated summary under " + k + " to " + Recon.toString(n)));

  @Override
  protected void updateSummary(long timestamp, Value v) {
    final long key = bucket(timestamp);
    final TowerSummaryState state = this.summaryStates.getOrDefault(key, new TowerSummaryState());
    state.addValue(v.get("mean_ul_sinr").doubleValue(),
        v.get("rrc_re_establishment_failures").intValue());
    this.summaries.put(key, state.getSummary());
    this.summaryStates.put(key, state);
  }

  private static long bucket(long timestamp) {
    // Floor div then multiplication quickly purges non-significant digits.
    // This logic may not work as expected for awkward SAMPLE_PERIOD values;
    // adjust as needed for your use case.
    return timestamp / SAMPLE_PERIOD_MS * SAMPLE_PERIOD_MS;
  }

  @Override
  public void didStart() {
    if (this.summaryStates != null) {
      this.summaryStates.clear();
    }
    this.summaryStates = new HashMap<>();
  }

}
```

## Windowed Summaries

The logic in the previous section works even if messages come out of order, and if we receive a message whose timestamp is in the future.
However, it requires maintaining multiple independent summary states at a time, since a new incoming message could target any one of these.

If your application uses system timestamps instead of message timestamps, then these cases never happen; consequently, you only need one summary state accumulator.

```java
// WindowedTowerAgent.java
public class WindowedTowerAgent extends AbstractTowerAgent {

  private static final long SAMPLE_PERIOD_MS = 60000L;

  private TowerSummaryState currentState;
  private long currentBucket;

  @SwimLane("summaries")
  MapLane<Long, Value> summaries = this.<Long, Value>mapLane()
      .didUpdate((k, n, o) ->
          System.out.println(nodeUri() + ": updated summary under " + k + " to " + Recon.toString(n)));

  @Override
  protected long messageTimestamp(Value v) {
    return System.currentTimeMillis();
  }

  @Override
  protected void updateSummary(long timestamp, Value v) {
    final long key = bucket(timestamp);
    if (key != this.currentBucket) {
      // Time has passed into a new bucket, reset accumulations
      resetState(timestamp);
    }
    this.currentState.addValue(v.get("mean_ul_sinr").doubleValue(),
        v.get("rrc_re_establishment_failures").intValue());
    this.summaries.put(key, this.currentState.getSummary());
  }

  private void resetState(long now) {
    this.currentState = new TowerSummaryState();
    this.currentBucket = bucket(now);
  }

  private static long bucket(long timestamp) {
    return timestamp / SAMPLE_PERIOD_MS * SAMPLE_PERIOD_MS;
  }

  @Override
  public void didStart() {
    resetState(System.currentTimeMillis());
  }

}
```