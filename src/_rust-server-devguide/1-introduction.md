---
title: 1. Introduction
short-title: Introduction
description: "Introduction to the SwimOS developer guide."
group: Introduction
layout: documentation
redirect_from:
  - /rust/developer-guide/introduction
  - /rust/developer-guide/introduction.html
---

Welcome to the SwimOS developer's guide, an introductory guide to the SwimOS framework. With SwimOS, you can dive into building applications without getting bogged down by intricate infrastructure details – it takes care of the 'plumbing' so you can concentrate on crafting robust application logic.

In this guide, we will walk through creating a simple SwimOS server that stores the state of a single i32 value in an agent and then interact with the server using a client application. The guide will introduce some core SwimOS concepts: agents and lanes. Our goal is to equip you with the knowledge and skills to harness the full potential of SwimOS for developing real-time applications. While we'll cover the 'how' of building streaming apps, if you're interested in understanding the 'why' behind it, you may find our reference documentation more insightful.

# Who This Guide Is For

This guide assumes that you've written code in Rust before and as such we will not explain any Rust-specific features or syntax. We will focus on features of the SwimOS framework which by design aren't overly complex to use, although some background knowledge of software development methodologies is required.

If you aren't familiar with Rust, the [Rust book](https://doc.rust-lang.org/book/) is an excellent guide to learn Rust from. While not essential, it's recommended to be familiar with the basics of asynchronous Rust and the [Asynchronous Programming in Rust](https://rust-lang.github.io/async-book/) guide is another excellent resource.

# Prerequisites

SwimOS Rust requires a minimum Rust version of `{{ site.data.rust.rustc-version }}`. You can check your current Rust version using:

```shell
$ rustc --version
```

Which should return an output of something like `rustc 1.76.0 (07dca489a 2024-02-04)`.

If you do not have a version that matches this requirement you can update it using:

```shell
 rustup override set {{ site.data.rust.rustc-version }}
```
