//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { List } from "./List";
import { type Point, type Geometry, AlongIntersection } from "./Geometry";

interface Fill {
  above: boolean | null;
  below: boolean | null;
}

export class Segment {
  start: Point;
  end: Point;
  myFill: Fill;
  otherFill: Fill | null = null;

  constructor(start: Point, end: Point, copyMyFill?: Segment) {
    this.start = start;
    this.end = end;
    this.myFill = {
      above: copyMyFill ? copyMyFill.myFill.above : null,
      below: copyMyFill ? copyMyFill.myFill.below : null,
    };
  }
}

class Event {
  isStart: boolean;
  p: Point;
  seg: Segment;
  primary: boolean;
  other!: Event;
  status: Event | null = null;

  constructor(isStart: boolean, p: Point, seg: Segment, primary: boolean) {
    this.isStart = isStart;
    this.p = p;
    this.seg = seg;
    this.primary = primary;
  }
}

export class Intersecter {
  private readonly selfIntersection: boolean;
  private readonly geo: Geometry;
  private readonly events = new List<Event>();
  private readonly status = new List<Event>();

  constructor(selfIntersection: boolean, geo: Geometry) {
    this.selfIntersection = selfIntersection;
    this.geo = geo;
  }

  compareEvents(
    p1_isStart: boolean,
    p1_1: Point,
    p1_2: Point,
    p2_isStart: boolean,
    p2_1: Point,
    p2_2: Point,
  ): number {
    // compare the selected points first
    const comp = this.geo.pointsCompare(p1_1, p2_1);
    if (comp !== 0) {
      return comp;
    }
    // the selected points are the same

    if (this.geo.pointsSame(p1_2, p2_2)) {
      // if the non-selected points are the same too...
      return 0; // then the segments are equal
    }

    if (p1_isStart !== p2_isStart) {
      // if one is a start and the other isn't...
      return p1_isStart ? 1 : -1; // favor the one that isn't the start
    }

    // otherwise, we'll have to calculate which one is below the other manually
    return this.geo.pointAboveOrOnLine(
      p1_2,
      p2_isStart ? p2_1 : p2_2, // order matters
      p2_isStart ? p2_2 : p2_1,
    )
      ? 1
      : -1;
  }

  addEvent(ev: Event) {
    this.events.insertBefore(ev, (here: Event) => {
      if (here === ev) {
        return 0;
      }
      return this.compareEvents(
        ev.isStart,
        ev.p,
        ev.other.p,
        here.isStart,
        here.p,
        here.other.p,
      );
    });
  }

  divideEvent(ev: Event, p: Point) {
    const ns = new Segment(p, ev.seg.end, ev.seg);
    // slides an end backwards
    //   (start)------------(end)    to:
    //   (start)---(end)
    this.events.remove(ev.other);
    ev.seg.end = p;
    ev.other.p = p;
    this.addEvent(ev.other);
    return this.addSegment(ns, ev.primary);
  }

  newSegment(p1: Point, p2: Point): Segment | null {
    const forward = this.geo.pointsCompare(p1, p2);
    if (forward === 0) {
      // points are equal, so we have a zero-length segment
      return null; // skip it
    }
    return forward < 0 ? new Segment(p1, p2) : new Segment(p2, p1);
  }

  addSegment(seg: Segment, primary: boolean) {
    const evStart = new Event(true, seg.start, seg, primary);
    const evEnd = new Event(false, seg.end, seg, primary);
    evStart.other = evEnd;
    evEnd.other = evStart;
    this.addEvent(evStart);
    this.addEvent(evEnd);
    return evStart;
  }

  addRegion(region: Point[]) {
    // regions are a list of points:
    //  [ [0, 0], [100, 0], [50, 100] ]
    // you can add multiple regions before running calculate
    let pt1: Point;
    let pt2 = region[region.length - 1];
    for (let i = 0; i < region.length; i++) {
      pt1 = pt2;
      pt2 = region[i];
      const seg = this.newSegment(pt1, pt2);
      if (seg) {
        this.addSegment(seg, true);
      }
    }
  }

  compareStatus(ev1: Event, ev2: Event): number {
    const a1 = ev1.seg.start;
    const a2 = ev1.seg.end;
    const b1 = ev2.seg.start;
    const b2 = ev2.seg.end;

    if (this.geo.pointsCollinear(a1, b1, b2)) {
      if (this.geo.pointsCollinear(a2, b1, b2)) {
        return 1;
      }
      return this.geo.pointAboveOrOnLine(a2, b1, b2) ? 1 : -1;
    }
    return this.geo.pointAboveOrOnLine(a1, b1, b2) ? 1 : -1;
  }

  statusFindSurrounding(ev: Event) {
    return this.status.findTransition(ev, (here: Event) => {
      if (here === ev) {
        return 0;
      }
      return -this.compareStatus(ev, here);
    });
  }

  checkIntersection(ev1: Event, ev2: Event): Event | null {
    // returns the segment equal to ev1, or null if nothing equal

    const seg1 = ev1.seg;
    const seg2 = ev2.seg;
    const a1 = seg1.start;
    const a2 = seg1.end;
    const b1 = seg2.start;
    const b2 = seg2.end;

    const i = this.geo.linesIntersect(a1, a2, b1, b2);

    if (i === null) {
      // segments are parallel or coincident

      // if points aren't collinear, then the segments are parallel, so no
      // intersections
      if (!this.geo.pointsCollinear(a1, a2, b1)) {
        return null;
      }
      // otherwise, segments are on top of each other somehow (aka coincident)

      if (this.geo.pointsSame(a1, b2) || this.geo.pointsSame(a2, b1)) {
        return null; // segments touch at endpoints... no intersection
      }

      const a1_equ_b1 = this.geo.pointsSame(a1, b1);
      const a2_equ_b2 = this.geo.pointsSame(a2, b2);

      if (a1_equ_b1 && a2_equ_b2) {
        return ev2; // segments are exactly equal
      }

      const a1_between = !a1_equ_b1 && this.geo.pointBetween(a1, b1, b2);
      const a2_between = !a2_equ_b2 && this.geo.pointBetween(a2, b1, b2);

      if (a1_equ_b1) {
        if (a2_between) {
          //  (a1)---(a2)
          //  (b1)----------(b2)
          this.divideEvent(ev2, a2);
        } else {
          //  (a1)----------(a2)
          //  (b1)---(b2)
          this.divideEvent(ev1, b2);
        }
        return ev2;
      } else if (a1_between) {
        if (!a2_equ_b2) {
          // make a2 equal to b2
          if (a2_between) {
            //         (a1)---(a2)
            //  (b1)-----------------(b2)
            this.divideEvent(ev2, a2);
          } else {
            //         (a1)----------(a2)
            //  (b1)----------(b2)
            this.divideEvent(ev1, b2);
          }
        }

        //         (a1)---(a2)
        //  (b1)----------(b2)
        this.divideEvent(ev2, a1);
      }
    } else {
      // otherwise, lines intersect at i.p, which may or may not be between the
      // endpoints

      // is A divided between its endpoints? (exclusive)
      if (i.alongA === AlongIntersection.BetweenStartAndEnd) {
        if (i.alongB === AlongIntersection.EqualStart) {
          this.divideEvent(ev1, b1);
        } else if (i.alongB === AlongIntersection.BetweenStartAndEnd) {
          this.divideEvent(ev1, i.p);
        } else if (i.alongB === AlongIntersection.EqualEnd) {
          this.divideEvent(ev1, b2);
        }
      }

      // is B divided between its endpoints? (exclusive)
      if (i.alongB === AlongIntersection.BetweenStartAndEnd) {
        if (i.alongA === AlongIntersection.EqualStart) {
          this.divideEvent(ev2, a1);
        } else if (i.alongA === AlongIntersection.BetweenStartAndEnd) {
          this.divideEvent(ev2, i.p);
        } else if (i.alongA === AlongIntersection.EqualEnd) {
          this.divideEvent(ev2, a2);
        }
      }
    }
    return null;
  }

  calculate(primaryPolyInverted: boolean, secondaryPolyInverted: boolean) {
    const segments: Segment[] = [];
    while (!this.events.isEmpty()) {
      const ev = this.events.getHead();
      if (ev.isStart) {
        const surrounding = this.statusFindSurrounding(ev);
        const above = surrounding.before;
        const below = surrounding.after;

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

          this.events.remove(ev.other);
          this.events.remove(ev);
        }

        if (this.events.getHead() !== ev) {
          // something was inserted before us in the event queue, so loop back
          // around and process it before continuing
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
            // if nothing is below us...
            // we are filled below us if the polygon is inverted
            ev.seg.myFill.below = primaryPolyInverted;
          } else {
            // otherwise, we know the answer -- it's the same if whatever is
            // below us is filled above it
            ev.seg.myFill.below = below.seg.myFill.above;
          }

          // since now we know if we're filled below us, we can calculate
          // whether we're filled above us by applying toggle to whatever is
          // below us
          if (toggle) {
            ev.seg.myFill.above = !ev.seg.myFill.below;
          } else {
            ev.seg.myFill.above = ev.seg.myFill.below;
          }
        } else {
          // now we fill in any missing transition information, since we are
          // all-knowing at this point

          if (ev.seg.otherFill === null) {
            // if we don't have other information, then we need to figure out if
            // we're inside the other polygon
            let inside: boolean | null;
            if (!below) {
              // if nothing is below us, then we're inside if the other polygon
              // is inverted
              inside = ev.primary ? secondaryPolyInverted : primaryPolyInverted;
            } else {
              // otherwise, something is below us
              // so copy the below segment's other polygon's above
              if (ev.primary === below.primary) {
                if (below.seg.otherFill === null) {
                  throw new Error("otherFill is null");
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

        // remove the status
        this.status.remove(st);

        // if we've reached this point, we've calculated everything there is to
        // know, so save the segment for reporting
        if (!ev.primary) {
          // make sure `seg.myFill` actually points to the primary polygon
          // though
          if (!ev.seg.otherFill) {
            throw new Error("otherFill is null");
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

    return segments;
  }
}
