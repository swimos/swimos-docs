---
title: Recon
layout: page
  - /concepts/recon/
---

Web Agents and their lanes define the entities and associated operations of a streaming API. But this definition is incomplete without also defining the data structures supported by each operation. Swim uses a simple, structural data model, called **Recon**, to exchange streaming messages.

Recon was designed to meet a number of key requirements:

- **uniform tree structure** to simplify procedural processing of structured data
- **expressive syntax** to avoid the proliferation of textual microformats
- **polymorphic** to uniformly disambiguate serialized polymorphic objects
- **distributive parsing** to cleanly and efficiently support incremental parsing
- **simple grammar** to facilitate many compatible implementations
- **universal data type** compatible with JSON, XML, and other popular data languages

Jump ahead to [WARP](/reference/warp) to see how Recon is used as the wire format for a multiplexed streaming network protocol. Dive into the [tutorials](/tutorials) to see how Recon is used in practice to serialize application objects. Or read on to learn more about the unique properties of Recon.
