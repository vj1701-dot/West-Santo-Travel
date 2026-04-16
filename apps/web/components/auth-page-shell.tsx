import type { PropsWithChildren } from "react";

export function AuthPageShell({ children }: PropsWithChildren) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem 1rem",
        background:
          "radial-gradient(circle at top left, rgba(79,70,229,0.10), transparent 40%), radial-gradient(circle at bottom right, rgba(15,23,42,0.08), transparent 40%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
            justifyContent: "center",
          }}
        >
          <div className="brand-mark">WRS</div>
          <div>
            <strong style={{ display: "block" }}>West Region Santos</strong>
            <p className="notes" style={{ marginTop: "0.15rem" }}>
              Flight Management
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

