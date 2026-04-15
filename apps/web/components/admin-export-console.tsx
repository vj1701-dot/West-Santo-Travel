export function AdminExportConsole() {
  const exports = [
    { href: "/api/exports/trips", label: "Trips & Flights CSV", description: "Trip record, passengers, flights, booking, accommodation, and transport summary." },
    { href: "/api/exports/passengers", label: "Passengers CSV", description: "Passenger roster, contact, Telegram link state, and notes." },
    { href: "/api/exports/drivers", label: "Drivers CSV", description: "Driver directory, airport assignment, and Telegram link state." },
    { href: "/api/exports/users", label: "Users CSV", description: "Authorized users, roles, active state, and airport assignment." },
  ];

  return (
    <section className="panel stack">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Admin Export</p>
          <h2>Download operational datasets</h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {exports.map((item) => (
          <a key={item.href} className="row-card export-card" href={item.href}>
            <div className="row-card__title">
              <div>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
              </div>
              <span className="pill">CSV</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
