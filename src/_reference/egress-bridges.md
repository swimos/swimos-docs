---
title: Egress Bridges
layout: page
description: "Relay your Swim server's data to any other system."
redirect_from:
  - /tutorials/egress-bridges/
---

Swim's built-in networking stack enables communication with other processes--which might themselves be other Swim servers. There are two directions of data flow: from Swim to external processes, and from external processes to Swim. This article discusses the former.

We hereafter call any logic that enables this flow an **egress bridge** for an application, as it enables **egression** of data **from** our Swim server. Several egress bridge implementations are possible, but all of them can be categorized into one of two high-level models: **pull**-type and **push**-type.

Pull-type ingress bridges are awkward in practice unless the data sink is another Swim server (in which case the implementation simply degenerates into Swim downlinks), so we will not discuss them further here.

### "Push" Model

This high-level egress bridge design has your Swim server write (i.e. **push**) data **to** a different process (hereafter the **sink**).

If the sink is another Swim server, then the egress bridge can be as simple as sending commands from the source to the sink, or updating downlinks that were instantiated in the source and link to the sink.

For non-Swim sinks, implementing a push-based egress bridge requires some care. Running Swim agents on a single machine "in parallel" only works because each agent executes in a thread pool. Simple push-type logic, such as HTTP POSTs or database writes, often involve **blocking** calls, which will bog down not only the current Agent but also Agents scheduled for future execution by the same thread.

Therefore, fundamental to these egress bridges is a **nonblocking driver**. If your data sink is an HTTP server, this might be an [`AsyncHttpClient`](https://github.com/AsyncHttpClient/async-http-client) instance. If it is a database, you may consider a mature [ADBA](https://blogs.oracle.com/java/jdbc-next:-a-new-asynchronous-api-for-connecting-to-a-database) implementation (though the [official subset](https://github.com/oracle/oracle-db-examples/tree/master/java/AoJ) likely has everything you'll need).

#### Option 1: Threadsafe Connector

Since well-implemented nonblocking connectors usually have their own associated thread pool, it is imperative to instantiate as few instances of them as possible (usually just one). But Swim servers are multithreaded. If many different lane callback functions concurrently access the connector, then the connector **must** be threadsafe for everything to work.

With this guarantee, performing the pushes is quite easy. We recommend having a singleton wrapper around your connector:

```java
// swim/basic/CustomDriver.java
public class CustomDriver {

  private DriverType instance;

  private CustomDriver() {
    instance = /* custom code here */ ;
  }

  public static void push() {
    // impl will vary, but will use `instance` in some way
  }
}
```

Then, every time you reach a point within a lane callback function where you want to push to the driver, simply invoke `CustomDriver.push(yourMessage)`, as demonstrated in the following section.

#### Option 2: Dedicated Egress Agent

Lane lifecycle callback functions execute uninterrupted in a single thread. Thus, if every message sent to the sink originates from the same lane callback, then we do not need a threadsafe connector.

An easy way to do this is to create a singleton `EgressAgent`, with a single command lane whose `onCommand` simply relays messages to the connector:

```java
// swim/basic/EgressAgent.java

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;

public class EgressAgent extends AbstractAgent {

  @SwimLane("write")
  CommandLane<String> write = this.<String>commandLane()
      .onCommand(msg -> {
        CustomDriver.push(msg);
      });
}
```

Every Agent that has something to push then simply `commands` all messages to `nodeUri="/egress"`, `laneUri="write"`.

### Try It Yourself

A standalone project that demonstrates these principles against an H2 database is available [here](https://github.com/swimos/cookbook/tree/master/egress_bridges).
