---
title: Transit Tutorial
layout: page
---

# Application Overview

The Transit Tutorial walks you step-by-step through creating a small, but fully functional end-to-end, streaming data application for conveying real-time city transit information. We will retrieve live transit information via UmoIQ's <a href="https://retro.umoiq.com/" target="_blank">NextBus API</a> for 46 different transporation agencies. Then we will process this information to maintain location, speed, and acceleration information for each of the agency's vehicles. The goals of this application will be the uninterrupted stream processing of speed and acceleration information for each Agency's vehicles, without dropping below network speeds until terminating at all destination points to browser applications.

# Stateful Entity Model
Given the real-time nature of this application, we will process state in-flight and deliver it to the receiving browser application without coming to rest. We will only pull data at ingestion time, when we pull live transit information from the UmoIQ api into our streaming data application. Afterward, all data will remain in flight, never dropping below network speeds, because all processing will be performed in CPU and memory latencies, which are orders of magnitude faster than the network, keeping the data moving at network speeds until arriving at the browser application. 

We will stream entities rather than their events, by accumulating incremental state updates to provide a real-time representation of all important state in our use case. We will accomplish this by utilizing Web Agents, which are built from the ground up to do this at scale.

Web Agents mitigate the trouble of dealing with state by transmitting precise change data to every streaming API client. When a Web Agent updates one of its states, it internally flags every API client currently observing that state as out-of-date. In parallel, when a connection to an API client is ready to send a packet, the platform transmits the highest priority delta between the current state and the known state of the client. We get all of this for free.

## How to Model Web Agents from Entities
We determine our entities in the same way we would if doing object oriented design, data modeling, or domain driven-design. We start at a conceptual level that partitions information with respect to distinct, immutable identities that encapsulate a common behavior for state that changes over time. In our case, the UmoIQ API allows callers to obtain live vehicle information based on agency. That essentially determines our entities if we don't over thing things: Agency and Vehicle.

### Modeling the `AgencyAgent`
We cannot call our target API without knowing the agency tags. We can retrieve this by using the following API:
- https://retro.umoiq.com/service/publicXMLFeed?command=agencyList

It takes no parameters and returns a list of Agency tags:

```xml
<body copyright="All data copyright agencies listed below and Umo IQ 2023.">
  <agency
    tag="jhu-apl"
    title="APL"
    regionTitle="Maryland"
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
  .slot("tag", "jhu-apl")
  .slot("title", "APL")
  .slog("regionTitle", "Maryland")
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
Let's start by connecting to UmoIQ's live transit API. As you saw, the data format is XML. The SwimOS platform provides `Xml.structureParser` which offers a `documentParser()` method to convert to SwimOS internal data format. We can provide a simple web API request method that takes a URL and invokes its HTTP end-point to receive XML data. We will either return a populated `Value` object, or we will return an empty one, `Value.absent()`.

```java
    private static Value parse(URL url) {
        final HttpURLConnection urlConnection;
        try {
            urlConnection = (HttpURLConnection) url.openConnection();
            urlConnection.setRequestProperty("Accept-Encoding", "gzip, deflate");
            final InputStream stream = new GZIPInputStream(urlConnection.getInputStream());
            final Value configValue = Utf8.read(stream, Xml.structureParser().documentParser());
            return configValue;
        } catch (Throwable e) {
            log.severe(() -> String.format("Exception thrown:\n%s", e));
        }
        return Value.absent();
    }
```

## Parsing XML into SwimOS data structures
We can execute this method and iterate the results returned in the `Value`` object. Since Value are objects are generic, we will also check for a header attribute the document parser produces when parsing structured information:

```java
final URL url = new URL(pollUrl);
final Value vehicleLocs = parse(url);

if (vehicleLocs.isDefined()) {
  final Iterator<Item> it = vehicleLocs.iterator();
  final Record vehicles = Record.of();

  while (it.hasNext()) {
    final Item item = it.next();
    final Value header = item.getAttr("vehicle");

    if (header.isDefined()) {
      // now we know were are dealing we a vehicle record
      final String id = header.get("id").stringValue().trim();
      ...

      // we can process all the fields for the vehicle write it's state to the info object as previously demonstrated
      final Record vehicle = Record.of()
                            .slot("id", id)
                            ...;
      vehicles.add(vehicle);  
    }
  }

  // do something with the vehicles
}

```

# Send to Data to Web Agents
Because we are not working with a naturally streaming data source like Kafka or Pulsar, we have to poll to achieve continuous ingestion for an at rest data source. This is inevitable. Typically, the client application in the browser also has to poll, and there is often additional polling in the data processing network. We will suffer polling just in the required case of a non-streaming data source, then we'll provide uninterrupted streaming data all the way to the terminating browser clients without incurring non-negligible latency.

## Converting at rest data to streaming data
Fortunately SwimOS has timer and task facilities we can make use of. First, we'll declare the corresponding variables:

```java
    private TaskRef pollVehicleInfo;
    private TimerRef timer;
```

We will poll to obtain live transit information, and then continuously update it to enable streaming outward. Both tasks and timers provide `cancel()` methods, which we will use to stop polling. We'll also want to do this whenever we restart polling due to updating agency information. `AbstractTask` is used to define and instantiate a task. `runTask()` will define the recurring task. We instantiate a timer using `startTimer()`. In our case, we'll prepare the task via `cue()` and then set the timer with `reschedule()`.

```
    private void abortPoll() {
        if (this.pollVehicleInfo != null) {
            this.pollVehicleInfo.cancel();
            this.pollVehicleInfo = null;
        }
        if (this.timer != null) {
            this.timer.cancel();
            this.timer = null;
        }
    }

    private void startPoll(final Value ag) {
        abortPoll();

        // Define task
        this.pollVehicleInfo = asyncStage().task(new AbstractTask() {

            final Value agency = ag;
            final String url = String.format("https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=%s&t=0",
                    ag.get("id").stringValue());

            @Override
            public void runTask() {
                // for each agency, call transit API to receive vehicles

            }

            @Override
            public boolean taskWillBlock() {
                return true;
            }
        });

        // Define timer to periodically reschedule task
        if (this.pollVehicleInfo != null) {
            this.timer = setTimer(1000, () -> {
                this.pollVehicleInfo.cue();
                this.timer.reschedule(POLL_INTERVAL);
            });
        }
    }
```

## Feeding Web Agents

Web Agents are URI addressable. We send them data via commands, and we create downlinks to receive data from them. You'll recall the `addInfo` `CommandLane` from earlier. We can invoke these end-points using SwimOS's warp protocol using a `WarpRef` and passing in the URL, the `ComandLane's` name, and any input, typically a value object, but sometimes Java primatives like String and Integer that will seamlessly get converted to and from `Value` objects.

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

As seen previously, the `AgencyAgent`'s identification data will be stored in the `info` `ValueLane`, which will be populated using the `addInfo` `CommandLane`. We'll maintain a count of vehicles via the `vehicleCount` `ValueLane` to compute averages, and store that average in the `avgVehicleSpeed` `ValueLane`. Another thing we'll do is maintain a geo-spatial bounding box that encompasses all active agency vehicles via the `boundingBox` `ValueLane`.

Our primary method for processing streaming data for the `AgencyAgent` will be through the `addVehicles` `CommandLane`.

```java
@SwimLane("count")
public ValueLane<Integer> vehicleCount;

@SwimLane("speed")
public ValueLane<Float> avgVehicleSpeed;

@SwimLane("boundingBox")
public ValueLane<Value> boundingBox;

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

Lastly, for the bounding box, we'll simply accumulate the minimum and maximum values for longitude and latitude:

```java
float minLat = Integer.MAX_VALUE,
      minLng = Integer.MAX_VALUE,
      maxLat = Integer.MIN_VALUE,
      maxLng = Integer.MIN_VALUE;

for (Value v : vehicleUpdates.values()) {
  if (vehicleUri != null && !vehicleUri.equals("")) {
    if (v.get("latitude").floatValue() < minLat) {
      minLat = v.get("latitude").floatValue();
    }

    if (v.get("latitude").floatValue() > maxLat) {
      maxLat = v.get("latitude").floatValue();
    }

    if (v.get("longitude").floatValue() < minLng) {
      minLng = v.get("longitude").floatValue() ;
    }

    if (v.get("longitude").floatValue()  > maxLng) {
      maxLng = v.get("longitude").floatValue() ;
    }
  }
}

Value bb = Record.of()
  .slot("minLat", minLat)
  .slot("maxLat", maxLat)
  .slot("minLng", minLng)
  .slot("maxLng", maxLng);

boundingBox.set(bb);
```

# Tutorial application source code

Source code for the demo application can be found here:
- <a href="https://github.com/swimos/tutorial-transit/blob/main/server" target="_blank">https://github.com/swimos/tutorial-transit/blob/main/server</a>

# Real-time Map UI which Uses the Streaming API from the Web Agents

Next up
