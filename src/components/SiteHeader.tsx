"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const linkStyle = { color: "#111827", textDecoration: "none" } as const;

export default function SiteHeader() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null; // admin has its own nav

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "#0a3c96",
          fontWeight: 700,
          fontSize: 20,
        }}
      >
        <Image src="/logo.png" alt="" width={30} height={36} priority />
        <span>Travelar</span>
      </Link>
      <nav style={{ display: "flex", gap: 18, fontSize: 15 }}>
        <Link href="/explore" style={linkStyle}>Explore</Link>
        <Link href="/login" style={linkStyle}>Log in</Link>
      </nav>
    </header>
  );
}