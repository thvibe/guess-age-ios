// Unit tests for web/game-logic.js — the pure rules of "How Old?".
// Run with:  node --test web/test/
// No dependencies: uses Node's built-in test runner + assert.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../game-logic.js");

// A handful of seeds to exercise the deterministic paths without flakiness.
const SEEDS = [1, 2, 7, 42, 1000, 123456, 0x9e3779b9, 4294967295];

test("exports the expected surface", () => {
  for (const name of [
    "MIN", "MAX", "clamp", "cl01", "rngFrom",
    "MIN_GAP", "makeOptions", "scoreForStreak", "randAge", "randSeed", "photoKey",
  ]) {
    assert.ok(name in G, `missing export: ${name}`);
  }
  assert.equal(G.MIN, 5);
  assert.equal(G.MAX, 99);
  assert.equal(G.MIN_GAP, 8);
});

test("clamp keeps ages within [MIN, MAX]", () => {
  assert.equal(G.clamp(-100), G.MIN);
  assert.equal(G.clamp(0), G.MIN);
  assert.equal(G.clamp(4), G.MIN);
  assert.equal(G.clamp(5), 5);
  assert.equal(G.clamp(34), 34);
  assert.equal(G.clamp(99), 99);
  assert.equal(G.clamp(100), G.MAX);
  assert.equal(G.clamp(9999), G.MAX);
});

test("cl01 clamps to the unit interval", () => {
  assert.equal(G.cl01(-0.5), 0);
  assert.equal(G.cl01(0), 0);
  assert.equal(G.cl01(0.3), 0.3);
  assert.equal(G.cl01(1), 1);
  assert.equal(G.cl01(2), 1);
});

test("rngFrom is deterministic and in [0, 1)", () => {
  for (const seed of SEEDS) {
    const a = G.rngFrom(seed);
    const b = G.rngFrom(seed);
    for (let i = 0; i < 200; i++) {
      const x = a();
      assert.equal(x, b(), `seed ${seed} diverged at step ${i}`);
      assert.ok(x >= 0 && x < 1, `seed ${seed} out of range: ${x}`);
    }
  }
});

test("rngFrom with different seeds produces different streams", () => {
  const first = seed => G.rngFrom(seed)();
  assert.notEqual(first(1), first(2));
  assert.notEqual(first(100), first(101));
});

test("makeOptions: 4 distinct in-range options, correctIndex marks the truth", () => {
  for (const seed of SEEDS) {
    for (let age = -5; age <= 110; age += 1) {
      const rnd = G.rngFrom(seed);
      const { values, correctIndex } = G.makeOptions(age, rnd);
      const truth = G.clamp(age);

      assert.equal(values.length, 4, `age ${age} seed ${seed}: not 4 options`);
      assert.equal(new Set(values).size, 4, `age ${age} seed ${seed}: duplicate options ${values}`);
      for (const v of values) {
        assert.ok(Number.isInteger(v), `age ${age}: non-integer option ${v}`);
        assert.ok(v >= G.MIN && v <= G.MAX, `age ${age}: option ${v} out of range`);
      }
      assert.ok(correctIndex >= 0 && correctIndex < 4, `age ${age}: bad correctIndex ${correctIndex}`);
      assert.equal(values[correctIndex], truth, `age ${age} seed ${seed}: truth not at correctIndex`);
    }
  }
});

test("makeOptions: mid-range ages keep every pair at least MIN_GAP apart", () => {
  // Ages comfortably inside the range never hit the degenerate fallback, so
  // the outward-growth guarantee (>= MIN_GAP between any two) holds exactly.
  for (const seed of SEEDS) {
    for (let age = 20; age <= 84; age += 1) {
      const { values } = G.makeOptions(age, G.rngFrom(seed));
      const sorted = [...values].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(
          sorted[i] - sorted[i - 1] >= G.MIN_GAP,
          `age ${age} seed ${seed}: gap ${sorted[i] - sorted[i - 1]} < ${G.MIN_GAP} in ${sorted}`,
        );
      }
    }
  }
});

test("makeOptions: same age + same seed is reproducible", () => {
  for (const seed of SEEDS) {
    const a = G.makeOptions(37, G.rngFrom(seed));
    const b = G.makeOptions(37, G.rngFrom(seed));
    assert.deepEqual(a, b);
  }
});

test("makeOptions: extreme ages still yield a valid board", () => {
  for (const age of [5, 6, 99, 98]) {
    for (const seed of SEEDS) {
      const { values, correctIndex } = G.makeOptions(age, G.rngFrom(seed));
      assert.equal(new Set(values).size, 4);
      assert.equal(values[correctIndex], G.clamp(age));
      assert.ok(values.every(v => v >= G.MIN && v <= G.MAX));
    }
  }
});

test("scoreForStreak: base 10, +1 per streak, capped at +10", () => {
  assert.equal(G.scoreForStreak(1), 10);
  assert.equal(G.scoreForStreak(2), 11);
  assert.equal(G.scoreForStreak(5), 14);
  assert.equal(G.scoreForStreak(11), 20);
  assert.equal(G.scoreForStreak(12), 20); // capped
  assert.equal(G.scoreForStreak(100), 20); // still capped
});

test("randAge stays within [5, 85]", () => {
  for (let i = 0; i < 5000; i++) {
    const a = G.randAge();
    assert.ok(Number.isInteger(a), `non-integer age ${a}`);
    assert.ok(a >= 5 && a <= 85, `age ${a} out of range`);
  }
});

test("randSeed is an unsigned 32-bit integer", () => {
  for (let i = 0; i < 5000; i++) {
    const s = G.randSeed();
    assert.ok(Number.isInteger(s), `non-integer seed ${s}`);
    assert.ok(s >= 0 && s <= 0xffffffff, `seed ${s} out of uint32 range`);
  }
});

test("photoKey prefers id, then file, then url", () => {
  assert.equal(G.photoKey({ id: "a", file: "b", url: "c" }), "a");
  assert.equal(G.photoKey({ file: "b", url: "c" }), "b");
  assert.equal(G.photoKey({ url: "c" }), "c");
  assert.equal(G.photoKey({}), "");
  assert.equal(G.photoKey(null), "");
  assert.equal(G.photoKey(undefined), "");
});
