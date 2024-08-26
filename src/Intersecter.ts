//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Vec2, type Geometry } from "./Geometry";
import type BuildLog from "./BuildLog";
import {
  type Segment,
  SegmentLine,
  SegmentCurve,
  segmentsIntersect,
} from "./Segment";

export interface SegmentBoolFill {
  above: boolean | null;
  below: boolean | null;
}

export interface ListBoolTransition<T> {
  before: T | null;
  after: T | null;
  insert: (node: T) => T;
}

export class SegmentBoolBase<T> {
  id: number;
  data: T;
  myFill: SegmentBoolFill;
  otherFill: SegmentBoolFill | null = null;

  constructor(
    data: T,
    fill: SegmentBoolFill | null = null,
    log: BuildLog | null = null,
  ) {
    this.id = log?.segmentId() ?? -1;
    this.data = data;
    this.myFill = {
      above: fill?.above ?? null,
      below: fill?.below ?? null,
    };
  }
}

export class SegmentBoolLine extends SegmentBoolBase<SegmentLine> {}
export class SegmentBoolCurve extends SegmentBoolBase<SegmentCurve> {}

export type SegmentBool = SegmentBoolLine | SegmentBoolCurve;

export function copySegmentBool(
  seg: SegmentBool,
  log: BuildLog | null,
): SegmentBool {
  if (seg instanceof SegmentBoolLine) {
    return new SegmentBoolLine(seg.data, seg.myFill, log);
  } else if (seg instanceof SegmentBoolCurve) {
    return new SegmentBoolCurve(seg.data, seg.myFill, log);
  }
  throw new Error("PolyBool: Unknown SegmentBool in copySegmentBool");
}

export class EventBool {
  isStart: boolean;
  p: Vec2;
  seg: SegmentBool;
  primary: boolean;
  other!: EventBool;
  status: EventBool | null = null;

  constructor(isStart: boolean, p: Vec2, seg: SegmentBool, primary: boolean) {
    this.isStart = isStart;
    this.p = p;
    this.seg = seg;
    this.primary = primary;
  }
}

export class ListBool<T> {
  readonly nodes: T[] = [];

  remove(node: T) {
    const i = this.nodes.indexOf(node);
    if (i >= 0) {
      this.nodes.splice(i, 1);
    }
  }

  getIndex(node: T) {
    return this.nodes.indexOf(node);
  }

  isEmpty() {
    return this.nodes.length <= 0;
  }

  getHead() {
    return this.nodes[0];
  }

  removeHead() {
    this.nodes.shift();
  }

  insertBefore(node: T, check: (node: T) => number) {
    this.findTransition(node, check).insert(node);
  }

  findTransition(node: T, check: (node: T) => number): ListBoolTransition<T> {
    // bisect to find the transition point
    const compare = (a: T, b: T) => check(b) - check(a);
    let i = 0;
    let high = this.nodes.length;
    while (i < high) {
      const mid = (i + high) >> 1;
      if (compare(this.nodes[mid], node) > 0) {
        high = mid;
      } else {
        i = mid + 1;
      }
    }
    return {
      before: i <= 0 ? null : this.nodes[i - 1] ?? null,
      after: this.nodes[i] ?? null,
      insert: (node: T) => {
        this.nodes.splice(i, 0, node);
        return node;
      },
    };
  }
}

export class Intersecter {
  private readonly selfIntersection: boolean;
  private readonly geo: Geometry;
  private readonly events = new ListBool<EventBool>();
  private readonly status = new ListBool<EventBool>();
  private readonly log: BuildLog | null;

  constructor(
    selfIntersection: boolean,
    geo: Geometry,
    log: BuildLog | null = null,
  ) {
    this.selfIntersection = selfIntersection;
    this.geo = geo;
    this.log = log;
  }

  compareEvents(
    aStart: boolean,
    a1: Vec2,
    a2: Vec2,
    aSeg: Segment,
    bStart: boolean,
    b1: Vec2,
    b2: Vec2,
    bSeg: Segment,
  ): number {
    // compare the selected points first
    const comp = this.geo.compareVec2(a1, b1);
    if (comp !== 0) {
      return comp;
    }
    // the selected points are the same

    if (
      aSeg instanceof SegmentLine &&
      bSeg instanceof SegmentLine &&
      this.geo.isEqualVec2(a2, b2)
    ) {
      // if the non-selected points are the same too...
      return 0; // then the segments are equal
    }

    if (aStart !== bStart) {
      // if one is a start and the other isn't...
      return aStart ? 1 : -1; // favor the one that isn't the start
    }

    return this.compareSegments(bSeg, aSeg);
  }

  addEvent(ev: EventBool) {
    this.events.insertBefore(ev, (here: EventBool) => {
      if (here === ev) {
        return 0;
      }
      return this.compareEvents(
        ev.isStart,
        ev.p,
        ev.other.p,
        ev.seg.data,
        here.isStart,
        here.p,
        here.other.p,
        here.seg.data,
      );
    });
  }

  divideEvent(ev: EventBool, t: number, p: Vec2) {
    this.log?.segmentDivide(ev.seg, p);

    const [left, right] = ev.seg.data.split([t]) as [Segment, Segment];

    // set the *exact* intersection point
    left.setEnd(p);
    right.setStart(p);

    const ns =
      right instanceof SegmentLine
        ? new SegmentBoolLine(right, ev.seg.myFill, this.log)
        : right instanceof SegmentCurve
          ? new SegmentBoolCurve(right, ev.seg.myFill, this.log)
          : null;
    if (!ns) {
      throw new Error("PolyBool: Unknown segment data in divideEvent");
    }
    // slides an end backwards
    //   (start)------------(end)    to:
    //   (start)---(end)
    this.events.remove(ev.other);
    ev.seg.data = left;
    this.log?.segmentChop(ev.seg);
    ev.other.p = p;
    this.addEvent(ev.other);
    return this.addSegment(ns, ev.primary);
  }

  addSegment(seg: SegmentBool, primary: boolean) {
    const evStart = new EventBool(true, seg.data.start(), seg, primary);
    const evEnd = new EventBool(false, seg.data.end(), seg, primary);
    evStart.other = evEnd;
    evEnd.other = evStart;
    this.addEvent(evStart);
    this.addEvent(evEnd);
    return evStart;
  }

  addLine(from: Vec2, to: Vec2, primary = true) {
    const f = this.geo.compareVec2(from, to);
    if (f === 0) {
      // points are equal, so we have a zero-length segment
      return; // skip it
    }
    this.addSegment(
      new SegmentBoolLine(
        new SegmentLine(f < 0 ? from : to, f < 0 ? to : from, this.geo),
        null,
        this.log,
      ),
      primary,
    );
  }

  addCurve(from: Vec2, c1: Vec2, c2: Vec2, to: Vec2, primary = true) {
    const original = new SegmentCurve(from, c1, c2, to, this.geo);
    const curves = original.split(original.inflectionTValues());
    for (const curve of curves) {
      const f = this.geo.compareVec2(curve.start(), curve.end());
      if (f === 0) {
        // points are equal AFTER splitting... this only happens for zero-length segments
        continue; // skip it
      }
      // convert horizontal/vertical curves to lines
      const line = curve.toLine();
      if (line) {
        this.addLine(line.p0, line.p1, primary);
      } else {
        this.addSegment(
          new SegmentBoolCurve(f < 0 ? curve : curve.reverse(), null, this.log),
          primary,
        );
      }
    }
  }

  addRegion(region: Vec2[]) {
    // regions are a list of points:
    //  [ [0, 0], [100, 0], [50, 100] ]
    // you can add multiple regions before running calculate
    // regions are a list of points:
    //  [ [0, 0], [100, 0], [50, 100] ]
    // you can add multiple regions before running calculate
    let p1: Vec2;
    let p2 = region[region.length - 1];
    for (let i = 0; i < region.length; i++) {
      p1 = p2;
      p2 = region[i];
      const f = this.geo.compareVec2(p1, p2);
      if (f === 0) {
        // points are equal, so we have a zero-length segment
        continue; // skip it
      }
      this.addSegment(
        new SegmentBoolLine(
          new SegmentLine(f < 0 ? p1 : p2, f < 0 ? p2 : p1, this.geo),
          null,
          this.log,
        ),
        true,
      );
    }
  }

  compareSegments(seg1: Segment, seg2: Segment): number {
    // TODO:
    //  This is where some of the curve instability comes from... we need to reliably sort
    //  segments, but this is surprisingly hard when it comes to curves.
    //
    //  The easy case is something like:
    //
    //             C   A - - - D
    //               \
    //                 \
    //                   B
    //  A is clearly above line C-B, which is easily calculated... however, once curves are
    //  introduced, it's not so obvious without using some heuristic which will fail at times.
    //
    let A = seg1.start();
    let B = seg2.start2();
    const C = seg2.start();
    if (seg2.pointOn(A)) {
      // A intersects seg2 somehow (possibly sharing a start point, or maybe just splitting it)
      //
      //   AC - - - - D
      //      \
      //        \
      //          B
      //
      // so grab seg1's second point (D) instead
      A = seg1.start2();
      if (
        seg1 instanceof SegmentLine &&
        seg2 instanceof SegmentLine &&
        seg2.pointOn(A)
      ) {
        // oh... D is on the line too... so these are the same
        return 0;
      }
      if (seg2 instanceof SegmentCurve) {
        if (
          this.geo.snap0(A[0] - C[0]) === 0 &&
          this.geo.snap0(B[0] - C[0]) === 0
        ) {
          // seg2 is a curve, but the tangent line (C-B) at the start point is vertical, and
          // collinear with A... so... just sort based on the Y values I guess?
          return Math.sign(C[1] - A[1]);
        }
      }
    } else {
      if (seg2 instanceof SegmentCurve) {
        // find seg2's position at A[0] and see if it's above or below A[1]
        const y = seg2.mapXtoY(A[0]);
        if (y !== false) {
          return Math.sign(y - A[1]);
        }
      }
      if (seg1 instanceof SegmentCurve) {
        // unfortunately, in order to sort against curved segments, we need to check the
        // intersection point... this means a lot more intersection tests, but I'm not sure how else
        // to sort correctly
        const i = segmentsIntersect(seg1, seg2, true);
        if (i && i.kind === "tValuePairs") {
          // find the intersection point on seg1
          for (const pair of i.tValuePairs) {
            const t = this.geo.snap01(pair[0]);
            if (t > 0 && t < 1) {
              B = seg1.point(t);
              break;
            }
          }
        }
      }
    }

    // fallthrough to this calculation which determines if A is on one side or another of C-B
    const [Ax, Ay] = A;
    const [Bx, By] = B;
    const [Cx, Cy] = C;
    return Math.sign((Bx - Ax) * (Cy - Ay) - (By - Ay) * (Cx - Ax));
  }

  statusFindSurrounding(ev: EventBool) {
    return this.status.findTransition(ev, (here: EventBool) => {
      if (ev === here) {
        return 0;
      }
      const c = this.compareSegments(ev.seg.data, here.seg.data);
      return c === 0 ? -1 : c;
    });
  }

  checkIntersection(ev1: EventBool, ev2: EventBool): EventBool | null {
    // returns the segment equal to ev1, or null if nothing equal
    const seg1 = ev1.seg;
    const seg2 = ev2.seg;

    this.log?.checkIntersection(seg1, seg2);

    const i = segmentsIntersect(seg1.data, seg2.data, false);

    if (i === null) {
      // no intersections
      return null;
    } else if (i.kind === "tRangePairs") {
      // segments are parallel or coincident
      const {
        tStart: [tA1, tB1],
        tEnd: [tA2, tB2],
      } = i;

      if (
        (tA1 === 1 && tA2 === 1 && tB1 === 0 && tB2 === 0) ||
        (tA1 === 0 && tA2 === 0 && tB1 === 1 && tB2 === 1)
      ) {
        return null; // segments touch at endpoints... no intersection
      }

      if (tA1 === 0 && tA2 === 1 && tB1 === 0 && tB2 === 1) {
        return ev2; // segments are exactly equal
      }

      const a1 = seg1.data.start();
      const a2 = seg1.data.end();
      const b2 = seg2.data.end();

      if (tA1 === 0 && tB1 === 0) {
        if (tA2 === 1) {
          //  (a1)---(a2)
          //  (b1)----------(b2)
          this.divideEvent(ev2, tB2, a2);
        } else {
          //  (a1)----------(a2)
          //  (b1)---(b2)
          this.divideEvent(ev1, tA2, b2);
        }
        return ev2;
      } else if (tB1 > 0 && tB1 < 1) {
        if (tA2 === 1 && tB2 === 1) {
          //         (a1)---(a2)
          //  (b1)----------(b2)
          this.divideEvent(ev2, tB1, a1);
        } else {
          // make a2 equal to b2
          if (tA2 === 1) {
            //         (a1)---(a2)
            //  (b1)-----------------(b2)
            this.divideEvent(ev2, tB2, a2);
          } else {
            //         (a1)----------(a2)
            //  (b1)----------(b2)
            this.divideEvent(ev1, tA2, b2);
          }
          //         (a1)---(a2)
          //  (b1)----------(b2)
          this.divideEvent(ev2, tB1, a1);
        }
      }
      return null;
    } else if (i.kind === "tValuePairs") {
      if (i.tValuePairs.length <= 0) {
        return null;
      }
      // process a single intersection

      // skip intersections where endpoints meet
      let minPair = i.tValuePairs[0];
      for (
        let j = 1;
        j < i.tValuePairs.length &&
        ((minPair[0] === 0 && minPair[1] === 0) ||
          (minPair[0] === 0 && minPair[1] === 1) ||
          (minPair[0] === 1 && minPair[1] === 0) ||
          (minPair[0] === 1 && minPair[1] === 1));
        j++
      ) {
        minPair = i.tValuePairs[j];
      }
      const [tA, tB] = minPair;

      // even though *in theory* seg1.data.point(tA) === seg2.data.point(tB), that isn't exactly
      // correct in practice because intersections aren't exact... so we need to calculate a single
      // intersection point that everyone can share
      const p =
        tB === 0
          ? seg2.data.start()
          : tB === 1
            ? seg2.data.end()
            : tA === 0
              ? seg1.data.start()
              : tA === 1
                ? seg1.data.end()
                : seg1.data.point(tA);

      // is A divided between its endpoints? (exclusive)
      if (tA > 0 && tA < 1) {
        this.divideEvent(ev1, tA, p);
      }
      // is B divided between its endpoints? (exclusive)
      if (tB > 0 && tB < 1) {
        this.divideEvent(ev2, tB, p);
      }
      return null;
    }
    throw new Error("PolyBool: Unknown intersection type");
  }

  calculate() {
    const segments: SegmentBool[] = [];
    while (!this.events.isEmpty()) {
      const ev = this.events.getHead();

      this.log?.vert(ev.p[0]);

      if (ev.isStart) {
        this.log?.segmentNew(ev.seg, ev.primary);

        const surrounding = this.statusFindSurrounding(ev);
        const above = surrounding.before;
        const below = surrounding.after;

        this.log?.tempStatus(
          ev.seg,
          above ? above.seg : false,
          below ? below.seg : false,
        );

        const checkBothIntersections = () => {
          if (above) {
            const eve = this.checkIntersection(ev, above);
            if (eve) {
              return eve;
            }
          }
          if (below) {
            return this.checkIntersection(ev, below);
          }
          return null;
        };

        const eve = checkBothIntersections();
        if (eve) {
          // ev and eve are equal
          // we'll keep eve and throw away ev

          // merge ev.seg's fill information into eve.seg

          if (this.selfIntersection) {
            let toggle: boolean; // are we a toggling edge?
            if (ev.seg.myFill.below === null) {
              toggle = true;
            } else {
              toggle = ev.seg.myFill.above !== ev.seg.myFill.below;
            }

            // merge two segments that belong to the same polygon
            // think of this as sandwiching two segments together, where
            // `eve.seg` is the bottom -- this will cause the above fill flag to
            // toggle
            if (toggle) {
              eve.seg.myFill.above = !eve.seg.myFill.above;
            }
          } else {
            // merge two segments that belong to different polygons
            // each segment has distinct knowledge, so no special logic is
            // needed
            // note that this can only happen once per segment in this phase,
            // because we are guaranteed that all self-intersections are gone
            eve.seg.otherFill = ev.seg.myFill;
          }

          this.log?.segmentUpdate(eve.seg);

          this.events.remove(ev.other);
          this.events.remove(ev);
        }

        if (this.events.getHead() !== ev) {
          // something was inserted before us in the event queue, so loop back
          // around and process it before continuing
          this.log?.rewind(ev.seg);
          continue;
        }

        //
        // calculate fill flags
        //
        if (this.selfIntersection) {
          let toggle: boolean; // are we a toggling edge?
          if (ev.seg.myFill.below === null) {
            // if we are a new segment...
            // then we toggle
            toggle = true;
          } else {
            // we are a segment that has previous knowledge from a division
            // calculate toggle
            toggle = ev.seg.myFill.above !== ev.seg.myFill.below;
          }

          // next, calculate whether we are filled below us
          if (!below) {
            // if nothing is below us, then we're not filled
            ev.seg.myFill.below = false;
          } else {
            // otherwise, we know the answer -- it's the same if whatever is
            // below us is filled above it
            ev.seg.myFill.below = below.seg.myFill.above;
          }

          // since now we know if we're filled below us, we can calculate
          // whether we're filled above us by applying toggle to whatever is
          // below us
          ev.seg.myFill.above = toggle
            ? !ev.seg.myFill.below
            : ev.seg.myFill.below;
        } else {
          // now we fill in any missing transition information, since we are
          // all-knowing at this point

          if (ev.seg.otherFill === null) {
            // if we don't have other information, then we need to figure out if
            // we're inside the other polygon
            let inside: boolean | null;
            if (!below) {
              // if nothing is below us, then we're not filled
              inside = false;
            } else {
              // otherwise, something is below us
              // so copy the below segment's other polygon's above
              if (ev.primary === below.primary) {
                if (below.seg.otherFill === null) {
                  throw new Error(
                    "PolyBool: Unexpected state of otherFill (null)",
                  );
                }
                inside = below.seg.otherFill.above;
              } else {
                inside = below.seg.myFill.above;
              }
            }
            ev.seg.otherFill = {
              above: inside,
              below: inside,
            };
          }
        }

        this.log?.status(
          ev.seg,
          above ? above.seg : false,
          below ? below.seg : false,
        );

        // insert the status and remember it for later removal
        ev.other.status = surrounding.insert(ev);
      } else {
        // end
        const st = ev.status;

        if (st === null) {
          throw new Error(
            "PolyBool: Zero-length segment detected; your epsilon is " +
              "probably too small or too large",
          );
        }

        // removing the status will create two new adjacent edges, so we'll need
        // to check for those
        const i = this.status.getIndex(st);
        if (i > 0 && i < this.status.nodes.length - 1) {
          const before = this.status.nodes[i - 1];
          const after = this.status.nodes[i + 1];
          this.checkIntersection(before, after);
        }

        this.log?.statusRemove(st.seg);

        // remove the status
        this.status.remove(st);

        // if we've reached this point, we've calculated everything there is to
        // know, so save the segment for reporting
        if (!ev.primary) {
          // make sure `seg.myFill` actually points to the primary polygon
          // though
          if (!ev.seg.otherFill) {
            throw new Error("PolyBool: Unexpected state of otherFill (null)");
          }
          const s = ev.seg.myFill;
          ev.seg.myFill = ev.seg.otherFill;
          ev.seg.otherFill = s;
        }
        segments.push(ev.seg);
      }

      // remove the event and continue
      this.events.removeHead();
    }

    this.log?.done();

    return segments;
  }
}
