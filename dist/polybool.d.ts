type Point = [number, number];
declare enum AlongIntersection {
    BeforeStart = 0,
    EqualStart = 1,
    BetweenStartAndEnd = 2,
    EqualEnd = 3,
    AfterEnd = 4
}
interface IntersectionResult {
    p: Point;
    alongA: AlongIntersection;
    alongB: AlongIntersection;
}
declare abstract class Geometry {
    abstract pointAboveOrOnLine(p: Point, left: Point, right: Point): boolean;
    abstract pointBetween(p: Point, left: Point, right: Point): boolean;
    abstract pointsSameX(p1: Point, p2: Point): boolean;
    abstract pointsSameY(p1: Point, p2: Point): boolean;
    abstract pointsCollinear(p1: Point, p2: Point, p3: Point): boolean;
    abstract linesIntersect(aStart: Point, aEnd: Point, bStart: Point, bEnd: Point): IntersectionResult | null;
    pointsSame(p1: Point, p2: Point): boolean;
    pointsCompare(p1: Point, p2: Point): 0 | 1 | -1;
}
declare class GeometryEpsilon extends Geometry {
    private readonly epsilon;
    constructor(epsilon?: number);
    pointAboveOrOnLine(p: Point, left: Point, right: Point): boolean;
    pointBetween(p: Point, left: Point, right: Point): boolean;
    pointsSameX(p1: Point, p2: Point): boolean;
    pointsSameY(p1: Point, p2: Point): boolean;
    pointsCollinear(p1: Point, p2: Point, p3: Point): boolean;
    linesIntersect(aStart: Point, aEnd: Point, bStart: Point, bEnd: Point): {
        alongA: AlongIntersection;
        alongB: AlongIntersection;
        p: Point;
    } | null;
}

interface ListTransition<T> {
    before: T | null;
    after: T | null;
    insert: (node: T) => T;
}

declare class BuildLog {
    list: Array<{
        type: string;
        data: unknown;
    }>;
    nextSegmentId: number;
    curVert: number;
    push(type: string, data: unknown): void;
    segmentId(): number;
    checkIntersection(seg1: Segment, seg2: Segment): void;
    segmentChop(seg: Segment, p: Point): void;
    statusRemove(seg: Segment): void;
    segmentUpdate(seg: Segment): void;
    segmentNew(seg: Segment, primary: boolean): void;
    tempStatus(seg: Segment, above: Segment | false, below: Segment | false): void;
    rewind(seg: Segment): void;
    status(seg: Segment, above: Segment | false, below: Segment | false): void;
    vert(x: number): void;
    selected(segs: Segment[]): void;
    chainStart(seg: Segment): void;
    chainRemoveHead(index: number, p: Point): void;
    chainRemoveTail(index: number, p: Point): void;
    chainNew(p1: Point, p2: Point): void;
    chainMatch(index: number): void;
    chainClose(index: number): void;
    chainAddHead(index: number, p: Point): void;
    chainAddTail(index: number, p: Point): void;
    chainConnect(index1: number, index2: number): void;
    chainReverse(index: number): void;
    chainJoin(index1: number, index2: number): void;
    done(): void;
}

interface Fill {
    above: boolean | null;
    below: boolean | null;
}
declare class Segment {
    id: number;
    start: Point;
    end: Point;
    myFill: Fill;
    otherFill: Fill | null;
    constructor(start: Point, end: Point, copyMyFill: Segment | null, log: BuildLog | null);
}
declare class Event {
    isStart: boolean;
    p: Point;
    seg: Segment;
    primary: boolean;
    other: Event;
    status: Event | null;
    constructor(isStart: boolean, p: Point, seg: Segment, primary: boolean);
}
declare class Intersecter {
    private readonly selfIntersection;
    private readonly geo;
    private readonly events;
    private readonly status;
    private readonly log;
    constructor(selfIntersection: boolean, geo: Geometry, log?: BuildLog | null);
    compareEvents(p1_isStart: boolean, p1_1: Point, p1_2: Point, p2_isStart: boolean, p2_1: Point, p2_2: Point): number;
    addEvent(ev: Event): void;
    divideEvent(ev: Event, p: Point): Event;
    newSegment(p1: Point, p2: Point): Segment | null;
    addSegment(seg: Segment, primary: boolean): Event;
    addRegion(region: Point[]): void;
    compareStatus(ev1: Event, ev2: Event): number;
    statusFindSurrounding(ev: Event): ListTransition<Event>;
    checkIntersection(ev1: Event, ev2: Event): Event | null;
    calculate(primaryPolyInverted: boolean, secondaryPolyInverted: boolean): Segment[];
}

declare class SegmentSelector {
    static union(segments: Segment[], log: BuildLog | null): Segment[];
    static intersect(segments: Segment[], log: BuildLog | null): Segment[];
    static difference(segments: Segment[], log: BuildLog | null): Segment[];
    static differenceRev(segments: Segment[], log: BuildLog | null): Segment[];
    static xor(segments: Segment[], log: BuildLog | null): Segment[];
}

declare function SegmentChainer(segments: Segment[], geo: Geometry, log: BuildLog | null): Point[][];

interface Polygon {
    regions: Point[][];
    inverted: boolean;
}
interface Segments {
    segments: Segment[];
    inverted: boolean;
}
interface CombinedSegments {
    combined: Segment[];
    inverted1: boolean;
    inverted2: boolean;
}
declare class PolyBool {
    private readonly geo;
    private log;
    constructor(geo: Geometry);
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

export { BuildLog, type CombinedSegments, Geometry, GeometryEpsilon, Intersecter, type Point, PolyBool, type Polygon, Segment, SegmentChainer, SegmentSelector, type Segments, polybool as default };
