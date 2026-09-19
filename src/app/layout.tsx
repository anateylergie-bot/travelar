import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelSafe — Phase 1 Foundation",
  description: "Secure Tourist Browser + Global Local Data Network (foundation build)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
