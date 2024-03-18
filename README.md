# polybool

Boolean operations on polygons (union, intersection, difference, xor).

NOTE: This is a port of my [polybooljs](https://github.com/velipso/polybooljs) to TypeScript.
It still needs testing!

# Features

1. Clips polygons for all boolean operations
2. Removes unnecessary vertices
3. Handles segments that are coincident (overlap perfectly, share vertices, one inside the other,
   etc)
4. Uses formulas that take floating point irregularities into account (via configurable epsilon)
5. Provides an API for constructing efficient sequences of operations

# Resources

* [Companion Tutorial](https://sean.cm/a/polygon-clipping-pt2)
* Based somewhat on the F. Martinez (2008) algorithm:
  [Paper](http://www.cs.ucr.edu/~vbz/cs230papers/martinez_boolean.pdf),
  [Code](https://github.com/akavel/martinez-src)

### Ports

Other kind souls have ported this library:

* [Java port by @the3deers](https://github.com/the3deers/polybool-java)
* [Java port by @Menecats](https://github.com/Menecats/polybool-java)
* [.NET port by @idormenco](https://github.com/idormenco/PolyBool.Net)
* [Flutter/Dart port by @mohammedX6](https://github.com/mohammedX6/poly_bool_dart)
* [Python port by @KaivnD](https://github.com/KaivnD/pypolybool)
* Please make a ticket if you'd like to be added here :-)

# Installing

`npm install @velipso/polybool`

Or, for the browser, look in the [`dist/`](https://github.com/velipso/polybool/tree/main/dist)
directory for a single file build.

# Example

```typescript
import polybool from 'polybool';

polybool.intersect({
    regions: [
      [[50,50], [150,150], [190,50]],
      [[130,50], [290,150], [290,50]]
    ],
    inverted: false
  }, {
    regions: [
      [[110,20], [110,110], [20,20]],
      [[130,170], [130,20], [260,20], [260,170]]
    ],
    inverted: false
  });
===> {
  regions: [
    [[50,50], [110,50], [110,110]],
    [[178,80], [130,50], [130,130], [150,150]],
    [[178,80], [190,50], [260,50], [260,131.25]]
  ],
  inverted: false
}
```

![Example](https://github.com/velipso/polybool/raw/master/example.png)

## Basic Usage

```typescript
import polybool from 'polybool';

const poly = polybool.union(poly1, poly2);
const poly = polybool.intersect(poly1, poly2);
const poly = polybool.difference(poly1, poly2); // poly1 - poly2
const poly = polybool.differenceRev(poly1, poly2); // poly2 - poly1
const poly = polybool.xor(poly1, poly2);
```

Where `poly1`, `poly2`, and the return value are Polygon objects, in the format of:

```typescript
// polygon format
{
  regions: [ // list of regions
    // each region is a list of points
    [[50,50], [150,150], [190,50]],
    [[130,50], [290,150], [290,50]]
  ],
  inverted: false // is this polygon inverted?
}
```

# Core API

```typescript
const segments = polybool.segments(polygon);
const combined = polybool.combine(segments1, segments2);
const segments = polybool.selectUnion(combined);
const segments = polybool.selectIntersect(combined);
const segments = polybool.selectDifference(combined);
const segments = polybool.selectDifferenceRev(combined);
const segments = polybool.selectXor(combined);
const polygon  = polybool.polygon(segments);
```

Depending on your needs, it might be more efficient to construct your own sequence of operations
using the lower-level API.  Note that `polybool.union`, `polybool.intersect`, etc, are just thin
wrappers for convenience.

There are three types of objects you will encounter in the core API:

1. Polygons (discussed above, this is a list of regions and an `inverted` flag)
2. Segments
3. Combined Segments

The basic flow chart of the API is:

![API Flow Chart](https://github.com/velipso/polybool/raw/master/flowchart.png)

You start by converting Polygons to Segments using `polybool.segments(poly)`.

You convert Segments to Combined Segments using `polybool.combine(seg1, seg2)`.

You select the resulting Segments from the Combined Segments using one of the selection operators
`polybool.selectUnion(combined)`, `polybool.selectIntersect(combined)`, etc.  These selection
functions return Segments.

Once you're done, you convert the Segments back to Polygons using `polybool.polygon(segments)`.

Each transition is costly, so you want to navigate wisely.  The selection transition is the least
costly.

## Advanced Example 1

Suppose you wanted to union a list of polygons together.  The naive way to do it would be:

```typescript
// works but not efficient
let result = polygons[0];
for (let i = 1; i < polygons.length; i++)
  result = polybool.union(result, polygons[i]);
return result;
```

Instead, it's more efficient to use the core API directly, like this:

```typescript
// works AND efficient
let segments = polybool.segments(polygons[0]);
for (let i = 1; i < polygons.length; i++){
  const seg2 = polybool.segments(polygons[i]);
  const comb = polybool.combine(segments, seg2);
  segments = polybool.selectUnion(comb);
}
return polybool.polygon(segments);
```

## Advanced Example 2

Suppose you want to calculate all operations on two polygons.  The naive way to do it would be:

```typescript
// works but not efficient
return {
  union: polybool.union(poly1, poly2),
  intersect: polybool.intersect(poly1, poly2),
  difference: polybool.difference(poly1, poly2),
  differenceRev: polybool.differenceRev(poly1, poly2),
  xor: polybool.xor(poly1, poly2)
};
```

Instead, it's more efficient to use the core API directly, like this:

```typescript
// works AND efficient
const seg1 = polybool.segments(poly1);
const seg2 = polybool.segments(poly2);
const comb = polybool.combine(seg1, seg2);
return {
  union: polybool.polygon(polybool.selectUnion(comb)),
  intersect: polybool.polygon(polybool.selectIntersect(comb)),
  difference: polybool.polygon(polybool.selectDifference(comb)),
  differenceRev: polybool.polygon(polybool.selectDifferenceRev(comb)),
  xor: polybool.polygon(polybool.selectXor(comb))
};
```

## Advanced Example 3

As an added bonus, just going from Polygon to Segments and back performs simplification on the
polygon.

Suppose you have garbage polygon data and just want to clean it up.  The naive way to do it would
be:

```typescript
// union the polygon with nothing in order to clean up the data
// works but not efficient
const cleaned = polybool.union(polygon, { regions: [], inverted: false });
```

Instead, skip the combination and selection phase:

```typescript
// works AND efficient
const cleaned = polybool.polygon(polybool.segments(polygon));
```

# Epsilon

Due to the beauty of floating point reality, floating point calculations are not exactly perfect.
This is a problem when trying to detect whether lines are on top of each other, or if vertices are
exactly the same.

Normally you would expect this to work:

```javascript
if (A === B)
  /* A and B are equal */;
else
  /* A and B are not equal */;
```

But for inexact floating point math, instead we use:

```javascript
if (Math.abs(A - B) < epsilon)
  /* A and B are equal */;
else
  /* A and B are not equal */;
```

You can set the epsilon value using:

```typescript
import { PolyBool, GeometryEpsilon } from 'polybool';

const polybool = new PolyBool(new GeometryEpsilon(newEpsilonValue));
```

The default epsilon value is `0.0000000001`.

If your polygons are really really large or really really tiny, then you will probably have to come
up with your own epsilon value -- otherwise, the default should be fine.

If `PolyBool` detects that your epsilon is too small or too large, it will throw an error:

```
PolyBool: Zero-length segment detected; your epsilon is probably too small or too large
```
