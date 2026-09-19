import { checkPagePermission } from "@/lib/auth/pagePermission";
import { listApiKeys } from "@/lib/b2b/apiKeys";
import ApiKeyManager, { RevokeButton } from "./ApiKeyManager";

export default async function AdminApiKeysPage() {
  const { allowed } = await checkPagePermission("api_keys.manage");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const keys = await listApiKeys();

  return (
    <main>
      <h1>B2B API Keys</h1>
      <p>
        <small>
          The raw key is shown exactly once, right after creation. Only a hash is stored — if a key is lost, revoke
          it and create a new one (spec Section 61, docs/DECISIONS.md D34).
        </small>
      </p>

      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Prefix</th>
            <th>Scopes</th>
            <th>Status</th>
            <th>Requests</th>
            <th>Last used</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>{k.label}</td>
              <td>
                <code>{k.keyPrefix}…</code>
              </td>
              <td>{k.scopes.join(", ")}</td>
              <td>{k.status}</td>
              <td>{k.requestCount}</td>
              <td>{k.lastUsedAt ? k.lastUsedAt.toISOString().slice(0, 10) : "Never"}</td>
              <td>{k.status === "ACTIVE" && <RevokeButton id={k.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Create a new key</h2>
      <ApiKeyManager />
    </main>
  );
}
