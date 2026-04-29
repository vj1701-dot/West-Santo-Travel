type TripReport = {
  itineraryId: string;
  route: string;
  departureDate: Date | null;
  arrivalDate: Date | null;
  passengerCount: number;
  totalCost: number;
  totalRefunded: number;
  netCost: number;
  isArchived: boolean;
};

type PassengerReport = {
  passengerId: string;
  passengerName: string;
  tripCount: number;
  grossAllocatedCost: number;
  refundedAmount: number;
  netCost: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export function ReportsConsole({
  tripReports,
  passengerReports,
}: {
  tripReports: TripReport[];
  passengerReports: PassengerReport[];
}) {
  const totalTripCost = tripReports.reduce((sum, report) => sum + report.totalCost, 0);
  const totalRefunded = tripReports.reduce((sum, report) => sum + report.totalRefunded, 0);
  const totalNet = tripReports.reduce((sum, report) => sum + report.netCost, 0);

  return (
    <section className="stack">
      <div className="grid gap-3 md:grid-cols-3">
        <article className="compact-card">
          <p className="eyebrow">Gross Cost</p>
          <h3>{formatCurrency(totalTripCost)}</h3>
        </article>
        <article className="compact-card">
          <p className="eyebrow">Refunded</p>
          <h3>{formatCurrency(totalRefunded)}</h3>
        </article>
        <article className="compact-card">
          <p className="eyebrow">Net Cost</p>
          <h3>{formatCurrency(totalNet)}</h3>
        </article>
      </div>

      <section className="panel stack">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Trip Reports</p>
            <h2>Trip cost minus refunds</h2>
          </div>
        </div>
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Dates</th>
                <th>Passengers</th>
                <th>Total Cost</th>
                <th>Refunded</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {tripReports.map((report) => (
                <tr key={report.itineraryId}>
                  <td>
                    <strong>{report.route}</strong>
                    <div className="muted-inline">{report.isArchived ? "Archived" : "Active"}</div>
                  </td>
                  <td>
                    {formatDate(report.departureDate)} - {formatDate(report.arrivalDate)}
                  </td>
                  <td>{report.passengerCount}</td>
                  <td>{formatCurrency(report.totalCost)}</td>
                  <td>{formatCurrency(report.totalRefunded)}</td>
                  <td>{formatCurrency(report.netCost)}</td>
                </tr>
              ))}
              {tripReports.length === 0 ? (
                <tr>
                  <td colSpan={6}>No trips available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Passenger Reports</p>
            <h2>Passenger expense tracking</h2>
          </div>
        </div>
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Trips</th>
                <th>Gross Cost</th>
                <th>Refunded</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {passengerReports.map((report) => (
                <tr key={report.passengerId}>
                  <td>{report.passengerName}</td>
                  <td>{report.tripCount}</td>
                  <td>{formatCurrency(report.grossAllocatedCost)}</td>
                  <td>{formatCurrency(report.refundedAmount)}</td>
                  <td>{formatCurrency(report.netCost)}</td>
                </tr>
              ))}
              {passengerReports.length === 0 ? (
                <tr>
                  <td colSpan={5}>No passengers available.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
