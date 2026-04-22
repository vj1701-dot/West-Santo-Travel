import {
  ApprovalStatus,
  PassengerType,
  PrismaClient,
  TransportTaskStatus,
  TransportTaskType,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import tzLookup from "tz-lookup";
import { localDateTimeStringToDate, zonedLocalDateTimeToUtc } from "@west-santo/core";

const prisma = new PrismaClient();
const AIRPORT_IMPORT_ENABLED = process.env.AIRPORT_IMPORT_ENABLED !== "false";
const AIRPORT_IMPORT_URL =
  process.env.AIRPORT_IMPORT_URL ?? "https://davidmegginson.github.io/ourairports-data/airports.csv";
const AIRPORT_IMPORT_CHUNK_SIZE = 1000;
const MANDIR_IMPORT_ENABLED = process.env.MANDIR_IMPORT_ENABLED !== "false";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@westsanto.org";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BAPS_MANDIR_URLS = [
  "https://www.baps.org/Global-Network/North-America/BAPS-North-America---All-Centers.aspx",
  "https://www.baps.org/Global-Network/UK-and-Europe.aspx",
  "https://www.baps.org/Global-Network/Africa.aspx",
  "https://www.baps.org/Global-Network/Asia-Pacific.aspx",
  "https://www.baps.org/Global-Network/MiddleEast.aspx",
  "https://www.baps.org/Global-Network/India/BAPS-India---All-Centers.aspx",
];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanHtmlBlock(value) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

async function importAirports() {
  if (!AIRPORT_IMPORT_ENABLED) {
    console.log("[seed] airport import disabled");
    return;
  }

  console.log(`[seed] downloading airports from ${AIRPORT_IMPORT_URL}`);
  const response = await fetch(AIRPORT_IMPORT_URL);

  if (!response.ok) {
    throw new Error(`Unable to download airports CSV: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Airport CSV is empty.");
  }

  const headers = parseCsvLine(lines[0]);
  const columnIndex = new Map(headers.map((header, index) => [header, index]));

  const airports = [];
  const seenCodes = new Set();

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const code = row[columnIndex.get("iata_code")]?.trim().toUpperCase();
    const name = row[columnIndex.get("name")]?.trim();
    const type = row[columnIndex.get("type")]?.trim();
    const latitude = Number(row[columnIndex.get("latitude_deg")]);
    const longitude = Number(row[columnIndex.get("longitude_deg")]);

    if (!code || !name || !type || type === "closed" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      continue;
    }

    if (seenCodes.has(code)) {
      continue;
    }

    let timeZone;

    try {
      timeZone = tzLookup(latitude, longitude);
    } catch {
      continue;
    }

    seenCodes.add(code);
    airports.push({
      code,
      name,
      city: row[columnIndex.get("municipality")]?.trim() || null,
      state: row[columnIndex.get("iso_region")]?.trim() || null,
      country: row[columnIndex.get("iso_country")]?.trim() || null,
      timeZone,
    });
  }

  console.log(`[seed] importing ${airports.length} airports`);

  for (let index = 0; index < airports.length; index += AIRPORT_IMPORT_CHUNK_SIZE) {
    const chunk = airports.slice(index, index + AIRPORT_IMPORT_CHUNK_SIZE);
    await prisma.airport.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
}

async function importMandirs() {
  if (!MANDIR_IMPORT_ENABLED) {
    console.log("[seed] mandir import disabled");
    return;
  }

  const byName = new Map();

  for (const url of BAPS_MANDIR_URLS) {
    console.log(`[seed] downloading mandirs from ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Unable to download BAPS centers page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const entryPattern =
      /<h3[^>]*class="[^"]*content-title[^"]*"[^>]*>\s*<a[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>\s*([^<]+?)\s*<\/a>[\s\S]*?<\/h3>[\s\S]*?<div class="description">\s*([\s\S]*?)<\/div>/gi;

    for (const match of html.matchAll(entryPattern)) {
      const sourcePath = match[1]?.trim();
      const heading = cleanHtmlBlock(match[2] ?? "");
      const description = cleanHtmlBlock(match[3] ?? "");

      if (!heading || !description || !/BAPS/i.test(description)) {
        continue;
      }

      const lines = description.split("\n").map((line) => line.trim()).filter(Boolean);
      const title = lines[0] ?? "BAPS Center";
      const address = lines.slice(1).join(", ");

      byName.set(heading, {
        name: heading,
        city: heading,
        notes: `${title}${address ? ` | ${address}` : ""} | Source: https://www.baps.org${sourcePath}`,
      });
    }
  }

  const mandirs = Array.from(byName.values());
  console.log(`[seed] importing ${mandirs.length} BAPS mandirs/centers`);
  await prisma.mandir.createMany({
    data: mandirs,
    skipDuplicates: true,
  });
}

async function main() {
  const [existingUsers, existingPassengers, existingItineraries, existingDrivers] = await Promise.all([
    prisma.user.count(),
    prisma.passenger.count(),
    prisma.itinerary.count(),
    prisma.driver.count(),
  ]);

  if (existingUsers > 0 || existingPassengers > 0 || existingItineraries > 0 || existingDrivers > 0) {
    console.log(
      `[seed] existing application data detected (users=${existingUsers}, passengers=${existingPassengers}, itineraries=${existingItineraries}, drivers=${existingDrivers}); skipping default seed`,
    );
    return;
  }

  await prisma.notificationLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.transportTaskStatusHistory.deleteMany();
  await prisma.transportTaskDriver.deleteMany();
  await prisma.transportTask.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.accommodation.deleteMany();
  await prisma.flightSegment.deleteMany();
  await prisma.bookingAllocation.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.itineraryPassenger.deleteMany();
  await prisma.itinerary.deleteMany();
  await prisma.driverAirport.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.coordinatorAirport.deleteMany();
  await prisma.coordinatorMandir.deleteMany();
  await prisma.adminAirport.deleteMany();
  await prisma.adminMandir.deleteMany();
  await prisma.airportMandirMapping.deleteMany();
  await prisma.mandir.deleteMany();
  await prisma.airport.deleteMany();
  await prisma.passengerUserLink.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.user.deleteMany();

  await importAirports();
  await importMandirs();

  const [lax, ord] = await Promise.all([
    prisma.airport.findUnique({ where: { code: "LAX" } }),
    prisma.airport.findUnique({ where: { code: "ORD" } }),
  ]);

  if (!lax || !ord) {
    throw new Error("Required seed airports LAX and ORD were not found after airport import.");
  }

  const [laMandir, chicagoMandir] = await Promise.all([
    prisma.mandir.findUnique({ where: { name: "Los Angeles" } }),
    prisma.mandir.findUnique({ where: { name: "Chicago" } }),
  ]);

  if (!laMandir || !chicagoMandir) {
    throw new Error("Required BAPS mandirs Los Angeles and Chicago were not found after mandir import.");
  }

  await prisma.airportMandirMapping.createMany({
    data: [
      { airportId: lax.id, mandirId: laMandir.id, isDefault: true },
      { airportId: ord.id, mandirId: chicagoMandir.id, isDefault: true },
    ],
  });

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      phone: "5550001111",
      firstName: "Amit",
      lastName: "Patel",
      role: UserRole.ADMIN,
    },
  });

  if (ADMIN_PASSWORD?.trim()) {
    await prisma.account.create({
      data: {
        userId: admin.id,
        providerId: "credential",
        accountId: admin.id,
        password: await hashPassword(ADMIN_PASSWORD),
      },
    });
  } else {
    console.warn("[seed] ADMIN_PASSWORD is not set; seeded admin will not have email/password sign-in.");
  }

  const coordinator = await prisma.user.create({
    data: {
      email: "coordinator@westsanto.org",
      phone: "5550002222",
      firstName: "Nirav",
      lastName: "Shah",
      role: UserRole.COORDINATOR,
    },
  });

  const [passengerOne, passengerTwo] = await Promise.all([
    prisma.passenger.create({
      data: {
        firstName: "Swami",
        lastName: "A",
        legalName: "Swami A",
        email: "swami.a@example.com",
        phone: "5553334444",
        passengerType: PassengerType.WEST_SANTO,
      },
    }),
    prisma.passenger.create({
      data: {
        firstName: "Swami",
        lastName: "B",
        legalName: "Swami B",
        phone: "5553335555",
        passengerType: PassengerType.GUEST_SANTO,
      },
    }),
  ]);

  const driver = await prisma.driver.create({
    data: {
      name: "Ramesh Driver",
      phone: "5559990000",
    },
  });

  await prisma.driverAirport.create({
    data: {
      driverId: driver.id,
      airportId: lax.id,
    },
  });

  const itinerary = await prisma.itinerary.create({
    data: {
      notes: "West coast visit",
      createdByUserId: admin.id,
      itineraryPassengers: {
        create: [{ passengerId: passengerOne.id }, { passengerId: passengerTwo.id }],
      },
    },
  });

  const segment = await prisma.flightSegment.create({
    data: {
      itineraryId: itinerary.id,
      segmentOrder: 1,
      airline: "United",
      flightNumber: "UA123",
      departureAirportId: ord.id,
      arrivalAirportId: lax.id,
      departureTimeZone: ord.timeZone,
      arrivalTimeZone: lax.timeZone,
      departureTimeLocal: localDateTimeStringToDate("2026-05-12T12:00:00"),
      arrivalTimeLocal: localDateTimeStringToDate("2026-05-12T14:30:00"),
      departureTimeUtc: zonedLocalDateTimeToUtc("2026-05-12T12:00:00", ord.timeZone),
      arrivalTimeUtc: zonedLocalDateTimeToUtc("2026-05-12T14:30:00", lax.timeZone),
      notes: "Window seat",
    },
  });

  const booking = await prisma.booking.create({
    data: {
      itineraryId: itinerary.id,
      confirmationNumber: "ABC123",
      totalCost: 1200,
      notes: "Group booking",
    },
  });

  await prisma.bookingAllocation.createMany({
    data: [
      { bookingId: booking.id, passengerId: passengerOne.id, allocatedCost: 600 },
      { bookingId: booking.id, passengerId: passengerTwo.id, allocatedCost: 600 },
    ],
  });

  await prisma.accommodation.create({
    data: {
      itineraryId: itinerary.id,
      mandirId: laMandir.id,
      room: "Room 12",
      checkInDate: new Date("2026-05-12"),
      checkOutDate: new Date("2026-05-14"),
    },
  });

  const task = await prisma.transportTask.create({
    data: {
      itineraryId: itinerary.id,
      flightSegmentId: segment.id,
      taskType: TransportTaskType.PICKUP,
      airportId: lax.id,
      mandirId: laMandir.id,
      scheduledTimeLocal: localDateTimeStringToDate("2026-05-12T14:30:00"),
      scheduledTimeUtc: zonedLocalDateTimeToUtc("2026-05-12T14:30:00", lax.timeZone),
      status: TransportTaskStatus.ASSIGNED,
      createdByUserId: admin.id,
      notes: "Carry luggage for two passengers",
    },
  });

  await prisma.transportTaskDriver.create({
    data: {
      transportTaskId: task.id,
      driverId: driver.id,
      assignedByUserId: coordinator.id,
    },
  });

  await prisma.approvalRequest.create({
    data: {
      itineraryId: itinerary.id,
      requestedByUserId: coordinator.id,
      status: ApprovalStatus.PENDING,
      entityType: "FLIGHT_SEGMENT",
      entityId: segment.id,
      originalPayload: { arrivalTimeLocal: "2026-05-12T14:30:00" },
      proposedPayload: { arrivalTimeLocal: "2026-05-12T15:10:00", notes: "Time changed" },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
