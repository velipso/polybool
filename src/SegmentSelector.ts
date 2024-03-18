//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { Segment } from "./Intersecter";
import type BuildLog from "./BuildLog";

//
// filter a list of segments based on boolean operations
//

function select(
  segments: Segment[],
  selection: number[],
  log: BuildLog | null,
): Segment[] {
  const result: Segment[] = [];
  for (const seg of segments) {
    const index =
      (seg.myFill.above ? 8 : 0) +
      (seg.myFill.below ? 4 : 0) +
      (seg.otherFill && seg.otherFill.above ? 2 : 0) +
      (seg.otherFill && seg.otherFill.below ? 1 : 0);
    if (selection[index] !== 0) {
      // copy the segment to the results, while also calculating the fill status
      const keep = new Segment(seg.start, seg.end, null, log);
      keep.myFill.above = selection[index] === 1; // 1 if filled above
      keep.myFill.below = selection[index] === 2; // 2 if filled below
      result.push(keep);
    }
  }
  log?.selected(result);
  return result;
}

export class SegmentSelector {
  static union(segments: Segment[], log: BuildLog | null) {
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

  static intersect(segments: Segment[], log: BuildLog | null) {
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

  static difference(segments: Segment[], log: BuildLog | null) {
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

  static differenceRev(segments: Segment[], log: BuildLog | null) {
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

  static xor(segments: Segment[], log: BuildLog | null) {
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
