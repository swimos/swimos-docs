---
title: Map Downlink
short-title: Map Downlink
description: "A WARP connection which synchronizes a shares real-time, key-value map with a remote map lane"
group: Connections
layout: documentation
redirect_from:
  - /frontend/mapdownlink/
---

{% include callout-warning.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0 or later. Users of earlier package versions may experience differences in behavior.' %}

A MapDownlink synchronizes a shared real-time key-value map with with any Web Agent lane backed by a map. In addition to [**map lanes**]({% link _java-server/map-lanes.md %}), this includes [**join value lanes**]({% link _java-server/join-value-lanes.md %}) and [**join map lanes**]({% link _java-server/join-map-lanes.md %}), which are maps where each entry is its own value lane or maps lane, respectively. In addition to the standard Downlink callbacks, MapDownlink supports registering `didUpdate`, and `didRemove` callbacks for observing changes to downlinked map state — whether remote or local. `didUpdate` is invoked when an existing map key is updated or a new key is added. `didRemove` gets called when a map key is removed.

Create a MapDownlink with a WARP client's `downlinkMap` method.

MapDownlink implements the standard JavaScript Map interface. Use the `get` method to get the value associated with a given key. Use the `set` method to update the value associated with a key. And use the `delete` method to remove a key and its associated value.

```typescript
import { WarpClient } from "@swim/client";

const mapDownlink = client.downlinkMap({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/lobby",
  laneUri: "elevators"
})
.open();
mapDownlink.get("guest"); // get the locally cached value associated with the key
mapDownlink.set("service", newElevator); // locally and remotely insert a new entry
mapDownlink.delete("parking"); // locally and remotely remove an existing entry
```

For the most part, client code can treat a MapDownlink like an ordinary JavaScript Map; the WARP client will ensure that the downlink is continuously made consistent with the remote lane. Using `didUpdate` and `didRemove` callbacks, applications can update UI collection views and other dependent components to keep them consistent with the shared state of the remote map lane in network real-time. Callbacks may be provided as an option during downlink initialization or defined later on, as shown below.

```typescript
mapDownlink.didUpdate = (key, value) => {
  if (hasChildElement(key)) {
    // update existing UI view for key
  } else {
    // insert new UI view for key
  }
}
mapDownlink.didRemove((key) => {
  // remove UI view for key
})
```

## State Type Disambiguation

A MapDownlink views its keys and values as [**Values**]({% link _typescript-client/structures.md %}) by default. Provide an instance of a [**Form**]({% link _typescript-client/form.md %}) to the `keyForm` and/or `valueForm` options to create a typed projection of a MapDownlink that automatically transforms its keys and values, respectively, and provides type annotations. The `Form` class comes with a number of ready-to-use instances for basic use cases. For example, you can use `Form.forBoolean()` to coerce a MapDownlink's state to a boolean. `Form.forAny()` can be used to create a MapDownlink that coerces its state to an untyped JavaScript value; it's able to recognize primitive JavaScript values as well as arrays and plain old JavaScript objects, including nested objects. Forms for coercing state to a string, number, `Value`, and `Item` are also provided.

```typescript
const elevators = client.downlinkMap({
  hostUri("warp://example.com"),
  nodeUri("/hotel/lobby"),
  laneUri("elevators"),
  keyForm(Form.forString()),
  valueForm(Form.forAny()),
  didUpdate((key, value) => /* ... */),
  didRemove((key) => /* ... */),
})
.open();
```

## Typescript

MapDownlink state may also be given a type annotation. All that is required is for a custom Form to be provided to the `valueForm` option. See our article on [**Forms**]({% link _typescript-client/form.md %}) for an example on how to do this.

```typescript
import { WarpClient } from "@swim/client";
import { Form } from "@swim/structure";

const elevators = client.downlinkValue<Record<string, Elevator>>({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/lobby",
  laneUri: "elevators",
  keyForm: Form.forString(),
  valueForm: new ElevatorForm(),
})
.open();

// typed Elevators object
elevators.get("guest"); // { id: 12345, currentFloor: 1, occupied: false, lastInspection: 1707216815650 }
```
