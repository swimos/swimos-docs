---
title: Recon
short-title: Recon
description: "Learn about the structural data model called Recon, which is used by Swim to exchange streaming messages."
group: Getting Started
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
