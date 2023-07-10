---
title: Timers
layout: page
description: "Schedule tasks for future execution in Web Agents."
redirect_from:
  - /tutorials/timers/
---

The ability for a Swim server to repeatedly trigger custom actions at Agent-level whim is often a desired feature in a Swim application. Swim provides the means to set timers, which enable users to both define functions (called TimerFunctions) and trigger them at desired times.

### Internals

Swim uses a hashed timing wheel, implemented in swim.concurrent.Clock, to schedule its timers. For a clock with r-millisecond resolution and b buckets that each store a simple queue, non-decreasing by target tick:

- Timer scheduling involves computing a trivial (modulo) hash to identify the desired bucket, then inserting in the right position in a queue.
- Timer cancellation involves removing the timer from its queue without evaluating its TimerFunction.
- A "tick" involves waiting for r milliseconds, then examining the next bucket.
- When the scheduler reaches a bucket, every timer in it whose expiry time aligns with the current tick is submitted for execution.

b and r are configurable by the system properties swim.clock.tick.count and swim.clock.tick.millis and default to 512 and 100, respectively.

### Declaration

A TimerRef is a concrete handle to the timer logic that a user wishes to execute. Such a handle can additionally be used to check the status of, reschedule, and cancel the corresponding timer. TimerRefs are simply declared as fields within Agents:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;
import swim.concurrent.TimerRef;

public class UnitAgent extends AbstractAgent {
  private TimerRef timer;
}
```

### Instantiation

Every AbstractAgent comes with a utility method, setTimer, to initialize a TimerRef. setTimer(long millis, TimerFunction f) schedules f for execution after an initial delay of milliseconds.

Suppose we wanted to identify how long it has been, with one-minute resolution, since the last time an Agent received a command. One solution requires three pieces:

- A value lane to store this duration
- A command lane whose onCommand() callback sets the value lane to 0, then schedules a new timer
- The aforementioned timer goes off every minute since it was issued, and its TimerFunction simply increments the value lane's value by 1.

Every TimerRef has access to reschedule() and cancel() methods. Combining these with the aforementioned setTimer() call gives a user complete control over when (or not) to fire its events.

Putting these pieces together looks something like the following; note that "minutes" here means 10 seconds, just to speed up an otherwise very slow demo:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.concurrent.TimerRef;
import swim.structure.Value;

public class UnitAgent extends AbstractAgent {

  private TimerRef timer;

  @SwimLane("minutesSincePublish")
  ValueLane<Integer> minutes = this.<Integer>valueLane()
      .didSet((n, o) -> {
        System.out.println((n * 10) + " seconds since last event");
      });

  @SwimLane("publish")
  CommandLane<Value> publish = this.<Value>commandLane()
      .onCommand(v -> {
        this.minutes.set(0);
        resetTimer();
      });

  @Override
  public void didStart() {
    resetTimer();
  }

  @Override
  public void willStop() {
    cancelTimer();
  }

  private void resetTimer() {
    cancelTimer();
    this.timer = setTimer(10000, () -> {
        this.minutes.set(this.minutes.get() + 1);
        this.timer.reschedule(10000);
      });
  }

  private void cancelTimer() {
    if (this.timer != null) {
      this.timer.cancel();
    }
  }
}
```

And here's a client that can exercise it:

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.client.ClientRuntime;
import swim.structure.Value;

class CustomClient {

  public static void main(String[] args) throws InterruptedException {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final String hostUri = "warp://localhost:9001";
    final String nodeUri = "/unit/foo";
    for (int i = 0; i < 10; i++) {
      swimClient.command(hostUri, nodeUri, "publish", Value.absent());
      Thread.sleep(5000 * i);
    }
    System.out.println("Will shut down client");
    swimClient.stop();
  }
}
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/timers).
