# DATA_GOVERNANCE.md (Phase 1)

## Personal data collected in Phase 1
- Email (required for login)
- Password (hashed, never stored/logged in plaintext)
- Display name (optional)
- Home country / preferred language / preferred currency (all optional,
  spec Section 9 — "make optional information genuinely optional")
- Session metadata: user agent, IP address (for security/session
  management, not analytics)
- Login attempt records: email attempted, IP, success/failure, timestamp
  (for brute-force detection)

## Not collected in Phase 1
Phone numbers (schema field exists for future OTP support, unused),
payment details, identity documents, location/GPS data, photos. These
arrive with later phases and each will get its own governance entry when
implemented — not collected preemptively "just in case."

## Separation principle (spec Section 54)
Phase 1 only has platform-user data — there is no Place/business data yet,
so the User/PublicPlace separation the spec requires doesn't yet have a
second category to separate from. This document will be split into
"Platform User Data" and "Public Place Data" sections starting Phase 2.

## Retention
No automated retention/deletion policy is implemented yet. `AuditLog` and
`LoginAttempt` will grow unbounded until a retention job is built — flagged
as a Phase 2+ task, not a Phase 1 gap that blocks foundation work but one
that must be resolved before real user data accumulates at scale.

## User rights (not yet implemented, architecture pending)
Account deletion, data export, and consent withdrawal endpoints do not
exist yet in Phase 1. `User.status = DEACTIVATED` exists as a soft-disable
mechanism but does not currently trigger data erasure. This must be
resolved before any jurisdiction requiring a "right to erasure" (e.g. GDPR)
applies to real users — tracked, not solved, here.

## Legal review reminder (spec Section 92/93)
None of the above constitutes legal compliance sign-off. A qualified
privacy/legal professional must review actual data practices before
launch in any specific jurisdiction.
