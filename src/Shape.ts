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
import SegmentChainer, { type IPolyBoolReceiver } from "./SegmentChainer";

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
    | { final: false; selfIntersect: Intersecter }
    | { final: true; segments: SegmentBool[] };

  constructor(
    segments: SegmentBool[] | null,
    geo: Geometry,
    log: BuildLog | null = null,
  ) {
    this.geo = geo;
    this.log = log;
    if (segments) {
      this.resultState = { final: true, segments };
    } else {
      this.resultState = {
        final: false,
        selfIntersect: new Intersecter(true, this.geo, this.log),
      };
    }
  }

  beginPath() {
    return this.endPath();
  }

  moveTo(x: number, y: number) {
    if (this.resultState.final) {
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
    if (this.resultState.final) {
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
    if (this.resultState.final) {
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
    if (this.resultState.final) {
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
    return this.endPath();
  }

  endPath() {
    if (this.resultState.final) {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    this.pathState = { kind: "beginPath" };
    return this;
  }

  private selfIntersect() {
    if (!this.resultState.final) {
      this.resultState = {
        final: true,
        segments: this.resultState.selfIntersect.calculate(),
      };
    }
    return this.resultState.segments;
  }

  output<T extends IPolyBoolReceiver>(receiver: T): T {
    SegmentChainer(this.selfIntersect(), receiver, this.geo, this.log);
    return receiver;
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
      SegmentSelector.union(this.segments, this.log),
      this.geo,
      this.log,
    );
  }

  intersect() {
    return new Shape(
      SegmentSelector.intersect(this.segments, this.log),
      this.geo,
      this.log,
    );
  }

  difference() {
    return new Shape(
      SegmentSelector.difference(this.segments, this.log),
      this.geo,
      this.log,
    );
  }

  differenceRev() {
    return new Shape(
      SegmentSelector.differenceRev(this.segments, this.log),
      this.geo,
      this.log,
    );
  }

  xor() {
    return new Shape(
      SegmentSelector.xor(this.segments, this.log),
      this.geo,
      this.log,
    );
  }
}
