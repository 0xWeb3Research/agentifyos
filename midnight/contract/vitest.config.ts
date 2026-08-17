import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the hand-written tests. Without this, a future glob change could
    // sweep in the generated contract under src/managed.
    include: ['src/test/**/*.test.ts'],
  },
});

/*
 * A note on the one warning this run prints.
 *
 *   Sourcemap for .../managed/nightpass/contract/index.js points to missing
 *   source files
 *
 * The Compact compiler emits index.js.map next to the generated contract, and
 * the sources it references are compiler internals that are never shipped. Vite
 * resolves the map on load and says so. It is benign, and deleting the map is
 * worse: Vite then fails to read a map the file still advertises and prints a
 * stack trace instead. Left alone deliberately.
 */
