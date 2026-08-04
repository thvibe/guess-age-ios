/**
 * Public surface of the desking engine.
 *
 * Nothing in here imports React or touches the DOM — the engine is a pure
 * TypeScript library so it can be unit-tested exhaustively, run on a server, or
 * lifted into a native client later without modification.
 */

export * from "./money";
export * from "./types";
export * from "./amortization";
export * from "./taxes";
export * from "./fees";
export * from "./profit";
export * from "./calculate";
export * from "./grid";
