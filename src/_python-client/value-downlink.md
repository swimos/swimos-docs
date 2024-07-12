---
title: Value Downlink
short-title: Value Downlink
description: "A WARP connection which synchronizes a shared real-time, scalar value with a remote value lane"
group: Connections
layout: documentation
redirect_from:
  - /_python-client/value-downlink/
---

A ValueDownlink synchronizes a shared real-time value with a remote value lane. In addition to the standard Downlink
callbacks, ValueDownlink supports registering a `did_set` callback to observe changes to downlinked state — whether
remote or local.

Create a ValueDownlink with a SwimClient's `downlink_value` method.

Use the `get` method to get the current state value, and the `set` method to set the current state value. For the most
part, client code can treat a ValueDownlink like an ordinary mutable variable; the Swim client will ensure that the
downlink is continuously made consistent with the remote lane.

```python
from swimos import SwimClient

with SwimClient() as swim_client:
    host_uri = 'warp://example.com'
    node_uri = '/hotel/room/123'
    lane_uri = 'light'

    value_downlink = swim_client.downlink_value()
    value_downlink.set_host_uri(host_uri)
    value_downlink.set_node_uri(node_uri)
    value_downlink.set_lane_uri(lane_uri)

    value_downlink.open()

    value_downlink.get()  # get the current local state of the downlink
    value_downlink.set(True)  # update the local and remote state of the downlink
```

Using `did_set` callbacks, applications can update dependent components to keep them consistent with
the shared state of the remote value lane in network real-time. The `did_set` callback can be defined as shown
below.

```python
from swimos import SwimClient


async def custom_did_set(new_value, old_value):
    print(f'Link watched info change TO {new_value} from {old_value}')


with SwimClient() as swim_client:
    host_uri = 'warp://example.com'
    node_uri = '/hotel/room/123'
    lane_uri = 'light'

    value_downlink = swim_client.downlink_value()
    value_downlink.set_host_uri(host_uri)
    value_downlink.set_node_uri(node_uri)
    value_downlink.set_lane_uri(lane_uri)

    value_downlink.did_set(custom_did_set)

    value_downlink.open()
```