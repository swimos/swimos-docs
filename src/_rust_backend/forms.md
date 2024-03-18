---
title: Forms
short-title: Forms
description: "Parametrize your lanes with and links with custom types."
group: Reference
layout: documentation
cookbook: https://github.com/swimos/cookbook/tree/master/forms
redirect_from:
  - /rust/tutorials/forms/
  - /rust/reference/forms.html
---

Recall that internally, as in all previous "... Lanes" cookbooks to date, `swim.structure.Value` is the type of every lane, regardless of its parametrized type.

More formally, any type -- even a custom type -- can serve as a type within a lane. The only requirement is to define a transformation for that type from Java's built-in [nominal type system](https://en.wikipedia.org/wiki/Nominal_type_system) to Swim's `swim.structure.Value`-defined [structural type system](https://en.wikipedia.org/wiki/Structural_type_system).

This offers a handful of advantages, primarily that `swim.structure.Value` types have general, well-defined serializations to Recon (this also applies to JSON, XML, and more, though that is less pertinent to this guide).

In essence, this means that clients can connect to Lanes directly, and authors of Web Agents don't have to worry about explicit (de)serializations in the server-side code.

### Transforming Values

An instance of `swim.structure.Form<T>` handles transformations between `Value` and `T`.

When declaring a lane parametrized with a type `T`, the Swim core **always** uses some `Form<T>` to manage conversions under the hood.

Several methods implemented in the `BarType` class handle these transformations manually.

#### Types of Forms

The `swim.structure.form` package contains many out-of-the-box Forms already for a variety of common [types](https://github.com/swimos/swim/tree/main/swim-java/swim-runtime/swim-core/swim.structure/src/main/java/swim/structure/form), such as LongForm, CharacterForm, and StringForm. This is why one can declare, for example, a `MapLane<String, Long>` that works without any additional effort.

For other types (e.g. custom pojos), you need to implement your own Form for that type, and tag the static accessor with @Kind.

There are two methods to achieve this: the "no-magic" (explicit) way exercised in `Bartype` and through annotations as exercised in `FooType`.

#### The BarType Class

There are several methods responsible for handling transformations between `Value` types and a custom Java object such as `BarType`:

##### **- mold()**

The `mold()` method is used to convert the fields of some custom object into a Swim structure of type `Value`.

```java
// swim/basic/BarType.java
@Override
public Value mold(BarType barType) {
  return Record.create(3)
    .attr(tag())
    .slot("i", barType.getNumber1())
    .slot("s", barType.getString())
    .slot("j", barType.getNumber2());
}
```

##### **- cast()**

The `cast()` method is responsible for the inverse operation, parsing a `Value` into a Java object of the class type, e.g. `BarType`

```java
// swim/basic/BarType.java
@Override
public BarType cast(Item value) {
  try {
    final Attr attr = (Attr) value.head();
    final String barType = attr.getKey().stringValue("");
    if (!tag().equals(barType)) {
      return null;
    }
    BarType b = new BarType(value.get("i").intValue(0),
      value.get("s").stringValue(""),
      value.get("j").intValue(0));
    return b;
  } catch (Exception e) {
    return null;
  }
}
```

##### **- tag()**

By default, the `Attr` associated with a Form, such as that in `Record.create(3).attr("fooType").slot("i", 5).slot("s", "potato");`, defaults to a camelCase string of the class name. The `tag()` method can be used to explicitly set a unique id for objects of a pojo.

```java
// swim/basic/BarType.java
class BarTypeForm extends Form<BarType> {
  @Override
  public String tag() {
      return "barType";
  }
}
```

##### **- type()**

The `type()` method is used to return the type of an object in the form of its defined class.

```java
@Override
public Class<?> type() {
    return BarType.class;
}
```

#### The FooType Class

The FooType class in this project sets out a method of streamlining the process of defining a custom Form through more succinct annotations.

##### **- @Kind**

The `@Kind` annotation is used to tag a static accessor method for a custom Form.

```java
// swim/basic/FooType.java
@Kind
private static Form<FooType> form;
```

##### **- @Tag**

A shorthand way of overriding the default classname `Attr` picked up by the reflection api.

```java
// swim/basic/FooType.java
@Tag("fooType")
```

##### **- @Member**

By default, the variable name of a class member will get picked up as the default attribute. However, as in `@Tag`, this string can be overriden using the `@Member` annotation.

This is by no means required, though when used `@Member` will change the attribute used in Recon serialization. This can prove helpful in Forms when one wishes to use shorthand value names internally but more explicit names in serialization (or vise versa).

```java
// swim/basic/FooType.java
public class FooType {
  @Member("i")
  private int i = 0;
  @Member("s")
  private String s = "";
  ...
```

**As an exercise, imagine what would need to happen to achieve the same thing in BarType.java**

##### **- form()**

The `form()` method is used to simply return the form. In this example, it is best practice to check whether the form does not exist before returning, due to potentially JVM-dependent class-loading behavior.

```java
// swim/basic/FooType.java
public static Form<FooType> form() {
    if(form == null) {
      form = Form.forClass(FooType.class);
    }
    return form;
}
```

### Advanced Topic: Composability

Consider the problem of creating Forms for some type `TrickyType`, whose fields are other pojos that each have their own Forms.

To manually build a Form for this type by explictly implementing some `Form<TrickyType>` (e.g. like what was done with `BarType`), we can expect a clean implementation to call the other Forms' `mold()` and `cast()` methods, following a fairly predictable pattern.

Because it's so predictable, the annotation style Form generation can still be used, provided that these field pojos themselves have properly staged `Forms`. This is exercised via `BazType` in the companion app.

```java
// swim/basic/BazType.java
@Tag("bazType")
public class BazType {
  private FooType f = new FooType();
  private BarType b = new BarType();
  public BazType(FooType f, BarType b) {
    this.f = f;
    this.b = b;
  }
  ...
}
```

This clean composability also enables some of the more complicated forms that were [linked](https://github.com/swimos/swim/tree/main/swim-java/swim-runtime/swim-core/swim.structure/src/main/java/swim/structure/form) earlier. For example, one can get a working `Form<List<FooType>` handle by simply doing `Form<List<FooType> = Form.forList(FooType.form())` (see [here](https://github.com/swimos/swim/blob/main/swim-java/swim-runtime/swim-core/swim.structure/src/main/java/swim/structure/Form.java#L221-L246){:data-proofer-ignore=''}). Even something like a `Form<List<List<BazType>` could be created similarly!

### Try It Yourself

A standalone project that demonstrates each method of defining a Form for a custom Java class can be found [here](https://github.com/swimos/cookbook/tree/master/forms).
