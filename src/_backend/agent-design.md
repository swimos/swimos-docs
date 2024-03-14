---
title: Web Agent Design
short-title: Web Agent Design
group: Design Guidelines
description: "How to model entities into nodes and agents"
layout: documentation
redirect_from:
  - /concepts/agent-design.html
---

Swim provides a framework to model business entities using distributed objects, the objects being **Web Agents**.
An early design decision that arises is how to distribute these objects and what should be configured as a node or an agent.
In this guide we will discuss some best practices and ideas for designing and modelling entities.

## Entity Modeling

**Entities** are identifiable domain elements (the nouns) and Swim **nodes** are addressable groupings of stateful agents which perform some logic.
Comparing the two definitions, we get a pretty good idea of how to map our entities to nodes, (almost) one-to-one.

Anything **uniquely addressable** can be mapped to a node.
This can be singleton such as a node representing the whole system (`/system`), some entity type with a globally unique id (`/vehicle/:id`), or entities where some composite unique address can be constructed (`/building/:buildingId/room/:roomId`, since roomId is only unique to each building).

As nodes are composed of one or more agents, that **have state** and **perform logic**, it follows that entities that don't have any or much behavior need not be a node.
For example, lights in a room may be uniquely addressable however, if they are simply a boolean value of on or off, it may be cleaner to roll them up into a lane of the parent room node.

Links and by extension join lanes can be used to connect agents and therefore model **entity relationships**.
Any **groupings or aggregations** of entities can also be considered for nodes themselves, allowing aggregate statistics (counts, averages, deviations) to be calculated across the group.

One final consideration is **resource management**; nodes execute in parallel and so to make use of multicore processing and maximize **parallelization**, it is desirable to split out monolithic entities into several nodes and agents.
While nodes and agents are lightweight, they do have some **memory overhead**, therefore when scaling to millions of entities it may be more efficient to include small entities as lanes of their parent entities.

**Database comparison**:
We can draw similarities to relational database design when modelling entities with Swim.
Table definitions map to web agent definitions, each row in the table being and instance of the web agent.
Web agent lanes store values and fields so are the columns. 
Finally, the relationships between the tables (foreign keys) can be mirrored using links.

**Examples:**

- **100s of agencies with 1000s of vehicles each**: Create a node for each vehicle (entity agent) which join an agency node (aggregate agent). 

- **1000s of users with 1-5 addresses each**: Create a node for each user (entity agent), store the addresses in lanes of the user agents.
Addresses don't have any behaviour or logic, hence don't need an agent of their own.

- **100k devices with 100s of sensors each**: Create a node for each device (entity agent), store values of sensors in lanes of the device agents.
We store the sensors in lanes to avoid creating millions of nodes and therefore a large memory footprint - if each sensor requires modelling explicitly then it may warrant a node per sensor.


### URIs

To avoid clashes and make clear what entity type each node is representing we recommend including the entity type in the node URI.

For example, a vehicle with a unique ID should have URI `/vehicle/:id`.
This also extends to composite URIs and a room with an ID unique to a building should have URI `/building/:buildingID/room/:roomId` - the `/room/` part helps avoid clashes if the building were to have other children such as doors.

## Web Agent Granularity

Now we have our nodes and entity model it is time to populate the nodes with agents to perform some logic and add behavior.

In object-oriented programming it is often preferable to compose classes out of smaller **reusable** component classes; this is similar to composing nodes out of agents.
Agents should favor being smaller and re-usable instead of large and monolithic.

**Composability** is made easy with Swim as all agents within a node have access to all lanes and their lifecycle callbacks, this means there is no need to delegate calls to the correct agent with forwarding methods.

One possible way to identify if an agent can be split into multiple is to see if there is a set of fields and methods that are tightly coupled, these can be separated into a new agent - remember that the new agent will still have access to the same lanes.

A good example of an independent re-usable agent would be a 'geographic point agent', this is an agent that extracts longitude and latitude, performs any geospatial processing and exposes a lane to be used by some map UI.
This agent could then be added to any node with a longitude and latitude to be rendered on the UI as well.

The Nstream [**patch**](https://www.nstream.io/docs/backend/agent-relationship/) system provides multiple examples of re-usable agents that can be used to compose nodes.

_Note: Keep in mind that as with objects in Java, each agent created will have a small memory overhead._