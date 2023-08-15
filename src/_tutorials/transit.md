---
title: Transit Tutorial
layout: page
---

# Application Overview

The Transit Tutorial walks you step-by-step through creating a small, but fully functional end-to-end, streaming data application for conveying real-time city transit information. We will retrieve live transit information via UmoIQ's <a href="https://retro.umoiq.com/" target="_blank">NextBus API</a> for 6 Southern California transporation agencies. Then we will process this information to maintain location, speed, and acceleration information for each of the agency's vehicles. The goal of this application is demonstrate how to connect to a REST API and create a streaming API for each entity/domain object (here, Agency and Vehicle). The Streaming APIs can be consumed by third-party applications, whether browser-based applications using SwimOS's real-time map UI or standalone applications using the typescript client APIs.

# Stateful Entity Model

## How to Model Web Agents from Entities
We determine our entities in the same way we would if doing object oriented design, data modeling, or domain driven-design. We start at a conceptual level that partitions information with respect to distinct, immutable identities that encapsulate a common behavior for state that changes over time. In our case, the UmoIQ API allows callers to obtain live vehicle information based on agency. That essentially determines our entities if we don't over thing things: Agency and Vehicle.

### Modeling the `AgencyAgent`
We cannot call our target API without knowing the agency tags. We can retrieve this by using the following API:
- https://retro.umoiq.com/service/publicXMLFeed?command=agencyList

It takes no parameters and returns a list of Agency tags:

```xml
<body copyright="All data copyright agencies listed below and Umo IQ 2023.">
  <agency
    tag="glendale"
    title="Glendale Beeline"
    regionTitle="California-Southern"
  />
  ...
</body>
```

#### Specifying the Agency Web Agent
We will define our `AgencyAgent` by extending SwimOS's `AbstractAgent` that gives us an extensive range of capabilities with the convenience of inversion of control so we simply extend and override to express application specific details:

```java
public class AgencyAgent extends AbstractAgent {
  private static final Logger log = Logger.getLogger(AgencyAgent.class.getName());

    @Override
    public void didStart() {
        log.info(() -> String.format("Starting Agent:%s", nodeUri()));
    }
}
```

#### Defining the Agency data structure
Each Agency record provides a tag, title, and regionTitle. Though tag is essential, the others provide human readability, so we can add those to our Agency entity model and define our Web Agent:

```java
Value data = Record.of()
  .slot("tag", "glendale")
  .slot("title", "Glendale Beeline")
  .slog("regionTitle", "California-Southern")
```

#### Defining an Agency `ValueLane`
We can define a the equivalent of a member variable on the Web Agent called info and take action upon update:

```java
@SwimLane("info")
public ValueLane<Value> info = this.<Value>valueLane()
    .didSet((newValue, oldValue) -> {
      // take action
  });
```

We can update state within our Web Agent like this:

```java
this.info.set(data);
```

#### Defining an Agency `CommandLane`
We can provide an end-point to update it externally through a command like this:

```java

@SwimLane("addInfo")
public CommandLane<Value> addInfo = this.<Value>commandLane()
  .onCommand(this::onInfo);

private void onInfo(Value agency) {
  Value oldValue = info.get();
  info.set(agency);
}
```

#### Storing Agency vehicles in a `MapLane``
Since the purpose of the transit API is to retrieve vehicle information that must be retrieve with respect to Agency tag, we will also want to maintain a collection of vehicles. Let's map them by vehicle id:

```java
    @SwimLane("vehicles")
    public MapLane<String, Value> vehicles;
```

Great, now let's get to the Vehicle entity and its corresponding Web Agent representation.

### Modeling the `VehicleAgent`
Now that we have some Agency tags to work with, we are in a position to retrieve live data for an Agency's vehicles. We can using the following API for this: 

https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=ccrta&t=0

```xml
<body 
  copyright="All data copyright APL 2023."
>
  <vehicle
    id="2"
    routeTag="internal"
    dirTag="loop"
    lat="39.170158"
    lon="-76.895701"
    secsSinceReport="4"
    predictable="true"
    heading="262"
    speedKmHr="0"
  />
  <vehicle
    id="9"
    routeTag="marc"
    dirTag="loop"
    lat="39.160668"
    lon="-76.897818"
    secsSinceReport="8"
    predictable="true"
    heading="276"
    speedKmHr="56"
  />
<lastTime time="1691616124147"/>
</body></body>
```

#### Specifying the Vehicle Web Agent
As with `AgencyAgent`, we will define our `VehicleAgent` by extending SwimOS's `AbstractAgent`:

```java
public class VehicleAgent extends AbstractAgent {
  private static final Logger log = Logger.getLogger(VehicleAgent.class.getName());

    @Override
    public void didStart() {
    log.info(()-> String.format("Started Agent: %s", nodeUri()));
    }
}
```

#### Defining the Vehicle data structure
We can directly translate this to SwimOS data format:

```java
Value data = Record.of()
  .slot("id", "9")
  .slot("dirTag", "loop")
  .slot("lat", 39.160668)
  .slot("lon", -76.897818)
  .slot("secsSinceReport", 8)
  .slot("predictable", true)
  .slot("heading", "276")
  .slot("speedKmHr", 56);
```

#### Defining a Vehicle ValueLane
As before, we can specify a `ValueLane` on the Web Agent to represent this state:

```java
  @SwimLane("info")
  public ValueLane<Value> info = this.<Value>valueLane()
          .didSet((newValue, oldValue) -> {
            // take action
          });
```

#### Defining a Vehicle CommandLane
And we can take action like this:
```java

  @SwimLane("updateInfo")
  public CommandLane<Value> updateInfo = this.<Value>commandLane().onCommand(this::onUpdateInfo);

  private void onUpdateInfo(Value newValue) {
    final Value oldState = info.get();
    // potentially do something with old or new value
    this.info.set(newValue);

```

# Connect to Data Source

## Consuming data from a web API
Let's start by connecting to UmoIQ's live transit API. As you saw, the data format is XML. We'll be using `java.net.http.HttpClient`, which requires Java 11. If you are using an older version of Java, you can use `java.net.HttpUrlConnection` instead as shown <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/NextBusHttpAPI.java" target="_blank">here</a>.

This requires a wee bit of boilerplate, as shown below:
```
    private static HttpRequest requestForEndpoint(String endpoint) {
        return HttpRequest.newBuilder(URI.create(endpoint))
                .GET()
                .headers("Accept-Encoding", "gzip")
                .build();
    }
```

With that in hand, we can invoke it when loading Agency agents as show below. The key mechanism we use to go from XML to SwimOS's internal data format is `swim.xml.Xml`, which exposes `Xml.structureParser().documentParser()``.

```
    public static Value getVehiclesForAgency(HttpClient executor, String agency, long since) {
        final HttpRequest request = requestForEndpoint(endpointForAgency(agency, since));
        try {
            final HttpResponse<InputStream> response = executor.send(request,
                    HttpResponse.BodyHandlers.ofInputStream());
            return Utf8.read(new GZIPInputStream(response.body()), Xml.structureParser().documentParser());
            // Alternatively: convert GZIPInputStream to String, then invoke the more
            // familiar Xml.parse()
        } catch (Exception e) {
            e.printStackTrace();
            return Value.absent();
        }
    }
```

# Send to Data to Web Agents

## Converting at rest data to streaming data
Because we are not working with a naturally streaming data source like Kafka or Pulsar, the only instance in which we'll need to poll is upon ingestion. Fortunately SwimOS has timer and task facilities we can make use of. Here are the declarations:

```
private TimerRef timer;
private final TaskRef agencyPollTask = ...
```

To start polling, we'll define `initPoll()` to execute the TAskRef's cue() method:

```
    private void initPoll() {
        this.timer = setTimer((long) (Math.random() * 1000), () -> {
          this.agencyPollTask.cue();
          this.timer.reschedule(15000L);
        });
      }```

Now, we just need the TaskRef definition:

```
    private final TaskRef agencyPollTask = asyncStage().task(new AbstractTask() {
  
      private long lastTime = 0L; // This will update via API responses
  
      @Override
      public void runTask() {
        final String aid = agencyId();
        // Make API call
        final Value payload = NextBusHttpAPI.getVehiclesForAgency(Assets.httpClient(), aid, this.lastTime);
        // Extract information for all vehicles and the payload's timestamp
        //final List<Value> vehicleInfos = new ArrayList<>(payload.length());
        final Record vehicleInfos = Record.of();
        for (Item i : payload) {
          if (i.head() instanceof Attr) {
            final String label = i.head().key().stringValue(null);
            if ("vehicle".equals(label)) {
                final Value vehicle = i.head().toValue();
                final String vehicleUri = "/vehicle/" + aid + "/" + vehicle.get("id").stringValue();
                final Value vehicleInfo = vehicle.updatedSlot("uri", vehicleUri);
                vehicleInfos.add(vehicleInfo);
            } else if ("lastTime".equals(label)) {
              this.lastTime = i.head().toValue().get("time").longValue();
            }
          }
        }
        // Relay each vehicleInfo to the appropriate VehicleAgent
        command("/agency/" + aid, "addVehicles", vehicleInfos);
      }
  
      @Override
      public boolean taskWillBlock() {
        return true;
      }
  
    });
```


## Feeding Web Agents

Web Agents are URI addressable. We send them data via commands and create downlinks to receive data from them. You'll recall the `addInfo` `CommandLane` from earlier. We can invoke these end-points using SwimOS's warp protocol using a `WarpRef` and passing in the URL, the `ComandLane's` name, and any input, typically a value object, but sometimes Java primatives like String and Integer that will seamlessly get converted to and from `Value` objects.

```java
warp.command(agencyUri, "addInfo", someValue);
```

## Materializing Web Agents
To make use of the SwimOS runtime, we will define a our application entry-point by extending `AbstractPlane`. We are calling our application space, "transit." We will create a server to activate the SwimOS runtime and associate our application space with it. After starting the runtime, we can use the `Space` object as a `WarpRef` to interact with Web Agents using SwimOS's WARP protocol based on Websockets supercharged with multicast, multiplexing and delta encoding.

```java
public class TransitPlane extends AbstractPlane {
  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    final Space space = kernel.getSpace("transit");
    kernel.start();

    // use the space as a WarpRef and do something

    kernel.run(); // make the SwimOS runtime available to external clients
  }
}
```

We now have to define our application space in order to access the SwimOS runtime and make use of Web Agents. We will register our `TransitPlane` and our two Web Agents, `AgencyAgent` and `VehicleAgent` by creating a configuration file using SwimOS's JSON-like Recon format.

```
transit: @fabric {
    @plane(class: "swim.transit.TransitPlane")
    @node {
        pattern: "/agency/:id"
        @agent(class: "swim.transit.agent.AgencyAgent")
    }
    @node {
        pattern: "/vehicle/:agency/:id"
        @agent(class: "swim.transit.agent.VehicleAgent")
    }
}

@web(port: 9001) {
  space: "transit"
  @websocket {
    serverCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
    clientCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
  }
}
```

# Continuously Evaluate Business Logic in Web Agents

`ValueLane`, `MapLane`, and `CommandLane` provide a wide range of callback mechanisms for implementing business logic in response to streaming data. We will just utilize those for responding to incoming data. 

## Executing Agency logic

As seen previously, the `AgencyAgent`'s identification data will be stored in the `info` `ValueLane`, which will be populated using the `addInfo` `CommandLane`. We'll maintain a count of vehicles via the `vehicleCount` `ValueLane` to compute averages, and store that average in the `avgVehicleSpeed` `ValueLane`.

Our primary method for processing streaming data for the `AgencyAgent` will be through the `addVehicles` `CommandLane`.

```java
@SwimLane("count")
public ValueLane<Integer> vehicleCount;

@SwimLane("speed")
public ValueLane<Float> avgVehicleSpeed;

@SwimLane("addVehicles")
public CommandLane<Value> addVehicles = this.<Value>commandLane()
  .onCommand(this::onVehicles);

@SwimLane("addInfo")
public CommandLane<Value> addInfo = this.<Value>commandLane()
  .onCommand(this::onInfo);

@SwimLane("info")
public ValueLane<Value> info = this.<Value>valueLane()
  .didSet((n, o) -> {
    abortPoll();
    startPoll(n);
  });
```

 As we poll the UmoIQ live transit API, we'll publish the results through `addVehicles`, which invokes a private method called `onVehicles`. First we'll iterate over the new vehicles and remove any that are no longer active:

 ```java
private void onVehicles(Value newVehicles) {
  Map<String, Value> vehicleUpdates = new HashMap<>();

  for (Item v : newVehicles) {
    vehicleUpdates.put(v.get("uri").stringValue(), v.toValue());
  }

  updateVehicles(vehicleUpdates);

  // skipping other details
}

private void updateVehicles(Map<String, Value> newVehicles) {
  final Collection<Value> currentVehicles = this.vehicles.values();

  for (Value vehicle : currentVehicles) {
    if (!newVehicles.containsKey(vehicle.get("uri").stringValue())) {
      vehicles.remove(vehicle.get("uri").stringValue());
    }
  }
}
```

We'll compute the average vehicle speed with some trivial logic, as well as send updated state to each of the agency's `VehicleAgent`s using the `context` variable provided by `AbstractAgent` as a `WarpRef`.

```java
int speedSum = 0;

for (Value v : vehicleUpdates.values()) {
  final String vehicleUri = v.get("uri").stringValue();

  if (vehicleUri != null && !vehicleUri.equals("")) {
    context.command(vehicleUri, "addVehicle", v.toValue());
    addVehicle(vehicleUri, v);
    speedSum += v.get("speed").intValue();
  }
}

vehicleCount.set(this.vehicles.size());

if (vehicleCount.get() > 0) {
  avgVehicleSpeed.set(((float) speedSum) / vehicleCount.get());
}
```

# Tutorial application source code

Source code for the demo application can be found here:

<a href="https://github.com/swimos/tutorial-transit/blob/main/server" target="_blank">https://github.com/swimos/tutorial-transit/blob/main/server</a>

You can run `./gradlew run` fron ther server directory to run the backend. For a visual representation, see the next section.

# Real-time Map UI which Uses the Streaming API from the Web Agents

While it is reassuring to have console output of arriving data, a visiual represention is much more impactful and compelling. There is a simple HTML page provided in this tutorial's repository that you can open to see a visualization of buses moving along their routes on top of map: 

<a href="https://github.com/swimos/tutorial-transit/blob/main/ui/index.html" target="_blank">https://github.com/swimos/tutorial-transit/blob/main/ui/index.html</a>

By including a few SwimOS libraries, the HTML made includes a tiny bit of javascript to reference the host, the Web Agent uri, and the specific lane. Through calls to `swim.HTMLView`, `swim.MapboxView`, and `swim.GeoTreeView`, the incoming, real-time data stream from SwimOS gets plotted directly against the map.
