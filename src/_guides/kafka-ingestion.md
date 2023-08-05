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

- Kafka consumption and business logic coexist within a single Swim server process
- The runtime for Kafka consumption is itself implemented as Web Agents

Afterward, we will discuss how to fine-tune the solution to satisfy various types of sizing demands.

## Prerequisites

- Swim server libraries
- [Kafka Client libraries](https://mvnrepository.com/artifact/org.apache.kafka/kafka-clients)
- A network-accessible Kafka topic

## Step 0: Example Data Definition and Business Logic Goals

Let's envision a situation where uniquely identifiable vehicles continuously report their current location and speed to the Kafka topic. Messages in the topic take the following structure:

- `key`: a String representing the unique 
- `value`: a JSON string that looks like:
   ```
   {
    "id": (string),
    "latitude": (number),
    "longitude": (number),
    "speed": (number),
    "bearing": (number)
   }
   ```

We wish to track the past hour's worth of information for every vehicle using this data.

## Step 1: `KafkaConsumer` Instantiation

Instantiate a `KafkaConsumer` -- nothing fancy here, and undoubtedly very familiar if you've worked with Kafka before.

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
    // Or, load above from a .properties file

    return new KafkaConsumer<>(props);
  }

}
```

`Main.kafkaConsumer0` will be the sole data bridge between the Kafka topic and the Swim server.

## Step 2: `KafkaConsumerAgent` Implementation

Because our Swim server will create a thread pool anyway, we will optimize for data locality and wrap all `KafkaConsumer` operations within a Web Agent that runs on the same pool.

```java
import java.time.Duration;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import swim.api.agent.AbstractAgent;
import swim.concurrent.AbstractTask;
import swim.concurrent.TaskRef;
import swim.concurrent.TimerRef;

public class KafkaConsumingAgent extends AbstractAgent {

  private TimerRef kafkaPollTimer;
  private TaskRef drainTopicTask;

  private void drain() {
    while (true) {
      final ConsumerRecords<String, String> records = Main.kafkaConsumer0.poll(Duration.ofMillis(100));
      if (records.isEmpty()) {
        return;
      }
      for (ConsumerRecord<String, String> record : records) {
        // TODO: what 
      }
    }
  }

  private void initConsumption() {
    this.drainTopicTask = asyncStage().task(new AbstractTask() {

      @Override
      public void runTask() {
        drain();
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

By now, we have 

## Step 3: `VehicleAgent` Implementation
