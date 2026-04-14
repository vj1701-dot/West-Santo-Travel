export function formatPassengerNames(
  passengers: Array<{ firstName: string; lastName: string }>,
): string {
  return passengers.map((passenger) => `${passenger.firstName} ${passenger.lastName}`.trim()).join(", ");
}
