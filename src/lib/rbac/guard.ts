import { AppError } from "@/lib/errors/AppError";
import { anyRoleHasPermission, type Permission, type RoleName } from "./roles";
import type { AuthenticatedUser } from "@/lib/auth/session";

// Spec Section 84: every sensitive API must independently verify auth,
// role, ownership, and permission — never rely on the UI hiding a button.
// This guard is meant to be called at the top of every protected route
// handler, not just referenced by the frontend.

export function requireAuth(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Authentication required.");
  }
  return user;
}

export function requirePermission(user: AuthenticatedUser | null, permission: Permission): AuthenticatedUser {
  const authed = requireAuth(user);
  const roleNames = authed.roles as RoleName[];
  if (!anyRoleHasPermission(roleNames, permission)) {
    throw new AppError("UNAUTHORIZED", "You do not have permission to perform this action.");
  }
  return authed;
}
