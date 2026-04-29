export function formatPassengerNames(
  passengers: Array<{ firstName: string; lastName: string }>,
): string {
  return passengers.map((passenger) => `${passenger.firstName} ${passenger.lastName}`.trim()).join(", ");
}

export function buildGoogleFlightStatusUrl(input: {
  airlineCode: string;
  flightNumber: string;
  departureDate: string;
  departureTime?: string | null;
}) {
  const flightNumberFull = `${input.airlineCode}${input.flightNumber}`.trim();
  const query = [
    flightNumberFull,
    "flight status",
    input.departureDate.trim(),
    input.departureTime?.trim() || null,
  ]
    .filter(Boolean)
    .join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
