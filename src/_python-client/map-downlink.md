---
title: Map Downlink
short-title: Map Downlink
description: "A WARP connection which synchronizes a shares real-time, key-value map with a remote map lane"
group: Connections
layout: documentation
redirect_from:
  - /_python-client/map-downlink/
---

A MapDownlink synchronizes a shared real-time key-value map with any Web Agent lane backed by a map. In addition
to [**map lanes**]({% link _java-server/map-lanes.md %}), this includes
[**join value lanes**]({% link _java-server/join-value-lanes.md %}) and
[**join map lanes**]({% link _java-server/join-map-lanes.md %}), which are maps
where each entry is its own value lane or maps lane, respectively. In addition to the standard Downlink callbacks,
MapDownlink supports registering `did_update`, and `did_remove` callbacks for observing changes to downlinked map
state —
whether remote or local. `did_update` is invoked when an existing map key is updated or a new key is added. `did_remove`
gets called when a map key is removed.

Create a MapDownlink with a SwimClient's `downlink_map` method.

Use the `get` method to get the value associated with a given key and `get_all` to get all values. Use the `put` method
to update the value associated with a key and use the `remove` method to remove a key and its associated value.

```python
from swimos import SwimClient

with SwimClient() as swim_client:
    host_uri = 'warp://example.com'
    node_uri = '/hotel/lobby'
    lane_uri = 'elevators'

    map_downlink = swim_client.downlink_map()
    map_downlink.set_host_uri(host_uri)
    map_downlink.set_node_uri(node_uri)
    map_downlink.set_lane_uri(lane_uri)
    map_downlink.open()

    map_downlink.get('guest')  # get the locally cached value associated with the key
    map_downlink.set('service', 'elevator')  # locally and remotely insert a new entry
    map_downlink.delete('parking')  # locally and remotely remove an existing entry
```

The SwimClient will ensure that the downlink is continuously made consistent with the remote lane. Using `did_update`
and `did_remove` callbacks, applications can update dependent components to keep them consistent with the shared
state of the remote map lane in network real-time. Callbacks can be defined as shown below.

```python
from swimos import SwimClient


async def custom_did_update(key, new_value, old_value):
    print(f'Link watched {key} changed to {new_value} from {old_value}')


async def custom_did_remove(key, value):
    print(f'Link removed {key} with value {value}')


with SwimClient() as swim_client:
    host_uri = 'warp://example.com'
    node_uri = '/hotel/lobby'
    lane_uri = 'elevators'

    map_downlink = swim_client.downlink_map()
    map_downlink.set_host_uri(host_uri)
    map_downlink.set_node_uri(node_uri)
    map_downlink.set_lane_uri(lane_uri)

    map_downlink.did_update(custom_did_update)
    map_downlink.did_remove(custom_did_remove)

    map_downlink.open()
```