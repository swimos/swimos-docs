---
title: WarpClient
short-title: WarpClient
description: "The go-to starting point for most data streaming and connection management use cases"
group: Connections
layout: documentation
redirect_from:
  - /frontend/warpclient/
---

{% include callout-warning.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0 or later. Users of earlier package versions may experience differences in behavior.' %}

**WarpClient** is the class which behaves as the primary mechanism for handling connection management and link routing. WARP clients transparently multiplex all links to [**Web Agents**]({% link _java-server/web-agents.md %}) on a given host over a single WebSocket connection, and automatically manage the network connection to each host, including reconnection and resynchronization after a network failure. Key lifecycle events may also be observed through the registration of callbacks.

Besides managing connections and opening links (from here on called [**downlinks**]({% link _typescript-client/downlinks.md %})) to Web Agents, WARP clients do many other things. They can be used to send arbitrary WARP commands, provide authentication credentials for hosts, and create HostRef, NodeRef, and LaneRef scopes to facilitate downlink management. Additionally, when multiple downlinks are opened to the same lane of the same remote Web Agent, WARP clients seamlessly handle multicast event routing.

## Instantiating a WarpClient

`WarpClient`'s constructor requires no arguments.

```javascript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
```

A singleton is also available via the `.global()` getter method.

```javascript
import { WarpClient } from "@swim/client";

const globalClient = WarpClient.global();
```

## Opening Downlinks

A [**downlink**]({% link _typescript-client/downlinks.md %}) provides a virtual bidirectional stream over which data can be synchronized between the client and a lane of a remote Web Agent. WARP clients transparently multiplex all links to Web Agents on a given host over a single WebSocket connection. A downlink represents one link in this scenario.

`WarpClient` includes three methods that open different kinds of downlinks. The `downlink` method creates an EventDownlink for streaming raw events from any Web Agent lane. The `valueDownlink` method creates a ValueDownlink for synchronizing state with a Web Agent [value lane]({% link _java-server/value-lanes.md %}). A ValueDownlink views its state as a @swim/structure [**Value**]({% link _typescript-client/structures.md %}) by default, which itself may represent any kind of JavaScript value, be it primitive or composite. `Value`s may be coerced into a strongly-typed value by passing a `Form` to the `valueForm` option.  The `mapDownlink` method creates a MapDownlink. This type of downlink is useful for synchronizing state with any Web Agent lane backed by a map. In addition to [**map lanes**]({% link _java-server/map-lanes.md %}), this includes [**join value lanes**]({% link _java-server/join-value-lanes.md %}) and [**join map lanes**]({% link _java-server/join-map-lanes.md %}), which are maps of other value lanes and maps lanes, respectively.

Here is an example of opening an EventDownlink. We will go into further detail on all of the downlink types in subsequent sections.

```javascript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
const downlink = client
  .downlink({
    hostUri: "warp://example.com",
    nodeUri: "/building/1",
    laneUri: "status"
  })
```

## Observing Lifecycle Events

`WarpClient` instances can also be used to observe key lifecycle events. The `didConnect` method registers an observer callback that gets invoked whenever a connection to a WARP host is established. The `didDisconnect` method registers an observer callback that gets invoked whenever a WARP host disconnects. `didAuthenticate` registers an observer callback that gets invoked whenever the client successfully authenticates with a WARP host. The `didDeauthenticate` method gets invoked when a WARP host rejects the client's authentication credentials. And `didFail` registers an observer callback that gets invoked when the client encounters an unexpected error.

```typescript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
client.hostDidConnect = (host) => {
  console.log("connected to", host);
}
client.hostDidDisconnect = (host) => {
  console.log("disconnected from", host);
}
client.hostDidAuthenticate = (session, host) => {
  console.log("authenticated to", host, "with session", session.toLike());
}
client.hostDidDeauthenticate = (reason, host) => {
  console.log("deauthenticated from", host, "because", reason.toLike());
}
client.hostDidFail = (error, host) => {
  console.log("host", host, "failed because", error);
}
```

## Authentication

The `authenticate` method associates a credentials structure with a particular host URI. The credentials will be sent in a WARP @auth envelope whenever the client connects to the specified host.

```typescript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
client.authenticate("warps://example.com", {"@openId": jwt});
```

Distinct `WarpClient` instances can be used to create isolated connection pools for different security domains.

```typescript
import { WarpClient } from "@swim/client";

const userClient = new WarpClient();
userClient.authenticate("warps://example.com", {"@openId": userJwt});

const toolClient = new WarpClient();
toolClient.authenticate("warps://example.com", {"@oauth": toolJwt});
```

## Sending Commands

The `command` method sends a WARP command message to a lane of a remote node. `command` takes up to four arguments: a host URI, a node URI, a lane URI, and a command payload. The URIs may be ommitted if they are already set on the `WarpClient`, though a command payload is always required. A URI with more specificity may not be ommitted if a less specific one is included. For example, the first two commands below are valid while the third is not.

```typescript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
client.command("warp://example.com", "/house/kitchen", "light", "off"); // valid

client.hostUri.set("warp://example.com");
client.command("/house/kitchen", "light", "off"); // valid

client.laneUri.set("light");
client.command("/house/kitchen", "off"); // invalid
```

## Refs

`Refs` are a useful tool for grouping and organizing downlinks. Still capable of sending commands, providing authentication credentials, and opening downlinks, `Refs` can be thought of as a particular scope of a WarpClient instance, and where it stores a subset of its links. This analogy of scope is accurate as the `Refs` are actually instances of a class called `WarpScope`. `Refs` must have a portion of their address pre-configured — at minimum the `hostUri`, and optionally the `nodeUri` and `laneUri`. When downlinks are opened from a `Ref` they are bound to the portion of the address provided.

### HostRef

A `HostRef` only needs a `hostUri` to be initialized.

```typescript
import { WarpClient } from "@swim/client";

const hostRef = client.hostRef("warp://example.com");
hostRef.downlink({
  nodeUri: "house/kitchen",
  laneUri: "light"
})
.open();
```

The `HostRef.nodeRef` and `HostRef.laneRef` instance methods can be used to create further resolved WARP scopes.

```typescript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
const hostRef = client.hostRef("warp://example.com");
const nodeRef = hostRef.nodeRef("/house/kitchen");
const laneRef = nodeRef.laneRef("/house/kitchen", "light");
```

### NodeRef

A `NodeRef` needs a `hostUri` and a `nodeUri` to be initialized.

```typescript
const nodeRef = client.nodeRef("warp://example.com", "/house/kitchen");
nodeRef.downlink({ laneUri: "light" }).open();
```

The `NodeRef.laneRef` instance method can be used to create further resolved WARP scopes.

```typescript
const nodeRef = client.nodeRef("warp://example.com", "/house/kitchen");
const laneRef = nodeRef.laneRef("light");
```

### LaneRef

A `LaneRef` needs all three of `hostUri`, `nodeUri`, and `laneUri` to be initialized.

```typescript
const laneRef = client.laneRef("warp://example.com", "/house/kitchen", "light");
laneRef.downlink().open();
```

## Utility Methods

### isOnline

The `isOnline` method returns true when the the client has access to a network; it can also be used to force a client online or offline. The WarpClient.keepOnline method controls whether or not the client should automatically reopen connections after a network failure. Note that the keepOnline state of the client overrides the keepLinked state of individual downlinks. Setting keepOnline to false can be useful for ephemeral clients, but should typically be left true.

```typescript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
client.isOnline(); // true most of the time

client.isOnline(false); // force offline
client.isOnline(true); // force online

client.keepOnline(); // defaults to true

client.keepOnline(false); // disable network reconnection
```
