//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type SegmentBool } from "./Intersecter";
import { type Vec2 } from "./Geometry";
import { type Segment } from "./Segment";

interface ISegFill {
  seg: Segment;
  fill: boolean;
}

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

  info(msg: string, data?: any) {
    this.push("info", { msg, data });
  }

  segmentId() {
    return this.nextSegmentId++;
  }

  checkIntersection(seg1: SegmentBool, seg2: SegmentBool) {
    this.push("check", { seg1, seg2 });
  }

  segmentDivide(seg: SegmentBool, p: Vec2) {
    this.push("div_seg", { seg, p });
  }

  segmentChop(seg: SegmentBool) {
    this.push("chop", { seg });
  }

  statusRemove(seg: SegmentBool) {
    this.push("pop_seg", { seg });
  }

  segmentUpdate(seg: SegmentBool) {
    this.push("seg_update", { seg });
  }

  segmentNew(seg: SegmentBool, primary: boolean) {
    this.push("new_seg", { seg, primary });
  }

  tempStatus(
    seg: SegmentBool,
    above: SegmentBool | false,
    below: SegmentBool | false,
  ) {
    this.push("temp_status", { seg, above, below });
  }

  rewind(seg: SegmentBool) {
    this.push("rewind", { seg });
  }

  status(
    seg: SegmentBool,
    above: SegmentBool | false,
    below: SegmentBool | false,
  ) {
    this.push("status", { seg, above, below });
  }

  vert(x: number) {
    if (x !== this.curVert) {
      this.push("vert", { x });
      this.curVert = x;
    }
  }

  selected(segs: SegmentBool[]) {
    this.push("selected", { segs });
  }

  chainStart(sf: ISegFill, closed: boolean) {
    this.push("chain_start", { sf, closed });
  }

  chainNew(sf: ISegFill, closed: boolean) {
    this.push("chain_new", { sf, closed });
  }

  chainMatch(index: number, closed: boolean) {
    this.push("chain_match", { index, closed });
  }

  chainClose(index: number, closed: boolean) {
    this.push("chain_close", { index, closed });
  }

  chainAddHead(index: number, sf: ISegFill, closed: boolean) {
    this.push("chain_add_head", { index, sf, closed });
  }

  chainAddTail(index: number, sf: ISegFill, closed: boolean) {
    this.push("chain_add_tail", { index, sf, closed });
  }

  chainSimplifyHead(index: number, sf: ISegFill, closed: boolean) {
    this.push("chain_simp_head", { index, sf, closed });
  }

  chainSimplifyTail(index: number, sf: ISegFill, closed: boolean) {
    this.push("chain_simp_tail", { index, sf, closed });
  }

  chainSimplifyClose(index: number, sf: ISegFill, closed: boolean) {
    this.push("chain_simp_close", { index, sf, closed });
  }

  chainSimplifyJoin(
    index1: number,
    index2: number,
    sf: ISegFill,
    closed: boolean,
  ) {
    this.push("chain_simp_join", { index1, index2, sf, closed });
  }

  chainConnect(index1: number, index2: number, closed: boolean) {
    this.push("chain_con", { index1, index2, closed });
  }

  chainReverse(index: number, closed: boolean) {
    this.push("chain_rev", { index, closed });
  }

  chainJoin(index1: number, index2: number, closed: boolean) {
    this.push("chain_join", { index1, index2, closed });
  }

  done() {
    this.push("done", null);
  }
}
