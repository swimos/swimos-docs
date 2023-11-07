---
title: HTTP Ingress Bridges
short-title: HTTP Ingress Bridges
description: "See our recommended approach to simple HTTP ingress."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/http_ingress_bridges
redirect_from:
  - /tutorials/http-ingress-bridges/
  - /reference/http-ingress-bridges.html
---

Recall the **general** means to ingest into a Swim server via [ingress bridges]({% link _backend/ingress-bridges.md %}). Here, we outline one common design where the data source is HTTP server (though the concepts may generalize across other protocols). More specifically, this outlines a "pull-type" bridge where the data ingestion process and the Web Agents share a runtime.

You may find it pointless to seed a real-time streaming application with a data source that must be polled. However, note that applications will typically utilize multiple data sources of different types. Because Swim apps are stateful, the poll results will remain available, even after independent messages have been pushed to the Web Agents.

### Currency Agents

This exercise tracks the exchange rate from USD to multiple "target" currencies over time. Each target currency will have a corresponding Web Agent of type `CurrencyAgent`. A `CurrencyAgent` only contains two lanes: a `CommandLane` for data ingestion, and a `MapLane` to store the rate exchange history.

```java
// swim/forex/FreeForexApi.java
package swim.forex;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.structure.Value;

public class CurrencyAgent extends AbstractAgent {

  @SwimLane("rateFromUSD")
  MapLane<Long, Double> rateFromUSD = this.<Long, Double>mapLane()
      .didUpdate((k, n, o) -> {
        logMessage("added entry <" + k + ", " + n + ">");
      });

  @SwimLane("addEntry")
  CommandLane<Value> addEntry = this.<Value>commandLane()
      .onCommand(v -> {
        this.rateFromUSD.put(v.get("timestamp").longValue(), v.get("rate").doubleValue());
      });

  private void logMessage(Object msg) {
    System.out.println(nodeUri() + ": " + msg);
  }
}
```

### Free Forex API

The very simple Free Forex API, whose documentation can be found [here](https://www.freeforexapi.com/Home/Api), exposes a single endpoint where:

- The user provides a pair, or comma-delimited pairs, of currencies over a GET request
- The server responds with the exchange rate between every provided pair

Our first step is to simply connect to this API with Java, and we do so in a no-frills fashion:

```java
// swim/forex/FreeForexApi.java
package swim.forex;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

public final class FreeForexApi {

  private HttpsURLConnection conn;

  private void openConn() {
    if (this.conn != null) {
      closeConn();
    }
    try {
      final URL url = new URL((String) FREE_FOREX_API_URI); // "https://www.freeforexapi.com/api/live?pairs=..."
      this.conn = (HttpsURLConnection) url.openConnection();
      this.conn.setDoOutput(true);
      this.conn.setConnectTimeout(5000);
      this.conn.setRequestMethod("GET");
    } catch (IOException e) {
      closeConn();
      throw new RuntimeException("Failed to open connection");
    }
  }

  private void closeConn() {
    if (this.conn != null) {
      this.conn.disconnect();
      this.conn = null;
    }
  }

  private Object fetchExchangeRates() throws IOException {
    try (InputStreamReader is = new InputStreamReader(this.conn.getInputStream());
         BufferedReader br = new BufferedReader(is)) {
      final String response = br.readLine();
      return response; // you'll probably want to transform this first
    }
  }
}
```

### Mapping Responses to Web Agents

A successful JSON response from the REST server takes the form

```json
{
  "rates": {
    "$CURRENCY_PAIR_1": {
      "rate": "$EXCHANGE_RATE_1",
      "timestamp": "$TIMESTAMP_1"
    },
    "$CURRENCY_PAIR_2": {
      "rate": "$EXCHANGE_RATE_1",
      "timestamp": "$TIMESTAMP_1"
    }
  },
  "code": 200
}
```

We can use a number of libraries to parse this into a structured object `response`. If we use `swim.structure`, then:

1. `pair = response.get("rates").getItem(i)` returns the i'th pair's information
1. `pair = pair.key()` returns the currency pair's combined name, so we can call `String.subString()` to isolate one piece
1. `pair = pair.toValue()` returns the rate and timestamp information

Furthermore,

- A for-each loop obviates the explict `getItem()` call in step 1
- Step 2 uniquely identifies a destination Web Agent
- Step 3 identifies the desired payload for that Web Agent

Thus, we could supplement our earlier code as follows:

```java
// swim/forex/FreeForexApi.java
package swim.forex;

import java. ...
import swim.api.agent.AgentContext;
import swim.json.Json;
import swim.structure.Item;
import swim.structure.Value;

public final class FreeForexApi {

  ...

  private Value fetchExchangeRates() throws IOException {
    try (InputStreamReader is = new InputStreamReader(this.conn.getInputStream());
         BufferedReader br = new BufferedReader(is)) {
      return Json.parse(br.readLine());
    }
  }

  public void relayExchangeRates(AgentContext swim) throws IOException {
    openConn();
    try {
      final Value response = fetchExchangeRates();
      for (Item i : response.get("rates")) {
        final String currency = i.key().stringValue().substring(3);
        final Value agentPayload = i.toValue();
        swim.command("/currency/" + currency, "addEntry", agentPayload);
      }
    } finally {
      closeConn();
    }
  }
}
```

The actual code only differs from this by enforcing a [singleton pattern](https://en.wikipedia.org/wiki/Singleton_pattern) via static wrapper methods. Note that a single REST response corresponds to potentially multiple messages being sent to `CurrencyAgents`, one message per requested currency pair.

### Scheduling `relayExchangeRates()`

At this point, all the hooks are in place to bridge between the REST data and the Web Agents. The only remaining piece is to actually invoke `relayExchangeRates()`. Since this contains a blocking network call, we cannot naively invoke this from the Web Agent context without the risk of impacting performance. On the other hand, having access to this context within the same process circumvents interprocess communication.

One way to reap the best of both worlds is to have a dedicated, singleton Web Agent that invokes `relayExchangeRates()`, but to delegate this invocation to Swim's `asyncStage()` instead of the "main" thread pool that runs the `CurrencyAgent` logic. An additional advantage of this strategy is the ability to use [Swim's built-in timers]({% link _backend/timers.md %}) to **periodically** poll the data source.

We thus define a `CurrencyFetchAgent` as follows, and delegate the responsibility of ensuring this remains a singleton to the `server.recon` configuration file as outlined in a [prior cookbook]({% link _backend/web-agents.md %}).

```java
// swim/forex/CurrencyFetchAgent.java
package swim.forex;

import java.io.IOException;
import swim.api.agent.AbstractAgent;
import swim.concurrent.AbstractTask;
import swim.concurrent.TaskRef;
import swim.concurrent.TimerRef;

public class CurrencyFetchAgent extends AbstractAgent {

  private TimerRef timer;
  private TaskRef poll;

  private void initPoll() {
    this.poll = asyncStage().task(new AbstractTask() {

      @Override
      public void runTask() {
        try {
          FreeForexApi.relayExchangeRates(agentContext());
        } catch (IOException e) {
          e.printStackTrace();
        }
      }

      @Override
      public boolean taskWillBlock() {
        return true;
      }
    });
  }

  private void scheduleTimer() {
    if (this.timer != null) {
      return;
    }
    this.timer = setTimer(0L, () -> {
      if (this.poll == null) {
        initPoll();
      }
      this.poll.cue();
      this.timer.reschedule(POLL_DELAY_MS);
    });
  }

  @Override
  public void didStart() {
    System.out.println(nodeUri() + ": didStart");
    scheduleTimer();
  }

  private static final long POLL_DELAY_MS = 20L * 1000;

}
```

### Try It Yourself

A standalone project that combines all of these snippets and handles any remaining boilerplate is available [here](https://github.com/swimos/cookbook/tree/master/http_ingress_bridges).
