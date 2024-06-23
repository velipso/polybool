//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import { type Point, type Geometry } from "./Geometry";
import { type Segment } from "./Intersecter";
import type BuildLog from "./BuildLog";

//
// converts a list of segments into a list of regions, while also removing
// unnecessary verticies
//

export default function SegmentChainer(
  segments: Segment[],
  geo: Geometry,
  log: BuildLog | null,
) {
  const chains: Point[][] = [];
  const regions: Point[][] = [];

  for (const seg of segments) {
    const pt1 = seg.start;
    const pt2 = seg.end;
    if (geo.pointsSame(pt1, pt2)) {
      console.warn(
        "PolyBool: Warning: Zero-length segment detected; your epsilon is " +
          "probably too small or too large",
      );
      continue;
    }

    log?.chainStart(seg);

    // search for two chains that this segment matches
    const first_match = {
      index: 0,
      matches_head: false,
      matches_pt1: false,
    };
    const second_match = {
      index: 0,
      matches_head: false,
      matches_pt1: false,
    };
    let next_match: typeof first_match | null = first_match;
    function setMatch(
      index: number,
      matches_head: boolean,
      matches_pt1: boolean,
    ) {
      // return true if we've matched twice
      if (next_match) {
        next_match.index = index;
        next_match.matches_head = matches_head;
        next_match.matches_pt1 = matches_pt1;
      }
      if (next_match === first_match) {
        next_match = second_match;
        return false;
      }
      next_match = null;
      return true; // we've matched twice, we're done here
    }
    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      const head = chain[0];
      const tail = chain[chain.length - 1];
      if (geo.pointsSame(head, pt1)) {
        if (setMatch(i, true, true)) {
          break;
        }
      } else if (geo.pointsSame(head, pt2)) {
        if (setMatch(i, true, false)) {
          break;
        }
      } else if (geo.pointsSame(tail, pt1)) {
        if (setMatch(i, false, true)) {
          break;
        }
      } else if (geo.pointsSame(tail, pt2)) {
        if (setMatch(i, false, false)) {
          break;
        }
      }
    }

    if (next_match === first_match) {
      // we didn't match anything, so create a new chain
      chains.push([pt1, pt2]);
      log?.chainNew(pt1, pt2);
      continue;
    }

    if (next_match === second_match) {
      // we matched a single chain

      log?.chainMatch(first_match.index);

      // add the other point to the apporpriate end, and check to see if we've closed the
      // chain into a loop

      const index = first_match.index;
      const pt = first_match.matches_pt1 ? pt2 : pt1; // if we matched pt1, then we add pt2, etc
      const addToHead = first_match.matches_head; // if we matched at head, then add to the head

      const chain = chains[index];
      let grow = addToHead ? chain[0] : chain[chain.length - 1];
      const grow2 = addToHead ? chain[1] : chain[chain.length - 2];
      const oppo = addToHead ? chain[chain.length - 1] : chain[0];
      const oppo2 = addToHead ? chain[chain.length - 2] : chain[1];

      if (geo.pointsCollinear(grow2, grow, pt)) {
        // grow isn't needed because it's directly between grow2 and pt:
        // grow2 ---grow---> pt
        if (addToHead) {
          log?.chainRemoveHead(first_match.index, pt);
          chain.shift();
        } else {
          log?.chainRemoveTail(first_match.index, pt);
          chain.pop();
        }
        grow = grow2; // old grow is gone... new grow is what grow2 was
      }

      if (geo.pointsSame(oppo, pt)) {
        // we're closing the loop, so remove chain from chains
        chains.splice(index, 1);

        if (geo.pointsCollinear(oppo2, oppo, grow)) {
          // oppo isn't needed because it's directly between oppo2 and grow:
          // oppo2 ---oppo--->grow
          if (addToHead) {
            log?.chainRemoveTail(first_match.index, grow);
            chain.pop();
          } else {
            log?.chainRemoveHead(first_match.index, grow);
            chain.shift();
          }
        }

        log?.chainClose(first_match.index);

        // we have a closed chain!
        regions.push(chain);
        continue;
      }

      // not closing a loop, so just add it to the apporpriate side
      if (addToHead) {
        log?.chainAddHead(first_match.index, pt);
        chain.unshift(pt);
      } else {
        log?.chainAddTail(first_match.index, pt);
        chain.push(pt);
      }
      continue;
    }

    // otherwise, we matched two chains, so we need to combine those chains together

    function reverseChain(index: number) {
      log?.chainReverse(index);
      chains[index].reverse(); // gee, that's easy
    }

    function appendChain(index1: number, index2: number) {
      // index1 gets index2 appended to it, and index2 is removed
      const chain1 = chains[index1];
      const chain2 = chains[index2];
      let tail = chain1[chain1.length - 1];
      const tail2 = chain1[chain1.length - 2];
      const head = chain2[0];
      const head2 = chain2[1];

      if (geo.pointsCollinear(tail2, tail, head)) {
        // tail isn't needed because it's directly between tail2 and head
        // tail2 ---tail---> head
        log?.chainRemoveTail(index1, tail);
        chain1.pop();
        tail = tail2; // old tail is gone... new tail is what tail2 was
      }

      if (geo.pointsCollinear(tail, head, head2)) {
        // head isn't needed because it's directly between tail and head2
        // tail ---head---> head2
        log?.chainRemoveHead(index2, head);
        chain2.shift();
      }

      log?.chainJoin(index1, index2);
      chains[index1] = chain1.concat(chain2);
      chains.splice(index2, 1);
    }

    const F = first_match.index;
    const S = second_match.index;

    log?.chainConnect(F, S);

    const reverseF = chains[F].length < chains[S].length; // reverse the shorter chain, if needed
    if (first_match.matches_head) {
      if (second_match.matches_head) {
        if (reverseF) {
          // <<<< F <<<< --- >>>> S >>>>
          reverseChain(F);
          // >>>> F >>>> --- >>>> S >>>>
          appendChain(F, S);
        } else {
          // <<<< F <<<< --- >>>> S >>>>
          reverseChain(S);
          // <<<< F <<<< --- <<<< S <<<<   logically same as:
          // >>>> S >>>> --- >>>> F >>>>
          appendChain(S, F);
        }
      } else {
        // <<<< F <<<< --- <<<< S <<<<   logically same as:
        // >>>> S >>>> --- >>>> F >>>>
        appendChain(S, F);
      }
    } else {
      if (second_match.matches_head) {
        // >>>> F >>>> --- >>>> S >>>>
        appendChain(F, S);
      } else {
        if (reverseF) {
          // >>>> F >>>> --- <<<< S <<<<
          reverseChain(F);
          // <<<< F <<<< --- <<<< S <<<<   logically same as:
          // >>>> S >>>> --- >>>> F >>>>
          appendChain(S, F);
        } else {
          // >>>> F >>>> --- <<<< S <<<<
          reverseChain(S);
          // >>>> F >>>> --- >>>> S >>>>
          appendChain(F, S);
        }
      }
    }
  }

  return regions;
}
