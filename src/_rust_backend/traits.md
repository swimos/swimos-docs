---
title: Traits
short-title: Traits
description: "Define and utilize 'trait' that can be used to share lanes across multiple agents."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/traits
redirect_from:
  - /rust/tutorials/traits/
  - /rust/reference/traits.html
---

In the [Planes guide]({% link _rust_backend/planes.md %}), we describe a distributed object model to facilitate shared context for a group of **Web Agents**. In this guide we describe the concept of **'Trait'** utilized for sharing of data across multiple **Web Agents.**

There are two types of traits:

1. Static Traits
2. Dynamic Traits

For Static Traits, the agents are declared and defined upfront via configuration. On the other hand, Dynamic Traits follow the dynamic agent definition structure, so multiple agents can be created and run at runtime. This facilitates runtime polymorphism.

### Traits

Below is an illustration for a trait lifecycle. Following this illustration flow helps understanding the declaration, definition and working of a trait.

### Motivation

The main motivation behind **'Traits'** is to be able to make a run-time decision regarding which specific functionality to be chosen for execution. This enables polymorphic behavior at run-time. An **'agent'** is utilized to facilitate this behavior by assigning a functionality (or a set of functionalities) to a particular agent class definition.

### Step 1: Prepare agent definitions

```java
// ./server.recon
liquid: @fabric {
  @plane(class: "swim.liquid.LiquidPlane")

  **// Static Traits declaration:**
  @node {
    uri: "/liquid/static/water/sparkling"
    @agent(class: "swim.liquid.agent.WaterAgent") {
      waterType: "Sparkling Water"
    }
    @agent(class: "swim.liquid.agent.LiquidAgent") {
      liquidType: "Water"
    }
  }
  @node {
    uri: "/liquid/static/juice/orange"
    @agent(class: "swim.liquid.agent.JuiceAgent") {
      juiceType: "Orange Juice"
    }
    @agent(class: "swim.liquid.agent.LiquidAgent") {
      liquidType: "Juice"
    }
  }

  **// Dynamic Traits declaration:**
  @node {
    pattern: "/liquid/:trait/:id1/:id2"
    @agent(class: "swim.liquid.agent.WaterAgent") {
    }
    @agent(class: "swim.liquid.agent.JuiceAgent") {
    }
    @agent(class: "swim.liquid.agent.LiquidAgent") {
    }
  }
}
```

### Step 2: Declare shared lane

```java
// LiquidAgent.java, WaterAgent.java, JuiceAgent.java

  @SwimLane("sharedInfo")
  ValueLane<String> sharedInfo;
```

### Step 3: Set the Lane Data

```java
// WaterAgent.java (similarly done for LiquidAgent.java, not illustrated here.)

// Fetch value of property belonging to the /liquid/static/water/sparkling uri.
  void pourStatic() {
    final String waterInfo = getProp("waterType").stringValue(null);
    if (waterInfo != null) {
      logMessage("Static Water Property '" + waterInfo + "'");

      // Set Value for the sharedInfo SwimLane which is shared by Liquid,
      // Water and Juice Agent.
      this.sharedInfo.set("Statically shared liquid is '" + waterInfo + "'");
    }
  }


// Set value of the sharedInfo lane belonging to the /liquid/:trait/:id1/:id2 pattern.
  void pourDynamic() {
    final String liquidType = getProp("id1").stringValue(null);
    final String liquidName = getProp("id2").stringValue(null);
    if (liquidType != null && liquidName != null) {
      logMessage("Dynamic Water Property '" + liquidName + "'");

      // Set Value for the sharedInfo SwimLane which is shared by Liquid,
      // Water and Juice Agent.
      this.sharedInfo.set("Dynamically shared liquid is '" + liquidName + " "
              + liquidType + "'");
    }
  }
```

### Step 4: Prepare Plane for dynamic agent

```java
// LiquidPlane.java

  public class LiquidPlane extends AbstractPlane {
    public static void main(String[] args) throws InterruptedException {
      final Kernel kernel = ServerLoader.loadServer();
      final ActorSpace space = (ActorSpace) kernel.getSpace("liquid");

      kernel.start();
      System.out.println("Running Basic server...");
      kernel.run();

      // Dynamic Agent(s)
      int n = 0;
      String nodeString = "";
      final String[] listOfLiquid = new String[]{"black", "pineapple", "tap", "mango"};
      while (n < 4) {
        if (n % 2 == 0) {
          nodeString = "/liquid/dynamic/water/" + listOfLiquid[n];
        } else {
          nodeString = "/liquid/dynamic/juice/" + listOfLiquid[n];
        }
        space.command(nodeString, "unusedForNow", Value.absent());
        n++;
        Thread.sleep(2000);
      }

    System.out.println("Server will shut down in 3 seconds");
    Thread.sleep(3000);
    System.out.println("Sent shutdown signal to server");
    kernel.stop();
  }
}
```

### Step 5: Dynamic agent opening

```java
// **Dynamic Trait specific step**
// LiquidAgent.java, WaterAgent.java

  // 1. Fetch value of properties belonging to the /liquid/:trait/:id/:id pattern.
  // 2. Open agents dynamically. ('openAgent' method enables calls to agent classes.)
  void pourDynamic() {
    // Dynamically open either Water or Juice Agent at runtime.
    if (getProp("id1").stringValue().equals("water")) {
      openAgent("wAgent", WaterAgent.class);
    } else if (getProp("id1").stringValue().equals("juice")) {
      openAgent("jAgent", JuiceAgent.class);
    }
  }
```

### Step 6: Fetch the shared lane data

```java
// LiquidAgent.java, WaterAgent.java

  // Fetch info shared with other agents.
  void pourStatic() {
    // Fetching message via sharedInfo SwimLane.
    final String msg = this.sharedInfo.get();
    logMessage(msg);
  }

  // 1. Fetch value of properties belonging to the /liquid/:trait/:id/:id pattern.
  // 2. Open agents dynamically.
  // 3. Fetch value of sharedInfo lane for the opened agents.
  void pourDynamic() {
    // Dynamically open either Water or Juice Agent at runtime.
    if (getProp("id1").stringValue().equals("water")) {
      openAgent("wAgent", WaterAgent.class);
    } else if (getProp("id1").stringValue().equals("juice")) {
      openAgent("jAgent", JuiceAgent.class);
    }
    logMessage(this.sharedInfo.get());
  }
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/traits).
