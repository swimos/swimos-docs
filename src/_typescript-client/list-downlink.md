<!-- ---
title: List Downlink
short-title: List Downlink
description: "A WARP connection which synchronizes a shares real-time list with a remote list lane. It behaves similar to a JavaScript array."
group: Connections
layout: documentation
redirect_from:
--- -->

{% include callout-warning.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior.' %}

A ListDownlink synchronizes a shared real-time list with a remote list lane. In addition to the standard Downlink callbacks, ListDownlink supports registering `willUpdate`, `didUpdate`, `willMove`, `didMove`, `willRemove`, and `didRemove` callbacks to observe all changes to downlinked list state — whether remote or local.

Create a ListDownlink with a WARP client's `downlinkList` method.

ListDownlink behaves similarly to a JavaScript array. Use the ListDownlink.`get` method to get the item at a given index. Use the ListDownlink.`set` method to update the item at some index. And use the ListDownlink.`splice` method to insert and remove items from the list. You can also `push`, `pop`, `shift`, and `unshift` items, and move an item from one index to another.

```typescript
import { WarpClient } from "@swim/client";

const listDownlink = client.downlinkList({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/room/123",
  laneUri: "reservations"
})
.open();

listDownlink.get(0); // get the first item in the list
listDownlink.set(0, { arrival: "2024-04-01T15:00:00Z", nights: 1, guestName: "Jeff Lebowski" }); // locally and remotely update an item
listDownlink.push({ arrival: "2024-04-02T15:00:00Z", nights: 2, guestName: "Walter Sobchak" }); // locally and remotely append an item
```

For the most part, client code can treat a ListDownlink like an ordinary JavaScript list; the WARP client will ensure that the downlink is continuously made consistent with the remote lane. Using `didUpdate`, `didMove`, and `didRemove` callbacks, applications can update UI list views and other dependent components to keep them consistent with the shared state of the remote list lane in network real-time.

```typescript
const list = client.downlinkList({
  didUpdate: (index, value) => {
    if (hasChildElement(index)) {
      // update existing UI view at index
    } else {
      // insert new UI view at index
    }
  },
  didMove: (fromIndex, toIndex, value) => {
    // move existing UI view from old index to new index
  },
  didRemove: (index) => {
    // remove UI view at index
  }
})
```

## State Type Disambiguation

A ListDownlink views its items as [**Values**]({% link _typescript-client/structures.md %}) by default. Use the valueForm method to create a typed projection of a ListDownlink that automatically transforms its items using a [**Form**]({% link _typescript-client/form.md %}). The `Form` class comes with a number of ready-to-use instances for basic use cases. For example, you can use `Form.forBoolean()` to coerce a ListDownlink's state to a boolean; and you can also use `Form.forAny()` to create a ListDownlink that coerces its state to a plain old JavaScript value. Forms for coercing state to a string, number, `Value`, and `Item` are also provided.

```typescript
import { Form } from "@swim/structure";

const list = client.downlinkList({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/room/123",
  laneUri: "reservation",
  valueForm: Form.forAny(),
  didUpdate: (index, value) => {/* ... */},
  didMove: (fromIndex, toIndex, value) => {/* ... */},
  didRemove: (index) => {/* ... */},
})
.open();
```

## Typescript

ListDownlink state may also be given a type annotation. All that is required is for a custom Form to be provided to the `valueForm` option. See our article on [**Forms**]({% link _typescript-client/form.md %}) for an example on how to do this.

```typescript
const list = client.downlinkList<Reservation[]>({
  hostUri: "warp://example.com",
  nodeUri: "/hotel/room/123",
  laneUri: "reservation",
  valueForm: new ReservationForm(),
  didUpdate: (index, value) => {/* ... */},
  didMove: (fromIndex, toIndex, value) => {/* ... */},
  didRemove: (index) => {/* ... */},
})
.open();

// typed Reservation object
list.get(0); // { arrival: 1707748815650, nights: 2, guestName: "Walter Sobchak" }
```
