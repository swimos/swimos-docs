---
title: Web Agents
layout: page
description: "Learn about declaring, defining and utilizing Web Agents and their properties using configuration files."
redirect_from:
  - /tutorials/web-agents/
cookbook: https://github.com/swimos/cookbook/tree/master/web_agents
---

Swim servers utilize a general purpose distributed object model in which the objects are called **Web Agents**. 
Programming with this model feels like typical object-oriented programming with additional key innovations in addressability, statefulness, consistency, boundedness, and composability.

Although this analogy holds very well for the most part, there are two important catches:

- Methods, while still being able to define arbitrarily complicated logic, are not directly invoked. Instead, Web agents come with **lifecycle callback** functions that are called during specified stages of a Web Agent's lifetime
- Web Agent **instantiation** is not accomplished by invoking a constructor (at least from the programmer's perspective)

Don't worry if these points feel restrictive through this article; much finer control becomes available once we discuss **lanes**.

### Declaration

Just like with (instantiable) `class` declarations in Java, **Agent declarations** in Swim define the behavior for **instances** of those Agents. 
Declarations alone don't actually instantiate anything.

To declare a Web Agent, extend the `AbstractAgent` class from the `swim.api` module:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;

public class UnitAgent extends AbstractAgent {

}
```

### External Addressability

Every Web Agent has a universal, logical address, in the form of a URI.
The URI of a custom `PlanetAgent` might look something like `"/planet/Mercury"`. 
That of a singleton `SunAgent` might just look like `"/sun"`.
By decoupling Web Agent's logical addresses from the network addresses of their host machines, Swim applications become invariant to the infrastructure on which they're deployed.

Each Web Agent is aware of its own URI, available via its `nodeUri()` method. 
Let's add a simple utility method to each `UnitAgent` to help us identify the Agent from which a logged message originated.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;

public class UnitAgent extends AbstractAgent {
  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

### Instantiation

For an Agent to know its **own** identifier is only half of the problem. 
To address the other half, every Swim server runs a **plane** that manages the runtime of and provides a shared context for a group of Web Agents.

One of a plane's many responsibilities is to resolve Agent URIs for requests.

To declare a Web Agent's URI, simply define a node with URI in the server configuration file.

To declare a dynamic component, we prepend with a colon (:) for the agent id.

```
# server.recon
basic: @fabric {
  @plane(class: "swim.basic.BasicPlane")
  # Static Component
  # Notice usage of 'uri' keyword for a static component.
  @node {
    uri: "/unit/foo"
    @agent(class: "swim.basic.UnitAgent") 
  }

  # Dynamic Component
  # Notice usage of 'pattern' keyword for a dynamic component. 
  @node {
    pattern: "/unit/:id"
    @agent(class: "swim.basic.UnitAgent")
  }
}

@web(port: 9001) {
  space: "basic"
  @websocket {
    serverCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
    clientCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
  }
}
```

Statically defined agents (illustrated using 'uri' keyword) are automatically instantiated by the corresponding Swim Plane.

A Dynamic Web Agent is only instantiated when its `nodeUri` is invoked for the first time. 
With the code we have so far, we can instantiate any number of `UnitAgent`s by either defining them in the configuration file or by invoking URIs with the `"/unit/"` prefix. 
For example, if we invoke `"/unit/1"`, `"/unit/foo"`, and `"/unit/foo_1"`, three `UnitAgent`s will be instantiated, one for each URI.

{% include alert.html title='Caution' text='If you have multiple agent types within a plane, ensure that their URI patterns do not **clash**. This is a stricter requirement than saying that the patterns are <strong>identical</strong>; for example, <strong>"/unit/:id"</strong> and <strong>"/unit/:foo"</strong> clash. Suppose these same patterns annotated different agent types; how would a plane know which type of Agent to seek or instantiate for the request <strong>"/unit/1"</strong>?' %}

In addition to the `nodeUri()` method mentioned in the previous section, every Agent also has access to a `Value getProp(String prop)` convenience method. 
This returns a `swim.structure.Text` object containing the value of the dynamic `nodeUri` component with the name `prop`, `absent()` if it doesn't exist. 
For example, `getProp("id").stringValue()` will return either `"1"`, `"foo"`, or `"foo_1"`, depending on which of the above three agents we are currently running in. `getProp("foo")` will return `absent()`.

Further reading: [Planes]({% link _reference/planes.md %})

### Lifecycle Callbacks

Recall that Web Agent methods are not directly invoked. 
Instead, the Swim runtime schedules and executes callbacks stages of an Agent's lifecycle. For the most part, you will only care about two:

- `void didStart()`: executed once immediately after this Agent has started
- `void willStop()`: executed once immediately before this Agent will stop

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;

public class UnitAgent extends AbstractAgent {
  @Override
  public void didStart() {
    logMessage("didStart");
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

## Web Agent Principles

### Universally Addressable

Every Web Agent has a universal, logical address, in the form of a URI. By decoupling Web Agent's logical addresses from the network addresses of their host machines, Swim applications become invariant to the infrastructure on which they're deployed.

### Stateful

Web Agents remember their state in-between operations, eliminating the need for constant database round-trips, and greatly simplifying application development by avoiding object-relational mapping.

### Atomic

Each Web Agent executes in a single thread at a time. Though as many distinct Web Agents execute in parallel as you have CPU cores. Combined with a built-in software transactional memory model, Web Agents are naturally atomic, without the overhead of locks or transactions.

### Consistent

Together, Web Agents, Lanes, and Links implement a continuous consistency model that's largely transparent developers. Web Agents applications just stays consistent. Continuously. In network real-time.

### Encapsulated

The only way in or out of a Web Agent is through links to its lanes. This gives Web Agents total control over the exposure of sensitive data. There's no database to compromise.

### Persistent

Databases aren't the only way to store data. Web Agents are internally persistent. By taking persistence off the critical path, the single biggest bottleneck to application performances instantly vanishes. While still letting you keep all the data you have space for.

### Bounded

Intrinsic and pervasive backpressure handling automatically adapts the behavior of your application based on network, disk, and CPU availability. And because of its continuous consistency model, developers, for the most part, don't have to care.

### Decentralized

Web Agents inherit the natural decentralization of the World Wide Web. Any Web Agent can link to any other, given its URI, and appropriate permissions.

### Composable

Unlink REST applications, which don't compose well without introducing significantly polling latency, caching overhead, and consistency problems, Web Agents frictionlessly compose, in real-time, at any scale.

As the name implies, Web Agents were designed from first principles to be first class citizens of the World Wide Web. The Web has evolved from a world-wide hypertext library, into the lingua franca of distributed applications. But the technical foundation of the Web, stateless remote procedurce calls over HTTP, is fundamentally incapable of meeting the needs of modern, autonomous, collaborative applications. Web Agents aim to fill that gap.

## Try It Yourself

Jump ahead to lanes to see what goes inside a Web Agent. Dive into the tutorials to see Web Agents in action. Or read on to learn what it really means to be a Web Agent.

A stand