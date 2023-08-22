---
title: Summary Statistics
layout: page
description: "How to abridge a Web Agent's history into summary statistics"
cookbook: https://github.com/swimos/cookbook/tree/master/summary_statistics
---

Real-time applications frequently need to produce summaries of ingested data.
An especially common requirement is producing multiple reports, one per entity within a system being monitored.

This guide illustrates how to solve problems of this nature by using Swim to:

- Model each entity of interest within the system as a Web Agent
- Within Web Agents, efficiently compute statistics against ingested data
- Expose the results in granular streaming APIs.

## Representation

Suppose we wish to monitor the health of multiple cell towers that continuously post their current state.
Each update might look like (JSON):

```
{
  "tower_id": (unique identifier)
  "timestamp": (epoch in ms),
  "s_n_ratio": (signal-noise ratio),
  "disconnects": (failures since previous posted update)
  ... (possibly more fields)
}
```

Each tower requires a corresponding Web Agent that can receive and process these updates. A skeletal `AbstractTowerAgent` class could look like:

```java
// AbstractTowerAgent.java
import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.structure.Value;

public abstract class AbstractTowerAgent extends AbstractAgent {

  @SwimLane("addMessage")
  CommandLane<Value> addMessage = this.<Value>commandLane()
      .onCommand(v -> updateSummary(messageTimestamp(v), v));

  protected long messageTimestamp(Value v) {
    return v.get("timestamp").longValue();
  }

  protected abstract void updateSummary(long timestamp, Value newValue);

}
```

## Stream-Optimized Algorithms

Efficiency is critical if we call `updateSummary()` against every incoming message, especially if message volumes are high.
Running [offline algorithms](https://en.wikipedia.org/wiki/Online_algorithm) against a [time series]({% link _guides/time-series.md %}) that contains every received message can compute _any_ (solvable) statistic of interest, but this approach incurs linearly increasing memory and time costs.

Suppose that each `TowerAgent` must report:

- the minimum, maxium, average, and variance (squared standard deviation) over all received `s_n_ratio` values
- the sum over all received `disconnects` values

We can accomplish this without ever reading a time series. Upon receiving a status update:

- Updating the minimum and maximum only requires the old minimum and maximum (e.g. `newMin=min(oldMin, newVal)`)
- Updating the average also only requires some state, perhaps (but not necessarily) the old running sum and the number of messages received (`newSum=oldSum+newVal; newCount+=1; newAvg=newSum/newCount`)
- Updating the variance can be accomplished, perhaps surprisingly, by reading only three accumulated values using [Welford's online algorithm](https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm)
- Updating the sum only requires the old sum (`newSum=oldSum+newFailures`)

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
    this.state.addValue(v.get("s_n_ratio").doubleValue(),
        v.get("disconnects").intValue());
    this.summary.set(this.state.getSummary());
  }

  @Override
  public void didStart() {
    this.state = new TowerSummaryState();
  }

}
```

_Note: While we discourage reliance on it for computations, we could easily attach a [time series]({% link _guides/time-series.md %}) of message history to `TowerAgent` (or its variations described in the upcoming sections)._
_Doing so instantiates two sets of streaming APIs: one for comprehensive statistics, and one for individual events._
_This may be a valuable addition, especially when combined with a retention policy that retains only recent or interesting historical events._

## Bucketed Summaries

Currently, each `TowerAgent` computes a single summary over its entire lifetime.
We can instead choose to track muliple summaries, each representing some subset of the entity's data.
One common motivator for this is a need for _time-based bucketing_, i.e. separate summaries that each cover a non-overlapping time period (such as every 15 minutes).

To support this functionality, simply update `TowerAgent` to 1) maintain a `Map` of `TowerSummaryStates` (as opposed to a single `TowerSummaryState`) 2) publish summaries to a `MapLane` instead of a `ValueLane`:

```java
// BucketedTowerAgent.java
import java.util.HashMap;
import java.util.Map;
import swim.api.lane.MapLane;

public class BucketedTowerAgent extends AbstractTowerAgent {

  // one minute period so you can quickly test this yourself
  private static final long SAMPLE_PERIOD_MS = 60000L;

  // Each key to this HashMap is the top of the minute covered by the value.
  // For example the TowerSummaryState for the left-inclusive time period
  //   [2023-08-21 17:09:00, 2023-08-21 17:10:00) (in UTC)
  // will be under the key 1692637740000L.
  // Note that you could choose to expose this as a MapLane, too.
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
    state.addValue(v.get("s_n_ratio").doubleValue(),
        v.get("disconnects").intValue());
    this.summaries.put(key, state.getSummary());
    this.summaryStates.put(key, state);
  }

  private static long bucket(long timestamp) {
    // Floor div then multiplication quickly purges non-significant digits.
    // For example:
    //   2023-08-21 17:09:34 = (in epoch milliseconds) 1692637774000
    //   1692637774000 / 60000 = 28210629
    //   28210629 * 60000 = 1692637740000
    // which matches the value in the summaryStates field's comment.
    // This strategy may not work as expected for awkward SAMPLE_PERIOD values;
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

An application that uses _system timestamps_ instead of message timestamps never encounters these situations.
Consequently, it only needs one summary state accumulator; just care to reset it if time has elapsed into a new bucket.

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
    // Pretend v lacks time information, so our best option is system time
    return System.currentTimeMillis();
  }

  @Override
  protected void updateSummary(long timestamp, Value v) {
    final long key = bucket(timestamp);
    if (key != this.currentBucket) {
      // Time has passed into a new bucket, reset accumulations
      resetState(timestamp);
    }
    this.currentState.addValue(v.get("s_n_ratio").doubleValue(),
        v.get("disconnects").intValue());
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

## Standalone Project

We encourage you to experiment with the [standalone project](https://github.com/swimos/cookbook/tree/master/summary_statistics) that collects the information and code samples presented here.
A few things to note:

- Running the `Main` class runs both a Swim server _and_ a simulator that feeds with data.
- `src/main/resources/server.recon` defines routing that activates `TowerAgent`, `BucketedTowerAgent`, and `WindowedTowerAgent` all at once to facilitate exploration; in a real application, you would likely pick a single implementation.

The following `swim-cli` commands are available while the process runs:

- Subscribing to a `TowerAgent` instance's `summary` lane
    ```
    % swim-cli sync -h warp://localhost:9001 -n /tower/$ID -l summary

    {count:6,min:10.522381743242732,max:22.28527569332349,avg:17.403808512841756,variance:17.16435437538436,failures:1}
    {count:7,min:10.522381743242732,max:23.042896596076552,avg:18.20939252473244,variance:18.6060973516128,failures:1}
    {count:8,min:10.522381743242732,max:23.042896596076552,avg:17.689421621696006,variance:18.172923362692888,failures:3}
    ...
    ```
- Subscribing to a `BucketedTowerAgent` instance's `summaries` lane
    ```
    % swim-cli sync -h warp://localhost:9001 -n /towerB/$ID -l summaries

    @update(key:1692679380000){count:29,min:10.77128446925376,max:23.24959464873697,avg:16.2544517182087,variance:14.289407826056422,failures:13}
    @update(key:1692679440000){count:30,min:13.118910710309262,max:25.28277927585947,avg:19.02977006553927,variance:12.15474919075009,failures:13}
    @update(key:1692679500000){count:24,min:11.35274353757999,max:24.775153946326895,avg:18.213836505473765,variance:16.033697773471467,failures:12}
    @update(key:1692679500000){count:25,min:11.35274353757999,max:24.775153946326895,avg:18.41973124051554,variance:16.409773268562738,failures:12}
    ```
- Subscribing to a `WindowedTowerAgent` instance's `summaries` lane
    ```
    % swim-cli sync -h warp://localhost:9001 -n /towerW/$ID -l summaries

    (output similar to previous command)
    ```

where `$ID` can be either `2350` or `2171`.
