import { exportDrivers, exportPassengers, exportTrips, exportUsers } from "@west-santo/data";

import { fail } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/guards";

function csvEscape(value: unknown) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  return lines.join("\n");
}

export async function GET(_: Request, context: { params: Promise<{ dataset: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth instanceof Response) return auth;
  const { dataset } = await context.params;

  let filename = "export.csv";
  let rows: Array<Record<string, unknown>> = [];

  if (dataset === "trips") {
    filename = "trips.csv";
    const trips = await exportTrips();
    rows = trips.map((trip) => ({
      itineraryId: trip.id,
      status: trip.status,
      passengers: trip.itineraryPassengers.map((item) => `${item.passenger.firstName} ${item.passenger.lastName}`).join(" | "),
      route: trip.flightSegments.map((segment) => `${segment.departureAirport.code}-${segment.arrivalAirport.code}`).join(" | "),
      flights: trip.flightSegments.map((segment) => segment.flightNumber).join(" | "),
      departureTimes: trip.flightSegments.map((segment) => segment.departureTimeLocal.toISOString()).join(" | "),
      bookingId: trip.booking?.confirmationNumber ?? "",
      totalPrice: trip.booking?.totalCost?.toString() ?? "",
      accommodation: trip.accommodations.map((item) => item.mandir.name).join(" | "),
      transport: trip.transportTasks.map((task) => `${task.taskType}:${task.status}:${task.airport.code}`).join(" | "),
      notes: trip.notes ?? "",
    }));
  } else if (dataset === "passengers") {
    filename = "passengers.csv";
    const passengers = await exportPassengers();
    rows = passengers.map((passenger) => ({
      passengerId: passenger.id,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      legalName: passenger.legalName ?? "",
      email: passenger.email ?? "",
      phone: passenger.phone ?? "",
      passengerType: passenger.passengerType,
      telegramChatId: passenger.telegramChatId ?? "",
      telegramUsername: passenger.telegramUsername ?? "",
      itineraryCount: passenger.itineraryPassengers.length,
      notes: passenger.notes ?? "",
    }));
  } else if (dataset === "drivers") {
    filename = "drivers.csv";
    const drivers = await exportDrivers();
    rows = drivers.map((driver) => ({
      driverId: driver.id,
      name: driver.name,
      phone: driver.phone ?? "",
      airports: driver.driverAirports.map((assignment) => assignment.airport.code).join(" | "),
      telegramChatId: driver.telegramChatId ?? "",
      telegramUsername: driver.telegramUsername ?? "",
      taskCount: driver.transportTaskDrivers.length,
      notes: driver.notes ?? "",
    }));
  } else if (dataset === "users") {
    filename = "users.csv";
    const users = await exportUsers();
    rows = users.map((user) => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? "",
      role: user.role,
      isActive: user.isActive,
      airports: [...user.adminAirports, ...user.coordinatorAirports].map((assignment) => assignment.airport.code).join(" | "),
      telegramChatId: user.telegramChatId ?? "",
      telegramUsername: user.telegramUsername ?? "",
    }));
  } else {
    return fail("NOT_FOUND", "Unknown export dataset.", 404);
  }

  return new Response(toCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
