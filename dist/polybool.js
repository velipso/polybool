//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function lerpVec2(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}
function boundingBoxesIntersect(bbox1, bbox2) {
    const [b1min, b1max] = bbox1;
    const [b2min, b2max] = bbox2;
    return !(b1min[0] > b2max[0] ||
        b1max[0] < b2min[0] ||
        b1min[1] > b2max[1] ||
        b1max[1] < b2min[1]);
}
class Geometry {
}
class GeometryEpsilon extends Geometry {
    constructor(epsilon = 0.0000000001) {
        super();
        this.epsilon = epsilon;
    }
    snap0(v) {
        if (Math.abs(v) < this.epsilon) {
            return 0;
        }
        return v;
    }
    snap01(v) {
        if (Math.abs(v) < this.epsilon) {
            return 0;
        }
        if (Math.abs(1 - v) < this.epsilon) {
            return 1;
        }
        return v;
    }
    atan2deg(dy, dx) {
        if (Math.abs(dy) < this.epsilon) {
            return dx > 0 || Math.abs(dx) < this.epsilon ? 0 : 180;
        }
        else if (Math.abs(dx) < this.epsilon) {
            return dy < 0 ? 270 : 90;
        }
        else if (Math.abs(dx - dy) < this.epsilon) {
            return dx < 0 ? 225 : 45;
        }
        else if (Math.abs(dx + dy) < this.epsilon) {
            return dx < 0 ? 315 : 135;
        }
        return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    }
    isCollinear(p1, p2, p3) {
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
    solveCubic(a, b, c, d) {
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
            }
            else if (D > 0) {
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
    isEqualVec2(a, b) {
        return (Math.abs(a[0] - b[0]) < this.epsilon &&
            Math.abs(a[1] - b[1]) < this.epsilon);
    }
    compareVec2(a, b) {
        // returns -1 if a is smaller, 1 if b is smaller, 0 if equal
        if (Math.abs(b[0] - a[0]) < this.epsilon) {
            return Math.abs(b[1] - a[1]) < this.epsilon ? 0 : a[1] < b[1] ? -1 : 1;
        }
        return a[0] < b[0] ? -1 : 1;
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class SegmentTValuesBuilder {
    constructor(geo) {
        this.tValues = [];
        this.geo = geo;
    }
    addArray(ts) {
        for (const t of ts) {
            this.tValues.push(t);
        }
        return this;
    }
    add(t) {
        t = this.geo.snap01(t);
        // ignore values outside 0-1 range
        if (t < 0 || t > 1) {
            return this;
        }
        for (const tv of this.tValues) {
            if (this.geo.snap0(t - tv) === 0) {
                // already have this location
                return this;
            }
        }
        this.tValues.push(t);
        return this;
    }
    list() {
        this.tValues.sort((a, b) => a - b);
        return this.tValues;
    }
}
class SegmentTValuePairsBuilder {
    constructor(allowOutOfRange, geo) {
        this.tValuePairs = [];
        this.allowOutOfRange = allowOutOfRange;
        this.geo = geo;
    }
    add(t1, t2) {
        t1 = this.geo.snap01(t1);
        t2 = this.geo.snap01(t2);
        // ignore values outside 0-1 range
        if (!this.allowOutOfRange && (t1 < 0 || t1 > 1 || t2 < 0 || t2 > 1)) {
            return this;
        }
        for (const tv of this.tValuePairs) {
            if (this.geo.snap0(t1 - tv[0]) === 0 ||
                this.geo.snap0(t2 - tv[1]) === 0) {
                // already have this location
                return this;
            }
        }
        this.tValuePairs.push([t1, t2]);
        return this;
    }
    list() {
        this.tValuePairs.sort((a, b) => a[0] - b[0]);
        return this.tValuePairs;
    }
    done() {
        return this.tValuePairs.length <= 0
            ? null
            : {
                kind: "tValuePairs",
                tValuePairs: this.list(),
            };
    }
}
class SegmentBase {
}
class SegmentLine extends SegmentBase {
    constructor(p0, p1, geo) {
        super();
        this.p0 = p0;
        this.p1 = p1;
        this.geo = geo;
    }
    start() {
        return this.p0;
    }
    start2() {
        return this.p1;
    }
    end() {
        return this.p1;
    }
    setStart(p0) {
        this.p0 = p0;
    }
    setEnd(p1) {
        this.p1 = p1;
    }
    point(t) {
        const p0 = this.p0;
        const p1 = this.p1;
        if (t === 0) {
            return p0;
        }
        else if (t === 1) {
            return p1;
        }
        return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
    }
    tangentStart() {
        const p0 = this.p0;
        const p1 = this.p1;
        return this.geo.atan2deg(p1[1] - p0[1], p1[0] - p0[0]);
    }
    tangentEnd() {
        const p0 = this.p0;
        const p1 = this.p1;
        return this.geo.atan2deg(p1[1] - p0[1], p1[0] - p0[0]);
    }
    split(ts) {
        if (ts.length <= 0) {
            return [this];
        }
        const pts = ts.map((t) => this.point(t));
        pts.push(this.p1);
        const result = [];
        let last = this.p0;
        for (const p of pts) {
            result.push(new SegmentLine(last, p, this.geo));
            last = p;
        }
        return result;
    }
    reverse() {
        return new SegmentLine(this.p1, this.p0, this.geo);
    }
    boundingBox() {
        const p0 = this.p0;
        const p1 = this.p1;
        return [
            [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1])],
            [Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])],
        ];
    }
    pointOn(p) {
        return this.geo.isCollinear(p, this.p0, this.p1);
    }
    draw(ctx) {
        const p0 = this.p0;
        const p1 = this.p1;
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
    }
}
class SegmentCurve extends SegmentBase {
    constructor(p0, p1, p2, p3, geo) {
        super();
        this.p0 = p0;
        this.p1 = p1;
        this.p2 = p2;
        this.p3 = p3;
        this.geo = geo;
    }
    start() {
        return this.p0;
    }
    start2() {
        return this.p1;
    }
    end() {
        return this.p3;
    }
    setStart(p0) {
        this.p0 = p0;
    }
    setEnd(p3) {
        this.p3 = p3;
    }
    point(t) {
        const p0 = this.p0;
        const p1 = this.p1;
        const p2 = this.p2;
        const p3 = this.p3;
        if (t === 0) {
            return p0;
        }
        else if (t === 1) {
            return p3;
        }
        const t1t = (1 - t) * (1 - t);
        const tt = t * t;
        const t0 = t1t * (1 - t);
        const t1 = 3 * t1t * t;
        const t2 = 3 * tt * (1 - t);
        const t3 = tt * t;
        return [
            p0[0] * t0 + p1[0] * t1 + p2[0] * t2 + p3[0] * t3,
            p0[1] * t0 + p1[1] * t1 + p2[1] * t2 + p3[1] * t3,
        ];
    }
    tangentStart() {
        const p0 = this.p0;
        const p1 = this.p1;
        return this.geo.atan2deg(p1[1] - p0[1], p1[0] - p0[0]);
    }
    tangentEnd() {
        const p2 = this.p2;
        const p3 = this.p3;
        return this.geo.atan2deg(p3[1] - p2[1], p3[0] - p2[0]);
    }
    split(ts) {
        if (ts.length <= 0) {
            return [this];
        }
        const result = [];
        const splitSingle = (pts, t) => {
            const [p0, p1, p2, p3] = pts;
            const p4 = lerpVec2(p0, p1, t);
            const p5 = lerpVec2(p1, p2, t);
            const p6 = lerpVec2(p2, p3, t);
            const p7 = lerpVec2(p4, p5, t);
            const p8 = lerpVec2(p5, p6, t);
            const p9 = lerpVec2(p7, p8, t);
            result.push(new SegmentCurve(p0, p4, p7, p9, this.geo));
            return [p9, p8, p6, p3];
        };
        let last = [this.p0, this.p1, this.p2, this.p3];
        let lastT = 0;
        for (const t of ts) {
            last = splitSingle(last, (t - lastT) / (1 - lastT));
            lastT = t;
        }
        result.push(new SegmentCurve(last[0], last[1], last[2], last[3], this.geo));
        return result;
    }
    reverse() {
        return new SegmentCurve(this.p3, this.p2, this.p1, this.p0, this.geo);
    }
    getCubicCoefficients(axis) {
        const p0 = this.p0[axis];
        const p1 = this.p1[axis];
        const p2 = this.p2[axis];
        const p3 = this.p3[axis];
        return [
            p3 - 3 * p2 + 3 * p1 - p0,
            3 * p2 - 6 * p1 + 3 * p0,
            3 * p1 - 3 * p0,
            p0,
        ];
    }
    boundingTValues() {
        const result = new SegmentTValuesBuilder(this.geo);
        const bounds = (x0, x1, x2, x3) => {
            const a = 3 * x3 - 9 * x2 + 9 * x1 - 3 * x0;
            const b = 6 * x0 - 12 * x1 + 6 * x2;
            const c = 3 * x1 - 3 * x0;
            if (this.geo.snap0(a) === 0) {
                result.add(-c / b);
            }
            else {
                const disc = b * b - 4 * a * c;
                if (disc >= 0) {
                    const sq = Math.sqrt(disc);
                    result.add((-b + sq) / (2 * a));
                    result.add((-b - sq) / (2 * a));
                }
            }
            return result;
        };
        const p0 = this.p0;
        const p1 = this.p1;
        const p2 = this.p2;
        const p3 = this.p3;
        bounds(p0[0], p1[0], p2[0], p3[0]);
        bounds(p0[1], p1[1], p2[1], p3[1]);
        return result.list();
    }
    inflectionTValues() {
        const result = new SegmentTValuesBuilder(this.geo);
        result.addArray(this.boundingTValues());
        const p0 = this.p0;
        const p1 = this.p1;
        const p2 = this.p2;
        const p3 = this.p3;
        const p10x = 3 * (p1[0] - p0[0]);
        const p10y = 3 * (p1[1] - p0[1]);
        const p21x = 6 * (p2[0] - p1[0]);
        const p21y = 6 * (p2[1] - p1[1]);
        const p32x = 3 * (p3[0] - p2[0]);
        const p32y = 3 * (p3[1] - p2[1]);
        const p210x = 6 * (p2[0] - 2 * p1[0] + p0[0]);
        const p210y = 6 * (p2[1] - 2 * p1[1] + p0[1]);
        const p321x = 6 * (p3[0] - 2 * p2[0] + p1[0]);
        const p321y = 6 * (p3[1] - 2 * p2[1] + p1[1]);
        const qx = p10x - p21x + p32x;
        const qy = p10y - p21y + p32y;
        const rx = p21x - 2 * p10x;
        const ry = p21y - 2 * p10y;
        const sx = p10x;
        const sy = p10y;
        const ux = p321x - p210x;
        const uy = p321y - p210y;
        const vx = p210x;
        const vy = p210y;
        const A = qx * uy - qy * ux;
        const B = qx * vy + rx * uy - qy * vx - ry * ux;
        const C = rx * vy + sx * uy - ry * vx - sy * ux;
        const D = sx * vy - sy * vx;
        for (const s of this.geo.solveCubic(A, B, C, D)) {
            result.add(s);
        }
        return result.list();
    }
    boundingBox() {
        const p0 = this.p0;
        const p3 = this.p3;
        const min = [Math.min(p0[0], p3[0]), Math.min(p0[1], p3[1])];
        const max = [Math.max(p0[0], p3[0]), Math.max(p0[1], p3[1])];
        for (const t of this.boundingTValues()) {
            const p = this.point(t);
            min[0] = Math.min(min[0], p[0]);
            min[1] = Math.min(min[1], p[1]);
            max[0] = Math.max(max[0], p[0]);
            max[1] = Math.max(max[1], p[1]);
        }
        return [min, max];
    }
    mapXtoY(x) {
        if (this.geo.snap0(this.p0[0] - x) === 0) {
            return this.p0[1];
        }
        if (this.geo.snap0(this.p3[0] - x) === 0) {
            return this.p3[1];
        }
        const p0 = this.p0[0] - x;
        const p1 = this.p1[0] - x;
        const p2 = this.p2[0] - x;
        const p3 = this.p3[0] - x;
        const A = p3 - 3 * p2 + 3 * p1 - p0;
        const B = 3 * p2 - 6 * p1 + 3 * p0;
        const C = 3 * p1 - 3 * p0;
        const D = p0;
        const tv = this.geo.solveCubic(A, B, C, D);
        for (const t of tv) {
            const ts = this.geo.snap01(t);
            if (ts >= 0 && ts <= 1) {
                return this.point(t)[1];
            }
        }
        return false;
    }
    pointOn(p) {
        if (this.geo.isEqualVec2(this.p0, p) || this.geo.isEqualVec2(this.p3, p)) {
            return true;
        }
        const y = this.mapXtoY(p[0]);
        if (y === false) {
            return false;
        }
        return this.geo.snap0(y - p[1]) === 0;
    }
    toLine() {
        // note: this won't work for arbitrary curves, because they could loop back on themselves,
        // but will work fine for curves that have already been split at all inflection points
        const p0 = this.p0;
        const p1 = this.p1;
        const p2 = this.p2;
        const p3 = this.p3;
        if (
        // vertical line
        (this.geo.snap0(p0[0] - p1[0]) === 0 &&
            this.geo.snap0(p0[0] - p2[0]) === 0 &&
            this.geo.snap0(p0[0] - p3[0]) === 0) || // horizontal line
            (this.geo.snap0(p0[1] - p1[1]) === 0 &&
                this.geo.snap0(p0[1] - p2[1]) === 0 &&
                this.geo.snap0(p0[1] - p3[1]) === 0)) {
            return new SegmentLine(p0, p3, this.geo);
        }
        return null;
    }
    draw(ctx) {
        const p0 = this.p0;
        const p1 = this.p1;
        const p2 = this.p2;
        const p3 = this.p3;
        ctx.moveTo(p0[0], p0[1]);
        ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    }
}
function projectPointOntoSegmentLine(p, seg) {
    const dx = seg.p1[0] - seg.p0[0];
    const dy = seg.p1[1] - seg.p0[1];
    const px = p[0] - seg.p0[0];
    const py = p[1] - seg.p0[1];
    const dist = dx * dx + dy * dy;
    const dot = px * dx + py * dy;
    return dot / dist;
}
function segmentLineIntersectSegmentLine(segA, segB, allowOutOfRange) {
    const geo = segA.geo;
    const a0 = segA.p0;
    const a1 = segA.p1;
    const b0 = segB.p0;
    const b1 = segB.p1;
    const adx = a1[0] - a0[0];
    const ady = a1[1] - a0[1];
    const bdx = b1[0] - b0[0];
    const bdy = b1[1] - b0[1];
    const axb = adx * bdy - ady * bdx;
    if (geo.snap0(axb) === 0) {
        // lines are coincident or parallel
        if (!geo.isCollinear(a0, a1, b0)) {
            // they're not coincident, so they're parallel, with no intersections
            return null;
        }
        // otherwise, segments are on top of each other somehow (aka coincident)
        const tB0onA = projectPointOntoSegmentLine(segB.p0, segA);
        const tB1onA = projectPointOntoSegmentLine(segB.p1, segA);
        const tAMin = geo.snap01(Math.min(tB0onA, tB1onA));
        const tAMax = geo.snap01(Math.max(tB0onA, tB1onA));
        if (tAMax < 0 || tAMin > 1) {
            return null;
        }
        const tA0onB = projectPointOntoSegmentLine(segA.p0, segB);
        const tA1onB = projectPointOntoSegmentLine(segA.p1, segB);
        const tBMin = geo.snap01(Math.min(tA0onB, tA1onB));
        const tBMax = geo.snap01(Math.max(tA0onB, tA1onB));
        if (tBMax < 0 || tBMin > 1) {
            return null;
        }
        return {
            kind: "tRangePairs",
            tStart: [Math.max(0, tAMin), Math.max(0, tBMin)],
            tEnd: [Math.min(1, tAMax), Math.min(1, tBMax)],
        };
    }
    // otherwise, not coincident, so they intersect somewhere
    const dx = a0[0] - b0[0];
    const dy = a0[1] - b0[1];
    return new SegmentTValuePairsBuilder(allowOutOfRange, geo)
        .add((bdx * dy - bdy * dx) / axb, (adx * dy - ady * dx) / axb)
        .done();
}
function segmentLineIntersectSegmentCurve(segA, segB, allowOutOfRange, invert) {
    const geo = segA.geo;
    const a0 = segA.p0;
    const a1 = segA.p1;
    const A = a1[1] - a0[1];
    const B = a0[0] - a1[0];
    const C = A * a0[0] + B * a0[1];
    const bx = segB.getCubicCoefficients(0);
    const by = segB.getCubicCoefficients(1);
    const roots = geo.solveCubic(A * bx[0] + B * by[0], A * bx[1] + B * by[1], A * bx[2] + B * by[2], A * bx[3] + B * by[3] - C);
    const result = new SegmentTValuePairsBuilder(allowOutOfRange, geo);
    if (geo.snap0(A) === 0) {
        // project curve's X component onto line
        for (const t of roots) {
            const X = bx[0] * t * t * t + bx[1] * t * t + bx[2] * t + bx[3];
            const s = (a0[0] - X) / B;
            if (invert) {
                result.add(t, s);
            }
            else {
                result.add(s, t);
            }
        }
    }
    else {
        // project curve's Y component onto line
        for (const t of roots) {
            const Y = by[0] * t * t * t + by[1] * t * t + by[2] * t + by[3];
            const s = (Y - a0[1]) / A;
            if (invert) {
                result.add(t, s);
            }
            else {
                result.add(s, t);
            }
        }
    }
    return result.done();
}
function segmentCurveIntersectSegmentCurve(segA, segB, allowOutOfRange) {
    const geo = segA.geo;
    // dummy coincident calculation for now
    // TODO: implement actual range/equality testing
    if (geo.isEqualVec2(segA.p0, segB.p0)) {
        if (geo.isEqualVec2(segA.p3, segB.p3)) {
            if (geo.isEqualVec2(segA.p1, segB.p1) &&
                geo.isEqualVec2(segA.p2, segB.p2)) {
                return {
                    kind: "tRangePairs",
                    tStart: [0, 0],
                    tEnd: [1, 1],
                };
            }
            else {
                return {
                    kind: "tValuePairs",
                    tValuePairs: [
                        [0, 0],
                        [1, 1],
                    ],
                };
            }
        }
        else {
            return {
                kind: "tValuePairs",
                tValuePairs: [[0, 0]],
            };
        }
    }
    else if (geo.isEqualVec2(segA.p0, segB.p3)) {
        return {
            kind: "tValuePairs",
            tValuePairs: [[0, 1]],
        };
    }
    else if (geo.isEqualVec2(segA.p3, segB.p0)) {
        return {
            kind: "tValuePairs",
            tValuePairs: [[1, 0]],
        };
    }
    else if (geo.isEqualVec2(segA.p3, segB.p3)) {
        return {
            kind: "tValuePairs",
            tValuePairs: [[1, 1]],
        };
    }
    const result = new SegmentTValuePairsBuilder(allowOutOfRange, geo);
    const checkCurves = (c1, t1L, t1R, c2, t2L, t2R) => {
        const bbox1 = c1.boundingBox();
        const bbox2 = c2.boundingBox();
        if (!boundingBoxesIntersect(bbox1, bbox2)) {
            return;
        }
        const t1M = (t1L + t1R) / 2;
        const t2M = (t2L + t2R) / 2;
        if (geo.snap0(t1R - t1L) === 0 && geo.snap0(t2R - t2L) === 0) {
            result.add(t1M, t2M);
            return;
        }
        const [c1L, c1R] = c1.split([0.5]);
        const [c2L, c2R] = c2.split([0.5]);
        checkCurves(c1L, t1L, t1M, c2L, t2L, t2M);
        checkCurves(c1R, t1M, t1R, c2L, t2L, t2M);
        checkCurves(c1L, t1L, t1M, c2R, t2M, t2R);
        checkCurves(c1R, t1M, t1R, c2R, t2M, t2R);
    };
    checkCurves(segA, 0, 1, segB, 0, 1);
    return result.done();
}
// return value:
//   null               => no intersection
//   SegmentTValuePairs => the segments intersect along a series of points, whose position is
//                         represented by T values pairs [segA_tValue, segB_tValue]
//                         note: a T value pair is returned even if it's just a shared vertex!
//   SegmentTRangePairs => the segments are coincident (on top of each other), and intersect along a
//                         segment, ranged by T values
function segmentsIntersect(segA, segB, allowOutOfRange) {
    if (segA instanceof SegmentLine) {
        if (segB instanceof SegmentLine) {
            return segmentLineIntersectSegmentLine(segA, segB, allowOutOfRange);
        }
        else if (segB instanceof SegmentCurve) {
            return segmentLineIntersectSegmentCurve(segA, segB, allowOutOfRange, false);
        }
    }
    else if (segA instanceof SegmentCurve) {
        if (segB instanceof SegmentLine) {
            return segmentLineIntersectSegmentCurve(segB, segA, allowOutOfRange, true);
        }
        else if (segB instanceof SegmentCurve) {
            return segmentCurveIntersectSegmentCurve(segA, segB, allowOutOfRange);
        }
    }
    throw new Error("PolyBool: Unknown segment instance in segmentsIntersect");
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class SegmentBoolBase {
    constructor(data, fill = null, log = null) {
        var _a, _b, _c;
        this.otherFill = null;
        this.id = (_a = log === null || log === void 0 ? void 0 : log.segmentId()) !== null && _a !== void 0 ? _a : -1;
        this.data = data;
        this.myFill = {
            above: (_b = fill === null || fill === void 0 ? void 0 : fill.above) !== null && _b !== void 0 ? _b : null,
            below: (_c = fill === null || fill === void 0 ? void 0 : fill.below) !== null && _c !== void 0 ? _c : null,
        };
    }
}
class SegmentBoolLine extends SegmentBoolBase {
}
class SegmentBoolCurve extends SegmentBoolBase {
}
function copySegmentBool(seg, log) {
    if (seg instanceof SegmentBoolLine) {
        return new SegmentBoolLine(seg.data, seg.myFill, log);
    }
    else if (seg instanceof SegmentBoolCurve) {
        return new SegmentBoolCurve(seg.data, seg.myFill, log);
    }
    throw new Error("PolyBool: Unknown SegmentBool in copySegmentBool");
}
class EventBool {
    constructor(isStart, p, seg, primary) {
        this.status = null;
        this.isStart = isStart;
        this.p = p;
        this.seg = seg;
        this.primary = primary;
    }
}
class ListBool {
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
class Intersecter {
    constructor(selfIntersection, geo, log = null) {
        this.events = new ListBool();
        this.status = new ListBool();
        this.selfIntersection = selfIntersection;
        this.geo = geo;
        this.log = log;
    }
    compareEvents(aStart, a1, a2, aSeg, bStart, b1, b2, bSeg) {
        // compare the selected points first
        const comp = this.geo.compareVec2(a1, b1);
        if (comp !== 0) {
            return comp;
        }
        // the selected points are the same
        if (aSeg instanceof SegmentLine &&
            bSeg instanceof SegmentLine &&
            this.geo.isEqualVec2(a2, b2)) {
            // if the non-selected points are the same too...
            return 0; // then the segments are equal
        }
        if (aStart !== bStart) {
            // if one is a start and the other isn't...
            return aStart ? 1 : -1; // favor the one that isn't the start
        }
        return this.compareSegments(bSeg, aSeg);
    }
    addEvent(ev) {
        this.events.insertBefore(ev, (here) => {
            if (here === ev) {
                return 0;
            }
            return this.compareEvents(ev.isStart, ev.p, ev.other.p, ev.seg.data, here.isStart, here.p, here.other.p, here.seg.data);
        });
    }
    divideEvent(ev, t, p) {
        var _a, _b;
        (_a = this.log) === null || _a === void 0 ? void 0 : _a.segmentDivide(ev.seg, p);
        const [left, right] = ev.seg.data.split([t]);
        // set the *exact* intersection point
        left.setEnd(p);
        right.setStart(p);
        const ns = right instanceof SegmentLine
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
        (_b = this.log) === null || _b === void 0 ? void 0 : _b.segmentChop(ev.seg);
        ev.other.p = p;
        this.addEvent(ev.other);
        return this.addSegment(ns, ev.primary);
    }
    addSegment(seg, primary) {
        const evStart = new EventBool(true, seg.data.start(), seg, primary);
        const evEnd = new EventBool(false, seg.data.end(), seg, primary);
        evStart.other = evEnd;
        evEnd.other = evStart;
        this.addEvent(evStart);
        this.addEvent(evEnd);
        return evStart;
    }
    addLine(from, to, primary = true) {
        const f = this.geo.compareVec2(from, to);
        if (f === 0) {
            // points are equal, so we have a zero-length segment
            return; // skip it
        }
        this.addSegment(new SegmentBoolLine(new SegmentLine(f < 0 ? from : to, f < 0 ? to : from, this.geo), null, this.log), primary);
    }
    addCurve(from, c1, c2, to, primary = true) {
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
            }
            else {
                this.addSegment(new SegmentBoolCurve(f < 0 ? curve : curve.reverse(), null, this.log), primary);
            }
        }
    }
    addRegion(region) {
        // regions are a list of points:
        //  [ [0, 0], [100, 0], [50, 100] ]
        // you can add multiple regions before running calculate
        // regions are a list of points:
        //  [ [0, 0], [100, 0], [50, 100] ]
        // you can add multiple regions before running calculate
        let p1;
        let p2 = region[region.length - 1];
        for (let i = 0; i < region.length; i++) {
            p1 = p2;
            p2 = region[i];
            const f = this.geo.compareVec2(p1, p2);
            if (f === 0) {
                // points are equal, so we have a zero-length segment
                continue; // skip it
            }
            this.addSegment(new SegmentBoolLine(new SegmentLine(f < 0 ? p1 : p2, f < 0 ? p2 : p1, this.geo), null, this.log), true);
        }
    }
    compareSegments(seg1, seg2) {
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
            if (seg1 instanceof SegmentLine &&
                seg2 instanceof SegmentLine &&
                seg2.pointOn(A)) {
                // oh... D is on the line too... so these are the same
                return 0;
            }
            if (seg2 instanceof SegmentCurve) {
                if (this.geo.snap0(A[0] - C[0]) === 0 &&
                    this.geo.snap0(B[0] - C[0]) === 0) {
                    // seg2 is a curve, but the tangent line (C-B) at the start point is vertical, and
                    // collinear with A... so... just sort based on the Y values I guess?
                    return Math.sign(C[1] - A[1]);
                }
            }
        }
        else {
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
    statusFindSurrounding(ev) {
        return this.status.findTransition(ev, (here) => {
            if (ev === here) {
                return 0;
            }
            const c = this.compareSegments(ev.seg.data, here.seg.data);
            return c === 0 ? -1 : c;
        });
    }
    checkIntersection(ev1, ev2) {
        var _a;
        // returns the segment equal to ev1, or null if nothing equal
        const seg1 = ev1.seg;
        const seg2 = ev2.seg;
        (_a = this.log) === null || _a === void 0 ? void 0 : _a.checkIntersection(seg1, seg2);
        const i = segmentsIntersect(seg1.data, seg2.data, false);
        if (i === null) {
            // no intersections
            return null;
        }
        else if (i.kind === "tRangePairs") {
            // segments are parallel or coincident
            const { tStart: [tA1, tB1], tEnd: [tA2, tB2], } = i;
            if ((tA1 === 1 && tA2 === 1 && tB1 === 0 && tB2 === 0) ||
                (tA1 === 0 && tA2 === 0 && tB1 === 1 && tB2 === 1)) {
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
                }
                else {
                    //  (a1)----------(a2)
                    //  (b1)---(b2)
                    this.divideEvent(ev1, tA2, b2);
                }
                return ev2;
            }
            else if (tB1 > 0 && tB1 < 1) {
                if (tA2 === 1 && tB2 === 1) {
                    //         (a1)---(a2)
                    //  (b1)----------(b2)
                    this.divideEvent(ev2, tB1, a1);
                }
                else {
                    // make a2 equal to b2
                    if (tA2 === 1) {
                        //         (a1)---(a2)
                        //  (b1)-----------------(b2)
                        this.divideEvent(ev2, tB2, a2);
                    }
                    else {
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
        }
        else if (i.kind === "tValuePairs") {
            if (i.tValuePairs.length <= 0) {
                return null;
            }
            // process a single intersection
            // skip intersections where endpoints meet
            let minPair = i.tValuePairs[0];
            for (let j = 1; j < i.tValuePairs.length &&
                ((minPair[0] === 0 && minPair[1] === 0) ||
                    (minPair[0] === 0 && minPair[1] === 1) ||
                    (minPair[0] === 1 && minPair[1] === 0) ||
                    (minPair[0] === 1 && minPair[1] === 1)); j++) {
                minPair = i.tValuePairs[j];
            }
            const [tA, tB] = minPair;
            // even though *in theory* seg1.data.point(tA) === seg2.data.point(tB), that isn't exactly
            // correct in practice because intersections aren't exact... so we need to calculate a single
            // intersection point that everyone can share
            const p = tB === 0
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
                        // if nothing is below us, then we're not filled
                        ev.seg.myFill.below = false;
                    }
                    else {
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
                }
                else {
                    // now we fill in any missing transition information, since we are
                    // all-knowing at this point
                    if (ev.seg.otherFill === null) {
                        // if we don't have other information, then we need to figure out if
                        // we're inside the other polygon
                        let inside;
                        if (!below) {
                            // if nothing is below us, then we're not filled
                            inside = false;
                        }
                        else {
                            // otherwise, something is below us
                            // so copy the below segment's other polygon's above
                            if (ev.primary === below.primary) {
                                if (below.seg.otherFill === null) {
                                    throw new Error("PolyBool: Unexpected state of otherFill (null)");
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
            const fill = {
                above: selection[index] === 1, // 1 if filled above
                below: selection[index] === 2, // 2 if filled below
            };
            if (seg instanceof SegmentBoolLine) {
                result.push(new SegmentBoolLine(seg.data, fill, log));
            }
            else if (seg instanceof SegmentBoolCurve) {
                result.push(new SegmentBoolCurve(seg.data, fill, log));
            }
            else {
                throw new Error("PolyBool: Unknown SegmentBool type in SegmentSelector");
            }
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
function SegmentChainer(segments, receiver, geo, log) {
    const chains = [];
    const regions = [];
    for (const segb of segments) {
        let seg = segb.data;
        const pt1 = seg.start();
        const pt2 = seg.end();
        if (seg instanceof SegmentLine && geo.isEqualVec2(pt1, pt2)) {
            console.warn("PolyBool: Warning: Zero-length segment detected; your epsilon is " +
                "probably too small or too large");
            continue;
        }
        log === null || log === void 0 ? void 0 : log.chainStart(seg);
        // search for two chains that this segment matches
        const firstMatch = {
            index: 0,
            matchesHead: false,
            matchesPt1: false,
        };
        const secondMatch = {
            index: 0,
            matchesHead: false,
            matchesPt1: false,
        };
        let nextMatch = firstMatch;
        function setMatch(index, matchesHead, matchesPt1) {
            // return true if we've matched twice
            if (nextMatch) {
                nextMatch.index = index;
                nextMatch.matchesHead = matchesHead;
                nextMatch.matchesPt1 = matchesPt1;
            }
            if (nextMatch === firstMatch) {
                nextMatch = secondMatch;
                return false;
            }
            nextMatch = null;
            return true; // we've matched twice, we're done here
        }
        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i];
            const head = chain[0].start();
            const tail = chain[chain.length - 1].end();
            if (geo.isEqualVec2(head, pt1)) {
                if (setMatch(i, true, true)) {
                    break;
                }
            }
            else if (geo.isEqualVec2(head, pt2)) {
                if (setMatch(i, true, false)) {
                    break;
                }
            }
            else if (geo.isEqualVec2(tail, pt1)) {
                if (setMatch(i, false, true)) {
                    break;
                }
            }
            else if (geo.isEqualVec2(tail, pt2)) {
                if (setMatch(i, false, false)) {
                    break;
                }
            }
        }
        if (nextMatch === firstMatch) {
            // we didn't match anything, so create a new chain
            log === null || log === void 0 ? void 0 : log.chainNew(seg);
            chains.push([seg]);
        }
        else if (nextMatch === secondMatch) {
            // we matched a single chain
            const index = firstMatch.index;
            log === null || log === void 0 ? void 0 : log.chainMatch(index);
            // add the other point to the apporpriate end
            const chain = chains[index];
            if (firstMatch.matchesHead) {
                if (firstMatch.matchesPt1) {
                    seg = seg.reverse();
                    log === null || log === void 0 ? void 0 : log.chainAddHead(index, seg);
                    chain.unshift(seg);
                }
                else {
                    log === null || log === void 0 ? void 0 : log.chainAddHead(index, seg);
                    chain.unshift(seg);
                }
            }
            else {
                if (firstMatch.matchesPt1) {
                    log === null || log === void 0 ? void 0 : log.chainAddTail(index, seg);
                    chain.push(seg);
                }
                else {
                    seg = seg.reverse();
                    log === null || log === void 0 ? void 0 : log.chainAddTail(index, seg);
                    chain.push(seg);
                }
            }
            // simplify chain
            if (seg instanceof SegmentLine) {
                if (firstMatch.matchesHead) {
                    const next = chain[1];
                    if (next &&
                        next instanceof SegmentLine &&
                        geo.isCollinear(seg.p0, next.p0, next.p1)) {
                        next.setStart(seg.p0);
                        log === null || log === void 0 ? void 0 : log.chainSimplifyHead(index, next);
                        chain.shift();
                    }
                }
                else {
                    const next = chain[chain.length - 2];
                    if (next &&
                        next instanceof SegmentLine &&
                        geo.isCollinear(next.p0, next.p1, seg.p1)) {
                        next.setEnd(seg.p1);
                        log === null || log === void 0 ? void 0 : log.chainSimplifyTail(index, next);
                        chain.pop();
                    }
                }
            }
            // check for closed chain
            const segS = chain[0];
            const segE = chain[chain.length - 1];
            if (chain.length > 0 && geo.isEqualVec2(segS.start(), segE.end())) {
                if (segS !== segE &&
                    segS instanceof SegmentLine &&
                    segE instanceof SegmentLine &&
                    geo.isCollinear(segS.p1, segS.p0, segE.p0)) {
                    // closing the chain caused two collinear lines to join, so merge them
                    segS.setStart(segE.p0);
                    log === null || log === void 0 ? void 0 : log.chainSimplifyClose(index, segS);
                    chain.pop();
                }
                // we have a closed chain!
                log === null || log === void 0 ? void 0 : log.chainClose(index);
                chains.splice(index, 1);
                regions.push(chain);
            }
        }
        else {
            // otherwise, we matched two chains, so we need to combine those chains together
            function reverseChain(index) {
                log === null || log === void 0 ? void 0 : log.chainReverse(index);
                const newChain = [];
                for (const s of chains[index]) {
                    newChain.unshift(s.reverse());
                }
                chains[index] = newChain;
            }
            function appendChain(index1, index2) {
                // index1 gets index2 appended to it, and index2 is removed
                const chain1 = chains[index1];
                const chain2 = chains[index2];
                // add seg to chain1's tail
                log === null || log === void 0 ? void 0 : log.chainAddTail(index1, seg);
                chain1.push(seg);
                // simplify chain1's tail
                if (seg instanceof SegmentLine) {
                    const next = chain1[chain1.length - 2];
                    if (next &&
                        next instanceof SegmentLine &&
                        geo.isCollinear(next.p0, next.p1, seg.p1)) {
                        next.setEnd(seg.p1);
                        log === null || log === void 0 ? void 0 : log.chainSimplifyTail(index1, next);
                        chain1.pop();
                    }
                }
                // simplify chain2's head
                const tail = chain1[chain1.length - 1];
                const head = chain2[0];
                if (tail instanceof SegmentLine &&
                    head instanceof SegmentLine &&
                    geo.isCollinear(tail.p0, head.p0, head.p1)) {
                    tail.setEnd(head.p1);
                    log === null || log === void 0 ? void 0 : log.chainSimplifyJoin(index1, index2, tail);
                    chain2.shift();
                }
                log === null || log === void 0 ? void 0 : log.chainJoin(index1, index2);
                chains[index1] = chain1.concat(chain2);
                chains.splice(index2, 1);
            }
            const F = firstMatch.index;
            const S = secondMatch.index;
            log === null || log === void 0 ? void 0 : log.chainConnect(F, S);
            const reverseF = chains[F].length < chains[S].length; // reverse the shorter chain, if needed
            if (firstMatch.matchesHead) {
                if (secondMatch.matchesHead) {
                    if (reverseF) {
                        if (!firstMatch.matchesPt1) {
                            // <<<< F <<<< <-- >>>> S >>>>
                            seg = seg.reverse();
                        }
                        // <<<< F <<<< --> >>>> S >>>>
                        reverseChain(F);
                        // >>>> F >>>> --> >>>> S >>>>
                        appendChain(F, S);
                    }
                    else {
                        if (firstMatch.matchesPt1) {
                            // <<<< F <<<< --> >>>> S >>>>
                            seg = seg.reverse();
                        }
                        // <<<< F <<<< <-- >>>> S >>>>
                        reverseChain(S);
                        // <<<< F <<<< <-- <<<< S <<<<   logically same as:
                        // >>>> S >>>> --> >>>> F >>>>
                        appendChain(S, F);
                    }
                }
                else {
                    if (firstMatch.matchesPt1) {
                        // <<<< F <<<< --> >>>> S >>>>
                        seg = seg.reverse();
                    }
                    // <<<< F <<<< <-- <<<< S <<<<   logically same as:
                    // >>>> S >>>> --> >>>> F >>>>
                    appendChain(S, F);
                }
            }
            else {
                if (secondMatch.matchesHead) {
                    if (!firstMatch.matchesPt1) {
                        // >>>> F >>>> <-- >>>> S >>>>
                        seg = seg.reverse();
                    }
                    // >>>> F >>>> --> >>>> S >>>>
                    appendChain(F, S);
                }
                else {
                    if (reverseF) {
                        if (firstMatch.matchesPt1) {
                            // >>>> F >>>> --> <<<< S <<<<
                            seg = seg.reverse();
                        }
                        // >>>> F >>>> <-- <<<< S <<<<
                        reverseChain(F);
                        // <<<< F <<<< <-- <<<< S <<<<   logically same as:
                        // >>>> S >>>> --> >>>> F >>>>
                        appendChain(S, F);
                    }
                    else {
                        if (!firstMatch.matchesPt1) {
                            // >>>> F >>>> <-- <<<< S <<<<
                            seg = seg.reverse();
                        }
                        // >>>> F >>>> --> <<<< S <<<<
                        reverseChain(S);
                        // >>>> F >>>> --> >>>> S >>>>
                        appendChain(F, S);
                    }
                }
            }
        }
    }
    for (const region of regions) {
        receiver.beginPath();
        for (let i = 0; i < region.length; i++) {
            const seg = region[i];
            if (i === 0) {
                const p0 = seg.start();
                receiver.moveTo(p0[0], p0[1]);
            }
            if (seg instanceof SegmentLine) {
                receiver.lineTo(seg.p1[0], seg.p1[1]);
            }
            else if (seg instanceof SegmentCurve) {
                receiver.bezierCurveTo(seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1], seg.p3[0], seg.p3[1]);
            }
            else {
                throw new Error("PolyBool: Unknown segment instance");
            }
        }
        receiver.closePath();
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class Shape {
    constructor(segments, geo, log = null) {
        this.pathState = { kind: "beginPath" };
        this.geo = geo;
        this.log = log;
        if (segments) {
            this.resultState = { final: true, segments };
        }
        else {
            this.resultState = {
                final: false,
                selfIntersect: new Intersecter(true, this.geo, this.log),
            };
        }
    }
    beginPath() {
        return this.endPath();
    }
    moveTo(x, y) {
        if (this.resultState.final) {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        if (this.pathState.kind !== "beginPath") {
            this.beginPath();
        }
        const current = [x, y];
        this.pathState = {
            kind: "moveTo",
            start: current,
            current,
        };
        return this;
    }
    lineTo(x, y) {
        if (this.resultState.final) {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        if (this.pathState.kind !== "moveTo") {
            throw new Error("PolyBool: Must call moveTo prior to calling lineTo");
        }
        const current = [x, y];
        this.resultState.selfIntersect.addLine(this.pathState.current, current);
        this.pathState.current = current;
        return this;
    }
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        if (this.resultState.final) {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        if (this.pathState.kind !== "moveTo") {
            throw new Error("PolyBool: Must call moveTo prior to calling bezierCurveTo");
        }
        const current = [x, y];
        this.resultState.selfIntersect.addCurve(this.pathState.current, [cp1x, cp1y], [cp2x, cp2y], current);
        this.pathState.current = current;
        return this;
    }
    closePath() {
        if (this.resultState.final) {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        // close with a line if needed
        if (this.pathState.kind === "moveTo" &&
            !this.geo.isEqualVec2(this.pathState.start, this.pathState.current)) {
            this.lineTo(this.pathState.start[0], this.pathState.start[1]);
        }
        return this.endPath();
    }
    endPath() {
        if (this.resultState.final) {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        this.pathState = { kind: "beginPath" };
        return this;
    }
    selfIntersect() {
        if (!this.resultState.final) {
            this.resultState = {
                final: true,
                segments: this.resultState.selfIntersect.calculate(),
            };
        }
        return this.resultState.segments;
    }
    output(receiver) {
        SegmentChainer(this.selfIntersect(), receiver, this.geo, this.log);
        return receiver;
    }
    combine(shape) {
        const int = new Intersecter(false, this.geo, this.log);
        for (const seg of this.selfIntersect()) {
            int.addSegment(copySegmentBool(seg, this.log), true);
        }
        for (const seg of shape.selfIntersect()) {
            int.addSegment(copySegmentBool(seg, this.log), false);
        }
        return new ShapeCombined(int.calculate(), this.geo, this.log);
    }
}
class ShapeCombined {
    constructor(segments, geo, log = null) {
        this.geo = geo;
        this.segments = segments;
        this.log = log;
    }
    union() {
        return new Shape(SegmentSelector.union(this.segments, this.log), this.geo, this.log);
    }
    intersect() {
        return new Shape(SegmentSelector.intersect(this.segments, this.log), this.geo, this.log);
    }
    difference() {
        return new Shape(SegmentSelector.difference(this.segments, this.log), this.geo, this.log);
    }
    differenceRev() {
        return new Shape(SegmentSelector.differenceRev(this.segments, this.log), this.geo, this.log);
    }
    xor() {
        return new Shape(SegmentSelector.xor(this.segments, this.log), this.geo, this.log);
    }
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
    info(msg, data) {
        this.push("info", { msg, data });
    }
    segmentId() {
        return this.nextSegmentId++;
    }
    checkIntersection(seg1, seg2) {
        this.push("check", { seg1, seg2 });
    }
    segmentDivide(seg, p) {
        this.push("div_seg", { seg, p });
    }
    segmentChop(seg) {
        this.push("chop", { seg });
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
    chainNew(seg) {
        this.push("chain_new", { seg });
    }
    chainMatch(index) {
        this.push("chain_match", { index });
    }
    chainClose(index) {
        this.push("chain_close", { index });
    }
    chainAddHead(index, seg) {
        this.push("chain_add_head", { index, seg });
    }
    chainAddTail(index, seg) {
        this.push("chain_add_tail", { index, seg });
    }
    chainSimplifyHead(index, seg) {
        this.push("chain_simp_head", { index, seg });
    }
    chainSimplifyTail(index, seg) {
        this.push("chain_simp_tail", { index, seg });
    }
    chainSimplifyClose(index, seg) {
        this.push("chain_simp_close", { index, seg });
    }
    chainSimplifyJoin(index1, index2, seg) {
        this.push("chain_simp_join", { index1, index2, seg });
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
    constructor(geo = new GeometryEpsilon(), log = null) {
        this.geo = geo;
        this.log = log;
    }
    shape() {
        return new Shape(null, this.geo, this.log);
    }
    buildLog(enable) {
        var _a;
        this.log = enable ? new BuildLog() : null;
        return (_a = this.log) === null || _a === void 0 ? void 0 : _a.list;
    }
    segments(poly) {
        const shape = this.shape();
        for (const region of poly.regions) {
            shape.beginPath();
            const lastPoint = region[region.length - 1];
            shape.moveTo(lastPoint[lastPoint.length - 2], lastPoint[lastPoint.length - 1]);
            for (const p of region) {
                if (p.length === 2) {
                    shape.lineTo(p[0], p[1]);
                }
                else if (p.length === 6) {
                    shape.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
                }
                else {
                    throw new Error("PolyBool: Invalid point in region");
                }
            }
            shape.closePath();
        }
        return { shape, inverted: poly.inverted };
    }
    combine(segments1, segments2) {
        return {
            shape: segments1.shape.combine(segments2.shape),
            inverted1: segments1.inverted,
            inverted2: segments2.inverted,
        };
    }
    selectUnion(combined) {
        return {
            shape: combined.inverted1
                ? combined.inverted2
                    ? combined.shape.intersect()
                    : combined.shape.difference()
                : combined.inverted2
                    ? combined.shape.differenceRev()
                    : combined.shape.union(),
            inverted: combined.inverted1 || combined.inverted2,
        };
    }
    selectIntersect(combined) {
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
    selectDifference(combined) {
        return {
            shape: combined.inverted1
                ? combined.inverted2
                    ? combined.shape.differenceRev()
                    : combined.shape.union()
                : combined.inverted2
                    ? combined.shape.intersect()
                    : combined.shape.difference(),
            inverted: combined.inverted1 && !combined.inverted2,
        };
    }
    selectDifferenceRev(combined) {
        return {
            shape: combined.inverted1
                ? combined.inverted2
                    ? combined.shape.difference()
                    : combined.shape.intersect()
                : combined.inverted2
                    ? combined.shape.union()
                    : combined.shape.differenceRev(),
            inverted: !combined.inverted1 && combined.inverted2,
        };
    }
    selectXor(combined) {
        return {
            shape: combined.shape.xor(),
            inverted: combined.inverted1 !== combined.inverted2,
        };
    }
    polygon(segments) {
        const regions = [];
        const receiver = {
            beginPath: () => {
                regions.push([]);
            },
            moveTo: () => { },
            lineTo: (x, y) => {
                regions[regions.length - 1].push([x, y]);
            },
            bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) => {
                regions[regions.length - 1].push([c1x, c1y, c2x, c2y, x, y]);
            },
            closePath: () => { },
        };
        segments.shape.output(receiver);
        return { regions, inverted: segments.inverted };
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
const polybool = new PolyBool();

export { BuildLog, GeometryEpsilon, Intersecter, PolyBool, SegmentBase, SegmentChainer, SegmentCurve, SegmentLine, SegmentSelector, SegmentTValuePairsBuilder, SegmentTValuesBuilder, Shape, ShapeCombined, polybool as default, projectPointOntoSegmentLine, segmentCurveIntersectSegmentCurve, segmentLineIntersectSegmentCurve, segmentLineIntersectSegmentLine, segmentsIntersect };
