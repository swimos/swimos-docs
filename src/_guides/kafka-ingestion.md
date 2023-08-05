---
title: Kafka Ingestion
layout: page
description: "Utilize data from Kafka topics."
redirect_from:
  - /guides/kafka-ingestion/
cookbook: https://github.com/swimos/cookbook/tree/master/kafka_ingestion
---

This guide demonstrates how to ingest data hosted in Kafka topics and process it using business-logic-enabled Web Agents.

There is no single all-purpose design to message broker ingestion. We will first build the common case solution, where:

- Kafka consumption and business logic coexist within a single Swim server
- The runtime for Kafka consumption is itself a Web Agent

Afterward, we will discuss how to fine-tune the solution to satisfy various types of sizing demands.

## Prerequisites

- Swim server libraries
- [Kafka Client libraries](https://mvnrepository.com/artifact/org.apache.kafka/kafka-clients)
- A network-accessible Kafka topic

## The Common Case

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

Instantiate a `KafkaConsumer` -- nothing fancy here, and certainly familiar to veteran Kafka users.

```java
// Main.java
import java.util.Properties;
import org.apache.kafka.clients.consumer.KafkaConsumer;

public class Main {

  public static KafkaConsumer<String, String> kafkaConsumer0;

  private static KafkaConsumer<String, String> loadKafkaConsumer() {
    final Properties props = new Properties();
    props.setProperty("bootstrap.servers", "your-bootstrap-host:9092");
    props.setProperty("group.id", "your-group");
    props.setProperty("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
    props.setProperty("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
    // Alternatively, load above from a .properties file
    return new KafkaConsumer<>(props);
  }

}
```

`Main.kafkaConsumer0` will be the bridge between the Kafka topic and the Swim server.

### Step 2: `KafkaConsumerAgent` Implementation

By wrapping all `KafkaConsumer` operations within a Web Agent, we receive the following benefits and more:

- No separate runtime to maintain for consumption
- Data locality advantages
- The option to add metrics-reporting Lanes
- The option to stop/restart consumption via messages (e.g. using `CommandLanes`)

```java
// KafkaConsumingAgent.java
import java.time.Duration;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import swim.api.agent.AbstractAgent;
import swim.concurrent.AbstractTask;
import swim.concurrent.TaskRef;
import swim.concurrent.TimerRef;

public class KafkaConsumingAgent extends AbstractAgent {

  // Timer whose sole purpose is to cue the drain task. See initConsumption().
  private TimerRef kafkaPollTimer;
  // Task that eventually re-fires kafkaPollTimer upon completion, in effect re-cueing itself.
  private TaskRef drainTopicTask;

  // Potentially highly-blocking method, unsafe to invoke naively...
  private void drain() {
    while (true) {
      final ConsumerRecords<String, String> records = Main.kafkaConsumer0.poll(Duration.ofMillis(100));
      if (records.isEmpty()) {
        return;
      }
      for (ConsumerRecord<String, String> record : records) {
        // TODO: do something with record
      }
    }
  }

  private void initConsumption() {
    this.drainTopicTask = asyncStage().task(new AbstractTask() {

      @Override
      public void runTask() {
        drain(); // ...but proper asyncStage() delegations are fine
        KafkaConsumingAgent.this.kafkaPollTimer.reschedule(2000L);
      }

      @Override
      public boolean taskWillBlock() {
        return true;
      }

    });
    this.kafkaPollTimer = setTimer(0L, () -> {
      this.drainTopicTask.cue();
    });
  }

  @Override
  public void didStart() {
    initConsumption();
  }

}
```

**Warning:** Never replace the above with the Kafka-recommended paradigm of

```java
// Drain the topic while nonempty, or back off every POLL_DURATION milliseconds
while (true) {
  ConsumerRecords<?, ?> records = kafkaConsumer.poll(POLL_DURATION);
  for (ConsumerRecord<?, ?> record : records) {
    // do something with record
  }
}
```
directly in Web Agent callback functions. Refer to the [`asyncStage()` reference](/FIXME) to understand why.

### Step 3: `VehicleAgent` Implementation and Routing

The code so far is fully capable of consuming the topic's data. We will now create entities that can accept this data and execute business logic against it. These entities will be Web Agents of type `VehicleAgent`, each containing a `CommandLane` (to receive messages) and a timeseries-type `MapLane` (to store them).

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
  
  // ...
  private void drain() {
    while (true) {
      final ConsumerRecords<String, String> records = Main.kafkaConsumer0.poll(Duration.ofMillis(100));
      // ...
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

Minus the boilerplate that comes with every Swim application, we're completely done! A standalone, directly-runnable project can be found [here](/FIXME).

## Variations

### Multiple Kafka Topics

### Multiple Consumers To One Topic

### Multiple Processes
