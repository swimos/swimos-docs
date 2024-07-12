---
title: SwimClient
short-title: SwimClient
description: "The go-to starting point for most data streaming and connection management use cases"
group: Connections
layout: documentation
redirect_from:
  - /_python-client/swim-client/
---

**SwimClient** is the class which behaves as the primary mechanism for handling connection management and link routing.
Swim clients transparently multiplex all links to [**Web Agents**]({% link _java-server/web-agents.md %}) on a given
host over a single WebSocket connection, and automatically manage the network connection to each host, including
reconnection and resynchronization after a network failure. Key lifecycle events may also be observed through the
registration of callbacks.

Besides managing connections and opening links
(from here on called [**downlinks**]({% link _python-client/downlinks.md %})) to Web Agents, Swim clients do many other
things. They can be used to send arbitrary
WARP commands and when multiple downlinks are opened to the same lane of the same remote Web Agent, Swim clients
seamlessly handle multicast event routing.

## Instantiating a SwimClient

`SwimClient`'s can be instantiated without any parameters.

```python
from swimos import SwimClient

client = SwimClient()
```

Or they can be created with `debug` mode enabled, which provides additional debug information about potential runtime
errors.

```python
from swimos import SwimClient

client = SwimClient(debug=True)
```

Additionally, Swim clients support `with` statements, in order to automatically handle the setup and teardown phases.

```python
from swimos import SwimClient

with SwimClient(debug=True) as client:
    ...
```

## Opening Downlinks

A [**downlink**]({% link _python-client/downlinks.md %}) provides a virtual bidirectional stream over which data can
be synchronized between the client and a lane of a remote Web Agent. Swim clients transparently multiplex all links to
Web Agents on a given host over a single WebSocket connection. A downlink represents one link in this scenario.

`SwimClient` includes three methods that open different kinds of downlinks. The `downlink_event` method creates an
EventDownlink for streaming raw events from any Web Agent lane. The `downlink_value` method creates a ValueDownlink for
synchronizing state with a Web Agent [value lane]({% link _java-server/value-lanes.md %}). The `downlink_map` method
creates a MapDownlink. This type of downlink is useful for synchronizing state
with any Web Agent lane backed by a map. In addition to [**map lanes**]({% link _java-server/map-lanes.md %}),
this includes [**join value lanes**]({% link _java-server/join-value-lanes.md %})
and [**join map lanes**]({% link _java-server/join-map-lanes.md %}), which are maps of other value lanes and maps lanes,
respectively.

Here is an example of opening an EventDownlink. We will go into further detail on all of the downlink types in
subsequent sections.

```python
from swimos import SwimClient

with SwimClient() as swim_client:
    event_downlink = swim_client.downlink_event()
    event_downlink.set_host_uri('warp://example.com')
    event_downlink.set_node_uri('/building')
    event_downlink.set_lane_uri('status')
    event_downlink.open()
```

## Observing Lifecycle Events

`SwimClient` instances can also be used to observe key lifecycle events. The `did_open` method registers an observer
callback that gets invoked whenever a downlink is opened. The `did_close` method registers an
observer callback that gets invoked whenever a downlink is closed.

```python
from swimos import SwimClient


async def print_did_open():
    print('Did Open')


async def print_did_close():
    print('Did Close')


with SwimClient() as swim_client:
    event_downlink = swim_client.downlink_event()
    event_downlink.set_host_uri('warp://example.com')
    event_downlink.set_node_uri('/building')
    event_downlink.set_lane_uri('status')

    event_downlink.did_open(print_did_open)
    event_downlink.did_close(print_did_close)

    event_downlink.open()
```

## Sending Commands

The `command` method sends a WARP command message to a lane of a remote node. `command` takes up four arguments: a
host URI, a node URI, a lane URI, and a command payload.

```python
from swimos import SwimClient
from swimos.structures import Num

with SwimClient() as swim_client:
    host_uri = 'warp://localhost:9001'
    node_uri = '/unit/foo'
    lane_uri = 'publish'

    msg = Num.create_from(9035768)

    swim_client.command(host_uri, node_uri, lane_uri, msg)
```
