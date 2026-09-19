import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests hit a real (possibly remote, e.g. Supabase) database
    // over the network, plus bcrypt hashing — increased well beyond the 5s
    // default. Phase 3's setup in particular does many sequential writes
    // (training module seeding, user creation, full geography chain).
    testTimeout: 30000,
    hookTimeout: 120000,
    // IMPORTANT: integration test files share ONE live remote database via
    // a pooled connection (e.g. Supabase PgBouncer in transaction mode).
    // Running test files in parallel (Vitest's default) causes concurrent
    // writes from separate files to race against each other over that
    // shared pool, which can produce spurious "foreign key not found"
    // errors on rows that were, in fact, just committed — a connection-
    // pooling/timing artifact, not a real data-integrity bug. Forcing
    // sequential file execution removes that source of flakiness. This
    // makes the full suite slower; that trade-off is worth it for
    // integration tests whose entire point is to prove real behavior.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
