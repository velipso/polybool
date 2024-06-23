//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

export type Point = [number, number];

export enum AlongIntersection {
  BeforeStart,
  EqualStart,
  BetweenStartAndEnd,
  EqualEnd,
  AfterEnd,
}

export interface IntersectionResult {
  p: Point; // intersection point
  alongA: AlongIntersection; // where this point is along the A line
  alongB: AlongIntersection; // where this point is along the B line
}

export abstract class Geometry {
  abstract pointAboveOrOnLine(p: Point, left: Point, right: Point): boolean;
  abstract pointBetween(p: Point, left: Point, right: Point): boolean;
  abstract pointsSameX(p1: Point, p2: Point): boolean;
  abstract pointsSameY(p1: Point, p2: Point): boolean;
  abstract pointsCollinear(p1: Point, p2: Point, p3: Point): boolean;
  abstract linesIntersect(
    aStart: Point,
    aEnd: Point,
    bStart: Point,
    bEnd: Point,
  ): IntersectionResult | null;

  pointsSame(p1: Point, p2: Point) {
    return this.pointsSameX(p1, p2) && this.pointsSameY(p1, p2);
  }

  pointsCompare(p1: Point, p2: Point) {
    // returns -1 if p1 is smaller, 1 if p2 is smaller, 0 if equal
    if (this.pointsSameX(p1, p2)) {
      return this.pointsSameY(p1, p2) ? 0 : p1[1] < p2[1] ? -1 : 1;
    }
    return p1[0] < p2[0] ? -1 : 1;
  }
}

export class GeometryEpsilon extends Geometry {
  private readonly epsilon: number;

  constructor(epsilon = 0.0000000001) {
    super();
    this.epsilon = epsilon;
  }

  pointAboveOrOnLine(p: Point, left: Point, right: Point) {
    const Ax = left[0];
    const Ay = left[1];
    const Bx = right[0];
    const By = right[1];
    const Cx = p[0];
    const Cy = p[1];
    return (Bx - Ax) * (Cy - Ay) - (By - Ay) * (Cx - Ax) >= -this.epsilon;
  }

  pointBetween(p: Point, left: Point, right: Point) {
    // p must be collinear with left->right
    // returns false if p == left, p == right, or left == right
    const d_py_ly = p[1] - left[1];
    const d_rx_lx = right[0] - left[0];
    const d_px_lx = p[0] - left[0];
    const d_ry_ly = right[1] - left[1];

    const dot = d_px_lx * d_rx_lx + d_py_ly * d_ry_ly;
    // if `dot` is 0, then `p` == `left` or `left` == `right` (reject)
    // if `dot` is less than 0, then `p` is to the left of `left` (reject)
    if (dot < this.epsilon) {
      return false;
    }

    const sqlen = d_rx_lx * d_rx_lx + d_ry_ly * d_ry_ly;
    // if `dot` > `sqlen`, then `p` is to the right of `right` (reject)
    // therefore, if `dot - sqlen` is greater than 0, then `p` is to the right
    // of `right` (reject)
    if (dot - sqlen > -this.epsilon) {
      return false;
    }

    return true;
  }

  pointsSameX(p1: Point, p2: Point) {
    return Math.abs(p1[0] - p2[0]) < this.epsilon;
  }

  pointsSameY(p1: Point, p2: Point) {
    return Math.abs(p1[1] - p2[1]) < this.epsilon;
  }

  pointsCollinear(p1: Point, p2: Point, p3: Point) {
    // does pt1->pt2->pt3 make a straight line?
    // essentially this is just checking to see if
    //   slope(pt1->pt2) === slope(pt2->pt3)
    // if slopes are equal, then they must be collinear, because they share pt2
    const dx1 = p1[0] - p2[0];
    const dy1 = p1[1] - p2[1];
    const dx2 = p2[0] - p3[0];
    const dy2 = p2[1] - p3[1];
    return Math.abs(dx1 * dy2 - dx2 * dy1) < this.epsilon;
  }

  linesIntersect(aStart: Point, aEnd: Point, bStart: Point, bEnd: Point) {
    // returns null if the lines are coincident (e.g., parallel or on top of
    // each other)
    //
    // returns an object if the lines intersect:
    //   {
    //     p: [x, y],    where the intersection point is at
    //     alongA: where intersection point is along A,
    //     alongB: where intersection point is along B
    //   }
    //
    // alongA and alongB will each be one of AlongIntersection, depending on
    // where the intersection point is along the A and B lines
    //
    const adx = aEnd[0] - aStart[0];
    const ady = aEnd[1] - aStart[1];
    const bdx = bEnd[0] - bStart[0];
    const bdy = bEnd[1] - bStart[1];

    const axb = adx * bdy - ady * bdx;
    if (Math.abs(axb) < this.epsilon) {
      return null; // lines are coincident
    }

    const dx = aStart[0] - bStart[0];
    const dy = aStart[1] - bStart[1];

    const A = (bdx * dy - bdy * dx) / axb;
    const B = (adx * dy - ady * dx) / axb;

    // categorizes where along the line the intersection point is at
    const categorize = (v: number): AlongIntersection =>
      v <= -this.epsilon
        ? AlongIntersection.BeforeStart
        : v < this.epsilon
          ? AlongIntersection.EqualStart
          : v - 1 <= -this.epsilon
            ? AlongIntersection.BetweenStartAndEnd
            : v - 1 < this.epsilon
              ? AlongIntersection.EqualEnd
              : AlongIntersection.AfterEnd;

    const p: Point = [aStart[0] + A * adx, aStart[1] + A * ady];
    return {
      alongA: categorize(A),
      alongB: categorize(B),
      p,
    };
  }
}
