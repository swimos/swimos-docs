---
title: Understanding the SwimOS logging API
short-title: Logging
description: "Making use of the SwimOS logging interface from various contexts."
group: Reference
layout: documentation
redirect_from:
  - /tutorials/logging/
---

The public interface for logging, <a href="swim-java/swim-runtime/swim-core/swim.util/src/main/java/swim/util/Log.java" target="_blank">`swim.util.Log`</a> defines six methods, all of which return `void` and take single parameter of type `Objecct`. Here is an example:

```
  void trace(Object message);
```

The supported methods, from lowest to high, are:

- trace: Logs a trace-level message.
- debug: Logs a debug-level message.
- info: Logs an info-level message.
- warn: Logs a warn-level message.
- error: Logs an error-level message.
- fail: Logs an fail-level message.

This interface can be found on several classes, such as `AbstractPlane`, `AbstractAgent`, and all of the lane types, such as `CommandLane`, `ValueLane`, and `MapLane`. Implementation-wise, they will ultimately print the message passed down, so additional enhancement to show context such as agent, host, node, and lane can be accomplished using a wrapper within your Web Agent implementation.

Invoking a log method within a Web Agent method might look like this:

```
info("SpecialAgent initialized for " + nodeUri());
```

### Example

Let's consider a simple example that illustrates logging from various contexts.

#### `src/main/resources/server.recon`

```
logville: @fabric {
    @plane(class: "logville.MainPlane")

    @node {
        uri: "/lonewolf"
        @agent(class: "logville.Agent")
    }
}
@web(port: 9001) {
    space: "logville"
}
```

#### `src/main/java/logville/MainPlane.java`

```
package logville;

import swim.api.plane.AbstractPlane;
import swim.kernel.Kernel;
import swim.server.ServerLoader;
import swim.structure.Text;

public class MainPlane extends AbstractPlane {

    public static void main(String[] args) {
        final Kernel kernel = ServerLoader.loadServer();
        System.out.println("Starting server...");
        kernel.start();
        System.out.println("Running server...");
        kernel.run();
    }
    
    @Override
    public void didStart() {
      this.info("Hello, world, from MainPlane!"); // the Log interface is invoked on `AbstractPlane`
      command("/lonewolf", "howl", Text.from("Auuuuu!"));
    }
}
```

#### `src/main/java/logville/Agent.java`

```
package logville;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;

public class Agent extends AbstractAgent {

  @SwimLane("howl")
  CommandLane<String> howl = this.<String>commandLane()
      .onCommand(message -> this.info(nodeUri() + ": howl: " + message)); // the Log interface is invoked on AbstractLane

  @Override
  public void didStart() {
    this.info(nodeUri() + ": Hello, agent!"); // the Log interface is invoked on AbstractAgent
  }

}
```

### Conclusion

The Swim logging API offers a flexible and intuitive mechanism for logging within the SwimOS framework. By utilizing the swim.util.Log interface that exists on common objects in the SwimOS ecosystem, you can easily integrate logging into your applications, whether it be on planes, agents, or lanes. The range of log levels from trace to fail allows for detailed categorization of log messages, ensuring that the right amount of information is captured for various scenarios. Logging is a critical part of any application for monitoring, debugging, and maintaining healthy system operations. In Swim applications, this becomes even more crucial due to the dynamic and distributed nature of the system.

By incorporating contextual information such as node URIs and agent specifics into log messages, you can gain a clearer and more comprehensive understanding of your system's behavior and performance. This capability enhances the observability of the SwimOS application, making it easier to diagnose issues and understand system interactions.

