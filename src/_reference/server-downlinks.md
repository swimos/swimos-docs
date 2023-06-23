---
title: Server Downlinks
layout: page
redirect_from:
  - /tutorials/server-downlinks/
---

In a [previous tutorial]({% link _reference/downlinks.md %}), we discussed **downlinks** - bidirectionally-streaming, persistent **subscriptions** to lanes - and went through an example of a client-side downlink. This tutorial will showcase downlinks between two Swim servers.

Server-side downlinks provide a simple and efficient way to integrate Swim applications allowing them to be linked or chained together with ease.

There are two big things to manage when dealing with downlinks: **data** and **connections**. This guide will focus heavily on the former; we will expand on connection management in a future, more advanced article.

### Declaration

#### Java

All downlink classes can be imported from package `swim.api.downlink`.

### Usage

Downlinks must be instantiated against Swim refs, i.e. specific server-side or client-side objects. Although several permutations exist, the builder pattern is the same each time:

1. Invoke `downlink()` against your ref for an event downlink, or `downlinkFoo()` for a foo downlink (e.g. `downlinkMap()` for a map downlink)
1. Build the downlink's `hostUri` using `hostUri()` (this step can only be omitted if your Swim ref is server-side, and you are targeting a lane within the same server), the downlink's `nodeUri` using `nodeUri()`, and the downlink's `laneUri` using `laneUri()`
1. Override any lifecycle callback functions, which default to no-ops
1. In strongly-typed languages (Java, Typescript), optionally parametrize the downlink
1. Optionally set the **keepSynced** (pull all existing data from a lane before processing new updates; defaults to `false`) and **keepLinked** (enable consistent **reads** from the downlink (unnecessary for write-only downlinks); defaults to `true`) flags
1. Invoke `open()` on the downlink to initiate data flow
1. When finished, invoke `close()` on the downlink to stop data flow

#### Lifecycle callbacks and updating lanes

Every event downlink has a customizable `onEvent(V event)` callback function that specifies the action to take upon every event received by the target lane.

For all other (i.e. lane-specific) downlinks, recall that every data-storing lane can be acted upon by methods specific to that lane type (e.g. `set` for value lanes; `put`, `remove`, `drop`, `take`, and `clear` for map lanes). These options also exist on correctly-configured lane-specific downlinks. Furthermore, for every such method `foo`, each downlink has a `didFoo(Object... args)` method that follows similar lifecycle semantics to `onEvent()`, but with more useful callback parameters. For example, every `MapDownlink<K, V>` has access to `didUpdate(K key, V newValue, V oldValue)`, `didRemove(K key, V oldValue)`, `didDrop(int dropCount)`, `didTake(int keepCount)`, and `didClear()` methods.

#### Parametrization

Unlike with lanes, which additionally offer parametrized methods, downlink parametrization **requires** providing ``swim.structure.Forms` through a builder pattern.

#### Java

Server-side, downlinks can be issued either against plane contexts:

```java
// swim/basic/SupplierPlane
package swim.basic;

import swim.actor.ActorSpace;
import swim.api.SwimRoute;
import swim.api.agent.AgentRoute;
import swim.api.plane.AbstractPlane;
import swim.kernel.Kernel;
import swim.server.ServerLoader;
import swim.structure.Form;

public class SupplierPlane extends AbstractPlane {

  public final static String WAREHOUSE_HOST_URI = "warp://localhost:9001";

  @SwimRoute("/supplier")
  AgentRoute<SupplierAgent> supplierAgentType;

  @SwimRoute("/customer/:id")
  AgentRoute<CustomerAgent> customerAgentType;

  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServerStack();
    final ActorSpace plane = (ActorSpace) kernel.getSpace("supplier");

    kernel.start();

    //Create a value downlink to a different Swim server directly from this plane
    plane.downlinkValue()
        .valueForm(Form.forInteger())
        .hostUri(WAREHOUSE_HOST_URI)
        .nodeUri("/warehouse/cambridge").laneUri("lastResupplyId")
        .didSet((newValue, oldValue) -> {
          logMessage("latest supply id received at warehouse: " + newValue);
        }).open();
  } 
}
```

or against Agent contexts using the `AbstractAgent.downlinkFoo()` methods, both as fields within Agents, and as local variables within methods (latter demonstrated here):

```java
// swim/basic/CustomerAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.structure.Form;
import swim.structure.Text;

import java.util.Objects;

public class CustomerAgent extends AbstractAgent {

  @SwimLane("register")
  public CommandLane<String> register = this.<String>commandLane()
      .onCommand(location -> {
        addStockNotificationDownlink(location);
      });

  private void addStockNotificationDownlink(final String location) {
    final String warehouseNodeUri = "/warehouse/" + location;

    //Create a value downlink to a different Swim server from an agent
    this.downlinkValue().valueForm(Form.forInteger())
        .hostUri(SupplierPlane.WAREHOUSE_HOST_URI)
        .nodeUri(warehouseNodeUri).laneUri("lastResupplyId")
        .didSet((newValue, oldValue) -> {
          if (!Objects.equals(newValue, oldValue))
            logMessage("customer received new stock notification, resupply: " + newValue);
          }).open();
  }
}
```

Client-side downlinks have been showcased in a [previous tutorial]({% link _reference/downlinks.md %}).

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/server_downlinks).
