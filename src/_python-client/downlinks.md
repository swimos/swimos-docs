---
title: Downlinks
short-title: Downlinks
description: "A link which provides a virtual bidirectional stream between the client and a lane of a remote Web Agent, multiplexed by a Swim client."
group: Connections
layout: documentation
redirect_from:
  - /_python-client/downlinks/
---

A Downlink provides a virtual bidirectional stream between the client and a lane of a remote Web Agent. Swim clients
transparently multiplex all links to [**Web Agents**]({% link _java-server/web-agents.md %}) on a given host over a
single WebSocket connection.

Downlinks come in several flavors, depending on the WARP subprotocol to which they conform. A [**ValueDownlink**]({%
link _python-client/value-downlink.md %}) synchronizes a value with a remote value lane. A [**MapDownlink**]({%
link _python-client/map-downlink.md %}) implements the WARP map subprotocol to synchronize key-value state with a
remote map lane. And an [**EventDownlink**]({% link _python-client/event-downlink.md %}) observes raw WARP events,
and can be used to observe lanes of any kind.

This article will focus on the properties and methods which all types of downlinks have in common. Later articles on
specific types of downlinks will go into detail on what is unique to each of them.

## Addressing Downlinks

Before opening, a downlink must be addressed with the `host_uri`, `node_uri`, and `lane_uri` to which it should connect.

* The `host_uri` is the domain name of the host application. It must always be prepended by either `warp://`
  or `warps://`, which are equivalent to `ws://` and `wss://` respectively.
* The `node_uri` is the path to the Web Agent to which you wish to connect. If following our [**recommended design**]({%
  link _java-server/agent-design.md %}), Web Agents will represent identifiable domain elements (think, a noun) and
  include the name of the entity type in the node URI, possibly alongside an ID (e.g. `/hotel/room/:roomId`).
* The `lane_uri` is the most specific part of a downlink's address. A lane exposes a subset of a Web Agent's properties
  and methods. Lane content will vary greatly from lane to lane and will be heavily influenced by the subtype of lane to
  which it conforms.

For an overview of Web Agents, lanes, and the general structure of a Swim application, visit [**SwimOS Concepts**]({%
link _swimos-concepts/fundamentals.md %}).

The way to address a downlink is to set its `host_uri`, `node_uri`, and `lane_uri`.

```python
from swimos import SwimClient

client = SwimClient()
downlink = client.downlink_event()

downlink.set_host_uri('warp://example.com')
downlink.set_node_uri('/building')
downlink.set_lane_uri('status')
```

## Opening a Downlink

The `open` method is used to open a downlink after it has been configured. Data will not begin streaming through the
downlink until it has been opened. The `close` method closes a downlink.

```python
from swimos import SwimClient

client = SwimClient()
downlink = client.downlink_event()

downlink.set_host_uri('warp://example.com')
downlink.set_node_uri('/building')
downlink.set_lane_uri('status')

downlink.open()

...

downlink.close()
```

Closing a downlink does not necessarily close the underlying WARP link. The Swim client will keep a link open so long as
at least one downlink to a given node and lane URI remains open. This prevents application components from stepping on
each other's toes when they link to the same lanes of the same Web Agents.

## Downlink State and Lifecycle Callbacks

A number of methods are made available for retrieving key pieces of a downlink's state. Optional callbacks may also be
registered for reacting to changes in these states or other key lifecycle events. Callbacks can be set individually
after a downlink has been initialized.

### Connections

The `did_open` method registers an observer callback that gets invoked whenever a downlink is successfully opened.
Likewise, `did_close` registers observer callback which gets invoked when a downlink is closed.

Here is an example of a downlink being opened with some registered callbacks for listening to its status.

```python
import time
from swimos import SwimClient


async def print_did_open():
    print('Did Open')


async def print_did_close():
    print('Did Close')


with SwimClient() as swim_client:
    downlink = swim_client.downlink_event()
    downlink.set_host_uri('warp://example.com')
    downlink.set_node_uri('/building')
    downlink.set_lane_uri('status')

    downlink.did_open(print_did_open)
    downlink.did_close(print_did_close)

    downlink.open()

    downlink.open()
    time.sleep(2)
    downlink.close()

    # Output:
    # Did Open
    # Did Close
```

If there is connection error between a client downlink and the server, the client will receive an `@unlinked` messages
for the corresponding downlink.
In the case that a downlink attempts to connect with a node (web agent) or lane which does not exist, the client will,
once again, receive an "@unlinked" WARP message, but it will also include an error tag.

```python
# WARP message received after network connection issue
"@unlinked(node:\"/hotel/room/123\",lane:status)"
# WARP message received after web agent not found
"@unlinked(node:\"/hotel/room/invalid_room_number\",lane:status)@nodeNotFound"
# WARP message received after lane not found
"@unlinked(node:\"/hotel/room/123\",lane:invalid_lane_name)@laneNotFound"
```

### Linking and Syncing callbacks

The `will_link` and `will_sync` callbacks are invoked after a corresponding `@link` or `@sync` message is received, but
before it
has been processed by the downlink.
In contrast, `did_link` and `did_sync` callbacks are invoked after the corresponding `@link` or `@sync` messages has
taken
effect.

The following example shows the order in which the different downlink callbacks are executed.

```python
import time
from swimos import SwimClient


async def print_will_link():
    print("Will Link")


async def print_did_link():
    print("Did Link")


async def print_will_sync():
    print("Will Sync")


async def print_did_sync():
    print("Did Sync")


async def print_did_close():
    print("Did Close")


with SwimClient() as swim_client:
    downlink = swim_client.downlink_value()
    downlink.set_host_uri('warp://example.com')
    downlink.set_node_uri('/building')
    downlink.set_lane_uri('status')

    downlink.will_link(print_will_link)
    downlink.did_link(print_did_link)
    downlink.will_sync(print_will_sync)
    downlink.did_sync(print_did_sync)
    downlink.did_close(print_did_close)

    downlink.open()
    time.sleep(2)
    downlink.close()

    # Output:
    # Will Link
    # Did Link
    # Will Sync 
    # Did Sync
    # Did Close 
```