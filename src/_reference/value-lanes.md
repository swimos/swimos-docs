---
title: Value Lanes
layout: page
---

In a [previous tutorial](/reference/web-agents), we began to describe a distributed object model where **Web Agents** are the **objects**. The **fields** in this model are called **lanes**.

Lanes come in many flavors, but every lane type exposes:

- A **means to act** on this lane
- Customizable **lifecycle callbacks** that execute during the runtime of this action
- Various means to **strongly type** (i.e. *parametrize*) the lane
- Universal WARP **subscriptions** to this lane

A **value lane** stores a **scalar** value and still meets these requirements:

- Every value lane can be **set** with a value
- Doing so will trigger its **didSet()** callback
- The parameter on a value lane indicates the type of value that it stores
- Value lane state and lifecycle can be subscribed to via both **value downlinks** and general-purpose **event downlinks**

### Declaration

All lanes are declared inside Web Agents as fields annotated with `@SwimLane`. The parameter inside this annotation is the lane's **laneUri**. Recall that every Web Agent has a universal, logical address known as its **nodeUri**; laneUris are simply the equivalent counterpart for lanes.
The following declaration is sufficient to make the `info` lane of every `UnitAgent` addressable by the laneUri `"info"`:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.ValueLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("info")
  ValueLane<String> info;
}
```

Internally, lanes are always backed by `swim.structure.Value`s, regardless of their parametrized types. Under the hood, lanes use **forms** to handle any necessary conversions, allowing users to treat lanes as properly parametrized data types provided that a form for that data type exists. Even custom Java classes can be lane types, provided that forms for those classes exist. We will further discuss this topic in a more advanced cookbook.

<!-- Further reading: <a href="/reference/universal-addressability">Universal Addressability</a>, <a href="/reference/structures">Structures</a>
-->

### Instantiation and `didSet()`

The `AbstractAgent` class comes with utility methods to construct runnable lanes. Recall, however, that developers rarely instantiate Web Agents by explicitly invoking their constructors. The recommended pattern for adding a value lane to an Agent is instead to:

- Exclude constructors entirely from Web Agents
- Use the `valueLane()` method to instantiate the lane; note that this is a parametrized method
- Through a builder pattern, override the lane's `void didSet(V newValue, V oldValue)` method

This **didSet()** lifecycle callback is executed every time its lane is set to some value, and it has access to both the recently-updated value and its immediately prior one.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.ValueLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("info")
  ValueLane<String> info = this.<String>valueLane()
      .didSet((newValue, oldValue) -> {
        logMessage("`info` set to " + newValue + " from " + oldValue);
      });

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

**CAUTION:** If you have multiple lanes within an Agent type, ensure that their laneUris are not identical. Suppose we declare two different value lanes within our `UnitAgent` with laneUri `"info"`; how does the Swim runtime know which one to set? That said, reusing laneUris **across** Agent types is perfectly acceptable, as requests corresponding to these are guaranteed to have different nodeUris.

### External Addressability

Lanes are Swim server endpoints; therefore, external processes must be able to access them directly. Just like to accessing the `foo` field of an object `obj` in object-oriented paradigms requires both `obj` and `foo` in some way (e.g. `obj.foo`), addressing a lane requires both its laneUri and the nodeUri of its enclosing agent. Additionally, if the request comes from a different Swim runtime from where the target lane lives (i.e. an entirely different plane or a Swim client instance), then the request must also identify the **hostUri** on which the Swim server is running.

Unlike with `command()` for command lanes, there is no general-purpose Swim API **method** to talk to value lanes (it's still possible, but we'll get to that in a bit). However, all lanes **within** an agent can directly reference each other in their callback functions. So, one common way to write to a value lane is to create a separate command lane whose `onCommand()` callback acts as a proxy:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("info")
  ValueLane<String> info = this.<String>valueLane()
      .didSet((newValue, oldValue) -> {
        logMessage("'info' set to '" + newValue + "' from '" + oldValue + "'");
      });

  @SwimLane("publishInfo")
  CommandLane<String> publishInfo = this.<String>commandLane()
      .onCommand(msg -> {
        this.info.set("from publishInfo: " + msg);
      });

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

Direct communication with value lanes is instead accomplished through **downlinks**. Downlinks are WARP subscriptions to lanes. They come in many flavors, but subscriptions to value lanes can only be accomplished through **value downlinks** and, to a more limited extent, **event downlinks**.

Further reading: [Command Lanes](/reference/command-lanes), [Downlinks](/reference/downlinks)

### Writing to Value Lanes

Value downlinks can be instantiated using the `downlinkValue()` method from any Swim handle, as long as the desired hostUri (optional if the target lane is within the same Swim handle), nodeUri, and laneUri are known in advance. Once a value downlink is initialized, `set()` can be directly invoked on it, as if it were the underlying lane itself.

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.ValueDownlink;
import swim.client.ClientRuntime;
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
    swimClient.command(hostUri, nodeUri, "publishInfo", Text.from("Hello from command, world!"));
    // ...or a downlink set()
    final ValueDownlink<Value> link = swimClient.downlinkValue()
        .hostUri(hostUri).nodeUri(nodeUri).laneUri("info")
        .open();
    link.set(Text.from("Hello from link, world!"));

    System.out.println("Will shut down client in 2 seconds");
    Thread.sleep(2000);
    swimClient.stop();
  }
}
```

### Reading from Value Lanes

There are two ways to read data from value lanes, both of which require opening a downlink.
The simpler approach is to simply call `get()` on the downlink to read its value at the time of the invocation.
The far more powerful approach uses the fact that value downlinks *also* have access to `didSet()`. This enables an event-driven style of programming where client programs are treated as completely in sync with the server. And, excluding network latency and backpressure regulation of network packets, they basically are.

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.ValueDownlink;
import swim.client.ClientRuntime;
import swim.structure.Text;
import swim.structure.Value;

class CustomClient {
  public static void main(String[] args) throws InterruptedException {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final String hostUri = "warp://localhost:9001";
    final String nodeUri = "/unit/master";
    swimClient.command(hostUri, nodeUri, "WAKEUP", Value.absent());
    // Link with a didSet() override
    final ValueDownlink<Value> link = swimClient.downlinkValue()
        .hostUri(hostUri).nodeUri(nodeUri).laneUri("info")
        .didSet((newValue, oldValue) -> {
          System.out.println("link watched info change to " + newValue + " from " + oldValue);
        })
        .open();
    // Send using either the proxy command lane...
    swimClient.command(hostUri, nodeUri, "publishInfo", Text.from("Hello from command, world!"));
    // ...or a downlink set()
    link.set(Text.from("Hello from link, world!"));
    System.out.println("synchronous link get: " + link.get());

    System.out.println("Will shut down client in 2 seconds");
    Thread.sleep(2000);
    swimClient.stop();
  }
}
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/value_lanes).
