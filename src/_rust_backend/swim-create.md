---
title: Bootstrap a Swim Application using swim-create
short-title: Swim Create CLI
description: "How to bootstrap a Swim Application"
group: Utilities
layout: documentation
redirect_from:
  - /rust/guides/swim-create.html
---

The swim-create CLI tool lets you get started quickly by creating a basic skeleton for a swim project.

### Installation

To install the latest version of the CLI tool you could run:

```bash
curl -L https://github.com/nstreamio/swim-create/releases/latest/download/swim-create-x86_64-unknown-linux-gnu.tar.gz | sudo tar -xz -C /usr/local/bin
```

or alternatively download the latest release from: [https://github.com/nstreamio/swim-create/releases/latest/](https://github.com/nstreamio/swim-create/releases/latest/)

### Usage

You can then create a swim project using:

```bash
swim-create <PROJECT_NAME>
```

### Description

A brief description of the most important files and their function:

`settings.gradle` - Contains the project name.

`build.gradle` - Contains the name of the main Java class and the Swim version.

`server.recon` - Contains information about the Swim plane and the port for the Swim server.

`MainPlane.java` - Is the Swim plane definition and the entry point.
