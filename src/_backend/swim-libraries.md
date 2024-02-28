---
title: Swim Libraries
short-title: Swim Libraries
description: "Use SwimOS back-end and front-end components to build streaming data applications."
group: Getting Started
layout: documentation
redirect_from:
  - /start/
  - /reference/swim-libraries.html
---

Swim implements a complete, self-contained, distributed application stack in an embeddable software library. To develop server-side Swim apps, add the [swim-api](https://github.com/swimos/swim/tree/main/swim-java/swim-runtime/swim-host/swim.api) library to your Java project. To write a JavaScript client application, install the [@swim/core](https://github.com/swimos/swim/tree/main/swim-js/swim-core) library from npm. To build a web application, npm install the [@swim/ui](https://github.com/swimos/swim/tree/main/swim-js/swim-ui) and [@swim/ux](https://github.com/swimos/swim/tree/main/swim-js/swim-ux) libraries. Select one of the boxes below (or scroll down) to get started with Swim.

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
  <p class="release-version">Current version: 4.1.0.12</p>
  <!-- <p class="release-notes"><a href="">View Release Notes</a></p>-->
<!-- </div> -->

To try Swim, check out one of our step-by-step [tutorials]({% link _tutorials/index.md %}). To build your own app, try cloning a [starter application](https://github.com/swimos/tutorial). Or continue reading to learn more about how to get started with Swim.

### Java Server Quick Start

The Swim Java Server is a self-contained, distributed application server for stateful, streaming applications. Swim Server provides applications with persistence without a database, point-to-point messaging without a message broker, and execution scheduling without a job manager. Swim applications communicate using the WARP protocol, a multiplexed streaming upgrade to HTTP.

```java
group: "org.swimos",
name: "swim-server",
version: "4.2.14"
```


### Java Client Quick Start

The Swim Java Client is a minimal WARP streaming API client.

```java
group: "org.swimos",
name: "swim-client",
version: "4.2.14"
```

### JavaScript Client Quick Start

The Swim JavaScript Client is a WARP streaming API client for Node.js and Browser applications.

```console
npm i @swim/core
```

### Web UI Quick Start

The Swim Web UI framework is a dependency-free user interface toolkit for pervasively real-time web applications. It provides everything you need to bind user interface components to WARP streaming APIs. The Swim UX framework implements easy-to-use, procedurally animatable gauges, pies, charts, maps, and more.

```console
npm i @swim/ui
npm i @swim/ux
```

### Next Steps

Continue reading to tryout step-by-step lessons with Swim. Or dive into the core Swim [concepts]({% link _backend/index.md %}).
