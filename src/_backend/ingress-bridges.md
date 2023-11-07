---
title: Ingress Bridges
short-title: Ingress Bridges
description: "Feed data available from any network protocol into your Swim server."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/ingress_bridges
redirect_from:
  - /tutorials/ingress-bridges/
  - /reference/ingress-bridges.html
---

Swim's built-in networking stack enables communication with other processes--which might themselves be other Swim servers. There are two directions of data flow: from Swim to external processes, and from external processes to Swim. This article discusses the latter.

We hereafter call any logic that enables this flow an **ingress bridge** for an application, as it enables **ingression** of data **into** your Swim server. Several ingress bridge implementations are possible, but all of them can be categorized into one of two high-level models: **push**-type and **pull**-type.

### "Push" Model

This high-level ingress bridge design has data sources write (i.e. **push**) data **to** a Swim server.

#### Option 1: Swim Client

Writes to a Swim server are most easily accomplished using a Swim client instance, but doing so requires one of the following:

- The data source itself is written in either Java or Javascript (currently the only two languages that support Swim clients)
- The data source pushes messages, using **any networking protocol of your choice**, to a different Java/Javascript process, which then uses a Swim client to relay data to the Swim server

Note that the second is simply the first with an intermediary process.

Either way, the process that talks directly to the Swim server updates the server by either [sending commands]({% link _backend/command-lanes.md %}) or [writing to downlinks]({% link _backend/downlinks.md %}).

```java
// swim/basic/SwimWriter.java
public class SwimWriter {
  // example usage:
  //   new SwimWriter()
  //      .generateOnce("warp://localhost:9001", "/unit/foo", "publish",
  //        Text.from("PushOption1"));
  // Note that this `SwimWriter` wrapper class is mostly just pedantic; nothing
  // wrong with directly operating with `ClientRuntime` instances

  private final ClientRuntime swim;

  public SwimWriter() {
    this.swim = new ClientRuntime();
    this.swim.start();
  }

  public void generateOnce(String host, String node, String lane, Value v) {
    this.swim.command(host, node, lane, v);
  }
}
```

#### Option 2: Websocket Messages

Because WARP is built on top of websockets, sending the right websocket messages in the right order, even without a proper Swim handle, can trigger actions on a Swim server. Downlinks are near-impossible to instantiate in this manner, but sending commands is very simple (by design, because this is how we **want** non-Swim clients to write to Swim). Commanding a lane without WARP just requires two steps:

1. Open a websocket connection to the desired server's `hostUri`
1. Write a string of the form `@command(node:"%n",lane:"%l")%p` through this connection, where `%n` is the desired `nodeUri`, `%l` is the `laneUri`, and `%p` is the payload

Consequently, this kind of ingress bridge can be written in **any** language that supports websockets. In Python:

```python
# data_generator.py
# Prereq: install websocket-client: https://github.com/websocket-client/websocket-client

from websocket import create_connection

ws = create_connection('ws://localhost:9001')

# all parameters are strings
def generate_once(host, node, lane, v):
  message = '@command(node:{},lane:{}){}'.format(node, lane, v)
  # equivalent old-school syntax:
  #   message = '@command(node:%s,lane:%s)%s' % (node, lane v)
  ws.send(message)
```

Note that `message` could have been populated by data **received from** a different networking protocol; it is only the push to Swim that must be done through a websocket.

### "Pull" Model

If you prefer that your Web Agents **pull** data rather than have messages pushed to them, you will have to be very careful. Running Swim agents on a single machine "in parallel" only works because each agent executes in a thread pool. Simple pull-type network requests (e.g. HTTP GETs) often involve **blocking** calls, which will bog down not only the current Agent but Agents scheduled for future execution by the same thread.

There are options to avoid this. "True" pull-type, nonblocking designs are only guaranteed over WARP. Otherwise, data flow can still be **initiated by** pull-type patterns, but the ultimate write to your Swim server will likely be a push.

#### Option 1: Downlinks

If, but only if, the data source is itself a Swim server, then the work is minimal. Simply open downlinks to the data source lanes, and have the callback functions of these downlinks populate the Swim server's lanes (or, optionally, do some analytics with this data first); data transfer through a downlink never blocks.

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.downlink.ValueDownlink;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.structure.Form;

public class UnitAgent extends AbstractAgent {

  private ValueDownlink<String> toDataSource;

  @SwimLane("history")
  MapLane<Long, String> history = this.<Long, String>mapLane();

  @SwimLane("publish")
  CommandLane<String> publish = this.<String>commandLane()
      .onCommand(msg -> {
        this.history.put(System.currentTimeMillis(), msg);
      });

  @Override
  public void didStart() {
    subscribe("warp://localhost:9002", "/source/" + getProp("id").stringValue(), "val");
  }

  private void subscribe(String host, String node, String lane) {
    if (this.toDataSource != null) {
      this.toDataSource.close();
    }
    this.toDataSource = downlinkValue()
      .valueForm(Form.forString())
      .hostUri(host).nodeUri(node).laneUri(lane)
      .keepSynced(true)
      .didSet((n, o) -> {
        this.history.put(System.currentTimeMillis(), n);
      })
      .open();
  }

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

#### Option 2: Secondary Service

If the data source is not a Swim server and you still want something of a pull model, we recommend the following architecture:

- A secondary service pulls data, using **any networking protocol of your choice**, from the data source, then relays data to the Swim server using any of the "push-type" bridges discussed above.

It is **not required** that this service run outside of the Swim server. There is a way to execute blocking calls within a server context without impacting Web Agent functionality. This feature exceeds the scope of this discussion, but a fully-worked example can be found in our [HTTP Ingress Bridge example]({% link _backend/http-ingress-bridges.md %}).

### Try It Yourself

A standalone project is available [here](https://github.com/swimos/cookbook/tree/master/ingress_bridges). We do not demonstrate the "push" type bridges, as these are trivial applications of Swim clients. Instead, we demonstrate both pull-type ingress bridges: once with downlinks (hence another a Swim server as the data source), and once with an external process that pulls from the data source over MQTT prior to writing to Swim.
