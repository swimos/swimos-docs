---
title: Downlinks
short-title: Downlinks
description: "A link which provides a virtual bidirectional stream between the client and a lane of a remote Web Agent, multiplexed by a WARP client."
group: Connections
layout: documentation
redirect_from:
---

{% include alert.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior.' %}

A Downlink provides a virtual bidirectional stream between the client and a lane of a remote Web Agent. WARP clients transparently multiplex all links to [**Web Agents**]({% link _backend/web-agents.md %}) on a given host over a single WebSocket connection.

Downlinks come in several flavors, depending on the WARP subprotocol to which they conform. A [**ValueDownlink**]({% link _frontend/valueDownlink.md %}) synchronizes a structured value with a remote value lane. A [**MapDownlink**]({% link _frontend/mapDownlink.md %}) implements the WARP map subprotocol to synchronize key-value state with a remote map lane. A [**ListDownlink**]({% link _frontend/listDownlink.md %}) implements the WARP list subprotocol to to synchronize sequential list state with a remote list lane. And an [**EventDownlink**]({% link _frontend/eventDownlink.md %}) observes raw WARP events, and can be used to observe lanes of any kind.

This article will focus on the properties and methods which all types of downlinks have in common. Later articles on specific types of downlinks will go into detail on what is unique to each of them.

## Addressing Downlinks

Before opening, a downlink must be addressed with the `hostUri`, `nodeUri`, and `laneUri` to which it should connect.
* The `hostUri` is the domain name of the host application. It must always be prepended by either `warp://` or `warps://`.
* The `nodeUri` is the path to the Web Agent to which you wish to connect. If following our [**recommended design**]({% link _backend/agent-design.md %}), Web Agents will represent identifiable domain elements (think, a noun) and include the name of the entity type in the node URI, possibly alongside an ID (e.g. `/hotel/room/:roomId`).
* The `laneUri` is the most specific part of a downlink's address. A lane exposes a subset of a Web Agent's properties and methods. Lane content will vary greatly from lane to lane and will be heavily influenced by the subtype of lane to which it conforms.

For an overview of Web Agents, lanes, and the general structure of a Swim application, visit [**SwimOS Concepts**]({% link _backend/fundamentals.md %}).

The simplest and most common way to address a downlink is to pass an options object with the `hostUri`, `nodeUri`, and `laneUri` during initialization.

```javascript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
// set address within the downlink
const hvacDownlink = client
  .downlink({
    hostUri: "warp://example.com",
    nodeUri: "/hotel/room/123",
    laneUri: "hvac",
  });
```

Additionally, all or part of a downlink's address can be inherited from the `WarpClient` which is being used to open the downlink. This approach can be useful to avoid repeating oneself or when working with a large number of links.

```javascript
const client = new WarpClient();
client.hostUri.set("warp://example.com");
client.nodeUri.set("/hotel/room/123");
// inherit hostUri and nodeUri defined on client
const lightingDownlink = client
  .downlink({
    laneUri: "lighting",
  });
```

## Other Options

In addition to `hostUri`, `nodeUri`, and `laneUri`, there are a few other options available for customizing a downlink's behavior.

The `relinks` option determines whether or not a downlink should be automatically reopened after a network failure; it defaults to true.

The `syncs` parameter determines whether or not a downlink should synchronize with the remote lane when opened; it defaults to true for stateful lanes. When set to true, a newly opened downlink will be sent the lane's current state and will be subscribed to all future updates. When set to false, a downlink will receive future updates but will not be provided the lane's state at the time of opening.

<!-- A downlink may also be configured with a relative priority (`prio`), a max rate in milliseconds at which to accept updates (`rate`), and an optional body structure that can contain query or other link parameters to be passed to the remote lane (`body`). -->

```javascript
const client = new WarpClient();
const hvacDownlink = client
  .downlink({
    hostUri: "warp://example.com",
    nodeUri: "/hotel/room/123",
    laneUri: "hvac",
    relinks: true, // will automatically attempt to reconnect after a network failure
    syncs: false, // will not sychronize with remote lane state when opened; updates only
  });
```

## Opening a Downlink

The `open` method is used to open a downlink after it has been configured. The downlink is returned. Data will not begin streaming through the downlink until it has been opened. The `close` method closes a downlink.

```javascript
const client = new WarpClient();
const downlink = client
  .downlink({
    hostUri: "warp://example.com",
    nodeUri: "/hotel/floor/1",
    laneUri: "status"
  })
  .open();

downlink.close();
```

Closing a downlink does not necessarily close the underlying WARP link. The WARP client will keep a link open so long as at least one downlink to a given node and lane URI remains open. This prevents application components from stepping on each other's toes when they link to the same lanes of the same Web Agents. This can happen, for example, when a UI has a summary view and a detail view both display information derived from the same remote lane. The WARP link should not be closed when a detail view is hidden, if state updates are still required by the summary view. Events should also not be sent twice: once for the summary view, and once for the detail view. Neither the summary view nor the detail view should have to know about each other. And no global event dispatcher should be required, which could introduce consistency problems. WARP clients efficiently, and transparently, handle all of these cases on behalf of all downlinks.

## Downlink State and Lifecycle Callbacks

A number of methods are made available for retrieving key pieces of a downlink's state. Optional callbacks may also be registered for reacting to changes in these states or other key lifecycle events. Callbacks may be included in the options object passed when creating a downlink, or set individually after a downlink has been initialized.

The `connected` method returns true if the underlying connection to the remote host is currently open. `didConnect` registers an observer callback that gets invoked whenever a successful connection is made. Likewise, `didDisconnect` registers an observer callback which gets invoked when a connection has ended.

The `linked` method returns true if the logical WARP link is currently open. Changes to the link's state may be observed by registering callbacks with `willLink`, `didLink`, `willUnlink`, or `didUnlink`.

The `synced` method returns true if the WARP link is currently synchronized with the state of the remote lane. Users may observe synchronization using the `willSync` and `didSync` methods.

The `opened` method returns true if the downlink has been opened. This is not necessarily always the same value as `linked`. Providing a downlink with an invalid hostUri, for example, could result in `opened` returning true and `linked` returning false. `didClose` gets invoked when `close` is called on a downlink.

The `authenticated` method returns true if the underlying connection to the remote host is currently authenticated.

And finally, all downlinks support registering `onEvent` and `onCommand` callbacks. The `onCommand` method accepts a callback used for observing outgoing command messages. The `onEvent` method registers a callback for observing all incoming events. `onEvent` is the rawest form of handling WARP messages. In most cases, users will be better off handling incoming updates with specialized observer callbacks defined on downlink subtypes because they provide better context about the type of message being received, allowing us to handle them more appropriately. More on this in later sections.
