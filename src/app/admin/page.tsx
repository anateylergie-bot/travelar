import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { anyRoleHasPermission } from "@/lib/rbac/roles";
import { db } from "@/lib/db";

export default async function AdminPage() {
  const rawToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserFromSessionToken(rawToken);

  if (!user) {
    redirect("/login");
  }

  // Server-side permission check — this is the real gate. The route
  // simply not being linked from the UI would NOT be sufficient
  // (spec Section 84).
  if (!anyRoleHasPermission(user!.roles, "admin.users.view")) {
    return (
      <main>
        <h1>Admin</h1>
        <p>You do not have permission to view this page.</p>
      </main>
    );
  }

  const users = await db.user.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { roles: true },
  });

  return (
    <main style={{ maxWidth: 900 }}>
      <h1>Admin — Users</h1>
      <p>Signed in as {user!.email} ({user!.roles.join(", ")})</p>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Roles</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.status}</td>
              <td>{u.roles.map((r) => r.role).join(", ")}</td>
              <td>{u.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
