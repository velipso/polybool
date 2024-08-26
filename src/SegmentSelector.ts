//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import {
  type SegmentBool,
  SegmentBoolLine,
  SegmentBoolCurve,
} from "./Intersecter";
import type BuildLog from "./BuildLog";

//
// filter a list of segments based on boolean operations
//

function select(
  segments: SegmentBool[],
  selection: number[],
  log: BuildLog | null,
): SegmentBool[] {
  const result: SegmentBool[] = [];
  for (const seg of segments) {
    const index =
      (seg.myFill.above ? 8 : 0) +
      (seg.myFill.below ? 4 : 0) +
      (seg.otherFill && seg.otherFill.above ? 2 : 0) +
      (seg.otherFill && seg.otherFill.below ? 1 : 0);
    if (selection[index] !== 0) {
      // copy the segment to the results, while also calculating the fill status
      const fill = {
        above: selection[index] === 1, // 1 if filled above
        below: selection[index] === 2, // 2 if filled below
      };
      if (seg instanceof SegmentBoolLine) {
        result.push(new SegmentBoolLine(seg.data, fill, log));
      } else if (seg instanceof SegmentBoolCurve) {
        result.push(new SegmentBoolCurve(seg.data, fill, log));
      } else {
        throw new Error(
          "PolyBool: Unknown SegmentBool type in SegmentSelector",
        );
      }
    }
  }
  log?.selected(result);
  return result;
}

export class SegmentSelector {
  static union(segments: SegmentBool[], log: BuildLog | null) {
    // primary | secondary
    // above1 below1 above2 below2    Keep?               Value
    //    0      0      0      0   =>   no                  0
    //    0      0      0      1   =>   yes filled below    2
    //    0      0      1      0   =>   yes filled above    1
    //    0      0      1      1   =>   no                  0
    //    0      1      0      0   =>   yes filled below    2
    //    0      1      0      1   =>   yes filled below    2
    //    0      1      1      0   =>   no                  0
    //    0      1      1      1   =>   no                  0
    //    1      0      0      0   =>   yes filled above    1
    //    1      0      0      1   =>   no                  0
    //    1      0      1      0   =>   yes filled above    1
    //    1      0      1      1   =>   no                  0
    //    1      1      0      0   =>   no                  0
    //    1      1      0      1   =>   no                  0
    //    1      1      1      0   =>   no                  0
    //    1      1      1      1   =>   no                  0
    return select(
      segments,
      [0, 2, 1, 0, 2, 2, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      log,
    );
  }

  static intersect(segments: SegmentBool[], log: BuildLog | null) {
    // primary & secondary
    // above1 below1 above2 below2    Keep?               Value
    //    0      0      0      0   =>   no                  0
    //    0      0      0      1   =>   no                  0
    //    0      0      1      0   =>   no                  0
    //    0      0      1      1   =>   no                  0
    //    0      1      0      0   =>   no                  0
    //    0      1      0      1   =>   yes filled below    2
    //    0      1      1      0   =>   no                  0
    //    0      1      1      1   =>   yes filled below    2
    //    1      0      0      0   =>   no                  0
    //    1      0      0      1   =>   no                  0
    //    1      0      1      0   =>   yes filled above    1
    //    1      0      1      1   =>   yes filled above    1
    //    1      1      0      0   =>   no                  0
    //    1      1      0      1   =>   yes filled below    2
    //    1      1      1      0   =>   yes filled above    1
    //    1      1      1      1   =>   no                  0
    return select(
      segments,
      [0, 0, 0, 0, 0, 2, 0, 2, 0, 0, 1, 1, 0, 2, 1, 0],
      log,
    );
  }

  static difference(segments: SegmentBool[], log: BuildLog | null) {
    // primary - secondary
    // above1 below1 above2 below2    Keep?               Value
    //    0      0      0      0   =>   no                  0
    //    0      0      0      1   =>   no                  0
    //    0      0      1      0   =>   no                  0
    //    0      0      1      1   =>   no                  0
    //    0      1      0      0   =>   yes filled below    2
    //    0      1      0      1   =>   no                  0
    //    0      1      1      0   =>   yes filled below    2
    //    0      1      1      1   =>   no                  0
    //    1      0      0      0   =>   yes filled above    1
    //    1      0      0      1   =>   yes filled above    1
    //    1      0      1      0   =>   no                  0
    //    1      0      1      1   =>   no                  0
    //    1      1      0      0   =>   no                  0
    //    1      1      0      1   =>   yes filled above    1
    //    1      1      1      0   =>   yes filled below    2
    //    1      1      1      1   =>   no                  0
    return select(
      segments,
      [0, 0, 0, 0, 2, 0, 2, 0, 1, 1, 0, 0, 0, 1, 2, 0],
      log,
    );
  }

  static differenceRev(segments: SegmentBool[], log: BuildLog | null) {
    // secondary - primary
    // above1 below1 above2 below2    Keep?               Value
    //    0      0      0      0   =>   no                  0
    //    0      0      0      1   =>   yes filled below    2
    //    0      0      1      0   =>   yes filled above    1
    //    0      0      1      1   =>   no                  0
    //    0      1      0      0   =>   no                  0
    //    0      1      0      1   =>   no                  0
    //    0      1      1      0   =>   yes filled above    1
    //    0      1      1      1   =>   yes filled above    1
    //    1      0      0      0   =>   no                  0
    //    1      0      0      1   =>   yes filled below    2
    //    1      0      1      0   =>   no                  0
    //    1      0      1      1   =>   yes filled below    2
    //    1      1      0      0   =>   no                  0
    //    1      1      0      1   =>   no                  0
    //    1      1      1      0   =>   no                  0
    //    1      1      1      1   =>   no                  0
    return select(
      segments,
      [0, 2, 1, 0, 0, 0, 1, 1, 0, 2, 0, 2, 0, 0, 0, 0],
      log,
    );
  }

  static xor(segments: SegmentBool[], log: BuildLog | null) {
    // primary ^ secondary
    // above1 below1 above2 below2    Keep?               Value
    //    0      0      0      0   =>   no                  0
    //    0      0      0      1   =>   yes filled below    2
    //    0      0      1      0   =>   yes filled above    1
    //    0      0      1      1   =>   no                  0
    //    0      1      0      0   =>   yes filled below    2
    //    0      1      0      1   =>   no                  0
    //    0      1      1      0   =>   no                  0
    //    0      1      1      1   =>   yes filled above    1
    //    1      0      0      0   =>   yes filled above    1
    //    1      0      0      1   =>   no                  0
    //    1      0      1      0   =>   no                  0
    //    1      0      1      1   =>   yes filled below    2
    //    1      1      0      0   =>   no                  0
    //    1      1      0      1   =>   yes filled above    1
    //    1      1      1      0   =>   yes filled below    2
    //    1      1      1      1   =>   no                  0
    return select(
      segments,
      [0, 2, 1, 0, 2, 0, 0, 1, 1, 0, 0, 2, 0, 1, 2, 0],
      log,
    );
  }
}
