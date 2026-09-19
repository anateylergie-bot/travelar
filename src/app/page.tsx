import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>TravelSafe — Foundation Build</h1>
      <p>
        This is the Phase 1 foundation: authentication, roles, and the admin
        base. The tourist search, map, agent, and rewards experiences from
        the full spec are not built yet — they arrive in later phases.
      </p>
      <p>
        <Link href="/login">Log in</Link> · <Link href="/register">Create an account</Link>
      </p>
    </main>
  );
}
