---
title: Getting Started
short-title: Getting Started
description: "Steps for connecting to a SwimOS application and building UIs powered by streaming data"
group: Introduction
layout: documentation
redirect_from:
---

{% include alert.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior.' %}

Swim is a full stack **streaming application platform** for building stateful services, streaming APIs, and real-time UIs. Streaming applications push differential state changes through the full application stack, eliminating the need for polling and streaming only what each client chooses to observe. Real-time UIs render live views of distributed application state.

Creating a real-time UI starts with [**WARP Client**]({% link _frontend/warpClient.md %}), a streaming API client for consuming multiplexed streaming APIs. It opens links to lanes of stateful Web Agents using the [**WARP**]({% link _frontend/whatIsWarp.md %}) protocol, enabling massively real-time applications that continuously synchronize all shared states with half ping latency. The client requires no configuration and makes opening links to Web Agents a cinch. It is UI framework-agnostic and works in both browser and Node.js runtime environments.

## Installation

To begin using WARP client, install the `@swim/client` package.

<span style="font-size:20px;font-weight:600">**NPM**</span>
```bash
npm install @swim/client@dev
```

<span style="font-size:20px;font-weight:600">**CDN**</span>

```html
<!-- Development -->
<script src="https://cdn.swimos.org/js/4.0.0/swim.js"></script>

<!-- Production -->
<script src="https://cdn.swimos.org/js/4.0.0/swim.min.js"></script>
```

## Usage

<span style="font-size:20px;font-weight:600">**NPM**</span>

Exports of `@swim/client` may be imported as ES modules in ES2015-compatible environments. You may also import modules from a number of other Swim libraries installed as dependencies of `@swim/client`. A notable example of this is `@swim/structure` which we will see referenced in later sections.

```typescript
import { WarpClient } from "@swim/client";
import { Value } from "@swim/structure";
```

<span style="font-size:20px;font-weight:600">**Browser / CDN**</span>

The swim.js script bundles exports from `@swim/client`, its Swim dependencies, and a number of additional Swim libraries useful for building real time UIs, including tools for making charts and maps. When loaded by a web browser, the swim.js script adds all library exports to the global `swim` namespace.

```javascript
const client = new swim.WarpClient();
```

<span style="font-size:20px;font-weight:600">**TypeScript**</span>

Typescript definition files are provided in the libraries.

All downlink variants support the ability to provide type information for incoming and outgoing WARP messages. The exception to this is [EventDownlink]({% link _frontend/eventDownlink.md %}), which should rarely be used. See our article on [**Forms**]({% link _frontend/form.md %}) for more details and an example of how to provide downlinks with type information.

## Quick Start

Connecting to a remote Web Agent with the WARP client can be done in just a few lines.

Import and initialize an instance of `WarpClient`.

```typescript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
```

Next, create a link for connecting to your remote Web Agent.

```typescript
const downlink = client.downlink();
```

Then provide your link with the URI of the Web Agent to which you wish to connect.

```typescript
downlink.setHostUri("warp://example.com");
downlink.setNodeUri("/myAgent");
downlink.setLaneUri("someLane");
```

And define a callback for handling messages received by the link.

```typescript
downlink.onEvent = (value) => {
  const userCount = `${value.stringValue("0")} Users`;
  document.getElementById("active-user-count").innerText = userCount;
};
```

Finally, open your downlink.

```typescript
downlink.open();
```

Once the downlink is open, events should begin streaming into the application. Whether they arrive as a trickle or a flood, applications may use these messages to update UI views and other dependent components, keeping them consistent with the shared state of the remote Web Agent in network real-time.
