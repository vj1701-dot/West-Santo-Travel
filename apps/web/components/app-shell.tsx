"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

import { LoginButton } from "@/components/login-button";
import { LogoutButton } from "@/components/logout-button";

const navItems = [
  { href: "/", label: "Overview", roles: ["ADMIN", "COORDINATOR", "PASSENGER"] },
  { href: "/add-flight", label: "Add Flight", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/passengers", label: "Passengers", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/drivers", label: "Drivers", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/users", label: "Users", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/reminders", label: "Reminders", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/admin", label: "Admin", roles: ["ADMIN"] },
];

export function AppShell({
  children,
  currentUser,
  effectiveRole,
}: PropsWithChildren<{ currentUser?: { firstName: string; lastName: string; role: string } | null; effectiveRole?: string | null }>) {
  const pathname = usePathname();
  const currentEffectiveRole = effectiveRole ?? currentUser?.role;
  const visibleNavItems = navItems.filter((item) => !currentEffectiveRole || item.roles.includes(currentEffectiveRole));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">WRS</div>
          <div>
            <strong style={{ color: "white", fontSize: "1.125rem", display: "block" }}>West Region Santos</strong>
            <p style={{ color: "var(--slate-400)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Flight Management
            </p>
          </div>
        </div>

        <nav className="nav">
          {visibleNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} className={`nav-link ${active ? "nav-link--active" : ""}`} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Signed in as</p>
          {currentUser ? (
            <>
              <strong style={{ marginTop: "0.25rem", display: "block" }}>
                {currentUser.firstName} {currentUser.lastName}
              </strong>
              <p style={{ marginTop: "0.25rem", fontSize: "0.875rem" }}>
                {currentEffectiveRole}
                {currentEffectiveRole !== currentUser.role ? ` preview` : ""}
              </p>
              {currentUser.role === "ADMIN" ? (
                <div className="preview-links">
                  <Link className={`preview-link ${currentEffectiveRole === "ADMIN" ? "preview-link--active" : ""}`} href={pathname}>
                    Admin
                  </Link>
                  <Link className={`preview-link ${currentEffectiveRole === "COORDINATOR" ? "preview-link--active" : ""}`} href={`${pathname}?previewRole=COORDINATOR`}>
                    Coordinator
                  </Link>
                  <Link className={`preview-link ${currentEffectiveRole === "PASSENGER" ? "preview-link--active" : ""}`} href={`${pathname}?previewRole=PASSENGER`}>
                    Passenger
                  </Link>
                </div>
              ) : null}
              <div style={{ marginTop: "0.75rem" }}>
                <LogoutButton />
              </div>
            </>
          ) : (
            <LoginButton />
          )}
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations Console</p>
            <h2>West Region Santos</h2>
          </div>
          <div className="row-meta">
            <span className="pill">Live operations</span>
            {currentUser ? <LogoutButton /> : <LoginButton />}
          </div>
        </header>

        <div className="mobile-nav">
          {visibleNavItems.map((item) => {
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
