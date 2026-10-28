import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../src/emit";

const root = mkdtempSync(join(process.env.BEND_EMIT_TEST_ARTIFACTS ?? tmpdir(), "qualified-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("qualified imported datatypes have valid names and matching runtime tags", async () => {
  writeFileSync(join(root, "geometry.bend"), `import Base

type Geometry.Point is Data:
  Point{x: Nat}
`);
  const entry = join(root, "core.bend");
  writeFileSync(entry, `import Base
import ./geometry.bend as G

def keep(value: G.Geometry.Point) -> G.Geometry.Point:
  value
`);
  const result = await build(entry, join(root, "out"));
  const module = await import(result.js);
  expect(module.keep({ $: "Point", x: 7 })).toEqual({ $: "Point", x: 7 });
  const dts = readFileSync(result.dts, "utf8");
  expect(dts).toContain('export type G_Geometry_Point = { $: "Point"; "x": number };');
  expect(dts).toContain("keep(value: G_Geometry_Point): G_Geometry_Point");
});

test("qualified names refuse collisions with underscored local types", async () => {
  const entry = join(root, "collision.bend");
  writeFileSync(entry, `import Base

type Geometry.Point is Data:
  Point{x: Nat}

type Geometry_Point is Data:
  Other{x: Nat}

def keep(value: Geometry.Point) -> Geometry.Point:
  value
`);
  await expect(build(entry, join(root, "collision-out"))).rejects.toThrow("two types would both be written Geometry_Point");
});
