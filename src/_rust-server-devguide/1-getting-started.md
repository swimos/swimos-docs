---
title: Getting started
short-title: Getting started
description: "Set up a blank SwimOS project."
group: Getting Started
layout: documentation
redirect_from:
  - /rust/developer-guide/getting-started
  - /rust/developer-guide/getting-started.html
---

In this guide, we will walk through creating a simple SwimOS server that stores the state of a single 32 bit signed integer in an agent and then interact with the server using a client application. The guide will introduce some core SwimOS concepts: agents and lanes. Our goal is to equip you with the knowledge and skills to harness the full potential of SwimOS for developing real-time applications.

To initiate the setup of a SwimOS project, start by creating and navigating to the directory where it will be located. First, lets start by creating a new server project named `tutorial_server`:

```shell
$ cargo new tutorial_server --bin
```

Then we need to declare our dependencies. Let's start by adding the following to our `tutorial_server/Cargo.toml`:

```toml
[dependencies]
swimos = { version = "{{ site.data.rust.swimos-version }}", features = ["server"] }
swimos_form = "{{ site.data.rust.swimos-form-version }}"
swimos_client = "{{ site.data.rust.swimos-client-version }}"
tokio = { version = "{{ site.data.rust.tokio-version }}", features = ["rt-multi-thread", "macros"] }
```

The SwimOS platform is built using the `tokio` runtime so we need to include it.

The Minimum Supported Rust Version is {{ site.data.rust.rustc-version }}
