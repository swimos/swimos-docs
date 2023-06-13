---
title: Web Agents
layout: page
---

Swim servers utilize a general purpose distributed object model in which the objects are called **Web Agents**. Programming with this model feels like typical object-oriented programming with additional key innovations in addressability, statefulness, consistency, boundedness, and composability.

Although this analogy holds very well for the most part, there are two important catches:

- Methods, while still being able to define arbitrarily complicated logic, are not directly invoked. Instead, Web agents come with **lifecycle callback** functions that are called during specified stages of a Web Agent's lifetime
- Web Agent **instantiation** is not accomplished by invoking a constructor (at least from the programmer's perspective)

Don't worry if these points feel restrictive through this article; much finer control becomes available once we discuss **lanes** in subsequent recipes.

### Declaration

Just like with (instantiable) `class` declarations in Java, **Agent declarations** in Swim define the behavior for **instances** of those Agents. Declarations alone don't actually instantiate anything.

To declare a Web Agent, simply extend the `AbstractAgent` class from the `swim.api` module.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.agent.AbstractAgent;

public class UnitAgent extends AbstractAgent {

}
```

### External Addressability

Every Web Agent has a universal, logical address, in the form of a URI. The URI of a custom `PlanetAgent` might look something like `"/planet/Mercury"`. That of a singleton `SunAgent` might just look like `"/sun"`.

Each Web Agent is aware of its own URI, available via its `nodeUri()` method. Let's add a simple utility method to each `UnitAgent` to help us identify the Agent from which a logged message originated.

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

<!--Further reading: <a href="/tutorials/universal-addressability">Universal Addressability</a>-->

### Instantiation

For an Agent to know its **own** identifier is only half of the problem. To address the other half, every Swim server runs a **plane** that manages the runtime of and provides a shared context for a group of Web Agents.

One of a plane's many responsibilities is to resolve Agent URIs for requests. To implement this functionality in your custom plane class (that extends `swim.api.plane.AbstractPlane`), annotate a field for each Agent definition with a corresponding URI **pattern** (colons (:) indicate dynamic components):

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.SwimRoute;
import swim.api.plane.AbstractPlane;
import swim.api.agent.AgentRoute;

public class BasicPlane extends AbstractPlane {
  @SwimRoute("/unit/:id")
  AgentRoute<UnitAgent> unitAgentType;
}
```

A Web Agent is only instantiated when its `nodeUri` is invoked for the first time. With the code we have so far, we can instantiate any number of `UnitAgent`s simply by invoking URIs with the `"/unit/"` prefix. For example, if we invoke `"/unit/1"`, `"/unit/foo"`, and `"/unit/foo_1"`, three `UnitAgent`s will be instantiated, one for each URI.

**CAUTION:** if you have multiple agent types within a plane, ensure that their URI patterns do not **clash**. This is a stricter requirement than saying that the patterns are **identical**; for example, `"/unit/:id"` and `"/unit/:foo"` clash. Suppose these same patterns annotated different agent types; how would a plane know which type of Agent to seek or instantiate for the request `"/unit/1"`?

In addition to the `nodeUri()` method mentioned in the previous section, every Agent also has access to a `Value getProp(String prop)` convenience method. This returns a `swim.structure.Text` object containing the value of the dynamic `nodeUri` component with the name `prop`, `absent()` if it doesn't exist. For example, `getProp("id").stringValue()` will return either `"1"`, `"foo"`, or `"foo_1"`, depending on which of the above three agents we are currently running in. `getProp("foo")` will return `absent()`.

Further reading: [Planes](/tutorials/planes)

<!---, <a href="/tutorials/structures">Structures</a>-->

### Lifecycle Callbacks

Recall that Web Agent methods are not directly invoked. Instead, the Swim runtime schedules and executes callbacks stages of an Agent's lifecycle. For the most part, you will only care about two:

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


