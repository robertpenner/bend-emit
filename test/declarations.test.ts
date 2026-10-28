import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../src/emit";

const root = mkdtempSync(join(process.env.BEND_EMIT_TEST_ARTIFACTS ?? tmpdir(), "declarations-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("reusable types retain their tagged field, parameter and result shapes", async () => {
  const entry = join(root, "reusable.bend");
  writeFileSync(entry, `import Base

type Batch is Data:
  Batch{values: +List<Nat>}

def keep(value: +List<Batch>) -> +List<Batch>:
  value
`);
  const result = await build(entry, join(root, "reusable-out"));
  const module = await import(result.js);
  const input = { $: "Con", head: { $: "Batch", values: { $: "Con", head: 7, tail: { $: "Nil" } } }, tail: { $: "Nil" } };
  expect(module.keep(input)).toEqual(input);
  const dts = readFileSync(result.dts, "utf8");
  expect(dts).toContain('export type Batch = { $: "Batch"; "values": BendList<number> };');
  expect(dts).toContain("keep(value: BendList<Batch>): BendList<Batch>");
});

test("multiline constructors retain every field and the following constructor", async () => {
  const entry = join(root, "multiline.bend");
  writeFileSync(entry, `import Base

type Input is Data:
  Input{ # The opening line may have a comment too.
    value: Nat,
    # A closing brace in a comment must not end the constructor: }
    values: +List<Nat>
  }
  Empty{}

def keep(value: Input) -> Input:
  value
`);
  const result = await build(entry, join(root, "multiline-out"));
  const module = await import(result.js);
  const input = { $: "Input", value: 7, values: { $: "Nil" } };
  expect(module.keep(input)).toEqual(input);
  expect(module.keep({ $: "Empty" })).toEqual({ $: "Empty" });
  const dts = readFileSync(result.dts, "utf8");
  expect(dts).toContain('export type Input = { $: "Input"; "value": number; "values": BendList<number> } | { $: "Empty" };');
  expect(dts).toContain("keep(value: Input): Input");
});

test("an unterminated constructor is refused before writing partial output", async () => {
  const entry = join(root, "unterminated.bend");
  const output = join(root, "unterminated-out");
  writeFileSync(entry, `import Base

type Input is Data:
  Input{
    value: Nat

def keep(value: Nat) -> Nat:
  value
`);
  await expect(build(entry, output)).rejects.toThrow("unterminated constructor of Input");
  expect(existsSync(output)).toBe(false);
});
