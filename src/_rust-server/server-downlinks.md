---
title: Server Downlinks
short-title: Server Downlinks
description: "Share data across Web Agents and clients through persistent, bidirectionally-streaming lane references."
group: Reference
layout: documentation
redirect_from:
  - /tutorials/downlinks/
  - /reference/downlinks.html
  - /backend/downlinks/
---

In the [Web Agents guide]({% link _rust-server/web-agents.md %}), we describe a distributed object model where **Web Agents** are the **objects** and **lanes** are **fields**. **Downlinks** are bidirectionally-streaming, persistent **subscriptions** to lanes. Subscriptions enable downlinks to read, process events from the lane and run event handlers.

There are three types of downlinks:

- [Event Downlinks]({% link _rust-server/event-downlinks.md %}) provide a read-only view of a lane which holds a scalar type or is stateless; such as a [Value Lane]({% link _rust-server/value-lanes.md %}) or a [Command Lane]({% link _rust-server/command-lanes.md %}).
- [Value Downlinks]({% link _rust-server/value-downlinks.md %}) synchronises a shared real-time value with a [Value Lane]({% link _rust-server/value-lanes.md %}) and allows write access to the lane's state.
- [Map Downlinks]({% link _rust-server/map-downlinks.md %}) synchronises a shared real-time key-value map with a [Map Lane]({% link _rust-server/value-lanes.md %}) and allows write access to the lane's state.

All downlinks provide:

- A means to strongly type (i.e. parametrize) the downlink.
- Customisable callback functions that are executed when the downlink receives an event.
- Transparent, eventually-consistent streaming of reads.
