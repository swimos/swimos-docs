# Server Recon Explained

`server-recon` is a configuration file format used by the SwimOS platform.
As the name suggests, it uses <a href="http://docs.swim.ai/js/latest/modules/_swim_recon.html" target="_target">Recon notation</a>, which looks likes an extension of JSON.

The are three primary parts of SwimOS server configration:
- web attributes
- fabric attributes
- kernel directives

## Web Attributes

The `@web` annotation is used to specify Web Attributes. 
There is a top-level field called `port` that specific the TCP/IP port being used.
There is a field called `space` the corresponds to an application and maps to `swim.api.space.Space`.
The value of this field will be the same name used when defining the fabric attribute.
There is a field called `documentRoot` that optionally specifies the top-level UI directory when applicable.
There is an attribute called `@websocket` that allows `serverCompressionLevel` and `clientCompressionLevel` to be specfied.
Server compression corresponds to the Web Agent side, while client corresponds to the use of client libraries, such as through ` swim.client.ClientRuntime`.

Here is an examole:

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

## Fabric Attrributes

A name should be specified when defining a fabric attribute, such as "yourspace":

```
yourspace: @fabric {
}
```

This corresponds to the `space` field in the Web attribute.

Two types attributes are defined within `@fabric`:

- `@plane`
- `@node`

### Plane Attributes

One plane attribute is used within `@fabric` that names the application entry point:

```
yourspace: @fabric {
  @plane(class: "swim.yourspace.YourSpacePlane")
}
```

The classname can be named as any valid Java class name. When the server is run, the plane's main() method will be invoked to instantiate the server application, including initializing any web agents.

### Node Attributes

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

## Kernel Directives

### `MetaKernel`

The `MetaKernel` directive enables introspection to open additional nodes and end-points by providing meta information. It is enabled by declaring it in a recon configuration file:

```
@kernel(class: "swim.meta.MetaKernel")
```

Please see the <a href="https://www.swimos.org/guides/introspection.html" target="_blank">Introspection guide</a> for more information.

### `UiRouter`

The `UiRouter` directive enables server a web page from a static directory that is named "ui" by default and placed under the project root.

```
@kernel(class: "swim.service.web.UiRouter")
```
