---
title: Lanes
short-title: Lanes
description: "Store state in Web Agents and trigger actions on Web Agents using Lanes"
group: Getting Started
layout: documentation
redirect_from:
  - /concepts/lanes/
  - /reference/lanes.html
---

Distributed objects aren't very useful without properties to store state, and methods to trigger actions. Enter **lanes**. Each Web Agent has a set of named lanes, representing the properties and methods of the Web Agent.

Lanes come in several varieties, corresponding to common data structures and access patterns. Apply ordinary principles of object-oriented design when designed Web Agent models, and their accompanying lanes.

Compare a simple Web Agent, like the following:

```java
@SwimRoute("/person/:id")
class PersonalAgent extends AbstractAgent {
  @SwimLane
  ValueLane<String> name;

  @SwimLane
  ValueLane<Profile> profile;

  @SwimLane
  JoinValueLane<String, Profile> friends;

  @SwimLane
  CommandLane<FriendRequest> befriend = this.<FriendRequest>commandLane()
      .onCommand((friendRequest) => /* ... */);
}
```

To its Plain Old Java Object counterpart:

```java
class Person {
  String name;

  Profile profile;

  Map<String, Profile> friends;

  public void befriend(FriendRequest friendRequest) {
    /* ... */
  }
}
```

Not much difference. But the former instantiates distributable, automatically persistent, continuously consistent Web Agents, accessible via multiplexed streaming APIs. And the latter instantiates ephemeral Java objects.

Jump ahead to [links]({% link _backend/links-intro.md %}) to find out more about streaming APIs. Dive into the [tutorials]({% link _tutorials/index.md %}) to see how lanes are used in practice. Or read on to learn more about the various kinds of lanes available in Swim.
