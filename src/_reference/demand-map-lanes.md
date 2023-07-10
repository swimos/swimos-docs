---
title: Demand Map Lanes
layout: page
description: "Define persistent collection properties of Web Agents, and lazily generate events on state changes."
redirect_from:
  - /tutorials/demand-map-lanes/
---

In a [previous tutorial]({% link _reference/web-agents.md %}), we began to describe a distributed object model where **Web Agents** are the **objects**. The **fields** in this model are called **lanes**.

Lanes come in many flavors, but every lane type exposes:

- A **means to act** on this lane
- Customizable **lifecycle callbacks** that execute during the runtime of this action
- Various means to **strongly type** (i.e. *parametrize*) the lane
- Universal WARP **subscriptions** to this lane

A **demand map lane** does not store a collection, instead they are backed by a [map lane]({% link _reference/map-lanes.md %}) and retrieve values purely on demand. Demand map lanes **lazily** generate events for the map lane, only when there is an uplink ready to receive the event. The lane meets these requirements:

- Every demand map lane can be **cue(key)**-ed, signalling there is an event to be sent, for given key, to the uplinks, if ready. This is done in the map lane's `didUpdate()` method
- Doing so will trigger its **onCue(key)** callback
- The parameters on a demand map lane indicate the types of its keys and values it fetches
- Demand map lane state and lifecycle can be subscribed to via both **map downlinks** and general-purpose **event downlinks**

Demand map lanes can be cue()-ed at extremely high rates, and only as many events will be generated as each uplink can handle; the rate of event generation is tailored per uplink.

Demand map lanes are ideal for publishing statistical events, where it isn't important that a client receives every incremental update, only that the client eventually receives the latest state, that the state clients receive is real-time (within the latency of the network), and that updates are desired as often as possible.

### Declaration

All lanes are declared inside Web Agents as fields annotated with `@SwimLane`. The parameter inside this annotation is the lane's **laneUri**. Recall that every Web Agent has a universal, logical address known as its **nodeUri**; `laneUri`s are simply the equivalent counterpart for lanes.

The following declaration is sufficient to make the `data` lane of every `UnitAgent` addressable by the laneUri `"data"`:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.DemandMapLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("data")
  DemandMapLane<String, String> data;
}
```

Internally, lanes are always backed by `swim.structure.Value`s, regardless of their parametrized types. Under the hood, lanes use **forms** to handle any necessary conversions, allowing users to treat lanes as properly parametrized data types provided that a form for that data type exists. Even custom Java classes can be lane types, provided that forms for those classes exist. We will further discuss this topic in a more advanced cookbook.

### Instantiation and `onCue()`

The `AbstractAgent` class comes with utility methods to construct runnable lanes. Recall, however, that developers rarely instantiate Web Agents by explicitly invoking their constructors. The recommended pattern for adding a demand map lane to an Agent is instead to:

- Exclude constructors entirely from Web Agents
- Use the `demandMapLane()` method to instantiate the lane; note that this is a parametrized method
- Through a builder pattern, override the lane's `onCue()` and `onSync()` methods
- Make the underlying map lane, cue the demand map lane in it's `didUpdate()` method (see next section for more)

This **onCue(K key)** lifecycle callback is executed every time **cue(K key)** is called against the lane.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.DemandMapLane;

public class UnitAgent extends AbstractAgent {

  @SwimLane("data")
  protected DemandMapLane<String, String> data = this.<String, String>demandMapLane()
      .onCue((key, uplink) -> {
        return "Number:" + Math.random();
      })
      .onSync(uplink -> {
        return Collections.emptyIterator();
      });
}
```

**CAUTION:** If you have multiple lanes within an Agent type, ensure that their laneUris are not identical. Suppose we declare two different value lanes within our `UnitAgent` with laneUri `"info"`; how does the Swim runtime know which one to set? That said, reusing laneUris **across** Agent types is perfectly acceptable, as requests corresponding to these are guaranteed to have different nodeUris.

### Linking to Map Lane and `cue(K key)`

Demand map lanes are backed by a **map lane** so that when a key value pair is updated, the demand map lane will process or decode the data, only if an uplink is subscribed. We can implement this by making the map lane's `didUpdate()` callback `cue()` the demand map lane. In the following example, the demand map lane `data` is backed by the the map lane `raw`, and will fetch from it on demand:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.DemandMapLane;
import swim.api.lane.MapLane;

import java.util.Base64;

public class UnitAgent extends AbstractAgent {

  @SwimLane("raw")
  protected MapLane<String, String> raw = this.<String, String>mapLane()
    .didUpdate((key, newValue, oldValue) -> this.data.cue(key));

  @SwimLane("data")
  protected DemandMapLane<String, String> data = this.<String, String>demandMapLane()
    .onCue((key, uplink) -> decodeRaw(key))
    .onSync(uplink -> this.raw.keyIterator());

  private String decodeRaw(String key) {
    final String encoded = this.raw.get(key);
    if (encoded == null) return "";
    final String decoded = new String(Base64.getDecoder().decode(encoded.getBytes()));
    System.out.println(nodeUri() + ": Decoded raw data to: "+ decoded);
    return decoded;
  }
}
```

As shown in the example, the demand map lane allows us to only decode data when it is needed, reducing the memory footprint of agents.

### Reading from Demand Map Lanes

There are two ways to read data from demand map lanes, both of which require opening a downlink.

The simpler approach is to simply call `get(K key)` on the downlink to read its value at `key` at the time of the invocation.

The far more powerful approach uses the fact that map downlinks **also** have access to `didUpdate()`. This enables an event-driven style of programming where client programs are treated as completely in sync with the server. And, excluding network latency and backpressure regulation of network packets, they basically are.

The following is an example of how the Swim client would create a downlink to the `data` demand map lane we created in the previous code snippet:

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.MapDownlink;
import swim.client.ClientRuntime;
import swim.structure.Form;

public class CustomClient {

  public static void main(String[] args) {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();

    final String hostUri = "warp://localhost:9001";

    final MapDownlink<String, String> dataDownlink =
        swimClient.downlinkMap()
          .keyForm(Form.forString()).valueForm(Form.forString())
          .hostUri(hostUri)
          .nodeUri("/unit").laneUri("data?name=bar")
          .didUpdate((key, newValue, oldValue) -> {
            System.out.println("data updated entry " + key + " : '" + newValue + "'");
          }).open();
    }
}
```

### Filtering Events by Key

We can also restrict the keys for which an uplink will receive events for by changing the subscription request to use query strings.

Modifying the previous example, adding a query string `name` in the `laneUri` of the client's downlink request will allow the server to filter events:

```java
// swim/basic/CustomClient.java
final MapDownlink<String, String> dataDownlink =
    swimClient.downlinkMap()
        .keyForm(Form.forString()).valueForm(Form.forString())
        .hostUri(hostUri)
        .nodeUri("/unit").laneUri("data?**name=bar**")
        .didUpdate((key, newValue, oldValue) -> {
            System.out.println("data updated entry " + key + " : '" + newValue + "'");
        }).open();
```

Server side, we can now query the `laneUri` of the uplink passed to `onCue` and `onSync` and only return events where the key matches:

```java
// swim/basic/UnitAgent.java
@SwimLane("data")
protected DemandMapLane<String, String> data = this.<String, String>demandMapLane()
    .onCue((key, uplink) -> {
        final String name = uplink.laneUri().query().get("name");
        return (key.equals(name)) ? decodeRaw(key) : null;
    })
    .onSync(uplink -> {
        final String name = uplink.laneUri().query().get("name");
        return (this.raw.containsKey(name)) ? 
            Collections.singletonList(name).iterator() : Collections.emptyIterator();
    });
```

### Try It Yourself
  
A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/demand_map_lanes).
