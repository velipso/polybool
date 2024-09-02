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
): SegmentLine | false {
  if (geo.isCollinear(seg1.p0, seg1.p1, seg2.p1)) {
    return new SegmentLine(seg1.p0, seg2.p1, geo);
  }
  return false;
}

export function joinCurves(
  seg1: SegmentCurve,
  seg2: SegmentCurve,
  geo: Geometry,
): SegmentCurve | false {
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
  return false;
}

export function joinSegments(
  seg1: Segment | undefined,
  seg2: Segment | undefined,
  geo: Geometry,
): Segment | false {
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

export function SegmentChainer(
  segments: SegmentBool[],
  geo: Geometry,
  log: BuildLog | null,
): Segment[][] {
  const closedChains: Segment[][] = [];
  const openChains: Segment[][] = [];
  const regions: Segment[][] = [];

  for (const segb of segments) {
    let seg = segb.data;
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
    let nextMatch: typeof firstMatch | null = firstMatch;
    function setMatch(
      index: number,
      matchesHead: boolean,
      matchesPt1: boolean,
    ) {
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
      } else if (geo.isEqualVec2(head, pt2)) {
        if (setMatch(i, true, false)) {
          break;
        }
      } else if (geo.isEqualVec2(tail, pt1)) {
        if (setMatch(i, false, true)) {
          break;
        }
      } else if (geo.isEqualVec2(tail, pt2)) {
        if (setMatch(i, false, false)) {
          break;
        }
      }
    }

    if (nextMatch === firstMatch) {
      // we didn't match anything, so create a new chain
      log?.chainNew(seg, closed);
      chains.push([seg]);
    } else if (nextMatch === secondMatch) {
      // we matched a single chain
      const index = firstMatch.index;
      log?.chainMatch(index, closed);

      // add the other point to the apporpriate end
      const chain = chains[index];
      if (firstMatch.matchesHead) {
        if (firstMatch.matchesPt1) {
          seg = seg.reverse();
          log?.chainAddHead(index, seg, closed);
          chain.unshift(seg);
        } else {
          log?.chainAddHead(index, seg, closed);
          chain.unshift(seg);
        }
      } else {
        if (firstMatch.matchesPt1) {
          log?.chainAddTail(index, seg, closed);
          chain.push(seg);
        } else {
          seg = seg.reverse();
          log?.chainAddTail(index, seg, closed);
          chain.push(seg);
        }
      }

      // simplify chain
      if (firstMatch.matchesHead) {
        const next = chain[1];
        const newSeg = joinSegments(seg, next, geo);
        if (newSeg) {
          log?.chainSimplifyHead(index, newSeg, closed);
          chain.shift();
          chain[0] = newSeg;
        }
      } else {
        const next = chain[chain.length - 2];
        const newSeg = joinSegments(next, seg, geo);
        if (newSeg) {
          log?.chainSimplifyTail(index, newSeg, closed);
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
            log?.chainSimplifyClose(index, newStart, closed);
            chain.pop();
            chain[0] = newStart;
          }

          // we have a closed chain!
          log?.chainClose(index, closed);
          chains.splice(index, 1);
          regions.push(chain);
        }
      }
    } else {
      // otherwise, we matched two chains, so we need to combine those chains together

      function reverseChain(index: number) {
        log?.chainReverse(index, closed);
        const newChain: Segment[] = [];
        for (const s of chains[index]) {
          newChain.unshift(s.reverse());
        }
        chains[index] = newChain;
      }

      function appendChain(index1: number, index2: number) {
        // index1 gets index2 appended to it, and index2 is removed
        const chain1 = chains[index1];
        const chain2 = chains[index2];

        // add seg to chain1's tail
        log?.chainAddTail(index1, seg, closed);
        chain1.push(seg);

        // simplify chain1's tail
        const next = chain1[chain1.length - 2];
        const newEnd = joinSegments(next, seg, geo);
        if (newEnd) {
          log?.chainSimplifyTail(index1, newEnd, closed);
          chain1.pop();
          chain1[chain1.length - 1] = newEnd;
        }

        // simplify chain2's head
        const tail = chain1[chain1.length - 1];
        const head = chain2[0];
        const newJoin = joinSegments(tail, head, geo);
        if (newJoin) {
          log?.chainSimplifyJoin(index1, index2, newJoin, closed);
          chain2.shift();
          chain1[chain1.length - 1] = newJoin;
        }

        log?.chainJoin(index1, index2, closed);
        chains[index1] = chain1.concat(chain2);
        chains.splice(index2, 1);
      }

      const F = firstMatch.index;
      const S = secondMatch.index;

      log?.chainConnect(F, S, closed);

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
          } else {
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
        } else {
          if (firstMatch.matchesPt1) {
            // <<<< F <<<< --> >>>> S >>>>
            seg = seg.reverse();
          }
          // <<<< F <<<< <-- <<<< S <<<<   logically same as:
          // >>>> S >>>> --> >>>> F >>>>
          appendChain(S, F);
        }
      } else {
        if (secondMatch.matchesHead) {
          if (!firstMatch.matchesPt1) {
            // >>>> F >>>> <-- >>>> S >>>>
            seg = seg.reverse();
          }
          // >>>> F >>>> --> >>>> S >>>>
          appendChain(F, S);
        } else {
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
          } else {
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
