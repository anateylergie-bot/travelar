import { describe, it, expect } from "vitest";
import { roleHasPermission, anyRoleHasPermission } from "@/lib/rbac/roles";
import { requireAuth, requirePermission } from "@/lib/rbac/guard";
import { AppError } from "@/lib/errors/AppError";

describe("roleHasPermission", () => {
  it("grants SUPER_ADMIN full admin permissions", () => {
    expect(roleHasPermission("SUPER_ADMIN", "admin.users.manage_roles")).toBe(true);
    expect(roleHasPermission("SUPER_ADMIN", "admin.feature_flags.manage")).toBe(true);
  });

  it("does not grant TOURIST any admin permissions", () => {
    expect(roleHasPermission("TOURIST", "admin.users.view")).toBe(false);
  });

  it("grants SECURITY_ADMIN audit log access but not role management", () => {
    expect(roleHasPermission("SECURITY_ADMIN", "admin.audit_log.view")).toBe(true);
    expect(roleHasPermission("SECURITY_ADMIN", "admin.users.manage_roles")).toBe(false);
  });
});

describe("anyRoleHasPermission", () => {
  it("returns true if any of the user's roles grants the permission", () => {
    expect(anyRoleHasPermission(["TOURIST", "MODERATOR"], "admin.users.view")).toBe(true);
  });

  it("returns false if none of the user's roles grant the permission", () => {
    expect(anyRoleHasPermission(["TOURIST", "LOCAL_DATA_AGENT"], "admin.users.view")).toBe(false);
  });
});

describe("requireAuth", () => {
  it("throws UNAUTHENTICATED when user is null", () => {
    expect(() => requireAuth(null)).toThrow(AppError);
    try {
      requireAuth(null);
    } catch (e) {
      expect((e as AppError).code).toBe("UNAUTHENTICATED");
    }
  });

  it("returns the user when present", () => {
    const user = { id: "1", email: "a@b.com", displayName: null, roles: ["TOURIST"] as const };
    expect(requireAuth(user as any)).toBe(user);
  });
});

describe("requirePermission", () => {
  const admin = { id: "1", email: "admin@x.com", displayName: null, roles: ["SUPER_ADMIN"] as const };
  const tourist = { id: "2", email: "t@x.com", displayName: null, roles: ["TOURIST"] as const };

  it("allows a user whose role has the permission", () => {
    expect(() => requirePermission(admin as any, "admin.users.manage_roles")).not.toThrow();
  });

  it("throws UNAUTHORIZED for a user whose role lacks the permission", () => {
    try {
      requirePermission(tourist as any, "admin.users.manage_roles");
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("UNAUTHORIZED");
    }
  });

  it("throws UNAUTHENTICATED for a null user before checking permission", () => {
    try {
      requirePermission(null, "admin.users.manage_roles");
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("UNAUTHENTICATED");
    }
  });
});
