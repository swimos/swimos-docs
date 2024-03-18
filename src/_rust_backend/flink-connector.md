---
title: Flink Connector
short-title: Flink Connector
description: "Use the Flink Swim Sink to stream events to a Swim application."
group: Data Ingestion
layout: documentation
redirect_from:
  - /rust/guides/flink-connector.html
---

Swim provides a Flink connector for writing data from Flink jobs to Swim servers.

For more information on Flink connectors see the [Flink documentation](https://nightlies.apache.org/flink/flink-docs-release-1.13/).

## Dependency

The Swim Flink connector can be built from source, instructions can be found on [GitHub](https://github.com/swimos/swim-flink-connector).

## Swim Sink

The connector provides a Flink sink that writes data to a Swim server.

To create a `SwimSink` use the builder, type parameter being the type of objects to be written to the Swim server.

```java
SwimSink.<SomeObject>builder()
    .setHostUri("hostUri")
    .setNodeUri(obj -> "/object/" + obj.id)
    .setLaneUri("laneUri")
    .setRecordValueMolder(obj -> Form.forClass(SomeObject.class).mold(obj).toValue())
    .build()
```

The destination Swim endpoint, consisting of `hostUri`, `nodeUri` and `laneUri`, must be set with the corresponding methods shown above.
These methods accept a `String` or a function mapping the source data type to a `String`.

The other mandatory field, the `RecordValueMolder`, defines a method of casting the source data type to a Swim `Value` type.
Swim `Form` provides a general method for molding an object into a `Value`, as above, but structure of messages can be customized (see [Forms]({% link _rust_backend/forms.md %})).

### Local Example

Here we demonstrate a full example where Flink `User` events from some data source are streamed to specific user nodes on a Swim server.

```java
//imports...

public class SwimSinkExampleFlinkJob {

  public static void main(String[] args) throws Exception {

    StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

    DataStream<User> randomUserDataSource = env.addSource(new RandomUserDataSource());

    randomUserDataSource.sinkTo(SwimSink.<User>builder()
            .setHostUri("warp://localhost:9001")
            .setNodeUri(user -> "/user/" + user.id)
            .setLaneUri("addEvent")
            .setRecordValueMolder(user -> Form.forClass(User.class).mold(user).toValue())
            .build()
    );

    env.execute();
  }

  static class User {

    final int id;
    final double longitude;
    final double latitude;
    final double score;

    public User(int id, double longitude, double latitude, double score) {
      this.id = id;
      this.longitude = longitude;
      this.latitude = latitude;
      this.score = score;
    }
  }
}
```
