---
title: What is WARP?
short-title: What is WARP?
description: "An introduction to the protocol which serves as the basis for communication between Web Agents and browser clients. It enables multiplexing bidirectional streams between large numbers of URIs over a single WebSocket connection"
group: Introduction
layout: documentation
redirect_from:
---

## Introduction

The internet routes packets between physical or virtual machines, identified by IP addresses. On top of the internet sits the World Wide Web you're using right now, which routes requests and responses for Web Resources, identified by URIs. The Web was built for documents. But treating everything like a document is quite limiting. A smart city isn't a document; it's a continuously evolving digital mirror of reality.

Things that continuously evolve — like smart cities, autonomous control systems, and collaborative applications — are best modeled as streams of state changes. We can't — and don't want to — give every logical thing in the world an IP address; we want to give things logical names, i.e. URIs. It would be nice if we had a way to route packets between URIs — like an application layer network.

In recent years, the WebSocket protocol has emerged, enabling us to open streaming connections to URIs. This is great. But it only solves part of the problem. Applications need to open a new WebSocket connection for every URI to which they want to connect. This limitation prevents WebSockets alone from serving as a streaming layer of the World Wide Web. But that's OK; that's not WebSocket's role.

## WARP (Web Agent Remote Protocol)


WARP is a protocol for multiplexing bidirectional streams between large numbers of URIs over a single WebSocket connection. Multiplexed streams within a WARP connection are called **links**. Just as the World Wide Web has hypertext links between Web Pages, WARP enables actively streaming links between [**Web Agents**]({% link _getting-started/web-agents-intro.md %}) and a browser client or another Web Agent. WARP is like pub-sub without the broker, enabling every state of a Web API to be streamed, without interference from billions of queues. Whether you have a UI trying to display the most up-to-date state, or a Web Agent aggregating real-time data from multiple sources into something more meaningful, lighning fast two-way communication through multiple data streams is made possible over a single WebSocket connection with WARP.

WARP connections exchange WebSocket frames encoded as [**Recon**]({% link _getting-started/recon.md %}) structures. The use of Recon enables efficient parsing and routing, while preserving the flexibility and extensibility of protocols like HTTP. And the expressiveness of Recon avoids the explosion of specialized grammars and parsers that has caused the originally simple and elegant HTTP protocol to become bloated and complex. It's also worth noting that, although HTTP/2 introduces a limited form of multiplexing, it multiplexes RPC calls, not full-duplex streams.

Having a multiplexed streaming protocol allows a large number of links to be made without incurring significant additional overhead. It is an invaluable tool when building UIs which intend to engage in real-time data streaming.
