# Transform REST APIs into Fine-Grained Streaming APIs

## What is a fine-grained streaming API

A fine-grained streaming API provides direct access to entities and the fields they expose.
These APIs eliminate the need for polling, by allowing clients to subscribe to entity state that should be kept up to date with minimal overhead.
An entity will have state that drives differing use cases, and so the available data is must be sufficient for all supported cases.
With traditional coarse-grained APIs, that means more data is included than generally necessary, and re-transmitted each time an entity is updated.
With fine-grained streaming APIs, that can be avoided because changes are streamed and reconciled on the client-side since the previous state is already available, and only a differential update is needed.

## Benefits of Fine-Grained Streaming APIs

Fine-Grained streaming APIs achieve efficiency through elimination of:

- API requests that provide no value and consume client and server resources
- polling latency
- highly redundant data
- unwanted data on both the entitiy and field level

Clients invoke REST APIs to pull data for each update, whether the data has been updated or not.
Streaming API clients subscribe to the information they want, and Streaming APIs ensure that the client is provided the most recent state as it changes without further client requests.
Instead of N requests for N updates, Streaming API clients issue 1 subscription for N differential updates.

### REST API overhead

REST APIs are request-response based, forcing clients such as web applications and microservices to poll for new data.
With Streaming APIs, SwimOS clients can subscribe to state changes over a Websocket.
REST APIs generally end up being coarse-grained, as a client is forced to poll an entity for state changes by making explicit requests.
Rarely will this correspond the moment the entity has just been updated.
Instead, the object will likely not have changed at all, making the call a waste of time for caller and callee.
If it has changed, it is likely to not have just changed that very moment, so the time in between is pure suboptimal latency.
Regardless of whether the object has just changed or changed some time ago, it is likely to be the case that only a portion of the fields have changed, meaning every such update in the system is transmitting highly redundant information. 

### Streaming API efficiency

With a Streaming API, there is no need to poll, eliminating the guess work.
Unlike Coarse-grained APIs, where a lot of unwanted information gets forced on clients, Streaming APIs allow clients to subscribe to just the subset of data they need, both regarding specific entities, as well as specific  entity fields. 
Additionally, only the incremental changes are sent by Streaming APIs, after which the local update method gets invoked with the old and new values.

## How it works with SwimOS

With SwimOS, entities are represented by Web Agents that make each entity accessible via web URIs. 
The Web Agent definition is like a Java class, and the Web Agent instance is the instantiated object.
A few annotations are a available to map to SwimOS runtime capabilities on the server side. 
In a typical object, data is retrieved by calling hand-crafted methods or auto-generated accessors or even direct field access where permitted. 
With Web Agents, data fields are themselves end-points. 
These data fields are called lanes and come with built-in lifecycle methods to enable observing any and all transitions. 

A Web Agent comes into being the first time its referenced by its corresponding web URI.
The may be done withiin a server appication plane, a running Web Agent, or from client APIs.

There are a few basic components that identify a Web Agent and its available end-points:

- protocol -- warp:// or warps://
- host URI -- such as acme.com or localhost
- node URI -- such as booking/123 or monitor/bigbadmachine
- lane URI -- latest or history

All together, complete URIs could look like these:

- warps://acme.com/booking/123/latest
- warp://localhost:9001/monitor/bigbadmachine/history

The current runtime uses a protocol called WARP that is a highly optimized, open-source implementation of the Websocket protocol.
Because it is esentially a Websocket protocol, it is web native and first-nature to web applications.

The following steps can be followed to create the application:

1. Model your entities
2. Poll your REST APIs using the Http Connector
3. Parse the http response and send the data to Web Agents
4. Store the latest data for the Web Agent in its lane


### Model your entities

You will model your entities as Web Agents based on your REST API data.
A Web Agent is a class and an instance of it is an object that represents the stateful entity. 

#### Primitive data types

When an entity has a field with a primitive type, such as a string, boolean, or numeric type, the type is mapped to a SwimOS `ValueLane<DATA_TYPE>`.
The default generic type for all fields is Value, much like the JSON Value wrapped provided in several JSON libraries.
We can wrap Java primitives by declaring types such as `ValueLane<String>`, `ValueLane<Boolean>`, and `ValueLane<Integer>`.
Once we do so, clients are able to automaticaly observe all state transitions automatically.

#### Object data types

When the entity has a field that is an object, such as another entity, SwimOS's `Value` type can be used to represent the object, such as `ValueLane<Value>`.
The object is expressed using a `Record` type that exposes slot notation to capture the key-value pairs, such as:

```java
Value myObject = Record.of()
    .slot("id", 123)
    .slot("name", "incognito")
    .slot("points", 15302);
```

#### Array data types

When the entity has a field that is an array, SwimOS's `Value` type can be used to represent the array, such as `ValueLane<Value>`.
The array is expressed using a `Record` type that exposes item notation to capture array items, such as:

```java
Value myArray = Record.of()
    .item(myObject)
    .item(mySecondObject)
    .item(myLastObject);
```

#### Collection types

When an entity has a field that is a collection, `MapLane<Value, Value>` can be used to represent the collection along with the expected collection methods.
A common use for map lanes is to use an id field (such as with a String or Long data type) as the key, or a timestamp as Long, or even another object as key, with type Value.

### Poll your REST APIs using the Http Connector

As you already have REST APIs, you can just poll from the backend instead of forcing all clients to do this.
Then from the backend, clients can use the more efficient streaming APIs.
Nstream provides a low-code <a href="https://www.nstream.io/docs/backend/http-ingress/">HTTP connector</a> that removes the boilerplate:

```
  @node {
    uri: "/agency/portland-sc"
    @agent(class: "http.adapter.AgencyAgent") {
      httpIngressConf: @httpIngressSettings {
        firstPollDelayMillis: 1000, # Wait 1s after Web Agent starts to begin polling
        pollIntervalMillis: 15000, # Subsequent 15s delay between timer ticks
        headers: {
          "User-Agent": "NstreamHttpAdapterDemo/4.0.0",
          "Accept-Encoding": "gzip"
        },
        endpointUrl: YOUR_REST_ENDPOINT
      }
    }
  }
```

An alternate approach is using `java.net.http.HttpClient` to periodically hit your REST endpoint:

```java
    return HttpRequest.newBuilder(URI.create(YOUR_REST_ENDPOINT))
        .GET()
        .headers("Accept-Encoding", "gzip")
        .build();
```

### Parse the http response and send the data to Web Agents

Web Agents get initialized on demand if they don't yet exist, so there is no need to explicitly instantiate them.
Once the application has data for a new entity, it can simply send the requisite data, without worrying about object creation.
The data is ultimately transmitted using SwimOS commands, which are streaming write mechanisms.

### Store the latest data for the Web Agent in its lane

Once the data arrives at the Web Agent, it is then written to the corresponding lanes using `ValueLane::set` or `MapLane::put`.

## Next steps

You may find it useful to look at this http ingestion example:
- https://www.swimos.org/guides/http-ingestion.html

This approach is utilized in our transit tutorial:
- https://github.com/swimos/tutorial-transit

Nstream provides a low-code HTTP connector that abstracts the polling and the routing logic using `HttpIngestingPatch`:
- https://www.nstream.io/docs/backend/http-ingress/
