//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Geometry } from "./Geometry";
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

function joinLines(
  seg1: SegmentLine,
  seg2: SegmentLine,
  geo: Geometry,
): SegmentLine | false {
  if (geo.isCollinear(seg1.p0, seg1.p1, seg2.p1)) {
    return new SegmentLine(seg1.p0, seg2.p1, geo);
  }
  return false;
}

function joinCurves(
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
      return new SegmentCurve(
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
    }
  }
  return false;
}

function joinSegments(
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

export default function SegmentChainer<T extends IPolyBoolReceiver>(
  segments: SegmentBool[],
  receiver: T,
  geo: Geometry,
  log: BuildLog | null,
) {
  const chains: Segment[][] = [];
  const regions: Segment[][] = [];

  for (const segb of segments) {
    let seg = segb.data;
    const pt1 = seg.start();
    const pt2 = seg.end();

    if (seg instanceof SegmentLine && geo.isEqualVec2(pt1, pt2)) {
      console.warn(
        "PolyBool: Warning: Zero-length segment detected; your epsilon is " +
          "probably too small or too large",
      );
      continue;
    }

    log?.chainStart(seg);

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
      log?.chainNew(seg);
      chains.push([seg]);
    } else if (nextMatch === secondMatch) {
      // we matched a single chain
      const index = firstMatch.index;
      log?.chainMatch(index);

      // add the other point to the apporpriate end
      const chain = chains[index];
      if (firstMatch.matchesHead) {
        if (firstMatch.matchesPt1) {
          seg = seg.reverse();
          log?.chainAddHead(index, seg);
          chain.unshift(seg);
        } else {
          log?.chainAddHead(index, seg);
          chain.unshift(seg);
        }
      } else {
        if (firstMatch.matchesPt1) {
          log?.chainAddTail(index, seg);
          chain.push(seg);
        } else {
          seg = seg.reverse();
          log?.chainAddTail(index, seg);
          chain.push(seg);
        }
      }

      // simplify chain
      if (firstMatch.matchesHead) {
        const next = chain[1];
        const newSeg = joinSegments(seg, next, geo);
        if (newSeg) {
          log?.chainSimplifyHead(index, newSeg);
          chain.shift();
          chain[0] = newSeg;
        }
      } else {
        const next = chain[chain.length - 2];
        const newSeg = joinSegments(next, seg, geo);
        if (newSeg) {
          log?.chainSimplifyTail(index, newSeg);
          chain.pop();
          chain[chain.length - 1] = newSeg;
        }
      }

      // check for closed chain
      const segS = chain[0];
      const segE = chain[chain.length - 1];
      if (chain.length > 0 && geo.isEqualVec2(segS.start(), segE.end())) {
        const newStart = joinSegments(segE, segS, geo);
        if (newStart) {
          log?.chainSimplifyClose(index, newStart);
          chain.pop();
          chain[0] = newStart;
        }

        // we have a closed chain!
        log?.chainClose(index);
        chains.splice(index, 1);
        regions.push(chain);
      }
    } else {
      // otherwise, we matched two chains, so we need to combine those chains together

      function reverseChain(index: number) {
        log?.chainReverse(index);
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
        log?.chainAddTail(index1, seg);
        chain1.push(seg);

        // simplify chain1's tail
        const next = chain1[chain1.length - 2];
        const newEnd = joinSegments(next, seg, geo);
        if (newEnd) {
          log?.chainSimplifyTail(index1, newEnd);
          chain1.pop();
          chain1[chain1.length - 1] = newEnd;
        }

        // simplify chain2's head
        const tail = chain1[chain1.length - 1];
        const head = chain2[0];
        const newJoin = joinSegments(tail, head, geo);
        if (newJoin) {
          log?.chainSimplifyJoin(index1, index2, newJoin);
          chain2.shift();
          chain1[chain1.length - 1] = newJoin;
        }

        log?.chainJoin(index1, index2);
        chains[index1] = chain1.concat(chain2);
        chains.splice(index2, 1);
      }

      const F = firstMatch.index;
      const S = secondMatch.index;

      log?.chainConnect(F, S);

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

  for (const region of regions) {
    receiver.beginPath();
    for (let i = 0; i < region.length; i++) {
      const seg = region[i];
      if (i === 0) {
        const p0 = seg.start();
        receiver.moveTo(p0[0], p0[1]);
      }
      if (seg instanceof SegmentLine) {
        receiver.lineTo(seg.p1[0], seg.p1[1]);
      } else if (seg instanceof SegmentCurve) {
        receiver.bezierCurveTo(
          seg.p1[0],
          seg.p1[1],
          seg.p2[0],
          seg.p2[1],
          seg.p3[0],
          seg.p3[1],
        );
      } else {
        throw new Error("PolyBool: Unknown segment instance");
      }
    }
    receiver.closePath();
  }
}
