//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

export interface ListTransition<T> {
  before: T | null;
  after: T | null;
  insert: (node: T) => T;
}

export class List<T> {
  readonly nodes: T[] = [];

  remove(node: T) {
    const i = this.nodes.indexOf(node);
    if (i >= 0) {
      this.nodes.splice(i, 1);
    }
  }

  getIndex(node: T) {
    return this.nodes.indexOf(node);
  }

  isEmpty() {
    return this.nodes.length <= 0;
  }

  getHead() {
    return this.nodes[0];
  }

  removeHead() {
    this.nodes.shift();
  }

  insertBefore(node: T, check: (node: T) => number) {
    this.findTransition(node, check).insert(node);
  }

  findTransition(node: T, check: (node: T) => number): ListTransition<T> {
    // bisect to find the transition point
    const compare = (a: T, b: T) => check(b) - check(a);
    let i = 0;
    let high = this.nodes.length;
    while (i < high) {
      const mid = (i + high) >> 1;
      if (compare(this.nodes[mid], node) > 0) {
        high = mid;
      } else {
        i = mid + 1;
      }
    }
    return {
      before: i <= 0 ? null : this.nodes[i - 1] ?? null,
      after: this.nodes[i] ?? null,
      insert: (node: T) => {
        this.nodes.splice(i, 0, node);
        return node;
      },
    };
  }
}
