---
title: Recon
short-title: Recon
description: "Learn about the structural data model called Recon, which is used by Swim to exchange streaming messages."
group: Reference
layout: documentation
redirect_from:
  - /concepts/recon/
  - /reference/recon.html
---

Web Agents and their lanes define the entities and associated operations of a streaming API. But this definition is incomplete without also defining the data structures supported by each operation. Swim uses a simple, structural data model, called **Recon**, to exchange streaming messages.

Recon was designed to meet a number of key requirements:

- **uniform tree structure** to simplify procedural processing of structured data
- **expressive syntax** to avoid the proliferation of textual microformats
- **polymorphic** to uniformly disambiguate serialized polymorphic objects
- **distributive parsing** to cleanly and efficiently support incremental parsing
- **simple grammar** to facilitate many compatible implementations
- **universal data type** compatible with JSON, XML, and other popular data languages

Jump ahead to [WARP]({% link _backend/warp.md %}) to see how Recon is used as the wire format for a multiplexed streaming network protocol. Dive into the [tutorials]({% link _tutorials/index.md %}) to see how Recon is used in practice to serialize application objects. Or read on to learn more about the unique properties of Recon.
bSocket Deflate compression levels for the server (`serverCompressionLevel`) and client (`clientCompressionLevel`).

### Server Configuration

#### Server Recon Explained

<a href="http://docs.swim.ai/js/latest/modules/_swim_recon.html" target="_target">Recon</a> is object notation used SwimOS platform for configuration files and for communication between Web Agents.
Swim servers are configured in a `server.recon` file that resides in the application's `src/main/resources` directory.
The are three primary parts of SwimOS server configration:
- Web attributes
- Fabric attributes
- Kernel directives

#### Web Attributes

The `@web` annotation is used to specify Web Attributes. 
There is a top-level field called `port` that specific the TCP/IP port being used.
There is a field called `space` the corresponds to an application and maps to `swim.api.space.Space`.
The value of this field will be the same name used when defining the fabric attribute.
There is a field called `documentRoot` that optionally specifies the top-level UI directory for bundled UIs, when applicable.
There is an attribute called `@websocket` that configures WebSocket Deflate compression levels for the server (`serverCompressionLevel`) and client (`clientCompressionLevel`).

Here is an example:

```
@web(port: 9001) {
  space: "yourspace"
  documentRoot: "../ui/"
  @websocket {
    serverCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
    clientCompressionLevel: 0# -1 = default; 0 = off; 1-9 = deflate level
  }
}
```

#### Fabric Attributes

A name should be specified when defining a fabric attribute, such as "yourspace":

```
yourspace: @fabric {
}
```

This corresponds to the `space` field in the Web attribute.

Two types attributes are defined within `@fabric`:

- `@plane`
- `@node`

**Plane Attributes**

One plane attribute is used within `@fabric` that names the application entry point:

```
yourspace: @fabric {
  @plane(class: "swim.yourspace.YourSpacePlane")
}
```

The classname can be named as any valid Java class name. When the server is run, the plane's main() method will be invoked to instantiate the server application, including initializing any web agents.

**Node Attributes**

One `@node` attribute is used for each WebAgent. The `@agent` attribute is used to specify the Web Agent class and accepts a `class` field. There are two variants for specifying the node's web address that maps to a given Web Agent. The first is accomplished using the `pattern` field:

```
  @node {
    pattern: "/city/:id"
    @agent(class: "swim.yourspace.agent.CityAgent")
  }
```

Here, `id` is a route variable used to uniquely identify a given `CityAgent`.

The second approach consists of specify the underlying web address for a specific agent. When using this, it is customary to specify a `seed` field for the corresponding `@agent` attribute that populates a `seed` field with configuration info, such as the name of a file. `swim.api.agent.AbstractAgent.getProp("seed")` can then be invoked on the Web Agent to retrieve the configuration information.

In same cases, it may be desirable to specify multiple `@agent` attributes for the same configuration. This allows a component approach that separates concerns, such as having both a core agent and a logging agent. What happens is that each Web Agent implementation is matched against `@SwimLane` defined on each Web Agent, and each corresponding lane match is invoked. As a result, multiple Web Agents may run concurrently as a single Web Agent entity.

#### Kernel Directives

**`MetaKernel`**

The `MetaKernel` directive enables introspection to open additional nodes and end-points by providing meta information. It is enabled by declaring it in a recon configuration file:

```
@kernel(class: "swim.meta.MetaKernel")
```

Please see the <a href="https://www.swimos.org/guides/introspection.html" target="_blank">Introspection guide</a> for more information.

**`UiRouter`**

The `UiRouter` directive enables server a web page from a static directory that is named "ui" by default and placed under the project root.

```
@kernel(class: "swim.service.web.UiRouter")
```
