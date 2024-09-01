//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Geometry, type Vec2, type Vec6 } from "./Geometry";
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

  private readonly saveStack: Array<{ matrix: Vec6 }> = [];
  private matrix: Vec6 = [1, 0, 0, 1, 0, 0];

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

  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
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
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    const [a, b, c, d, e, f] = this.matrix;
    return { a, b, c, d, e, f };
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
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

  rotate(angle: number) {
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

  rotateDeg(angle: number) {
    const ang = ((angle % 360) + 360) % 360;
    if (ang === 0) {
      return this;
    }
    let cos = 0;
    let sin = 0;
    if (ang === 90) {
      sin = 1;
    } else if (ang === 180) {
      cos = -1;
    } else if (ang === 270) {
      sin = -1;
    } else if (ang === 45) {
      cos = sin = Math.SQRT1_2;
    } else if (ang === 135) {
      sin = Math.SQRT1_2;
      cos = -Math.SQRT1_2;
    } else if (ang === 225) {
      cos = sin = -Math.SQRT1_2;
    } else if (ang === 315) {
      cos = Math.SQRT1_2;
      sin = -Math.SQRT1_2;
    } else if (ang === 30) {
      cos = Math.sqrt(3) / 2;
      sin = 0.5;
    } else if (ang === 60) {
      cos = 0.5;
      sin = Math.sqrt(3) / 2;
    } else if (ang === 120) {
      cos = -0.5;
      sin = Math.sqrt(3) / 2;
    } else if (ang === 150) {
      cos = -Math.sqrt(3) / 2;
      sin = 0.5;
    } else if (ang === 210) {
      cos = -Math.sqrt(3) / 2;
      sin = -0.5;
    } else if (ang === 240) {
      cos = -0.5;
      sin = -Math.sqrt(3) / 2;
    } else if (ang === 300) {
      cos = 0.5;
      sin = -Math.sqrt(3) / 2;
    } else if (ang === 330) {
      cos = Math.sqrt(3) / 2;
      sin = -0.5;
    } else {
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

  scale(sx: number, sy: number) {
    const [a0, b0, c0, d0, e0, f0] = this.matrix;
    this.matrix = [a0 * sx, b0 * sx, c0 * sy, d0 * sy, e0, f0];
    return this;
  }

  translate(tx: number, ty: number) {
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
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    this.saveStack.push({ matrix: this.matrix });
    return this;
  }

  restore() {
    if (this.resultState.state !== "new") {
      throw new Error(
        "PolyBool: Cannot change shape after using it in an operation",
      );
    }
    const s = this.saveStack.pop();
    if (s) {
      this.matrix = s.matrix;
    }
    return this;
  }

  transformPoint(x: number, y: number): Vec2 {
    const [a, b, c, d, e, f] = this.matrix;
    return [a * x + c * y + e, b * x + d * y + f];
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
    const current = this.transformPoint(x, y);
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
    const current = this.transformPoint(x, y);
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
    const current = this.transformPoint(x, y);
    this.resultState.selfIntersect.addCurve(
      this.pathState.current,
      this.transformPoint(cp1x, cp1y),
      this.transformPoint(cp2x, cp2y),
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
      this.resultState.selfIntersect.addLine(
        this.pathState.current,
        this.pathState.start,
      );
      this.pathState.current = this.pathState.start;
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
