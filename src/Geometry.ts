//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

export type Vec2 = [number, number];
export type Vec6 = [number, number, number, number, number, number];

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

export function boundingBoxesIntersect(
  bbox1: [Vec2, Vec2],
  bbox2: [Vec2, Vec2],
) {
  const [b1min, b1max] = bbox1;
  const [b2min, b2max] = bbox2;
  return !(
    b1min[0] > b2max[0] ||
    b1max[0] < b2min[0] ||
    b1min[1] > b2max[1] ||
    b1max[1] < b2min[1]
  );
}

export abstract class Geometry {
  abstract snap0(v: number): number;
  abstract snap01(v: number): number;
  abstract atan2deg(dy: number, dx: number): number; // returns 0-360
  abstract isCollinear(p1: Vec2, p2: Vec2, p3: Vec2): boolean;
  abstract solveCubic(a: number, b: number, c: number, d: number): number[];
  abstract isEqualVec2(a: Vec2, b: Vec2): boolean;
  abstract compareVec2(a: Vec2, b: Vec2): number;
}

export class GeometryEpsilon extends Geometry {
  private readonly epsilon: number;

  constructor(epsilon = 0.0000000001) {
    super();
    this.epsilon = epsilon;
  }

  snap0(v: number) {
    if (Math.abs(v) < this.epsilon) {
      return 0;
    }
    return v;
  }

  snap01(v: number) {
    if (Math.abs(v) < this.epsilon) {
      return 0;
    }
    if (Math.abs(1 - v) < this.epsilon) {
      return 1;
    }
    return v;
  }

  atan2deg(dy: number, dx: number) {
    if (Math.abs(dy) < this.epsilon) {
      return dx > 0 || Math.abs(dx) < this.epsilon ? 0 : 180;
    } else if (Math.abs(dx) < this.epsilon) {
      return dy < 0 ? 270 : 90;
    } else if (Math.abs(dx - dy) < this.epsilon) {
      return dx < 0 ? 225 : 45;
    } else if (Math.abs(dx + dy) < this.epsilon) {
      return dx < 0 ? 315 : 135;
    }
    return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  }

  isCollinear(p1: Vec2, p2: Vec2, p3: Vec2) {
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

  solveCubic(a: number, b: number, c: number, d: number) {
    const b2 = 2 * b;
    const asq = a * a;
    const acb = asq * a;

    if (Math.abs(acb) < this.epsilon) {
      // quadratic
      if (Math.abs(b) < this.epsilon) {
        // linear
        if (Math.abs(c) < this.epsilon) {
          // horizontal line
          if (Math.abs(d) < this.epsilon) {
            // horizontal line at 0
            return [0];
          }
          return [];
        }
        return [-d / c];
      }
      let D = c * c - 4 * b * d;
      if (Math.abs(D) < this.epsilon) {
        return [-c / b2];
      } else if (D > 0) {
        D = Math.sqrt(D);
        return b2 < 0
          ? [(-c + D) / b2, (-c - D) / b2]
          : [(-c - D) / b2, (-c + D) / b2];
      }
      return [];
    }

    // convert to depressed cubic
    const bsq = b * b;
    let p = (3 * a * c - bsq) / (3 * asq);
    const q = (bsq * b2 - 9 * a * b * c + 27 * asq * d) / (27 * acb);
    const revert = -b / (3 * a);

    if (Math.abs(p) < this.epsilon) {
      return [revert + Math.cbrt(-q)];
    }
    if (Math.abs(q) < this.epsilon) {
      if (p < 0) {
        p = Math.sqrt(-p);
        return [revert - p, revert, revert + p];
      }
      return [revert];
    }

    const D = (q * q) / 4 + (p * p * p) / 27;
    if (Math.abs(D) < this.epsilon) {
      const qop = q / p;
      return qop < 0
        ? [revert + 3 * qop, revert - 1.5 * qop]
        : [revert - 1.5 * qop, revert + 3 * qop];
    }
    if (D > 0) {
      const u = Math.cbrt(-q / 2 - Math.sqrt(D));
      return [revert + u - p / (3 * u)];
    }

    const u = 2 * Math.sqrt(-p / 3);
    const t = Math.acos((3 * q) / p / u) / 3;
    const k = (2 * Math.PI) / 3;
    return [
      revert + u * Math.cos(t - 2 * k),
      revert + u * Math.cos(t - k),
      revert + u * Math.cos(t),
    ];
  }

  isEqualVec2(a: Vec2, b: Vec2) {
    return (
      Math.abs(a[0] - b[0]) < this.epsilon &&
      Math.abs(a[1] - b[1]) < this.epsilon
    );
  }

  compareVec2(a: Vec2, b: Vec2) {
    // returns -1 if a is smaller, 1 if b is smaller, 0 if equal
    if (Math.abs(b[0] - a[0]) < this.epsilon) {
      return Math.abs(b[1] - a[1]) < this.epsilon ? 0 : a[1] < b[1] ? -1 : 1;
    }
    return a[0] < b[0] ? -1 : 1;
  }
}
