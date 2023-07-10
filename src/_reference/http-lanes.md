---
title: HTTP Lanes
layout: page
description: "Expose a HTTP endpoint for Web Agents."
redirect_from:
  - /tutorials/http-lanes/
---

In previous tutorials, we have seen how Swim applications consist of interconnected [Web Agents]({% link _reference/web-agents.md %}) with properties and methods in the form of [Lanes]({% link _reference/command-lanes.md %}).

**HTTP Lanes** accept HTTP requests and respond enabling Web Agents to expose **endpoints**. This allows Web Agent's state to be viewed or modified from outside of Swim applications through the use of **REST APIs**.

### Declaration

All lanes are declared inside Web Agents as fields annotated with `@SwimLane`. The parameter inside this annotation is the lane's **laneUri**. Recall that every Web Agent has a universal, logical address known as its **nodeUri**; `laneUri`s are simply the equivalent counterpart for lanes.

The following declaration is sufficient to make the `http` lane of every `UnitAgent` addressable by the laneUri `"http"`:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.http.HttpLane;
import swim.structure.Value;

public class UnitAgent extends AbstractAgent {
  @SwimLane("http")
  HttpLane<Value> http;
}
```

### Instantiation

The `AbstractAgent` class comes with utility methods to construct runnable lanes. Recall, however, that developers rarely instantiate Web Agents by explicitly invoking their constructors. The recommended pattern for adding a HTTP lane to an Agent is instead to:

- Exclude constructors entirely from Web Agents
- Use the `httpLane()` method to instantiate the lane; note that this is a parametrized method
- Through a builder pattern, override the lane's `doRespond()` method, returning a HTTP response
- The lane is addressable by combining `hostUri`, `nodeUri` and a query parameter of the lane name (example below).

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.http.HttpLane;
import swim.http.HttpResponse;
import swim.http.HttpStatus;
import swim.structure.Value;

public class UnitAgent extends AbstractAgent {
  @SwimLane("http")
  HttpLane<Value> http = this.<Value>httpLane()
      .doRespond(request -> {
        return HttpResponse.from(HttpStatus.OK).body("Hello World");
      });
}
```

The `http` lane in the example above, when running on `localhost:9001` and agent has nodeUri `/unit`, can be addressed with: `localhost:9001/unit?lane=http`. A HTTP response with body of `Hello World` will be returned to every request.

### HTTP Methods

The `HttpRequest` object, passed to the callback method of the lane, has access to the HTTP method of the request with `method()`, we can use this to determine the operation required. Here we add the ability to alter the state of an agent by using a `POST` request:

```java
// swim/basic/UnitAgent.java
package swim.basic;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.http.HttpLane;
import swim.api.lane.ValueLane;
import swim.http.HttpMethod;
import swim.http.HttpResponse;
import swim.http.HttpStatus;
import swim.http.MediaType;
import swim.recon.Recon;
import swim.structure.Value;

public class UnitAgent extends AbstractAgent {

  @SwimLane("state")
  ValueLane<Value> state = this.<Value>valueLane()
      .didSet((newValue, oldValue) -> {
        System.out.println("State changed from " + Recon.toString(oldValue) + " to " + Recon.toString(newValue));
      });

  @SwimLane("http")
  HttpLane<Value> http = this.<Value>httpLane()
      .doRespond(request -> {
         **if (HttpMethod.POST.equals(request.method())) state.set(request.entity().get());**
          return HttpResponse.from(HttpStatus.OK).body(Recon.toString(state.get()), MediaType.applicationXRecon());
        });
}
```

### Content Type

As well as **Recon**, HTTP Lanes also allow for different content types to be returned in the response body such as **Json**. Simply add the media type when setting the body of the HTTP response. 

Here we create a new lane in our previous example to return a Json response:

```java
// swim/basic/UnitAgent.java
  @SwimLane("httpJson")
  HttpLane<Value> httpJson = this.<Value>httpLane()
      .doRespond(request ->
        HttpResponse.from(HttpStatus.OK).body(Json.toString(state.get()), MediaType.applicationJson()));
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/http_lanes).

