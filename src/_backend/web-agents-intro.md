---
title: Web Agents
short-title: Web Agents
description: "Learn about declaring, defining and utilizing Web Agents and their properties using configuration files."
group: Getting Started
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/web_agents
redirect_from:
  - /tutorials/web-agents/
  - /reference/web-agents.html
---

Swim servers utilize a general purpose distributed object model in which the objects are called **Web Agents**. 
Programming with this model feels like typical object-oriented programming with additional key innovations in addressability, statefulness, consistency, boundedness, and composability.

## Web Agent Principles

### Universally Addressable

Every Web Agent has a universal, logical address, in the form of a URI. By decoupling Web Agent's logical addresses from the network addresses of their host machines, Swim applications become invariant to the infrastructure on which they're deployed.

### Stateful

Web Agents remember their state in-between operations, eliminating the need for constant database round-trips, and greatly simplifying application development by avoiding object-relational mapping.

### Atomic

Each Web Agent executes in a single thread at a time. Though as many distinct Web Agents execute in parallel as you have CPU cores. Combined with a built-in software transactional memory model, Web Agents are naturally atomic, without the overhead of locks or transactions.

### Consistent

Together, Web Agents, Lanes, and Links implement a continuous consistency model that's largely transparent developers. Web Agents applications just stays consistent. Continuously. In network real-time.

### Encapsulated

The only way in or out of a Web Agent is through links to its lanes. This gives Web Agents total control over the exposure of sensitive data. There's no database to compromise.

### Persistent

Databases aren't the only way to store data. Web Agents are internally persistent. By taking persistence off the critical path, the single biggest bottleneck to application performances instantly vanishes. While still letting you keep all the data you have space for.

### Bounded

Intrinsic and pervasive backpressure handling automatically adapts the behavior of your application based on network, disk, and CPU availability. And because of its continuous consistency model, developers, for the most part, don't have to care.

### Decentralized

Web Agents inherit the natural decentralization of the World Wide Web. Any Web Agent can link to any other, given its URI, and appropriate permissions.

### Composable

Unlink REST applications, which don't compose well without introducing significantly polling latency, caching overhead, and consistency problems, Web Agents frictionlessly compose, in real-time, at any scale.

As the name implies, Web Agents were designed from first principles to be first class citizens of the World Wide Web. The Web has evolved from a world-wide hypertext library, into the lingua franca of distributed applications. But the technical foundation of the Web, stateless remote procedurce calls over HTTP, is fundamentally incapable of meeting the needs of modern, autonomous, collaborative applications. Web Agents aim to fill that gap.
