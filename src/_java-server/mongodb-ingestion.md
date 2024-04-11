---
title: MongoDB Ingestion
short-title: MongoDB Ingestion
description: "How to poll and process data from MongoDB within Web Agents"
group: Data Ingestion
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/mongodb_ingestion
redirect_from:
  - /guides/mongodb-ingestion.html
  - /backend/mongodb-ingestion/
---

This guide illustrates how to develop a Swim application that polls data from MongoDB and instantiates logic-performing Web Agents.

We accomplish this by declaring two types of Web Agents:

- A singleton `MongoDbPollAgent` responsible for polling and relaying documents to...
- ...a dynamic number of `VehicleAgents` whose callback functions define the business logic.

## Prerequisites

- Swim server libraries
- [MongoDB Client libraries](https://mvnrepository.com/artifact/org.mongodb/mongodb-driver-sync)
- A network-accessible MongoDB deployment

## Guide

### Step 0: Example Data Definition and Business Logic Goals

Let's envision a situation where vehicle metadata is stored in a Mongo database.
Documents in the `vehicle` collection have the following format:

```
{
  "id": (string),
  "make": (string),
  "model": (string),
  "depot": (string),
  "capcity": (number)
}
```

We wish to instantiate a web agent for each document in the vehicles collection, the agents can then be used to run some business logic.

### Step 1: `MongoClient` Instantiation

Instantiate a `MongoClient` - we configure a singleton Mongo client that we can use to connect and poll.
Any client settings can be added here, maybe loading them from some properties file.

```java
// Assets.java
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;

public final class Assets {

  private Assets() {
  }

  private static MongoClient mongoClient;

  public static MongoClient mongoClient() {
    return Assets.mongoClient;
  }

  private static MongoClient loadMongoClient() {
    // Here we can configure the MongoClient with additional settings - perhaps loaded from a properties file
    return MongoClients.create("mongodb://myConnectionString");
  }

  public static void init() {
    Assets.mongoClient = loadMongoClient();
  }

}
```

`Assets.mongoClient` will be the bridge between the Mongo database and the Swim server.

We could instantiate a client locally in the agent that needs to poll, however, `MongoClient` acts as a connection pool and so this allows multiple agents to use the client concurrently. 

### Step 2: `MongoDbPollingAgent` Implementation

Now we are going to implement the web agent responsible for polling the database and processing the received documents.

Let's first create a method that defines the query we are going to run.
In this case we are going to use the MongoDB `find` operation to fetch every document in the collection - for more advanced queries check out the [MongoDB documentation](https://www.mongodb.com/docs/drivers/java/sync/current/usage-examples/find/).
```java
private FindIterable<Document> find() {
    return Assets.mongoClient().getDatabase("myDatabase")
        .getCollection("myCollection")
        .find();
  }
```

Using the MongoDB-recommended pattern for looping through results with a `MongoCursor`, we obtain:

```java
private void poll() {
  try (MongoCursor<Document> cursor = find().cursor()) {
    while (cursor.hasNext()) {
      processDocument(cursor.next());
    }
  }
}

private void processDocument(final Document document) {
  // Process a document received from a poll
}
```

The method `processDocument(Document)` can now be used as a callback to process every document returned by the poll.
In this case we are going to extract a unique identifier (`id`) to build a node URI and forward the document to the correct vehicle agent (vehicle agent will be defined in the next step).

We finish the agent by scheduling a poll to run asynchronously of the agent thread on agent startup:

_See the [timers guide]({% link _java-server/timers.md %}) for more information on how we could poll continuously with a given time interval._
```java
// MongoDbPollingAgent
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCursor;
import org.bson.Document;
import swim.api.agent.AbstractAgent;
import swim.json.Json;
import swim.structure.Value;

public class MongoDbPollingAgent extends AbstractAgent {

  private FindIterable<Document> find() {
    return Assets.mongoClient().getDatabase("myDatabase")
        .getCollection("myCollection")
        .find();
  }

  private void poll() {
    try (MongoCursor<Document> cursor = find().cursor()) {
      while (cursor.hasNext()) {
        processDocument(cursor.next());
      }
    }
  }

  private void processDocument(final Document document) {
    final Value body = Json.parse(document.toJson());
    final String nodeUri = "/vehicle/" + body.get("id").longValue();
    command(nodeUri, "addMessage", body);
  }

  @Override
  public void didStart() {
    asyncStage().task(this::poll).cue();
  }

}
```

{% include alert.html title='Warning' text='When we configure the Web Agent node URI routing paths (e.g. within <strong>server.recon</strong>), ensure that only one instance of <strong>MongoDbPollingAgent</strong> can be instantiated.' %}

### Step 3: `VehicleAgent` Implementation

The code so far is fully capable of polling the database.
We must now create entities - `VehicleAgents` - that can accept and process this data.
Each will merely contain a `CommandLane` (to receive messages) and a `ValueLane` to retain them.

```java
// VehicleAgent.java
import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.structure.Value;

public class VehicleAgent extends AbstractAgent {

  @SwimLane("addMessage")
  CommandLane<Value> addMessage = this.<Value>commandLane()
      .onCommand(v -> this.metadata.set(v));

  @SwimLane("metadata")
  ValueLane<Value> metadata = this.<Value>valueLane()
      .didSet((n, o) -> System.out.println(nodeUri() + ": received " + n));

}
```

### Step 4: Wrapping It Up

Minus the boilerplate that comes with every Swim application, namely:

- A `server.recon` to configure networking, routing, and additional kernels
- A runtime-providing `Plane`
- A `main()` method that loads the `MongoClient` and the Swim server

We're completely done! A standalone, directly-runnable project can be found [here](https://github.com/swimos/cookbook/tree/master/mongodb_ingestion).
