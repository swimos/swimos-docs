---
title: Http Ingestion
layout: page
description: "Process data from HTTP (REST) endpoints."
redirect_from:
  - /guides/http-ingestion/
cookbook: https://github.com/swimos/cookbook/tree/master/http_ingestion
---

This guide illustrates how to develop a Swim application that ingests data from HTTP/REST APIs and instantiates log-performing Web Agents.

Rather than relying on simulated data, we utilize the [NextBus API](https://retro.umoiq.com/xmlFeedDocs/NextBusXMLFeed.pdf), maintained by Cubic Transportation System’s Umo Mobility Platform. You may remember this API from our [Transit Tutorial](https://www.swimos.org/tutorials/transit.html).

There are only three high-level components to this application:

- A `java.net.http.HttpClient` instance, which is shared in parallel among...
- ...multiple (but bounded) `AgencyAgent` instances who periodically fetch an agency's worth of vehicle data and relay it to...
- ...multiple (potentially unbounded) number of `VehicleAgents` whose callback functions define the business logic.

## Prerequisites

- Swim server libraries
- **Java 11+**. This guide takes advantage of `java.net.http.HttpClient`, which is only available starting Java 11.

## Guide

### Step 0: Example Data Definition and Business Logic Goals

The only NextBus endpoint we utilize is the `vehicleInfo` endpoint available at `https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=%s&t=%d`. Responses take the form

```
<body copyright="All data copyright Portland Streetcar 2023.">
  <vehicle id="SC010" routeTag="195" dirTag="195_0_var5" lat="45.5102338" lon="-122.6796416" secsSinceReport="13" predictable="true" heading="112" speedKmHr="5"/>
  ...
  <vehicle id="SC009" routeTag="193" dirTag="193_1_var5" lat="45.515243" lon="-122.6859895" secsSinceReport="27" predictable="true" heading="203" speedKmHr="1"/>
  <lastTime time="1691516303998"/>
</body>
```

We wish to have real-time access to present and historical data at vehicle-level granularity.

To be nice to the API, we scope this demonstration to only two randomly-chosen agencies: `portland-sc` and `reno`. It is trivial to extend the logic to all available agencies (the aforementioned Transit Tutorial does this).

### Step 1: HTTP API Wrapper

First things first: instantiate an `HttpClient`.

```java
// Assets.java
import java.net.http.HttpClient;

public final class Assets {

  private Assets() {
  }

  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

  public static HttpClient httpClient() {
    return Assets.HTTP_CLIENT;
  }

}
```

This will be the data bridge between NextBus and the Swim server.

With only one endpoint to utilize, an API wrapper around NextBus is very little work, even if we make things interesting by exercising nontrivial content encodings:

```java
// NextBusApi.java
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.zip.GZIPInputStream;
import swim.codec.Utf8;
import swim.xml.Xml;
import swim.structure.Value;

public final class NextBusApi {

  private NextBusApi() {
  }

  private static final String ENDPOINT_FMT = "https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=%s&t=%d";

  private static String endpointForAgency(String agency, long since) {
    return String.format(ENDPOINT_FMT, agency, since);
  }

  private static HttpRequest requestForEndpoint(String endpoint) {
    return HttpRequest.newBuilder(URI.create(endpoint))
        .GET()
        .headers("Accept-Encoding", "gzip")
        .build();
  }

  public static Value getVehiclesForAgency(HttpClient executor, String agency, long since) {
    final HttpRequest request = requestForEndpoint(endpointForAgency(agency, since));
    try {
      final HttpResponse<InputStream> response = executor.send(request, HttpResponse.BodyHandlers.ofInputStream());
      return Utf8.read(new GZIPInputStream(response.body()), Xml.structureParser().documentParser());
      // Alternatively: convert GZIPInputStream to String, then invoke the more familiar Xml.parse()
    } catch (Exception e) {
      e.printStackTrace();
      return Value.absent();
    }
  }

}
```

### Step 2: `AgencyAgent` Implementation

Because the NextBus endpoint is a REST endpoint, we have no choice but to poll (and per the documentation, no more than once every 10 seconds per agency). Polling from a Swim server is accomplished via timers. Potentially-blocking tasks (in this case, REST requests) run through `asyncStage()`. Combining these gives us the following:

```java
package swim.vehicle;

import java.util.ArrayList;
import java.util.List;
import swim.api.agent.AbstractAgent;
import swim.concurrent.AbstractTask;
import swim.concurrent.TaskRef;
import swim.concurrent.TimerRef;
import swim.structure.Value;

public class AgencyAgent extends AbstractAgent {

  private TimerRef timer;
  private final TaskRef agencyPollTask = asyncStage().task(new AbstractTask() {

    private long lastTime = 0L;

    @Override
    public void runTask() {
      final String aid = agencyId();
      // Make API call
      final Value payload = NextBusApi.getVehiclesForAgency(Assets.httpClient(), aid, this.lastTime);
      // TODO: extract the important stuff from payload and relay appropriately
    }

    @Override
    public boolean taskWillBlock() {
      return true;
    }

  });

  // When we configure routing, our AgencyAgent URIs will look like /agency/:id
  private String agencyId() {
    final String nodeUri = nodeUri().toString();
    return nodeUri.substring(nodeUri.lastIndexOf("/") + 1);
  }

  private void initPoll() {
    this.timer = setTimer((long) (Math.random() * 1000), () -> {
      this.agencyPollTask.cue();
      // Placing reschedule() here is like ScheduledExecutorService#scheduleAtFixedRate.
      // Moving it to the end of agencyPollTask#runTask is like #scheduleWithFixedDelay.
      this.timer.reschedule(15000L); // do not lower below 10000L
    });
  }

  @Override
  public void didStart() {
    initPoll();
  }

}
```

_Note: this union of timers and `asyncStage()` is a common pattern for request-response-type data sources, generalizing well beyond just REST._

### Step 3: `VehicleAgent` Implementation and Routing

The code so far is fully capable of consuming the topic's data. We must now create entities -- `VehicleAgents` -- that can accept and process this data. Each will merely contain a `CommandLane` (to receive messages) and a timeseries-type `MapLane` (to store them).

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
      .onCommand(v -> {
        this.history.put(v.get("timestamp").longValue(), v);
      });

  @SwimLane("history")
  MapLane<Long, Value> history = this.<Long, Value>mapLane()
      .didUpdate((k, n, o) -> {
        System.out.println(nodeUri() + ": received " + n);
      });

}
```

Deciding that the URIs for `VehicleAgents` will take the form `/vehicle/:id`, everything is in place to fill out our earlier TODO:

```java
// AgencyAgent.java
// import ...
import swim.structure.Attr;
import swim.structure.Item;

public class AgencyAgent extends AbstractAgent {

  private TimerRef timer;
  private final TaskRef agencyPollTask = asyncStage().task(new AbstractTask() {

    private long lastTime = 0L;

    @Override
    public void runTask() {
      final String aid = agencyId();
      // Make API call
      final Value payload = NextBusApi.getVehiclesForAgency(Assets.httpClient(), aid, this.lastTime);
      // Extract information for all vehicles and the payload's timestamp
      final List<Value> vehicleInfos = new ArrayList<>(payload.length());
      for (Item i : payload) {
        if (i.head() instanceof Attr) {
          final String label = i.head().key().stringValue(null);
          if ("vehicle".equals(label)) {
            vehicleInfos.add(i.head().toValue());
          } else if ("lastTime".equals(label)) {
            this.lastTime = i.head().toValue().get("time").longValue();
          }
        }
      }
      // Relay each vehicleInfo to the appropriate VehicleAgent
      int i = 0;
      for (Value vehicleInfo : vehicleInfos) {
        command("/vehicle/" + aid + "/" + vehicleInfo.get("id").stringValue(),
            "addMessage",
            // lastTime came separately, manually add it to each vehicleInfo
            vehicleInfo.updatedSlot("timestamp", lastTime));
        i++;
      }
      System.out.println(nodeUri() + ": relayed info for " + i + " vehicles");
    }

    // ...

}
```

### Step 4: Wrapping It Up

Minus the boilerplate that comes with every Swim application, namely:

- A `server.recon` to configure networking, routing, and additional kernels
- A runtime-providing `Plane`
- A `main()` method that loads the Swim server

we're completely done! A standalone, directly-runnable project can be found [here](https://github.com/swimos/cookbook/tree/master/http_ingestion).
