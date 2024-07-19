---
title: HTTP Lanes
short-title: HTTP Lanes
description: "HTTP Lanes"
cookbook: https://github.com/swimos/swim-rust/tree/main/example_apps/http_lane
group: Reference
layout: documentation
redirect_from:
  - /tutorials/http-lanes/
  - /guides/http-lanes.html
  - /backend/http-lanes/
---

This page covers the specifics of HTTP Lanes and does not cover the more general aspects of Lanes. For more general information about lanes, see the [Lane]({% link _rust-server/lanes.md %}) page.

# Overview

HTTP Lanes expose endpoints that allow web applications to communicate with Web Agents using REST APIs. They are defined like other lane types and their type parameter defines the request and response types for the corresponding REST methods. HTTP Lanes provide lifecycle event handlers like other lanes, are able to interact with the state of the agent and return handlers which signal what the HTTP request should respond with.

Example: exposing REST endpoints to view and update the state of a Value Lane:

```rust
use swimos::{
    agent::lanes::SimpleHttpLane,
    agent::{
        agent_lifecycle::HandlerContext,
        event_handler::{HandlerAction, HandlerActionExt},
        lanes::{
            http::{HttpRequestContext, Response, UnitResponse},
            ValueLane,
        },
        lifecycle, projections, AgentLaneModel,
    },
};

#[projections]
#[derive(AgentLaneModel)]
pub struct ExampleAgent {
    value_lane: ValueLane<i32>,
    http_lane: SimpleHttpLane<i32>,
}

#[derive(Clone)]
pub struct ExampleLifecycle;

#[lifecycle(ExampleAgent)]
impl ExampleLifecycle {
    #[on_get(http_lane)]
    fn get_from_value_lane(
        &self,
        context: HandlerContext<ExampleAgent>,
        _http_context: HttpRequestContext,
    ) -> impl HandlerAction<ExampleAgent, Completion = Response<i32>> + '_ {
        context
            .get_value(ExampleAgent::VALUE_LANE)
            .map(Response::from)
    }

    #[on_put(http_lane)]
    fn put_value_to_lane(
        &self,
        context: HandlerContext<ExampleAgent>,
        _http_context: HttpRequestContext,
        value: i32,
    ) -> impl HandlerAction<ExampleAgent, Completion = UnitResponse> + '_ {
        context
            .set_value(ExampleAgent::VALUE_LANE, value)
            .followed_by(context.value(UnitResponse::default()))
    }

    #[on_post(http_lane)]
    fn post_value_to_lane(
        &self,
        context: HandlerContext<ExampleAgent>,
        _http_context: HttpRequestContext,
        value: i32,
    ) -> impl HandlerAction<ExampleAgent, Completion = UnitResponse> {
        context
            .set_value(ExampleAgent::VALUE_LANE, value)
            .followed_by(context.value(UnitResponse::default()))
    }

    #[on_delete(http_lane)]
    fn delete_value_to_lane(
        &self,
        context: HandlerContext<ExampleAgent>,
        _http_context: HttpRequestContext,
    ) -> impl HandlerAction<ExampleAgent, Completion = UnitResponse> {
        context
            .set_value(ExampleAgent::VALUE_LANE, i32::default())
            .followed_by(context.value(UnitResponse::default()))
    }
}
```

The aforementioned example creates a HTTP lane that uses lifecycle event handlers which provide read and write access to the lane `value_lane`. Using the `HttpRequestContext` it's possible to inspect the HTTP request and view the URI that generated the request as well as any HTTP headers in the request. Once the SwimOS Server is running, HTTP Lanes are accessible using the following URL format: `url/node_uri?lane=lane_uri'`; for the above example, `http://127.0.0.1:59282/example/1?lane=http_lane`.

## Advanced Usage

`SimpleHttpLane` is a type alias for a `HttpLane` where all HTTP methods have the same request and response body type. If this is not desired, then a `HttpLane` may be used which has the following definition:

```rust
pub struct HttpLane<Get, Post, Put, Codec> {
  //...
}
```

`Get`, `Post`, and `Put` are used to specify the types for HTTP response and requests for the lane. The [DefaultCodec](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/struct.DefaultCodec.html) provides a codec implementation that supports serialization and deserialization for Recon and JSON formats (requires the `json` feature to be enabled). If your application requires support for another data format, the traits [HttpLaneCodec](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/trait.HttpLaneCodec.html) and [HttpLaneCodecSupport](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/trait.HttpLaneCodecSupport.html) must be implemented.

# Event Handlers

HTTP Lanes expose four lifecycle event handlers that may be registered:

- `on_get`: invoked exactly once after a HTTP GET request has been received.
- `on_put`: invoked exactly once after a HTTP PUT request has been received and is provided with a decoded HTTP request body.
- `on_post`: invoked exactly once after a HTTP POST request has been received and is provided with a decoded HTTP request body.
- `on_delete`: invoked exactly once after a HTTP DELETE request has been received.

In addition to the `HandlerContext`, HTTP lane lifecycle event handlers are also provided with a [HttpRequestContext](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/struct.HttpRequestContext.html) where may be used to inspect the HTTP request and view the URI that generated the request as well as any HTTP headers in the request

## On Get

Invoked exactly once after a HTTP GET request has been received.

```rust
#[on_get(lane_name)]
fn handler(
    &self,
    context: HandlerContext<ExampleAgent>,
    http_context: HttpRequestContext,
) -> impl HandlerAction<ExampleAgent, Completion = Response<i32>> + '_ {
    //...
}
```

This handler accepts no additional parameters and must return a handler which completes with a HTTP [Response](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/struct.Response.html).

## On Put

Invoked exactly once after a HTTP PUT request has been received.

```rust
#[on_put(lane_name)]
fn handler(
    &self,
    context: HandlerContext<ExampleAgent>,
    _http_context: HttpRequestContext,
    value: i32,
) -> impl HandlerAction<ExampleAgent, Completion = UnitResponse> + '_ {
    //...
}
```

The handler is provided with a decoded HTTP request body and must return a HTTP [Response](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/struct.Response.html) with no body.

## On Post

Invoked exactly once after a HTTP POST request has been received.

```rust
#[on_post(lane_name)]
fn handler(
    &self,
    context: HandlerContext<ExampleAgent>,
    _http_context: HttpRequestContext,
    value: i32,
) -> impl HandlerAction<ExampleAgent, Completion = UnitResponse> + '_ {
    //...
}
```

The handler is provided with a decoded HTTP request body and must return a HTTP [Response](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/struct.Response.html) with no body.

## On Delete

Invoked exactly once after a HTTP DELETE request has been received.

```rust
#[on_delete(lane_name)]
fn handler(
    &self,
    context: HandlerContext<ExampleAgent>,
    _http_context: HttpRequestContext
) -> impl HandlerAction<ExampleAgent, Completion = UnitResponse> + '_ {
    //...
}
```

The handler is provided no additional arguments and must return a HTTP [Response](https://docs.rs/swimos/{{ site.data.rust.version }}/swimos/agent/lanes/http/struct.Response.html) with no body.

# Try It Yourself

A standalone project that demonstrates HTTP Lanes is available [here](https://github.com/swimos/swim-rust/tree/main/example_apps/http_lane).
