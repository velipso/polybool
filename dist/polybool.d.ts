type Vec2 = [number, number];
type Vec6 = [number, number, number, number, number, number];
declare abstract class Geometry {
    abstract snap0(v: number): number;
    abstract snap01(v: number): number;
    abstract atan2deg(dy: number, dx: number): number;
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
    atan2deg(dy: number, dx: number): number;
    isCollinear(p1: Vec2, p2: Vec2, p3: Vec2): boolean;
    private solveCubicNormalized;
    solveCubic(a: number, b: number, c: number, d: number): number[];
    isEqualVec2(a: Vec2, b: Vec2): boolean;
    compareVec2(a: Vec2, b: Vec2): 0 | 1 | -1;
}

interface SegmentTValuePairs {
    kind: "tValuePairs";
    tValuePairs: Vec2[];
}
interface SegmentTRangePairs {
    kind: "tRangePairs";
    tStart: Vec2;
    tEnd: Vec2;
}
interface SegmentDrawCtx {
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    bezierCurveTo: (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) => void;
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
    abstract start(): Vec2;
    abstract start2(): Vec2;
    abstract end(): Vec2;
    abstract setStart(p: Vec2): void;
    abstract setEnd(p: Vec2): void;
    abstract point(t: number): Vec2;
    abstract tangentStart(): number;
    abstract tangentEnd(): number;
    abstract split(t: number[]): T[];
    abstract reverse(): T;
    abstract boundingBox(): [Vec2, Vec2];
    abstract pointOn(p: Vec2): boolean;
    abstract draw(ctx: SegmentDrawCtx): void;
}
declare class SegmentLine extends SegmentBase<SegmentLine> {
    p0: Vec2;
    p1: Vec2;
    geo: Geometry;
    constructor(p0: Vec2, p1: Vec2, geo: Geometry);
    copy(): SegmentLine;
    start(): Vec2;
    start2(): Vec2;
    end(): Vec2;
    setStart(p0: Vec2): void;
    setEnd(p1: Vec2): void;
    point(t: number): Vec2;
    tangentStart(): number;
    tangentEnd(): number;
    split(ts: number[]): SegmentLine[];
    reverse(): SegmentLine;
    boundingBox(): [Vec2, Vec2];
    pointOn(p: Vec2): boolean;
    draw(ctx: SegmentDrawCtx): void;
}
declare class SegmentCurve extends SegmentBase<SegmentCurve> {
    p0: Vec2;
    p1: Vec2;
    p2: Vec2;
    p3: Vec2;
    geo: Geometry;
    constructor(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, geo: Geometry);
    copy(): SegmentCurve;
    start(): Vec2;
    start2(): Vec2;
    end(): Vec2;
    setStart(p0: Vec2): void;
    setEnd(p3: Vec2): void;
    point(t: number): Vec2;
    tangentStart(): number;
    tangentEnd(): number;
    split(ts: number[]): SegmentCurve[];
    reverse(): SegmentCurve;
    getCubicCoefficients(axis: number): [number, number, number, number];
    boundingTValues(): number[];
    inflectionTValues(): number[];
    boundingBox(): [Vec2, Vec2];
    mapXtoY(x: number, force?: boolean): number | false;
    pointOn(p: Vec2): boolean;
    toLine(): SegmentLine | null;
    draw(ctx: SegmentDrawCtx): void;
}
type Segment = SegmentLine | SegmentCurve;
declare function projectPointOntoSegmentLine(p: Vec2, seg: SegmentLine): number;
declare function segmentLineIntersectSegmentLine(segA: SegmentLine, segB: SegmentLine, allowOutOfRange: boolean): SegmentTValuePairs | SegmentTRangePairs | null;
declare function segmentLineIntersectSegmentCurve(segA: SegmentLine, segB: SegmentCurve, allowOutOfRange: boolean, invert: boolean): SegmentTValuePairs | null;
declare function segmentCurveIntersectSegmentCurve(segA: SegmentCurve, segB: SegmentCurve, allowOutOfRange: boolean): SegmentTValuePairs | SegmentTRangePairs | null;
declare function segmentsIntersect(segA: Segment, segB: Segment, allowOutOfRange: boolean): SegmentTValuePairs | SegmentTRangePairs | null;

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
    chainStart(seg: Segment): void;
    chainNew(seg: Segment): void;
    chainMatch(index: number): void;
    chainClose(index: number): void;
    chainAddHead(index: number, seg: Segment): void;
    chainAddTail(index: number, seg: Segment): void;
    chainSimplifyHead(index: number, seg: Segment): void;
    chainSimplifyTail(index: number, seg: Segment): void;
    chainSimplifyClose(index: number, seg: Segment): void;
    chainSimplifyJoin(index1: number, index2: number, seg: Segment): void;
    chainConnect(index1: number, index2: number): void;
    chainReverse(index: number): void;
    chainJoin(index1: number, index2: number): void;
    done(): void;
}

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
    constructor(data: T, fill?: SegmentBoolFill | null, log?: BuildLog | null);
}
declare class SegmentBoolLine extends SegmentBoolBase<SegmentLine> {
}
declare class SegmentBoolCurve extends SegmentBoolBase<SegmentCurve> {
}
type SegmentBool = SegmentBoolLine | SegmentBoolCurve;
declare class EventBool {
    isStart: boolean;
    p: Vec2;
    seg: SegmentBool;
    primary: boolean;
    other: EventBool;
    status: EventBool | null;
    constructor(isStart: boolean, p: Vec2, seg: SegmentBool, primary: boolean);
}
declare class Intersecter {
    private readonly selfIntersection;
    private readonly geo;
    private readonly events;
    private readonly status;
    private readonly log;
    constructor(selfIntersection: boolean, geo: Geometry, log?: BuildLog | null);
    compareEvents(aStart: boolean, a1: Vec2, a2: Vec2, aSeg: Segment, bStart: boolean, b1: Vec2, b2: Vec2, bSeg: Segment): number;
    addEvent(ev: EventBool): void;
    divideEvent(ev: EventBool, t: number, p: Vec2): EventBool;
    addSegment(seg: SegmentBool, primary: boolean): EventBool;
    addLine(from: Vec2, to: Vec2, primary?: boolean): void;
    addCurve(from: Vec2, c1: Vec2, c2: Vec2, to: Vec2, primary?: boolean): void;
    addRegion(region: Vec2[]): void;
    compareSegments(seg1: Segment, seg2: Segment): number;
    statusFindSurrounding(ev: EventBool): ListBoolTransition<EventBool>;
    checkIntersection(ev1: EventBool, ev2: EventBool): EventBool | null;
    calculate(): SegmentBool[];
}

declare class SegmentSelector {
    static union(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static intersect(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static difference(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static differenceRev(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
    static xor(segments: SegmentBool[], log: BuildLog | null): SegmentBool[];
}

interface IPolyBoolReceiver {
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => void;
    closePath: () => void;
}
declare function SegmentChainer<T extends IPolyBoolReceiver>(segments: SegmentBool[], receiver: T, geo: Geometry, log: BuildLog | null): void;

declare class Shape {
    private readonly geo;
    private readonly log;
    private pathState;
    private resultState;
    constructor(segments: SegmentBool[] | null, geo: Geometry, log?: BuildLog | null);
    beginPath(): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this;
    closePath(): this;
    endPath(): this;
    private selfIntersect;
    output<T extends IPolyBoolReceiver>(receiver: T): T;
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

export { BuildLog, type CombinedSegments, Geometry, GeometryEpsilon, type IPolyBoolReceiver, Intersecter, PolyBool, type Polygon, type Segment, SegmentBase, type SegmentBool, SegmentChainer, SegmentCurve, type SegmentDrawCtx, SegmentLine, SegmentSelector, type SegmentTRangePairs, type SegmentTValuePairs, SegmentTValuePairsBuilder, SegmentTValuesBuilder, type Segments, Shape, ShapeCombined, type Vec2, type Vec6, polybool as default, projectPointOntoSegmentLine, segmentCurveIntersectSegmentCurve, segmentLineIntersectSegmentCurve, segmentLineIntersectSegmentLine, segmentsIntersect };
