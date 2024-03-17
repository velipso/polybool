//
// polybool - Boolean operations on polygons (union, intersection, etc)
// by Sean Connelly (@velipso), https://sean.cm
// Project Home: https://github.com/velipso/polybool
// SPDX-License-Identifier: 0BSD
//

import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";

export default [
  {
    input: "src/polybool.ts",
    output: {
      file: "dist/polybool.js",
      format: "esm",
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
      file: "dist/polybool.min.js",
      format: "esm",
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: "tsconfig.json",
      }),
      terser(),
    ],
  },
  {
    input: "src/polybool.ts",
    output: {
      file: "dist/polybool.d.ts",
    },
    plugins: [dts()],
  },
];
