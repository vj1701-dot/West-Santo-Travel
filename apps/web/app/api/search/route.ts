import { listDrivers, listItineraries, listPassengerItineraries, listPassengers, listUsers } from "@west-santo/data";

import { ok } from "@/lib/api/response";
import { requireApiUser } from "@/lib/auth/guards";

type SearchResult = {
  id: string;
  href: string;
  title: string;
  detail: string;
  type: "Page" | "Passenger" | "Driver" | "User" | "Itinerary" | "Flight";
};

const pageResults = [
  { href: "/", title: "Overview", detail: "Dashboard and flight calendar", roles: ["ADMIN", "COORDINATOR", "PASSENGER"] },
  { href: "/itineraries", title: "Itineraries", detail: "Trips, passengers, flight segments, and edit options", roles: ["ADMIN", "COORDINATOR", "PASSENGER"] },
  { href: "/add-flight", title: "Add Flight", detail: "Create a new trip and flight segment", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/submissions", title: "Submissions", detail: "Review public travel submissions", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/passengers", title: "Passengers", detail: "Passenger directory", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/drivers", title: "Drivers", detail: "Driver directory and airport coverage", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/users", title: "Users", detail: "Authorized app users", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/reminders", title: "Reminders", detail: "Reminder workflows and rules", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/approvals", title: "Approvals", detail: "Pending approval queue", roles: ["ADMIN", "COORDINATOR"] },
  { href: "/admin", title: "Admin", detail: "Admin tools and exports", roles: ["ADMIN"] },
];

function matches(query: string, ...values: Array<string | null | undefined>) {
  const needle = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(needle));
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (!query) {
    return ok([]);
  }

  const results: SearchResult[] = pageResults
    .filter((page) => page.roles.includes(user.role))
    .filter((page) => matches(query, page.title, page.detail, page.href))
    .map((page) => ({
      id: `page:${page.href}`,
      href: page.href,
      title: page.title,
      detail: page.detail,
      type: "Page" as const,
    }));

  const itineraries = user.role === "PASSENGER" ? await listPassengerItineraries(user.id, { limit: 40 }) : await listItineraries({ limit: 40 });

  for (const itinerary of itineraries) {
    const passengers = itinerary.itineraryPassengers.map((entry) => `${entry.passenger.firstName} ${entry.passenger.lastName}`);
    const route = itinerary.flightSegments.map((segment) => `${segment.departureAirport.code} to ${segment.arrivalAirport.code}`).join(" / ");
    const flightNumbers = itinerary.flightSegments.map((segment) => segment.flightNumber);

    if (matches(query, route, itinerary.status, itinerary.notes, ...passengers, ...flightNumbers)) {
      results.push({
        id: `itinerary:${itinerary.id}`,
        href: user.role === "PASSENGER" ? "/itineraries" : `/itineraries/${itinerary.id}/edit`,
        title: route || "Itinerary",
        detail: [passengers.join(", "), flightNumbers.join(", "), itinerary.status].filter(Boolean).join(" - "),
        type: "Itinerary",
      });
    }

    for (const segment of itinerary.flightSegments) {
      if (matches(query, segment.flightNumber, segment.airline, segment.departureAirport.code, segment.arrivalAirport.code, segment.departureAirport.name, segment.arrivalAirport.name)) {
        results.push({
          id: `flight:${segment.id}`,
          href: user.role === "PASSENGER" ? "/itineraries" : `/itineraries/${itinerary.id}/edit`,
          title: `${segment.flightNumber} - ${segment.departureAirport.code} to ${segment.arrivalAirport.code}`,
          detail: `${segment.airline} flight segment`,
          type: "Flight",
        });
      }
    }
  }

  if (user.role !== "PASSENGER") {
    const [passengers, drivers, users] = await Promise.all([
      listPassengers(query),
      listDrivers(),
      listUsers(query),
    ]);

    results.push(
      ...passengers.slice(0, 8).map((passenger) => ({
        id: `passenger:${passenger.id}`,
        href: "/passengers",
        title: `${passenger.firstName} ${passenger.lastName}`,
        detail: passenger.phone ?? passenger.email ?? passenger.passengerType,
        type: "Passenger" as const,
      })),
    );

    results.push(
      ...drivers
        .filter((driver) => matches(query, driver.name, driver.phone, driver.notes, ...driver.driverAirports.map((item) => item.airport.code)))
        .slice(0, 8)
        .map((driver) => ({
          id: `driver:${driver.id}`,
          href: "/drivers",
          title: driver.name,
          detail: [driver.phone, driver.driverAirports.map((item) => item.airport.code).join(", ")].filter(Boolean).join(" - ") || "Driver",
          type: "Driver" as const,
        })),
    );

    results.push(
      ...users.slice(0, 8).map((item) => ({
        id: `user:${item.id}`,
        href: "/users",
        title: `${item.firstName} ${item.lastName}`,
        detail: `${item.role} - ${item.email}`,
        type: "User" as const,
      })),
    );
  }

  return ok(results.slice(0, 18));
}
