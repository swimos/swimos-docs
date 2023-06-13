---
title: WARP
layout: page
  - /concepts/warp/
---

The internet routes packets between physical or virtual machines, identified by IP addresses. On top of the internet sites the World Wide Web you're using right now, which routes requests and responses for Web Resources, identified by URIs. The Web was built for documents. But treating everything like a document is quite limiting. A smart city isn't a document; it's a continuously evolving digital mirror of reality.

Things that continuously evolve—like smart cities, autonomous control systems, and collaborative applications—are best modeled as streams of state changes. We can't—and don't want to—give every logical thing in the world an IP address; we want to give things logical names, i.e. URIs. It would be nice if we had a way to route packets between URIs—like an application layer network.

In recent years, the WebSocket protocol has emerged, enabling us to open streaming connections to URIs. This is great. But it only solves part of the problem. Applications need to open a new WebSocket connection for every URI to which they want to connect. This limitation prevents WebSockets alone from serving as a streaming layer of the World Wide Web. But that's OK; that's not WebSocket's role.

WARP is a protocol for multiplexing bi-directional streams between large numbers of URIs over a single WebSocket connection. Multiplexed streams within a WARP connection are called **links**. Just as the World Wide Web has hypertex links between Web Pages, WARP enables actively streaming links between Web Agents.

WARP connections exchange WebSocket frames encoded as Recon structures. The use of Recon enables efficient parsing and routing, while preserving the flexibility and extensibility of protocols like HTTP. And the expressiveness of Recon avoids the explosion of specialized grammars and parsers that has caused the originally simple and elegant HTTP protocol to become bloated and complex. It's also worth noting that, although HTTP/2 introduces a limited form of multiplexing, it multiplexes RPC calls, not full-duplex streams.

Having a multiplexed streaming protocol requires a stateful application server to efficiently implement it. Stateful application servers differ from traditional, stateless app servers, in almost every detail—for the better. Swim is a self-contained, stateful application server that implements the WARP multiplexed streaming protocol.
