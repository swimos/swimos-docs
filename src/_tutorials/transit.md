---
title: Transit Tutorial
layout: page
---

<<<<<<< Updated upstream
The Transit Tutorial walks you step-by-step through creating a small, but fully functional backend application for conveying real-time city transit information. The application involves four types of business entities: vehicles, agencies, states, and countries. These entities form a simple hierarchy where each vehicle falls under exactly one of 46 agencies. Each agency likewise falls under exactly one state, and each state falls under exactly one country.

Rather than simulating data, we will be utilizing an API provided by Cubic Transportation System's Umo Mobility Platform to retrieve real-time transit information -- NextBus, https://retro.umoiq.com/.
=======
# Application Overview

The Transit Tutorial walks you step-by-step through creating a small, but fully functional end-to-end, streaming data application for conveying real-time city transit information. We will retrieve live transit information via UmoIQ's <a href="https://retro.umoiq.com/" target="_blank">NextBus API</a> for 46 different transporation agencies. Then we will process this information to maintain location, speed, and acceleration information for each of the agency's vehicles. The goals of this application will be the uninterrupted stream processing of speed and acceleration information for each Agency's vehicles, without dropping below network speeds until terminating at all destination points to browser applications.
>>>>>>> Stashed changes

# Stateful Entity Model
Given the real-time nature of this application, we will process state in-flight and deliver it to the receiving browser application without coming to rest. We will only pull data at ingestion time, when we pull live transit information from the UmoIQ api into our streaming data application. Afterward, all data will remain in flight, never dropping below network speeds, because all processing will be performed in CPU and memory latencies, which are orders of magnitude faster than the network, keeping the data moving at network speeds until arriving at the browser application. 

<<<<<<< Updated upstream
Let’s start by creating the root project folder. We are calling the directory `transit` and the `server` sub-directory.

```console
$ mkdir -p transit/server
$ cd transit/server
=======
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
>>>>>>> Stashed changes
```

#### Specifying the Agency Web Agent
We will define our `AgencyAgent` by extending SwimOS's `AbstractAgent` that gives us an extensive range of capabilities with the convenience of inversion of control so we simply extend and override to express application specific details:

<<<<<<< Updated upstream
To build this application, we'll need the JDK for <a href="https://www.oracle.com/technetwork/java/javase/downloads/index.html">Java 11+</a>. Click <a href="https://www.oracle.com/technetwork/java/javase/downloads/index.html">here</a> for JDK installation instructions. In conjunction with this, make sure your `JAVA_HOME` environment variable is pointed to your Java installation location, and that your `PATH` includes `JAVA_HOME`.

#### Building with Gradle

We’ll be using Gradle to build the application, installation instructions can be found [here](https://gradle.org/install/). We'll start with some boilerplate that will generally require little changes across projects. First, we will download the gradle files from this <a href="https://github.com/swimos/project-starter/blob/main/java/gradle-files.tgz">tarball</a> or <a href="https://github.com/swimos/project-starter/blob/main/java/gradle-files.zip">zip archive</a>.

Then extract as appropriate to the server directory:

```console
tar zxvf gradle-files.tgz # Un-tar the tarball package
unzip gradle-files.zip # Unzip the zip file
```

### Project organization

#### Directory structure

From the root project directory, the directory structure should currently look like this:

```
- server
  - build.gradle
  - gradle
    - wrapper
      - gradle-wrapper.jar
      - gradle-wrapper.properties
  - gradlew
  - gradlew.bat
  - gradle.properties
  - settings.gradle
```

To fill out the Java application structure under `server`, just do the following:

```console
mkdir -p src/main/java/swim/transit/agent
mkdir -p src/main/resources
```

#### Creating the app configuration files

We will be creating the following configuration <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/resources/server.recon">file</a>:

```java
// server/src/main/resources/server.recon
@kernel(class: 'swim.reflect.ReflectKernel', optional: true)

transit: @fabric {
    @node {
        pattern: "/country/:id"
        @agent(class: "swim.transit.agent.CountryAgent")
    }
    @node {
        pattern: "/state/:country/:state"
        @agent(class: "swim.transit.agent.StateAgent")
    }
    @node {
        pattern: "/agency/:country/:state/:id"
        @agent(class: "swim.transit.agent.AgencyAgent")
    }
    @node {
        pattern: "/vehicle/:country/:state/:agency/:id"
        @agent(class: "swim.transit.agent.VehicleAgent")
=======
```java
public class AgencyAgent extends AbstractAgent {
  private static final Logger log = Logger.getLogger(AgencyAgent.class.getName());

    @Override
    public void didStart() {
        log.info(() -> String.format("Starting Agent:%s", nodeUri()));
>>>>>>> Stashed changes
    }
    @store {
        path: "/tmp/swim-transit/"
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

<<<<<<< Updated upstream
`@kernel` is used to specify kernel properties that determine runtime settings. Then, within the `@fabric` definition, we specify the Java class that will serve as our application entry point, `TransitPlane`. We define @store to use the file system as a lightweight backing store, though in-memory remains the primary state store.

Lastly, we need to configure the client-facing end-point. We do that using the @web directive where we set the port to `9001`. We tie the end-point to the fabric using the `space` property so it names the fabric’s key. We turn off websocket compression by setting `serverCompressionLevel` and `clientCompressionLevel` to 0.

We will be using a CSV file to load transit information for 46 transit agencies into Web Agents:
- https://raw.githubusercontent.com/swimos/transit/master/server/src/main/resources/agencies.csv

This CSV data file contains the fields for each agency: `id`, `state`, and `country`. It should be saved under `server/src/main/resources/`.

### First Contact

We will implement Web Agents for each of our entities under `server/src/main/java/swim/transit/agent/`:
- `AgencyAgent.java`
- `CountryAgent.java`
- `StateAgent.java`
- `VehicleAgent.java`

#### Creating a Web Agent

We will now create a barebones Web Agent for the vehicle entity, <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/agent/VehicleAgent.java">VehicleAgent.java</a>. To do that, we’ll start by extending `AbstractAgent` and override the `didStart()` method:
=======
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
>>>>>>> Stashed changes

```java
package swim.transit.agent;

<<<<<<< Updated upstream
import swim.api.agent.AbstractAgent;
import java.util.logging.Logger;

public class VehicleAgent extends AbstractAgent {
  private static final Logger log = Logger.getLogger(VehicleAgent.class.getName());

  @Override
  public void didStart() {
    log.info(()-> String.format("Started Agent: %s", nodeUri()));
  }

=======
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
>>>>>>> Stashed changes
}

```

<<<<<<< Updated upstream
#### Creating the App Plane

We will define our application entry point under `server/src/main/java/swim/transit/` as <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/TransitPlane.java">TransitPlane.java</a>. We can do this by extending `TransitPlane` from the `AbstractPlane` base class, which will allow us to declare the application routes. The agent corresponding to each route is declared using the `@SwimAgent` annotation. The application routes are declared using the `@SwimRoute` annotation. The route itself is defined via the generic `AgentRoute` type.

```java
package swim.transit;

import swim.api.*;
import swim.api.plane.AbstractPlane;
import swim.api.space.Space;
import swim.kernel.Kernel;
import swim.server.ServerLoader;
import swim.transit.agent.VehicleAgent;
import swim.structure.Value;
import java.util.logging.Logger;

public class TransitPlane extends AbstractPlane {
  private static final Logger log = Logger.getLogger(TransitPlane.class.getName());

  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    final Space space = kernel.getSpace("transit");

    kernel.start();
    log.info("Running TransitPlane...");

    space.command("/vehicle/US/CA/poseurs/dummy", "fake", Value.empty());

    kernel.run(); // blocks until termination
=======
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
>>>>>>> Stashed changes
  }
}
```

<<<<<<< Updated upstream
#### Interacting with Web Agent

Now we can run the application and confirm that the plane starts up and an agent is instantiated within the plane. From the server directory, run the following:
```console
./gradlew build
./gradlew run
```

We'll see that our plane has started and that the VehicleAgent is running.

#### Handling a Command

We will define a CommandLane that receives commands to update the state managed by a VehicleAgent whenever new values for that state are returned by the traffic API. Our vehicle data has been stored in a `Value` object that exposes `get()` methods to retrieve data from a generic structure. We will store the `Value` by defining a `ValueLane` and adding a handler that logs each state change.

```java
import swim.api.SwimLane;
import swim.api.lane.CommandLane;
import swim.api.lane.ValueLane;
import swim.recon.Recon;
import swim.structure.Record;
import swim.structure.Value;

...

  @SwimLane("vehicle")
  public ValueLane<Value> vehicle = this.<Value>valueLane()
          .didSet((newValue, oldValue) -> {
            log.info("vehicle changed from " + Recon.toString(newValue) + " from " + Recon.toString(oldValue));
          });

  @SwimLane("updateVehicle")
  public CommandLane<Value> addVehicle = this.<Value>commandLane().onCommand(this::onUpdateVehicle);

  private void onUpdateVehicle(Value v) {
    this.vehicle.set(v);
  }

```

Lastly, we’ll invoke `updateVehicle` from the TransitPlane changing the command lane from `fake` to `updateVehicle` so that the line below

```java
space.command("/vehicle/US/CA/poseurs/dummy", "fake", Value.empty());
```

becomes

```java
      Record dummyVehicleInfo = Record.of()
              .slot("id", "8888")
              .slot("uri", "/vehicle/US/CA/poseurs/dummy/8888")
              .slot("dirId", "outbound")
              .slot("index", 26)
              .slot("latitude", 34.07749)
              .slot("longitude", -117.44896)
              .slot("routeTag", "61")
              .slot("secsSinceReport", 9)
              .slot("speed", 0)
              .slot("heading", "N");
  
      space.command("/vehicle/US/CA/poseurs/dummy", "updateVehicle", dummyVehicleInfo);
```

Think of `Record` as a `JSON object`, with slots being the key-value pairs. Let’s re-run now to confirm that our command has been received and the state has been stored:

```console
./gradlew build
./gradlew run
```

#### Acting on state changes

We'll now modify `VehicleAgent` a bit more to derive acceleration from time and speed, as well as store the last 10 speed and acceleration data points.

```java
  private long lastReportedTime = 0L;

  @SwimLane("speeds")
  public MapLane<Long, Integer> speeds;

  @SwimLane("accelerations")
  public MapLane<Long, Integer> accelerations;
```

You can now modify `onUpdateVehicle` to handle acceleration and speed. 

```java
import swim.api.lane.MapLane;

...

 private void onUpdateVehicle(Value v) {
    final Value oldState = vehicle.get();
    final long time = System.currentTimeMillis() - (v.get("secsSinceReport").longValue(0) * 1000L);
    final int oldSpeed = oldState.isDefined() ? oldState.get("speed").intValue(0) : 0;
    final int newSpeed = v.get("speed").intValue(0);

    this.vehicle.set(v);
    speeds.put(time, newSpeed);
    if (speeds.size() > 10) {
      speeds.drop(speeds.size() - 10);
    }
    if (lastReportedTime > 0) {
      final float acceleration = (float) ((newSpeed - oldSpeed)) / (time - lastReportedTime) * 3600;
      accelerations.put(time, Math.round(acceleration));
      if (accelerations.size() > 10) {
        accelerations.drop(accelerations.size() - 10);
      }
    }
    lastReportedTime = time;
  }
```

Let’s re-run our code to observe recordings of speed and derivations of acceleration:
```console
./gradlew build
./gradlew run
```

### Implement agents for transit domain

We’ve already implemented VehicleAgent, so we’ll move on to the remaining agents for state, country, and agent.

#### Implement AgencyAgent

##### Implement NextBusHttpAPI transit wrapper

There are two public transit APIs we will connect to from UmoIQ (https://retro.umoiq.com/xmlFeedDocs/NextBusXMLFeed.pdf):
https://retro.umoiq.com/service/publicXMLFeed?command=routeList&a={agencyId}
https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a={agencyId}&t=0

We will encapsulate this functionality with a wrapper, <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/NextBusHttpAPI.java">NextBusHttpAPI.java</a>, that will sit alongside TransitPlane.java under `server/src/main/java/swim/transit/NextBusHttpAPI.java`. The first end-point corresponds to the `routeList` command, and will return a route object with a `tag`, `title`, and `shortTitle`. We will make use of the tag and title fields. 

```java
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.logging.Logger;
import java.util.zip.GZIPInputStream;
import swim.codec.Utf8;
import swim.structure.Item;
import swim.structure.Record;
import swim.structure.Value;
import swim.xml.Xml;

public class NextBusHttpAPI {
    private static final Logger log = Logger.getLogger(NextBusHttpAPI.class.getName());
    private NextBusHttpAPI() { }


  private static Value getRoutes(Value ag) {
      try {
          final URL url = new URL(String.format(
                  "https://retro.umoiq.com/service/publicXMLFeed?command=routeList&a=%s", ag.get("id").stringValue()));
          final Value allRoutes = parse(url);
          if (!allRoutes.isDefined()) {
              return null;
          }
          final Iterator<Item> it = allRoutes.iterator();
          final Record routes = Record.of();
          while (it.hasNext()) {
              final Item item = it.next();
              final Value header = item.getAttr("route");
              if (header.isDefined()) {
                  final Value route = Record.of()
                          .slot("tag", header.get("tag").stringValue())
                          .slot("title", header.get("title").stringValue());
                  routes.item(route);
              }
          }
          return routes;
      } catch (Exception e) {
          log.severe(() -> String.format("Exception thrown:\n%s", e));
      }
      return null;
  }


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
    
}
```

The second end-point corresponds to the `vehicleLocations` command, and will return a vehicle  object with fields for `id`, `routeTag`, `dirTag`, `lat`, `long`, `secsSinceReport`, `predictable` and `heading`. 

```java
  public static Value getVehicleLocations(String pollUrl, Value ag) {
  try {
      final URL url = new URL(pollUrl);
      final Value vehicleLocs = parse(url);
      if (!vehicleLocs.isDefined()) {
          return null;
      }

      final Iterator<Item> it = vehicleLocs.iterator();
      final Record vehicles = Record.of();
      while (it.hasNext()) {
          final Item item = it.next();
          final Value header = item.getAttr("vehicle");
          if (header.isDefined()) {
              final String id = header.get("id").stringValue().trim();
              final String routeTag = header.get("routeTag").stringValue();
              final float latitude = header.get("lat").floatValue(0.0f);
              final float longitude = header.get("lon").floatValue(0.0f);
              final int speed = header.get("speedKmHr").intValue(0);
              final int secsSinceReport = header.get("secsSinceReport").intValue(0);
              final String dir = header.get("dirTag").stringValue("");
              final String dirId;
              if (!dir.equals("")) {
                  dirId = dir.contains("_0") ? "outbound" : "inbound";
              } else {
                  dirId = "outbound";
              }

              final int headingInt = header.get("heading").intValue(0);
              String heading = "";
              if (headingInt < 23 || headingInt >= 338) {
                  heading = "E";
              } else if (23 <= headingInt && headingInt < 68) {
                  heading = "NE";
              } else if (68 <= headingInt && headingInt < 113) {
                  heading = "N";
              } else if (113 <= headingInt && headingInt < 158) {
                  heading = "NW";
              } else if (158 <= headingInt && headingInt < 203) {
                  heading = "W";
              } else if (203 <= headingInt && headingInt < 248) {
                  heading = "SW";
              } else if (248 <= headingInt && headingInt < 293) {
                  heading = "S";
              } else if (293 <= headingInt && headingInt < 338) {
                  heading = "SE";
              }
              final String uri = "/vehicle/" +
                      ag.get("country").stringValue() +
                      "/" + ag.get("state").stringValue() +
                      "/" + ag.get("id").stringValue() +
                      "/" + parseUri(id);
              final Record vehicle = Record.of()
                      .slot("id", id)
                      .slot("uri", uri)
                      .slot("dirId", dirId)
                      .slot("index", ag.get("index").intValue())
                      .slot("latitude", latitude)
                      .slot("longitude", longitude)
                      .slot("routeTag", routeTag)
                      .slot("secsSinceReport", secsSinceReport)
                      .slot("speed", speed)
                      .slot("heading", heading);
              vehicles.add(vehicle);
          }
      }
      return vehicles;
  } catch (Exception e) {
      log.severe(() -> String.format("Exception thrown:\n%s", e));
  }
  return null;
}

private static String parseUri(String uri) {
  try {
      return java.net.URLEncoder.encode(uri, "UTF-8").toString();
  } catch (UnsupportedEncodingException e) {
      return null;
  }
}
```

#### Implement StateAgent

Let’s implement <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/agent/StateAgent.java">StateAgent</a> to manage the agencies and vehicles operating within the State. The basic lanes we’ll create maintain high-level statistics and element collections.

```java
package swim.transit.agent;

import java.util.Iterator;
import java.util.logging.Logger;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.JoinMapLane;
import swim.api.lane.JoinValueLane;
import swim.api.lane.MapLane;
import swim.api.lane.ValueLane;
import swim.structure.Record;
import swim.structure.Value;

import java.util.logging.Logger;

public class StateAgent extends AbstractAgent {
  private static final Logger log = Logger.getLogger(StateAgent.class.getName());
    
  @SwimLane("count")
  public ValueLane<Value> count;

  @SwimLane("agencyCount")
  public MapLane<Value, Integer> agencyCount;

  @SwimLane("vehicles")
  public MapLane<String, Value> vehicles;

 @SwimLane("speed")
  public ValueLane<Float> speed;

  @SwimLane("agencySpeed")
  public MapLane<Value, Float> agencySpeed;
}
```

The join lanes allow us to link to other agents, such as Agency and Vehicle. We’ll make use of SwimOS’s `JoinValueLane` to reflect the vehicle count and average vehicle speed for each agency. We’ll reflect the topology of agencies and vehicles by aggregating each agency and each agency’s vehicles. Then, we’ll link to an agency with respect to specific lanes with `addAgency()`, while making use of AbstractAgent’s context object to send commands to other Web Agents. We will materialize the links using the downlink command exposed on all join lane types, passing in an Agency data object as the key:

```java
joinAgencySpeed.downlink(agency).nodeUri(agency.getUri()).laneUri("speed").open();
```

Here is the relevant code for the StateAgent:

```java
  @SwimLane("joinAgencyCount")
  public JoinValueLane<Value, Integer> joinAgencyCount = this.<Value, Integer>joinValueLane()
          .didUpdate(this::updateCounts);

  public void updateCounts(Value agency, int newCount, int oldCount) {
      int vCounts = 0;
      final Iterator<Integer> it = joinAgencyCount.valueIterator();
      while (it.hasNext()) {
          final Integer next = it.next();
          vCounts += next;
      }

      final int maxCount = Integer.max(count.get().get("max").intValue(0), vCounts);
      count.set(Record.create(2).slot("current", vCounts).slot("max", maxCount));
      agencyCount.put(agency, newCount);
  }
  
  @SwimLane("joinStateSpeed")
  public JoinValueLane<Value, Float> joinAgencySpeed = this.<Value, Float>joinValueLane()
          .didUpdate(this::updateSpeeds);

  public void updateSpeeds(Value agency, float newSpeed, float oldSpeed) {
      float vSpeeds = 0.0f;
      final Iterator<Float> it = joinAgencySpeed.valueIterator();
      while (it.hasNext()) {
          final Float next = it.next();
          vSpeeds += next;
      }
      if (joinAgencyCount.size() > 0) {
          speed.set(vSpeeds / joinAgencyCount.size());
      }
      agencySpeed.put(agency, newSpeed);
  }

  @SwimLane("joinAgencyVehicles")
  public JoinMapLane<Value, String, Value> joinAgencyVehicles = this.<Value, String, Value>joinMapLane()
          .didUpdate((String key, Value newEntry, Value oldEntry) -> vehicles.put(key, newEntry))
          .didRemove((String key, Value vehicle) -> vehicles.remove(key));

  @SwimLane("addAgency")
  public CommandLane<Value> agencyAdd = this.<Value>commandLane().onCommand((Value agency) -> {
      log.info("uri: " + agency.get("uri").stringValue());
      joinAgencyCount.downlink(agency).nodeUri(agency.get("uri").stringValue()).laneUri("count").open();
      joinAgencyVehicles.downlink(agency).nodeUri(agency.get("uri").stringValue()).laneUri("vehicles").open();
      joinAgencySpeed.downlink(agency).nodeUri(agency.get("uri").stringValue()).laneUri("speed").open();
      // String id, String state, String country, int index
      Record newAgency = Record.of()
              .slot("id", agency.get("id").stringValue())
              .slot("state", agency.get("state").stringValue())
              .slot("country", agency.get("country").stringValue())
              .slot("index", agency.get("index").intValue())
              .slot("stateUri", nodeUri().toString());
      context.command("/country/" + getProp("country").stringValue(), "addAgency", newAgency);
  });
```

#### Implement CountryAgent

<a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/agent/CountryAgent.java">CountryAgent</a> will be nearly identical to StateAgent, except we’ll aggregate on the state level. `addAgency` represents the essential difference.

```java
  @SwimLane("addAgency")
  public CommandLane<Value> agencyAdd = this.<Value>commandLane()
    .onCommand((Value value) -> {
      states.put(value.get("state").stringValue(), value.get("state").stringValue());
      joinStateCount
        .downlink(value.get("state"))
        .nodeUri(Uri.parse(value.get("stateUri").stringValue()))
        .laneUri("count").open();

      joinStateSpeed
        .downlink(value.get("state"))
        .nodeUri(Uri.parse(value.get("stateUri").stringValue()))
        .laneUri("speed").open();

      final Agency agency = Agency.form().cast(value);
      agencies.put(agency.getUri(), agency);
  });
```
=======
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
>>>>>>> Stashed changes
