---
title: Event Downlink
short-title: Event Downlink
description: "A WARP connection which provides a raw view of a WARP link. It receives all updates but is not purpose-built for a specific lane type."
group: Connections
layout: documentation
redirect_from:
---

_This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior._

`EventDownlink` is not so much a subtype of `Downlink` as it is the base type of all downlinks. While not literally a superclass of `ValueDownlink`, `MapDownlink`, and `ListDownlink`, `EventDownlink` inherits from the same prototype as the others but contains no additional frills. For example, `MapDownlink` and `ListDownlink` support registering different callbacks for observing when a key-value pair has been added versus when one has been removed; and `ValueDownlink` has the `didSet` callback for when its value has been updated. `EventDownlink`, on the other hand, offers no specialized handling of WARP messages with respect to the type of Web Agent lane it is connected to. It provides a raw view of a WARP link, passing all received messages to a single `onEvent` callback.

Create an EventDownlink with a WARP client's `downlink` method.

```typescript
import { WarpClient } from "@swim/client";

const downlink = client.downlink({
  hostUri: "warp://example.com",
  nodeUri: "/house",
  laneUri: "power/meter",
})
.open();
```

Using the `onEvent` callback, an application may update UI views and other dependent components in response to any messages received from the Web Agent.

```typescript
downlink.onEvent = (event) => {
  // update UI view with latest value
  document.getElementById("status").innerText = `The house has used ${event.get("powerConsumption").numberValue()} kWh.`;
};
```

## Typescript

The format of an EventDownlink's state is unconstrained, therefore, EventDownlink may not be passed any [**Forms**]({% link _frontend/form.md %}) and type annotation via that route is not supported. Any necessary typechecking must be done ad hoc within the `onEvent` callback.
