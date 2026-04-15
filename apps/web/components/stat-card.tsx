type Props = {
  label: string;
  value: string;
  detail?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
};

export function StatCard({ label, value, detail, trend, trendValue }: Props) {
  return (
    <article className="stat-card">
      <div style={{ fontSize: "0.875rem", color: "var(--slate-500)", fontWeight: "500" }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--slate-900)", margin: "0.5rem 0" }}>
        {value}
      </div>
      {detail && (
        <div style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>
          {detail}
        </div>
      )}
      {trendValue && (
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: "600",
            marginTop: "0.5rem",
            color:
              trend === "up"
                ? "var(--success)"
                : trend === "down"
                  ? "var(--error)"
                  : "var(--slate-600)",
          }}
        >
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {trendValue}
        </div>
      )}
    </article>
  );
}
