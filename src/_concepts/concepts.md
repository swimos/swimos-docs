---
title: Swim Concepts
layout: page
---

Swim unifies the traditionally disparate roles of database, message broker, job manager, and application server, into a few simple constructs: 

- [Web Agents](/reference/agents)
- [Lanes](/reference/lanes)
- [Links](/reference/links)
- [Recon](/reference/recon)
- [WARP](/reference/warp)

<div class="row">
  <figure class="col col-12 text-center">
    <img src="{{site.baseurl}}/assets/images/agents-lanes-links.svg" style="max-width: 100%" alt="Agents, lanes, and links">
  </figure>
</div>

## Web Agents

Swim applications consist of interconnected, distributed objects, called [Web Agents](/reference/agents). Each Web Agent has URI address, like a REST endpoint. But unlike RESTful Web Services, Web Agents are stateful, and accessed via streaming APIs.

## Lanes

If Web Agents are distributed objects, then [lanes](/reference/lanes) serve as the properties and methods of those objects. Lanes come in many flavors, value lanes, map lanes, command lanes, and join lanes, to name a few. Many lanes are internally persistent, acting like encapsulated database tables.

## Links

Distributed objects need a way to communicate. [Links](/reference/links) establishes active references to lanes of Web Agents, transparently streaming bi-directional state changes to keep all parts of an application in sync, without the overhead of queries or remote procedure calls.

## Recon

Communication only works if all parties understand each other. Swim natively speaks a universal, structured data language, called [Recon](/reference/recon). A superset of JSON, XML, Protocol Buffers, and more, Recon naturally translates into many tongues.

## WARP

The [Web Agent Remote Protocol (WARP)](/reference/warp) enables bidirectional links to streaming API endpoints, called lanes, of URI-addressed distributed objects, called nodes, that run Web Agents.

Continue reading to learn more about [Web Agents](/reference/agents), [Lanes](/reference/lanes), [Links](/reference/links), and [Recon](/reference/recon). Or dive into the [tutorials](/tutorials) to learn by doing.
