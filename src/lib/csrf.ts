import { AppError } from "@/lib/errors/AppError";

// Baseline CSRF defense for Phase 1: verify the Origin header on
// state-changing requests matches our configured app origin. This is
// effective because HttpOnly cookies are sent by the browser, but only
// same-origin JS (or none, for cross-origin form posts, which is exactly
// what this blocks) can trigger the request. A double-submit token will
// be layered on when non-auth forms are introduced in later phases.
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN;

  if (!expected) {
    // Fail closed in production if misconfigured; in dev, warn via thrown
    // error too so misconfiguration is caught immediately rather than
    // silently allowing all origins.
    throw new AppError("CSRF_FAILED", "Server misconfiguration: APP_ORIGIN not set.");
  }

  if (!origin || origin !== expected) {
    throw new AppError("CSRF_FAILED", "Request origin could not be verified.");
  }
}
