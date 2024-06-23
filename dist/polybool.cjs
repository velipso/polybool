'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
var AlongIntersection;
(function (AlongIntersection) {
    AlongIntersection[AlongIntersection["BeforeStart"] = 0] = "BeforeStart";
    AlongIntersection[AlongIntersection["EqualStart"] = 1] = "EqualStart";
    AlongIntersection[AlongIntersection["BetweenStartAndEnd"] = 2] = "BetweenStartAndEnd";
    AlongIntersection[AlongIntersection["EqualEnd"] = 3] = "EqualEnd";
    AlongIntersection[AlongIntersection["AfterEnd"] = 4] = "AfterEnd";
})(AlongIntersection || (AlongIntersection = {}));
class Geometry {
    pointsSame(p1, p2) {
        return this.pointsSameX(p1, p2) && this.pointsSameY(p1, p2);
    }
    pointsCompare(p1, p2) {
        // returns -1 if p1 is smaller, 1 if p2 is smaller, 0 if equal
        if (this.pointsSameX(p1, p2)) {
            return this.pointsSameY(p1, p2) ? 0 : p1[1] < p2[1] ? -1 : 1;
        }
        return p1[0] < p2[0] ? -1 : 1;
    }
}
class GeometryEpsilon extends Geometry {
    constructor(epsilon = 0.0000000001) {
        super();
        this.epsilon = epsilon;
    }
    pointAboveOrOnLine(p, left, right) {
        const Ax = left[0];
        const Ay = left[1];
        const Bx = right[0];
        const By = right[1];
        const Cx = p[0];
        const Cy = p[1];
        return (Bx - Ax) * (Cy - Ay) - (By - Ay) * (Cx - Ax) >= -this.epsilon;
    }
    pointBetween(p, left, right) {
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
    pointsSameX(p1, p2) {
        return Math.abs(p1[0] - p2[0]) < this.epsilon;
    }
    pointsSameY(p1, p2) {
        return Math.abs(p1[1] - p2[1]) < this.epsilon;
    }
    pointsCollinear(p1, p2, p3) {
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
    linesIntersect(aStart, aEnd, bStart, bEnd) {
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
        const categorize = (v) => v <= -this.epsilon
            ? AlongIntersection.BeforeStart
            : v < this.epsilon
                ? AlongIntersection.EqualStart
                : v - 1 <= -this.epsilon
                    ? AlongIntersection.BetweenStartAndEnd
                    : v - 1 < this.epsilon
                        ? AlongIntersection.EqualEnd
                        : AlongIntersection.AfterEnd;
        const p = [aStart[0] + A * adx, aStart[1] + A * ady];
        return {
            alongA: categorize(A),
            alongB: categorize(B),
            p,
        };
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class List {
    constructor() {
        this.nodes = [];
    }
    remove(node) {
        const i = this.nodes.indexOf(node);
        if (i >= 0) {
            this.nodes.splice(i, 1);
        }
    }
    getIndex(node) {
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
    insertBefore(node, check) {
        this.findTransition(node, check).insert(node);
    }
    findTransition(node, check) {
        var _a, _b;
        // bisect to find the transition point
        const compare = (a, b) => check(b) - check(a);
        let i = 0;
        let high = this.nodes.length;
        while (i < high) {
            const mid = (i + high) >> 1;
            if (compare(this.nodes[mid], node) > 0) {
                high = mid;
            }
            else {
                i = mid + 1;
            }
        }
        return {
            before: i <= 0 ? null : (_a = this.nodes[i - 1]) !== null && _a !== void 0 ? _a : null,
            after: (_b = this.nodes[i]) !== null && _b !== void 0 ? _b : null,
            insert: (node) => {
                this.nodes.splice(i, 0, node);
                return node;
            },
        };
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class Segment {
    constructor(start, end, copyMyFill, log) {
        var _a;
        this.otherFill = null;
        this.id = (_a = log === null || log === void 0 ? void 0 : log.segmentId()) !== null && _a !== void 0 ? _a : -1;
        this.start = start;
        this.end = end;
        this.myFill = {
            above: copyMyFill ? copyMyFill.myFill.above : null,
            below: copyMyFill ? copyMyFill.myFill.below : null,
        };
    }
}
class Event {
    constructor(isStart, p, seg, primary) {
        this.status = null;
        this.isStart = isStart;
        this.p = p;
        this.seg = seg;
        this.primary = primary;
    }
}
class Intersecter {
    constructor(selfIntersection, geo, log = null) {
        this.events = new List();
        this.status = new List();
        this.selfIntersection = selfIntersection;
        this.geo = geo;
        this.log = log;
    }
    compareEvents(p1_isStart, p1_1, p1_2, p2_isStart, p2_1, p2_2) {
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
        return this.geo.pointAboveOrOnLine(p1_2, p2_isStart ? p2_1 : p2_2, // order matters
        p2_isStart ? p2_2 : p2_1)
            ? 1
            : -1;
    }
    addEvent(ev) {
        this.events.insertBefore(ev, (here) => {
            if (here === ev) {
                return 0;
            }
            return this.compareEvents(ev.isStart, ev.p, ev.other.p, here.isStart, here.p, here.other.p);
        });
    }
    divideEvent(ev, p) {
        var _a;
        const ns = new Segment(p, ev.seg.end, ev.seg, this.log);
        // slides an end backwards
        //   (start)------------(end)    to:
        //   (start)---(end)
        (_a = this.log) === null || _a === void 0 ? void 0 : _a.segmentChop(ev.seg, p);
        this.events.remove(ev.other);
        ev.seg.end = p;
        ev.other.p = p;
        this.addEvent(ev.other);
        return this.addSegment(ns, ev.primary);
    }
    newSegment(p1, p2) {
        const forward = this.geo.pointsCompare(p1, p2);
        if (forward === 0) {
            // points are equal, so we have a zero-length segment
            return null; // skip it
        }
        return forward < 0
            ? new Segment(p1, p2, null, this.log)
            : new Segment(p2, p1, null, this.log);
    }
    addSegment(seg, primary) {
        const evStart = new Event(true, seg.start, seg, primary);
        const evEnd = new Event(false, seg.end, seg, primary);
        evStart.other = evEnd;
        evEnd.other = evStart;
        this.addEvent(evStart);
        this.addEvent(evEnd);
        return evStart;
    }
    addRegion(region) {
        // regions are a list of points:
        //  [ [0, 0], [100, 0], [50, 100] ]
        // you can add multiple regions before running calculate
        let pt1;
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
    compareStatus(ev1, ev2) {
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
    statusFindSurrounding(ev) {
        return this.status.findTransition(ev, (here) => {
            if (here === ev) {
                return 0;
            }
            return -this.compareStatus(ev, here);
        });
    }
    checkIntersection(ev1, ev2) {
        var _a;
        // returns the segment equal to ev1, or null if nothing equal
        const seg1 = ev1.seg;
        const seg2 = ev2.seg;
        const a1 = seg1.start;
        const a2 = seg1.end;
        const b1 = seg2.start;
        const b2 = seg2.end;
        (_a = this.log) === null || _a === void 0 ? void 0 : _a.checkIntersection(seg1, seg2);
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
                }
                else {
                    //  (a1)----------(a2)
                    //  (b1)---(b2)
                    this.divideEvent(ev1, b2);
                }
                return ev2;
            }
            else if (a1_between) {
                if (!a2_equ_b2) {
                    // make a2 equal to b2
                    if (a2_between) {
                        //         (a1)---(a2)
                        //  (b1)-----------------(b2)
                        this.divideEvent(ev2, a2);
                    }
                    else {
                        //         (a1)----------(a2)
                        //  (b1)----------(b2)
                        this.divideEvent(ev1, b2);
                    }
                }
                //         (a1)---(a2)
                //  (b1)----------(b2)
                this.divideEvent(ev2, a1);
            }
        }
        else {
            // otherwise, lines intersect at i.p, which may or may not be between the
            // endpoints
            // is A divided between its endpoints? (exclusive)
            if (i.alongA === AlongIntersection.BetweenStartAndEnd) {
                if (i.alongB === AlongIntersection.EqualStart) {
                    this.divideEvent(ev1, b1);
                }
                else if (i.alongB === AlongIntersection.BetweenStartAndEnd) {
                    this.divideEvent(ev1, i.p);
                }
                else if (i.alongB === AlongIntersection.EqualEnd) {
                    this.divideEvent(ev1, b2);
                }
            }
            // is B divided between its endpoints? (exclusive)
            if (i.alongB === AlongIntersection.BetweenStartAndEnd) {
                if (i.alongA === AlongIntersection.EqualStart) {
                    this.divideEvent(ev2, a1);
                }
                else if (i.alongA === AlongIntersection.BetweenStartAndEnd) {
                    this.divideEvent(ev2, i.p);
                }
                else if (i.alongA === AlongIntersection.EqualEnd) {
                    this.divideEvent(ev2, a2);
                }
            }
        }
        return null;
    }
    calculate(primaryPolyInverted, secondaryPolyInverted) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const segments = [];
        while (!this.events.isEmpty()) {
            const ev = this.events.getHead();
            (_a = this.log) === null || _a === void 0 ? void 0 : _a.vert(ev.p[0]);
            if (ev.isStart) {
                (_b = this.log) === null || _b === void 0 ? void 0 : _b.segmentNew(ev.seg, ev.primary);
                const surrounding = this.statusFindSurrounding(ev);
                const above = surrounding.before;
                const below = surrounding.after;
                (_c = this.log) === null || _c === void 0 ? void 0 : _c.tempStatus(ev.seg, above ? above.seg : false, below ? below.seg : false);
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
                        let toggle; // are we a toggling edge?
                        if (ev.seg.myFill.below === null) {
                            toggle = true;
                        }
                        else {
                            toggle = ev.seg.myFill.above !== ev.seg.myFill.below;
                        }
                        // merge two segments that belong to the same polygon
                        // think of this as sandwiching two segments together, where
                        // `eve.seg` is the bottom -- this will cause the above fill flag to
                        // toggle
                        if (toggle) {
                            eve.seg.myFill.above = !eve.seg.myFill.above;
                        }
                    }
                    else {
                        // merge two segments that belong to different polygons
                        // each segment has distinct knowledge, so no special logic is
                        // needed
                        // note that this can only happen once per segment in this phase,
                        // because we are guaranteed that all self-intersections are gone
                        eve.seg.otherFill = ev.seg.myFill;
                    }
                    (_d = this.log) === null || _d === void 0 ? void 0 : _d.segmentUpdate(eve.seg);
                    this.events.remove(ev.other);
                    this.events.remove(ev);
                }
                if (this.events.getHead() !== ev) {
                    // something was inserted before us in the event queue, so loop back
                    // around and process it before continuing
                    (_e = this.log) === null || _e === void 0 ? void 0 : _e.rewind(ev.seg);
                    continue;
                }
                //
                // calculate fill flags
                //
                if (this.selfIntersection) {
                    let toggle; // are we a toggling edge?
                    if (ev.seg.myFill.below === null) {
                        // if we are a new segment...
                        // then we toggle
                        toggle = true;
                    }
                    else {
                        // we are a segment that has previous knowledge from a division
                        // calculate toggle
                        toggle = ev.seg.myFill.above !== ev.seg.myFill.below;
                    }
                    // next, calculate whether we are filled below us
                    if (!below) {
                        // if nothing is below us...
                        // we are filled below us if the polygon is inverted
                        ev.seg.myFill.below = primaryPolyInverted;
                    }
                    else {
                        // otherwise, we know the answer -- it's the same if whatever is
                        // below us is filled above it
                        ev.seg.myFill.below = below.seg.myFill.above;
                    }
                    // since now we know if we're filled below us, we can calculate
                    // whether we're filled above us by applying toggle to whatever is
                    // below us
                    if (toggle) {
                        ev.seg.myFill.above = !ev.seg.myFill.below;
                    }
                    else {
                        ev.seg.myFill.above = ev.seg.myFill.below;
                    }
                }
                else {
                    // now we fill in any missing transition information, since we are
                    // all-knowing at this point
                    if (ev.seg.otherFill === null) {
                        // if we don't have other information, then we need to figure out if
                        // we're inside the other polygon
                        let inside;
                        if (!below) {
                            // if nothing is below us, then we're inside if the other polygon
                            // is inverted
                            inside = ev.primary ? secondaryPolyInverted : primaryPolyInverted;
                        }
                        else {
                            // otherwise, something is below us
                            // so copy the below segment's other polygon's above
                            if (ev.primary === below.primary) {
                                if (below.seg.otherFill === null) {
                                    throw new Error("otherFill is null");
                                }
                                inside = below.seg.otherFill.above;
                            }
                            else {
                                inside = below.seg.myFill.above;
                            }
                        }
                        ev.seg.otherFill = {
                            above: inside,
                            below: inside,
                        };
                    }
                }
                (_f = this.log) === null || _f === void 0 ? void 0 : _f.status(ev.seg, above ? above.seg : false, below ? below.seg : false);
                // insert the status and remember it for later removal
                ev.other.status = surrounding.insert(ev);
            }
            else {
                // end
                const st = ev.status;
                if (st === null) {
                    throw new Error("PolyBool: Zero-length segment detected; your epsilon is " +
                        "probably too small or too large");
                }
                // removing the status will create two new adjacent edges, so we'll need
                // to check for those
                const i = this.status.getIndex(st);
                if (i > 0 && i < this.status.nodes.length - 1) {
                    const before = this.status.nodes[i - 1];
                    const after = this.status.nodes[i + 1];
                    this.checkIntersection(before, after);
                }
                (_g = this.log) === null || _g === void 0 ? void 0 : _g.statusRemove(st.seg);
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
        (_h = this.log) === null || _h === void 0 ? void 0 : _h.done();
        return segments;
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
//
// filter a list of segments based on boolean operations
//
function select(segments, selection, log) {
    const result = [];
    for (const seg of segments) {
        const index = (seg.myFill.above ? 8 : 0) +
            (seg.myFill.below ? 4 : 0) +
            (seg.otherFill && seg.otherFill.above ? 2 : 0) +
            (seg.otherFill && seg.otherFill.below ? 1 : 0);
        if (selection[index] !== 0) {
            // copy the segment to the results, while also calculating the fill status
            const keep = new Segment(seg.start, seg.end, null, log);
            keep.myFill.above = selection[index] === 1; // 1 if filled above
            keep.myFill.below = selection[index] === 2; // 2 if filled below
            result.push(keep);
        }
    }
    log === null || log === void 0 ? void 0 : log.selected(result);
    return result;
}
class SegmentSelector {
    static union(segments, log) {
        // primary | secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   no                  0
        //    0      0      0      1   =>   yes filled below    2
        //    0      0      1      0   =>   yes filled above    1
        //    0      0      1      1   =>   no                  0
        //    0      1      0      0   =>   yes filled below    2
        //    0      1      0      1   =>   yes filled below    2
        //    0      1      1      0   =>   no                  0
        //    0      1      1      1   =>   no                  0
        //    1      0      0      0   =>   yes filled above    1
        //    1      0      0      1   =>   no                  0
        //    1      0      1      0   =>   yes filled above    1
        //    1      0      1      1   =>   no                  0
        //    1      1      0      0   =>   no                  0
        //    1      1      0      1   =>   no                  0
        //    1      1      1      0   =>   no                  0
        //    1      1      1      1   =>   no                  0
        return select(segments, [0, 2, 1, 0, 2, 2, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], log);
    }
    static intersect(segments, log) {
        // primary & secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   no                  0
        //    0      0      0      1   =>   no                  0
        //    0      0      1      0   =>   no                  0
        //    0      0      1      1   =>   no                  0
        //    0      1      0      0   =>   no                  0
        //    0      1      0      1   =>   yes filled below    2
        //    0      1      1      0   =>   no                  0
        //    0      1      1      1   =>   yes filled below    2
        //    1      0      0      0   =>   no                  0
        //    1      0      0      1   =>   no                  0
        //    1      0      1      0   =>   yes filled above    1
        //    1      0      1      1   =>   yes filled above    1
        //    1      1      0      0   =>   no                  0
        //    1      1      0      1   =>   yes filled below    2
        //    1      1      1      0   =>   yes filled above    1
        //    1      1      1      1   =>   no                  0
        return select(segments, [0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 1, 1, 0, 2, 1, 0], log);
    }
    static difference(segments, log) {
        // primary - secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   no                  0
        //    0      0      0      1   =>   no                  0
        //    0      0      1      0   =>   no                  0
        //    0      0      1      1   =>   no                  0
        //    0      1      0      0   =>   yes filled below    2
        //    0      1      0      1   =>   no                  0
        //    0      1      1      0   =>   yes filled below    2
        //    0      1      1      1   =>   no                  0
        //    1      0      0      0   =>   yes filled above    1
        //    1      0      0      1   =>   yes filled above    1
        //    1      0      1      0   =>   no                  0
        //    1      0      1      1   =>   no                  0
        //    1      1      0      0   =>   no                  0
        //    1      1      0      1   =>   yes filled above    1
        //    1      1      1      0   =>   yes filled below    2
        //    1      1      1      1   =>   no                  0
        return select(segments, [0, 0, 0, 0, 2, 0, 2, 0, 1, 1, 0, 0, 0, 1, 2, 0], log);
    }
    static differenceRev(segments, log) {
        // secondary - primary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   no                  0
        //    0      0      0      1   =>   yes filled below    2
        //    0      0      1      0   =>   yes filled above    1
        //    0      0      1      1   =>   no                  0
        //    0      1      0      0   =>   no                  0
        //    0      1      0      1   =>   no                  0
        //    0      1      1      0   =>   yes filled above    1
        //    0      1      1      1   =>   yes filled above    1
        //    1      0      0      0   =>   no                  0
        //    1      0      0      1   =>   yes filled below    2
        //    1      0      1      0   =>   no                  0
        //    1      0      1      1   =>   yes filled below    2
        //    1      1      0      0   =>   no                  0
        //    1      1      0      1   =>   no                  0
        //    1      1      1      0   =>   no                  0
        //    1      1      1      1   =>   no                  0
        return select(segments, [0, 2, 1, 0, 0, 0, 1, 1, 0, 2, 0, 2, 0, 0, 0, 0], log);
    }
    static xor(segments, log) {
        // primary ^ secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   no                  0
        //    0      0      0      1   =>   yes filled below    2
        //    0      0      1      0   =>   yes filled above    1
        //    0      0      1      1   =>   no                  0
        //    0      1      0      0   =>   yes filled below    2
        //    0      1      0      1   =>   no                  0
        //    0      1      1      0   =>   no                  0
        //    0      1      1      1   =>   yes filled above    1
        //    1      0      0      0   =>   yes filled above    1
        //    1      0      0      1   =>   no                  0
        //    1      0      1      0   =>   no                  0
        //    1      0      1      1   =>   yes filled below    2
        //    1      1      0      0   =>   no                  0
        //    1      1      0      1   =>   yes filled above    1
        //    1      1      1      0   =>   yes filled below    2
        //    1      1      1      1   =>   no                  0
        return select(segments, [0, 2, 1, 0, 2, 0, 0, 1, 1, 0, 0, 2, 0, 1, 2, 0], log);
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
//
// converts a list of segments into a list of regions, while also removing
// unnecessary verticies
//
function SegmentChainer(segments, geo, log) {
    const chains = [];
    const regions = [];
    for (const seg of segments) {
        const pt1 = seg.start;
        const pt2 = seg.end;
        if (geo.pointsSame(pt1, pt2)) {
            console.warn("PolyBool: Warning: Zero-length segment detected; your epsilon is " +
                "probably too small or too large");
            continue;
        }
        log === null || log === void 0 ? void 0 : log.chainStart(seg);
        // search for two chains that this segment matches
        const first_match = {
            index: 0,
            matches_head: false,
            matches_pt1: false,
        };
        const second_match = {
            index: 0,
            matches_head: false,
            matches_pt1: false,
        };
        let next_match = first_match;
        function setMatch(index, matches_head, matches_pt1) {
            // return true if we've matched twice
            if (next_match) {
                next_match.index = index;
                next_match.matches_head = matches_head;
                next_match.matches_pt1 = matches_pt1;
            }
            if (next_match === first_match) {
                next_match = second_match;
                return false;
            }
            next_match = null;
            return true; // we've matched twice, we're done here
        }
        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i];
            const head = chain[0];
            const tail = chain[chain.length - 1];
            if (geo.pointsSame(head, pt1)) {
                if (setMatch(i, true, true)) {
                    break;
                }
            }
            else if (geo.pointsSame(head, pt2)) {
                if (setMatch(i, true, false)) {
                    break;
                }
            }
            else if (geo.pointsSame(tail, pt1)) {
                if (setMatch(i, false, true)) {
                    break;
                }
            }
            else if (geo.pointsSame(tail, pt2)) {
                if (setMatch(i, false, false)) {
                    break;
                }
            }
        }
        if (next_match === first_match) {
            // we didn't match anything, so create a new chain
            chains.push([pt1, pt2]);
            log === null || log === void 0 ? void 0 : log.chainNew(pt1, pt2);
            continue;
        }
        if (next_match === second_match) {
            // we matched a single chain
            log === null || log === void 0 ? void 0 : log.chainMatch(first_match.index);
            // add the other point to the apporpriate end, and check to see if we've closed the
            // chain into a loop
            const index = first_match.index;
            const pt = first_match.matches_pt1 ? pt2 : pt1; // if we matched pt1, then we add pt2, etc
            const addToHead = first_match.matches_head; // if we matched at head, then add to the head
            const chain = chains[index];
            let grow = addToHead ? chain[0] : chain[chain.length - 1];
            const grow2 = addToHead ? chain[1] : chain[chain.length - 2];
            const oppo = addToHead ? chain[chain.length - 1] : chain[0];
            const oppo2 = addToHead ? chain[chain.length - 2] : chain[1];
            if (geo.pointsCollinear(grow2, grow, pt)) {
                // grow isn't needed because it's directly between grow2 and pt:
                // grow2 ---grow---> pt
                if (addToHead) {
                    log === null || log === void 0 ? void 0 : log.chainRemoveHead(first_match.index, pt);
                    chain.shift();
                }
                else {
                    log === null || log === void 0 ? void 0 : log.chainRemoveTail(first_match.index, pt);
                    chain.pop();
                }
                grow = grow2; // old grow is gone... new grow is what grow2 was
            }
            if (geo.pointsSame(oppo, pt)) {
                // we're closing the loop, so remove chain from chains
                chains.splice(index, 1);
                if (geo.pointsCollinear(oppo2, oppo, grow)) {
                    // oppo isn't needed because it's directly between oppo2 and grow:
                    // oppo2 ---oppo--->grow
                    if (addToHead) {
                        log === null || log === void 0 ? void 0 : log.chainRemoveTail(first_match.index, grow);
                        chain.pop();
                    }
                    else {
                        log === null || log === void 0 ? void 0 : log.chainRemoveHead(first_match.index, grow);
                        chain.shift();
                    }
                }
                log === null || log === void 0 ? void 0 : log.chainClose(first_match.index);
                // we have a closed chain!
                regions.push(chain);
                continue;
            }
            // not closing a loop, so just add it to the apporpriate side
            if (addToHead) {
                log === null || log === void 0 ? void 0 : log.chainAddHead(first_match.index, pt);
                chain.unshift(pt);
            }
            else {
                log === null || log === void 0 ? void 0 : log.chainAddTail(first_match.index, pt);
                chain.push(pt);
            }
            continue;
        }
        // otherwise, we matched two chains, so we need to combine those chains together
        function reverseChain(index) {
            log === null || log === void 0 ? void 0 : log.chainReverse(index);
            chains[index].reverse(); // gee, that's easy
        }
        function appendChain(index1, index2) {
            // index1 gets index2 appended to it, and index2 is removed
            const chain1 = chains[index1];
            const chain2 = chains[index2];
            let tail = chain1[chain1.length - 1];
            const tail2 = chain1[chain1.length - 2];
            const head = chain2[0];
            const head2 = chain2[1];
            if (geo.pointsCollinear(tail2, tail, head)) {
                // tail isn't needed because it's directly between tail2 and head
                // tail2 ---tail---> head
                log === null || log === void 0 ? void 0 : log.chainRemoveTail(index1, tail);
                chain1.pop();
                tail = tail2; // old tail is gone... new tail is what tail2 was
            }
            if (geo.pointsCollinear(tail, head, head2)) {
                // head isn't needed because it's directly between tail and head2
                // tail ---head---> head2
                log === null || log === void 0 ? void 0 : log.chainRemoveHead(index2, head);
                chain2.shift();
            }
            log === null || log === void 0 ? void 0 : log.chainJoin(index1, index2);
            chains[index1] = chain1.concat(chain2);
            chains.splice(index2, 1);
        }
        const F = first_match.index;
        const S = second_match.index;
        log === null || log === void 0 ? void 0 : log.chainConnect(F, S);
        const reverseF = chains[F].length < chains[S].length; // reverse the shorter chain, if needed
        if (first_match.matches_head) {
            if (second_match.matches_head) {
                if (reverseF) {
                    // <<<< F <<<< --- >>>> S >>>>
                    reverseChain(F);
                    // >>>> F >>>> --- >>>> S >>>>
                    appendChain(F, S);
                }
                else {
                    // <<<< F <<<< --- >>>> S >>>>
                    reverseChain(S);
                    // <<<< F <<<< --- <<<< S <<<<   logically same as:
                    // >>>> S >>>> --- >>>> F >>>>
                    appendChain(S, F);
                }
            }
            else {
                // <<<< F <<<< --- <<<< S <<<<   logically same as:
                // >>>> S >>>> --- >>>> F >>>>
                appendChain(S, F);
            }
        }
        else {
            if (second_match.matches_head) {
                // >>>> F >>>> --- >>>> S >>>>
                appendChain(F, S);
            }
            else {
                if (reverseF) {
                    // >>>> F >>>> --- <<<< S <<<<
                    reverseChain(F);
                    // <<<< F <<<< --- <<<< S <<<<   logically same as:
                    // >>>> S >>>> --- >>>> F >>>>
                    appendChain(S, F);
                }
                else {
                    // >>>> F >>>> --- <<<< S <<<<
                    reverseChain(S);
                    // >>>> F >>>> --- >>>> S >>>>
                    appendChain(F, S);
                }
            }
        }
    }
    return regions;
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class BuildLog {
    constructor() {
        this.list = [];
        this.nextSegmentId = 0;
        this.curVert = NaN;
    }
    push(type, data) {
        this.list.push({
            type,
            data: JSON.parse(JSON.stringify(data)),
        });
    }
    segmentId() {
        return this.nextSegmentId++;
    }
    checkIntersection(seg1, seg2) {
        this.push("check", { seg1, seg2 });
    }
    segmentChop(seg, p) {
        this.push("div_seg", { seg, p });
        this.push("chop", { seg, p });
    }
    statusRemove(seg) {
        this.push("pop_seg", { seg });
    }
    segmentUpdate(seg) {
        this.push("seg_update", { seg });
    }
    segmentNew(seg, primary) {
        this.push("new_seg", { seg, primary });
    }
    tempStatus(seg, above, below) {
        this.push("temp_status", { seg, above, below });
    }
    rewind(seg) {
        this.push("rewind", { seg });
    }
    status(seg, above, below) {
        this.push("status", { seg, above, below });
    }
    vert(x) {
        if (x !== this.curVert) {
            this.push("vert", { x });
            this.curVert = x;
        }
    }
    selected(segs) {
        this.push("selected", { segs });
    }
    chainStart(seg) {
        this.push("chain_start", { seg });
    }
    chainRemoveHead(index, p) {
        this.push("chain_rem_head", { index, p });
    }
    chainRemoveTail(index, p) {
        this.push("chain_rem_tail", { index, p });
    }
    chainNew(p1, p2) {
        this.push("chain_new", { p1, p2 });
    }
    chainMatch(index) {
        this.push("chain_match", { index });
    }
    chainClose(index) {
        this.push("chain_close", { index });
    }
    chainAddHead(index, p) {
        this.push("chain_add_head", { index, p });
    }
    chainAddTail(index, p) {
        this.push("chain_add_tail", { index, p });
    }
    chainConnect(index1, index2) {
        this.push("chain_con", { index1, index2 });
    }
    chainReverse(index) {
        this.push("chain_rev", { index });
    }
    chainJoin(index1, index2) {
        this.push("chain_join", { index1, index2 });
    }
    done() {
        this.push("done", null);
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class PolyBool {
    constructor(geo) {
        this.log = null;
        this.geo = geo;
    }
    buildLog(enable) {
        var _a;
        this.log = enable ? new BuildLog() : null;
        return (_a = this.log) === null || _a === void 0 ? void 0 : _a.list;
    }
    segments(poly) {
        const i = new Intersecter(true, this.geo, this.log);
        for (const region of poly.regions) {
            i.addRegion(region);
        }
        return {
            segments: i.calculate(poly.inverted, false),
            inverted: poly.inverted,
        };
    }
    combine(segments1, segments2) {
        const i = new Intersecter(false, this.geo, this.log);
        for (const seg of segments1.segments) {
            i.addSegment(new Segment(seg.start, seg.end, seg, this.log), true);
        }
        for (const seg of segments2.segments) {
            i.addSegment(new Segment(seg.start, seg.end, seg, this.log), false);
        }
        return {
            combined: i.calculate(segments1.inverted, segments2.inverted),
            inverted1: segments1.inverted,
            inverted2: segments2.inverted,
        };
    }
    selectUnion(combined) {
        return {
            segments: SegmentSelector.union(combined.combined, this.log),
            inverted: combined.inverted1 || combined.inverted2,
        };
    }
    selectIntersect(combined) {
        return {
            segments: SegmentSelector.intersect(combined.combined, this.log),
            inverted: combined.inverted1 && combined.inverted2,
        };
    }
    selectDifference(combined) {
        return {
            segments: SegmentSelector.difference(combined.combined, this.log),
            inverted: combined.inverted1 && !combined.inverted2,
        };
    }
    selectDifferenceRev(combined) {
        return {
            segments: SegmentSelector.differenceRev(combined.combined, this.log),
            inverted: !combined.inverted1 && combined.inverted2,
        };
    }
    selectXor(combined) {
        return {
            segments: SegmentSelector.xor(combined.combined, this.log),
            inverted: combined.inverted1 !== combined.inverted2,
        };
    }
    polygon(segments) {
        return {
            regions: SegmentChainer(segments.segments, this.geo, this.log),
            inverted: segments.inverted,
        };
    }
    // helper functions for common operations
    union(poly1, poly2) {
        const seg1 = this.segments(poly1);
        const seg2 = this.segments(poly2);
        const comb = this.combine(seg1, seg2);
        const seg3 = this.selectUnion(comb);
        return this.polygon(seg3);
    }
    intersect(poly1, poly2) {
        const seg1 = this.segments(poly1);
        const seg2 = this.segments(poly2);
        const comb = this.combine(seg1, seg2);
        const seg3 = this.selectIntersect(comb);
        return this.polygon(seg3);
    }
    difference(poly1, poly2) {
        const seg1 = this.segments(poly1);
        const seg2 = this.segments(poly2);
        const comb = this.combine(seg1, seg2);
        const seg3 = this.selectDifference(comb);
        return this.polygon(seg3);
    }
    differenceRev(poly1, poly2) {
        const seg1 = this.segments(poly1);
        const seg2 = this.segments(poly2);
        const comb = this.combine(seg1, seg2);
        const seg3 = this.selectDifferenceRev(comb);
        return this.polygon(seg3);
    }
    xor(poly1, poly2) {
        const seg1 = this.segments(poly1);
        const seg2 = this.segments(poly2);
        const comb = this.combine(seg1, seg2);
        const seg3 = this.selectXor(comb);
        return this.polygon(seg3);
    }
}
const polybool = new PolyBool(new GeometryEpsilon());

exports.BuildLog = BuildLog;
exports.GeometryEpsilon = GeometryEpsilon;
exports.Intersecter = Intersecter;
exports.PolyBool = PolyBool;
exports.Segment = Segment;
exports.SegmentChainer = SegmentChainer;
exports.SegmentSelector = SegmentSelector;
exports.default = polybool;
