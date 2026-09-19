import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromSessionToken, SESSION_COOKIE_NAME, type AuthenticatedUser } from "@/lib/auth/session";
import { anyRoleHasPermission, type Permission } from "@/lib/rbac/roles";

/**
 * Server-component helper: redirects to /login if unauthenticated,
 * returns { user, allowed } otherwise. The page decides what to render
 * when allowed is false (spec Section 84 — real enforcement happens at
 * the API layer regardless; this only controls what the page *shows*).
 */
export async function checkPagePermission(
  permission: Permission
): Promise<{ user: AuthenticatedUser; allowed: boolean }> {
  const rawToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserFromSessionToken(rawToken);
  if (!user) redirect("/login");

  return { user: user!, allowed: anyRoleHasPermission(user!.roles, permission) };
}
