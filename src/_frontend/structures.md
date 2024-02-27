---
title: Structures
short-title: Structures
description: "The structures which constitute the data model within @swim/structure; starting with Item and continuing on to its subclasses: Field, Attr, Slot, and Value."
group: Data
layout: documentation
redirect_from:
---

_This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior._

## Item

At the center of @swim/structure is the `Item` class, which defines an algebraic data type for representing and manipulating structured data. Item provides many methods for operating on structured values, most of which are closed over the Item type, meaning they always return other instances of Item. This closure of operations over the Item type makes it safe and expressive to traverse, transform, and convert arbitrary data structures, without excessive conditional logic to type check and validate structures obtained from external sources.

Every `Item` is either a Field or a Value. Every Field is either an Attr or a Slot. And every Value is either a Record, Data, Text, Num, Bool, Extant, or Absent. Think of Item as analogous to the set of all JSON values, with the inclusion of object fields as first class elements.

<div class="h-screen">
  <img src="{{ '/assets/images/data-model-item-family.svg' | absolute_url }}" class="mx-auto" alt="Swim data structures; Item, Field, and Value">
</div>

## Field

A `Field` represents a key-value pair, where both the key and value are of type Value. An `Attr` is a discriminated kind of Field whose key is always of type Text. Every Field that is not explicitly an Attr is a `Slot`. Think of a Slot as a field of a JSON object, or as an attribute of an XML tag. Think of an Attr like an XML tag, where the key of the Attr is the tag name, and the value of the Attr is a Record containing the element's attributes.

## Value

Every Item that is not a Field is a `Value`. A Value can either be one of four primitive value types: Data, Text, Num, or Bool; one of two unit types: Extant, or Absent; or the composite type: Record. Think of a Value as representing an arbitrary data structure.

### Primitive Value Types

A `Data` object represents opaque binary data; it wraps a JavaScript Uint8Array. A `Text` object represents a Unicode string, and wraps a primitive JavaScript string. A `Num` object represents a numeric value, encapsulating a primitive JavaScript number. A `Bool` object represents a boolean value, wrapping a primitive JavaScript boolean.

### Unit Value Types

There are two unit types: `Extant`, and `Absent`. Extant represents a thing that exists, but has no value; sort of like JavaScript's null value, but a valid object on which you can invoke methods. Absent represents something that does not exist; similar to JavaScript's undefined value, but a valid instance of Item.

### Composite Value Type

A `Record` is a simple container of Item members, and is the only composite structure type. A Record containing only Field members is analogous to a JSON object—though unlike JSON, its keys are not restricted to strings. A Record containing only Value members is similar to a JSON array. A Record with a leading Attr bears resemblance to an XML element. And a Record with a mixture of Field and Value members acts like a partially keyed list.

## Item Reference

Since everything is an Item, each of these methods are available on every kind of structure.

<span id="isDefined">`isDefined(): boolean;`</span>

Returns _true_ if this _Item_ is not _Absent_.

<span id="isDistinct">`isDistinct(): boolean;`</span>

Returns _true_ if this _Item_ is neither _Extant_ nor _Absent_.

<span id="isDefinite">`isDefinite(): boolean;`</span>

Returns _true_ if this _Item_ is not one of: an empty _Record_, _False_, _Extant_, or _Absent_.

<span id="isConstant">`isConstant(): boolean;`</span>

Returns _true_ if this _Item_ always <a href="#evaluate">_evaluates_</a> to the same _Item_.

<span id="key">`readonly key: Value;`</span>

Returns the key component of this _Item_, if this _Item_ is a Field; otherwise returns Absent if this _Item_ is a _Value_.

<span id="toValue">`toValue(): Value;`</span>

Returns the value component of this _Item_, if this _Item_ is a Field; otherwise returns _this_ if this _Item_ is a _Value_.

<span id="tag">`readonly tag: string | undefined;`</span>

Returns the <a href="#key">_key_</a> string of the first member of this _Item_, if this _Item_
is a Record, and its first member is an Attr; otherwise returns
_undefined_ if this _Item_ is not a _Record_, or if this _Item_ is a _Record_ whose first member is not an _Attr_.
Used to concisely get the name of the discriminating attribute of a structure. The <a href="#tag">_tag_</a> can be used to discern the nominal type of a polymorphic structure, similar to an XML element tag.

<span id="target">`readonly target: Value;`</span>

Returns the <a href="#flattened">_flattened_</a> members of this _Item_ after all
attributes have been removed, if this _Item_ is a Record; otherwise returns _this_ if this _Item_ is a _non-Record_ _Value_, or returns the value component if this _Item_ is a _Field_.
Used to concisely get the scalar value of an attributed structure. An attributed structure is a _Record_ with one or more attributes that modify one or more other members.

<span id="flattened">`flattened(): Value;`</span>

Returns the sole member of this _Item_, if this _Item_ is a Record
with exactly one member, and its member is a _Value_; returns Extant
if this _Item_ is an empty _Record_; returns Absent if this _Item_ is
a _Field_; otherwise returns _this_ if this _Item_ is a _Record_ with more
than one member, or if this _Item_ is a _non-Record_ _Value_.
Used to convert a unary _Record_ into its member _Value_. Facilitates
writing code that treats a unary _Record_ equivalently to a bare _Value_.

<span id="unflattened">`unflattened(): Record;`</span>

Returns _this_ if this _Item_ is a Record; returns a _Record_
containing just this _Item_, if this _Item_ is  <a href="#isDistinct">_distinct_</a>; otherwise returns an empty _Record_ if this _Item_ is Extant or Absent. Facilitates writing code that treats a bare _Value_ equivalently to a unary _Record_.

<span id="header">`header(tag: string): Value;`</span>

Returns the value of the first member of this _Item_, if this _Item_ is a
Record, and its first member is an Attr whose <a href="#key">_key_</a> string is equal to <a href="#tag">_tag_</a>; otherwise returns Absent if this _Item_ is not a _Record_, or if this _Item_ is a _Record_ whose first member is not an _Attr_, or if this _Item_ is a _Record_ whose first member is an _Attr_ whose <a href="#key">_key_</a> does not equal the <a href="#tag">_tag_</a>. Used to conditionally get the value of the head _Attr_ of a structure, if and only if the key string of the head _Attr_ is equal to the <a href="#tag">_tag_</a>. Can be used to check if a structure might conform to a nominal type named <a href="#tag">_tag_</a>, while simultaneously getting the value of the <a href="#tag">_tag_</a> attribute.

<span id="headers">`headers(tag: string): Record | undefined;`</span>

Returns the <a href="#unflattened">_unflattened_</a> <a href="#header">_header_</a> of
this _Item_, if this _Item_ is a Record, and its first member is an Attr whose <a href="#key">_key_</a> string is equal to <a href="#tag">_tag_</a>; otherwise returns _undefined_. The <a href="#headers">_headers_</a> of the <a href="#tag">_tag_</a> attribute of a structure are like the attributes of an XML element tag; through unlike an XML element, <a href="#tag">_tag_</a> attribute headers are not limited to string keys and values.

<span id="head">`head(): Item;`</span>

Returns the first member of this _Item_, if this _Item_ is a non-empty
Record; otherwise returns Absent.

<span id="tail">`tail(): Record;`</span>

Returns a view of all but the first member of this _Item_, if this _Item_
is a non-empty _Record_; otherwise returns an empty _Record_ if this _Item_ is not a _Record_, or if this _Item_ is itself an empty _Record_.

<span id="body">`body(): Value;`</span>

Returns the _flattened_ _tail_ of this
_Item_. Used to recursively deconstruct a structure, terminating with its last _Value_, rather than a unary _Record_ containing its last value, if the structure ends with a _Value_ member.

<span id="length">`readonly length: number;`</span>

Returns the number of members contained in this _Item_, if this _Item_ is
a Record; otherwise returns _0_ if this _Item_ is not a _Record_.

<span id="has">`has(key: ValueLike): boolean;`</span>

Returns _true_ if this _Item_ is a Record that has a Field member
with a key that is equal to the given <a href="#key">_key_</a>; otherwise returns _false_ if this _Item_ is not a _Record_, or if this _Item_ is a _Record_, but has no _Field_ member with a key equal to the given <a href="#key">_key_</a>.

<span id="get">`get(key: ValueLike): Value;`</span>

Returns the value of the last Field member of this _Item_ whose key
is equal to the given <a href="#key">_key_</a>; returns Absent if this _Item_ is not a Record, or if this _Item_ is a _Record_, but has no _Field_ member with a key equal to the given <a href="#key">_key_</a>.

<span id="getAttr">`getAttr(key: TextLike): Value;`</span>

Returns the value of the last Attr member of this _Item_ whose key
is equal to the given <a href="#key">_key_</a>; returns Absent if this _Item_ is not a Record, or if this _Item_ is a _Record_, but has no _Attr_ member with a key equal to the given <a href="#key">_key_</a>.

<span id="getSlot">`getSlot(key: ValueLike): Value;`</span>

Returns the value of the last Slot member of this _Item_ whose key
is equal to the given <a href="#key">_key_</a>; returns Absent if this _Item_ is not a Record, or if this _Item_ is a _Record_, but has no _Slot_ member with a key equal to the given <a href="#key">_key_</a>.

<span id="getField">`getField(key: ValueLike): Field | undefined;`</span>

Returns the last Field member of this _Item_ whose key is equal to the
given <a href="#key">_key_</a>; returns _undefined_ if this _Item_ is not a Record, or if this _Item_ is a _Record_, but has no _Field_ member with a <a href="#key">_key_</a> equal to the given <a href="#key">_key_</a>.

<span id="getItem">`getItem(index: NumLike): Item;`</span>

Returns the member of this _Item_ at the given <a href="#index">_index_</a>, if this _Item_ is
a Record, and the <a href="#index">_index_</a> is greater than or equal to zero, and less than the <a href="length">_length_</a> of the _Record_; otherwise returns Absent if this _Item_ is not a _Record_, or if this _Item_ is a _Record_, but the <a href="#index">_index_</a> is out of bounds.

<span id="evaluate">`evaluate(interpreter: InterpreterLike): Item;`</span>

Returns a new _Item_ with all nested expressions interpreted in lexical order and scope.

<span id="stringValue">`stringValue(): string | undefined;`</span>
Converts this _Item_ into a _string_ value, if possible; otherwise returns
_undefined_ if this _Item_ can't be converted into a _string_ value.

<span id="stringValue">`stringValue<T>(orElse: T): string | T;`</span>
Converts this _Item_ into a _string_ value, if possible; otherwise returns
_orElse_ if this _Item_ can't be converted into a _string_ value.

<span id="numberValue">`numberValue(): number | undefined;`</span>
Converts this _Item_ into a _number_ value, if possible; otherwise returns
_undefined_ if this _Item_ can't be converted into a _number_ value.

<span id="numberValue">`numberValue<T>(orElse: T): number | T;`</span>
Converts this _Item_ into a _number_ value, if possible; otherwise returns
_orElse_ if this _Item_ can't be converted into a _number_ value.

<span id="booleanValue">`booleanValue(): boolean | undefined;`</span>
Converts this _Item_ into a _boolean_ value, if possible; otherwise returns
_undefined_ if this _Item_ can't be converted into a _boolean_ value.

<span id="booleanValue">`booleanValue<T>(orElse: T): boolean | T;`</span>
Converts this _Item_ into a _boolean_ value, if possible; otherwise returns
_orElse_ if this _Item_ can't be converted into a _boolean_ value.

<span id="readonly">`readonly typeOrder: number;`</span>
Returns the heterogeneous sort order of this _Item_. Used to impose a
total order on the set of all items. When comparing two items of
different types, the items order according to their _typeOrder_.
