---
title: Downlinks
layout: page
redirect_from:
  - /tutorials/downlinks/
---

In a [previous tutorial]({% link _reference/web-agents.md %}), we began to describe a distributed object model where **Web Agents** are the **objects** and **lanes** are **fields**. **Downlinks** are bidirectionally-streaming, persistent **subscriptions** to lanes.

Downlinks come in many flavors, but there are only two broad downlink categories. An **event downlink** can subscribe to any lane and provides:

- A single customizable **onEvent(V event)** callback function that executes upon every update to the lane
- A means to **strongly type** (i.e. **parametrize**) the downlink
- Transparent, eventually-consistent streaming of reads

The other category of downlinks is **storage-lane** specific, i.e there is a one-to-one correspondence between each downlink type and a **non-command** lane type. **Value downlinks** work with value lanes, **map downlinks** work with map lanes, **list downlinks** work with list lanes, and so on. Despite the one-to-one restriction with lane types, these are the downlinks that you'll mostly be using, as each offers:

- Various customizable **callback functions**, disambiguated by event type and containing properly-structured parameters; such callbacks can, for example, perform analytics or update UI widgets
- A means to **act** on its target lane
- A means to **strongly type** (i.e. **parametrize**) the downlink
- Transparent, eventually-consistent streaming of both reads and writes

Use event downlinks only if you wish to reuse the same reference among multiple target lane types, prevent writes from your downlink, or listen to a command lane.

There are two big things to manage when dealing with downlinks: **data** and **connections**. This guide will focus heavily on the former; we will expand on connection management in a future, more advanced article.

### Declaration

#### Java

All downlink classes can be imported from package `swim.api.downlink`.

#### Javascript

All downlink types are available after including `swim-core.js`, available from https://cdn.swimos.org/js/3.9.0/swim-core.js.

### Usage

Downlinks must be instantiated against Swim refs, i.e. specific server-side or client-side objects. Although several permutations exist, the builder pattern is the same each time:

1. Invoke `downlink()` against your ref for an event downlink, or `downlinkFoo()` for a foo downlink (e.g. `downlinkMap()` for a map downlink)
1. Build the downlink's `hostUri` using `hostUri()` (this step can only be omitted if your Swim ref is server-side, and you are targeting a lane within the same server), the downlink's `nodeUri` using `nodeUri()`, and the downlink's `laneUri` using `laneUri()`
1. Override any lifecycle callback functions, which default to no-ops
1. In strongly-typed languages (Java, Typescript), optionally parametrize the downlink
1. Optionally set the **keepSynced** (pull all existing data from a lane before processing new updates; defaults to `false`) and **keepLinked** (enable consistent **reads** from the downlink (unnecessary for write-only downlinks); defaults to `true`) flags
1. Invoke `open()` on the downlink to initiate data flow
1. When finished, invoke `close()` on the downlink to stop data flow

#### Lifecycle callbacks and updating lanes

Every event downlink has a customizable `onEvent(V event)` callback function that specifies the action to take upon every event received by the target lane.

For all other (i.e. lane-specific) downlinks, recall that every data-storing lane can be acted upon by methods specific to that lane type (e.g. `set` for value lanes; `put`, `remove`, `drop`, `take`, and `clear` for map lanes). These options also exist on correctly-configured lane-specific downlinks. Furthermore, for every such method `foo`, each downlink has a `didFoo(Object... args)` method that follows similar lifecycle semantics to `onEvent()`, but with more useful callback parameters. For example, every `MapDownlink<K, V>` has access to `didUpdate(K key, V newValue, V oldValue)`, `didRemove(K key, V oldValue)`, `didDrop(int dropCount)`, `didTake(int keepCount)`, and `didClear()` methods.

#### Parametrization

Unlike with lanes, which additionally offer parametrized methods, downlink parametrization **requires** providing ``swim.structure.Forms` through a builder pattern.

#### Java

Client-side, downlinks must be issued from a `ClientRuntime`, but the builder syntax is otherwise identical:

```java
// swim/basic/CustomClient.java
package swim.basic;

import swim.api.downlink.MapDownlink;
import swim.client.ClientRuntime;
import swim.structure.Form;

class CustomClient {

  public static void main(String[] args) throws InterruptedException {

    ClientRuntime swimClient = new ClientRuntime();
    swimClient.start();

    final String hostUri = "warp://localhost:9001";
    final String nodeUriPrefix = "/unit/";

    // map downlink example
    final MapDownlink<String, Integer> link = swimClient.downlinkMap()
        .keyForm(Form.forString()).valueForm(Form.forInteger())
        .hostUri(hostUri).nodeUri(nodeUriPrefix+"0").laneUri("shoppingCart")
        .keepLinked(false)
        .open();
    // Remember that downlinks can write, too!
    link.put("FromClientLink", 25);
  }
}
```

Server-side, downlinks will be showcased in a [later tutorial]({% link _reference/server-downlinks.md %}).

#### Javascript

The tutorial application demonstrates [using value downlinks](https://github.com/swimos/tutorial/blob/master/ui/pie.html#L58-L67) and [map downlinks](https://github.com/swimos/tutorial/blob/master/ui/chart.html#L69-L79) issued against a Swim client instance. Note the language-level loss of parametrization, but the otherwise-identical syntax to Java.

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/downlink).

