# polybool

Boolean operations on polygons (union, intersection, difference, xor).

# Features

1. Clips polygons for all boolean operations
2. Removes unnecessary vertices
3. Handles segments that are coincident (overlap perfectly, share vertices, one
   inside the other, etc)
4. Uses formulas that take floating point irregularities into account (via
   configurable epsilon)
5. Provides an API for constructing efficient sequences of operations
6. Handles line segments (stable) and bezier cubic curves (experimental)
7. TypeScript implementation

# Resources

* [Demo + Animation](https://unpkg.com/@velipso/polybool@2.0.1/demo/demo.html)
* [Companion Tutorial](https://sean.fun/a/polygon-clipping-pt2)
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

![Example](https://github.com/velipso/polybool/raw/main/example.png)

Using the Simplified Polygonal API:

```typescript
import polybool from '@velipso/polybool';

console.log(polybool.intersect(
  {
    regions: [
      [[50,50], [150,150], [190,50]],
      [[130,50], [290,150], [290,50]]
    ],
    inverted: false
  },
  {
    regions: [
      [[110,20], [110,110], [20,20]],
      [[130,170], [130,20], [260,20], [260,170]]
    ],
    inverted: false
  }
));

// output:
// {
//   regions: [
//     [[50,50], [110,50], [110,110]],
//     [[178,80], [130,50], [130,130], [150,150]],
//     [[178,80], [190,50], [260,50], [260,131.25]]
//   ],
//   inverted: false
// }
```

Using the Polygonal API:

```typescript
import polybool from '@velipso/polybool';

const poly1 = {
  regions: [
    [[50,50], [150,150], [190,50]],
    [[130,50], [290,150], [290,50]]
  ],
  inverted: false
};

const poly2 = {
  regions: [
    [[110,20], [110,110], [20,20]],
    [[130,170], [130,20], [260,20], [260,170]]
  ],
  inverted: false
};

const segs1 = polybool.segments(poly1);
const segs2 = polybool.segments(poly2);
const combined = polybool.combine(segs1, segs2);
const segs3 = polybool.selectIntersect(combined);
const result = polybool.polygon(segs3);

console.log(result);

// output:
// {
//   regions: [
//     [[50,50], [110,50], [110,110]],
//     [[178,80], [130,50], [130,130], [150,150]],
//     [[178,80], [190,50], [260,50], [260,131.25]]
//   ],
//   inverted: false
// }
```

Using the Instructional API:

```typescript
import polybool from '@velipso/polybool';

const shape1 = polybool.shape()
  .beginPath()
  .moveTo(50, 50)
  .lineTo(150, 150)
  .lineTo(190, 50)
  .closePath()
  .beginPath()
  .moveTo(130, 50)
  .lineTo(290, 150)
  .lineTo(290, 50)
  .closePath();

const shape2 = polybool.shape()
  .beginPath()
  .moveTo(110, 20)
  .lineTo(110, 110)
  .lineTo(20, 20)
  .closePath()
  .beginPath()
  .moveTo(130, 170)
  .lineTo(130, 20)
  .lineTo(260, 20)
  .lineTo(260, 170)
  .closePath();

const receiver = {
  beginPath: () => { console.log('beginPath'); },
  moveTo: (x: number, y: number) => { console.log('moveTo', x, y); },
  lineTo: (x: number, y: number) => { console.log('lineTo', x, y); },
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => { console.log('bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y); },
  closePath: () => { console.log('closePath'); }
}

// start with the first shape
shape1
  // combine it with the second shape
  .combine(shape2)
  // perform the operation
  .intersect()
  // output results to the receiver object
  .output(receiver);

// output:
//   beginPath
//   moveTo 110 110
//   lineTo 50 50
//   lineTo 110 50
//   lineTo 110 110
//   closePath
//   beginPath
//   moveTo 150 150
//   lineTo 178 80
//   lineTo 130 50
//   lineTo 130 130
//   lineTo 150 150
//   closePath
//   beginPath
//   moveTo 260 131.25
//   lineTo 178 80
//   lineTo 190 50
//   lineTo 260 50
//   lineTo 260 131.25
//   closePath
```

# API Design

There are three different APIs, each of which use the same underlying algorithms:

1. Simplified Polygonal API
2. Polygonal API
3. Instructional API

The Simplified Polygonal API is implemented on top of the Polygonal API, and the Polygonal API is
implemented on top of the Instructional API.

The reason for multiple APIs is to maintain backwards compatibility and to make it easier to use.

# Simplified Polygonal API

```typescript
import polybool from '@velipso/polybool';

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

Bezier cubic curves are represented as a series of 6 numbers, in the order `cp1x`, `cp1y`, `cp2x`,
`cp2y`, `x`, `y`, but support for curves is still experimental and unstable.

```typescript
// polygon with bezier curve
{
  regions: [
    [[450,150], [200,150,200,60,450,60]]
  ],
  inverted: false
}
```

# Polygonal API

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

Depending on your needs, it might be more efficient to construct your own
sequence of operations using the Polygonal API.  Note that `polybool.union`,
`polybool.intersect`, etc, are just thin wrappers for convenience.

There are three types of objects you will encounter in the Polygonal API:

1. Polygons (discussed above, this is a list of regions and an `inverted` flag)
2. Segments
3. Combined Segments

The basic flow chart of the API is:

![API Flow Chart](https://github.com/velipso/polybool/raw/main/flowchart.png)

You start by converting Polygons to Segments using `polybool.segments(poly)`.

You convert Segments to Combined Segments using `polybool.combine(seg1, seg2)`.

You select the resulting Segments from the Combined Segments using one of the
selection operators `polybool.selectUnion(combined)`,
`polybool.selectIntersect(combined)`, etc.  These selection functions return
Segments.

Once you're done, you convert the Segments back to Polygons using
`polybool.polygon(segments)`.

Each transition is costly, so you want to navigate wisely.  The selection
transition is the least costly.

## Advanced Example 1

Suppose you wanted to union a list of polygons together.  The naive way to do it
would be:

```typescript
// works but not efficient
let result = polygons[0];
for (let i = 1; i < polygons.length; i++)
  result = polybool.union(result, polygons[i]);
return result;
```

Instead, it's more efficient to use the Polygonal API directly, like this:

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

Suppose you want to calculate all operations on two polygons.  The naive way to
do it would be:

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

Instead, it's more efficient to use the Polygonal API directly, like this:

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

As an added bonus, just going from Polygon to Segments and back performs
simplification on the polygon.

Suppose you have garbage polygon data and just want to clean it up.  The naive
way to do it would be:

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

# Instructional API

The Instructional API does not have an intermediate data format (like the Polygon from before), and
does not support an `inverted` flag.

Instead, the Instructional API is modeled after the
[CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
API.

Shapes are created using `beginPath`, `moveTo`, `lineTo`, `bezierCurveTo`, and `closePath`, then
combined together, operated on, and output to a _receiver_.

The receiver is an object with `beginPath`, `moveTo`, `lineTo`, `bezierCurveTo`, and `closePath`
defined, and those methods are called in order to output the result.

```typescript
export interface IPolyBoolReceiver {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void;
  closePath: () => void;
}
```

## Shapes

The first step is to create shapes:

```typescript
const shape = polybool.shape()
  .beginPath()
  .moveTo(50, 50)
  .lineTo(150, 150)
  .lineTo(190, 50)
  .closePath()
  .beginPath()
  .moveTo(130, 50)
  .lineTo(290, 150)
  .lineTo(290, 50)
  .closePath();
```

Note that shapes can have multiple regions by calling `beginPath`/`closePath` more than once.

Shapes can also have bezier curves by calling `bezierCurveTo(...)` as well, but support for curves
is still experimental and unstable.

```typescript
class Shape {
  beginPath(): Shape;
  moveTo(x: number, y: number): Shape;
  lineTo(x: number, y: number): Shape;
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): Shape;
  closePath(): Shape;
  // ...continued below
}
```

## Combining Shapes

Once you have multiple shapes, you can combine them:

```typescript
const combinedShape1 = shape1.combine(shape2);
const combinedShape2 = shape1.combine(shape3);
```

Notice that you can use shapes in multiple operations, but once you use a shape in an operation,
you can't add more lines or curves to it.

```typescript
class Shape {
  // ...continued from above
  combine(shape: Shape): ShapeCombined;
  // ...continued below
}
```

## Performing an Operation

Once you have a combined shape, you can generate new shapes by performing a boolean operation:

```typescript
const intersect = combinedShape1.intersect();
const union = combinedShape1.union();
```

Notice that you can use a combined shape more than once, to produce different boolean operations.

```typescript
class ShapeCombined {
  union(): Shape;
  intersect(): Shape;
  difference(): Shape; // shape1 - shape2
  differenceRev(): Shape; // shape2 - shape1
  xor(): Shape;
}
```

## Outputting Results

_Any_ shape can be output to a _receiver_:

```typescript
shape.output(receiver);
```

Notice that `shape` could be the result of a boolean operation, but it doesn't have to be.

```typescript
class Shape {
  // ...continued from above
  output<T extends IPolyBoolReceiver>(receiver: T): T;
}
```

The `receiver` object is returned.

## Implementing Inversion

If you need to perform logic on inverted shapes like the Polygonal API supports, a key observation
is that you can represent the same result by shuffling around inversion flags and choosing the right
operation.

For example, if you are intersecting two shapes, and the first one is inverted, then that is
equivalent to the `differenceRev` operation.

This is how inversion is supported in the Polygonal API, even though it is built on top of the
Instructional API which does not support inversion.

Please check the source code to see how inversion is calculated. Here is intersection, for example:

```typescript
selectIntersect(combined: CombinedSegments): Segments {
  return {
    shape: combined.inverted1
      ? combined.inverted2
        ? combined.shape.union()
        : combined.shape.differenceRev()
      : combined.inverted2
        ? combined.shape.difference()
        : combined.shape.intersect(),
    inverted: combined.inverted1 && combined.inverted2,
  };
}
```

Essentially, this represents observations like `intersect(~A, ~B) = ~union(A, B)`,
[etc](https://en.wikipedia.org/wiki/De_Morgan's_laws).

## Advanced Example 1

How to union a list of shapes together:

```typescript
let result = shapes[0];
for (let i = 1; i < shapes.length; i++)
  result = result.combine(shapes[i]).union();
result.output(receiver);
```

## Advanced Example 2

How to calculate all operations on two polygons:

```typescript
// works but not efficient
const combined = shape1.combine(shape2);
combined.union().output(receiverUnion);
combined.intersect().output(receiverIntersect);
combined.difference().output(receiverDifference);
combined.differenceRev().output(receiverDifferenceRev);
combined.xor().output(receiverXor);
```

## Advanced Example 3

As an added bonus, you can simplify shapes by outputting them directly.

Suppose you have garbage polygon data and just want to clean it up.  The naive
way to do it would be:

```typescript
// union the polygon with nothing in order to clean up the data
// works but not efficient
shape1.combine(polybool.shape()).union().output(receiver);
```

Instead, skip the combination and operation:

```typescript
// works AND efficient
shape1.output(receiver);
```

# Epsilon

Due to the beauty of floating point reality, floating point calculations are not
exactly perfect. This is a problem when trying to detect whether lines are on
top of each other, or if vertices are exactly the same.

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
import { PolyBool, GeometryEpsilon } from '@velipso/polybool';

const polybool = new PolyBool(new GeometryEpsilon(newEpsilonValue));
```

The default epsilon value is `0.0000000001`.

If your polygons are really really large or really really tiny, then you will
probably have to come up with your own epsilon value -- otherwise, the default
should be fine.

If `PolyBool` detects that your epsilon is too small or too large, it will throw
an error:

```
PolyBool: Zero-length segment detected; your epsilon is probably too small or too large
```
