import type { PropsWithChildren } from "react";

export function AuthPageShell({ children }: PropsWithChildren) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background: "linear-gradient(135deg, #8B4513 0%, #D2691E 25%, #CD853F 50%, #A0522D 75%, #5C3D2E 100%)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 15s ease infinite",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @media (max-width: 768px) {
          main {
            padding: 1rem !important;
          }
        }
      `}</style>
      
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(circle at 20% 30%, rgba(255, 200, 150, 0.1), transparent 40%), radial-gradient(circle at 80% 70%, rgba(139, 69, 19, 0.1), transparent 40%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: "2.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.8rem",
              fontWeight: 300,
              color: "white",
              margin: 0,
              letterSpacing: "0.5px",
            }}
          >
            West Santo
          </h2>
          <p
            style={{
              fontSize: "0.875rem",
              color: "rgba(255, 255, 255, 0.8)",
              margin: "0.5rem 0 0 0",
              letterSpacing: "0.3px",
            }}
          >
            Travel Management
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}

