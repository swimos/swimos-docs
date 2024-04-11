---
title: Structures
short-title: Structures
description: "The structures which constitute the data model within @swim/structure; starting with Item and continuing on to its subclasses: Field, Attr, Slot, and Value."
group: Data
layout: documentation
redirect_from:
  - /frontend/structures/
---

{% include callout-warning.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior.' %}

## Item

At the center of @swim/structure is the `Item` class, which defines an algebraic data type for representing and manipulating structured data. `Item` provides many methods for operating on structured values, most of which are closed over the `Item` type, meaning they always return other instances of `Item`. This closure of operations over the `Item` type makes it safe and expressive to traverse, transform, and convert arbitrary data structures, without excessive conditional logic to type check and validate structures obtained from external sources.

Every `Item` is either a `Field` or a `Value`. Every `Field` is either an `Attr` or a `Slot`. And every `Value` is either a `Record`, `Data`, `Text`, `Num`, `Bool`, `Extant`, or `Absent`. Think of `Item` as analogous to the set of all JSON values, with the inclusion of object fields as first class elements.

<div class="h-screen">
  <img src="{{ '/assets/images/data-model-item-family.svg' | absolute_url }}" class="mx-auto" alt="Swim data structures; Item, Field, and Value">
</div>

## Field

A `Field` represents a key-value pair, where both the key and value are of type `Value`. An `Attr` is a discriminated kind of `Field` whose key is always of type `Text`. Every `Field` that is not explicitly an `Attr` is a `Slot`. Think of a `Slot` as a field of a JSON object, or as an attribute of an XML tag. Think of an `Attr` like an XML tag, where the key of the `Attr` is the tag name, and the value of the `Attr` is a `Record` containing the element's attributes.

## Value

Every `Item` that is not a `Field` is a `Value`. A `Value` can either be one of four primitive value types: `Data`, `Text`, `Num`, or `Bool`; one of two unit types: `Extant`, or `Absent`; or the composite type: `Record`. Think of a `Value` as representing an arbitrary data structure.

### Primitive Value Types

A `Data` object represents opaque binary data; it wraps a JavaScript Uint8Array. A `Text` object represents a Unicode string, and wraps a primitive JavaScript string. A `Num` object represents a numeric value, encapsulating a primitive JavaScript number. A `Bool` object represents a boolean value, wrapping a primitive JavaScript boolean.

### Unit Value Types

There are two unit types: `Extant`, and `Absent`. `Extant` represents a thing that exists, but has no value; sort of like JavaScript's null value, but a valid object on which you can invoke methods. `Absent` represents something that does not exist; similar to JavaScript's undefined value, but a valid instance of Item.

### Composite Value Type

A `Record` is a simple container of `Item` members, and is the only composite structure type. A `Record` containing only `Field` members is analogous to a JSON object — though, unlike JSON, its keys are not restricted to strings. A `Record` containing only `Value` members is similar to a JSON array. A Record with a leading `Attr` bears resemblance to an XML element. And a Record with a mixture of `Field` and `Value` members acts like a partially keyed list.

## Item Reference

Since everything is an `Item`, each of these methods are available on every kind of structure.

<span style="font-size: 18px" id="isDefined">`isDefined(): boolean;`</span>

Returns `true` if this `Item` is not `Absent`.

<span style="font-size: 18px" id="isDistinct">`isDistinct(): boolean;`</span>

Returns `true` if this `Item` is neither `Extant` nor `Absent`.

<span style="font-size: 18px" id="isDefinite">`isDefinite(): boolean;`</span>

Returns `true` if this `Item` is not one of: an empty `Record`, `False`, `Extant`, or `Absent`.

<span style="font-size: 18px" id="isConstant">`isConstant(): boolean;`</span>

Returns `true` if this `Item` always <a href="#evaluate">`evaluates`</a> to the same `Item`.

<span style="font-size: 18px" id="stringValue">`stringValue(): string | undefined;`</span>

Converts this `Item` into a `string` value, if possible; otherwise returns
`undefined` if this `Item` can't be converted into a `string` value.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.get("model")) // {value: 'Single Phase 4P Din Rail Energy Meter', hashValue: undefined, ...}
console.log(item.get("model").stringValue()) // "Single Phase 4P Din Rail Energy Meter"
console.log(item.get("currentReading").stringValue()) // "8432.7"
console.log(item.get("normalOperation").stringValue()) // "true"
```

<span style="font-size: 18px" id="stringValue">`stringValue<T>(orElse: T): string | T;`</span>

Converts this `Item` into a `string` value, if possible; otherwise returns
`orElse` if this `Item` can't be converted into a `string` value.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.get("foo")) // Absent {}
console.log(item.get("foo").stringValue()) // undefined
console.log(item.get("foo").stringValue("fallback")) // "fallback"
```

<span style="font-size: 18px" id="numberValue">`numberValue(): number | undefined;`</span>

Converts this `Item` into a `number` value, if possible; otherwise returns
`undefined` if this `Item` can't be converted into a `number` value.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.get("currentReading")) // {value: 8432.7, hashValue: undefined, ...}
console.log(item.get("currentReading").numberValue()) // 8432.7
console.log(item.get("model").numberValue()) // undefined
console.log(item.get("normalOperation").numberValue()) // undefined
```

<span style="font-size: 18px" id="numberValue">`numberValue<T>(orElse: T): number | T;`</span>

Converts this `Item` into a `number` value, if possible; otherwise returns
`orElse` if this `Item` can't be converted into a `number` value.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.get("foo")) // Absent {}
console.log(item.get("foo").numberValue()) // undefined
console.log(item.get("foo").numberValue(0)) // 0
```

<span style="font-size: 18px" id="booleanValue">`booleanValue(): boolean | undefined;`</span>

Converts this `Item` into a `boolean` value, if possible; otherwise returns
`undefined` if this `Item` can't be converted into a `boolean` value.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.get("normalOperation")) // {value: true, hashValue: undefined, ...}
console.log(item.get("normalOperation").booleanValue()) // true
console.log(item.get("currentReading").booleanValue()) // true
console.log(item.get("model").booleanValue()) // undefined
```

<span style="font-size: 18px" id="booleanValue">`booleanValue<T>(orElse: T): boolean | T;`</span>

Converts this `Item` into a `boolean` value, if possible; otherwise returns
`orElse` if this `Item` can't be converted into a `boolean` value.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.get("foo")) // Absent {}
console.log(item.get("foo").booleanValue()) // undefined
console.log(item.get("foo").booleanValue(false)) // false
```

<span style="font-size: 18px" id="toLike">`toLike: ItemLike`</span>

Converts this `Item` into the most appropriate JavaScript object. It will parse out strings, numbers, booleans, Arrays, or plain old JavaScript object. Nested structures are supported. `Absent` is coerced to undefined and `Extant` is coerced to null.

```typescript
// WARP message
// @event(node:"/user/1234",lane:orders)@update(key:"/order/123456"){timestamp:1710295106760,totalPrice:29.98,cart:[{itemId:"/item/789012",qty:2,unitPrice:14.99}]}

console.log(item.get('totalPrice').toLike()) // 29.98
console.log(item.get('foo').toLike()) // undefined
console.log(item.header('update').toLike()) // { key: "/order/123456" }
console.log(item.toLike())
/* {
    @update: { key: "/order/123456" },
    timestamp: 1710295106760,
    totalPrice: 29.98,
    cart: [
      {
        itemId: "/item/789012",
        qty: 2,
        unitPrice: 14.99
      }
    ]
  } */
```

<span style="font-size: 18px" id="fromLike">`static fromLike: Item`</span>

Converts a JavaScript object into an item. Essentially the reverse of <a href="#toLike">`toLike`</a>. Nested structures are supported. BigInt and Symbols types are not supported. Undefined is converted to `Absent` and null type is converted to `Extant`. Values of NaN are preserved.

```typescript
console.log(Item.fromLike(null)) // Extant {}

const obj = {
  string: "Hello, world!",
  number: "123456",
  boolean: true,
  nan: NaN,
  array: ["a", 2, { three: 3 }],
};
console.log(Item.fromLike().toString()) // Record.of(Slot.of("string", "Hello, world!"), Slot.of("number", "123456"), Slot.of("boolean", true), Slot.of("nan", NaN), Slot.of("array", Record.of("a", 2, Record.of(Slot.of("three", 3)))))
console.log(Item.fromLike().toLike()) // identical to original obj object

```

<span style="font-size: 18px" id="key">`readonly key: Value;`</span>

Returns the key component of this `Item`, if this `Item` is a Field; otherwise returns Absent if this `Item` is a `Value`.

<span style="font-size: 18px" id="toValue">`toValue(): Value;`</span>

Returns the value component of this `Item`, if this `Item` is a Field; otherwise returns `this` if this `Item` is a `Value`.

<span style="font-size: 18px" id="tag">`readonly tag: string | undefined;`</span>

Returns the key string of the first member of this `Item`, if this `Item`
is a Record, and its first member is an Attr; otherwise returns
`undefined` if this `Item` is not a `Record`, or if this `Item` is a `Record` whose first member is not an `Attr`.
Used to concisely get the name of the discriminating attribute of a structure. The tag can be used to discern the nominal type of a polymorphic structure, similar to an XML element tag.

```typescript
/* 
  WARP message; update to value lane's synced value
  @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}
*/
console.log(item.tag); // undefined

/* 
  WARP message; key updated or added to map-based lane
  @event(node:"/user/1234",lane:orders)@update(key:"/order/123456"){timestamp:1710295106760,totalPrice:29.98,cart:[{itemId:"/item/789012",qty:2,unitPrice:14.99}]}
*/
console.log(item.tag); // "update"

/* 
  WARP message; key removed from map-based lane
  @event(node:"/user/1234",lane:orders)@remove(key:"/order/456789")
*/
console.log(item.tag); // "remove"
```

<span style="font-size: 18px" id="target">`readonly target: Value;`</span>

If this `Item` is a Record, returns the <a href="#flattened">`flattened`</a> members of this `Item` after all attributes have been removed;
otherwise returns `this` if this `Item` is a `non-Record` `Value`, or returns the value component if this `Item` is a `Field`.
Used to concisely get the scalar value of an attributed structure. An attributed structure is a `Record` with one or more attributes that modify one or more other members.

<span style="font-size: 18px" id="flattened">`flattened(): Value;`</span>

Returns the sole member of this `Item`, if this `Item` is a Record
with exactly one member, and its member is a `Value`; returns Extant
if this `Item` is an empty `Record`; returns Absent if this `Item` is
a `Field`; otherwise returns `this` if this `Item` is a `Record` with more
than one member, or if this `Item` is a `non-Record` `Value`.
Used to convert a unary `Record` into its member `Value`. Facilitates
writing code that treats a unary `Record` equivalently to a bare `Value`.

<span style="font-size: 18px" id="unflattened">`unflattened(): Record;`</span>

Returns `this` if this `Item` is a Record; returns a `Record`
containing just this `Item`, if this `Item` is  <a href="#isDistinct">`distinct`</a>; otherwise returns an empty `Record` if this `Item` is Extant or Absent. Facilitates writing code that treats a bare `Value` equivalently to a unary `Record`.

<span style="font-size: 18px" id="header">`header(tag: string): Value;`</span>

Returns the value of the first member of this `Item`, if this `Item` is a
Record, and its first member is an Attr whose <a href="#key">`key`</a> string is equal to <a href="#tag">`tag`</a>; otherwise returns Absent if this `Item` is not a `Record`, or if this `Item` is a `Record` whose first member is not an `Attr`, or if this `Item` is a `Record` whose first member is an `Attr` whose <a href="#key">`key`</a> does not equal the <a href="#tag">`tag`</a>. Used to conditionally get the value of the head `Attr` of a structure, if and only if the key string of the head `Attr` is equal to the <a href="#tag">`tag`</a>. Can be used to check if a structure might conform to a nominal type named <a href="#tag">`tag`</a>, while simultaneously getting the value of the <a href="#tag">`tag`</a> attribute.

```typescript
// WARP message
// @event(node:"/user/1234",lane:orders)@update(key:"/order/123456"){timestamp:1710295106760,totalPrice:29.98,cart:[{itemId:"/item/789012",qty:2,unitPrice:14.99}]}

value.header('update'); // RecordMap {length: 1, fieldCount: 1, ...}
value.header('update').get('key'); // "/order/123456"
value.header('replace').get('key'); // Absent {}
```

<span style="font-size: 18px" id="headers">`headers(tag: string): Record | undefined;`</span>

Returns the <a href="#unflattened">`unflattened`</a> <a href="#header">`header`</a> of
this `Item`, if this `Item` is a Record, and its first member is an Attr whose <a href="#key">`key`</a> string is equal to <a href="#tag">`tag`</a>; otherwise returns `undefined`. The <a href="#headers">`headers`</a> of the <a href="#tag">`tag`</a> attribute of a structure are like the attributes of an XML element tag; through unlike an XML element, <a href="#tag">`tag`</a> attribute headers are not limited to string keys and values.

<span style="font-size: 18px" id="head">`head(): Item;`</span>

Returns the first member of this `Item`, if this `Item` is a non-empty
Record; otherwise returns Absent.

<span style="font-size: 18px" id="tail">`tail(): Record;`</span>

Returns a view of all but the first member of this `Item`, if this `Item`
is a non-empty `Record`; otherwise returns an empty `Record` if this `Item` is not a `Record`, or if this `Item` is itself an empty `Record`.

<span style="font-size: 18px" id="body">`body(): Value;`</span>

Returns the `flattened` `tail` of this
`Item`. Used to recursively deconstruct a structure, terminating with its last `Value`, rather than a unary `Record` containing its last value, if the structure ends with a `Value` member.

<span style="font-size: 18px" id="length">`readonly length: number;`</span>

Returns the number of members contained in this `Item`, if this `Item` is
a Record; otherwise returns `0` if this `Item` is not a `Record`.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.length) // 4
```

<span style="font-size: 18px" id="has">`has(key: ValueLike): boolean;`</span>

Returns `true` if this `Item` is a Record that has a Field member
with a key that is equal to the given key; otherwise returns `false` if this `Item` is not a `Record`, or if this `Item` is a `Record`, but has no `Field` member with a key equal to the given key.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.has("model")) // true
console.log(item.has("currentReading")) // true
console.log(item.has("foo")) // false
```

<span style="font-size: 18px" id="get">`get(key: ValueLike): Value;`</span>

Returns the value of the last Field member of this `Item` whose key
is equal to the given key; returns Absent if this `Item` is not a Record, or if this `Item` is a `Record`, but has no `Field` member with a key equal to the given key.

```typescript
// WARP message
// @event(node:"/home/electricityMeter",lane:status){currentReading:8432.7,model:"Single Phase 4P Din Rail Energy Meter",normalOperation:true,timestamp:1710272571408}

console.log(item.get("model")) // {value: 8432.7, hashValue: undefined, ...}
console.log(item.get("currentReading").numberValue()) // 8432.7
console.log(item.get("model").stringValue()) // "Single Phase 4P Din Rail Energy Meter"
console.log(item.get("normalOperation").booleanValue()) // true
```

<span style="font-size: 18px" id="getAttr">`getAttr(key: TextLike): Value;`</span>

Returns the value of the last Attr member of this `Item` whose key
is equal to the given <a href="#key">`key`</a>; returns Absent if this `Item` is not a Record, or if this `Item` is a `Record`, but has no `Attr` member with a key equal to the given <a href="#key">`key`</a>.

```typescript
// WARP message
// @event(node:"/user/1234",lane:orders)@update(key:"/order/123456"){timestamp:1710295106760,totalPrice:29.98,cart:[{itemId:"/item/789012",qty:2,unitPrice:14.99}]}

console.log(item.getAttr("update").get("key").stringValue()); // "/order/123456"
console.log(item.get("update").get("key").stringValue()); // "/order/123456"

console.log(item.getAttr("totalPrice").numberValue()); // undefined
console.log(item.get("totalPrice").numberValue()); // 29.98
```

<span style="font-size: 18px" id="getSlot">`getSlot(key: ValueLike): Value;`</span>

Returns the value of the last Slot member of this `Item` whose key
is equal to the given <a href="#key">`key`</a>; returns Absent if this `Item` is not a Record, or if this `Item` is a `Record`, but has no `Slot` member with a key equal to the given <a href="#key">`key`</a>.

```typescript
// WARP message
// @event(node:"/user/1234",lane:orders)@update(key:"/order/123456"){timestamp:1710295106760,totalPrice:29.98,cart:[{itemId:"/item/789012",qty:2,unitPrice:14.99}]}

console.log(item.get("totalPrice").numberValue()); // 29.98
console.log(item.getSlot("totalPrice").numberValue()); // 29.98

console.log(item.get("update").get("key").stringValue()); // "/order/123456"
console.log(item.getSlot("update").get("key").stringValue()); // "/order/123456"
```

<span style="font-size: 18px" id="getField">`getField(key: ValueLike): Field | undefined;`</span>

Returns the last Field member of this `Item` whose key is equal to the
given key; returns `undefined` if this `Item` is not a Record, or if this `Item` is a `Record`, but has no `Field` member with a key equal to the given key.

<span style="font-size: 18px" id="getItem">`getItem(index: NumLike): Item;`</span>

Returns the member of this `Item` at the given <a href="#index">`index`</a>, if this `Item` is
a Record, and the <a href="#index">`index`</a> is greater than or equal to zero, and less than the <a href="length">`length`</a> of the `Record`; otherwise returns Absent if this `Item` is not a `Record`, or if this `Item` is a `Record`, but the <a href="#index">`index`</a> is out of bounds.

```typescript
// WARP message
// @event(node:"/user/1234",lane:orders)@update(key:"/order/123456"){timestamp:1710295106760,totalPrice:29.98,cart:[{itemId:"/item/789012",qty:2,unitPrice:14.99}]}

console.log(item.getItem(0).key.stringValue()) // "update"
console.log(item.getItem(1).numberValue()) // 1710295106760
console.log(item.getItem(2).numberValue()) // 8432.7
console.log(item.getItem(99).stringValue()) // Absent {}
```

<span style="font-size: 18px" id="forEach">`forEach(callback: (item: Item, index: number) => void)): undefined;`</span>

Iterates over every `Attribute` or `Slot` of an Item and executes the provided callback on it, receiving the individual `Attribute` or `Slot` and its index as arguments. If `forEach` is called on either `Absent` or an empty `Record`, the callback is never invoked as the `Item` does not contain a valid `Attribute` or `Slot`. If `forEach` is called on `Extant`, the callback gets invoked a single time with the `Extant` unit type.

<span style="font-size: 18px" id="evaluate">`evaluate(interpreter: InterpreterLike): Item;`</span>

Returns a new `Item` with all nested expressions interpreted in lexical order and scope.

<span style="font-size: 18px" id="readonly">`readonly typeOrder: number;`</span>
Returns the heterogeneous sort order of this `Item`. Used to impose a
total order on the set of all items. When comparing two items of
different types, the items order according to their `typeOrder`.
