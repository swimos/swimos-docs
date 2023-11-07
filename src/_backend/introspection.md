---
title: Introspect a Swim server
short-title: Introspect a Swim server
description: "How to introspect a Swim server and obtain runtime stats"
group: Guides
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/introspection
redirect_from:
  - /guides/introspection.html
---

Introspection allows you to obtain runtime information about a Swim server, including:
- Compute and memory metrics
- List running nodes
- List lanes of a node
- Logs

_We will be demonstrating introspection on the corresponding cookbook server and so use host `warp://localhost:9001`.
Feel free to follow along or change commands to match your server.
This guide uses the [`swim-cli`]({% link _backend/cli.md %}) extensively._ 

## Enabling Introspection

Include the following line in a Swim application's `server.recon` config file to specify that introspection should be enabled.

```
@kernel(class: "swim.meta.MetaKernel")
```

This will start a `MetaKernel` responsible for opening additional nodes and endpoints providing meta information. 

## Meta Nodes

Two types of meta node are now available for downlinking:

- The `swim:meta:mesh` node, which provides server wide meta details.
  
- The `swim:meta:node/{node_uri}` nodes, which provide node specific meta details.

These meta nodes behave similarly to normal nodes and so can be downlinked from within a swim application or using the `swim-cli`.
Various lanes are opened within these nodes which provide access to different data, these lanes will be detailed in the following sections.

The `{node_uri}` in `swim:meta:node/{node_uri}` must be substituted with the node URI of the node to be introspected.
For example, the node `/building/1` (in the cookbook) will have a meta node of `swim:meta:node//building/1`.
When using the command line it is necessary to encode the `/` characters in the node URI to `%2f` and so with the swim-cli `swim:meta:node/%2fbuilding%2f1` is used.

## Pulse

Available on both `swim:meta:mesh` and `swim:meta:node/`, the simplest thing we can do is downlink the `pulse` lane.
This will provide various metrics about the introspection target, including agent count, compute time and link counts.

```
swim-cli sync -h warp://localhost:9001 -n swim:meta:mesh -l pulse
```

Output:

```
{partCount:2,hostCount:2,nodeCount:24,agents:{agentCount:49,execRate:31929,execTime:905996100,timerEventRate:21,timerEventCount:1622},downlinks:{linkCount:20},uplinks:{linkCount:20,eventRate:20,eventCount:1642},system:{cpuTotal:1600,memUsage:11875803136,memTotal:34267426816,diskUsage:1799050371072,diskTotal:2500238229504,startTime:1693840004973}}
```

## List Nodes

The `nodes` lane on `swim:meta:mesh` provides access to a list of all nodes and the agents running within them.

Trying this on the introspection cookbook server:

```
swim-cli sync -h warp://localhost:9001 -n swim:meta:mesh -l nodes
```

Output:

```
...
@update(key:"/building/1/room/4"){nodeUri:"/building/1/room/4",created:1693908245376,agents:{"swim.introspection.RoomAgent","swim.introspection.RoomSimulatorAgent"}}
@update(key:"/building/1/room/5"){nodeUri:"/building/1/room/5",created:1693908245377,agents:{"swim.introspection.RoomAgent","swim.introspection.RoomSimulatorAgent"}}
@update(key:"/building/1"){nodeUri:"/building/1",created:1693908245375,agents:{"swim.introspection.BuildingAgent"}}
...
```

We see that the server has several `building` and `room` nodes, we have a URI, start time and agent list for each.
Notice the room nodes have two agents, a `RoomAgent` and `RoomSimulatorAgent` - see more on multiple agents in the [`traits`]({% link _backend/traits.md %}) reference.

This lane can also list all child node URIs of a parent, giving the ability to list all nodes of a given type.
We can do this by adding a parameter onto the `nodes` lane with `#` followed by the pattern of a node URI, ending with `/`.
For clarity, here are some example parameters that can be used and their function:

- `nodes#/`: List the first part of all node URIs (this will just be `/building` in the cookbook as all nodes are children).
  
- `nodes#/building/`: List all building nodes.
  
- `nodes#/building/2/room/`: List all room nodes in building 2.

Using the second option as an example: 

```
swim-cli sync -h warp://localhost:9001 -n swim:meta:mesh -l nodes#/building/
```

Output:

```
@update(key:"/building/1"){nodeUri:"/building/1",created:1693908245375,childCount:1,agents:{"swim.introspection.BuildingAgent"}}
@update(key:"/building/2"){nodeUri:"/building/2",created:1693908245380,childCount:1,agents:{"swim.introspection.BuildingAgent"}}
```

We have obtained a list of all building nodes.
Notice that both nodes have `childCount:1`, this is because there are nodes with URIs that are children of theirs (i.e. the room agents).

## List Lanes

The `lanes` lane on `swim:meta:node/` provides access to a list of all lanes on a node and their types.

Trying this on the introspection cookbook server, on a room agent:

```
swim-cli sync -h warp://localhost:9001 -n swim:meta:node/%2fbuilding%2f1%2froom%2f1 -l lanes
```

Output:

```
@update(key:info){laneUri:info,laneType:value}
@update(key:lights){laneUri:lights,laneType:value}
@update(key:occupied){laneUri:occupied,laneType:value}
@update(key:temperature){laneUri:temperature,laneType:value}
```

## Logs

The Swim framework provides agents with the ability to log messages at different levels (trace, debug, info, warn, error, fail).
These logs can be accessed on both `swim:meta:mesh`, for server wide logs, and `swim:meta:node/`, for node specific logs.
Simply prepend the log level desired to `Log` to obtain the lane URI to be downlinked.

For example, to tail all `warn` level logs on the introspection cookbook server:

```
swim-cli sync -h warp://localhost:9001 -n swim:meta:mesh -l warnLog
```

Output:

```
@warn(time:1693926115314)"/building/1/room/3 lights on but vacant"
...
```

## UI

Swim provides a general purpose Introspection GUI, this is built upon the concepts above.
It can be used to visualise a Swim server including nodes, lanes and pulse stats.

Check out [`https://continuum.swim.inc/introspect/?host=warp://localhost:9001`](https://continuum.swim.inc/introspect/?host=warp://localhost:9001) while running the introspection cookbook or change the host parameter to point at your Swim server.