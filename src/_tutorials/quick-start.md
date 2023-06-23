---
title: Quick Start
layout: page
redirect_from:
  - /start/
---

Swim implements a complete, self-contained, distributed application stack in an embeddable software library. To develop server-side Swim apps, add the [swim-api](https://github.com/swimos/swim/tree/main/swim-java/swim-runtime/swim-host/swim.api) library to your Java project. To write a JavaScript client application, install the [@swim/core](https://github.com/swimos/swim/tree/main/swim-js/swim-runtime/swim-core) library from npm. To build a web application, npm install the [@swim/ui](https://github.com/swimos/swim/tree/main/swim-js/swim-toolkit/swim-ui) and [@swim/ux](https://github.com/swimos/swim/tree/main/swim-js/swim-toolkit/swim-ux) libraries. Select one of the boxes below (or scroll down) to get started with Swim.

<!-- <div class="platform-case">
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="plane">
    <path fill="#e8e8e8" d="M 0 100 L 10 0 L 90 0 L 100 100 Z"></path>
  </svg>
  <div class="server-server platform-horizontal-center"></div>
  <div class="server-client platform-vertical-left"></div>
  <div class="server-client platform-vertical-right"></div>
  <div class="client-ui platform-vertical-right"></div>
  <a class="plane-label">Plane</a>
  <a href="#java-server" class="java-server platform-box platform-left">Java Server</a>
  <a href="#java-client" class="java-client platform-box platform-left">Java Client</a>
  <a href="#java-server" class="java-server platform-box platform-right">Java Server</a>
  <a href="#js-client" class="js-client platform-box platform-right">JavaScript Client</a>
  <a href="#web-ui" class="web-ui platform-box platform-right">Web UI</a>
</div>
<div class="release-stack">
  <p class="release-version">Current version: 4.0.1</p>
  <!-- <p class="release-notes"><a href="">View Release Notes</a></p>-->
<!-- </div> -->

To try Swim, check out one of our step-by-step [tutorials]({% link _tutorials/index.md %}). To build your own app, try cloning a [starter application](https://github.com/swimos/tutorial). Or continue reading to learn more about how to get started with Swim.

### Java Server Quick Start

The Swim Java Server is a self-contained, distributed application server for stateful, streaming applications. Swim Server provides applications with persistence without a database, point-to-point messaging without a message broker, and execution scheduling without a job manager. Swim applications communicate using the WARP protocol, a multiplexed streaming upgrade to HTTP.

<div class="artifact-case">
  <div class="artifact-stack">
    <a href="http://docs.swimos.org/java/latest/" class="artifact-header">
      <img src="{{ '/assets/images/social/java-gray.svg' | absolute_url }}" width="48" height="48" alt="Java">
    </a>
    <pre class="artifact-info">group: "<a href="https://mvnrepository.com/artifact/org.swimos" target="_blank">org.swimos</a>",<br>name: "<a href="https://mvnrepository.com/artifact/org.swimos/swim-server" target="_blank">swim-server</a>",<br>version: "<a href="https://mvnrepository.com/artifact/org.swimos/swim-server/4.0.1" target="_blank">4.0.1</a>"</pre>
  </div>
</div>

### Java Client Quick Start

The Swim Java Client is a minimal WARP streaming API client.

<div class="artifact-case">
  <div class="artifact-stack">
    <a href="http://docs.swimos.org/java/latest/" class="artifact-header">
      <img src="{{ '/assets/images/social/java-gray.svg' | absolute_url }}" width="48" height="48" alt="Java">
    </a>
    <pre class="artifact-info">group: "<a href="https://mvnrepository.com/artifact/org.swimos" target="_blank">org.swimos</a>",<br>name: "<a href="https://mvnrepository.com/artifact/org.swimos/swim-client" target="_blank">swim-client</a>",<br>version: "<a href="https://mvnrepository.com/artifact/org.swimos/swim-client/4.0.1" target="_blank">4.0.1</a>"</pre>
  </div>
</div>

### JavaScript Client Quick Start

The Swim JavaScript Client is a WARP streaming API client for Node.js and Browser applications.

<div class="artifact-case">
  <div class="artifact-stack">
    <a href="http://docs.swimos.org/js/latest/" class="artifact-header">
      <img src="{{ '/assets/images/social/js-gray.svg' | absolute_url }}" width="48" height="48" alt="JavaScript">
    </a>
    <pre class="artifact-info">npm i <a href="https://www.npmjs.com/package/@swim/core" target="_blank">@swim/core</a></pre>
  </div>
</div>

### Web UI Quick Start

The Swim Web UI framework is a dependency-free user interface toolkit for pervasively real-time web applications. It provides everything you need to bind user interface components to WARP streaming APIs. The Swim UX framework implements easy-to-use, procedurally animatable gauges, pies, charts, maps, and more.

<div class="artifact-case">
  <div class="artifact-stack">
    <a href="http://docs.swimos.org/js/latest/" class="artifact-header">
      <img src="{{ '/assets/images/social/browser-gray.svg' | absolute_url }}" width="48" height="48" alt="Browser">
    </a>
    <pre class="artifact-info">npm i <a href="https://www.npmjs.com/package/@swim/ui" target="_blank">@swim/ui</a><br>npm i <a href="https://www.npmjs.com/package/@swim/ux" target="_blank">@swim/ux</a></pre>
  </div>
</div>

### Next Steps

Continue reading to tryout step-by-step lessons with Swim. Or dive into the core Swim [concepts]({% link _concepts/index.md %}).
