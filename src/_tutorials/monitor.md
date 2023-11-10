---
title: Process Monitor Tutorial
layout: page
---

## Overview

We’ll be looking at a process monitoring <a href="https://github.com/swimos/tutorial-monitor">example</a> that provides data for individual machines in a cluster, as well as aggregate metrics for the cluster. The solution will consist of two separate applications. The first is a client application that runs on each machine in the cluster to collect monitoring information. The second is a SwimOS server application that processes results for each machine via a `MachineAgent`, and then aggregates cluster-level metrics across all machines via a `ClusterAgent`.

## Monitoring Client

The Monitoring Client relies on the OSHI java library to extract system information from each host machine in the cluster. OSHI is a free JNA-based (native) Operating system and Hardware Information library for Java. Each client periodically reports its operational health to the server. Since the server runs on top of the SwimOS runtime, the monitoring client uses `swim.ClientRuntime` to send commands bearing monitoring data updates.

### Monitor

Though we are going to keep our example concise, we’ll still include some forward-thinking design so that you can quickly extend the example. We’ve defined an abstract base class called <a href="https://github.com/swimos/tutorial-monitor/blob/main/server/src/main/java/swim/monitor/client/Monitor.java">`Monitor`</a> that defines a `monitor()` method to initiate monitoring, along with the two methods it invokes: `sleep()`, which is implemented, and `pulse()` which will be overridden for each monitor to respond as it needs for each interval.

Since `Monitor` must send data to Web Agents, it maintains a `WarpRef` along with URI path info for host, node, and lane. `Monitor` also maintains an OSHI `SystemInformation` object to perform monitoring on the host as well as a configurable `pulseInterval`.

### ProcessMonitor

We have a single override of `Monitor` in our example, with <a href="https://github.com/swimos/tutorial-monitor/blob/main/server/src/main/java/swim/monitor/client/ProcessMonitor.java">`ProcessMonitor`</a>, though upon perusal, you might notice it includes usage information that really belongs in a separate monitor. We’ll just look at the usage information.

```java
  @Override
  public void pulse() {
    Value usage = getUsage(timestamp);
    this.warpRef.command(hostUri, nodeUri, Uri.parse("addUsage"), usage);
  }

  private Value getMemoryUtilization() {
    return Record.create(6)
    .slot("total", systemInfo.getHardware().getMemory().getTotal())
    .slot("available", systemInfo.getHardware().getMemory().getAvailable())
;
  }

  private Value getHardwareUtilization() {
    Value memoryInfo = getMemoryUtilization();
    return Record.of().slot("memory", memoryInfo);
  }

  private Value getUsage(final long timestamp) {
    Value hardwareInfo = getHardwareUtilization();

    return Record.of()
            .slot("timestamp", System.currentTimeMillis())
            .slot("hardware", hardwareInfo);
  }
```

### SwimMonitorClient

In <a href="https://github.com/swimos/tutorial-monitor/blob/main/server/src/main/java/swim/monitor/client/SwimMonitorClient.java">`SwimMonitorClient`</a>, we will instantiate the SwimOS client runtime, the OSHI `SystemInfo`, and the `ProcessMonitor`.

```java
  public static void main(String[] args) {

    final ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();
    final SystemInfo systemInfo = new SystemInfo();
    startProcessMonitor(swimClient, systemInfo);
  }

  private static void startProcessMonitor(final ClientRuntime swimClient, final SystemInfo systemInfo) {
    final ProcessMonitor processMonitor = new ProcessMonitor(swimClient, HOST_URI, systemInfo);
    swimClient.stage().execute(() -> {
      System.out.println("Starting ProcessMonitor");
      processMonitor.monitor();
    });
  }
```


## Monitoring Server

### Machine Web Agent

The information collected for monitoring can be broken into three categories:
- system information for each machine (static)
- usage information for each machine (dynamic)
- process information for each process running on the machine (static and dynamic)


When static information is set, the <a href="https://github.com/swimos/tutorial-monitor/blob/main/server/src/main/java/swim/monitor/agent/MachineAgent.java">`MachineAgent`</a> registers with the cluster using the following command:

```java
command(CLUSTER_URI_PATTERN.apply("default"), ADD_MACHINE_CLUSTER_LANE_URI, Uri.form().mold(nodeUri()).toValue());
```

By registering, the `ClusterAgent` will be able to observe when monitoring data changes for all hosts that register.

Let's look how memory usage information is computed at the machine level based on monitoring input.

```java
  public static Value computeStatusFromUsage(Value currentStatus, final Value usage) {
    final Value memory = usage.get("hardware").get("memory");
    final long available = memory.get("available").longValue(0);
    final long total = memory.get("total").longValue(0);
    final float memoryUsage = 1.0f - (total == 0L ? 0.0f : (float) available / (float) total);
    return currentStatus.updated("memory_usage", memoryUsage);
}
```

This is invoked when setting the value of the `MachineAgent`’s status lane.

```java
  @SwimLane("status")
  ValueLane<Value> status = this.<Value>valueLane()
          .willSet(StatusComputer::computeSeverityFromStatus)
          .didSet((nv, ov) -> {
            final long timestamp = nv.get("timestamp").longValue(0L);
            if (timestamp > 0L) {
              this.statusHistory.put(timestamp, nv.removed("timestamp"));
            }
          });

  @SwimLane("addUsage")
  CommandLane<Value> addUsage = this.<Value>commandLane()
          .onCommand(v -> this.usage.set(v));

  @SwimLane("usage")
  ValueLane<Value> usage = this.<Value>valueLane()
          .didSet((newValue, oldValue) -> {
            this.status.set(StatusComputer.computeStatusFromUsage(this.status.get(), newValue));
          });
```

### Cluster Web Agent

The <a href="https://github.com/swimos/tutorial-monitor/blob/main/server/src/main/java/swim/monitor/agent/ClusterAgent.java">`ClusterAgent`</a> receives monitoring data for all machines that register to it via a corresponding `MachineAgent`. When a machine registers using `ClusterAgent::addMachine` command lane, the `ClusterAgent` downlinks to the `MachineAgent`’s status lane via its `machines` `JoinValueLane`:

```java
  @SwimLane("addMachine")
  CommandLane<Value> addMachine = this.<Value>commandLane()
          .onCommand(v ->
                  this.machines.downlink(v)
                          .nodeUri(Uri.form().cast(v))
                          .laneUri(STATUS_MACHINE_LANE_URI)
                          .open());

  @SwimLane("machines")
  JoinValueLane<Value, Value> machines = this.<Value, Value>joinValueLane()
          .didUpdate((k, nv, ov) -> {
            computeStatus();

            if (nv.get("disconnected").isDefined()) {
              this.machines.remove(k);
            }
          });
```

The `machines` join value lane exposes the status of individual machines with respect to system information, usage information, and process information, so that any connected client can check detail status for any machine in the cluster.

`ClusterAgent` also aggregates the status of all machines and reflects that in an aggregate status to reflect the health of the cluster. The status is exposed to interested clients through the `status` value lane, and history is stored for the last 200 values. Note that since `timestamp` is the key, the field is removed from the corresponding value:

```java
  @SwimLane("status")
  ValueLane<Value> status = this.<Value>valueLane()
          .didSet((nv, ov) -> {
            final long timestamp = nv.get("timestamp").longValue(0L);
            if (timestamp > 0L) {
              this.statusHistory.put(timestamp, nv.removed("timestamp"));
            }
          });
```
`ClusterAgent` has a `computeStatus()` method that updates the aggregate status as machine status updates stream in. We will cherry picks portions of `computeStatus()` that generate the aggregate value for memory usage:

```java
    int machineCount = 0;
    double clusterAvgMemoryUsage = 0.0;
    double clusterAvgMemoryUsage = 0.0;

    float totalMemoryUsage = 0.0f, maxMemoryUsage = 0.0f;
    int memoryCount = 0;

    final Set<Value> keys = this.machines.keySet();
    for (Value key : keys) {
      machineCount++;
      final Value machineStatus = this.machines.get(key);

      if (machineStatus.get("memory_usage").isDefined()) {
        memoryCount++;
        float memoryUsage = machineStatus.get("memory_usage").floatValue(0.0f);
        totalMemoryUsage += memoryUsage;
        if (memoryUsage > maxMemoryUsage) {
          maxMemoryUsage = memoryUsage;
        }
      }

    final float avgMemoryUsage = memoryCount == 0 ? 0 : totalMemoryUsage / memoryCount;

    this.status.set(
            this.status.get()
                    .updated("machine_count", machineCount)
                    .updated("average_memory_usage", avgMemoryUsage)
                    .updated("max_memory_usage", maxMemoryUsage)
    );
```

## Rendering Status Information

Data can be rendered to an HTML page relatively simply. To illustrate that, we include an html file <a href="https://github.com/swimos/tutorial-monitor/blob/main/ui/index.html">`/ui/index.html`</a> that illustrates how this is done. Most of this is boilerplate for displaying a chart, but the application-specific bit is here: 

```java
const histogramLink = swim.downlinkMap()
    .hostUri("warp://localhost:9001")
    .nodeUri("/cluster/default")
    .laneUri("statusHistory")
    .didUpdate(function(key, value) {
      addToPlot(key, value);
    })
    .didRemove(function(key) {
      removeFromPlot(key);
    })
    .open();
```

## Running the Tutorial

### Running the Server

```bash
$ ./gradlew run
```

### Running a Client

```bash
$ ./gradlew -Dhost=<warp-address-of-server> runClient
```

Example:

```bash
$ ./gradlew -Dhost=warp://localhost:9001 runClient
```

## Streaming APIs

### Introspection APIs

#### Stream High level stats

```
swim-cli sync -h warp://localhost:9001 -n swim:meta:mesh -l pulse
```

### Application APIs

#### Streaming APIs for top level Monitor

```
swim-cli sync -h warp://localhost:9001 -n /monitor -l machines
swim-cli sync -h warp://localhost:9001 -n /monitor -l clusters
```

#### Streaming APIs for a given Machine

```
swim-cli sync -h warp://localhost:9001 -n /machine/my-machine -l status
swim-cli sync -h warp://localhost:9001 -n /machine/my-machine -l statusHistory
swim-cli sync -h warp://localhost:9001 -n /machine/my-machine -l systemInfo
swim-cli sync -h warp://localhost:9001 -n /machine/my-machine -l usage
swim-cli sync -h warp://localhost:9001 -n /machine/my-machine -l processes
swim-cli sync -h warp://localhost:9001 -n /machine/my-machine -l sessions
```

#### Streaming APIs for a Cluster

```
swim-cli sync -h warp://localhost:9001 -n /cluster/abc -l machines
swim-cli sync -h warp://localhost:9001 -n /cluster/abc -l status
swim-cli sync -h warp://localhost:9001 -n /cluster/abc -l statusHistory
```

## Running the UI

Now, under the `/ui` folder under project root, open `index.html` as a local file in your web browser to see results from monitoring your locate machine populate a chart.

## Demo Application

A more complete of this source code exists as the swim-monitor demo can be found <a href="https://github.com/nstreamio/swim-monitor">here</a>.
