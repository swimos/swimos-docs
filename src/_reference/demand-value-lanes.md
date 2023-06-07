---
title: Demand Value Lanes
layout: page
---

In a [previous tutorial](/tutorials/web-agents), we began to describe a distributed object model where **Web Agents** are the **objects**. The **fields** in this model are called **lanes**.

Lanes come in many flavors, but every lane type exposes:

- A **means to act** on this lane
- Customizable **lifecycle callbacks** that execute during the runtime of this action
- Various means to **strongly type** (i.e. *parametrize*) the lane
- Universal WARP **subscriptions** to this lane

A **demand lane** does not store any value, instead they are backed by a [value lane](/tutorials/value-lanes) and retrieve values purely on demand. Demand lanes **lazily** generate events for the value lane, only when there is an uplink ready to receive the event. The lane meets these requirements: 

- Every demand lane can be **cue**-ed, signalling there is an event to be sent to the uplinks, if ready. This is done in the value lane's `didSet()` method
- Doing so will trigger its **onCue()** callback
- The parameter on a demand lane indicates the type of value that it fetches
- Demand lane state and lifecycle can be subscribed to via both **value downlinks** and general-purpose **event downlinks**

Demand lanes can be cue()-ed at extremely high rates, and only as many events will be generated as each uplink can handle; the rate of event generation is tailored per uplink.

Demand lanes are ideal for publishing statistical events, where it isn't important that a client receives every incremental update, only that the client eventually receives the latest state, that the state clients receive is real-time (within the latency of the network), and that updates are desired as often as possible.

### Declaration

All lanes are declared inside Web Agents as fields annotated with `@SwimLane`. The parameter inside this annotation is the lane's **laneUri**. Recall that every Web Agent has a universal, logical address known as its **nodeUri**; `laneUri`s are simply the equivalent counterpart for lanes.

The following declaration is sufficient to make the `data` lane of every `UnitAgent` addressable by the laneUri `"data"`:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.DemandLane;

public class UnitAgent extends AbstractAgent { 
  @SwimLane("data")
  DemandLane<String> data;
}
```

Internally, lanes are always backed by `swim.structure.Value`s, regardless of their parametrized types. Under the hood, lanes use **forms** to handle any necessary conversions, allowing users to treat lanes as properly parametrized data types provided that a form for that data type exists. Even custom Java classes can be lane types, provided that forms for those classes exist. We will further discuss this topic in a more advanced cookbook.

### Instantiation and `onCue()`

The `AbstractAgent` class comes with utility methods to construct runnable lanes. Recall, however, that developers rarely instantiate Web Agents by explicitly invoking their constructors. The recommended pattern for adding a demand lane to an Agent is instead to:

- Exclude constructors entirely from Web Agents
- Use the `demandLane()` method to instantiate the lane; note that this is a parametrized method
- Through a builder pattern, override the lane's `onCue()` method
- Make the underlying value lane cue the demand lane in it's `didSet()` method (see next section for more)

This **onCue()** lifecycle callback is executed every time **cue()** is called against the lane.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.DemandLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("data")
  DemandLane<String> data = this.<String>demandLane().onCue(uplink -> {
    return "Number:" + Math.random();
  });
}
```

**CAUTION:** If you have multiple lanes within an Agent type, ensure that their laneUris are not identical. Suppose we declare two different value lanes within our `UnitAgent` with laneUri `"info"`; how does the Swim runtime know which one to set? That said, reusing laneUris **across** Agent types is perfectly acceptable, as requests corresponding to these are guaranteed to have different nodeUris.

### Linking to Value Lane and `cue()`

Demand lanes are backed by a **value lane** so that when a value is set, the demand lane will process or decode the data, only if an uplink is subscribed. We can implement this by making the value lane's `didSet()` callback `cue()` the demand lane. In the following example, the demand lane `data` is backed by the value lane `raw`, and will fetch from it on demand:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.DemandLane;
import swim.api.lane.ValueLane;

import java.util.Base64;

public class UnitAgent extends AbstractAgent {

  @SwimLane("raw")
  ValueLane<String> raw = this.<String>valueLane().didSet((n, o) -> this.data.cue());

  @SwimLane("data")
  DemandLane<String> data = this.<String>demandLane().onCue(uplink -> decodeRaw());

  // Transform raw data to the desired format
  private String decodeRaw() {
    final String encoded = this.raw.get();
    if (encoded == null) return "";
    final String decoded = new String(Base64.getDecoder().decode(encoded.getBytes()));
    System.out.println(nodeUri() + ": Decoded raw data to: "+ decoded);
    return decoded;
  }
}
```

As shown in the example, the demand lane allows us to only decode data when it is needed, reducing the memory footprint of agents.

### Reading from Demand Lanes

There are two ways to read data from demand lanes, both of which require opening a downlink.

The simpler approach is to simply call `get()` on the downlink to read its value at the time of the invocation.

The far more powerful approach uses the fact that value downlinks *also* have access to `didSet()`. This enables an event-driven style of programming where client programs are treated as completely in sync with the server. And, excluding network latency and backpressure regulation of network packets, they basically are.

The following is an example of how the Swim client would create a downlink to the `data` demand lane we created in the previous code snippet:

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.ValueDownlink;
import swim.client.ClientRuntime;
import swim.structure.Form;

public class CustomClient {

  public static void main(String[] args) {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();

    final String hostUri = "warp://localhost:9001";

    final ValueDownlink<String> dataDownlnink =
      swimClient.downlinkValue()
        .valueForm(Form.forString())
        .hostUri(hostUri)
        .nodeUri("/unit").laneUri("data")
        .didSet((n, o) -> System.out.println("data updated from '" + o + "' to '" + n + "'"))
        .open();
  }
}
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/demand_value_lanes).

