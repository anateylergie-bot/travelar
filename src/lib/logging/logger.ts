import pino from "pino";

// Spec Section 81: never log passwords, OTPs, payment credentials, or
// other sensitive personal content. Redaction is applied at the logger
// level so a developer forgetting to scrub a field doesn't leak it.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "sessionToken",
      "tokenHash",
      "otp",
      "mfaSecret",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.otp",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});
