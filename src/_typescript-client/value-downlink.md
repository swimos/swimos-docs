---
title: Value Downlink
short-title: Value Downlink
description: "A WARP connection which synchronizes a shared real-time, scalar value with a remote value lane"
group: Connections
layout: documentation
redirect_from:
  - /frontend/valuedownlink/
---

{% include callout-warning.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0 or later. Users of earlier package versions may experience differences in behavior.' %}

A ValueDownlink synchronizes a shared real-time value with a remote value lane. In addition to the standard Downlink callbacks, ValueDownlink supports registering a `didSet` callback to observe changes to downlinked state — whether remote or local.

Create a ValueDownlink with a WARP client's `downlinkValue` method.

Use the `get` method to get the current state value, and the `set` method to set the current state value. For the most part, client code can treat a ValueDownlink like an ordinary mutable variable; the WARP client will ensure that the downlink is continuously made consistent with the remote lane.

```typescript
import { WarpClient } from "@swim/client";

valueDownlink = client.downlinkValue({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/room/123",
  laneUri: "light"
})
.open();
valueDownlink.get(); // get the current local state of the downlink
valueDownlink.set(newValue); // update the local and remote state of the downlink
```

Using `didSet` callbacks, applications can update UI views and other dependent components to keep them consistent with the shared state of the remote value lane in network real-time. The `didSet` callback may be provided as an option during downlink initialization or defined later on, as shown below.

```typescript
valueDownlink.didSet = (newValue) => {
  // update UI view with latest value
  document.getElementById("status").innerText = `Kitchen light is ${newValue.get("isOn") ? "on" : "off"}.`;
};
```

## State Type Disambiguation

A ValueDownlink views its state as a [**Value**]({% link _typescript-client/structures.md %}) by default. Use the `valueForm` option to create a typed projection of a ValueDownlink that automatically transforms its state using a [**Form**]({% link _typescript-client/form.md %}). The `Form` class comes with a number of ready-to-use instances for basic use cases. For example, you can use `Form.forBoolean()` to coerce a ValueDownlink's state to a boolean. `Form.forAny()` can be used to create a MapDownlink that coerces its state to an untyped JavaScript value; it's able to recognize primitive JavaScript values as well as arrays and plain old JavaScript objects, including nested objects. Forms for coercing state to a string, number, `Value`, and `Item` are also provided. 

```typescript
const light = client.downlinkValue({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/room/123",
  laneUri: "tableLamp",
  valueForm: Form.forBoolean(),
})
.open();

light.get(); // true


const frontDoor = client.downlinkValue({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/room/123",
  laneUri: "door",
  valueForm: Form.forAny(),
})
.open();

frontDoor.get(); // { locked: true, lastActivity: 1708030692845 }
```

## Typescript

ValueDownlink state may also be given a type annotation. All that is required is for a custom Form to be provided to the `valueForm` option. See our article on [**Forms**]({% link _typescript-client/form.md %}) for an example on how to do this.

```typescript
const frontDoor = client.downlinkValue<KeyCard>({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/room/123",
  laneUri: "lastEntrant",
  valueForm: new KeyCardForm(),
})
.open();

// typed KeyCard object
frontDoor.get(); // { id: 123456, issueAt: 1708030692845, authorizedUntil: 1708032815650 }
```
