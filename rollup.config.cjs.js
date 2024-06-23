//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

export default [
  {
    input: "src/polybool.ts",
    output: {
      file: "dist/polybool.cjs",
      format: "cjs",
      exports: "named",
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: "tsconfig.json",
      }),
    ],
  },
  {
    input: "src/polybool.ts",
    output: {
      file: "dist/polybool.min.cjs",
      format: "cjs",
      exports: "named",
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: "tsconfig.json",
      }),
      terser(),
    ],
  },
];
