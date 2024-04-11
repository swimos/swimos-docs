---
title: Event Downlink
short-title: Event Downlink
description: "A WARP connection which provides a raw view of a WARP link. It receives all updates but is not purpose-built for a specific lane type."
group: Connections
layout: documentation
redirect_from:
  - /frontend/eventdownlink/
---

{% include alert.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior.' %}

`EventDownlink` is not so much a subtype of `Downlink` as it is the base type of all downlinks. While not literally a superclass of `ValueDownlink`, and `MapDownlink`, `EventDownlink` inherits from the same prototype as the others but contains no additional frills. For example, `MapDownlink` supports registering different callbacks for observing when a key-value pair has been added versus when one has been removed; and `ValueDownlink` has the `didSet` callback for when its synced value has been updated. `EventDownlink`, on the other hand, offers no specialized handling of WARP messages with respect to the type of Web Agent lane it is connected to. It provides a raw view of a WARP link, passing all received updates to a single `onEvent` callback. 

Here is how to create a simple EventDownlink with a WARP client's `downlink` method.

```typescript
import { WarpClient } from "@swim/client";

const client = new WarpClient();
const downlink = client.downlink({
  hostUri: "warp://example.com",
  nodeUri: "/house/electricityMeter",
  laneUri: "stats"
})
.open();
```

Note the term that is used to refer to the kinds of events which trigger `onEvent`: "updates". Think of this as events which involve some state change. This could mean adding or removing keys to or from a map-based lane, or updating a ValueDownlink's synced value. WARP messages related to a downlink's connection state, such as those with the "link", "linked", "sync", "synced", "unlink", and "unlinked" tags, are not processed by the `onEvent` callback. `onEvent` is passed a single parameter of type [**Value**]({% link _typescript-client/structures.md %}).

An application may update UI views and other dependent components in response to any messages received from the Web Agent within the `onEvent` callback. Extending the EventDownlink created above, here is an example where we update some DOM element to display the amount of electricity a home has consumed this month. In this example, the remote web agent lane is a value lane.

```typescript
downlink.onEvent = (value) => {
  /* Raw WARP message
     @event(node:"/house/electricityMeter",lane:stats){timestamp:1710272571408,currentReading:8432.7,prevMonthReading:7875.9,model:"Single Phase 4P Din Rail Energy Meter"} */

  // update UI view with latest value
  const consumption = value.get("currentReading").numberValue() - value.get("prevMonthReading").numberValue();
  document.getElementById("meterDisplay").innerText = `This home has consumed ${consumption} kWh this month.`;
};
```

Here is another example of an EventDownlink reacting to some updates. In this case, we are using them to keep track of a hotel's reservations, and the lane to which we've connected is a map lane. We can tell it is a map-based lane because the incoming messages each have an additional "update" or "remove" tag. The tag can be used to help us determine how the UI should be modified.

```typescript
const downlink = client.downlink({
  hostUri: "warp://example.com",
  nodeUri: "/hotel",
  laneUri: "reservations",
  onEvent: (value) => {
    /* Example raw WARP messages
       (update reservation)
       Record.of(Attr.of("update", Record.of(Slot.of("key", "12345"))), Slot.of("arrival", "2024-04-01T15:00:00Z"), Slot.of("nights", 1), Slot.of("guestName", "Jeff Lebowski"))
       (remove reservation)
       Record.of(Attr.of("remove", Record.of(Slot.of("key", "67890")))) */

    if (value.tag === "update") {
      const id = value.get("update").get("key").stringValue();
      const arrival = value.get("arrival").stringValue();
      const nights = value.get("nights").numberValue();

      if (existingReservations.find((r) => r.id === id)) {
        updateExistingReservation({ id, arrival, nights });
      } else {
        addNewReservation({ id, arrival, nights });
      }
    } else if (value.tag === "remove") {
      const id = value.get("remove").get("key").stringValue();

      handleCancellation({ id });
    } else {
      // tag type not recognized
      return;
    }
  }
})
.open();
```

## Typescript

The format of an EventDownlink's state is unconstrained, therefore, EventDownlink may not be passed any [**Forms**]({% link _typescript-client/form.md %}) and type annotation via that route is not supported. Any necessary typechecking must be done ad hoc within the `onEvent` callback.
