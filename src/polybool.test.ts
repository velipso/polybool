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

const box1 = {
  regions: [[
    [0, 0],
    [5, 0],
    [5, -5],
    [0, -5]
  ]],
  inverted: false
};

const curve1 = {
  regions: [[
    [0, 0],
    [0, -5, 10, -5, 10, 0]
  ]],
  inverted: false
};

class Receiver {
  log: any[] = [];

  beginPath() {
    this.log.push('beginPath');
  }

  moveTo(x: number, y: number) {
    this.log.push('moveTo', x, y);
  }

  lineTo(x: number, y: number) {
    this.log.push('lineTo', x, y);
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) {
    this.log.push('bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y);
  }

  closePath() {
    this.log.push('closePath');
  }

  done() {
    return this.log;
  }
}

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
  },
  {
    name: 'union with curve',
    func: () => {
      assertEqual(
        polybool.union(box1, curve1),
        {
          regions: [[
            [10, 0],
            [10, -2.5, 7.5, -3.75, 5, -3.75],
            [5, -5],
            [0, -5],
            [0, 0]
          ]],
          inverted: false
        }
      );
    }
  },
  {
    name: 'example',
    func: () => {
      const log = polybool.shape()
        .beginPath()
        .moveTo(50, 50)
        .lineTo(150, 150)
        .lineTo(190, 50)
        .closePath()
        .moveTo(130, 50)
        .lineTo(290, 150)
        .lineTo(290, 50)
        .closePath()
        .combine(
          polybool.shape()
            .beginPath()
            .moveTo(110, 20)
            .lineTo(110, 110)
            .lineTo(20, 20)
            .closePath()
            .moveTo(130, 170)
            .lineTo(130, 20)
            .lineTo(260, 20)
            .lineTo(260, 170)
            .closePath()
        )
        .intersect()
        .output(new Receiver())
        .done();
      assertEqual(log, [
        'beginPath',
        'moveTo', 110, 110,
        'lineTo', 50, 50,
        'lineTo', 110, 50,
        'lineTo', 110, 110,
        'closePath',
        'moveTo', 150, 150,
        'lineTo', 178, 80,
        'lineTo', 130, 50,
        'lineTo', 130, 130,
        'lineTo', 150, 150,
        'closePath',
        'moveTo', 260, 131.25,
        'lineTo', 178, 80,
        'lineTo', 190, 50,
        'lineTo', 260, 50,
        'lineTo', 260, 131.25,
        'closePath',
      ]);
    }
  },
  {
    name: 'transforms',
    func: () => {
      const log = polybool.shape()
        .setTransform(3, 0, 0, 2, 100, 200)
        .beginPath()
        .moveTo(50, 50)
        .lineTo(-10, 50)
        .lineTo(10, 10)
        .closePath()
        .output(new Receiver())
        .done();
      assertEqual(log, [
        'beginPath',
        'moveTo', 250, 300,
        'lineTo', 70, 300,
        'lineTo', 130, 220,
        'lineTo', 250, 300,
        'closePath',
      ]);
    },
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
