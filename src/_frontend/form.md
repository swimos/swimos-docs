---
title: Form
short-title: Form
description: "A class which may be used for providing type information to downlinks."
group: Data
layout: documentation
redirect_from:
---

{% include callout-warning.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior.' %}

A Form defines a conversion between a structural type, and some nominal JavaScript type. The `mold` method converts a nominal JavaScript type to an Item. And the `cast` method converts an Item to a nominal JavaScript type, if possible.

Here is an example of a custom Form which defines how the conversion of an entity representing how a stock might look. Custom Forms should extend `Form`, which can be imported from `@swim/structure`. This library should automatically be present in your bundle as a dependency of `@swim/client`.

```typescript
import { Form, Item } from "@swim/structure";

type Stock = {
  symbol: string;
  price: number;
  volume: number;
  dailyChange: number;
};

export class StockForm extends Form<Stock | undefined> {
  constructor() {
    super();
  }

  // Item to JS object
  override cast(item: Item): Stock | undefined {
    if (
      item.tag === "update" && // make sure message is an update
      item.get("update").get("key").stringValue("") && // find key
      item.get("price").isDefinite() && // ensure all fields are present
      item.get("volume").isDefinite() &&
      item.get("movement").isDefinite()
    ) {
      return {
        symbol: item.get("update").get("key").stringValue(""),
        price: item.get("price").numberValue(0),
        volume: item.get("volume").numberValue(0),
        dailyChange: item.get("dailyChange").numberValue(0),
      };
    }

    // return undefined for all messages which don't fit the expected format
    return undefined;
  }

  // JS object to Item
  override mold(object: Stock, item?: Item): Item {
    let result = Item.fromLike(object);
    if (item !== void 0) {
      result = item.concat(object);
    }
    return result;
  }
}
```

A downlink which expects to receive data matching the format of a Stock may now use this Form to coerce the Values it receives into a strongly typed `Stock` objects. If the Form receives data in an unrecognized format, it will return undefined, which is also part of its type. Remember that [`isDistinct`](/frontend/structures#isDistinct) is used to check that a `Value` is not [`Extant`](/frontend/structures#unit-value-types) or [`Absent`](/frontend/structures#unit-value-types), and [`isDefinite`](/frontend/structures#isDefinite) checks that it's not `false` or an empty [`Record`](/frontend/structures#composite-value-type) either.

The example above demonstrates a straightforward use case of converting expected structural types into typed JavaScript objects more comfortable to work with. The possibilites afforded by custom Forms, however, go beyond simple conversion. Further transformation of the data could be performed within Forms as well. While it would likely be cleaner and more efficient to do such operations from inside of a Web Agent (as that is one of their defining purposes), it is wholly possible to do data transformation within a Form as well if one were so inclined.
