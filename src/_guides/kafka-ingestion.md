---
title: Kafka Ingestion
layout: page
description: "Process data from Kafka topics."
redirect_from:
  - /guides/kafka-ingestion/
cookbook: https://github.com/swimos/cookbook/tree/master/kafka_ingestion
---

This guide illustrates how to develop a Swim application that ingests data from Kafka topics and instantiates logic-performing Web Agents.

We accomplish this by declaring two types of Web Agents:

- A singleton `KafkaConsumingAgent` responsible for consuming messages from a Kafka topic and relaying them to...
- ...a dynamic number of `VehicleAgents` whose callback functions define the business logic.

## Prerequisites

- Swim server libraries
- [Kafka Client libraries](https://mvnrepository.com/artifact/org.apache.kafka/kafka-clients)
- A network-accessible Kafka topic

## Guide

### Step 0: Example Data Definition and Business Logic Goals

Let's envision a situation where vehicles continuously report their state to the Kafka topic. Messages in the topic take the following structure:

- `key`: a unique String identifying this vehicle
- `value`: a JSON string that looks like:
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

### Step 1: `KafkaConsumer` Instantiation

Instantiate a `KafkaConsumer` -- nothing special here, and certainly familiar to veteran Kafka users.

```java
// Assets.java
import java.util.Properties;
import org.apache.kafka.clients.consumer.KafkaConsumer;

public final class Assets {

  private Assets() {
  }

  private static KafkaConsumer<String, String> kafkaConsumer;

  public static KafkaConsumer<String, String> kafkaConsumer() {
    return Assets.kafkaConsumer;
  }

  private static KafkaConsumer<String, String> loadKafkaConsumer() {
    final Properties props = new Properties();
    props.setProperty("bootstrap.servers", "your-bootstrap-host:9092");
    props.setProperty("group.id", "your-group");
    props.setProperty("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
    props.setProperty("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
    // Alternatively, load above from a .properties file
    return new KafkaConsumer<>(props);
  }

  public static void init() {
    Assets.kafkaConsumer = loadKafkaConsumer();
  }

}
```

`Assets.kafkaConsumer` will be the bridge between the Kafka topic and the Swim server.

### Step 2: `KafkaConsumerAgent` Implementation

The Kafka-recommended pattern for consuming messages with a `KafkaConsumer` looks like:

```java
while (true) {
  ConsumerRecords<?, ?> records = yourConsumer.poll(YOUR_POLL_DURATION_MS);
  for (ConsumerRecord<?, ?> record : records) {
    // Do something with record
  }
}
```

This is all it takes to that (clearly blocking) pattern within a Web Agent:

```java
// KafkaConsumingAgent.java
import java.time.Duration;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import swim.api.agent.AbstractAgent;
import swim.concurrent.AbstractTask;
import swim.concurrent.TaskRef;

public class KafkaConsumingAgent extends AbstractAgent {

  // asyncStage() can safely run blocking, long-running operations
  private final TaskRef endlessConsumingTask = asyncStage().task(new AbstractTask() {

        @Override
        public void runTask() {
          while (true) {
            final ConsumerRecords<String, String> records = Assets.kafkaConsumer()
                .poll(Duration.ofMillis(100));
            for (ConsumerRecord<String, String> record : records) {
              // TODO: take an action on record
            }
          }
        }

        @Override
        public boolean taskWillBlock() {
          return true;
        }

      });

  @Override
  public void didStart() {
    this.endlessConsumingTask.cue();
  }

}
```

_Note: because `KafkaConsumingAgent` is the only class that that actively uses the `KafkaConsumer` class, you may choose to instantiate the `KafkaConsumer` instance from `KafkaConsumingAgent` instead. The current approach has the advantage of "fast-failing" the process, avoiding any part of the Swim server from starting if there is an issue reaching the Kafka topic._

**Warning:** When we configure the Web Agent nodeUri routing paths (e.g. within `server.recon`), ensure that only one instance of `KafkaConsumingAgent` can be instantiated.

### Step 3: `VehicleAgent` Implementation and Routing

The code so far is fully capable of consuming the topic's data. We must now create entities -- `VehicleAgents` -- that can accept and process this data. Each will merely contain a `CommandLane` (to receive messages) and a timeseries-type `MapLane` (to store them).

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
// KafkaConsumingAgent.java
// import ...
import swim.json.Json;
import swim.structure.Value;

public class KafkaConsumingAgent extends AbstractAgent {
  
  private final AbstractTask infiniteConsumingTask = asyncStage().task(new AbstractTask() {

        @Override
        public void runTask() {
          while (true) {
            final ConsumerRecords<String, String> records = Assets.kafkaConsumer()
                .poll(Duration.ofMillis(100));
            for (ConsumerRecord<String, String> record : records) {
              final String nodeUri = "/vehicle/" + record.key();
              final Value payload = Json.parse(record.value());
              command(nodeUri, "addMessage", payload);
            }
          }
        }

        // ...
}
```

### Step 4: Wrapping It Up

Minus the boilerplate that comes with every Swim application, namely:

- A `server.recon` to configure networking, routing, and additional kernels
- A runtime-providing `Plane`
- A `main()` method that loads the `KafkaConsumer` and the Swim server

we're completely done! A standalone, directly-runnable project can be found [here](https://github.com/swimos/cookbook/tree/master/kafka_ingestion).
