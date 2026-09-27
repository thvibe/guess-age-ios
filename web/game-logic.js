// Pure game logic for "How Old?" — no DOM, no globals, deterministic.
//
// This module is the single source of truth for the rules that decide what a
// round looks like and how it scores. index.html loads it with a plain
// <script src>, and the Node unit tests (test/game-logic.test.mjs) require it,
// so the shipped app and the tests exercise the exact same code.
//
// UMD wrapper: works as a CommonJS module (Node) and as a browser global
// (window.GameLogic).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Never show an age (or an option) of 4 or below, nor above 99: the option
  // must be reachable so a clamped truth can still be the right answer.
  const MIN = 5, MAX = 99;
  const clamp = a => Math.min(Math.max(a, MIN), MAX);
  const cl01 = x => Math.min(1, Math.max(0, x));

  // Deterministic PRNG (mulberry32) seeded from a 32-bit integer. Same seed ->
  // same stream, which keeps a round reproducible for rendering and tests.
  function rngFrom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- Option generation: faithful port of AgeOptionGenerator.swift ----
  // Four options, every pair >= MIN_GAP apart, growing outward from the truth.
  // Returns { values: number[4], correctIndex } with the truth shuffled in.
  const MIN_GAP = 8;
  function makeOptions(trueAge, rnd) {
    const truth = clamp(trueAge);
    const chosen = [truth];
    let low = truth, high = truth;
    let preferHigh = rnd() < 0.5;
    let safety = 0;
    while (chosen.length < 4 && safety++ < 100) {
      const step = MIN_GAP + Math.floor(rnd() * 7); // 8..14
      const canHigh = high + step <= MAX;
      const canLow = low - step >= MIN;
      let useHigh;
      if (canHigh && canLow) { useHigh = preferHigh; preferHigh = !preferHigh; }
      else if (canHigh) useHigh = true;
      else if (canLow) useHigh = false;
      else break;
      if (useHigh) { high += step; chosen.push(high); }
      else { low -= step; chosen.push(low); }
    }
    // Degenerate fallback (e.g. an impossibly tight range): fill with any
    // remaining in-range ages so there are always four distinct options.
    while (chosen.length < 4) {
      for (let v = MIN; v <= MAX && chosen.length < 4; v++)
        if (!chosen.includes(v)) chosen.push(v);
    }
    for (let i = chosen.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
    }
    return { values: chosen, correctIndex: chosen.indexOf(truth) };
  }

  // Points for a correct answer given the streak length AFTER this answer:
  // a base 10 plus a streak bonus that grows to +10 and then holds.
  const scoreForStreak = streak => 10 + Math.min(streak - 1, 10);

  // Cartoon ages span 5..85 (nothing 4 or under); photos use each verified age.
  function randAge() { return 5 + Math.floor(Math.random() * 81); }
  function randSeed() { return (Math.random() * 2 ** 31) >>> 0; }

  // Stable identity for a photo, for de-duping the reported/seen sets.
  const photoKey = p => (p && (p.id || p.file || p.url)) || "";

  return {
    MIN, MAX, clamp, cl01, rngFrom, MIN_GAP,
    makeOptions, scoreForStreak, randAge, randSeed, photoKey,
  };
});
