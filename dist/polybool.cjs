'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
    solveCubicNormalized(a, b, c) {
        // based somewhat on gsl_poly_solve_cubic from GNU Scientific Library
        const a3 = a / 3;
        const b3 = b / 3;
        const Q = a3 * a3 - b3;
        const R = a3 * (a3 * a3 - b / 2) + c / 2;
        if (Math.abs(R) < this.epsilon && Math.abs(Q) < this.epsilon) {
            return [-a3];
        }
        const F = a3 * (a3 * (4 * a3 * c - b3 * b) - 2 * b * c) + 4 * b3 * b3 * b3 + c * c;
        if (Math.abs(F) < this.epsilon) {
            const sqrtQ = Math.sqrt(Q);
            return R > 0
                ? [-2 * sqrtQ - a / 3, sqrtQ - a / 3]
                : [-sqrtQ - a / 3, 2 * sqrtQ - a / 3];
        }
        const Q3 = Q * Q * Q;
        const R2 = R * R;
        if (R2 < Q3) {
            const ratio = (R < 0 ? -1 : 1) * Math.sqrt(R2 / Q3);
            const theta = Math.acos(ratio);
            const norm = -2 * Math.sqrt(Q);
            const x0 = norm * Math.cos(theta / 3) - a3;
            const x1 = norm * Math.cos((theta + 2 * Math.PI) / 3) - a3;
            const x2 = norm * Math.cos((theta - 2 * Math.PI) / 3) - a3;
            return [x0, x1, x2].sort((x, y) => x - y);
        }
        else {
            const A = (R < 0 ? 1 : -1) * Math.pow(Math.abs(R) + Math.sqrt(R2 - Q3), 1 / 3);
            const B = Math.abs(A) >= this.epsilon ? Q / A : 0;
            return [A + B - a3];
        }
    }
    solveCubic(a, b, c, d) {
        if (Math.abs(a) < this.epsilon) {
            // quadratic
            if (Math.abs(b) < this.epsilon) {
                // linear case
                if (Math.abs(c) < this.epsilon) {
                    // horizontal line
                    return Math.abs(d) < this.epsilon ? [0] : [];
                }
                return [-d / c];
            }
            const b2 = 2 * b;
            let D = c * c - 4 * b * d;
            if (Math.abs(D) < this.epsilon) {
                return [-c / b2];
            }
            else if (D > 0) {
                D = Math.sqrt(D);
                return [(-c + D) / b2, (-c - D) / b2].sort((x, y) => x - y);
            }
            return [];
        }
        return this.solveCubicNormalized(b / a, c / a, d / a);
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
    copy() {
        return new SegmentLine(this.p0, this.p1, this.geo);
    }
    isEqual(other) {
        return (this.geo.isEqualVec2(this.p0, other.p0) &&
            this.geo.isEqualVec2(this.p1, other.p1));
    }
    start() {
        return this.p0;
    }
    start2() {
        return this.p1;
    }
    end2() {
        return this.p0;
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
        return ctx;
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
    copy() {
        return new SegmentCurve(this.p0, this.p1, this.p2, this.p3, this.geo);
    }
    isEqual(other) {
        return (this.geo.isEqualVec2(this.p0, other.p0) &&
            this.geo.isEqualVec2(this.p1, other.p1) &&
            this.geo.isEqualVec2(this.p2, other.p2) &&
            this.geo.isEqualVec2(this.p3, other.p3));
    }
    start() {
        return this.p0;
    }
    start2() {
        return this.p1;
    }
    end2() {
        return this.p2;
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
    mapXtoT(x, force = false) {
        if (this.geo.snap0(this.p0[0] - x) === 0) {
            return 0;
        }
        if (this.geo.snap0(this.p3[0] - x) === 0) {
            return 1;
        }
        const p0 = this.p0[0] - x;
        const p1 = this.p1[0] - x;
        const p2 = this.p2[0] - x;
        const p3 = this.p3[0] - x;
        const R = [
            p3 - 3 * p2 + 3 * p1 - p0,
            3 * p2 - 6 * p1 + 3 * p0,
            3 * p1 - 3 * p0,
            p0,
        ];
        for (const t of this.geo.solveCubic(R[0], R[1], R[2], R[3])) {
            const ts = this.geo.snap01(t);
            if (ts >= 0 && ts <= 1) {
                return t;
            }
        }
        // force a solution if we know there is one...
        if (force ||
            (x >= Math.min(this.p0[0], this.p3[0]) &&
                x <= Math.max(this.p0[0], this.p3[0]))) {
            for (let attempt = 0; attempt < 4; attempt++) {
                // collapse an R value to 0, this is so wrong!!!
                let ii = -1;
                for (let i = 0; i < 4; i++) {
                    if (R[i] !== 0 && (ii < 0 || Math.abs(R[i]) < Math.abs(R[ii]))) {
                        ii = i;
                    }
                }
                if (ii < 0) {
                    return 0;
                }
                R[ii] = 0;
                // solve again, but with another 0 to help
                for (const t of this.geo.solveCubic(R[0], R[1], R[2], R[3])) {
                    const ts = this.geo.snap01(t);
                    if (ts >= 0 && ts <= 1) {
                        return t;
                    }
                }
            }
        }
        return false;
    }
    mapXtoY(x, force = false) {
        const t = this.mapXtoT(x, force);
        if (t === false) {
            return false;
        }
        return this.point(t)[1];
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
        return ctx;
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
    if (geo.snap0(B) === 0) {
        // vertical line
        const t = segB.mapXtoT(a0[0], false);
        if (t === false) {
            return null;
        }
        const y = segB.point(t)[1];
        const s = (y - a0[1]) / A;
        const result = new SegmentTValuePairsBuilder(allowOutOfRange, geo);
        if (invert) {
            result.add(t, s);
        }
        else {
            result.add(s, t);
        }
        return result.done();
    }
    const C = A * a0[0] + B * a0[1];
    const bx = segB.getCubicCoefficients(0);
    const by = segB.getCubicCoefficients(1);
    const rA = A * bx[0] + B * by[0];
    const rB = A * bx[1] + B * by[1];
    const rC = A * bx[2] + B * by[2];
    const rD = A * bx[3] + B * by[3] - C;
    const roots = geo.solveCubic(rA, rB, rC, rD);
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
    constructor(data, fill = null, closed = false, log = null) {
        var _a, _b, _c;
        this.otherFill = null;
        this.id = (_a = log === null || log === void 0 ? void 0 : log.segmentId()) !== null && _a !== void 0 ? _a : -1;
        this.data = data;
        this.myFill = {
            above: (_b = fill === null || fill === void 0 ? void 0 : fill.above) !== null && _b !== void 0 ? _b : null,
            below: (_c = fill === null || fill === void 0 ? void 0 : fill.below) !== null && _c !== void 0 ? _c : null,
        };
        this.closed = closed;
    }
}
class SegmentBoolLine extends SegmentBoolBase {
}
class SegmentBoolCurve extends SegmentBoolBase {
}
function copySegmentBool(seg, log) {
    if (seg instanceof SegmentBoolLine) {
        return new SegmentBoolLine(seg.data, seg.myFill, seg.closed, log);
    }
    else if (seg instanceof SegmentBoolCurve) {
        return new SegmentBoolCurve(seg.data, seg.myFill, seg.closed, log);
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
        this.currentPath = [];
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
            ? new SegmentBoolLine(right, ev.seg.myFill, ev.seg.closed, this.log)
            : right instanceof SegmentCurve
                ? new SegmentBoolCurve(right, ev.seg.myFill, ev.seg.closed, this.log)
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
    beginPath() {
        this.currentPath = [];
    }
    closePath() {
        for (const seg of this.currentPath) {
            seg.closed = true;
        }
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
        const seg = new SegmentBoolLine(new SegmentLine(f < 0 ? from : to, f < 0 ? to : from, this.geo), null, false, this.log);
        this.currentPath.push(seg);
        this.addSegment(seg, primary);
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
                const seg = new SegmentBoolCurve(f < 0 ? curve : curve.reverse(), null, false, this.log);
                this.currentPath.push(seg);
                this.addSegment(seg, primary);
            }
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
                const y = seg2.mapXtoY(A[0], true);
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
                            toggle = ev.seg.closed;
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
                        // if we are new then we toggle if we're part of a closed path
                        toggle = ev.seg.closed;
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
        const flags = selection[index];
        const above = (flags & 1) !== 0; // bit 1 if filled above
        const below = (flags & 2) !== 0; // bit 2 if filled below
        if ((!seg.closed && flags !== 0) || (seg.closed && above !== below)) {
            // copy the segment to the results, while also calculating the fill status
            const fill = { above, below };
            if (seg instanceof SegmentBoolLine) {
                result.push(new SegmentBoolLine(seg.data, fill, seg.closed, log));
            }
            else if (seg instanceof SegmentBoolCurve) {
                result.push(new SegmentBoolCurve(seg.data, fill, seg.closed, log));
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
    // prettier-ignore
    static union(segments, log) {
        // primary | secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   yes if open         4
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
        return select(segments, [
            4, 2, 1, 0,
            2, 2, 0, 0,
            1, 0, 1, 0,
            0, 0, 0, 0
        ], log);
    }
    // prettier-ignore
    static intersect(segments, log) {
        // primary & secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   no                  0
        //    0      0      0      1   =>   no                  0
        //    0      0      1      0   =>   no                  0
        //    0      0      1      1   =>   yes if open         4
        //    0      1      0      0   =>   no                  0
        //    0      1      0      1   =>   yes filled below    2
        //    0      1      1      0   =>   no                  0
        //    0      1      1      1   =>   yes filled below    2
        //    1      0      0      0   =>   no                  0
        //    1      0      0      1   =>   no                  0
        //    1      0      1      0   =>   yes filled above    1
        //    1      0      1      1   =>   yes filled above    1
        //    1      1      0      0   =>   yes if open         4
        //    1      1      0      1   =>   yes filled below    2
        //    1      1      1      0   =>   yes filled above    1
        //    1      1      1      1   =>   no                  0
        return select(segments, [
            0, 0, 0, 4,
            0, 2, 0, 2,
            0, 0, 1, 1,
            4, 2, 1, 0
        ], log);
    }
    // prettier-ignore
    static difference(segments, log) {
        // primary - secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   yes if open         4
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
        return select(segments, [
            4, 0, 0, 0,
            2, 0, 2, 0,
            1, 1, 0, 0,
            0, 1, 2, 0
        ], log);
    }
    // prettier-ignore
    static differenceRev(segments, log) {
        // secondary - primary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   yes if open         4
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
        return select(segments, [
            4, 2, 1, 0,
            0, 0, 1, 1,
            0, 2, 0, 2,
            0, 0, 0, 0
        ], log);
    }
    // prettier-ignore
    static xor(segments, log) {
        // primary ^ secondary
        // above1 below1 above2 below2    Keep?               Value
        //    0      0      0      0   =>   yes if open         4
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
        return select(segments, [
            4, 2, 1, 0,
            2, 0, 0, 1,
            1, 0, 0, 2,
            0, 1, 2, 0
        ], log);
    }
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
function joinLines(seg1, seg2, geo) {
    if (geo.isCollinear(seg1.p0, seg1.p1, seg2.p1)) {
        return new SegmentLine(seg1.p0, seg2.p1, geo);
    }
    return false;
}
function joinCurves(seg1, seg2, geo) {
    if (geo.isCollinear(seg1.p2, seg1.p3, seg2.p1)) {
        const dx = seg2.p1[0] - seg1.p2[0];
        const dy = seg2.p1[1] - seg1.p2[1];
        const t = Math.abs(dx) > Math.abs(dy)
            ? (seg1.p3[0] - seg1.p2[0]) / dx
            : (seg1.p3[1] - seg1.p2[1]) / dy;
        const ts = geo.snap01(t);
        if (ts !== 0 && ts !== 1) {
            const ns = new SegmentCurve(seg1.p0, [
                seg1.p0[0] + (seg1.p1[0] - seg1.p0[0]) / t,
                seg1.p0[1] + (seg1.p1[1] - seg1.p0[1]) / t,
            ], [
                seg2.p2[0] - (t * (seg2.p3[0] - seg2.p2[0])) / (1 - t),
                seg2.p2[1] - (t * (seg2.p3[1] - seg2.p2[1])) / (1 - t),
            ], seg2.p3, geo);
            // double check that if we split at T, we get seg1/seg2 back
            const [left, right] = ns.split([t]);
            if (left.isEqual(seg1) && right.isEqual(seg2)) {
                return ns;
            }
        }
    }
    return false;
}
function joinSegments(seg1, seg2, geo) {
    if (seg1 === seg2) {
        return false;
    }
    if (seg1 instanceof SegmentLine && seg2 instanceof SegmentLine) {
        return joinLines(seg1, seg2, geo);
    }
    if (seg1 instanceof SegmentCurve && seg2 instanceof SegmentCurve) {
        return joinCurves(seg1, seg2, geo);
    }
    return false;
}
function SegmentChainer(segments, geo, log) {
    const closedChains = [];
    const openChains = [];
    const regions = [];
    for (const segb of segments) {
        let seg = segb.data;
        const closed = segb.closed;
        const chains = closed ? closedChains : openChains;
        const pt1 = seg.start();
        const pt2 = seg.end();
        if (seg instanceof SegmentLine && geo.isEqualVec2(pt1, pt2)) {
            console.warn("PolyBool: Warning: Zero-length segment detected; your epsilon is " +
                "probably too small or too large");
            continue;
        }
        log === null || log === void 0 ? void 0 : log.chainStart(seg, closed);
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
            log === null || log === void 0 ? void 0 : log.chainNew(seg, closed);
            chains.push([seg]);
        }
        else if (nextMatch === secondMatch) {
            // we matched a single chain
            const index = firstMatch.index;
            log === null || log === void 0 ? void 0 : log.chainMatch(index, closed);
            // add the other point to the apporpriate end
            const chain = chains[index];
            if (firstMatch.matchesHead) {
                if (firstMatch.matchesPt1) {
                    seg = seg.reverse();
                    log === null || log === void 0 ? void 0 : log.chainAddHead(index, seg, closed);
                    chain.unshift(seg);
                }
                else {
                    log === null || log === void 0 ? void 0 : log.chainAddHead(index, seg, closed);
                    chain.unshift(seg);
                }
            }
            else {
                if (firstMatch.matchesPt1) {
                    log === null || log === void 0 ? void 0 : log.chainAddTail(index, seg, closed);
                    chain.push(seg);
                }
                else {
                    seg = seg.reverse();
                    log === null || log === void 0 ? void 0 : log.chainAddTail(index, seg, closed);
                    chain.push(seg);
                }
            }
            // simplify chain
            if (firstMatch.matchesHead) {
                const next = chain[1];
                const newSeg = joinSegments(seg, next, geo);
                if (newSeg) {
                    log === null || log === void 0 ? void 0 : log.chainSimplifyHead(index, newSeg, closed);
                    chain.shift();
                    chain[0] = newSeg;
                }
            }
            else {
                const next = chain[chain.length - 2];
                const newSeg = joinSegments(next, seg, geo);
                if (newSeg) {
                    log === null || log === void 0 ? void 0 : log.chainSimplifyTail(index, newSeg, closed);
                    chain.pop();
                    chain[chain.length - 1] = newSeg;
                }
            }
            // check for closed chain
            if (closed) {
                const segS = chain[0];
                const segE = chain[chain.length - 1];
                if (chain.length > 0 && geo.isEqualVec2(segS.start(), segE.end())) {
                    const newStart = joinSegments(segE, segS, geo);
                    if (newStart) {
                        log === null || log === void 0 ? void 0 : log.chainSimplifyClose(index, newStart, closed);
                        chain.pop();
                        chain[0] = newStart;
                    }
                    // we have a closed chain!
                    log === null || log === void 0 ? void 0 : log.chainClose(index, closed);
                    chains.splice(index, 1);
                    regions.push(chain);
                }
            }
        }
        else {
            // otherwise, we matched two chains, so we need to combine those chains together
            function reverseChain(index) {
                log === null || log === void 0 ? void 0 : log.chainReverse(index, closed);
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
                log === null || log === void 0 ? void 0 : log.chainAddTail(index1, seg, closed);
                chain1.push(seg);
                // simplify chain1's tail
                const next = chain1[chain1.length - 2];
                const newEnd = joinSegments(next, seg, geo);
                if (newEnd) {
                    log === null || log === void 0 ? void 0 : log.chainSimplifyTail(index1, newEnd, closed);
                    chain1.pop();
                    chain1[chain1.length - 1] = newEnd;
                }
                // simplify chain2's head
                const tail = chain1[chain1.length - 1];
                const head = chain2[0];
                const newJoin = joinSegments(tail, head, geo);
                if (newJoin) {
                    log === null || log === void 0 ? void 0 : log.chainSimplifyJoin(index1, index2, newJoin, closed);
                    chain2.shift();
                    chain1[chain1.length - 1] = newJoin;
                }
                log === null || log === void 0 ? void 0 : log.chainJoin(index1, index2, closed);
                chains[index1] = chain1.concat(chain2);
                chains.splice(index2, 1);
            }
            const F = firstMatch.index;
            const S = secondMatch.index;
            log === null || log === void 0 ? void 0 : log.chainConnect(F, S, closed);
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
    for (const c of openChains) {
        regions.push(c);
    }
    return regions;
}
function segmentsToReceiver(segments, geo, receiver, matrix) {
    const [a, b, c, d, e, f] = matrix;
    receiver.beginPath();
    for (const region of segments) {
        if (region.length <= 0) {
            continue;
        }
        for (let i = 0; i < region.length; i++) {
            const seg = region[i];
            if (i === 0) {
                const [p0x, p0y] = seg.start();
                receiver.moveTo(a * p0x + c * p0y + e, b * p0x + d * p0y + f);
            }
            if (seg instanceof SegmentLine) {
                const [p1x, p1y] = seg.p1;
                receiver.lineTo(a * p1x + c * p1y + e, b * p1x + d * p1y + f);
            }
            else if (seg instanceof SegmentCurve) {
                const [p1x, p1y] = seg.p1;
                const [p2x, p2y] = seg.p2;
                const [p3x, p3y] = seg.p3;
                receiver.bezierCurveTo(a * p1x + c * p1y + e, b * p1x + d * p1y + f, a * p2x + c * p2y + e, b * p2x + d * p2y + f, a * p3x + c * p3y + e, b * p3x + d * p3y + f);
            }
            else {
                throw new Error("PolyBool: Unknown segment instance");
            }
        }
        const first = region[0];
        const last = region[region.length - 1];
        if (geo.isEqualVec2(first.start(), last.end())) {
            receiver.closePath();
        }
    }
    return receiver;
}

//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//
class Shape {
    constructor(geo, segments = null, log = null) {
        this.pathState = { kind: "beginPath" };
        this.saveStack = [];
        this.matrix = [1, 0, 0, 1, 0, 0];
        this.geo = geo;
        this.log = log;
        if (segments) {
            this.resultState = { state: "seg", segments };
        }
        else {
            this.resultState = {
                state: "new",
                selfIntersect: new Intersecter(true, this.geo, this.log),
            };
        }
    }
    setTransform(a, b, c, d, e, f) {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        this.matrix = [a, b, c, d, e, f];
        return this;
    }
    resetTransform() {
        this.matrix = [1, 0, 0, 1, 0, 0];
        return this;
    }
    getTransform() {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        const [a, b, c, d, e, f] = this.matrix;
        return { a, b, c, d, e, f };
    }
    transform(a, b, c, d, e, f) {
        const [a0, b0, c0, d0, e0, f0] = this.matrix;
        this.matrix = [
            a0 * a + c0 * b,
            b0 * a + d0 * b,
            a0 * c + c0 * d,
            b0 * c + d0 * d,
            a0 * e + c0 * f + e0,
            b0 * e + d0 * f + f0,
        ];
        return this;
    }
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const [a0, b0, c0, d0, e0, f0] = this.matrix;
        this.matrix = [
            a0 * cos + c0 * sin,
            b0 * cos + d0 * sin,
            c0 * cos - a0 * sin,
            d0 * cos - b0 * sin,
            e0,
            f0,
        ];
        return this;
    }
    rotateDeg(angle) {
        const ang = ((angle % 360) + 360) % 360;
        if (ang === 0) {
            return this;
        }
        let cos = 0;
        let sin = 0;
        if (ang === 90) {
            sin = 1;
        }
        else if (ang === 180) {
            cos = -1;
        }
        else if (ang === 270) {
            sin = -1;
        }
        else if (ang === 45) {
            cos = sin = Math.SQRT1_2;
        }
        else if (ang === 135) {
            sin = Math.SQRT1_2;
            cos = -Math.SQRT1_2;
        }
        else if (ang === 225) {
            cos = sin = -Math.SQRT1_2;
        }
        else if (ang === 315) {
            cos = Math.SQRT1_2;
            sin = -Math.SQRT1_2;
        }
        else if (ang === 30) {
            cos = Math.sqrt(3) / 2;
            sin = 0.5;
        }
        else if (ang === 60) {
            cos = 0.5;
            sin = Math.sqrt(3) / 2;
        }
        else if (ang === 120) {
            cos = -0.5;
            sin = Math.sqrt(3) / 2;
        }
        else if (ang === 150) {
            cos = -Math.sqrt(3) / 2;
            sin = 0.5;
        }
        else if (ang === 210) {
            cos = -Math.sqrt(3) / 2;
            sin = -0.5;
        }
        else if (ang === 240) {
            cos = -0.5;
            sin = -Math.sqrt(3) / 2;
        }
        else if (ang === 300) {
            cos = 0.5;
            sin = -Math.sqrt(3) / 2;
        }
        else if (ang === 330) {
            cos = Math.sqrt(3) / 2;
            sin = -0.5;
        }
        else {
            const rad = (Math.PI * ang) / 180;
            cos = Math.cos(rad);
            sin = Math.sin(rad);
        }
        const [a0, b0, c0, d0, e0, f0] = this.matrix;
        this.matrix = [
            a0 * cos + c0 * sin,
            b0 * cos + d0 * sin,
            c0 * cos - a0 * sin,
            d0 * cos - b0 * sin,
            e0,
            f0,
        ];
        return this;
    }
    scale(sx, sy) {
        const [a0, b0, c0, d0, e0, f0] = this.matrix;
        this.matrix = [a0 * sx, b0 * sx, c0 * sy, d0 * sy, e0, f0];
        return this;
    }
    translate(tx, ty) {
        const [a0, b0, c0, d0, e0, f0] = this.matrix;
        this.matrix = [
            a0,
            b0,
            c0,
            d0,
            a0 * tx + c0 * ty + e0,
            b0 * tx + d0 * ty + f0,
        ];
        return this;
    }
    save() {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        this.saveStack.push({ matrix: this.matrix });
        return this;
    }
    restore() {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        const s = this.saveStack.pop();
        if (s) {
            this.matrix = s.matrix;
        }
        return this;
    }
    transformPoint(x, y) {
        const [a, b, c, d, e, f] = this.matrix;
        return [a * x + c * y + e, b * x + d * y + f];
    }
    beginPath() {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        this.resultState.selfIntersect.beginPath();
        return this.endPath();
    }
    moveTo(x, y) {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        if (this.pathState.kind !== "beginPath") {
            this.beginPath();
        }
        const current = this.transformPoint(x, y);
        this.pathState = {
            kind: "moveTo",
            start: current,
            current,
        };
        return this;
    }
    lineTo(x, y) {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        if (this.pathState.kind !== "moveTo") {
            throw new Error("PolyBool: Must call moveTo prior to calling lineTo");
        }
        const current = this.transformPoint(x, y);
        this.resultState.selfIntersect.addLine(this.pathState.current, current);
        this.pathState.current = current;
        return this;
    }
    rect(x, y, width, height) {
        return this.moveTo(x, y)
            .lineTo(x + width, y)
            .lineTo(x + width, y + height)
            .lineTo(x, y + height)
            .closePath()
            .moveTo(x, y);
    }
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        if (this.pathState.kind !== "moveTo") {
            throw new Error("PolyBool: Must call moveTo prior to calling bezierCurveTo");
        }
        const current = this.transformPoint(x, y);
        this.resultState.selfIntersect.addCurve(this.pathState.current, this.transformPoint(cp1x, cp1y), this.transformPoint(cp2x, cp2y), current);
        this.pathState.current = current;
        return this;
    }
    closePath() {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        // close with a line if needed
        if (this.pathState.kind === "moveTo" &&
            !this.geo.isEqualVec2(this.pathState.start, this.pathState.current)) {
            this.resultState.selfIntersect.addLine(this.pathState.current, this.pathState.start);
            this.pathState.current = this.pathState.start;
        }
        this.resultState.selfIntersect.closePath();
        return this.endPath();
    }
    endPath() {
        if (this.resultState.state !== "new") {
            throw new Error("PolyBool: Cannot change shape after using it in an operation");
        }
        this.pathState = { kind: "beginPath" };
        return this;
    }
    selfIntersect() {
        if (this.resultState.state === "new") {
            this.resultState = {
                state: "seg",
                segments: this.resultState.selfIntersect.calculate(),
            };
        }
        return this.resultState.segments;
    }
    segments() {
        if (this.resultState.state !== "reg") {
            const seg = this.selfIntersect();
            this.resultState = {
                state: "reg",
                segments: seg,
                regions: SegmentChainer(seg, this.geo, this.log),
            };
        }
        return this.resultState.regions;
    }
    output(receiver, matrix = [1, 0, 0, 1, 0, 0]) {
        return segmentsToReceiver(this.segments(), this.geo, receiver, matrix);
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
        return new Shape(this.geo, SegmentSelector.union(this.segments, this.log), this.log);
    }
    intersect() {
        return new Shape(this.geo, SegmentSelector.intersect(this.segments, this.log), this.log);
    }
    difference() {
        return new Shape(this.geo, SegmentSelector.difference(this.segments, this.log), this.log);
    }
    differenceRev() {
        return new Shape(this.geo, SegmentSelector.differenceRev(this.segments, this.log), this.log);
    }
    xor() {
        return new Shape(this.geo, SegmentSelector.xor(this.segments, this.log), this.log);
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
    chainStart(seg, closed) {
        this.push("chain_start", { seg, closed });
    }
    chainNew(seg, closed) {
        this.push("chain_new", { seg, closed });
    }
    chainMatch(index, closed) {
        this.push("chain_match", { index, closed });
    }
    chainClose(index, closed) {
        this.push("chain_close", { index, closed });
    }
    chainAddHead(index, seg, closed) {
        this.push("chain_add_head", { index, seg, closed });
    }
    chainAddTail(index, seg, closed) {
        this.push("chain_add_tail", { index, seg, closed });
    }
    chainSimplifyHead(index, seg, closed) {
        this.push("chain_simp_head", { index, seg, closed });
    }
    chainSimplifyTail(index, seg, closed) {
        this.push("chain_simp_tail", { index, seg, closed });
    }
    chainSimplifyClose(index, seg, closed) {
        this.push("chain_simp_close", { index, seg, closed });
    }
    chainSimplifyJoin(index1, index2, seg, closed) {
        this.push("chain_simp_join", { index1, index2, seg, closed });
    }
    chainConnect(index1, index2, closed) {
        this.push("chain_con", { index1, index2, closed });
    }
    chainReverse(index, closed) {
        this.push("chain_rev", { index, closed });
    }
    chainJoin(index1, index2, closed) {
        this.push("chain_join", { index1, index2, closed });
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
        return new Shape(this.geo, null, this.log);
    }
    buildLog(enable) {
        var _a;
        this.log = enable ? new BuildLog() : null;
        return (_a = this.log) === null || _a === void 0 ? void 0 : _a.list;
    }
    segments(poly) {
        const shape = this.shape();
        shape.beginPath();
        for (const region of poly.regions) {
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
            beginPath: () => { },
            moveTo: () => {
                regions.push([]);
            },
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

exports.EventBool = EventBool;
exports.Geometry = Geometry;
exports.GeometryEpsilon = GeometryEpsilon;
exports.Intersecter = Intersecter;
exports.ListBool = ListBool;
exports.PolyBool = PolyBool;
exports.SegmentBase = SegmentBase;
exports.SegmentBoolBase = SegmentBoolBase;
exports.SegmentBoolCurve = SegmentBoolCurve;
exports.SegmentBoolLine = SegmentBoolLine;
exports.SegmentChainer = SegmentChainer;
exports.SegmentCurve = SegmentCurve;
exports.SegmentLine = SegmentLine;
exports.SegmentSelector = SegmentSelector;
exports.SegmentTValuePairsBuilder = SegmentTValuePairsBuilder;
exports.SegmentTValuesBuilder = SegmentTValuesBuilder;
exports.Shape = Shape;
exports.ShapeCombined = ShapeCombined;
exports.boundingBoxesIntersect = boundingBoxesIntersect;
exports.copySegmentBool = copySegmentBool;
exports.default = polybool;
exports.joinCurves = joinCurves;
exports.joinLines = joinLines;
exports.joinSegments = joinSegments;
exports.lerp = lerp;
exports.lerpVec2 = lerpVec2;
exports.projectPointOntoSegmentLine = projectPointOntoSegmentLine;
exports.segmentCurveIntersectSegmentCurve = segmentCurveIntersectSegmentCurve;
exports.segmentLineIntersectSegmentCurve = segmentLineIntersectSegmentCurve;
exports.segmentLineIntersectSegmentLine = segmentLineIntersectSegmentLine;
exports.segmentsIntersect = segmentsIntersect;
exports.segmentsToReceiver = segmentsToReceiver;
