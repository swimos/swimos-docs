---
title: Planes
short-title: Planes
description: "Create vertically integrated, horizontally distributed Web Agent application bundles that can run almost anywhere."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/planes
redirect_from:
  - /rust/tutorials/planes/
  - /rust/reference/planes.html
---

In the [Web Agents guide]({% link _rust_backend/web-agents.md %}), we describe a distributed object model where **Web Agents** are the **objects** and **lanes** are **fields**. Swim **planes** can, loosely, be seen as a **shared context** for a group of Web Agents, somewhat analogous to **scopes** but with more runtime responsibilities.

More specifically, every plane:

- Routes messages, both within and from outside its containing process, to the correct Web Agents and lanes
- Has lifecycle callback functions that are overridable with custom logic
- Is itself a Swim handle and can therefore talk to any other Swim handle over WARP
- Can define security policies to control access to Swim data

### Declaration

Simply create a custom class that extends `swim.api.plane.AbstractPlane` to declare a plane:

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.plane.AbstractPlane;

public class BasicPlane extends AbstractPlane {
}
```

However, a typical pattern with Swim planes is to additionally solve the routing responsibility within the declaration. Much like lanes in a Web Agent are annotated with `@SwimLane`, each Agent type in a plane should be annotated with `@SwimRoute`. The argument inside the annotation defines a URI **pattern** (colons (:) indicate dynamic components). Requests that match this pattern are routed to an Agent of the provided type, with instantiations happening as necessary:

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.agent.AgentRoute;
import swim.api.SwimRoute;
import swim.api.plane.AbstractPlane;

public class BasicPlane extends AbstractPlane {
  @SwimRoute("/unit/:id")
  AgentRoute<UnitAgent> unitAgentType;
}
```

### Instantiation

Somewhat similarly to Web Agents, planes are not typically instantiated using their constructors. Planes don't make much sense outside a Swim server, so we will piggyback off server initialization itself to instantiate planes.

Recall that Swim servers can be loaded from a configuration file. Take note of how we define which plane this server will load:

```java
# /server.recon
basic: @fabric {
  @plane(class: "swim.basic.BasicPlane")
}

@web(port: 9001) {
  space: "basic"
  documentRoot: "./ui/"
  @websocket {
    serverCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
    clientCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
  }
}
```

Swim provides a utility class, `swim.loader.ServerLoader`, to facilitate the actual load step:

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.agent.AgentRoute;
import swim.api.SwimRoute;
import swim.api.plane.AbstractPlane;
import swim.kernel.Kernel;
import swim.server.ServerLoader;

public class BasicPlane extends AbstractPlane {
  @SwimRoute("/unit/:id")
  AgentRoute<UnitAgent> unitAgentType;

  // main() can be in any class, we picked this for convenience
  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    kernel.start();
    kernel.run();
  }
}
```

### Lifecycle Callbacks

Just like Web Agents and lanes, planes come with callback functions that are executed during various stages of their lifecycle, and the callbacks are overridable with custom logic. The two that you are most likely to care about are **didStart()** and **willStop()**, which work similarly to their Web Agent counterparts:

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.agent.AgentRoute;
import swim.api.SwimRoute;
import swim.api.plane.AbstractPlane;
import swim.structure.Value;
import swim.kernel.Kernel;
import swim.server.ServerLoader;


public class BasicPlane extends AbstractPlane {
  @SwimRoute("/unit/:id")
  AgentRoute<UnitAgent> unitAgentType;

  @Override
  public void didStart() {
    command("/unit/master", "WAKEUP", Value.absent());
  }

  @Override
  public void willStop() {
    System.out.println("Shutdown in progress...");
  }

  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    kernel.start();
    kernel.run();
  }
}
```

### Planes Are Swim Handles

In the previous snippet, we called `command()` from directly within our custom plane class. By themselves being Swim handles, planes have access to the Swim API.

Recall that a Swim server runs asynchronously relative to the main thread that started it, implying that the main thread is free to do work. We demonstrate here how one could use a plane (context) as a Swim handle. Note especially how a simple one-argument difference enables users to go through the network stack and talk to a remote process (we resolve to the same one here to avoid forcing you to start a new process):

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.agent.AgentRoute;
import swim.api.SwimRoute;
import swim.api.plane.AbstractPlane;
import swim.structure.Value;
import swim.fabric.Fabric;
import swim.structure.Text;
import swim.kernel.Kernel;
import swim.server.ServerLoader;

public class BasicPlane extends AbstractPlane {
  @SwimRoute("/unit/:id")
  AgentRoute<UnitAgent> unitAgentType;

  @Override
  public void didStart() {
    command("/unit/master", "WAKEUP", Value.absent());
  }

  @Override
  public void willStop() {
    System.out.println("Shutdown in progress...");
  }

  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    kernel.start();
    final Fabric fabric = (Fabric) kernel.getSpace("basic");
    kernel.run();
    // observe the effects of our commands
    fabric.downlinkValue()
      .nodeUri("/unit/master")
      .laneUri("info")
      .didSet((newValue, oldValue) -> {
        System.out.println("observed info change to " + newValue + " from " + oldValue);
      })
      .open();
    fabric.command("/unit/master", "publishInfo", Text.from("Without network"));
    fabric.command("warp://localhost:9001", "/unit/master", "publishInfo", Text.from("With network, no token"));
    fabric.command("warp://localhost:9001?token=abcd", "/unit/master", "publishInfo", Text.from("With network, no token"));
  }
}
```

### Security Policies

Security policies can be defined to control client access to a plane. Simply define a custom policy, then inject it into your custom plane upon its initialization.

We will go into more detail about security policies in a later section. In the meantime, the snippet is how one would enhance our custom plane to only accept requests containing the right token as a URL parameter. While not a best practice, it demonstrates the general pattern for injecting policies into planes:

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.agent.AgentRoute;
import swim.api.auth.Identity;
import swim.api.SwimRoute;
import swim.api.plane.AbstractPlane;
import swim.api.policy.AbstractPolicy;
import swim.api.policy.PolicyDirective;
import swim.fabric.Fabric;
import swim.kernel.Kernel;
import swim.server.ServerLoader;
import swim.structure.Text;
import swim.structure.Value;
import swim.warp.Envelope;

public class BasicPlane extends AbstractPlane {
  // Define policy; doesn't have to be an inner class
  class BasicPolicy extends AbstractPolicy {
    @Override
    protected <T> PolicyDirective<T> authorize(Envelope envelope, Identity identity) {
      if (identity != null) {
        final String token = identity.requestUri().query().get("token");
        if ("abcd".equals(token)) {
          return allow();
        }
      }
      return forbid();
    }
  }

  @SwimRoute("/unit/:id")
  AgentRoute<UnitAgent> unitAgentType;

  // Inject policy. Swim internally calls the no-argument constructor, which retains
  // its implicit call to super() in Java
  public BasicPlane() {
    context.setPolicy(new BasicPolicy());
  }

  @Override
  public void didStart() {
    command("/unit/master", "WAKEUP", Value.absent());
  }

  @Override
  public void willStop() {
    System.out.println("Shutdown in progress...");
  }

  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    kernel.start();
    final Fabric fabric = (Fabric) kernel.getSpace("basic");
    kernel.run();
    // observe the effects of our commands
    fabric.downlinkValue()
      .nodeUri("/unit/master")
      .laneUri("info")
      .didSet((newValue, oldValue) -> {
        System.out.println("observed info change to " + newValue + " from " + oldValue);
      })
      .open();
    // Swim handles don't reject their own messages, regardless of policy
    fabric.command("/unit/master", "publishInfo", Text.from("Without network"));
    // Network events without tokens get rejected
    fabric.command("warp://localhost:9001", "/unit/master", "publishInfo", Text.from("With network, no token"));
    // Network events with the right token are accepted
    fabric.command("warp://localhost:9001?token=abcd", "/unit/master", "publishInfo", Text.from("With network, token"));
  }
}
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/planes).
