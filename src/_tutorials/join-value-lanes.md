---
title: Join Value Lanes
layout: page
---

In a [previous tutorial](/tutorials/value-lanes), we began to describe a distributed object model where **Web Agents** are the **objects**. The **fields** in this model are called **lanes**.

Lanes come in many flavors, but every lane type exposes:

- A **means to act** on this lane
- Customizable **lifecycle callbacks** that execute during the runtime of this action
- Various means to **strongly type** (i.e. *parametrize*) the lane
- Universal WARP **subscriptions** to this lane

A **join value lane** uses **downlinks** to create permanent links to other value lanes and meets the following requirements:

- Every join value lane can be **linked** to multiple value lanes
- The linked values are stored as a map of entries
- Changing the value of any of the linked value lanes, will trigger **didUpdate()** on the join value lane.
- The parameters on a join value lane indicates the type of the keys and the type of the values that it stores

### Declaration

A join value lane is essentially a map, that can aggregates values of multiple agents. The data type of the key can be anything, but the data type of the value must match the data type of the value lanes that will be aggregated.

```java
// swim/basic/BuildingAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.JoinValueLane;

public class BuildingAgent extends AbstractAgent {
  @SwimLane("lights")
  JoinValueLane<String, Boolean> lights;
}

Internally, lanes are always backed by `swim.structure.Value`s, regardless of their parametrized types. Under the hood, lanes use **forms** to handle any necessary conversions, allowing users to treat lanes as properly parametrized data types provided that a form for that data type exists. Even custom Java classes can be lane types, provided that forms for those classes exist. We will further discuss this topic in a more advanced cookbook.

<!-- Further reading: <a href="/tutorials/universal-addressability">Universal Addressability</a>, <a href="/tutorials/structures">Structures</a>
-->

### Instantiation and `didUpdate()`

The `AbstractAgent` class comes with utility methods to construct runnable lanes. Recall, however, that developers rarely instantiate Web Agents by explicitly invoking their constructors. The recommended pattern for adding a value lane to an Agent is instead to:

- Exclude constructors entirely from Web Agents
- Use the `joinValueLane()` method to instantiate the lane; note that this is a parametrized method
- Through a builder pattern, override the lane's `void didUpdate(K key, V newValue, V oldValue)` method

This **didUpdate()** lifecycle callback is executed every time that a linked value lane gets its value updated, and it has access to the key of the updated value lane, the recently-updated value and its immediately prior one.

```java
// swim/basic/BuildingAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.JoinValueLane;

public class BuildingAgent extends AbstractAgent {
  @SwimLane("lights")
  JoinValueLane<String, Boolean> lights = this.<String, Boolean>joinValueLane()
                                              .didUpdate((String key,
                                                          Boolean newValue,
                                                          Boolean oldValue) -> {
    System.out.println("The lights in room " + key + " are " + (newValue ? "off." : "on."));
  });
}
```

**CAUTION:** If you have multiple lanes within an Agent type, ensure that their laneUris are not identical. Suppose we declare two different value lanes within our `UnitAgent` with laneUri `"info"`; how the Swim runtime know which one to set? That said, reusing laneUris **across** Agent types is perfectly acceptable, as requests corresponding to these are guaranteed to have different nodeUris.

### Aggregating value lanes

In order to show how join value lanes can aggregate the value lanes of multiple agents, lets first create a new agent with a boolean value lane.

```java
// swim/basic/RoomAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.structure.Value;

public class RoomAgent extends AbstractAgent {
  @SwimLane ("lights")
  ValueLane<Boolean> lights = this.<Boolean>valueLane();
  
  @Override
  public void didStart() {
    register();
  }
  
  @SwimLane ("toggleLights")
  CommandLane<String> toggleLights = this.<String>commandLane().onCommand(msg -> {
    this.lights.set(!lights.get());
  });
  
  private void register() {
    String buildingUri = "/building/" + this.getProp("building").stringValue();
    Value roomId = this.getProp("room");
    command(buildingUri, "registerRoom", roomId);
  }
}
```

The **RoomAgent** represents a room in an office building, that has boolean flag to indicate whether the lights in the room are on. It has a toggle command lane, that can change the status of the lights.

Additionally, it has a **register()** method, that is being called when an agent of type **RoomAgent** is first started. The method invokes the **registerRoom** command on the corresponding **BuildingAgent**, to which the room belongs.

```java
// swim/basic/BuildingAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.JoinValueLane;
import swim.structure.Value;

public class BuildingAgent extends AbstractAgent {
  @SwimLane ("lights")
  JoinValueLane<String, Boolean> lights = this.<String, Boolean>joinValueLane()
                                              .didUpdate((String key,
                                                          Boolean newValue,
                                                          Boolean oldValue) -> {
    System.out.println("The lights in room " + key + " are " + (newValue ? "off." : "on."));
  });
  
  @SwimLane ("registerRoom")
  CommandLane<Value> registerRoom = this.<Value>commandLane().onCommand(room -> {
    String roomUri = "/" + this.getProp("name").stringValue() + "/" + room.stringValue();
    this.lights.downlink(room.stringValue()).nodeUri(roomUri).laneUri("lights").open();
  });
}
```

The **registerRoom** command on the **BuildingAgent**, creates a permanent link to the **lights** value lane of the **RoomAgent** and adds the entry to the join value lane.

### Reading from Join Value Lanes

Map downlinks can be used in order to read the data from join value lanes. The following example shows how we can connect to the join value lane of the **BuildingAgent** and see the data from it.

```java
// swim/basic/CustomerClient.java
package swim.basic;

import swim.api.downlink.MapDownlink;
import swim.client.ClientRuntime;
import swim.structure.Form;

class CustomClient {

  public static void main(String[] args) throws InterruptedException {
    
    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final String hostUri = "warp://localhost:9001";
    final String buildingUri = "/building/swim";
  
    final MapDownlink<Integer, Boolean> link = swimClient.downlinkMap()
                                                        .keyForm(Form.forInteger())
                                                        .valueForm(Form.forBoolean())
                                                        .hostUri(hostUri)
                                                        .nodeUri(buildingUri)
                                                        .laneUri("lights")
                                                        .open();
    
    Thread.sleep(2000);
    System.out.println("Join value lane");
    link.get().forEach((key, value) -> System.out.println(key + ":" + value));
  
  
    System.out.println("Will shut down client in 2 seconds");
    Thread.sleep(2000);
    
    swimClient.stop();
  }
}
```
      
### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/join_map_lanes).

