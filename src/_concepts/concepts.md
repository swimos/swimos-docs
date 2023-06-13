---
title: Swim Concepts
layout: page
---

Swim unifies the traditionally disparate roles of database, message broker, job manager, and application server, into a few simple constructs: <a href="/concepts/agents">Web Agents</a>, <a href="/concepts/lanes">Lanes</a>, <a href="/concepts/links">Links</a>, <a href="/concepts/recon">Recon</a> and <a href="/concepts/warp">WARP</a>.
</article>

<div class="row">
  <figure class="col col-12 text-center">
    <img src="/assets/images/agents-lanes-links.svg" style="max-width: 100%">
  </figure>
</div>

<div class="feature-stack">
  <a href="/concepts/agents" class="feature-block feature-block-left">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>Web Agents</h3>
      <p>Swim applications consist of interconnected, distributed objects, called <em>Web Agents</em>. Each Web Agent has URI address, like a REST endpoint. But unlike RESTful Web Services, Web Agents are stateful, and accessed via streaming APIs.</p>
    </div>
  </a>
  <a href="/concepts/lanes" class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>Lanes</h3>
      <p>If Web Agents are distributed objects, then <em>lanes</em> serve as the properties and methods of those objects. Lanes come in many flavors, value lanes, map lanes, command lanes, and join lanes, to name a few. Many lanes are internally persistent, acting like encapsulated database tables.</p>
    </div>
  </a>
  <a href="/concepts/links" class="feature-block feature-block-left">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>Links</h3>
      <p>Distributed objects need a way to communicate. <em>Links</em> establishes active references to lanes of Web Agents, transparently streaming bi-directional state changes to keep all parts of an application in sync, without the overhead of queries or remote procedure calls.</p>
    </div>
  </a>
  <a href="/concepts/recon" class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>Recon</h3>
      <p>Communication only works if all parties understand each other. Swim natively speaks a universal, structured data language, called <em>Recon</em>. A superset of JSON, XML, Protocol Buffers, and more, Recon naturally translates into many tongues.</p>
    </div>
  </a>
  <a href="/concepts/warp" class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>WARP</h3>
      <p>
        The Web Agent Remote Protocol (WARP) enables bidirectional links to streaming API endpoints, called lanes, of URI-addressed distributed objects, called nodes, that run Web Agents.</p>
    </div>
  </a>
</div>

Continue reading to learn more about <a href="/concepts/agents">Web Agents</a>, <a href="/concepts/lanes">Lanes</a>, <a href="/concepts/links">Links</a>, and <a href="/concepts/recon">Recon</a>. Or dive into the <a href="/tutorials">tutorials</a> to learn by doing.
