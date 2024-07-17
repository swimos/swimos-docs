---
title: Interacting with the server
short-title: Client
description: "Interact with some SwimOS Web Agents."
group: Getting Started
layout: documentation
redirect_from:
  - /rust/developer-guide/client
  - /rust/developer-guide/client.html
---

In this section of the tutorial, a SwimOS client will be created which will both produce events and consume them from the server.

Create a new binary at `src/bin/client.rs` and add the following to your Cargo manifest:

```shell
[[bin]]
name = "client"
```

To interact with the state of a lane using a SwimOS client, Downlinks are used. Downlinks are bidirectionally-streaming, persistent subscriptions to lanes which provide the ability to update the state of a lane and to receive state notification changes.

Replace the contents of `src/bin/client.rs` with the following:

```rust
use swimos_client::{BasicValueDownlinkLifecycle, RemotePath, SwimClientBuilder};
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Build a Swim Client using the default configuration.
    // The `build` method returns a `SwimClient` instance and its internal
    // runtime future that is spawned below.
    let (client, task) = SwimClientBuilder::default().build().await;
    let client_task = tokio::spawn(task);
    let handle = client.handle();

    let state_path = RemotePath::new(
        "ws://0.0.0.0:8080",
        "/example/1",
        "state",
    );

    let lifecycle = BasicValueDownlinkLifecycle::<usize>::default()
        // Register an event handler that is invoked when the downlink receives an event.
        .on_event_blocking(|value| println!("Downlink event: {value:?}"));

    // The downlink is spawned as its own task within the client.
    let state_downlink = handle
        .value_downlink::<i32>(state_path)
        .lifecycle(lifecycle)
        .open()
        .await?;

    for i in 0..10 {
        state_downlink.set(i).await?;
    }

    // If this was removed, then the application would immediately exit.
    client_task.await?;
    Ok(())
}
```

Now, both of the applications can be run and the client will produce an output. In the `tutorial_server` directory run:

```shell
$ cargo run
```

And in another terminal, run:

```shell
$ cargo run --bin client
```

The server will not produce any output but the client will produce:

```
Downlink event: 0
Downlink event: 1
Downlink event: 2
Downlink event: 3
Downlink event: 4
Downlink event: 5
Downlink event: 6
Downlink event: 7
Downlink event: 8
Downlink event: 9
```
