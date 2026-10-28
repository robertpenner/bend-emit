import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, readDecls } from "../src/emit";

const root = mkdtempSync(join(process.env.BEND_EMIT_TEST_ARTIFACTS ?? tmpdir(), "multiline-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("an imported multiline equation lemma does not block a runtime export", async () => {
  writeFileSync(join(root, "facts.bend"), `import Base

def keep(value: Nat) -> Nat:
  value

def reflexive(+value: Nat,
  -unused: Nat) -> {value == value : Nat}:
  {==}
`);
  const entry = join(root, "core.bend");
  writeFileSync(entry, `import Base
import ./facts.bend as F

def keep(value: Nat) -> Nat:
  F.keep(value)
`);
  const result = await build(entry, join(root, "out"));
  const module = await import(result.js);
  expect(module.keep(7)).toBe(7);
  expect(readFileSync(result.dts, "utf8")).toContain("keep(value: number): number");
  expect(readFileSync(result.dts, "utf8")).not.toContain("reflexive");
});

test("lambda arrows in proof headers do not terminate generic nesting", async () => {
  const entry = join(root, "lambda.bend");
  writeFileSync(entry, `import Base

def keep(value: Nat) -> Nat:
  value

def witness() -> Exists(Nat, value => {value == value : Nat}):
  (0n, {==})
`);
  const result = await build(entry, join(root, "lambda-out"));
  const module = await import(result.js);
  expect(module.keep(9)).toBe(9);
  expect(readFileSync(result.dts, "utf8")).not.toContain("witness");
});

test("nested return-type arrows do not become function parameters", () => {
  const { defs } = readDecls(`def decide(a: Nat, b: Nat) -> Or(Le(a, b), Le(a, b) -> Empty):
  TODO
`);
  expect(defs[0].params).toEqual([["a", "Nat"], ["b", "Nat"]]);
  expect(defs[0].ret).toBe("Or(Le(a, b), Le(a, b) -> Empty)");
});

test("multiline runtime headers retain their types and ignore comment equations", async () => {
  const entry = join(root, "runtime.bend");
  writeFileSync(entry, `import Base

def add(
  a: Nat,
  b: Nat
) ->
  Nat: # This comment contains ==, but the result is a number.
  Nat.add(a, b)
`);
  const result = await build(entry, join(root, "runtime-out"));
  const module = await import(result.js);
  expect(module.add(2, 5)).toBe(7);
  expect(readFileSync(result.dts, "utf8")).toContain("add(a: number, b: number): number");
});

test("an unterminated header cannot consume the next declaration", () => {
  expect(() => readDecls(`def broken(value: Nat) -> Nat
  value
def keep(value: Nat) -> Nat:
  value
`)).toThrow("unterminated def header: def broken");
});
