import Link from "next/link";

const ADMIN_NAV = [
  { href: "/admin", label: "Users" },
  { href: "/admin/rewards", label: "Reward Rules" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/business-claims", label: "Business Claims" },
  { href: "/admin/business-updates", label: "Business Updates" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/emergency-numbers", label: "Emergency Numbers" },
  { href: "/admin/safety-alerts", label: "Safety Alerts" },
  { href: "/admin/api-keys", label: "API Keys" },
  { href: "/admin/coverage-targets", label: "Coverage Targets" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: "1px solid #e7e5e4",
          padding: "1.5rem 1rem",
          background: "#fafaf9",
        }}
      >
        <strong style={{ display: "block", marginBottom: "1rem" }}>Admin</strong>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {ADMIN_NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} style={{ fontSize: "0.9rem" }}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div style={{ flex: 1, padding: "1.5rem 2rem", maxWidth: 1000 }}>{children}</div>
    </div>
  );
}
