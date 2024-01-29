---
title: JMS Ingestion
short-title: JMS Ingestion
description: "How to receive and process messages from JMS within Web Agents"
group: Data Ingestion
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/jms_ingestion
redirect_from:
  - /guides/jms-ingestion.html
---

This guide illustrates how to develop a Swim application that receives data from JMS and instantiates logic-performing Web Agents.

We accomplish this by declaring two types of Web Agents:

- A singleton `JmsAgent` responsible for receiving and relaying messages to...
- ...a dynamic number of `VehicleAgents` whose callback functions define the business logic.

## Prerequisites

- Swim server libraries
- A JMS provider client, we will be using [ActiveMQ](https://mvnrepository.com/artifact/org.apache.activemq/activemq-all)
- A network-accessible JMS deployment

## Guide

### Step 0: Example Data Definition and Business Logic Goals

Let's envision a situation where vehicles continuously report their state to the JMS topic.
Messages in the topic take the following structure:

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

### Step 1: `Connection` Instantiation

Instantiate a `ConnectionFactory` - we configure a singleton connection factory that we can use to create connections from.
ActiveMQ will be our JMS provider in this guide so an `ActiveMQConnectionFactory` is instantiated.
Any other connection settings can be added here, maybe loading them from some properties file.

We also provide a method to get or create a `Connection` from the `ConnectionFactory`.

```java
// Assets.java
import javax.jms.Connection;
import javax.jms.ConnectionFactory;
import javax.jms.JMSException;
import org.apache.activemq.ActiveMQConnectionFactory;

public final class Assets {

  private Assets() {
  }

  private static ConnectionFactory connectionFactory;
  private static Connection connection;

  public static ConnectionFactory connectionFactory() {
    return Assets.connectionFactory;
  }

  private static ConnectionFactory loadConnectionFactory() {
    // Here we can configure the ConnectionFactory with additional settings - perhaps loaded from a properties file
    return new ActiveMQConnectionFactory("tcp://activemq:61616");
  }

  public static void init() {
    Assets.connectionFactory = loadConnectionFactory();
  }

  public static Connection getOrCreateConnection() throws JMSException {
    if (Assets.connection == null) {
      Assets.connection = Assets.connectionFactory.createConnection();
    }
    return Assets.connection;
  }

}

```

`Assets.connectionFactory` will be the bridge between the JMS topic and the Swim server.

We could instantiate the `ConnectionFactory` or `Connection` in the agent, however, both can be used concurrently and so to save resources we use singletons.

### Step 2: `JmsAgent` Implementation

First we create a `subscribe()` method that will be responsible for getting a connection, starting a session and adding a message listener.

The method `processMessage(Message)` can now be used as a callback to process every message received from the topic.
In this case we are going to extract a unique identifier (`id`) to build a node URI and forward the message to the correct vehicle agent (vehicle agent will be defined in the next step).

We finish the agent by asynchronously calling the `subscribe()` method on startup.

```java
// JmsAgent.java
public class JmsAgent extends AbstractAgent {

  private void subscribe() {
    try {
      // Create a connection
      final Connection connection = Assets.getOrCreateConnection();
      connection.start();

      // Create a session
      final Session session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE);

      // Create a message consumer and process messages
      final MessageConsumer consumer = session.createConsumer(session.createTopic("myTopic"));
      consumer.setMessageListener(this::processMessage);
    } catch (JMSException jmsException) {
      jmsException.printStackTrace();
    }
  }

  private void processMessage(final Message message) {
    try {
      final Value body = Json.parse(((TextMessage) message).getText());
      final String nodeUri = "/vehicle/" + body.get("id").longValue();
      command(nodeUri, "addMessage", body);
    } catch (JMSException jmsException) {
      jmsException.printStackTrace();
    }
  }

  @Override
  public void didStart() {
    asyncStage().task(this::subscribe).cue();
  }

}
```

{% include alert.html title='Warning' text='When we configure the Web Agent node URI routing paths (e.g. within <strong>server.recon</strong>), ensure that only one instance of <strong>JmsAgent</strong> can be instantiated.' %}

### Step 3: `VehicleAgent` Implementation

The code so far is fully capable of receiving messages from a topic.
We must now create entities - `VehicleAgents` - that can accept and process this data.
Each will merely contain a `CommandLane` (to receive messages) and a [time series]({% link _backend/time-series.md %}) (to retain them).

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
      .onCommand(v -> this.history.put(v.get("timestamp").longValue(), v));

  @SwimLane("history")
  MapLane<Long, Value> history = this.<Long, Value>mapLane()
      .didUpdate((k, n, o) -> System.out.println(nodeUri() + ": received " + n));

}

```

### Step 4: Wrapping It Up

Minus the boilerplate that comes with every Swim application, namely:

- A `server.recon` to configure networking, routing, and additional kernels
- A runtime-providing `Plane`
- A `main()` method that loads the `ConnectionFactory` and the Swim server

We're completely done! A standalone, directly-runnable project can be found [here](https://github.com/swimos/cookbook/tree/master/jms_ingestion).
