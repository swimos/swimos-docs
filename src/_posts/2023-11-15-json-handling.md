---
redirect_from:
  - /blog/2023/11/15/json-handling.html
---

# Handling JSON data with SwimOS

## Overview

We're going to look how to handle JSON data with SwimOS. We'll look at three use cases:

1. parsing JSON data -- swim.json.Json.parse(String)
2. converting to JSON -- swim.json.Json.toString(Vallue)
3. Using the structure parser -- swim.json.Json.structureParser().valueParser()

We will demonstrate parsing a JSON string and sending it to a lane using a Swim Client to send the command and subscribe to notifications.

## Defining a Web Agent

So we'll have something to interact with, We'll create a Web Agent with two end-points:

1. ValueLane for storing state and feeding subscriptions
2. CommandLane for processing mutations to update state

```java
public class JsonTestAgent extends AbstractAgent {

  // ValueLane<Value> state, whose didSet(newValue, oldValue) callback prints newValue
  @SwimLane("state")
  ValueLane<Value> state = this.<Value>valueLane()
      .didSet((newValue, oldValue) -> {
        System.out.println("state: " + newValue);
      });

  // CommandLane<Value> addState, whose onCommand(value) callback invokes state.set(value)
  @SwimLane("addState")
  CommandLane<Value> addState = this.<Value>commandLane()
      .onCommand((Value value) -> {
	      // we use Value::get() to read a field's value
	      int currentIntValue = value.get("intValue").intValue();

	      // we use Value::updated() to update a field
	      this.state.set(value.updated("intValue", currentIntValue + 1));
      });

}
```

## Now Let's Handle the JSON

Within our client application's main, we'll instantiate and start SwimOS runtime, and then specify host and node URIs for our Web Agent.

```java
    final ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final String hostUri = "warp://localhost:9001"; // we specify the warp protocol instead of ws
    final String nodeUri = "/json-test/default"; // 'default' is the node ID
```

Before we go ahead and send data, let's register for notifications:

```java
    swimClient.downlink()
        .hostUri(hostUri)
	.nodeUri(nodeUri)
	.laneUri("state")
        .onEvent((Value event) -> {
		System.out.println("addState output (Recon) ->> " + Recon.toString(event));
		System.out.println("addState output (JSON) ->> " + Json.toString(event));
	    })
	.open(); // lane must be opened to receive updates
```

A common mistake when opening downlinks is to forget to invoke `open()` to open the stream. As you see, we use `Json.toString` to convert from a `Value` to JSON.

Finally, let's come up with some random data and toss it to the Web Agent:

```java
    String stateJson =
	  "{"
	+     "\"@state\":null,"
	+     "\"intValue\":5,"
	+     "\"strValue\":\"five\","
	+     "\"boolValue\":true,"
	+     "\"listValue\":[1,2,3],"
	+     "\"objectValue\":{\"a\":1,\"b\":2,\"c\":3}"
	+ "}";

    Value stateValue = Json.parse(stateJson);
    System.out.println("addState input (toString) ->> " + stateValue);
    
    swimClient.command(hostUri, nodeUri, "addState", stateValue);
```

Note the use of `Json.parse` to convert from JSON to `Value`.

## Parsing JSON from a Resource File

We can parse JSON from application resources with the following function:

```java
  public static Value loadJsonResource(String jsonResource) {
    Value jsonValue = null;
    InputStream jsonInput = null;
    try {
      jsonInput = MainPlane.class.getClassLoader().getResourceAsStream(jsonResource);
      if (jsonInput != null) {
        jsonValue = Utf8.read(Json.structureParser().valueParser(), jsonInput);
      }
    } catch (IOException cause) {
      throw new ParserException(cause);
    } finally {
      try {
        if (jsonInput != null) {
          jsonInput.close();
        }
      } catch (IOException swallow) {
      }
    }
    return jsonValue;
  }
```
