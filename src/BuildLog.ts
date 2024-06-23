//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Segment } from "./Intersecter";
import { type Point } from "./Geometry";

export default class BuildLog {
  list: Array<{ type: string; data: unknown }> = [];
  nextSegmentId = 0;
  curVert = NaN;

  push(type: string, data: unknown) {
    this.list.push({
      type,
      data: JSON.parse(JSON.stringify(data)),
    });
  }

  segmentId() {
    return this.nextSegmentId++;
  }

  checkIntersection(seg1: Segment, seg2: Segment) {
    this.push("check", { seg1, seg2 });
  }

  segmentChop(seg: Segment, p: Point) {
    this.push("div_seg", { seg, p });
    this.push("chop", { seg, p });
  }

  statusRemove(seg: Segment) {
    this.push("pop_seg", { seg });
  }

  segmentUpdate(seg: Segment) {
    this.push("seg_update", { seg });
  }

  segmentNew(seg: Segment, primary: boolean) {
    this.push("new_seg", { seg, primary });
  }

  tempStatus(seg: Segment, above: Segment | false, below: Segment | false) {
    this.push("temp_status", { seg, above, below });
  }

  rewind(seg: Segment) {
    this.push("rewind", { seg });
  }

  status(seg: Segment, above: Segment | false, below: Segment | false) {
    this.push("status", { seg, above, below });
  }

  vert(x: number) {
    if (x !== this.curVert) {
      this.push("vert", { x });
      this.curVert = x;
    }
  }

  selected(segs: Segment[]) {
    this.push("selected", { segs });
  }

  chainStart(seg: Segment) {
    this.push("chain_start", { seg });
  }

  chainRemoveHead(index: number, p: Point) {
    this.push("chain_rem_head", { index, p });
  }

  chainRemoveTail(index: number, p: Point) {
    this.push("chain_rem_tail", { index, p });
  }

  chainNew(p1: Point, p2: Point) {
    this.push("chain_new", { p1, p2 });
  }

  chainMatch(index: number) {
    this.push("chain_match", { index });
  }

  chainClose(index: number) {
    this.push("chain_close", { index });
  }

  chainAddHead(index: number, p: Point) {
    this.push("chain_add_head", { index, p });
  }

  chainAddTail(index: number, p: Point) {
    this.push("chain_add_tail", { index, p });
  }

  chainConnect(index1: number, index2: number) {
    this.push("chain_con", { index1, index2 });
  }

  chainReverse(index: number) {
    this.push("chain_rev", { index });
  }

  chainJoin(index1: number, index2: number) {
    this.push("chain_join", { index1, index2 });
  }

  done() {
    this.push("done", null);
  }
}
