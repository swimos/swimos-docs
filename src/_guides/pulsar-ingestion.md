---
title: Pulsar Ingestion
layout: page
description: "How to receive and process data from Pulsar topics within Web Agents"
cookbook: https://github.com/swimos/cookbook/tree/master/pulsar_ingestion
---

This guide illustrates how to develop a Swim application that ingests data from Kafka topics and instantiates logic-performing Web Agents.

We accomplish this by declaring two types of Web Agents:

- A singleton `PulsarConsumingAgent` responsible for consuming messages from a Kafka topic and relaying them to...
- ...a dynamic number of `VehicleAgents` whose callback functions define the business logic.

## Prerequisites

- Swim server libraries
- [Pulsar Client libraries](https://mvnrepository.com/artifact/org.apache.pulsar/pulsar-client)
- A network-accessible Pulsar topic

## Guide

### Step 0: Example Data Definition and Business Logic Goals

Let's envision a situation where vehicles continuously report their state to the Kafka topic.
Messages in the (unkeyed) topic take the form of a JSON string that looks like:

```
{
  "id": (string (same as key)),
  "timestamp": (number (Unix timestamp))
  "latitude": (number),
  "longitude": (number),
  "speed": (number),
  "bearing": (number)
}
```

We wish to have real-time access to present and historical data at vehicle-level granularity.

### Step 1: `PulsarClient` Instantiation

Instantiate a `PulsarClient` -- nothing special here, and certainly familiar to veteran Pulsar users.

```java
// Assets.java
import java.util.Map;
import org.apache.pulsar.client.api.Consumer;
import org.apache.pulsar.client.api.PulsarClient;

public final class Assets {

  private Assets() {
  }

  private static PulsarClient client;

  public static PulsarClient pulsarClient() {
    return Assets.client;
  }

  public static Consumer<String> pulsarConsumer() {
    return Assets.consumer;
  }

  private static PulsarClient loadPulsarClient() {
    final Map<String, Object> config = Map.ofEntries(
      Map.entry("serviceUrl", "pulsar://localhost:6650"),
      Map.entry("numListenerThreads", 1)
    );
    Assets.client = PulsarClient.builder()
        .loadConf(config)
        .build();
  }

  public static void init() {
    Assets.client = loadPulsarClient();
    Assets.consumer = loadPulsarConsumer();
  }

}
```

### Step 2: `PulsarConsumerAgent` Implementation

We will similarly need to create a `PulsarConsumer` instance.
There are many ways to tie one into the runtime; the one we illustrate here hits a good balance between performance and ease of development.

The main idea is to use the [`MessageListener`](https://pulsar.apache.org/docs/3.1.x/client-libraries-consumers/#create-a-consumer-with-a-message-listener) version of the `PulsarConsumer` to enable an event-based style programming paradigm.
Each callback will execute sequentially in a `Consumer` I/O thread, so to avoid lag we dispatch message handling to the Swim server's `asyncStage()`, as shown below:

```java
// PulsarConsumingAgent.java
import java.util.Map;
import org.apache.pulsar.client.api.Consumer;
import org.apache.pulsar.client.api.PulsarClient;
import swim.api.agent.AbstractAgent;

public class PulsarConsumingAgent extends AbstractAgent {

  private Consumer<String> pulsarConsumer; // or other type parameter

  private Consumer<String> loadPulsarConsumer(PulsarClient client) {
    final Map<String, Object> config = Map.ofEntries(
      Map.entry("topicNames", "myTopic"),
      Map.entry("subscriptionName", "mySubscription")
    );
    return client.newConsumer(Schema.STRING)GGGGGGGGGG
        .loadConf()
        .messageListener((c, m) -> {
          asyncStage().execute(() -> {
            // TODO: take an action on m
          });
        })
        .subscribe();
  }


  @Override
  public void didStart() {
    this.pulsarConsumer = loadPulsarConsumer(Assets.pulsarClient());
  }

}
```

_Note: if your [subscription type](https://pulsar.apache.org/docs/3.1.x/concepts-messaging/#subscription-types) is "Shared" and you are willing to relax the order of message processing, an easy way to achieve more throughput is to create of multiple instances of `PulsarConsumingAgent` in `server.recon`. Be sure to set the `PulsarClient`'s `numListenerThreads` config to equal the number of consumers if you choose to do this._

### Step 3: `VehicleAgent` Implementation and Routing

The code so far is fully capable of consuming the topic's data.
We must now create entities -- `VehicleAgents` -- that can accept and process this data.
Each will merely contain a `CommandLane` (to receive messages) and a [time series]({% link _guides/time-series.md %}) (to retain them).

```java
// VehicleAgent.java
import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.structure.Value;

public class VehicleAgent extends AbstractAgent {

  @SwimLane("addMessage")
  CommandLane<Value> addMessage = this.<Value>commandLane()
      .onCommand(v -> {
        this.history.put(v.get("timestamp").longValue(), v);
      });

  @SwimLane("history")
  MapLane<Long, Value> history = this.<Long, Value>mapLane()
      .didUpdate((k, n, o) -> {
        System.out.println(nodeUri() + ": received " + n);
      });

}
```

Deciding that the URIs for `VehicleAgents` will take the form `/vehicle/:id`, everything is in place to fill out our earlier for-loop's TODO:

```java
// PulsarConsumingAgent.java
// import ...
import swim.json.Json;
import swim.structure.Value;

public class PulsarConsumingAgent extends AbstractAgent {

  // ...

  private Consumer<String> loadPulsarConsumer(PulsarClient client) {
    // ...
    return client.newConsumer(Schema.STRING)
        .loadConf(config)
        .messageListener((c, m) -> {
          asyncStage().execute(() -> {
            final Value payload = Json.parse(m.getValue());
            final String nodeUri = "/vehicle/" + payload.get("id").stringValue();
            command(nodeUri, "addMessage", payload);
          });
        })
        .subscribe();
  }

  // ...
}
```

### Step 4: Wrapping It Up

Minus the boilerplate that comes with every Swim application, namely:

- A `server.recon` to configure networking, routing, and additional kernels
- A runtime-providing `Plane`
- A `main()` method that loads the `PulsarClient` and the Swim server

We're completely done! A standalone, directly-runnable project can be found [here](https://github.com/swimos/cookbook/tree/master/pulsar_ingestion).
