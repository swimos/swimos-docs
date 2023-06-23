---
title: Swim Concepts
layout: page
---

Swim unifies the traditionally disparate roles of database, message broker, job manager, and application server, into a few simple constructs: 

- [Web Agents]({% link _reference/agents.md %})
- [Lanes]({% link _reference/lanes.md %})
- [Links]({% link _reference/links.md %})
- [Recon]({% link _reference/recon.md %})
- [WARP]({% link _reference/warp.md %})

<div class="row">
  <figure class="col col-12 text-center">
    <img src="{{ '/assets/images/agents-lanes-links.svg' | absolute_url }}" style="max-width: 100%" alt="Agents, lanes, and links">
  </figure>
</div>

## Web Agents

Swim applications consist of interconnected, distributed objects, called [Web Agents]({% link _reference/agents.md %}). Each Web Agent has URI address, like a REST endpoint. But unlike RESTful Web Services, Web Agents are stateful, and accessed via streaming APIs.

## Lanes

If Web Agents are distributed objects, then [lanes]({% link _reference/lanes.md %}) serve as the properties and methods of those objects. Lanes come in many flavors, value lanes, map lanes, command lanes, and join lanes, to name a few. Many lanes are internally persistent, acting like encapsulated database tables.

## Links

Distributed objects need a way to communicate. [Links]({% link _reference/links.md %}) establishes active references to lanes of Web Agents, transparently streaming bi-directional state changes to keep all parts of an application in sync, without the overhead of queries or remote procedure calls.

## Recon

Communication only works if all parties understand each other. Swim natively speaks a universal, structured data language, called [Recon]({% link _reference/recon.md %}). A superset of JSON, XML, Protocol Buffers, and more, Recon naturally translates into many tongues.

## WARP

The [Web Agent Remote Protocol (WARP)]({% link _reference/warp.md %}) enables bidirectional links to streaming API endpoints, called lanes, of URI-addressed distributed objects, called nodes, that run Web Agents.

Continue reading to learn more about [Web Agents]({% link _reference/agents.md %}), [Lanes]({% link _reference/lanes.md %}), [Links]({% link _reference/links.md %}), and [Recon]({% link _reference/recon.md %}). Or dive into the [tutorials]({% link _tutorials/index.md %}) to learn by doing.
