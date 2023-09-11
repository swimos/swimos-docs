# Application Overview

We will create a real-time streaming application to monitor a cluster of machines using OSHI, a free JNA-based (native) Operating System and Hardware Information library for Java. Two web agent types will be involved: one for the cluster and one for each machine in the cluster.

# High-level Concepts

This application exhibits aggregation in the context of a streaming data application. Streaming data is induced by continuously polling system information APIs, which are aggregated at the cluster level to provide cluster-level status.

# Stateful Entity Model

## Model Web Agents from Entities

We are modeling our application on two entities: machine and cluster, where a cluster is a logical grouping of machines. Monitoring at the machine level includes each process running on the machine, however, we will simplify our model by not maintaining a process entity. This is merely a simplification, as having a process entity would provide additional aggregation opportunities, such as tracking specific applications and services running within a cluster.

### Machine Web Agent

The information collected for monitoring can be broken into three categories:
- system information for each machine (static)
- usage information for each machine (dynamic)
- process information for each process running on the machine (static and dynamic)

#### System Information

System information will be obtained from `oshi.SystemInfo` via its `getHardware()` and `getOperatingSystem()` methods. As this is static information, it will be retrieved once for each machine. Each bit of information will get saved into fields of SwimOS `Record` classes.

- timestamp
- os
  - manufacturer
  - family
  - version
  - bitness
  - process count
- hardware
  - manufacturer
  - model
  - firmware version
  - processor
    - vendor
    - name
    - max frequency
    - physical count
    - logical count
  - memory

#### Usage Information

Usage information will be obtained from `oshi.SystemInfo` via its `getHardware()` and `getProcessor()` methods. As this is dynamic information, it will be retrieved on a recurring basis for each machine. Each bit of information will get saved into fields of SwimOS `Record` classes.

- timestamp
- os
  - boot time
  - uptime
  - process count
  - thread count
- hardware
  - memory
    - total
    - available
    - total available swap
    - swap in use
    - maximum virtual memory
    - virtual memory in use
  - processor
    - max frequency
    - current frequency
    - average system load
    - temperature
  - is charging flag

#### Process Information

Process information will be obtained from `oshi.software.os.OSProcess`. As this is dynamic information, it will be retrieved on a recurring basis for each machine. Each bit of information will get saved into fields of SwimOS `Record` classes.

- timestamp
- pid
- name
- user
- user id
- priority
- virtual size
- rss
- cpu load
- uptime

### Cluster Web Agent

The following aggregate statistics will be maintained in the top-level cluster agent:

- machine count
- average latency
- average system load
- maximum system load
- average memory usage
- maximum memory usage
- average cpu usage

# Send OSHI Data to Machine Web Agents

## Monitoring

Though we'll only have one monitor for this tutorial, we'll create a simple <a href="https://github.com/swimos/tutorial-monitor/blob/main/src/main/java/swim/monitor/client/Monitor.java" target="_blank">`Monitor`</a> base class that supports a variable number of monitors that extract information from `oshi.SystemInfo` and send to SwimOS via `swim.api.ref.WarpRef`. Each monitor will present a `monitor()` loop that repeatedly invokes a pulse-sleep sequence in the context of a SwimOS client runtime instance.

### Encapsulate Monitoring Pattern

```java
public abstract class Monitor {

  protected final SystemInfo systemInfo;
  protected final WarpRef warpRef;
  private final long pulseInterval;
  protected final Uri hostUri;
  protected final Uri nodeUri;
  protected final Uri laneUri;
  private static final long START_PAUSE = 5000L;

  public Monitor(final WarpRef warpRef, final SystemInfo systemInfo, final long pulseInterval, final Uri hostUri, final Uri nodeUri, final Uri laneUri) {
    this.warpRef = warpRef;
    this.systemInfo = systemInfo;
    this.pulseInterval = pulseInterval;
    this.hostUri = hostUri;
    this.nodeUri = nodeUri;
    this.laneUri = laneUri;
  }

  public void monitor() {
    sleep(START_PAUSE);
    do {
      pulse();
      sleep(pulseInterval);
    } while (true);
  }

  private void sleep(long duration) {
    try {
      Thread.sleep(duration);
    } catch (Exception e) {

    }
  }

  public abstract void pulse();
}
```

### Implement ProcessMonitor for Monitoring System Information

Each machine will have static information that doesn't change, so we'll capture its hardware and operating system upon constructing its <a href="https://github.com/swimos/tutorial-monitor/blob/main/src/main/java/swim/monitor/client/ProcessMonitor.java" target="_blank">`ProcessMonitor`</a> instance and send it using `WarpRef.command()`.

```java
public class ProcessMonitor extends Monitor {

  public ProcessMonitor(final WarpRef warpRef, final Uri hostUri, final SystemInfo systemInfo) {
    super(warpRef, systemInfo, PULSE_INTERVAL_SEC * 1000L,
          hostUri,
          NODE_URI_PATTERN.apply(systemInfo.getOperatingSystem().getNetworkParams().getHostName()),
          LANE_URI);

    prevTicks = systemInfo.getHardware().getProcessor().getSystemCpuLoadTicks();

    Value memory = Record.create(1)
      .slot("total", systemInfo.getHardware().getMemory().getTotal());

    osSystemInfo = Record.create(5)
      .slot("manufacturer", systemInfo.getOperatingSystem().getManufacturer())
      .slot("family", systemInfo.getOperatingSystem().getFamily())
      .slot("version", systemInfo.getOperatingSystem().getVersionInfo().getVersion())
      .slot("bitness", systemInfo.getOperatingSystem().getBitness())
      .slot("process_count", systemInfo.getOperatingSystem().getProcessCount());

    hwSystemInfo = Record.create(7)
      .slot("manufacturer", systemInfo.getHardware().getComputerSystem().getManufacturer())
      .slot("model", systemInfo.getHardware().getComputerSystem().getModel())
      .slot("firmware_version", systemInfo.getHardware().getComputerSystem().getFirmware().getVersion())
      .slot("processor", Record.create(5)
        .slot("vendor", systemInfo.getHardware().getProcessor().getProcessorIdentifier().getVendor())
        .slot("name", systemInfo.getHardware().getProcessor().getProcessorIdentifier().getName())
        .slot("max_freq", systemInfo.getHardware().getProcessor().getMaxFreq())
        .slot("physical_count", systemInfo.getHardware().getProcessor().getPhysicalProcessorCount())
        .slot("logical_count", systemInfo.getHardware().getProcessor().getLogicalProcessorCount()))
      .slot("memory", memory);

    Value record = Record.create(3)
      .slot("timestamp", System.currentTimeMillis())
      .slot("os", osSystemInfo)
      .slot("hardware", hwSystemInfo);

    this.warpRef.command(hostUri, nodeUri, Uri.parse("addSystemInfo"), record);
  }
}
```

Next, we'll take care of the dynamic information that drives our monitoring. It can be broken down into two high-level concerns: usage information for the machine and information for each of its processes. Process information is extracted using `oshi.OSProcess` objects:

```java
  private Value getProcessInfo(final OSProcess process, final long timestamp) {
    return Record.create(10)
            .slot("timestamp", timestamp)
            .slot("pid", process.getProcessID())
            .slot("name", process.getName())
            .slot("user", process.getUser())
            .slot("user_id", process.getUserID())
            .slot("priority", process.getPriority())
            .slot("virtual_size", process.getVirtualSize())
            .slot("rss", process.getResidentSetSize())
            .slot("cpu_load", process.getProcessCpuLoadCumulative())
            .slot("uptime", process.getUpTime());
  }
```

Usage information has the same OS/Hardware breakdown we had for the static information:

```java
  private Value getUsage(final long timestamp) {
    Value osInfo = getOSUtilization();
    Value hardwareInfo = getHardwareUtilization();

    return Record.create(3)
            .slot("timestamp", System.currentTimeMillis())
            .slot("os", osInfo)
            .slot("hardware", hardwareInfo);
  }
  ```

Operating System utilization information can be pulled directly from calls to `oshi.SystemInfo.getOperatingSystem()`.

```java
  private Value getOSUtilization() {
    return Record.create(4)
    .slot("boot_time", systemInfo.getOperatingSystem().getSystemBootTime() * 1000)
    .slot("uptime", systemInfo.getOperatingSystem().getSystemUptime() * 1000)
    .slot("process_count", systemInfo.getOperatingSystem().getProcessCount())
    .slot("thread_count", systemInfo.getOperatingSystem().getThreadCount());
  }
```

Hardware utilization information can be broken down into memory and processor information. We enrich the processor information with status information for `average_system_load` and `temperature` by updating the state with `Value.updated()`.

```java
  private Value getHardwareUtilization() {
    Value memoryInfo = getMemoryUtilization();
    Value processorInfo = getProcessorUtilization();

    final double averageSystemLoad = systemInfo.getHardware().getProcessor().getSystemCpuLoadBetweenTicks(prevTicks) * 100;
    prevTicks = systemInfo.getHardware().getProcessor().getSystemCpuLoadTicks();
    if (averageSystemLoad >= 0) {
      processorInfo = processorInfo.updated("average_system_load", averageSystemLoad);
    }
    final double cpuTemperature = systemInfo.getHardware().getSensors().getCpuTemperature();
    if (cpuTemperature != Double.NaN && cpuTemperature != 0) {
      processorInfo = processorInfo.updated("temperature", cpuTemperature);
    }

    return Record.create(4)
            .slot("memory", memoryInfo)
            .slot("processor", processorInfo)
            .slot("is_charging", isCharging(systemInfo.getHardware().getPowerSources()));
  }
```

The implementation for `getMemoryUtilization()` relies on `oshi.SystemInfo.getHardware().getMemory()`:

```java
  private Value getMemoryUtilization() {
    return Record.create(6)
    .slot("total", systemInfo.getHardware().getMemory().getTotal())
    .slot("available", systemInfo.getHardware().getMemory().getAvailable())
    .slot("swap_total", systemInfo.getHardware().getMemory().getVirtualMemory().getSwapTotal())
    .slot("swap_used", systemInfo.getHardware().getMemory().getVirtualMemory().getSwapUsed())
    .slot("virtual_max", systemInfo.getHardware().getMemory().getVirtualMemory().getVirtualMax())
    .slot("virtual_in_use", systemInfo.getHardware().getMemory().getVirtualMemory().getVirtualInUse());
  }

```

The implementation for `getProcessorUtilization()` relies on `oshi.SystemInfo.getHardware().getProcessor()`:

```java
  private Value getProcessorUtilization() {
    return Record.create(2)
    .slot("max_frequency", systemInfo.getHardware().getProcessor().getMaxFreq())
    .slot("current_frequency", cpuFrequencyByProcessorValue(systemInfo.getHardware().getProcessor().getCurrentFreq()));
  }

```

With the extraction of system information in place, all that's let for our `ProcessMonitor` is to override the abstract `pulse()` method:

```java
  @Override
  public void pulse() {
    final List<OSProcess> processes = systemInfo.getOperatingSystem().getProcesses(ALL_PROCESSES, CPU_DESC, 30);
    final long timestamp = System.currentTimeMillis();
    Record processStatus = Record.create(processes.size());
    for (final OSProcess process : processes) {
      processStatus.add(getProcessInfo(process, timestamp));
    }
    this.warpRef.command(hostUri, nodeUri, Uri.parse("addProcess"), processStatus);

    Value usage = getUsage(timestamp);
    this.warpRef.command(hostUri, nodeUri, Uri.parse("addUsage"), usage);
  }

```

### Implement SwimMonitorClient for Client Runtime

The chief responsibility of the <a href="https://github.com/swimos/tutorial-monitor/blob/main/src/main/java/swim/monitor/client/SwimMonitorClient.java" target="_blank">`SwimMonitorClient`</a> is to start the client runtime and invoke the `ProcessMonitor.monitor()` at each interval.

```java
public class SwimMonitorClient {

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
}
```

## Ingestion

In this tutorial, we are going to build out the `MachineAgent`, grouping the corresponding machines under a top-level `ClusterAgent`.

Let’s take a simplified <a href="https://github.com/swimos/tutorial-monitor/blob/main/src/main/java/swim/monitor/agent/MachineAgent.java" target="_blank">`MachineAgent`</a> as a starting point, that only considers the static system information. We provide a command to handle the external request to store the system information along with a `ValueLane` to store the underlying information and make it available to interested clients.

```java
public class MachineAgent extends AbstractAgent {

  @SwimLane("addSystemInfo")
  CommandLane<Value> addSystemInfo = this.<Value>commandLane()
          .onCommand(v -> this.systemInfo.set(v));

  @SwimLane("systemInfo")
  ValueLane<Value> systemInfo = this.<Value>valueLane()
          .didSet((newValue, oldValue) -> {
            updateLastTimestampStatus(newValue);
          });

}
```

Next, let's add a command for accepting usage information as well as a corresponding `ValueLane`. The `addUsage` endpoint will be invoked by the monitor to send data to the web agent at each update interval. <a href="https://github.com/swimos/tutorial-monitor/blob/main/src/main/java/swim/monitor/model/StatusComputer.java" target="_blank">`StatusComputer`</a>, which computes some differencing between successive values, we'll skip over for the moment. As the name suggests, `updateLastTimestampStatus` updates the latency field and resets any `disconnected` status values since new status information has been received.

```java
  @SwimLane("addUsage")
  CommandLane<Value> addUsage = this.<Value>commandLane()
          .onCommand(v -> this.usage.set(v));

  @SwimLane("usage")
  ValueLane<Value> usage = this.<Value>valueLane()
          .didSet((newValue, oldValue) -> {
            updateLastTimestampStatus(newValue);
            this.status.set(StatusComputer.computeStatusFromUsage(this.status.get(), newValue));
          });
          
  private void updateLastTimestampStatus(final Value update) {
    final long timestamp = update.get("timestamp").longValue(0L);
    if (timestamp > this.status.get().get("timestamp").longValue(0L)) {
      final long latency = System.currentTimeMillis() - timestamp;
      this.status.set(
              this.status.get().updated("timestamp", timestamp).updated("latency", latency).updated("updating", true).removed("disconnected")
      );
    }
  }
```

Lastly, we'll take care of the remaining bit of dynamic status, process information. As with the other cases, we define a command to serve as endpoint for receiving process information. Instead of a corresponding `ValueLane`, we have a `MapLane`, since we are maintaining information for multiple datapoints. Since new processes will start and old processes will exit, we handle this with `reconcileProcesses()`.

```java
  @SwimLane("addProcess")
  CommandLane<Value> addProcess = this.<Value>commandLane()
          .didCommand(v -> {
            reconcileProcesses(v);
          });

  private void reconcileProcesses(Value v) {
    final Iterator<Item> it = v.iterator();
    Set<Integer> currentPids = new HashSet<>();
    while (it.hasNext()) {
      final Value value = it.next().toValue();
      int pid = value.get("pid").intValue(-1);
      if (pid > 0) {
        processes.put(pid, value);
        currentPids.add(pid);
      }
    }
    for(int oldProcessId: processes.keySet()) {
      if (!currentPids.contains(oldProcessId)) {
        processes.remove(oldProcessId);
      }
    }
  }

  @SwimLane("processes")
  MapLane<Integer, Value> processes = this.<Integer, Value>mapLane()
          .didUpdate((k, nv, ov) -> {
            updateLastTimestampStatus(nv);
          });
```

# Continuously Evaluate Business Logic in Web Agents

## Group and Aggegrate Web Agents

### Group Agents

Let's implement <a href="https://github.com/swimos/tutorial-monitor/blob/main/src/main/java/swim/monitor/agent/ClusterAgent.java" target="_blank">`ClusterAgent`</a> now, as simple group/aggregate agent to summarize of the machines. A `JoinValueLane` inside the `ClusterAgent` will become a map, the key being some unique identifier of a machine, and the value being the machine’s current status. The lane will keep itself up to date with the status of the machine through the use of downlinks. As before, we'll include an `addMachine` endpoint to submit machine status updates.

```java
public class ClusterAgent extends AbstractAgent {

  @SwimLane("addMachine")
  CommandLane<Value> addMachine = this.<Value>commandLane()
          .onCommand(v ->
                  this.machines.downlink(v)
                          .nodeUri(Uri.form().cast(v))
                          .laneUri(STATUS_MACHINE_LANE_URI)
                          .open());

  @SwimLane("machines")
  JoinValueLane<Value, Value> machines = this.<Value, Value>joinValueLane();

```

Notice the type parameters of the `machines` lane in the above example.

The first parameter is a Value that contains a `Uri` and is the unique identifier of the machine. As a node URI is unique to each agent we will be using that (but this could be anything else unique to the machine, e.g. id: String).

The second parameter is the type of the value to be downlinked, this should match the type of the status ValueLane in the machine agent.


### Join Agents

Now let's add some logic to `MachineAgent` to command the `ClusterAgent`’s `addMachine`. Since we only need to set the static system information once as it doesn't change, we can invoke the `addMachine` there. Let's update `systemInfo.didSet()` to send that command.

```java
  private static final UriPattern CLUSTER_URI_PATTERN = UriPattern.parse("/cluster/:id");
  private static final Uri ADD_MACHINE_CLUSTER_LANE_URI = Uri.parse("addMachine");

  @SwimLane("systemInfo")
  ValueLane<Value> systemInfo = this.<Value>valueLane()
          .didSet((newValue, oldValue) -> {
            updateLastTimestampStatus(newValue);
            command(CLUSTER_URI_PATTERN.apply(newValue.get("cluster_id").stringValue()), ADD_MACHINE_CLUSTER_LANE_URI, Uri.form().mold(nodeUri()).toValue());
          });

```

### Aggregate Agents

Now we have an automatically updating, streaming map, we can continuously compute some metrics across the whole group. We can aggregate the status of all the machine agents into a status for the whole cluster.

For that, we'll add a few things to the `ClusterAgent`:

- A `ValueLane` named status we can use to hold the status of the cluster.
- A method `computeStatus()` that will be used to compute and set the cluster’s status.
- A `didUpdate` callback to the `machines` lane that calls `computeStatus()`.


Here we define `computeStatus()`, as it is runs on for a bit, we'll inline the discussion in comments:

```java
  private void computeStatus() {

    int machineCount = 0; // one of the status fields we'll track for cluster status

    long totalLatency = 0L;
    int latencyCount  = 0;

     // maxSystemLoad is one of the status fields we'll track for cluster status
    double totalSystemLoad = 0.0, maxSystemLoad = 0.0;
    int systemLoadCount = 0;

    double avgCPUUsage = 0.0; // one of the status fields we'll track for cluster status

     // maxMemoryUsage is one of the status fields we'll track for cluster status
    float totalMemoryUsage = 0.0f, maxMemoryUsage = 0.0f;
    int memoryCount = 0;

    int clusterProcessCount = 0; // one of the status fields we'll track for cluster status

    // note that we can use the `keySet()` method on the `machines` lane to collect the keys
    // for each key, we can retrieve the `Value` for the machine's status
    final Set<Value> keys = this.machines.keySet();
    for (Value key : keys) {
      machineCount++;
      final Value machineStatus = this.machines.get(key);

      if (machineStatus.get("latency").isDefined()){
        latencyCount++;
        totalLatency += machineStatus.get("latency").longValue(0L);
      }

      if (machineStatus.get("average_system_load").isDefined()) {
        systemLoadCount++;
        double systemLoad = machineStatus.get("average_system_load").doubleValue(0);
        totalSystemLoad += systemLoad;
        if (systemLoad > maxSystemLoad) {
          maxSystemLoad = systemLoad;
        }
        avgCPUUsage = totalSystemLoad / systemLoadCount;
      }

      if (machineStatus.get("memory_usage").isDefined()) {
        memoryCount++;
        float memoryUsage = machineStatus.get("memory_usage").floatValue(0.0f);
        totalMemoryUsage += memoryUsage;
        if (memoryUsage > maxMemoryUsage) {
          maxMemoryUsage = memoryUsage;
        }
      }

      // Compute process count
      int machineProcessCount = machineStatus.get("process_count").intValue(0);
      clusterProcessCount = clusterProcessCount + machineProcessCount;
    }

    // these are the remaining fields we'll include in our status state
    final long avgLatency = latencyCount == 0 ? 0 : totalLatency / latencyCount;
    final double avgSystemLoad = systemLoadCount == 0 ? 0 : totalSystemLoad / systemLoadCount;
    final float avgMemoryUsage = memoryCount == 0 ? 0 : totalMemoryUsage / memoryCount;

    // note, we retrieve the pre-existing status and used `ValueLane.updated()` to update the fields in question.
    this.status.set(
            this.status.get()
                    .updated("machine_count", machineCount)
                    .updated("average_latency", avgLatency)
                    .updated("average_system_load", avgSystemLoad)
                    .updated("max_system_load", maxSystemLoad)
                    .updated("average_memory_usage", avgMemoryUsage)
                    .updated("max_memory_usage", maxMemoryUsage)
                    .updated("average_cpu_usage", avgCPUUsage)
                    .updated("cluster_process_count", clusterProcessCount)
    );
  }
```

Now we're ready to invoke `computeStatus()` from `machines.didUpdate()`:

```java
  @SwimLane("machines")
  JoinValueLane<Value, Value> machines = this.<Value, Value>joinValueLane()
          .didUpdate((k, nv, ov) -> {
            updateLastTimestampStatus(nv);
            computeStatus();

            if (nv.get("disconnected").isDefined()) {
              this.machines.remove(k);
            }
          });

```

# Where to Find Tutorial application source code

The complete application source code can be found here:
<a href="https://github.com/swimos/tutorial-monitor"  target="_blank">https://github.com/swimos/tutorial-monitor</a>

# Observing state changes via `swim-cli`

## Installing swim-cli

Nstream provices a console client in order to inspect data by streaming it to the command line. To install it globally via `npm`, just do the following:

```shell
npm install -g @swim/cli
```

## Running the Server
To run the server, do the following from the project directory:

```shell
./gradlew run
```

## Running a Client

```shell
$ ./gradlew -Dhost=<warp-address-of-server> runClient
```

## Introspection APIs

There are introspection APIs that give a systems view of the Nstream runtime, as well as application APIs, that stream application data produced by Web Agents.

### Stream High-level Stats
To get a high-level overview of the SwimOS runtime, you can utilize its introspection features:

```shell
swim-monitor % swim-cli sync -h warp://localhost:9001 -n swim:meta:mesh -l pulse
```

You should see something similar to this:

```json
{partCount:2,hostCount:2,nodeCount:2,agents:{agentCount:2,execRate:40521,execTime:150665010},downlinks:{linkCount:1},uplinks:{linkCount:1,eventRate:1,eventCount:1337}}
```

## Application APIs

### Streaming APIs for the Cluster

Since we are supporting a single cluster in this tutorial, it is hard-coded to "default." 

#### Listing the Machine Agents

Execute the following to list out the machine agents:

```shell
swim-cli sync -h warp://localhost:9001 -n /cluster/default -l machines
```

The results for `machines.didUpdate()` will look something like this. You can make note of the keys to monitor specific machines. In this case, we'll use `/machine/Someones-MacBook-Pro-2.local` as the machine agent end-point for machine-specific monitoring. 

```json
@update(key:"/machine/Someones-MacBook-Pro-2.local"){timestamp:1694390546463,latency:1,updating:true,severity:0.47664854,average_system_load:13.183279742765272,raw_uptime:155143000,formatted_uptime:"01:19:05:43",memory_usage:0.8114643,swap_usage:0.8132019,max_processor_usage:1,mean_processor_usage:1,is_charging:false,process_count:396}
```

#### Monitoring Cluster Status

Now let's look at cluster level status.

```shell
swim-cli sync -h warp://localhost:9001 -n /cluster/default -l status
```

You can recognize the cluster status fields we have defined previously:

```json
{timestamp:1694392453437,machine_count:1,average_latency:0,average_system_load:16.308376575240917,max_system_load:16.308376575240917,average_memory_usage:0.8335686,max_memory_usage:0.8335686,average_cpu_usage:16.308376575240917,cluster_average_memory_usage:0,cluster_process_count:342}
```

#### Monitoring Cluster Status History

```shell
swim-cli sync -h warp://localhost:9001 -n /cluster/default -l statusHistory
```

As you may recall, for the `ClusterAgent`'s `statusHistory`, the key is a timestamp, and the `timestamp` field is removed from the status state.

```json
@update(key:1694392087094){machine_count:1,average_latency:1,average_system_load:4.732561005669213,max_system_load:4.732561005669213,average_memory_usage:0.78855515,max_memory_usage:0.78855515,average_cpu_usage:4.732561005669213,cluster_average_memory_usage:0,cluster_process_count:400}

```

### Streaming APIs for a given Machine

#### Retrieving a Static System Information

```shell
swim-cli sync -h warp://localhost:9001 -n /machine/Freds-MacBook-Pro-2.local -l systemInfo
```

Since some system information is static, we write it once when creating the agent, as it doesn't change:

```json
{timestamp:1694386488339,os:{manufacturer:Apple,family:macOS,version:"13.3.1",bitness:64,process_count:351},hardware:{manufacturer:"Apple Inc.",model:"MacBookPro17,1",firmware_version:J293,processor:{vendor:"Apple Inc.",name:"Apple M1",max_freq:24000000000,physical_count:8,logical_count:8},memory:{total:8589934592}}}
```

#### Monitoring Status

```shell
swim-cli sync -h warp://localhost:9001 -n /machine/Freds-MacBook-Pro-2.local -l status
```

You can recognize the machine status fields we have defined previously:

```json
{timestamp:1694394439982,latency:3,updating:true,severity:0.4686365,average_system_load:10.849640822392866,raw_uptime:159036000,formatted_uptime:"01:20:10:36",memory_usage:0.7987766,swap_usage:0.8363495,max_processor_usage:1,mean_processor_usage:1,is_charging:false,process_count:346}
```

#### Monitoring Status History

```shell
swim-cli sync -h warp://localhost:9001 -n /machine/Freds-MacBook-Pro-2.local -l statusHistory
```

As you may recall, for the `MachineAgent`'s `statusHistory`, the key is a timestamp, and the `timestamp` field is removed from the status state.

```json
@update(key:1694393982655){latency:1,updating:true,severity:0.4423734,average_system_load:8.432245301681505,raw_uptime:158574000,formatted_uptime:"01:20:02:54",memory_usage:0.79042435,swap_usage:0.8270416,max_processor_usage:1,mean_processor_usage:1,is_charging:false,process_count:364}
```

#### Monitoring Resource Usage

```shell
swim-cli sync -h warp://localhost:9001 -n /machine/Freds-MacBook-Pro-2.local -l usage
```

Here's example output. You may recognize the data fields we defined for usage information:

```json
{timestamp:1694394734430,os:{boot_time:1694235403000,uptime:159331000,process_count:346,thread_count:885},hardware:{memory:{total:8589934592,available:1689600000,swap_total:4294967296,swap_used:3583705088,virtual_max:12884901888,virtual_in_use:10484039680},processor:{max_frequency:24000000000,current_frequency:{"0":24000000000,"1":24000000000,"2":24000000000,"3":24000000000,"4":24000000000,"5":24000000000,"6":24000000000,"7":24000000000},average_system_load:31.453201970443352},is_charging:false}}
```

#### Monitoring Processes

```shell
swim-cli sync -h warp://localhost:9001 -n /machine/Freds-MacBook-Pro-2.local -l processes
```

And here is process output. You may recognized the fields we defined for process information:
```json
@update(key:967){timestamp:1694394836069,pid:967,name:"Google Chrome Helper (GPU)",user:someone,user_id:"501",priority:31,virtual_size:453679202304,rss:59179008,cpu_load:0.0002551016374071222,uptime:159356092}
```
