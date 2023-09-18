---
title: Transit Tutorial
layout: page
---

# Application Overview

The Transit Tutorial walks you step-by-step through creating a small, but fully functional end-to-end, streaming data application for conveying real-time city transit information. We will retrieve live transit information via UmoIQ's <a href="https://retro.umoiq.com/" target="_blank">NextBus API</a> for 6 Southern California transportation agencies.

At a high level, the flow looks like this:

1.  We load agencies from CSV file to create an Agency Web Agent
2. This triggers a poller for acessing REST APIs for each Agency Agent
3. The REST API response is then used to update the AgencyAgent
4. The AgencyAgent update triggers messages to the Vehicle Agent

Then we will process this information to maintain location, speed, and acceleration information for each of the agency's vehicles. The goal of this application is to demonstrate how to connect to a REST API and create a streaming API for each entity/domain object (here, Agency and Vehicle). The Streaming APIs can be consumed by third-party applications, whether browser-based applications using SwimOS's real-time map UI or standalone applications using the typescript client APIs.

# Stateful Entity Model

## How to Model Web Agents from Entities
We determine our entities in the same way we would if doing object oriented design, data modeling, or domain driven-design. We start at a conceptual level that partitions information with respect to distinct, immutable identities that encapsulate a common behavior for state that changes over time. In our case, the UmoIQ API allows callers to obtain live vehicle information based on agency. That essentially determines our entities that will be represented as Web Agents: `AgencyAgent` and `VehicleAgent`.

### Modeling the `AgencyAgent`

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

We will be using a <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/resources/agencies.csv" target="_blank">csv file</a> to specify 6 Southern California agencies:

```
west-hollywood,S-CA,US
glendale,S-CA,US
glendale-beeline,S-CA,US
omnitrans,S-CA,US
pvpta,S-CA,US
ucla,S-CA,US
```

Each Agency record provides an id, a state (or in the case of California, Southern and Northern California), and the country. Though tag is essential, the others provide human readability, so we can add those to our Agency entity model and define our Web Agent:
{id:jhu-apl,state:MD,country:US,index:0}

```java
Value data = Record.of()
  .slot("id", "glendale")
  .slog("state", "S-CA")
  .slot("country", "US")
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
Since the purpose of the transit API is to retrieve vehicle information that must be retrieved with respect to Agency tag, we will also want to maintain a collection of vehicles. Let's map them by vehicle id:

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
  private long lastReportedTime = 0L;

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
  @SwimLane("vehicle")
  public ValueLane<Value> vehicle = this.<Value>valueLane()
          .didSet((newValue, oldValue) -> {
            // take action
          });
```

We can add whatever lanes we need to manage our processing needs. In this case, we want to maintain a list of the last 10 speeds and derive the last 10 accelerations.

```java
  @SwimLane("speeds")
  public MapLane<Long, Integer> speeds;

  @SwimLane("accelerations")
  public MapLane<Long, Integer> accelerations;
```

#### Defining a Vehicle CommandLane
`CommandLane`s are used by clients and other Web Agents to send notifications and trigger processing. 

```java

  @SwimLane("updateVehicle")
  public CommandLane<Value> updateVehicle = this.<Value>commandLane().onCommand(this::onUpdateVehicle);

  private void onUpdateVehicle(Value v) {
    final Value oldState = vehicle.get();
    final long time = System.currentTimeMillis() - (v.get("secsSinceReport").longValue(0) * 1000L);
    final int oldSpeed = oldState.isDefined() ? oldState.get("speed").intValue(0) : 0;
    final int newSpeed = v.get("speed").intValue(0);

    this.vehicle.set(v);
    this.speeds.put(time, newSpeed);
    if (this.speeds.size() > 10) {
      this.speeds.drop(speeds.size() - 10);
    }
    if (lastReportedTime > 0) {
      final float acceleration = (float) ((newSpeed - oldSpeed)) / (time - this.lastReportedTime) * 3600;
      this.accelerations.put(time, Math.round(acceleration));
      if (this.accelerations.size() > 10) {
        this.accelerations.drop(accelerations.size() - 10);
      }
    }
    this.lastReportedTime = time;
  }
```

# Connect to Data Source

## Consuming data from a web API
Let's start by connecting to UmoIQ's live transit API. As you saw, the data format is XML. We'll be using `java.net.http.HttpClient`, which requires Java 11. If you are using an older version of Java, you can use `java.net.HttpUrlConnection` instead as shown <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/NextBusHttpAPI.java" target="_blank">here</a>.

This requires a wee bit of boilerplate, as shown below:

```java
    private static HttpRequest requestForEndpoint(String endpoint) {
        return HttpRequest.newBuilder(URI.create(endpoint))
                .GET()
                .headers("Accept-Encoding", "gzip")
                .build();
    }
```

With that in hand, we can invoke it when loading Agency agents as shown below. The key mechanism we use to go from XML to SwimOS's internal data format is `swim.xml.Xml`, which exposes `Xml.structureParser().documentParser()``.

```java
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

```java
private TimerRef timer;
private final TaskRef agencyPollTask = ...
```

To start polling, we'll define `initPoll()` to execute the TaskRef's cue() method:

```java
    private void initPoll() {
        this.timer = setTimer((long) (Math.random() * 1000), () -> {
          this.agencyPollTask.cue();
          this.timer.reschedule(15000L);
        });
      }```

Now, we just need the TaskRef definition:

```java
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
        onVehicles(vehicleInfos);
      }
  
      @Override
      public boolean taskWillBlock() {
        return true;
      }
  
    });
```


## Feeding Web Agents

Web Agents are URI addressable. We send them data via commands and create downlinks to receive data from them. You'll recall the `addInfo` `CommandLane` from earlier. We can invoke these end-points using SwimOS's warp protocol using a `WarpRef` and passing in the URL, the `ComandLane`'s name, and any input, typically a value object, but sometimes Java primitives like String and Integer that will seamlessly get converted to and from `Value` objects.

```java
warp.command(agencyUri, "addInfo", someValue);
```

We will load static `AgencyAgent` data via our CSV file. Let's define a `loadAgencies()` method for this. Most of this is boilerplate Java. The `SwimOS` specific part involves creating a `Record` object, `agencies`, to represent a list of objects, as well as an additional `Record` object to represent the fields of each agent element. In addition to the static data from the CSV, we derive an `index` field.

```
  private static Value loadAgencies() {
    Record agencies = Record.of();
    InputStream is = null;
    Scanner scanner = null;
    try {
      is = TransitPlane.class.getResourceAsStream("/agencies.csv");
      scanner = new Scanner(is, "UTF-8");
      int index = 0;
      while (scanner.hasNextLine()) {
        final String[] line = scanner.nextLine().split(",");
        if (line.length >= 3) {
          Value newAgency = Record.of().slot("id", line[0]).slot("state", line[1]).slot("country", line[2]).slot("index", index++);
          agencies.item(newAgency);
        }
      }
    } catch (Throwable t) {
      log.severe(()->String.format("Exception thrown\n%s", t));
    } finally {
      try {
        if (is != null) {
          is.close();
        }
      } catch (IOException ignore) {
      }
      if (scanner != null) {
        scanner.close();
      }
    }
    return agencies;
  }
```

## Materializing Web Agents
To make use of the SwimOS runtime, we will define our application entry-point by extending `AbstractPlane`. We are calling our application space, "transit." We will create a server to activate the SwimOS runtime and associate our application space with it. After starting the runtime, we can use the `Space` object as a `WarpRef` to interact with Web Agents using SwimOS's WARP protocol based on Websockets supercharged with multicast, multiplexing and delta encoding.

As this is the entry point of our application, it is a logical place to initialize static data. Here we will invoke a method to start `AgencyAgents`:

```java
public class TransitPlane extends AbstractPlane {
  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    final Space space = kernel.getSpace("transit");
    kernel.start();
    log.info("Running TransitPlane...");
    startAgencies(space);
    kernel.run(); // blocks until termination
  }
}
```

Starting an agent is accomplished by simply sending a message to a known Web Agent type. We can do that by sending a command to a lane. It isn't even important if the lane exists or not. Since we are initializing state, it makes sense to invoke the `AgencyAgent`'s `addInfo` command.

```java
  private static void startAgencies(WarpRef warp) {
    final Value agencies = loadAgencies();
    for (Item agency : agencies) {
      log.info(Recon.toString(agency));
      String agencyUri = "/agency/" +
              agency.get("id").stringValue();
      warp.command(agencyUri, "addInfo", agency.toValue());
    }
    try {
      Thread.sleep(3000);
    } catch (InterruptedException e) {

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

The source can be found <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/resources/server.recon" target="_blank">here</a>.

# Continuously Evaluate Business Logic in Web Agents

`ValueLane`, `MapLane`, and `CommandLane` provide a wide range of callback mechanisms for implementing business logic in response to streaming data. We will just utilize those for responding to incoming data. 

## Executing Agency logic

As seen previously, the `AgencyAgent`'s identification data will be stored in the `info` `ValueLane`, which will be populated using the `addInfo` `CommandLane`. We'll maintain a count of vehicles via the `vehicleCount` `ValueLane` to compute averages, and store that average in the `avgVehicleSpeed` `ValueLane`.

Our primary method for processing streaming data for the `AgencyAgent` will be through `agencyPollTask.runTask()` which invokes `onVehicles()`.

```java
@SwimLane("count")
public ValueLane<Integer> vehicleCount;

@SwimLane("speed")
public ValueLane<Float> avgVehicleSpeed;

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

 As we poll the UmoIQ live transit API, we'll publish the results by invoking `onVehicles`. First we'll iterate over the new vehicles and remove any that are no longer active:

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
    context.command(vehicleUri, "updateVehicle", v.toValue());
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

You can run `./gradlew run` from the server directory to run the backend. For a visual representation, see the next section.

# Observing state changes via `swim-cli`

The SwimOS platform provides a CLI tool, <a href="https://www.swimos.org/guides/cli.html" target="_blank">`swim-cli`</a> that makes it simple to stream data from Web Agents. It can be installed globally as follows: 

```
npm install -g @swim/cli
```

## Streaming `AgencyAgent`` data to the command line
Let's try retrieving values for the glendale agency (make sure the swim application is running from the server directory via `./gradlew run`):

```
swim-cli link -h warp://localhost:9001 -n /agency/glendale -l vehicles 
```

Here is some sample output, your results will vary, naturally. Note three vehicles drop off the list of vehicles and have been removed, while the next three vehicles have received updates:

```
@remove(key:"/vehicle/glendale/B73")
@remove(key:"/vehicle/glendale/B75")
@remove(key:"/vehicle/glendale/B79")
@update(key:"/vehicle/glendale/B98"){id:glendale,uri:"/vehicle/glendale/B98",agency:glendale,dirId:SBrivpac,latitude:34.14249,longitude:-118.26002,speed:28,secsSinceReport:9,heading:"90"}
@update(key:"/vehicle/glendale/B99"){id:glendale,uri:"/vehicle/glendale/B99",agency:glendale,dirId:"2britc_d",latitude:34.1261,longitude:-118.25915,speed:38,secsSinceReport:4,heading:"55"}
@update(key:"/vehicle/glendale/B67"){id:glendale,uri:"/vehicle/glendale/B67",agency:glendale,dirId:gga,latitude:34.133774,longitude:-118.24615,speed:36,secsSinceReport:2,heading:"91"}
```

As with the web page, simple change the `nodeUri` to view data from a different agency:

```
swim-cli link -h warp://localhost:9001 -n /agency/west-hollywood -l vehicles 
```

```
@update(key:"/vehicle/west-hollywood/116"){id:west-hollywood,uri:"/vehicle/west-hollywood/116",agency:west-hollywood,dirId:CLWB_1_var0,latitude:34.08677,longitude:-118.37749,speed:32,secsSinceReport:15,heading:"6"}
```

## Streaming VehicleAgent data to the command line

To stream data to a `VehicleAgent`, you can use the following command below. You can switch out the agency id and vehicle id for the `nodeUri`. Examples can be seen from the `AgencyAgent` output.

``````
swim-cli link -h warp://localhost:9001 -n /vehicle/west-hollywood/116 -l vehicle
```

which yields:

```
{id:"116",routeTag:CLEB,dirTag:CLEB_0_var0,lat:"34.083697",lon:"-118.387662",secsSinceReport:"6",predictable:true,heading:"322",speedKmHr:"11",uri:"/vehicle/west-hollywood/116"}
{id:"116",routeTag:CLEB,dirTag:CLEB_0_var0,lat:"34.084492",lon:"-118.386684",secsSinceReport:"8",predictable:true,heading:"51",speedKmHr:"32",uri:"/vehicle/west-hollywood/116"}
```