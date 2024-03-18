---
title: Stream Data Using the swim-cli
short-title: Swim CLI
description: "How to stream or fetch data from a Swim application using the swim-cli"
group: Utilities
layout: documentation
redirect_from:
  - /java/guides/cli.html
---

The [**swim-cli**](https://www.npmjs.com/package/@swim/cli) is the simplest way to fetch or stream data from a Swim application.
All types of lanes can be streamed to the command line and so the **swim-cli** can be useful for validation.

Feel free to use our endpoint for checking:

- host: `warps://cellular.swim.services`
- node: `/country/US/state/CA`
- lane (Value): `status`
- lane (Map): `alerts`

_Note: The host uri uses the `warps` protocol, this is because the server uses secure websockets (TLS). For any servers using non-secure websockets (TLS not enabled) then `warp` must be used._

### Installation

You must have `npm` to install the Swim command line interface. To install the [swim-cli](https://www.npmjs.com/package/@swim/cli) globally:

```bash
npm install -g @swim/cli
```

### Stream from a Lane

The **link** and **sync** commands can both be used to stream data from Swim lanes.
Both commands will stream any updates to a lane however **sync** will first fetch the current value of the lane.
The commands have the following format:

```bash
swim-cli link -h {hostUri} -n {nodeUri} -l {laneUri}
swim-cli sync -h {hostUri} -n {nodeUri} -l {laneUri}
```

Notice the `-h`, `-n`, `-l` options are for the URI of `host`, `node`, and `lane` respectively.
Substituting in the details of the test endpoint above:

```bash
swim-cli link -h warps://cellular.swim.services -n /country/US/state/CA -l status
swim-cli sync -h warps://cellular.swim.services -n /country/US/state/CA -l status
```

These commands will both stream any updates to the `status` lane of the `/country/US/state/CA` node, however **sync** first gets the current value of the lane.
(Try them yourself)

_Note: The difference between sync and link becomes more obvious when streaming a map lane - see next section._

The **link** and **sync** commands will continue to stream data until the command is terminated with `CTRL + C`.

#### Value vs Map

When streaming from a Swim **value** lane (as the above examples), you will notice that just the value of the lane is output.
Example output from **value** lane:

```
{siteCount:1193,warnCount:115,alertCount:10}
```

When streaming a **map** lane, we only send the new value of the entry that has been updated.
This means the output of the stream must now include the key of the entry being updated (or removed).
We can stream a **map** lane (`alerts`) as an example:

```bash
swim-cli link -h warps://cellular.swim.services -n /country/US/state/CA -l alerts
```

Output:

```
@update(key:"/site/15550"){coordinates:{-122.308114,40.442505},severity:1.2732812701071294}
@remove(key:"/site/20641")
@update(key:"/site/779"){coordinates:{-120.045813,38.802205},severity:1.0512594070918895}
```

You will notice the presence of `@update` and `@remove` both referencing the key of the value being updated/removed.
(Try it yourself)

### Fetch from a Lane

The **get** command will fetch the current value of the lane. The command has the following format:

```bash
swim-cli get -h {hostUri} -n {nodeUri} -l {laneUri}
```

Notice the `-h`, `-n`, `-l` options are for the URI of `host`, `node`, and `lane` respectively. Substituting in the details of the test endpoint above:

```bash
swim-cli get -h warps://cellular.swim.services -n /country/US/state/CA -l status
```

This will return the current value of the `status` lane of the `/country/US/state/CA` node.
(Try it yourself)

The **get** command terminates after fetching the current value.

### Formatting Output (JSON)

All of the above commands by default return output in a **recon** format.
The `-f` option can be used to specify you would like to receive the output in a **json**.

```bash
swim-cli link -h warps://cellular.swim.services -n /country/US/state/CA -l status -f json
```

(Try it yourself)
