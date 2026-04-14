"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

import { LoginButton } from "@/components/login-button";
import { LogoutButton } from "@/components/logout-button";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/admin", label: "Admin" },
  { href: "/itineraries", label: "Itineraries" },
  { href: "/transport-tasks", label: "Transport" },
  { href: "/approvals", label: "Approvals" },
  { href: "/passengers", label: "Passengers" },
];

export function AppShell({
  children,
  currentUser,
}: PropsWithChildren<{ currentUser?: { firstName: string; lastName: string; role: string } | null }>) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">WRS</div>
          <div>
            <p className="eyebrow">West Region Santos</p>
            <h1>Flight management</h1>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} className={`nav-link ${active ? "nav-link--active" : ""}`} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Operating mode</p>
          <strong>Telegram-first, web-readable</strong>
          <p>Live operational data is sourced from the shared Prisma-backed service layer.</p>
          {currentUser ? <p>{currentUser.firstName} {currentUser.lastName} · {currentUser.role}</p> : null}
          {currentUser ? <LogoutButton /> : <LoginButton />}
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Mobile-first dashboard</p>
            <h2>West Region Santos</h2>
          </div>
          <div className="row-meta">
            <span className="pill">Live operations</span>
            {currentUser ? <LogoutButton /> : <LoginButton />}
          </div>
        </header>

        <div className="mobile-nav">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} className={`mobile-nav__item ${active ? "mobile-nav__item--active" : ""}`} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="page-frame">{children}</div>
      </main>
    </div>
  );
}
