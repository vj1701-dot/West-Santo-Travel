type Props = {
  label: string;
  value: string;
  detail: string;
};

export function StatCard({ label, value, detail }: Props) {
  return (
    <article className="panel stat-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
