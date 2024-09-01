type Vec2 = [number, number];
type Vec6 = [number, number, number, number, number, number];
declare function lerp(a: number, b: number, t: number): number;
declare function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2;
declare function boundingBoxesIntersect(bbox1: [Vec2, Vec2], bbox2: [Vec2, Vec2]): boolean;
declare abstract class Geometry {
    abstract snap0(v: number): number;
    abstract snap01(v: number): number;
    abstract isCollinear(p1: Vec2, p2: Vec2, p3: Vec2): boolean;
    abstract solveCubic(a: number, b: number, c: number, d: number): number[];
    abstract isEqualVec2(a: Vec2, b: Vec2): boolean;
    abstract compareVec2(a: Vec2, b: Vec2): number;
}
declare class GeometryEpsilon extends Geometry {
    private readonly epsilon;
    constructor(epsilon?: number);
    snap0(v: number): number;
    snap01(v: number): number;
    isCollinear(p1: Vec2, p2: Vec2, p3: Vec2): boolean;
    private solveCubicNormalized;
    solveCubic(a: number, b: number, c: number, d: number): number[];
    isEqualVec2(a: Vec2, b: Vec2): boolean;
    compareVec2(a: Vec2, b: Vec2): 0 | 1 | -1;
}

interface IPolyBoolReceiver {
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => void;
    closePath: () => void;
}
declare function joinLines(seg1: SegmentLine, seg2: SegmentLine, geo: Geometry): SegmentLine | false;
declare function joinCurves(seg1: SegmentCurve, seg2: SegmentCurve, geo: Geometry): SegmentCurve | false;
declare function joinSegments(seg1: Segment | undefined, seg2: Segment | undefined, geo: Geometry): Segment | false;
declare function SegmentChainer(segments: SegmentBool[], geo: Geometry, log: BuildLog | null): Segment[][];
declare function segmentsToReceiver<T extends IPolyBoolReceiver>(segments: Segment[][], geo: Geometry, receiver: T, matrix: Vec6): T;

interface SegmentTValuePairs {
    kind: "tValuePairs";
    tValuePairs: Vec2[];
}
interface SegmentTRangePairs {
    kind: "tRangePairs";
    tStart: Vec2;
    tEnd: Vec2;
}
declare class SegmentTValuesBuilder {
    tValues: number[];
    geo: Geometry;
    constructor(geo: Geometry);
    addArray(ts: number[]): this;
    add(t: number): this;
    list(): number[];
}
declare class SegmentTValuePairsBuilder {
    tValuePairs: Vec2[];
    allowOutOfRange: boolean;
    geo: Geometry;
    constructor(allowOutOfRange: boolean, geo: Geometry);
    add(t1: number, t2: number): this;
    list(): Vec2[];
    done(): SegmentTValuePairs | null;
}
declare abstract class SegmentBase<T> {
    abstract copy(): T;
    abstract isEqual(other: T): boolean;
    abstract start(): Vec2;
    abstract start2(): Vec2;
    abstract end2(): Vec2;
    abstract end(): Vec2;
    abstract setStart(p: Vec2): void;
    abstract setEnd(p: Vec2): void;
    abstract point(t: number): Vec2;
    abstract split(t: number[]): T[];
    abstract reverse(): T;
    abstract boundingBox(): [Vec2, Vec2];
    abstract pointOn(p: Vec2): boolean;
    abstract draw<TRecv extends IPolyBoolReceiver>(ctx: TRecv): TRecv;
}
declare class SegmentLine extends SegmentBase<SegmentLine> {
    p0: Vec2;
    p1: Vec2;
    geo: Geometry;
    constructor(p0: Vec2, p1: Vec2, geo: Geometry);
    copy(): SegmentLine;
    isEqual(other: SegmentLine): boolean;
    start(): Vec2;
    start2(): Vec2;
    end2(): Vec2;
    end(): Vec2;
    setStart(p0: Vec2): void;
    setEnd(p1: Vec2): void;
    point(t: number): Vec2;
    split(ts: number[]): SegmentLine[];
    reverse(): SegmentLine;
    boundingBox(): [Vec2, Vec2];
    pointOn(p: Vec2): boolean;
    draw<TRecv extends IPolyBoolReceiver>(ctx: TRecv): TRecv;
}
declare class SegmentCurve extends SegmentBase<SegmentCurve> {
    p0: Vec2;
    p1: Vec2;
    p2: Vec2;
    p3: Vec2;
    geo: Geometry;
    constructor(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, geo: Geometry);
    copy(): SegmentCurve;
    isEqual(other: SegmentCurve): boolean;
    start(): Vec2;
    start2(): Vec2;
    end2(): Vec2;
    end(): Vec2;
    setStart(p0: Vec2): void;
    setEnd(p3: Vec2): void;
    point(t: number): Vec2;
    split(ts: number[]): SegmentCurve[];
    reverse(): SegmentCurve;
    getCubicCoefficients(axis: number): [number, number, number, number];
    boundingTValues(): number[];
    inflectionTValues(): number[];
    boundingBox(): [Vec2, Vec2];
    mapXtoT(x: number, force?: boolean): number | false;
    mapXtoY(x: number, force?: boolean): number | false;
    pointOn(p: Vec2): boolean;
    toLine(): SegmentLine | null;
    draw<TRecv extends IPolyBoolReceiver>(ctx: TRecv): TRecv;
}
type Segment = SegmentLine | SegmentCurve;
declare function projectPointOntoSegmentLine(p: Vec2, seg: SegmentLine): number;
declare function segmentLineIntersectSegmentLine(segA: SegmentLine, segB: SegmentLine, allowOutOfRange: boolean): SegmentTValuePairs | SegmentTRangePairs | null;
declare function segmentLineIntersectSegmentCurve(segA: SegmentLine, segB: SegmentCurve, allowOutOfRange: boolean, invert: boolean): SegmentTValuePairs | null;
declare function segmentCurveIntersectSegmentCurve(segA: SegmentCurve, segB: SegmentCurve, allowOutOfRange: boolean): SegmentTValuePairs | SegmentTRangePairs | null;
declare function segmentsIntersect(segA: Segment, segB: Segment, allowOutOfRange: boolean): SegmentTValuePairs | SegmentTRangePairs | null;

interface SegmentBoolFill {
    above: boolean | null;
    below: boolean | null;
}
interface ListBoolTransition<T> {
    before: T | null;
    after: T | null;
    insert: (node: T) => T;
}
declare class SegmentBoolBase<T> {
    id: number;
    data: T;
    myFill: SegmentBoolFill;
    otherFill: SegmentBoolFill | null;
    closed: boolean;
    constructor(data: T, fill?: SegmentBoolFill | null, closed?: boolean, log?: BuildLog | null);
}
declare class SegmentBoolLine extends SegmentBoolBase<SegmentLine> {
}
declare class SegmentBoolCurve extends SegmentBoolBase<SegmentCurve> {
}
type SegmentBool = SegmentBoolLine | SegmentBoolCurve;
declare function copySegmentBool(seg: SegmentBool, log: BuildLog | null): SegmentBool;
declare class EventBool {
    isStart: boolean;
    p: Vec2;
    seg: SegmentBool;
    primary: boolean;
    other: EventBool;
    status: EventBool | null;
    constructor(isStart: boolean, p: Vec2, seg: SegmentBool, primary: boolean);
}
declare class ListBool<T> {
    readonly nodes: T[];
    remove(node: T): void;
    getIndex(node: T): number;
    isEmpty(): boolean;
    getHead(): T;
    removeHead(): void;
    insertBefore(node: T, check: (node: T) => number): void;
    findTransition(node: T, check: (node: T) => number): ListBoolTransition<T>;
}
declare class Intersecter {
    private readonly selfIntersection;
    private readonly geo;
    private readonly events;
    private readonly status;
    private readonly log;
    private currentPath;
    constructor(selfIntersection: boolean, geo: Geometry, log?: BuildLog | null);
    compareEvents(aStart: boolean, a1: Vec2, a2: Vec2, aSeg: Segment, bStart: boolean, b1: Vec2, b2: Vec2, bSeg: Segment): number;
    addEvent(ev: EventBool): void;
    divideEvent(ev: EventBool, t: number, p: Vec2): EventBool;
    beginPath(): void;
    closePath(): void;
    addSegment(seg: SegmentBool, primary: boolean): EventBool;
    addLine(from: Vec2, to: Vec2, primary?: boolean): void;
    addCurve(from: Vec2, c1: Vec2, c2: Vec2, to: Vec2, primary?: boolean): void;
    compareSegments(seg1: Segment, seg2: Segment): number;
    statusFindSurrounding(ev: EventBool): ListBoolTransition<EventBool>;
    checkIntersection(ev1: EventBool, ev2: EventBool): EventBool | null;
    calculate(): SegmentBool[];
}

declare class BuildLog {
    list: Array<{
        type: string;
        data: unknown;
    }>;
    nextSegmentId: number;
    curVert: number;
    push(type: string, data: unknown): void;
    info(msg: string, data?: any): void;
    segmentId(): number;
    checkIntersection(seg1: SegmentBool, seg2: SegmentBool): void;
    segmentDivide(seg: SegmentBool, p: Vec2): void;
    segmentChop(seg: SegmentBool): void;
    statusRemove(seg: SegmentBool): void;
    segmentUpdate(seg: SegmentBool): void;
    segmentNew(seg: SegmentBool, primary: boolean): void;
    tempStatus(seg: SegmentBool, above: SegmentBool | false, below: SegmentBool | false): void;
    rewind(seg: SegmentBool): void;
    status(seg: SegmentBool, above: SegmentBool | false, below: SegmentBool | false): void;
    vert(x: number): void;
    selected(segs: SegmentBool[]): void;
    chainStart(seg: Segment, closed: boolean): void;
    chainNew(seg: Segment, closed: boolean): void;
    chainMatch(index: number, closed: boolean): void;
    chainClose(index: number, closed: boolean): void;
    chainAddHead(index: number, seg: Segment, closed: boolean): void;
    chainAddTail(index: number, seg: Segment, closed: boolean): void;
    chainSimplifyHead(index: number, seg: Segment, closed: boolean): void;
    chainSimplifyTail(index: number, seg: Segment, closed: boolean): void;
    chainSimplifyClose(index: number, seg: Segment, closed: boolean): void;
    chainSimplifyJoin(index1: number, index2: number, seg: Segment, closed: boolean): void;
    chainConnect(index1: number, index2: number, closed: boolean): void;
    chainReverse(index: number, closed: boolean): void;
    chainJoin(index1: number, index2: number, closed: boolean): void;
    done(): void;
}

declare class Shape {
    private readonly geo;
    private readonly log;
    private pathState;
    private resultState;
    private readonly saveStack;
    private matrix;
    constructor(geo: Geometry, segments?: SegmentBool[] | null, log?: BuildLog | null);
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): this;
    resetTransform(): this;
    getTransform(): {
        a: number;
        b: number;
        c: number;
        d: number;
        e: number;
        f: number;
    };
    transform(a: number, b: number, c: number, d: number, e: number, f: number): this;
    rotate(angle: number): this;
    rotateDeg(angle: number): this;
    scale(sx: number, sy: number): this;
    translate(tx: number, ty: number): this;
    save(): this;
    restore(): this;
    transformPoint(x: number, y: number): Vec2;
    beginPath(): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this;
    closePath(): this;
    endPath(): this;
    private selfIntersect;
    segments(): Segment[][];
    output<T extends IPolyBoolReceiver>(receiver: T, matrix?: Vec6): T;
    combine(shape: Shape): ShapeCombined;
}
declare class ShapeCombined {
    private readonly geo;
    private readonly log;
    private readonly segments;
    constructor(segments: SegmentBool[], geo: Geometry, log?: BuildLog | null);
    union(): Shape;
    intersect(): Shape;
    difference(): Shape;
    differenceRev(): Shape;
    xor(): Shape;
}

declare class SegmentSelector {
    static union(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static intersect(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static difference(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static differenceRev(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static xor(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
}

interface Polygon {
    regions: Array<Array<Vec2 | Vec6>>;
    inverted: boolean;
}
interface Segments {
    shape: Shape;
    inverted: boolean;
}
interface CombinedSegments {
    shape: ShapeCombined;
    inverted1: boolean;
    inverted2: boolean;
}
declare class PolyBool {
    private readonly geo;
    private log;
    constructor(geo?: Geometry, log?: BuildLog | null);
    shape(): Shape;
    buildLog(enable: boolean): {
        type: string;
        data: unknown;
    }[] | undefined;
    segments(poly: Polygon): Segments;
    combine(segments1: Segments, segments2: Segments): CombinedSegments;
    selectUnion(combined: CombinedSegments): Segments;
    selectIntersect(combined: CombinedSegments): Segments;
    selectDifference(combined: CombinedSegments): Segments;
    selectDifferenceRev(combined: CombinedSegments): Segments;
    selectXor(combined: CombinedSegments): Segments;
    polygon(segments: Segments): Polygon;
    union(poly1: Polygon, poly2: Polygon): Polygon;
    intersect(poly1: Polygon, poly2: Polygon): Polygon;
    difference(poly1: Polygon, poly2: Polygon): Polygon;
    differenceRev(poly1: Polygon, poly2: Polygon): Polygon;
    xor(poly1: Polygon, poly2: Polygon): Polygon;
}
declare const polybool: PolyBool;

export { type CombinedSegments, EventBool, Geometry, GeometryEpsilon, type IPolyBoolReceiver, Intersecter, ListBool, type ListBoolTransition, PolyBool, type Polygon, type Segment, SegmentBase, type SegmentBool, SegmentBoolBase, SegmentBoolCurve, type SegmentBoolFill, SegmentBoolLine, SegmentChainer, SegmentCurve, SegmentLine, SegmentSelector, type SegmentTRangePairs, type SegmentTValuePairs, SegmentTValuePairsBuilder, SegmentTValuesBuilder, type Segments, Shape, ShapeCombined, type Vec2, type Vec6, boundingBoxesIntersect, copySegmentBool, polybool as default, joinCurves, joinLines, joinSegments, lerp, lerpVec2, projectPointOntoSegmentLine, segmentCurveIntersectSegmentCurve, segmentLineIntersectSegmentCurve, segmentLineIntersectSegmentLine, segmentsIntersect, segmentsToReceiver };
