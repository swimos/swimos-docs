---
title: Lanes
layout: page
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

Jump ahead to [links](/concepts/links) to find out more about streaming APIs. Dive into the [tutorials](/tutorials) to see how lanes are used in practice. Or read on to learn more about the various kinds of lanes available in Swim.

<!--<h2 class="header-green">Data Lanes</h2>
<div class="feature-stack">
  <div class="feature-block feature-block-left">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>ValueLane</h3>
      <p></p>
    </div>
  </div>
  <div class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>MapLane</h3>
      <p></p>
    </div>
  </div>
  <div class="feature-block feature-block-left">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>ListLane</h3>
      <p></p>
    </div>
  </div>
  <div class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>SpatialLane</h3>
      <p></p>
    </div>
  </div>
</div>
<h2 class="header-green">Messaging Lanes</h2>
<div class="feature-stack">
  <div class="feature-block feature-block-left">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>CommandLane</h3>
      <p></p>
    </div>
  </div>
  <div class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>SupplyLane</h3>
      <p></p>
    </div>
  </div>
  <div class="feature-block feature-block-left">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>DemandLane</h3>
      <p></p>
    </div>
  </div>
  <div class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>DemandMapLane</h3>
      <p></p>
    </div>
  </div>
</div>
<h2 class="header-green">Join Lanes</h2>
<div class="feature-stack">
  <div class="feature-block feature-block-left">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>JoinValueLane</h3>
      <p></p>
    </div>
  </div>
  <div class="feature-block feature-block-right">
    <div class="feature-graphic">
    </div>
    <div class="feature-description">
      <h3>JoinMapLane</h3>
      <p></p>
    </div>
  </div>
</div>-->
