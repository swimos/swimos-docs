---
title: Auth Policy
short-title: Auth Policy
description: "Add access control to Web Agents and lanes."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/auth_policy
redirect_from:
  - /java/reference/auth-policy.html
  - /java/tutorials/auth-policy/
---

In the [Planes guide]({% link _java_backend/planes.md %}), we created a security policy to only allow requests with a given token URL parameter. This guide will expand upon this to show how access can be restriced for given Agents and Lanes.

### Declaration and Instantiation

The recommended steps for implementing and adding a security policy to a Swim application:

- Declare a policy class, by extending `AbstractPolicy`
- Implement custom access control logic by overriding the `authorize` method
- Inject the policy into the plane on initilization

(Note that the policy does not have to be set in the constructor of the Plane. We could set the policy against the `PlaneContext` in main which would allow us to downlink lanes within the authorization logic.)

Here we give the most basic example of how to declare and add a policy to an application:

```java
// swim/basic/BasicPlane.java
package swim.basic;

import swim.api.auth.Identity;
import swim.api.plane.AbstractPlane;
import swim.api.policy.AbstractPolicy;
import swim.api.policy.PolicyDirective;
import swim.kernel.Kernel;
import swim.server.ServerLoader;
import swim.warp.Envelope;

public class BasicPlane extends AbstractPlane {

  // Inject policy. Swim internally calls the no-argument constructor, which retains
  // its implicit call to super() in Java
  public BasicPlane() {
    context.setPolicy(new BasicPolicy());
  }

  public static void main(String[] args) {
    final Kernel kernel = ServerLoader.loadServer();
    kernel.start();
    kernel.run();
  }


  // Define policy; doesn't have to be an inner class
  class BasicPolicy extends AbstractPolicy {
    @Override
    protected <T> PolicyDirective<T> authorize(Envelope envelope, Identity identity) {
      //Custom security logic here
    }
  }
}
```

## Access Control for Lanes and Agents

The Envelope object contains the `nodeUri` and `laneUri` of each request and so from here it is simple to add access control to given Agents or Lanes. Here we extend our previous example to only allow requests with an 'admin token' to make requests to `/control` agents and `adminInfo` lanes.

```java
// swim/basic/BasicPolicy.java
package swim.basic;

import swim.api.auth.Identity;
import swim.api.policy.AbstractPolicy;
import swim.api.policy.PolicyDirective;
import swim.warp.Envelope;

public class BasicPolicy extends AbstractPolicy {

  private static final String ADMIN_TOKEN = "abc123";
  private static final String USER_TOKEN = "abc";

  @Override
  protected <T> PolicyDirective<T> authorize(Envelope envelope, Identity identity) {
    if (identity != null) {
      final String token = identity.requestUri().query().get("token");

      //Always authorize admins
      if (ADMIN_TOKEN.equals(token)) {
        return allow();
      }

      //Admin tokens must be used for 'adminInfo' lanes or '/control' agents
      if ("adminInfo".equals(envelope.laneUri().toString()) ||
        envelope.nodeUri().toString().startsWith("/control")) {
        return forbid();
      }

      //Users can access any remaining lanes
      if (USER_TOKEN.equals(token)) {
        return allow();
      }
    }
    return forbid();
  }
}
```

## Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/auth_policy).
