//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import polybool from './polybool';

const triangle1 = {
  regions: [[
    [0, 0],
    [5, 10],
    [10, 0]
  ]],
  inverted: false
};

const triangle2 = {
  regions: [[
    [5, 0],
    [10, 10],
    [15, 0]
  ]],
  inverted: false
};

const tests: { name: string, func(): void }[] = [
  {
    name: 'basic intersection',
    func: () => {
      assertEqual(
        polybool.intersect(triangle1, triangle2),
        {
          regions: [[
            [10, 0],
            [5, 0],
            [7.5, 5]
          ]],
          inverted: false
        }
      );
    }
  },
  {
    name: 'basic union',
    func: () => {
      assertEqual(
        polybool.union(triangle1, triangle2),
        {
          regions: [[
            [10, 10],
            [7.5, 5],
            [5, 10],
            [0, 0],
            [15, 0]
          ]],
          inverted: false
        }
      );
    }
  }
];

// run tests
{
  let pass = 0;
  let fail = 0;
  for (const test of tests) {
    try {
      test.func();
      console.log(`pass   ${test.name}`);
      pass++;
    } catch (err) {
      console.log(`FAIL   ${test.name}`);
      console.error(`${test.name} failed:`, err);
      fail++;
    }
  }
  console.log(`\nPass: ${pass}\nFail: ${fail}`);
  if (fail > 0) {
    process.exit(1);
  }
}

function assertEqual(a: unknown, b: unknown) {
  try {
    if (typeof a !== typeof b) {
      throw new Error('Values not equal');
    }
    switch (typeof a) {
      case 'number':
      case 'boolean':
      case 'string':
      case 'function':
        if (a !== b) {
          throw new Error('Values not equal');
        }
        break;
      case 'object':
        if ((a === null && b !== null) || (a !== null && b === null)) {
          throw new Error('Values not equal');
        } else if (Array.isArray(a) || Array.isArray(b)) {
          if (!Array.isArray(a) || !Array.isArray(b)) {
            throw new Error('Values not equal');
          }
          if (a.length !== b.length) {
            throw new Error('Values not equal');
          }
          for (let i = 0; i < a.length; i++) {
            assertEqual(a[i], b[i]);
          }
        } else {
          const keys = Object.keys(a);
          if (keys.length !== Object.keys(b).length) {
            throw new Error('Values not equal');
          }
          for (const k of keys) {
            assertEqual(a[k], b[k]);
          }
        }
        break;
    }
  } catch (err) {
    console.error('Values do not match:', JSON.stringify(a), JSON.stringify(b));
    throw err;
  }
}
