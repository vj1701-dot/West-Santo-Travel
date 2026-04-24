"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { PropsWithChildren } from "react";
import { Bell, ChevronRight, Menu, Search, Settings } from "lucide-react";

import { LoginButton } from "@/components/login-button";
import { LogoutButton } from "@/components/logout-button";

type CurrentUser = {
  firstName: string;
  lastName: string;
  role: string;
} | null | undefined;

const navSections = [
  {
    label: "Travel",
    items: [
      { href: "/", label: "Overview", roles: ["ADMIN", "COORDINATOR", "PASSENGER"] },
      { href: "/itineraries", label: "Itineraries", roles: ["ADMIN", "COORDINATOR", "PASSENGER"] },
      { href: "/add-flight", label: "Add Flight", roles: ["ADMIN", "COORDINATOR"] },
      { href: "/submissions", label: "Submissions", roles: ["ADMIN", "COORDINATOR"] },
    ],
  },
  {
    label: "Directory",
    items: [
      { href: "/passengers", label: "Passengers", roles: ["ADMIN", "COORDINATOR"] },
      { href: "/drivers", label: "Drivers", roles: ["ADMIN", "COORDINATOR"] },
      { href: "/users", label: "Users", roles: ["ADMIN", "COORDINATOR"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/reminders", label: "Reminders", roles: ["ADMIN", "COORDINATOR"] },
      { href: "/approvals", label: "Approvals", roles: ["ADMIN", "COORDINATOR"] },
      { href: "/admin", label: "Admin", roles: ["ADMIN"] },
    ],
  },
];

function buildPreviewRoleHref(pathname: string, searchParams: { toString(): string }, nextRole: string) {
  const next = new URLSearchParams(searchParams.toString());
  next.set("previewRole", nextRole);
  return `${pathname}?${next.toString()}`;
}

function formatRole(role: string | null | undefined) {
  if (!role) return "Guest";
  if (role === "COORDINATOR") return "Coordinator";
  if (role === "PASSENGER") return "Passenger";
  if (role === "ADMIN") return "Admin";
  return role;
}

function initialsForUser(user: CurrentUser) {
  if (!user) return "WS";
  return `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
}

function formatBreadcrumb(pathname: string) {
  if (pathname === "/") return "Overview";
  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/-/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase()),
    )
    .join(" / ");
}

export function AppShell({
  children,
  currentUser,
  effectiveRole,
}: PropsWithChildren<{ currentUser?: CurrentUser; effectiveRole?: string | null }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeRole = effectiveRole ?? currentUser?.role ?? null;
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (activeRole ? item.roles.includes(activeRole) : false)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* SVG filters for the nav button glow effect */}
        <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
          <defs>
            <filter id="unopaq">
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" />
            </filter>
            <filter id="unopaq2">
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -15" />
            </filter>
            <filter id="unopaq3">
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -5" />
            </filter>
          </defs>
        </svg>

        <div className="sb-brand">
          <div className="sb-mono">WST</div>
          <div className="sb-wordmark">
            <div className="name">West Santo Travel</div>
            <div className="sub">Operations Console</div>
          </div>
        </div>

        {currentUser?.role === "ADMIN" ? (
          <div className="role-switch">
            <div className="rlabel">Viewing as</div>
            <div className="role-seg">
              {[
                { key: "ADMIN", label: "Admin" },
                { key: "COORDINATOR", label: "Coord" },
                { key: "PASSENGER", label: "Passenger" },
              ].map((role) => (
                <Link
                  key={role.key}
                  className={activeRole === role.key ? "on" : ""}
                  href={buildPreviewRoleHref(pathname, searchParams, role.key)}
                >
                  {role.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <nav className="sb-nav">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <div className="sb-section-label">{section.label}</div>
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <div key={item.href} className="sb-item-container">
                    <Link
                      className={`sb-real-link${active ? " active" : ""}`}
                      href={item.href}
                      aria-label={item.label}
                    />
                    <div className="sb-item-border">
                      <div className={`sb-item${active ? " active" : ""}`}>
                        <div className="sb-backdrop" />
                        <div className="sb-spin sb-spin-blur" />
                        <div className="sb-spin sb-spin-intense" />
                        <div className="sb-spin sb-spin-inside" />
                        <span>{item.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sb-user">
          <div className="avatar">{initialsForUser(currentUser)}</div>
          <div className="sb-user-info">
            <div className="uname">
              {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Not signed in"}
            </div>
            <div className="urole">{formatRole(activeRole)}</div>
          </div>
          {currentUser ? <LogoutButton /> : <LoginButton />}
        </div>
      </aside>

      <main className="app-shell__main">
        <div className="topbar">
          <button className="btn-ghost" type="button" aria-label="Menu">
            <Menu />
          </button>
          <div className="crumbs">
            <span>Console</span>
            <ChevronRight size={14} />
            <span className="current">{formatBreadcrumb(pathname)}</span>
          </div>
          <div className="search">
            <Search size={16} color="var(--ink-400)" />
            <input placeholder="Search flights, passengers, drivers..." />
            <span className="kbd">K</span>
          </div>
          <div className="live">{dateLabel}</div>
          <button className="icon-btn" type="button" aria-label="Notifications">
            <Bell />
          </button>
          <button className="icon-btn" type="button" aria-label="Settings">
            <Settings />
          </button>
        </div>

        <main className="content">
          <div className="mobile-nav">
            {visibleSections.flatMap((section) => section.items).map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} className={`mobile-nav__item${active ? " mobile-nav__item--active" : ""}`} href={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="page-frame">{children}</div>
        </main>
      </main>
    </div>
  );
}
