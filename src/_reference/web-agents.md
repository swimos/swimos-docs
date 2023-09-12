---
title: Web Agents
layout: page
description: "Learn about declaring, defining and utilizing Web Agents and their properties using configuration files."
redirect_from:
  - /tutorials/web-agents/
cookbook: https://github.com/swimos/cookbook/tree/master/web_agents
---

In the [Web Agents guide]({% link _reference/web-agents.md %}), we describe a distributed object model where **Web Agents** are the **objects**. This guide explains an alternative way to declare web agents.

Swim servers utilize a general purpose distributed object model in which the objects are called **Web Agents**. Programming with this model feels like typical object-oriented programming with additional key innovations in addressability, statefulness, consistency, boundedness, and composability.

Although this analogy holds very well for the most part, there are two important catches:

- Methods, while still being able to define arbitrarily complicated logic, are not directly invoked. Instead, Web agents come with **lifecycle callback** functions that are called during specified stages of a Web Agent's lifetime
- Web Agent **instantiation** is not accomplished by invoking a constructor (at least from the programmer's perspective)

Don't worry if these points feel restrictive through this article; much finer control becomes available once we discuss **lanes** in subsequent recipes.

### Declaration

Just like with (instantiable) `class` declarations in Java, **Agent declarations** in Swim define the behavior for **instances** of those Agents.

To declare a Web Agent, simply define a node with URI in the server configuration file.

To declare a dynamic component, we prepend with a colon (:) for the agent id.Statically defined agents (illustrated in the code below using 'uri') are automatically instantiated by the corresponding Swim Plane.

Also note a property named "propString" with their respective values are defined for the agents.

```java
// /server.recon
basic: @fabric {
  @plane(class: "swim.basic.BasicPlane")
  // Static Component
  // Notice usage of 'uri' keyword for a static component.
  @node {
    uri: "/unit/foo"
    @agent(class: "swim.basic.UnitAgent") {
      propString: "fooProp"
    }
  }

  // Dynamic Component
  // Notice usage of 'pattern' keyword for a dynamic component. 
  @node {
    pattern: "/unit/:id"
    @agent(class: "swim.basic.UnitAgent") {
      propString: "defaultProp"
    }
  }
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

### External Addressability

Every Web Agent has a universal, logical address, in the form of a URI. The URI of a custom `PlanetAgent` might look something like `"/planet/Mercury"`. That of a singleton `SunAgent` might just look like `"/sun"`.

Each Web Agent is aware of its own URI, available via its `nodeUri()` method. Let's add a simple utility method to each `UnitAgent` to help us identify the Agent from which a logged message originated.


```java
# swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;

public class UnitAgent extends AbstractAgent {
  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

<!-- Further reading: <a href="/reference/universal-addressability">Universal Addressability</a>-->

### Instantiation and Agent Property

For an Agent to know its **own** identifier is only half of the problem. To address the other half, every Swim server runs a **plane** that manages the runtime of and provides a shared context for a group of Web Agents.

One of a plane's many responsibilities is to resolve Agent URIs for requests. To implement this functionality in your custom Agent class (that extends `swim.api.plane.AbstractPlane`), annotate a field for each Agent definition with a corresponding URI **pattern** (colons (:) indicates a dynamic components):

Statically defined agents (illustrated using 'uri' keyword) are automatically instantiated by the corresponding Swim Plane (as illustrated above).

```java
# swim/basic/BasicPlane.java
package swim.basic;

import swim.actor.ActorSpace;
import swim.api.plane.AbstractPlane;
import swim.api.plane.PlaneContext;
import swim.kernel.Kernel;
import swim.server.ServerLoader;
import swim.structure.Value;

public class BasicPlane extends AbstractPlane {
  final Kernel kernel = ServerLoader.loadServer();
  final ActorSpace space = (ActorSpace) kernel.getSpace("basic");
  final PlaneContext plane = (PlaneContext) kernel.getSpace("basic");

  kernel.start();
  System.out.println("Running Basic server...");
  kernel.run();

  // Dynamic Agent declared in configuration file.
  space.command("/unit/dynamic", "unusedForNow", Value.absent());
}
```

Agent Properties that are defined in the configuration file while declaring web agents can be fetched and processed via a custom class (that extends `swim.api.plane.AbstractPlane`). 

```java
# swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;
import swim.api.SwimLane;

public class UnitAgent extends AbstractAgent {
  @Override 
  public void didStart() {
    System.out.println(nodeUri() + " didStart region");
    prop();
    close();
  }

  @Override
  public void willStop() {
    logMessage("willStop");
  }

  // Fetch values of a property belonging to an agent.
  void prop() {
    final String stringVal = getProp("propString").stringValue(");
    logMessage("String Property '" + stringVal + "'");
  }
}
```

A Dynamic Web Agent is only instantiated when its `nodeUri` is invoked for the first time. With the code we have so far, we can instantiate any number of `UnitAgent`s by either defining them in the configuration file or by invoking URIs with the `"/unit/"` prefix. For example, if we invoke `"/unit/1"`, `"/unit/foo"`, and `"/unit/foo_1"`, three `UnitAgent`s will be instantiated, one for each URI.

{% include alert.html title='Caution' text='If you have multiple agent types within a plane, ensure that their URI patterns do not **clash**. This is a stricter requirement than saying that the patterns are <strong>identical</strong>; for example, <strong>"/unit/:id"</strong> and <strong>"/unit/:foo"</strong> clash. Suppose these same patterns annotated different agent types; how would a plane know which type of Agent to seek or instantiate for the request <strong>"/unit/1"</strong>?' %}

In addition to the `nodeUri()` method mentioned in the previous section, every Agent also has access to a `Value getProp(String prop)` convenience method. This returns a `swim.structure.Text` object containing the value of the dynamic `nodeUri` component with the name `prop`, `absent()` if it doesn't exist. For example, `getProp("id").stringValue()` will return either `"1"`, `"foo"`, or `"foo_1"`, depending on which of the above three agents we are currently running in. `getProp("foo")` will return `absent()`.

Further reading: [Planes]({% link _reference/planes.md %})

<!---, <a href="/reference/structures">Structures</a>-->

### Lifecycle Callbacks

Recall that Web Agent methods are not directly invoked. Instead, the Swim runtime schedules and executes callbacks stages of an Agent's lifecycle. For the most part, you will only care about two:

- `void didStart()`: executed once immediately after this Agent has started
- `void willStop()`: executed once immediately before this Agent will stop

```java
# swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;

public class UnitAgent extends AbstractAgent {
  @Override
  public void didStart() {
    logMessage("didStart");
    prop();
    close();
  }

  @Override
  public void willStop() {
    logMessage("willStop");
  }

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/web_agents).
