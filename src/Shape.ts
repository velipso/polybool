//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Geometry, type Vec2 } from "./Geometry";
import type BuildLog from "./BuildLog";
import { type SegmentBool, Intersecter, copySegmentBool } from "./Intersecter";
import { SegmentSelector } from "./SegmentSelector";
import {
  SegmentChainer,
  segmentsToReceiver,
  type IPolyBoolReceiver,
} from "./SegmentChainer";
import { type Segment } from "./Segment";

interface IPathStateCommon<K extends string> {
  kind: K;
}

interface IPathStateBeginPath extends IPathStateCommon<"beginPath"> {}

interface IPathStateMoveTo extends IPathStateCommon<"moveTo"> {
  start: Vec2;
  current: Vec2;
}

type IPathState = IPathStateBeginPath | IPathStateMoveTo;

export class Shape {
  private readonly geo: Geometry;
  private readonly log: BuildLog | null;
  private pathState: IPathState = { kind: "beginPath" };
  private resultState:
    | { state: "new"; selfIntersect: Intersecter }
    | { state: "seg"; segments: SegmentBool[] }
    | { state: "reg"; segments: SegmentBool[]; regions: Segment[][] };

  constructor(
    geo: Geometry,
    segments: SegmentBool[] | null = null,
    log: BuildLog | null = null,
  ) {
    this.geo = geo;
    this.log = log;
    if (segments) {
      this.resultState = { state: "seg", segments };
    } else {
      this.resultState = {
        state: "new",
        selfIntersect: new Intersecter(true, this.geo, this.log),
      };
    }
  }

  beginPath() {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    this.resultState.selfIntersect.beginPath();
    return this.endPath();
  }

  moveTo(x: number, y: number) {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    if (this.pathState.kind !== "beginPath") {
      this.beginPath();
    }
    const current: Vec2 = [x, y];
    this.pathState = {
      kind: "moveTo",
      start: current,
      current,
    };
    return this;
  }

  lineTo(x: number, y: number) {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    if (this.pathState.kind !== "moveTo") {
      throw new Error("PolyBool: Must call moveTo prior to calling lineTo");
    }
    const current: Vec2 = [x, y];
    this.resultState.selfIntersect.addLine(this.pathState.current, current);
    this.pathState.current = current;
    return this;
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    if (this.pathState.kind !== "moveTo") {
      throw new Error(
        "PolyBool: Must call moveTo prior to calling bezierCurveTo",
      );
    }
    const current: Vec2 = [x, y];
    this.resultState.selfIntersect.addCurve(
      this.pathState.current,
      [cp1x, cp1y],
      [cp2x, cp2y],
      current,
    );
    this.pathState.current = current;
    return this;
  }

  closePath() {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    // close with a line if needed
    if (
      this.pathState.kind === "moveTo" &&
      !this.geo.isEqualVec2(this.pathState.start, this.pathState.current)
    ) {
      this.lineTo(this.pathState.start[0], this.pathState.start[1]);
    }
    this.resultState.selfIntersect.closePath();
    return this.endPath();
  }

  endPath() {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    this.pathState = { kind: "beginPath" };
    return this;
  }

  private selfIntersect() {
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

  output<T extends IPolyBoolReceiver>(receiver: T): T {
    return segmentsToReceiver(this.segments(), this.geo, receiver);
  }

  combine(shape: Shape) {
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

export class ShapeCombined {
  private readonly geo: Geometry;
  private readonly log: BuildLog | null;
  private readonly segments: SegmentBool[];

  constructor(
    segments: SegmentBool[],
    geo: Geometry,
    log: BuildLog | null = null,
  ) {
    this.geo = geo;
    this.segments = segments;
    this.log = log;
  }

  union() {
    return new Shape(
      this.geo,
      SegmentSelector.union(this.segments, this.log),
      this.log,
    );
  }

  intersect() {
    return new Shape(
      this.geo,
      SegmentSelector.intersect(this.segments, this.log),
      this.log,
    );
  }

  difference() {
    return new Shape(
      this.geo,
      SegmentSelector.difference(this.segments, this.log),
      this.log,
    );
  }

  differenceRev() {
    return new Shape(
      this.geo,
      SegmentSelector.differenceRev(this.segments, this.log),
      this.log,
    );
  }

  xor() {
    return new Shape(
      this.geo,
      SegmentSelector.xor(this.segments, this.log),
      this.log,
    );
  }
}
