---
title: Getting Started
short-title: Getting Started
description: "Steps for connecting to a SwimOS application and building applications powered by streaming data"
group: Introduction
layout: documentation
redirect_from:
  - /_python-client/getting-started/
---

Swim is a full stack **streaming application platform** for building stateful services, streaming APIs, and real-time
UIs. Streaming applications push differential state changes through the full application stack, eliminating the need for
polling and streaming only what each client chooses to observe. Real-time UIs render live views of distributed
application state.

Creating a real-time applications starts with [**Swim Client**]({% link _python-client/swim-client.md %}), a streaming
API client for consuming multiplexed streaming APIs. It opens links to lanes of stateful Web Agents using the [**WARP
**]({% link _python-client/what-is-warp.md %}) protocol, enabling massively real-time applications that continuously
synchronize all shared states with half ping latency. The client requires no configuration and makes opening links to
Web Agents a cinch.

## Installation

To begin using the Swim client, install the `swimos` package.

```bash
pip install swimos
```

## Quick Start

Connecting to a lane of a remote Web Agent with the SwimClient can be done in just a few lines.

Import and initialize an instance of `SwimClient`.

```python
from swimos import SwimClient

client = SwimClient()
```

Next, create a link for connecting to your remote Web Agent.

```python
downlink = client.downlink_event()
```

Then provide your link with the `nodeUri` and `laneUri of the Web Agent to which you wish to connect.

```python
downlink.set_host_uri('warp://example.com')
downlink.set_node_uri('/building')
downlink.set_lane_uri('status')
```

And define a callback for handling messages received by the link.

```python
async def custom_on_event(event):
    print(f'Link received event: {event}')


downlink.on_event(custom_on_event)
```

Finally, open your downlink.

```python
downlink.open()
```

Once the downlink is open, events should begin streaming into the application. Whether they arrive as a trickle or a
flood, applications may use these messages to update their internal state, keeping them consistent with the shared state
of the remote Web Agent in network real-time.
