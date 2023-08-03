---
title: Transit Tutorial
layout: page
---

The Transit Tutorial walks you step-by-step through creating a small, but fully functional backend application for conveying real-time city transit information. The application involves two types of business entities: vehicles and agencies. These entities form a simple hierarchy where each vehicle falls under exactly one of 46 agencies.

Rather than simulating data, we will be utilizing an API provided by Cubic Transportation System's Umo Mobility Platform to retrieve real-time transit information -- NextBus, <a href="https://retro.umoiq.com/" target="_blank">https://retro.umoiq.com/</a>.

### Project Creation

Let’s start by creating the root project folder for the server: `transit-tutorial/server`.

```console
$ mkdir transit-tutorial/server
$ cd transit-tutorial/server
```

#### Prerequisites

To build this application, we'll need the JDK for <a href="https://www.oracle.com/technetwork/java/javase/downloads/index.html" target="_blank">Java 11+</a>. Click <a href="https://www.oracle.com/technetwork/java/javase/downloads/index.html" target="_blank">here</a> for JDK installation instructions. In conjunction with this, make sure your `JAVA_HOME` environment variable is pointed to your Java installation location, and that your `PATH` includes `JAVA_HOME`.

#### Building with Gradle

We’ll be using Gradle to build the application, installation instructions can be found <a href="https://gradle.org/install/" target="_blank">here</a>.

From the root project folder, server/transit, let's initialize the project with gradle:

```console
$ gradle init
```

The root project directory should currently look like this:

```
- build.gradle
- gradle
  - wrapper
    - gradle-wrapper.jar
    - gradle-wrapper.properties
- gradlew
- gradlew.bat
- settings.gradle
```

Create gradle.properties in the project root, and add the following lines:
```
application.version=1.0.0
swim.version=4.0.
```

Then add the following to build.gradle:
```
buildscript {
  repositories {
    maven { url 'https://plugins.gradle.org/m2/' }
  }
  dependencies {
    classpath 'com.netflix.nebula:gradle-ospackage-plugin:8.3.0'
  }
}

apply plugin: 'java-library'
apply plugin: 'application'
apply plugin: 'nebula.ospackage-application'

group = 'org.swimos'
description = 'Real-time Transit App'
version = project.property('application.version')
mainClassName = 'swim.transit.TransitPlane'
ext.moduleName = 'swim.transit'
ext.swimVersion=project.property('swim.version')

repositories {
  mavenCentral()
}

dependencies {
  implementation group: 'org.swimos', name: 'swim-xml', version: swimVersion
  api group: 'org.swimos', name: 'swim-api', version: swimVersion
  implementation group: 'org.swimos', name: 'swim-server', version: swimVersion
  runtimeOnly group: 'org.swimos', name: 'swim-meta', version: swimVersion
}
```

To fill out the Java application structure under the project root, just do the following:

```console
mkdir -p src/main/java/swim/transit/agent
mkdir -p src/main/resources
```

#### Creating the app configuration files

Next, we need some configuration. Let's create a <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/resources/server.recon" target="_blank">file</a> called `server.recon` under `src/main/resources/`. Of particular note, we will specify our application entry point, `TransitPlane`, using `@plane`, along with a couple web agents, `AgencyAgent` and `VehicleAgent` via `@node`, within which we'll specify the URI pattern and corresponding web agent class name.

```
transit: @fabric {
    @plane(class: "swim.transit.TransitPlane")
    @node {
        pattern: "/agency/:country/:state/:id"
        @agent(class: "swim.transit.agent.AgencyAgent")
    }
    @node {
        pattern: "/vehicle/:country/:state/:agency/:id"
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

As mentioned, we'll retrieve transit data via a public API. We'll need to specify the corresponding agency when we invoke the API, so we'll use a CSV file to load transit information for 46 transit agencies into Web Agents:
- <a href="https://github.com/swimos/tutorial-transit/blob/main/server/src/main/resources/agencies.csv" target="_blank">https://github.com/swimos/tutorial-transit/blob/main/server/src/main/resources/agencies.csv</a>

This CSV data file contains the fields for each agency. It should be saved under `transit-tutorial/server/src/main/resources/`.

### Application Logic

Our implementation will involve four java classes:
- `NextBusHttpAPI`, a simple wrapper class for the public transit API we'll be using
- `TransitPlane`, our application entry point
- `AgencyAgent`, the implementation of the Agency entity
- `VehicleAgent`, the implementation of the Vehicle entity

The `NextBusHttpAPI.java` and `TransitPlane.java` will go under `transit-tutorial/server/src/main/java/swim/transit/`. One level below this, we'll store `AgencyAgent.java` and `VehicleJava`: `transit-tutorial/server/src/main/java/swim/transit/agent/`.

#### Creating the API Wrapper

Though not strictly necessary, we'll encapsulate the transit API in a class we're calling, `NextBusHttpAPI`. Our primary task is to retrieve vehicle locations for each agency. The API is going to return XML data, so we're going to convert it to the polymorphic data type used in Nstream's SwimOS platform, `Value`:

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

Since we have passed in the url, the code above will work for any non-arg API that returns XML. To handle the specific vehicle data we are interested in, we'll invoke the method above and then populate data structures for vehicle information. As mentioned, the `Value` datatype is polymorphic. In our case, the data is going to come as a sequence of objects, which conform to an `Item` datatype, so we'll use an `Iterator`. Because `Item`s provide `get()` accessors that return generic `Value` datatypes, we'll chain a call to coerce to the underlying datatype via `stringValue()`, `floatValue()`, and `intValue()`. Objects and Arrays are both created using the `Record` datatype, so we'll declare `vehicles` to contain the generated vehicle records which will store by invoking `add()` on each record. The records themselves will be build up as a sequence of key-value pairs using `slot()`.

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
                            ag.get("id").stringValue() +
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
```

This API will be periodically invoked asynchronously by the AgencyAgent, and the results will be received via an asynchronous command being sent to the calling AgenecyAgent.

```java
    public static void sendVehicleInfo(String pollUrl, Value agency, WarpRef warp) {
        final Value vehicles = getVehicleLocations(pollUrl, agency);
        final String agencyUri = "/agency/" +
                agency.get("id").stringValue();
        if (vehicles != null && vehicles.length() > 0) {
            warp.command(agencyUri, "addVehicles", vehicles);
        }
    }
```

The complete implementation for `NextBusHttpAPI.java` can be found here: `https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/NextBusHttpAPI.java`.

#### Creating the Vehicle web agent

In `SwimOS` web agents are implemented by extending the `AbstractAgent` base class, which affords all the core web agent functionality, including lifecycle callback methods and agent end-points that are referred to as "lanes" (think Swim lanes). Keying on the vehicle id returned with vehicle data by the transit API, we will create a separate web agent for each Vehicle. A web agent is create upon the first invoke of its URL, whether or not an underlying endpoint is defined. As you'll see below, we can observe when an agent has started up via its `didStart()` lifecycle callback. 

```java
public class VehicleAgent extends AbstractAgent {
  // skipping everything else
  @Override
  public void didStart() {
    log.info(()-> String.format("Started Agent: %s", nodeUri()));
  }
}
```

We'll store three bits of Vehicle information in fields, which are referred to as lanes. The first is basic information stored in the `vehicle` `ValueLane`, which indicates that the datatype is `Value`. Next, we'll stored the last 10 speed readings in the `speeds` MapLane that maps timestamps as Long to their underlying Integer values. Then we'll store acceleration information using the same `MapLane<Long, Integer>` for `accelerations` that are derived via the `speeds`` time series information.

```java
  @SwimLane("vehicle")
  public ValueLane<Value> vehicle = this.<Value>valueLane()
          .didSet((nv, ov) -> {
            log.info("vehicle changed from " + Recon.toString(nv) + " from " + Recon.toString(ov));
          });

  @SwimLane("speeds")
  public MapLane<Long, Integer> speeds;

  @SwimLane("accelerations")
  public MapLane<Long, Integer> accelerations;
```

We can declare Java member variables in the normal fashion. For our purposes, we'll have two:

```java
  private static final Logger log = Logger.getLogger(VehicleAgent.class.getName());
  private long lastReportedTime = 0L;
```

Finally, in response to updated vehicle data, we'll update or speed and acceleration information:

```java
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

The complete implementation for `VehicleAgent.java` can be found here: `https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/agent/VehicleAgent.java`.

#### Creating the Agency web agent

Since the public transit API requires retrieving data for specific transportation agencies, we'll load that information from a CSV file and create an AgencyAgent for each agency specified. For each agency, we'll maintain information for vehicles, vehicle count, average vehicle speed, and a geo-spatial bounding box that encompasses all vehicles. 

```java
public class AgencyAgent extends AbstractAgent {
    private static final Logger log = Logger.getLogger(AgencyAgent.class.getName());
    @SwimLane("vehicles")
    public MapLane<String, Value> vehicles;

    @SwimLane("count")
    public ValueLane<Integer> vehicleCount;

    @SwimLane("speed")
    public ValueLane<Float> avgVehicleSpeed;

    @SwimLane("boundingBox")
    public ValueLane<Value> boundingBox;

    // skipping everything else
}
```

We'll make use of the `didStart()` callback to initialize some variables:

```
    @Override
    public void didStart() {
        vehicles.clear();
        avgVehicleSpeed.set((float) 0);
        vehicleCount.set(0);
        log.info(() -> String.format("Starting Agent:%s", nodeUri()));
    }
```

We'll maintain vehicle information in the map defined by `vehicles`:

```
    private void addVehicle(String vehicleUri, Value v) {
        // log.info("addVehicle vehicleUri: " + vehicleUri + "; v: " + Recon.toString(v));
        Value newVehicle = Record.of()
            .slot("id", getProp("id").stringValue(""))
            .slot("uri", v.get("uri").stringValue())
            .slot("agency", info.get().get("id").stringValue())
            .slot("dirId", v.get("dirId").stringValue())
            .slot("latitude", v.get("latitude").floatValue())
            .slot("longitude", v.get("longitude").floatValue())
            .slot("speed", v.get("speed").intValue())
            .slot("secsSinceReport", v.get("secsSinceReport").intValue())
            .slot("heading", v.get("heading").stringValue());

        this.vehicles.put(vehicleUri, newVehicle);
    }
```

We update the cull the current list of vehicles by first removing vehicles that drop out of the public API transit response:

```

    private void updateVehicles(Map<String, Value> newVehicles) {
        final Collection<Value> currentVehicles = this.vehicles.values();
        for (Value vehicle : currentVehicles) {
            if (!newVehicles.containsKey(vehicle.get("uri").stringValue())) {
                vehicles.remove(vehicle.get("uri").stringValue());
            }
        }
    }
```

If you recall, in our transit wrapper, we invoked the `addVehicles` command using `warp.command(agencyUri, "addVehicles", vehicles);` Here we'll implement that end-point as a command lane. Note the line where the AgencyAgent sends an asychronous command to each of its vehicles:

```
context.command(vehicleUri, "updateVehicle", v.toValue());
```

You'll also see how simple it is to maintain a bounding box for any number of vehicles.

```
    @SwimLane("addVehicles")
    public CommandLane<Value> addVehicles = this.<Value>commandLane().onCommand(this::onVehicles);

    private void onVehicles(Value newVehicles) {
        if (newVehicles == null || newVehicles.length() == 0) {
            return;
        }
        Map<String, Value> vehicleUpdates = new HashMap<>();

        for (Item v : newVehicles) {
            vehicleUpdates.put(v.get("uri").stringValue(), v.toValue());
        }

        updateVehicles(vehicleUpdates);
        int speedSum = 0;
        float minLat = Integer.MAX_VALUE, minLng = Integer.MAX_VALUE, maxLat = Integer.MIN_VALUE, maxLng = Integer.MIN_VALUE;

        for (Value v : vehicleUpdates.values()) {
            final String vehicleUri = v.get("uri").stringValue();
            if (vehicleUri != null && !vehicleUri.equals("")) {
                context.command(vehicleUri, "updateVehicle", v.toValue());
                addVehicle(vehicleUri, v);
                speedSum += v.get("speed").intValue();
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
        vehicleCount.set(this.vehicles.size());
        if (vehicleCount.get() > 0) {
            avgVehicleSpeed.set(((float) speedSum) / vehicleCount.get());
        }
    }
```

As mentioned, we'll be invoking the transit API periodically. We'll do that using SwimOS's task and timer functionality. First, we'll declare the corresponding variables:

```
    private TaskRef pollVehicleInfo;
    private TimerRef timer;
```

Since, as with most APIs, our public transit API is not a streaming API, we will poll to obtain updated information, and then continuously update it to enable streaming outward. Both tasks and timers provide `cancel()` methods, which we will use to stop polling. We'll also want to do this whenever we restart polling due to updating agency information. `AbstractTask` is used to define and instantiate a task. `runTask()` will define the recurring task. We instantiate a timer using `startTimer()`. In our case, we'll prepare the task via `cue()` and then set the timer with `reschedule()`.

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
                NextBusHttpAPI.sendVehicleInfo(this.url, this.agency, AgencyAgent.this.context);
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

The complete implementation for `AgencyAgent.java` can be found here: `https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/agent/AgencyAgent.java`.

#### Creating our entry point

We are also all set, but first, we can begin, we must define our entry point. To do so, we begin by extending `TransitPlane` from `AbstractPlane` and declaring our web agents: `agencyAgent` and `vehicleAgent`.

```
public class TransitPlane extends AbstractPlane {
  private static final Logger log = Logger.getLogger(TransitPlane.class.getName());

  public TransitPlane() {}

  // skip everyting else

}
```

For the entry point itself, we define our main method in the usual way. Note how we reference the application plane that we defined in `server.recon`, passing it to the kernel object that respresents the SwimOS runtime.

```
  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    final Space space = kernel.getSpace("transit");
    kernel.start();
    log.info("Running TransitPlane...");
    startAgencies(space);
    kernel.run(); // blocks until termination
  }
```

The call to `startAgencies` instantiates the top-level web agents for agencies. Note we are passing the `Space` object based on our `server.recon` as the protocol parameter, `WarpRef`, of `startAgencies()`. Before asynchronously commanding each AgencyAgent, we load the agency data into corresponding `Value` objects:

```
  private static void startAgencies(WarpRef warp) {
    final Value agencies = loadAgencies();
    for (Item agency : agencies) {
      log.info(Recon.toString(agency));
      String agencyUri = "/agency/" +
              "/" + agency.get("id").stringValue();
      warp.command(agencyUri, "addInfo", agency.toValue());
    }
    try {
      Thread.sleep(3000);
    } catch (InterruptedException e) {

    }
  }

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

The complete implementation for `TransitPlane.java` can be found here: `https://github.com/swimos/tutorial-transit/blob/main/server/src/main/java/swim/transit/TransitPlane.java`.
