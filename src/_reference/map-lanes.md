---
title: Map Lanes
layout: page
description: "Define persistent collection properties of Web Agents, and consistently stream real-time updates and removes."
redirect_from:
  - /tutorials/map-lanes/
cookbook: https://github.com/swimos/cookbook/tree/master/map_lanes
---

In the [Web Agents guide]({% link _reference/web-agents.md %}), we describe a distributed object model where **Web Agents** are the **objects**. The **fields** in this model are called **lanes**.

Lanes come in many flavors, but every lane type exposes:

- A **means to act** on the lane
- Customizable **lifecycle callbacks** that execute during the runtime of the action
- Various means to **strongly type** (i.e. **parametrize**) the lane
- Universal WARP **subscriptions** to the lane

A **map lane** stores a **keyed collection** of values, is sorted by key, and still meets these requirements:

- Every map lane can have key, value pairs **put** into it and **remove**d from it. Additionally, several pairs can be **drop**ped at once
- Doing so will trigger its **didUpdate()**, **didRemove()**, and **didDrop()** callbacks, respectively
- The parameters on a map lane indicate the types of its keys and values
- Map lane state and lifecycle can be subscribed to via both **map downlinks** and general-purpose **event downlinks**

### Declaration

All lanes are declared inside Web Agents as fields annotated with `@SwimLane`. The parameter inside this annotation is the lane's **laneUri**. Recall that every Web Agent has a universal, logical address known as its **nodeUri**; `laneUri`s are simply the equivalent counterpart for lanes.

The following declaration is sufficient to make the `shoppingCart` lane of every `UnitAgent` addressable by the `laneUri` `"shoppingCart"`:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.MapLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("shoppingCart")
  MapLane<String, Integer> shoppingCart;
}
```

Internally, lanes are always backed by `swim.structure.Value`s, regardless of their parametrized types. Under the hood, lanes use `swim.structure.Form`s to handle any necessary conversions, allowing users to treat lanes as properly parametrized data types provided that a form for that data type exists. Even custom Java classes can be lane types, provided that forms for those classes exist. We will further discuss this topic in a more advanced cookbook.

<!-- Further reading: <a href="/reference/universal-addressability">Universal Addressability</a>, <a href="/reference/structures">Structures</a>
-->

### Instantiation and Callbacks

The `AbstractAgent` class comes with utility methods to construct runnable lanes. Recall, however, that developers rarely instantiate Web Agents by explicitly invoking their constructors. The recommended pattern for adding a map lane to an Agent is instead to:

- Exclude constructors entirely from Web Agents
- Use the `mapLane()` method to instantiate the lane; note that this is a parametrized method
- Through a builder pattern, override any of the lane's desired lifecycle callback methods:
  - `void didUpdate(K key, V newValue, V oldValue)`: executed every time a key, value pair is placed in the lane
  - `void didRemove(K key, V oldValue)`: executed every time a key is removed from the lane
  - `void didDrop(int dropCount)`: executed every time `drop()` is invoked on the lane
    
Should you define a constructor for your web agent, you must explicitly provide a default constructor and handle the initialization of all member variables declared by your Web Agent. However, it is not recommended to define any constructors. There is a `didStart()` lifecycle method that allows you to do post-initialization processing.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.MapLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("shoppingCart")
  MapLane<String, Integer> shoppingCart = this.<String, Integer>mapLane()
      .didUpdate((key, newValue, oldValue) -> {
        logMessage(key + " count changed to " + newValue + " from " + oldValue);
      });

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

{% include alert.html title='Caution' text='If you have multiple lanes within an agent type, ensure that their <strong>laneUri</strong>s are not identical. Suppose we declare two different value lanes within our <strong>UnitAgent</strong> with laneUri <strong>"info"</strong>. How will the Swim runtime know which one to set? That said, reusing <strong>laneUri</strong>s **across** Agent types is perfectly acceptable, as requests corresponding to these are guaranteed to have different <strong>nodeUri</strong>s.' %}

### External Addressability

Lanes are Swim server endpoints; therefore, external processes must be able to access them directly. Just like accessing the `foo` field of an object `obj` in object-oriented paradigms requires both `obj` and `foo` in some way (e.g. `obj.foo`), addressing a lane requires both the `laneUri` and the `nodeUri` of its enclosing agent. Additionally, if the request comes from a different Swim runtime from where the target lane lives (i.e. an entirely different plane or a Swim client instance), then the request must also identify the **hostUri** on which the Swim server is running.

Unlike with `command()` for command lanes, there is no general-purpose Swim API **method** to talk to map lanes (it's still possible, but we'll get to that in a bit). However, all lanes **within** an agent can directly reference each other in their callback functions. So, one common way to write to a map lane is to create a separate command lane whose `onCommand()` callback acts as a proxy:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("shoppingCart")
  MapLane<String, Integer> shoppingCart = this.<String, Integer>mapLane()
      .didUpdate((key, newValue, oldValue) -> {
        logMessage(key + " count changed to " + newValue + " from " + oldValue);
      });

  @SwimLane("addItem")
  CommandLane<String> publish = this.<String>commandLane()
      .onCommand(msg -> {
        final int n = this.shoppingCart.getOrDefault(msg, 0) + 1;
        this.shoppingCart.put(msg, n);
      });

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

Direct communication with value lanes is instead accomplished through **downlinks**. Downlinks are WARP subscriptions to lanes. They come in many flavors, but subscriptions to map lanes can only be accomplished through **map downlinks** and, to a more limited extent, **event downlinks**.

Further reading: [Command Lanes]({% link _reference/command-lanes.md %}), [Downlinks]({% link _reference/downlinks.md %})

### Writing to Map Lanes

Map downlinks can be instantiated using the `downlinkMap()` method from any Swim handle, as long as the desired hostUri (optional if the target lane is within the same Swim handle), nodeUri, and laneUri are known in advance. Once a map downlink is initialized, `put()`, `remove()`, and `drop()` can be directly invoked on it, as if it were the underlying lane itself.

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.MapDownlink;
import swim.client.ClientRuntime;
import swim.structure.Form;
import swim.structure.Text;
import swim.structure.Value;

class CustomClient {
  public static void main(String[] args) throws InterruptedException {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final String hostUri = "warp://localhost:9001";
    final String nodeUri = "/unit/master";
    swimClient.command(hostUri, nodeUri, "WAKEUP", Value.absent());
    // Send using either the proxy command lane...
    swimClient.command(hostUri, nodeUri, "addItem", Text.from("FromClientCommand"));
    // ...or a downlink put()
    final MapDownlink<String, Integer> link = swimClient.downlinkMap()
        .keyForm(Form.forString()).valueForm(Form.forInteger())
        .hostUri(hostUri).nodeUri(nodeUri).laneUri("shoppingCart")
        .open();
    link.put("FromClientLink", 25);
    link.remove("FromClientLink");

    System.out.println("Will shut down client in 2 seconds");
    Thread.sleep(2000);
    swimClient.stop();
  }
}
```

### Reading from Map Lanes

There are two ways to read data from map lanes, both of which require opening a downlink.

The simpler approach is to simply call `get(K key)` on the downlink to read its value at `key` at the time of the invocation.

The far more powerful approach uses the fact that map downlinks **also** have access to `didUpdate()`. This enables an event-driven style of programming where client programs are treated as completely in sync with the server. And, excluding network latency and backpressure regulation of network packets, they basically are.

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.MapDownlink;
import swim.client.ClientRuntime;
import swim.structure.Form;
import swim.structure.Text;
import swim.structure.Value;

class CustomClient {
  public static void main(String[] args) throws InterruptedException {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final String hostUri = "warp://localhost:9001";
    final String nodeUri = "/unit/master";
    swimClient.command(hostUri, nodeUri, "WAKEUP", Value.absent());
    final MapDownlink<String, Integer> link = swimClient.downlinkMap()
        .keyForm(Form.forString()).valueForm(Form.forInteger())
        .hostUri(hostUri).nodeUri(nodeUri).laneUri("shoppingCart")
        .didUpdate((key, newValue, oldValue) -> {
          System.out.println("link watched " + key + " change to " + newValue + " from " + oldValue);
        })
        .open();
    // Send using either the proxy command lane...
    swimClient.command(hostUri, nodeUri, "addItem", Text.from("FromClientCommand"));
    // ...or a downlink put()
    link.put("FromClientLink", 25);
    link.remove("FromClientLink");

    System.out.println("Will shut down client in 2 seconds");
    Thread.sleep(2000);
    swimClient.stop();
  }
}
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/map_lanes).

