---
title: Command Lanes
short-title: Command Lanes
description: "Remotely command Web Agents to take action, and observe the actions taken by others."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/command_lanes
redirect_from:
  - /tutorials/command-lanes/
  - /reference/command-lanes.html
---

In the [Web Agents guide]({% link _backend/web-agents.md %}), we describe a distributed object model where **Web Agents** are the **objects**. The **fields** in this model are called **lanes**.

Lanes come in many flavors, but every lane type exposes:

- A **means to act** on this lane
- Customizable **lifecycle callbacks** that execute during the runtime of this action
- Various means to **strongly type** (i.e. **parametrize**) the lane
- Universal WARP **subscriptions** to this lane
  
A **command lane** is the simplest type of lane, that meets the following requirements:

- Every command lane can be **commanded** with a message
- Doing so will trigger its **onCommand()** lifecycle callback
- The parameter on a command lane indicates the type of the message with which it is commanded
- Even though command lanes do not directly store any values, their updates can still be subscribed to via an **event downlink**

## Declaration

All lanes are declared inside Web Agents as fields annotated with `@SwimLane`. The parameter inside this annotation is the lane's **laneUri**. Recall that every Web Agent has a universal, logical address known as its **nodeUri**; laneUris are simply the equivalent counterparts for lanes.

The following declaration is sufficient to make the `publish` lane of every `UnitAgent` addressable by the laneUri `"publish"`:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;

public class UnitAgent extends AbstractAgent {
  @SwimLane("publish")
  CommandLane<Integer>; publish;
}
```

Internally, lanes are always backed by `swim.structure.Value`s, regardless of their parametrized types. Under the hood, lanes use **forms** to handle any necessary conversions, allowing users to treat lanes as properly parametrized data types provided that a form for that data type exists. Even custom Java classes can be lane types, provided that forms for those classes exist. We will further discuss this topic in a more advanced cookbook.

<!--Further reading: <a href="/reference/universal-addressability">Universal Addressability</a>, <a href="/reference/structures">Structures</a>
-->

### Instantiation and `onCommand()`

The `AbstractAgent` class comes with utility methods to construct lanes and make them accessible by the Swim runtime. Recall, however, that developers rarely instantiate Web Agents by explicitly invoking their constructors. The recommended pattern for adding a command lane to an Agent is to:


- Exclude constructors entirely from Web Agents
- Use the `commandLane()` method to instantiate the lane; note that this is a parametrized method
- Through a builder pattern, override the lane's `void onCommand(V value)` method

This **onCommand()** lifecycle callback is executed every time its lane is commanded with some value, and it has access to the value with which it was commanded.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.recon.Recon;
import swim.structure.Value;

public class UnitAgent extends AbstractAgent {

  @SwimLane("publish")
  CommandLane<Integer> publish = this.<Integer>commandLane()
      .onCommand((Integer msg) -> {
        logMessage("'publish' commanded with " + msg);
      });

  @SwimLane("publishValue")
  CommandLane<Value> publishV = this.<Value>commandLane()
      .onCommand((Value msg) -> {
        logMessage("'publishValue' commanded with " + Recon.toString(msg));
      });

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

### External Addressability and `command()`

Lanes are Swim server endpoints; therefore, external processes must be able to access them directly. Just like accessing the `foo` field of an object `obj` in object-oriented paradigms requires both `obj` and `foo` in some way (e.g. `obj.foo`), addressing a lane requires both its laneUri and the nodeUri of its enclosing agent. Additionally, if the request comes from a different Swim runtime from where the target lane lives (i.e. an entirely different plane or a Swim client instance), then the request must also identify the **hostUri** on which the Swim server is running.

To demonstrate, let's modify the behavior of our `"publish"` lane to itself relay commands to `"publishValue"`:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.recon.Recon;
import swim.structure.Record;
import swim.structure.Value;
import swim.uri.Uri;

public class UnitAgent extends AbstractAgent {

  @SwimLane("publish")
  CommandLane<Integer> publish = this.<Integer>commandLane()
      .onCommand((Integer msg) -> {
        logMessage("`publish` commanded with " + msg);
        final Value updatedMsg = Record.create(1).slot("fromServer", msg);
        // command() "updatedMsg" TO
        // the "publishValue" lane OF
        // the agent addressable by "nodeUri()" RUNNING ON
        // this plane (indicated by no hostUri argument)
        command(nodeUri(), Uri.parse(&quotpublishValue&quot), updatedMsg);
      });

  @SwimLane("publishValue")
  CommandLane<Value> publishV = this.<Value>commandLane()
      .onCommand((Value msg) -> {
        logMessage("'publishValue' commanded with " + Recon.toString(msg));
      });

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

And, in a separate process, command `"publish"` from a different Swim handle (a Swim client is easiest):

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.client.ClientRuntime;
import swim.structure.Num;
import swim.structure.Value;

class CustomClient {
  public static void main(String[] args) throws InterruptedException {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final Value msg = Num.from(9035768);
    // command "msg" TO
    // the "publish" lane OF
    // the agent addressable by "/unit/master" RUNNING ON
    // the plane with hostUri "warp://localhost:9001"
    swimClient.command("warp://localhost:9001", "/unit/master", "publish", msg);

    System.out.println("Will shut down client in 2 seconds");
    Thread.sleep(2000);
    swimClient.stop();
  }
}
```

{% include callout-warning.html title='Caution' text='If you have multiple lanes within an Agent type, ensure that their laneUris are not identical. Suppose we declare two different command lanes within our <strong>UnitAgent</strong> with laneUri <strong>"takeAction"</strong>; how would the Swim runtime know which one to message? That said, reusing laneUris <strong>across</strong> Agent types is perfectly acceptable, as requests corresponding to these are guaranteed to have different nodeUris.' %}

Note that the `command()` signature only allows for `swim.structure.Value` payloads. Lanes internally use *forms* to handle any necessary conversions, allowing users to treat lanes as properly parametrized data types, provided that a form for that data type exists. Even a custom Java class can be a lane type, provided that a form for that class exists. We will further discuss this topic in a more advanced cookbook.

<!--Further reading: <a href="/reference/universal-addressability">Universal Addressability</a>, <a href="/reference/planes">Planes</a> <a href="/reference/structures">Structures</a>
-->

### Subscription

Downlinks are WARP subscriptions to lanes. They come in many flavors, but subscriptions to command lanes can only be achieved via **event downlinks**.

Downlinks can be instantiated within any Swim handle. Just like command messages, the desired hostUri (unless the lane is within the same Swim handle), nodeUri, and laneUri must be identified in advance. Let's enhance `CustomClient` logic to watch the effects of our command messages:

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.EventDownlink;
import swim.client.ClientRuntime;
import swim.structure.Num;
import swim.structure.Value;

class CustomClient {
  public static void main(String[] args) throws InterruptedException {
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();

    final String hostUri = "warp://localhost:9001";
    final String nodeUri = "/unit/master";
    swimClient.command(hostUri, nodeUri, "WAKEUP", Value.absent());

    final EventDownlink<Value> link = swimClient.downlink()
        .hostUri(hostUri).nodeUri(nodeUri).laneUri("publishValue")
        .onEvent(event -> {
          System.out.println("link received event: " + event);
        })
        .open();
    final Value msg = Num.from(9035768);
    // command() "msg" TO
    // the "publish" lane OF
    // the agent addressable by "/unit/master" RUNNING ON
    // the plane with hostUri "warp://localhost:9001"
    swimClient.command(hostUri, nodeUri, "publish", msg);

    System.out.println("Will shut down client in 2 seconds");
    Thread.sleep(2000);
    swimClient.stop();
  }
}
```

Further reading: [Downlinks]({% link _backend/downlinks.md %})

## Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/command_lanes).
