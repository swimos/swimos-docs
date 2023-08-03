---
title: How to Stream Data Using the swim-cli
layout: page
description: "How to stream or fetch data from a Swim application using the swim-cli"
---

The **swim-cli** is the simplest way to fetch or stream data from a Swim application.
All types of lanes can be streamed to the command line and so the **swim-cli** can be useful for validation.

Feel free to use our endpoint for checking:
- host: `warps://fiveg.swim.services`
- node: `/market/London`
- lane: `info`

### Installation
You must have **npm** to install the Swim command line interface.

To install the [swim-cli](https://www.npmjs.com/package/@swim/cli) globally:
```bash
npm install -g @swim/cli
```


### Fetch from a Lane
The **get** command will fetch the current value of the lane. 
The command has the following format:
```bash
swim-cli get -h {hostUri} -n {nodeUri} -l {laneUri}
```
Notice the `-h`, `-n`, `-l` options are for the URI of host, node and lane respectively.
Substituting in the details of the test endpoint above:
```bash
swim-cli get -h warps://fiveg.swim.services -n /market/London -l info
```
This will return the current value of the `info` lane of the `/market/London` node.
(Try it yourself)


### Stream from a Lane
The **sync** command will fetch the current value of the lane and continue to stream any lane updates.
The command has the following format:
```bash
swim-cli sync -h {hostUri} -n {nodeUri} -l {laneUri}
```
Notice the `-h`, `-n`, `-l` options are for the URI of host, node and lane respectively.
Substituting in the details of the test endpoint above:
```bash
swim-cli sync -h warps://fiveg.swim.services -n /market/London -l info
```
This will return the current value of the `info` lane of the `/market/London` node, and continue streaming any updates to the lnae.
(Try it yourself)


### Introspection
If a Swim application uses the `swim.meta.MetaKernel` then introspection endpoints are exposed.
The `swim:meta:mesh` node provides lanes that can be queried for various runtime information:
- `nodes`: list of all running nodes
- `pulse`: application level KPIs
```bash
swim-cli get -h {hostUri} -n swim:meta:mesh -l nodes
swim-cli get -h {hostUri} -n swim:meta:mesh -l pulse
```
