//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Point, type Geometry, GeometryEpsilon } from "./Geometry";
import { Segment, Intersecter } from "./Intersecter";
import { SegmentSelector } from "./SegmentSelector";
import SegmentChainer from "./SegmentChainer";
import BuildLog from "./BuildLog";

export {
  type Point,
  Geometry,
  GeometryEpsilon,
  Segment,
  Intersecter,
  SegmentSelector,
  SegmentChainer,
  BuildLog,
};

export interface Polygon {
  regions: Point[][];
  inverted: boolean;
}

export interface Segments {
  segments: Segment[];
  inverted: boolean;
}

export interface CombinedSegments {
  combined: Segment[];
  inverted1: boolean;
  inverted2: boolean;
}

export class PolyBool {
  private readonly geo: Geometry;
  private log: BuildLog | null = null;

  constructor(geo: Geometry) {
    this.geo = geo;
  }

  buildLog(enable: boolean) {
    this.log = enable ? new BuildLog() : null;
    return this.log?.list;
  }

  segments(poly: Polygon): Segments {
    const i = new Intersecter(true, this.geo, this.log);
    for (const region of poly.regions) {
      i.addRegion(region);
    }
    return {
      segments: i.calculate(poly.inverted, false),
      inverted: poly.inverted,
    };
  }

  combine(segments1: Segments, segments2: Segments): CombinedSegments {
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

  selectUnion(combined: CombinedSegments): Segments {
    return {
      segments: SegmentSelector.union(combined.combined, this.log),
      inverted: combined.inverted1 || combined.inverted2,
    };
  }

  selectIntersect(combined: CombinedSegments): Segments {
    return {
      segments: SegmentSelector.intersect(combined.combined, this.log),
      inverted: combined.inverted1 && combined.inverted2,
    };
  }

  selectDifference(combined: CombinedSegments): Segments {
    return {
      segments: SegmentSelector.difference(combined.combined, this.log),
      inverted: combined.inverted1 && !combined.inverted2,
    };
  }

  selectDifferenceRev(combined: CombinedSegments): Segments {
    return {
      segments: SegmentSelector.differenceRev(combined.combined, this.log),
      inverted: !combined.inverted1 && combined.inverted2,
    };
  }

  selectXor(combined: CombinedSegments): Segments {
    return {
      segments: SegmentSelector.xor(combined.combined, this.log),
      inverted: combined.inverted1 !== combined.inverted2,
    };
  }

  polygon(segments: Segments): Polygon {
    return {
      regions: SegmentChainer(segments.segments, this.geo, this.log),
      inverted: segments.inverted,
    };
  }

  // helper functions for common operations
  union(poly1: Polygon, poly2: Polygon): Polygon {
    const seg1 = this.segments(poly1);
    const seg2 = this.segments(poly2);
    const comb = this.combine(seg1, seg2);
    const seg3 = this.selectUnion(comb);
    return this.polygon(seg3);
  }

  intersect(poly1: Polygon, poly2: Polygon): Polygon {
    const seg1 = this.segments(poly1);
    const seg2 = this.segments(poly2);
    const comb = this.combine(seg1, seg2);
    const seg3 = this.selectIntersect(comb);
    return this.polygon(seg3);
  }

  difference(poly1: Polygon, poly2: Polygon): Polygon {
    const seg1 = this.segments(poly1);
    const seg2 = this.segments(poly2);
    const comb = this.combine(seg1, seg2);
    const seg3 = this.selectDifference(comb);
    return this.polygon(seg3);
  }

  differenceRev(poly1: Polygon, poly2: Polygon): Polygon {
    const seg1 = this.segments(poly1);
    const seg2 = this.segments(poly2);
    const comb = this.combine(seg1, seg2);
    const seg3 = this.selectDifferenceRev(comb);
    return this.polygon(seg3);
  }

  xor(poly1: Polygon, poly2: Polygon): Polygon {
    const seg1 = this.segments(poly1);
    const seg2 = this.segments(poly2);
    const comb = this.combine(seg1, seg2);
    const seg3 = this.selectXor(comb);
    return this.polygon(seg3);
  }
}

const polybool = new PolyBool(new GeometryEpsilon());

export default polybool;
