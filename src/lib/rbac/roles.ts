// Spec Section 7: role list, kept as the single source of truth. Must
// match the Role enum in prisma/schema.prisma exactly.
export const ROLES = [
  "TOURIST",
  "LOCAL_DATA_AGENT",
  "FIELD_VERIFIER",
  "BUSINESS_OWNER",
  "MODERATOR",
  "DATA_MANAGER",
  "FINANCE_ADMIN",
  "SECURITY_ADMIN",
  "SUPER_ADMIN",
] as const;

export type RoleName = (typeof ROLES)[number];

// Coarse-grained permissions used by Phase 1 admin foundation. This list
// will grow substantially in later phases (place moderation, payouts,
// fraud review, etc.) — kept intentionally small now to avoid inventing
// permissions for features that don't exist yet.
export const PERMISSIONS = [
  "admin.users.view",
  "admin.users.manage_roles",
  "admin.audit_log.view",
  "admin.feature_flags.manage",
  "admin.system_settings.manage",
  "geography.manage",
  "categories.manage",
  "places.create",
  "agents.manage",
  "tasks.manage",
  "tasks.review",
  "rewards.manage",
  "earnings.approve",
  "payouts.manage",
  "business.claims.review",
  "business.updates.review",
  "business.updates.submit",
  "reports.review",
  "emergency_numbers.manage",
  "safety_alerts.manage",
  "api_keys.manage",
  "coverage_targets.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  TOURIST: [],
  LOCAL_DATA_AGENT: ["places.create"],
  FIELD_VERIFIER: ["places.create"],
  BUSINESS_OWNER: ["business.updates.submit"],
  MODERATOR: [
    "admin.users.view",
    "places.create",
    "tasks.review",
    "business.claims.review",
    "business.updates.review",
    "reports.review",
  ],
  DATA_MANAGER: [
    "admin.users.view",
    "geography.manage",
    "categories.manage",
    "places.create",
    "agents.manage",
    "tasks.manage",
    "tasks.review",
    "business.claims.review",
    "business.updates.review",
    "reports.review",
    "emergency_numbers.manage",
    "safety_alerts.manage",
    "coverage_targets.manage",
  ],
  FINANCE_ADMIN: ["admin.users.view", "rewards.manage", "earnings.approve", "payouts.manage"],
  SECURITY_ADMIN: ["admin.users.view", "admin.audit_log.view"],
  SUPER_ADMIN: [
    "admin.users.view",
    "admin.users.manage_roles",
    "admin.audit_log.view",
    "admin.feature_flags.manage",
    "admin.system_settings.manage",
    "geography.manage",
    "categories.manage",
    "places.create",
    "agents.manage",
    "tasks.manage",
    "tasks.review",
    "rewards.manage",
    "earnings.approve",
    "payouts.manage",
    "business.claims.review",
    "business.updates.review",
    "business.updates.submit",
    "reports.review",
    "emergency_numbers.manage",
    "safety_alerts.manage",
    "api_keys.manage",
    "coverage_targets.manage",
  ],
};

export function roleHasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function anyRoleHasPermission(roles: RoleName[], permission: Permission): boolean {
  return roles.some((r) => roleHasPermission(r, permission));
}
