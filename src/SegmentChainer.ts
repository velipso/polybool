//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Geometry, type Vec6 } from "./Geometry";
import { type SegmentBool } from "./Intersecter";
import type BuildLog from "./BuildLog";
import { type Segment, SegmentLine, SegmentCurve } from "./Segment";

//
// converts a list of segments into a list of regions, while also removing
// unnecessary verticies
//

export interface IPolyBoolReceiver {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void;
  closePath: () => void;
}

export function joinLines(
  seg1: SegmentLine,
  seg2: SegmentLine,
  geo: Geometry,
): SegmentLine | undefined {
  if (geo.isCollinear(seg1.p0, seg1.p1, seg2.p1)) {
    return new SegmentLine(seg1.p0, seg2.p1, geo);
  }
}

export function joinCurves(
  seg1: SegmentCurve,
  seg2: SegmentCurve,
  geo: Geometry,
): SegmentCurve | undefined {
  if (geo.isCollinear(seg1.p2, seg1.p3, seg2.p1)) {
    const dx = seg2.p1[0] - seg1.p2[0];
    const dy = seg2.p1[1] - seg1.p2[1];
    const t =
      Math.abs(dx) > Math.abs(dy)
        ? (seg1.p3[0] - seg1.p2[0]) / dx
        : (seg1.p3[1] - seg1.p2[1]) / dy;
    const ts = geo.snap01(t);
    if (ts !== 0 && ts !== 1) {
      const ns = new SegmentCurve(
        seg1.p0,
        [
          seg1.p0[0] + (seg1.p1[0] - seg1.p0[0]) / t,
          seg1.p0[1] + (seg1.p1[1] - seg1.p0[1]) / t,
        ],
        [
          seg2.p2[0] - (t * (seg2.p3[0] - seg2.p2[0])) / (1 - t),
          seg2.p2[1] - (t * (seg2.p3[1] - seg2.p2[1])) / (1 - t),
        ],
        seg2.p3,
        geo,
      );
      // double check that if we split at T, we get seg1/seg2 back
      const [left, right] = ns.split([t]);
      if (left.isEqual(seg1) && right.isEqual(seg2)) {
        return ns;
      }
    }
  }
}

export function joinSegments(
  seg1: Segment | undefined,
  seg2: Segment | undefined,
  geo: Geometry,
): Segment | undefined {
  if (seg1 !== seg2) {
    if (seg1 instanceof SegmentLine && seg2 instanceof SegmentLine) {
      return joinLines(seg1, seg2, geo);
    }

    if (seg1 instanceof SegmentCurve && seg2 instanceof SegmentCurve) {
      return joinCurves(seg1, seg2, geo);
    }
  }
}

export function SegmentChainer(
  segments: SegmentBool[],
  geo: Geometry,
  log: BuildLog | null,
): Segment[][] {
  const closedChains: Segment[][] = [];
  const openChains: Segment[][] = [];
  const regions: Segment[][] = [];

  for (const segb of segments) {
    const seg = segb.myFill.above ? segb.data : segb.data.reverse();
    const closed = segb.closed;
    const chains = closed ? closedChains : openChains;
    const pt1 = seg.start();
    const pt2 = seg.end();

    if (seg instanceof SegmentLine && geo.isEqualVec2(pt1, pt2)) {
      console.warn(
        "PolyBool: Warning: Zero-length segment detected; your epsilon is " +
          "probably too small or too large",
      );
      continue;
    }

    log?.chainStart(seg, closed);

    let startMatch: number | undefined;
    let endMatch: number | undefined;

    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      const head = chain[0].start();
      const tail = chain[chain.length - 1].end();

      if (startMatch == null && geo.isEqualVec2(tail, pt1)) {
        startMatch = i;
      }

      if (endMatch == null && geo.isEqualVec2(head, pt2)) {
        endMatch = i;
      }

      if (startMatch != null && endMatch != null) {
        break;
      }
    }

    if (startMatch != null && endMatch != null) {
      // otherwise, we matched two chains, so we need to combine those chains together

      log?.chainConnect(startMatch, endMatch, closed);

      // index1 gets index2 appended to it, and index2 is removed
      const chain1 = chains[startMatch];
      const chain2 = chains[endMatch];

      // add seg to chain1's tail and simplify
      const next = chain1[chain1.length - 1];
      const newEnd = joinSegments(next, seg, geo);

      if (newEnd != null) {
        chain1[chain1.length - 1] = newEnd;
        log?.chainSimplifyTail(startMatch, newEnd, closed);
      } else {
        chain1.push(seg);
      }

      // simplify chain2's head
      const tail = chain1[chain1.length - 1];
      const head = chain2[0];
      const newJoin = joinSegments(tail, head, geo);

      if (newJoin != null) {
        chain2.shift();
        chain1[chain1.length - 1] = newJoin;
        log?.chainSimplifyJoin(
          startMatch,
          endMatch,
          newJoin,
          closed,
        );
      }

      if (startMatch === endMatch) {
        if (chain1.length > 0) {
          // we have a closed chain!
          log?.chainClose(startMatch, closed);
          regions.push(chain1);
        }
      } else {
        log?.chainJoin(startMatch, endMatch, closed);
        chains[startMatch] = chain1.concat(chain2);
      }
      chains.splice(endMatch, 1);
    } else if (startMatch != null) {
      // we matched a single chain at the start
      log?.chainMatch(startMatch, closed);

      const chain = chains[startMatch];

      const next = chain[chain.length - 1];
      const newSeg = joinSegments(next, seg, geo);

      log?.chainAddTail(startMatch, seg, closed);

      if (newSeg != null) {
        chain[chain.length - 1] = newSeg;
      } else {
        chain.push(seg);
      }
    } else if (endMatch != null) {
      // we matched a single chain at the end
      log?.chainMatch(endMatch, closed);

      const chain = chains[endMatch];

      const next = chain[0];
      const newSeg = joinSegments(seg, next, geo);

      log?.chainAddHead(endMatch, seg, closed);

      if (newSeg != null) {
        chain[0] = newSeg;
      } else {
        chain.unshift(seg);
      }
    } else {
      // we didn't match anything, so create a new chain
      chains.push([seg]);
      log?.chainNew(seg, closed);
    }
  }

  regions.push(...openChains);

  return regions;
}

export function segmentsToReceiver<T extends IPolyBoolReceiver>(
  segments: Segment[][],
  geo: Geometry,
  receiver: T,
  matrix: Vec6,
): T {
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
      } else if (seg instanceof SegmentCurve) {
        const [p1x, p1y] = seg.p1;
        const [p2x, p2y] = seg.p2;
        const [p3x, p3y] = seg.p3;
        receiver.bezierCurveTo(
          a * p1x + c * p1y + e,
          b * p1x + d * p1y + f,
          a * p2x + c * p2y + e,
          b * p2x + d * p2y + f,
          a * p3x + c * p3y + e,
          b * p3x + d * p3y + f,
        );
      } else {
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
