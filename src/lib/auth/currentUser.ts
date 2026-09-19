import { cookies } from "next/headers";
import { getUserFromSessionToken, SESSION_COOKIE_NAME, type AuthenticatedUser } from "@/lib/auth/session";

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const rawToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  return getUserFromSessionToken(rawToken);
}
