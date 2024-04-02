---
title: Data Model
short-title: Data Model
description: "An overview of the data model contained within the @swim/structure library and why it is used for representing WARP messages."
group: Data
layout: documentation
redirect_from:
---

{% include callout-warning.html title='Version Note' text='This documentation describes Swim JS packages v4.0.0-dev-20230923 or later. Users of earlier package versions may experience differences in behavior.' %}

## Overview

One of the fundamental packages of the Swim JS ecosystem and a dependency of the `@swim/client` library is [**@swim/structure**](https://www.npmjs.com/package/@swim/structure). It contains a set of APIs necessary for reading, parsing, and writing data via WARP links. The "Data" section of the frontend documentation will focus on the classes and tools found within this package and how they enable WARP clients to make sense of the data they're transmitting.

Think of @swim/structure as a generic abstract syntax tree that can represent many structured data models, including parsed JSON, parsed XML, parsed Recon, parsed Protocol Buffers, and more. In addition to structured data models, @swim/structure has generic syntax trees for selector languages, like XPath, JSONPath, and Recon selectors. It also provides generic syntax trees for algebraic, logical, bitwise, and function invocation operators, as well as syntax trees for lambda function definitions. An Interpreter is provided for evaluating selectors, operators, and function invocations.

Parsers from source languages to @swim/structure syntax trees are provided by other packages. The [@swim/recon](https://www.npmjs.com/package/@swim/recon) library implements a parser and serializer for Recon, Recon selectors, and Recon expressions.

## Data Model
The heart of @swim/structure is its uniform structured data model. Swim uses an abstract data model to decouple itself from the irregularities and limitations of common data formats, such as JSON or XML. To illuminate the complexity and limitations this model was designed to solve, let's first consider the data models of JSON and XML.

JSON's data model consists of four primitive types: string, number, boolean, and null; and two composite types: object, and array. Note that because JSON has two distinct composite types, its data model doesn't produce uniform tree structures. JSON also lacks a consistent way to disambiguate polymorphic structures. And JSON's lack of expressiveness leads to frequent use of textual microformats, which require additional parsing steps.

XML's data model consists of one quasi-primitive type: text nodes, which may internally compose out-of-band entity references; and one composite type: element. Note that XML does not produce uniform tree structures either, due to the fact that elements have both child nodes, and associated attributes. And because of its textual nature, XML leads to profuse use of ad hoc string microformats. Rather than natively implementing a structured type system, XML layers on various nominally typed schema languages.

@swim/structure implements a uniform tree data model that is a superset of both the JSON and XML data models. The Swim structured data model has six primitive types: data, text, num, bool, extant, and absent; two field types: attr, and slot; and a single composite type: record.

Having only one composite type allows every compound data structure to be treated as a uniform tree. The record type effectively behaves like a partially-keyed list, enabling it to model both objects and arrays. The attr field type provides a consistent polymorphic disambiguation mechanism, similar to—but more uniform and expressive than—XML tags. The slot field type models object properties as distinct child items that happen to have a key. But unlike JSON object keys, slot keys are not restricted to string values.
