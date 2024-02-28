# Fine-Grained Streaming APIs from a Kafka Topic

## What is a fine-grained streaming API?

A fine-grained streaming API provides direct access to entities and the fields they expose.
These APIs eliminate the need for polling, by allowing clients to subscribe to entity state that should be kept up to date with minimal overhead.
An entity will have state that drives differing use cases, and so the available data must be sufficient for all supported cases.
With traditional coarse-grained APIs, that means more data is included than generally necessary, and re-transmitted each time an entity is updated.
With fine-grained streaming APIs, that can be avoided because changes are streamed and reconciled on the client side since the previous state is already available, and only a differential update is needed.

## Benefits of Fine-Grained Streaming APIs

Fine-grained streaming APIs achieve efficiency through the elimination of:

- API requests that provide no value and consume client and server resources
- Polling latency
- Highly redundant data
- Unwanted data on both the entity and field level

Clients invoke REST APIs to pull data for each update, whether the data has been updated or not.
Streaming API clients subscribe to the information they want, and Streaming APIs ensure that the client is provided the most recent state as it changes without further client requests.
Instead of N requests for N updates, Streaming API clients issue 1 subscription for N differential updates.

## How it works with SwimOS

### Step 0: Model your entities as Web Agents based on Kafka topics

With SwimOS, entities are represented by Web Agents that make each entity accessible via web URIs. 
The <a href="https://www.swimos.org/reference/web-agents.html" target="_blank">Web Agent</a> definition is like a Java class, and the Web Agent instance is the instantiated object.
In a typical object, data is retrieved by calling hand-crafted methods, auto-generated accessors, or even direct field access where permitted. 
With Web Agents, data fields are themselves end-points. 

The core agent functionality can be obtained by extending from `swim.api.agent.AbstractAgent`. 
The `@SwimLane` annotation is available to specify streaming API endpoints on the server:

```java
public class VehicleAgent extends AbstractAgent {
    @SwimLane("vehicles")
    public MapLane<String, Value> vehicles = this.<String, Value>mapLane();
}
```

You can also make use of the `context` provided by `AbstractAgent` to send commands, as in the example below:

```java
context.command(vehicleUri, "updateVehicle", v.toValue());
```

These data fields are called <a href=" https://www.swimos.org/reference/lanes.html" target="_blank">lanes</a> and come with built-in lifecycle methods to enable observing all transitions. Here is an example of a callback on a `CommandLane`:

```java
  @SwimLane("publish")
  CommandLane<Integer> publish = this.<Integer>commandLane()
      .onCommand((Integer msg) -> {
        logMessage("'publish' commanded with " + msg);
      });
```

And here is a `ValueLane` example:

```java
  @SwimLane("vehicle")
  public ValueLane<Value> vehicle = this.<Value>valueLane()
          .didSet((nv, ov) -> {
            log.info("vehicle changed from " + Recon.toString(nv) + " from " + Recon.toString(ov));
          });
```

And here is a `MapLane` example:

```java
  @SwimLane("ports")
  MapLane<String, String> ports = this.<String, String>mapLane()
       .didUpdate((key, newValue, oldValue) -> {
         logMessage("Port " + key + " value changed to " + newValue + " from " + oldValue);
       })
       .didRemove((key, oldValue) -> {
         logMessage("Port removed <" + key + "," + oldValue + ">");
       }).didClear(() -> logMessage("All ports removed"));
```

A Web Agent is instantiated the first time it is referenced by its corresponding URI.
This may be done within a server application plane, a running Web Agent, or from client APIs.

There are a few basic components that identify a Web Agent and its available end-points:

- protocol -- warp:// or warps://
- host URI -- such as acme.com or localhost
- node URI -- such as booking/123 or monitor/bigbadmachine
- lane URI -- latest or history

All together, complete URIs could look like these:

- `warps://acme.com/booking/123/latest`
- `warp://localhost:9001/monitor/bigbadmachine/history`

The current runtime uses a protocol called WARP which is a highly optimized, open-source implementation of the WebSocket protocol.
Because it is essentially a WebSocket protocol, it is web-native and first nature to web applications.

### Step 1: Using an agent, subscribe to Kafka topic

The two most common ways to do this are:

1. Using Nstream's high-level Kafka Connector
2. Using Confluent's low-level Consumer API

#### Kafka Connector Approach

Using Nstream's high-level Kafka Connector, you can ingest from Kafka by adding some configuration:

```
# server.recon
provisions: {
  @provision("consumer-properties") {
    class: "nstream.adapter.common.provision.PropertiesProvision",
    # Kafka consumer properties go here
    def: {
      "bootstrap.servers": "your-bootstrap-host:9092",
      "group.id": "your-group",
      "key.deserializer": "org.apache.kafka.common.serialization.StringDeserializer",
      "value.deserializer": "org.apache.kafka.common.serialization.StringDeserializer"
    }
  }
}

vehicle: @fabric {
  @plane(class: "nstream.adapter.runtime.AppPlane")
  # KafkaConsumingAgent replacement
  @node {
    uri: "/kafka"
    @agent(class: "nstream.adapter.kafka.KafkaIngestingPatch") {
      # KafkaIngressSettings values go here
      kafkaIngressConf: @kafkaIngressSettings {
        consumerPropertiesProvisionName: "consumer-properties"
        topics: {"schema-topic"}
        valueContentTypeOverride: "json"
        relaySchema: @command {
          nodeUri: {
            "/vehicle/",
            $key # $value$id will also work here
          },
          laneUri: "addMessage"
          value: $value
        }
      }
    }
  }
  # VehicleAgent config can be copied directly, but you'll of course
  # need to implement VehicleAgent in Java.
}

# Configure desired web settings (e.g. port, websocket compression)
# ...
```

#### Consumer API Approach

Here is an example of how you would utilize a Kafka consumer object within a Web Agent:

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
            final ConsumerRecords<String, String> records = yourKafkaConsumer()
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

### Step 2: Parse Kafka messages and send to Web Agents

```java
for (ConsumerRecord<String, String> record : records) {
  final String nodeUri = "/vehicle/" + record.key();
  final Value payload = Json.parse(record.value());
  command(nodeUri, "addMessage", payload);
}
```

### Step 3: Store the latest data for the Web Agent to a lane

Once the data arrives at the Web Agent, it is then written to the corresponding lanes using `ValueLane::set` or `MapLane::put`.

## Next steps

The following SwimOS documentation provides more details regarding kafka ingestion:

- <a href="https://www.swimos.org/guides/kafka-ingestion.html" target="_blank">Kafka ingestion</a>

Nstream's low-code Kafka connector takes care of the complexities of connecting to Kafka and subscribing to a topic. For more information, see:

- <a href="https://www.nstream.io/docs/backend/kafka-ingress/" target="_blank">Kafka ingress</a>

There is also a Kafka tutorial providing a full-blown example:

- <a href="https://www.nstream.io/docs/backend/kafka-vehicle-tutorial/" target="_blank">Kafka tutorial</a>