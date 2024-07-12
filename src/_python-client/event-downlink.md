---
title: Event Downlink
short-title: Event Downlink
description: "A WARP connection which provides a raw view of a WARP link. It receives all updates but is not purpose-built for a specific lane type."
group: Connections
layout: documentation
redirect_from:
  - /_python-client/event-downlink/
---

`EventDownlink` offers no specialized handling of WARP messages with respect to the type of Web Agent lane it is
connected to. It provides a raw view of a WARP link, passing all received updates to a single `on_event` callback.

Here is how to create a simple EventDownlink with a SwimClient.

```python
from swimos import SwimClient

with SwimClient() as swim_client:
    host_uri = 'warp://example.com'
    node_uri = '/house/electricityMeter'
    lane_uri = 'stats'

    event_downlink.set_host_uri(host_uri)
    event_downlink.set_node_uri(node_uri)
    event_downlink.set_lane_uri(lane_uri)

    event_downlink.open()
```

Note the term that is used to refer to the kinds of events which trigger `on_event`: "updates". Think of this as events
which involve some state change. This could mean adding or removing keys to or from a map-based lane, or updating a
ValueDownlink's synced value. WARP messages related to a downlink's connection state, such as those with the "link", "
linked", "sync", "synced", "unlink", and "unlinked" tags, are not processed by the `on_event` callback.

An application may update dependent components in response to any messages received from the Web
Agent within the `on_event` callback.

```python
from swimos import SwimClient


async def custom_on_event(event):
    print(f'Link received event: {event}')


with SwimClient() as swim_client:
    host_uri = 'warp://example.com'
    node_uri = '/house/electricityMeter'
    lane_uri = 'stats'

    event_downlink.set_host_uri(host_uri)
    event_downlink.set_node_uri(node_uri)
    event_downlink.set_lane_uri(lane_uri)

    event_downlink.on_event(custom_on_event)

    event_downlink.open()
```