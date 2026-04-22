import {
  ApprovalStatus,
  AuditSource,
  ExternalSyncStatus,
  ItineraryStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PassengerType,
  Prisma,
  ReminderAudience,
  ReminderChannel,
  ReminderRunStatus,
  ReminderTrigger,
  SubmissionStatus,
  TransportTaskType,
  TransportTaskStatus,
  UserRole,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { formatPassengerNames, localDateTimeStringToDate, summarizeDashboard, zonedLocalDateTimeToUtc } from "@west-santo/core";

import { prisma } from "./prisma";

function toSummaryRole(role?: string | null): UserRole {
  if (role === "ADMIN" || role === "COORDINATOR" || role === "PASSENGER") {
    return role;
  }

  return UserRole.ADMIN;
}

function parseDisplayName(displayName?: string | null) {
  const normalized = displayName?.trim();
  if (!normalized) {
    return { firstName: null as string | null, lastName: null as string | null };
  }

  const [firstName, ...rest] = normalized.split(/\s+/);
  const lastName = rest.join(" ").trim() || null;

  return {
    firstName: firstName?.trim() || null,
    lastName,
  };
}

type FlightSegmentInput = {
  itineraryId: string;
  segmentOrder: number;
  airline: string;
  flightNumber: string;
  departureAirportId: string;
  arrivalAirportId: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
};

type PublicSubmissionPayload = {
  submitterName?: string | null;
  submitterPhone?: string | null;
  notes?: string | null;
  passengers?: Array<{
    firstName: string;
    lastName: string;
    phone?: string | null;
    passengerType?: Prisma.PassengerCreateInput["passengerType"];
  }>;
  segments?: Array<{
    segmentOrder?: number;
    airline: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureTimeLocal: string;
    arrivalTimeLocal: string;
    notes?: string | null;
  }>;
};

type GoogleSheetsPassengerInput = {
  firstName: string;
  lastName: string;
};

type GoogleSheetsTripInput = {
  externalKey: string;
  locatorNumber?: string | null;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureDate: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalDate: string;
  arrivalTime: string;
  cost?: string | null;
  passengers: GoogleSheetsPassengerInput[];
  pickupDriverName?: string | null;
  dropoffDriverName?: string | null;
  sourceRows?: number[];
};

type GoogleSheetsSnapshotInput = {
  source: "google-sheets";
  syncedAt: string;
  sheetName: string;
  trips: GoogleSheetsTripInput[];
};

type GoogleSheetsPassengerMatchStrategy = "exact_full" | "exact_swapped" | "fuzzy_full" | "fuzzy_swapped";
type GoogleSheetsDriverMatchStrategy = "exact" | "fuzzy";

type GoogleSheetsResolvedPassenger = {
  passenger: {
    id: string;
    firstName: string;
    lastName: string;
  };
  mode: "matched" | "created";
  matchStrategy?: GoogleSheetsPassengerMatchStrategy | null;
};

type GoogleSheetsResolvedDriver = {
  driver: {
    id: string;
    name: string;
  };
  mode: "matched" | "created";
  matchStrategy?: GoogleSheetsDriverMatchStrategy | null;
};

type GoogleSheetsRosterSnapshot = {
  passengerIds: string[];
  passengers: Array<{ id: string; name: string }>;
  pickupDriverId: string | null;
  pickupDriverName: string | null;
  dropoffDriverId: string | null;
  dropoffDriverName: string | null;
};

type GoogleSheetsPendingRosterDiff = {
  source: "google-sheets";
  syncedAt: string;
  sourceRows: number[];
  current: GoogleSheetsRosterSnapshot;
  proposed: GoogleSheetsRosterSnapshot;
};

const GOOGLE_SHEETS_SYNC_PROVIDER = "google-sheets";
const GOOGLE_SHEETS_SYNC_ACTOR = "google-sheets-sync";
const DEFAULT_SYNC_PASSENGER_TYPE = PassengerType.HARIBHAKTO;

function normalizeSyncText(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeSyncCode(value?: string | null) {
  return normalizeSyncText(value).toUpperCase();
}

function normalizeSyncName(value?: string | null) {
  return normalizeSyncText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSyncPersonName(firstName?: string | null, lastName?: string | null) {
  return normalizeSyncName(`${normalizeSyncText(firstName)} ${normalizeSyncText(lastName)}`);
}

function buildLocalDateTimeFromParts(date: string, time: string) {
  return `${normalizeSyncText(date)}T${normalizeSyncText(time)}`;
}

function parseOptionalCost(value?: string | null) {
  const normalized = normalizeSyncText(value).replace(/[^0-9.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function hashGoogleSheetsTripPayload(trip: GoogleSheetsTripInput) {
  return createHash("sha256").update(JSON.stringify(trip)).digest("hex");
}

function buildPassengerDisplayName(input: { firstName?: string | null; lastName?: string | null }) {
  return `${normalizeSyncText(input.firstName)} ${normalizeSyncText(input.lastName)}`.trim() || "Unknown passenger";
}

function arraysEqualAsSets(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function pickConfidentMatch<T extends { score: number }>(entries: T[], threshold = 0.92) {
  const scored = entries
    .filter((entry) => entry.score >= threshold)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return null;
  }

  if (scored.length === 1) {
    return scored[0];
  }

  return scored[0].score - scored[1].score >= 0.05 ? scored[0] : null;
}

function levenshteinDistance(source: string, target: string) {
  if (source === target) {
    return 0;
  }

  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  const rows = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    let previous = rows[0];
    rows[0] = sourceIndex;

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const current = rows[targetIndex];
      const substitutionCost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
      rows[targetIndex] = Math.min(
        rows[targetIndex] + 1,
        rows[targetIndex - 1] + 1,
        previous + substitutionCost,
      );
      previous = current;
    }
  }

  return rows[target.length];
}

function getSimilarityScore(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

async function createAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    actorUserId?: string | null;
    source?: AuditSource;
    oldValues?: Prisma.InputJsonValue;
    newValues?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actorUserId: input.actorUserId ?? null,
      source: input.source ?? AuditSource.WEB,
      oldValues: input.oldValues,
      newValues: input.newValues,
    },
  });
}

async function resolveSegmentAirports(tx: Prisma.TransactionClient, input: FlightSegmentInput) {
  const airports = await tx.airport.findMany({
    where: {
      id: {
        in: [input.departureAirportId, input.arrivalAirportId],
      },
    },
  });

  const departureAirport = airports.find((airport) => airport.id === input.departureAirportId);
  const arrivalAirport = airports.find((airport) => airport.id === input.arrivalAirportId);

  if (!departureAirport || !arrivalAirport) {
    throw new Error("One or more airports for the flight segment were not found.");
  }

  return { departureAirport, arrivalAirport };
}

async function syncTransportTasksForSegment(
  tx: Prisma.TransactionClient,
  input: {
    itineraryId: string;
    segmentId: string;
    departureAirportId: string;
    arrivalAirportId: string;
    departureTimeLocal: string;
    arrivalTimeLocal: string;
    departureTimeUtc: Date;
    arrivalTimeUtc: Date;
    flightNumber: string;
  },
) {
  const [arrivalMapping, departureMapping, existingTasks] = await Promise.all([
    tx.airportMandirMapping.findFirst({
      where: { airportId: input.arrivalAirportId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    tx.airportMandirMapping.findFirst({
      where: { airportId: input.departureAirportId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    tx.transportTask.findMany({
      where: { flightSegmentId: input.segmentId },
    }),
  ]);

  const existingByType = new Map(existingTasks.map((task) => [task.taskType, task]));

  if (arrivalMapping) {
    const pickupPayload = {
      itineraryId: input.itineraryId,
      flightSegmentId: input.segmentId,
      taskType: "PICKUP" as const,
      airportId: input.arrivalAirportId,
      mandirId: arrivalMapping.mandirId,
      scheduledTimeLocal: localDateTimeStringToDate(input.arrivalTimeLocal),
      scheduledTimeUtc: input.arrivalTimeUtc,
      notes: `Auto-generated pickup task for ${input.flightNumber}`,
      status: existingByType.get("PICKUP")?.status ?? "UNASSIGNED",
    };

    if (existingByType.get("PICKUP")) {
      await tx.transportTask.update({
        where: { id: existingByType.get("PICKUP")!.id },
        data: pickupPayload,
      });
    } else {
      await tx.transportTask.create({
        data: pickupPayload,
      });
    }
  } else if (existingByType.get("PICKUP")) {
    await tx.transportTask.update({
      where: { id: existingByType.get("PICKUP")!.id },
      data: {
        status: "CANCELLED",
        notes: `Cancelled because ${input.arrivalAirportId} is not mapped for transport.`,
      },
    });
  }

  if (departureMapping) {
    const dropoffPayload = {
      itineraryId: input.itineraryId,
      flightSegmentId: input.segmentId,
      taskType: "DROPOFF" as const,
      airportId: input.departureAirportId,
      mandirId: departureMapping.mandirId,
      scheduledTimeLocal: localDateTimeStringToDate(input.departureTimeLocal),
      scheduledTimeUtc: input.departureTimeUtc,
      notes: `Auto-generated dropoff task for ${input.flightNumber}`,
      status: existingByType.get("DROPOFF")?.status ?? "UNASSIGNED",
    };

    if (existingByType.get("DROPOFF")) {
      await tx.transportTask.update({
        where: { id: existingByType.get("DROPOFF")!.id },
        data: dropoffPayload,
      });
    } else {
      await tx.transportTask.create({
        data: dropoffPayload,
      });
    }
  } else if (existingByType.get("DROPOFF")) {
    await tx.transportTask.update({
      where: { id: existingByType.get("DROPOFF")!.id },
      data: {
        status: "CANCELLED",
        notes: `Cancelled because ${input.departureAirportId} is not mapped for transport.`,
      },
    });
  }
}

async function createFlightSegmentRecord(tx: Prisma.TransactionClient, input: FlightSegmentInput) {
  const { departureAirport, arrivalAirport } = await resolveSegmentAirports(tx, input);
  const departureTimeUtc = zonedLocalDateTimeToUtc(input.departureTimeLocal, departureAirport.timeZone);
  const arrivalTimeUtc = zonedLocalDateTimeToUtc(input.arrivalTimeLocal, arrivalAirport.timeZone);

  const segment = await tx.flightSegment.create({
    data: {
      itineraryId: input.itineraryId,
      segmentOrder: input.segmentOrder,
      airline: input.airline,
      flightNumber: input.flightNumber.toUpperCase(),
      departureAirportId: input.departureAirportId,
      arrivalAirportId: input.arrivalAirportId,
      departureTimeZone: departureAirport.timeZone,
      arrivalTimeZone: arrivalAirport.timeZone,
      departureTimeLocal: localDateTimeStringToDate(input.departureTimeLocal),
      arrivalTimeLocal: localDateTimeStringToDate(input.arrivalTimeLocal),
      departureTimeUtc,
      arrivalTimeUtc,
    },
    include: {
      departureAirport: true,
      arrivalAirport: true,
    },
  });

  await syncTransportTasksForSegment(tx, {
    itineraryId: input.itineraryId,
    segmentId: segment.id,
    departureAirportId: input.departureAirportId,
    arrivalAirportId: input.arrivalAirportId,
    departureTimeLocal: input.departureTimeLocal,
    arrivalTimeLocal: input.arrivalTimeLocal,
    departureTimeUtc,
    arrivalTimeUtc,
    flightNumber: segment.flightNumber,
  });

  return segment;
}

async function updateFlightSegmentRecord(
  tx: Prisma.TransactionClient,
  segmentId: string,
  input: Prisma.InputJsonObject,
) {
  const current = await tx.flightSegment.findUnique({
    where: { id: segmentId },
  });

  if (!current) {
    throw new Error("Flight segment not found.");
  }

  const nextDepartureAirportId = typeof input.departureAirportId === "string" ? input.departureAirportId : current.departureAirportId;
  const nextArrivalAirportId = typeof input.arrivalAirportId === "string" ? input.arrivalAirportId : current.arrivalAirportId;
  const nextDepartureTimeLocal =
    typeof input.departureTimeLocal === "string" ? input.departureTimeLocal : current.departureTimeLocal.toISOString().slice(0, 19);
  const nextArrivalTimeLocal =
    typeof input.arrivalTimeLocal === "string" ? input.arrivalTimeLocal : current.arrivalTimeLocal.toISOString().slice(0, 19);

  const { departureAirport, arrivalAirport } = await resolveSegmentAirports(tx, {
    itineraryId: current.itineraryId,
    segmentOrder: current.segmentOrder,
    airline: current.airline,
    flightNumber: current.flightNumber,
    departureAirportId: nextDepartureAirportId,
    arrivalAirportId: nextArrivalAirportId,
    departureTimeLocal: nextDepartureTimeLocal,
    arrivalTimeLocal: nextArrivalTimeLocal,
  });

  const updated = await tx.flightSegment.update({
    where: { id: segmentId },
    data: {
      airline: typeof input.airline === "string" ? input.airline : current.airline,
      flightNumber: typeof input.flightNumber === "string" ? input.flightNumber.toUpperCase() : current.flightNumber,
      departureAirportId: nextDepartureAirportId,
      arrivalAirportId: nextArrivalAirportId,
      departureTimeZone: departureAirport.timeZone,
      arrivalTimeZone: arrivalAirport.timeZone,
      departureTimeLocal: localDateTimeStringToDate(nextDepartureTimeLocal),
      arrivalTimeLocal: localDateTimeStringToDate(nextArrivalTimeLocal),
      departureTimeUtc: zonedLocalDateTimeToUtc(nextDepartureTimeLocal, departureAirport.timeZone),
      arrivalTimeUtc: zonedLocalDateTimeToUtc(nextArrivalTimeLocal, arrivalAirport.timeZone),
    },
  });

  await syncTransportTasksForSegment(tx, {
    itineraryId: updated.itineraryId,
    segmentId: updated.id,
    departureAirportId: updated.departureAirportId,
    arrivalAirportId: updated.arrivalAirportId,
    departureTimeLocal: nextDepartureTimeLocal,
    arrivalTimeLocal: nextArrivalTimeLocal,
    departureTimeUtc: updated.departureTimeUtc,
    arrivalTimeUtc: updated.arrivalTimeUtc,
    flightNumber: updated.flightNumber,
  });

  return updated;
}

async function createItineraryFromSubmission(
  tx: Prisma.TransactionClient,
  input: { submissionId: string; normalizedPayload: PublicSubmissionPayload; reviewedByUserId: string; notes?: string | null },
) {
  const passengers = input.normalizedPayload.passengers ?? [];
  const segments = input.normalizedPayload.segments ?? [];

  if (passengers.length === 0 || segments.length === 0) {
    throw new Error("Submission is missing passenger or flight segment data.");
  }

  const airportCodes = Array.from(
    new Set(segments.flatMap((segment) => [segment.departureAirport.toUpperCase(), segment.arrivalAirport.toUpperCase()])),
  );

  const airports = await tx.airport.findMany({
    where: { code: { in: airportCodes } },
  });

  const airportByCode = new Map(airports.map((airport) => [airport.code, airport]));

  for (const code of airportCodes) {
    if (!airportByCode.has(code)) {
      throw new Error(`Airport ${code} is not configured.`);
    }
  }

  const createdPassengers = await Promise.all(
    passengers.map((passenger) =>
      tx.passenger.create({
        data: {
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          phone: passenger.phone ?? null,
          passengerType: passenger.passengerType ?? "GUEST_SANTO",
        },
      }),
    ),
  );

  const itinerary = await tx.itinerary.create({
    data: {
      sourceSubmissionId: input.submissionId,
      createdByUserId: input.reviewedByUserId,
      notes: input.notes ?? null,
      status: "CREATED",
      itineraryPassengers: {
        create: createdPassengers.map((passenger) => ({
          passengerId: passenger.id,
        })),
      },
    },
  });

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    await createFlightSegmentRecord(tx, {
      itineraryId: itinerary.id,
      segmentOrder: segment.segmentOrder ?? index + 1,
      airline: segment.airline,
      flightNumber: segment.flightNumber,
      departureAirportId: airportByCode.get(segment.departureAirport.toUpperCase())!.id,
      arrivalAirportId: airportByCode.get(segment.arrivalAirport.toUpperCase())!.id,
      departureTimeLocal: segment.departureTimeLocal,
      arrivalTimeLocal: segment.arrivalTimeLocal,
    });
  }

  return itinerary;
}

export async function getDashboardSnapshot(input?: {
  role?: string | null;
  airportIds?: string[] | null;
  passengerId?: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const safeRole = toSummaryRole(input?.role);
  const where = buildItineraryWhere({
    airportIds: input?.airportIds ?? undefined,
    passengerId: input?.passengerId ?? undefined,
  });

  const [todayArrivals, pendingApprovals, unassignedTasks, activeDrivers, itineraries, approvals, transportTasks] =
    await Promise.all([
      prisma.flightSegment.count({
        where: {
          arrivalTimeLocal: {
            gte: new Date(`${today}T00:00:00`),
            lt: new Date(`${today}T23:59:59`),
          },
        },
      }),
      prisma.approvalRequest.count({ where: { status: ApprovalStatus.PENDING } }),
      prisma.transportTask.count({ where: { status: "UNASSIGNED" } }),
      prisma.driver.count({ where: { transportTaskDrivers: { some: {} } } }),
      prisma.itinerary.findMany({
        where,
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          itineraryPassengers: { include: { passenger: true } },
          flightSegments: { orderBy: { segmentOrder: "asc" }, include: { departureAirport: true, arrivalAirport: true } },
        },
      }),
      prisma.approvalRequest.findMany({
        take: 5,
        orderBy: { requestedAt: "desc" },
        include: { requestedByUser: true, itinerary: true },
      }),
      prisma.transportTask.findMany({
        where: input?.airportIds?.length
          ? {
              airportId: {
                in: input.airportIds,
              },
              itinerary: { isArchived: false },
            }
          : {
              itinerary: { isArchived: false },
            },
        take: 5,
        orderBy: { scheduledTimeLocal: "asc" },
        include: {
          airport: true,
          mandir: true,
          itinerary: { include: { itineraryPassengers: { include: { passenger: true } } } },
          flightSegment: true,
          drivers: { include: { driver: true } },
        },
      }),
    ]);

  return {
    role: safeRole,
    metrics: summarizeDashboard({ todayArrivals, pendingApprovals, unassignedTasks, activeDrivers }),
    itineraries: itineraries.map((itinerary) => ({
      id: itinerary.id,
      status: itinerary.status,
      notes: itinerary.notes,
      passengers: formatPassengerNames(itinerary.itineraryPassengers.map((item) => item.passenger)),
      primaryRoute: itinerary.flightSegments[0]
        ? `${itinerary.flightSegments[0].departureAirport.code} -> ${itinerary.flightSegments[0].arrivalAirport.code}`
        : "No segments",
    })),
    approvals: approvals.map((approval) => ({
      id: approval.id,
      status: approval.status,
      entityType: approval.entityType,
      requestedBy: `${approval.requestedByUser.firstName} ${approval.requestedByUser.lastName}`,
      itineraryId: approval.itineraryId,
    })),
    transportTasks: transportTasks.map((task) => ({
      id: task.id,
      type: task.taskType,
      status: task.status,
      airport: task.airport.code,
      mandir: task.mandir?.name ?? "Unassigned",
      passengers: formatPassengerNames(task.itinerary.itineraryPassengers.map((item) => item.passenger)),
      drivers: task.drivers.map((driver) => driver.driver.name).join(", ") || "Unassigned",
    })),
  };
}

export async function listPassengers(search?: string, options?: { includeInactive?: boolean }) {
  return prisma.passenger.findMany({
    where: {
      ...(options?.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { legalName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    },
    include: {
      itineraryPassengers: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getPassenger(id: string) {
  return prisma.passenger.findUnique({
    where: { id },
    include: {
      itineraryPassengers: true,
    },
  });
}

export async function updatePassenger(
  id: string,
  input: {
    firstName?: string;
    lastName?: string;
    legalName?: string | null;
    email?: string | null;
    phone?: string | null;
    passengerType?: Prisma.PassengerUpdateInput["passengerType"];
    isActive?: boolean;
    notes?: string | null;
  },
) {
  return prisma.passenger.update({
    where: { id },
    data: {
      ...input,
      phone: input.phone === undefined ? undefined : normalizeOptionalPhone(input.phone),
    },
  });
}

export async function disablePassenger(id: string) {
  return prisma.passenger.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function listUsers(search?: string, options?: { includeInactive?: boolean }) {
  return prisma.user.findMany({
    where: {
      ...(options?.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    },
    include: {
      adminAirports: { include: { airport: true } },
      coordinatorAirports: { include: { airport: true } },
      passengerUserLinks: { include: { passenger: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function createUser(input: {
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  airportIds?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        phone: normalizeOptionalPhone(input.phone),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        accessProvisionedAt: new Date(),
      },
    });

    await syncPassengerUserLink(tx, {
      userId: user.id,
      email: input.email,
      phone: input.phone ?? null,
    });

    if ((input.airportIds?.length ?? 0) > 0) {
      if (input.role === UserRole.ADMIN) {
        await tx.adminAirport.createMany({
          data: input.airportIds!.map((airportId) => ({ userId: user.id, airportId })),
        });
      } else if (input.role === UserRole.COORDINATOR) {
        await tx.coordinatorAirport.createMany({
          data: input.airportIds!.map((airportId) => ({ userId: user.id, airportId })),
        });
      }
    }

    return tx.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        adminAirports: { include: { airport: true } },
        coordinatorAirports: { include: { airport: true } },
        passengerUserLinks: { include: { passenger: true } },
      },
    });
  });
}

export async function updateUser(
  id: string,
  input: {
    email?: string;
    phone?: string | null;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    isActive?: boolean;
    airportIds?: string[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({
      where: { id },
      select: { role: true },
    });

    const nextRole = input.role ?? current.role;

    const updated = await tx.user.update({
      where: { id },
      data: {
        email: input.email?.toLowerCase(),
        phone: input.phone === undefined ? undefined : normalizeOptionalPhone(input.phone),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        isActive: input.isActive,
      },
    });

    await syncPassengerUserLink(tx, {
      userId: updated.id,
      email: updated.email,
      phone: updated.phone,
    });

    if (input.airportIds) {
      await tx.adminAirport.deleteMany({ where: { userId: id } });
      await tx.coordinatorAirport.deleteMany({ where: { userId: id } });

      if (input.airportIds.length > 0) {
        if (nextRole === UserRole.ADMIN) {
          await tx.adminAirport.createMany({
            data: input.airportIds.map((airportId) => ({ userId: id, airportId })),
          });
        } else if (nextRole === UserRole.COORDINATOR) {
          await tx.coordinatorAirport.createMany({
            data: input.airportIds.map((airportId) => ({ userId: id, airportId })),
          });
        }
      }
    }

    return tx.user.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        adminAirports: { include: { airport: true } },
        coordinatorAirports: { include: { airport: true } },
        passengerUserLinks: { include: { passenger: true } },
      },
    });
  });
}

export async function findAuthorizedUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      adminAirports: { include: { airport: true } },
      coordinatorAirports: { include: { airport: true } },
      passengerUserLinks: { include: { passenger: true } },
    },
  });
}

export async function findAuthorizedUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      adminAirports: { include: { airport: true } },
      coordinatorAirports: { include: { airport: true } },
      passengerUserLinks: { include: { passenger: true } },
    },
  });
}

export async function syncUserIdentityOnLogin(input: {
  email: string;
  provider?: string | null;
  subject?: string | null;
  displayName?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      return null;
    }

    const parsedName = parseDisplayName(input.displayName);
    const hasFirstName = user.firstName.trim().length > 0;
    const hasLastName = user.lastName.trim().length > 0;

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        firstName: hasFirstName ? user.firstName : (parsedName.firstName ?? user.firstName),
        lastName: hasLastName ? user.lastName : (parsedName.lastName ?? user.lastName),
        identityProvider: input.provider ?? user.identityProvider ?? "better-auth",
        identitySubject: input.subject ?? user.identitySubject,
        identityLinkedAt: user.identityLinkedAt ?? new Date(),
      },
      include: {
        adminAirports: { include: { airport: true } },
        coordinatorAirports: { include: { airport: true } },
        passengerUserLinks: { include: { passenger: true } },
      },
    });

    await syncPassengerUserLink(tx, {
      userId: updated.id,
      email: updated.email,
      phone: updated.phone,
    });

    return updated;
  });
}

export async function createPassenger(input: {
  firstName: string;
  lastName: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  passengerType: Prisma.PassengerCreateInput["passengerType"];
  notes?: string | null;
}) {
  return prisma.passenger.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      legalName: input.legalName ?? null,
      email: input.email ?? null,
      phone: normalizeOptionalPhone(input.phone),
      passengerType: input.passengerType,
      notes: input.notes ?? null,
    },
  });
}

export async function listPassengerOptions(search?: string) {
  const passengers = await listPassengers(search);

  return passengers.map((passenger) => ({
    id: passenger.id,
    label: `${passenger.firstName} ${passenger.lastName}`,
    detail: passenger.phone ?? passenger.email ?? passenger.legalName ?? passenger.passengerType,
  }));
}

export async function createApprovalRequest(input: {
  itineraryId: string;
  requestedByUserId: string;
  entityType: string;
  entityId?: string | null;
  originalPayload?: Prisma.InputJsonValue;
  proposedPayload: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.create({
      data: {
        itineraryId: input.itineraryId,
        requestedByUserId: input.requestedByUserId,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        originalPayload: input.originalPayload,
        proposedPayload: input.proposedPayload,
      },
    });

    await tx.itinerary.update({
      where: { id: input.itineraryId },
      data: { status: "PENDING_APPROVAL" },
    });

    await createAuditLog(tx, {
      action: "APPROVAL_REQUEST_CREATED",
      entityType: "ApprovalRequest",
      entityId: approval.id,
      actorUserId: input.requestedByUserId,
      newValues: {
        itineraryId: input.itineraryId,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
      },
    });

    return approval;
  });
}

type ItineraryQueryOptions = {
  includeArchived?: boolean;
  passengerId?: string | null;
  airportIds?: string[] | null;
  limit?: number;
};

function buildItineraryWhere(options?: ItineraryQueryOptions): Prisma.ItineraryWhereInput {
  const where: Prisma.ItineraryWhereInput = {};

  if (!options?.includeArchived) {
    where.isArchived = false;
  }

  if (options?.passengerId) {
    where.itineraryPassengers = {
      some: {
        passengerId: options.passengerId,
      },
    };
  }

  if (options?.airportIds && options.airportIds.length > 0) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          {
            flightSegments: {
              some: {
                departureAirportId: {
                  in: options.airportIds,
                },
              },
            },
          },
          {
            flightSegments: {
              some: {
                arrivalAirportId: {
                  in: options.airportIds,
                },
              },
            },
          },
          {
            transportTasks: {
              some: {
                airportId: {
                  in: options.airportIds,
                },
              },
            },
          },
        ],
      },
    ];
  }

  return where;
}

export async function listItineraries(options?: ItineraryQueryOptions) {
  return prisma.itinerary.findMany({
    where: buildItineraryWhere(options),
    take: options?.limit,
    orderBy: { updatedAt: "desc" },
    include: {
      itineraryPassengers: { include: { passenger: true } },
      flightSegments: { orderBy: { segmentOrder: "asc" }, include: { departureAirport: true, arrivalAirport: true } },
      transportTasks: { include: { airport: true, mandir: true, drivers: { include: { driver: true } } } },
      booking: true,
      accommodations: { include: { mandir: true } },
      approvalRequests: { orderBy: { requestedAt: "desc" } },
      externalSyncLinks: true,
    },
  });
}

export async function listPassengerItineraries(
  userId: string,
  options?: Omit<ItineraryQueryOptions, "passengerId">,
) {
  const link = await prisma.passengerUserLink.findFirst({
    where: { userId },
    select: { passengerId: true },
  });

  if (!link) {
    return [];
  }

  return listItineraries({
    ...options,
    passengerId: link.passengerId,
  });
}

export async function getItineraryDetail(id: string) {
  return prisma.itinerary.findUnique({
    where: { id },
    include: {
      itineraryPassengers: { include: { passenger: true } },
      flightSegments: { orderBy: { segmentOrder: "asc" }, include: { departureAirport: true, arrivalAirport: true } },
      accommodations: { include: { mandir: true } },
      transportTasks: { include: { airport: true, mandir: true, drivers: { include: { driver: true } } } },
      booking: { include: { allocations: { include: { passenger: true } } } },
      approvalRequests: { include: { requestedByUser: true, reviewedByUser: true }, orderBy: { requestedAt: "desc" } },
      externalSyncLinks: true,
    },
  });
}

export async function createItinerary(input: {
  notes?: string | null;
  passengerIds: string[];
  travelerRefs?: TravelerRefInput[];
  createdByUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const resolvedTravelers = await resolveTravelerRefsToPassengerIds(tx, {
      passengerIds: input.passengerIds,
      travelerRefs: input.travelerRefs,
      actorUserId: input.createdByUserId ?? null,
    });

    const itinerary = await tx.itinerary.create({
      data: {
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
        itineraryPassengers: {
          create: resolvedTravelers.passengerIds.map((passengerId) => ({
            passengerId,
          })),
        },
      },
      include: {
        itineraryPassengers: { include: { passenger: true } },
      },
    });

    await createAuditLog(tx, {
      action: "ITINERARY_CREATED",
      entityType: "Itinerary",
      entityId: itinerary.id,
      actorUserId: input.createdByUserId ?? null,
      newValues: {
        passengerIds: resolvedTravelers.passengerIds,
        travelerRefsResolved: resolvedTravelers.resolutionSummary,
        notes: input.notes ?? null,
      },
    });

    return itinerary;
  });
}

async function findTripDetailOrThrow(tx: Prisma.TransactionClient, id: string) {
  return tx.itinerary.findUniqueOrThrow({
    where: { id },
    include: {
      itineraryPassengers: { include: { passenger: true } },
      flightSegments: { orderBy: { segmentOrder: "asc" }, include: { departureAirport: true, arrivalAirport: true } },
      accommodations: { include: { mandir: true } },
      booking: true,
      transportTasks: { include: { airport: true, mandir: true, drivers: { include: { driver: true } } } },
      approvalRequests: { orderBy: { requestedAt: "desc" } },
      externalSyncLinks: true,
    },
  });
}

async function createTransportEntriesForSegment(
  tx: Prisma.TransactionClient,
  input: {
    itineraryId: string;
    segment: Awaited<ReturnType<typeof createFlightSegmentRecord>>;
    entries: TripTransportEntryInput[];
    createdByUserId?: string | null;
    departureTimeLocal: string;
    arrivalTimeLocal: string;
  },
) {
  if (input.entries.length === 0) {
    return;
  }

  const mappings = await tx.airportMandirMapping.findMany({
    where: {
      airportId: {
        in: [input.segment.departureAirportId, input.segment.arrivalAirportId],
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const defaultMappingByAirport = new Map<string, (typeof mappings)[number]>();
  for (const mapping of mappings) {
    if (!defaultMappingByAirport.has(mapping.airportId)) {
      defaultMappingByAirport.set(mapping.airportId, mapping);
    }
  }

  for (const entry of input.entries) {
    const isPickup = entry.taskType === "PICKUP";
    const airport = isPickup ? input.segment.arrivalAirport : input.segment.departureAirport;
    const airportId = isPickup ? input.segment.arrivalAirportId : input.segment.departureAirportId;
    const scheduledTimeLocal =
      entry.scheduledTimeLocal ??
      (isPickup ? input.arrivalTimeLocal : input.departureTimeLocal);
    const transportTask = await tx.transportTask.create({
      data: {
        itineraryId: input.itineraryId,
        flightSegmentId: input.segment.id,
        taskType: entry.taskType,
        airportId,
        mandirId: defaultMappingByAirport.get(airportId)?.mandirId ?? null,
        scheduledTimeLocal: localDateTimeStringToDate(scheduledTimeLocal),
        scheduledTimeUtc: zonedLocalDateTimeToUtc(scheduledTimeLocal, airport.timeZone),
        status: (entry.driverIds?.length ?? 0) > 0 ? TransportTaskStatus.ASSIGNED : TransportTaskStatus.UNASSIGNED,
        notes: entry.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
    });

    if ((entry.driverIds?.length ?? 0) > 0) {
      await tx.transportTaskDriver.createMany({
        data: Array.from(new Set(entry.driverIds)).map((driverId) => ({
          transportTaskId: transportTask.id,
          driverId,
          assignedByUserId: input.createdByUserId ?? null,
        })),
      });
    }
  }
}

async function syncTripRelations(tx: Prisma.TransactionClient, itineraryId: string, input: TripInput) {
  await tx.itineraryPassenger.deleteMany({ where: { itineraryId } });
  await tx.itineraryPassenger.createMany({
    data: input.passengerIds.map((passengerId) => ({
      itineraryId,
      passengerId,
    })),
  });

  const hasBooking = Boolean(
    input.booking &&
      ((input.booking.confirmationNumber ?? "").trim() ||
        input.booking.totalCost === 0 ||
        (input.booking.totalCost !== null && input.booking.totalCost !== undefined)),
  );

  if (hasBooking && input.booking) {
    await tx.booking.upsert({
      where: { itineraryId },
      update: {
        confirmationNumber: input.booking.confirmationNumber ?? null,
        totalCost:
          input.booking.totalCost === null || input.booking.totalCost === undefined
            ? null
            : new Prisma.Decimal(input.booking.totalCost),
        notes: null,
      },
      create: {
        itineraryId,
        confirmationNumber: input.booking.confirmationNumber ?? null,
        totalCost:
          input.booking.totalCost === null || input.booking.totalCost === undefined
            ? null
            : new Prisma.Decimal(input.booking.totalCost),
        notes: null,
      },
    });
  } else {
    await tx.booking.deleteMany({ where: { itineraryId } });
  }

  const accommodationNotes = input.accommodation?.notes?.trim() ?? "";
  if (accommodationNotes) {
    const existingAccommodation = await tx.accommodation.findFirst({
      where: { itineraryId },
      select: { id: true },
    });

    if (existingAccommodation) {
      await tx.accommodation.update({
        where: { id: existingAccommodation.id },
        data: {
          mandirId: null,
          room: null,
          checkInDate: null,
          checkOutDate: null,
          notes: accommodationNotes,
        },
      });
      await tx.accommodation.deleteMany({
        where: {
          itineraryId,
          id: { not: existingAccommodation.id },
        },
      });
    } else {
      await tx.accommodation.create({
        data: {
          itineraryId,
          mandirId: null,
          room: null,
          checkInDate: null,
          checkOutDate: null,
          notes: accommodationNotes,
        },
      });
    }
  } else {
    await tx.accommodation.deleteMany({ where: { itineraryId } });
  }

  await tx.transportTaskDriver.deleteMany({
    where: { transportTask: { itineraryId } },
  });
  await tx.transportTask.deleteMany({ where: { itineraryId } });
  await tx.flightSegment.deleteMany({ where: { itineraryId } });

  for (const segment of input.segments) {
    const createdSegment = await createFlightSegmentRecord(tx, {
      itineraryId,
      segmentOrder: segment.segmentOrder,
      airline: segment.airline,
      flightNumber: segment.flightNumber,
      departureAirportId: segment.departureAirportId,
      arrivalAirportId: segment.arrivalAirportId,
      departureTimeLocal: segment.departureTimeLocal,
      arrivalTimeLocal: segment.arrivalTimeLocal,
    });

    await tx.transportTask.deleteMany({ where: { flightSegmentId: createdSegment.id } });
    await createTransportEntriesForSegment(tx, {
      itineraryId,
      segment: createdSegment,
      entries: segment.transportEntries ?? [],
      createdByUserId: input.createdByUserId ?? null,
      departureTimeLocal: segment.departureTimeLocal,
      arrivalTimeLocal: segment.arrivalTimeLocal,
    });
  }
}

export async function createTrip(input: TripInput) {
  return prisma.$transaction(async (tx) => {
    const resolvedTravelers = await resolveTravelerRefsToPassengerIds(tx, {
      passengerIds: input.passengerIds,
      travelerRefs: input.travelerRefs,
      actorUserId: input.createdByUserId ?? null,
    });

    const itinerary = await tx.itinerary.create({
      data: {
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
        itineraryPassengers: {
          create: resolvedTravelers.passengerIds.map((passengerId) => ({
            passengerId,
          })),
        },
      },
    });

    await syncTripRelations(tx, itinerary.id, {
      ...input,
      passengerIds: resolvedTravelers.passengerIds,
    });

    await createAuditLog(tx, {
      action: "TRIP_CREATED",
      entityType: "Itinerary",
      entityId: itinerary.id,
      actorUserId: input.createdByUserId ?? null,
      newValues: {
        notes: input.notes ?? null,
        passengerIds: resolvedTravelers.passengerIds,
        travelerRefsResolved: resolvedTravelers.resolutionSummary,
        segmentCount: input.segments.length,
        booking: input.booking ?? null,
        accommodation: input.accommodation ?? null,
        transportEntries: input.segments.map((segment) => segment.transportEntries?.length ?? 0),
      },
    });

    const created = await findTripDetailOrThrow(tx, itinerary.id);
    await queueFlightChangeNotifications(tx, {
      itinerary: created,
      changeLabel: "Flight added",
    });

    return created;
  });
}

export async function updateItinerary(
  id: string,
  input: {
    notes?: string | null;
    status?: Prisma.ItineraryUpdateInput["status"];
    isArchived?: boolean;
    actorUserId?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.itinerary.findUnique({
      where: { id },
      select: { notes: true, status: true, isArchived: true },
    });

    const updated = await tx.itinerary.update({
      where: { id },
      data: {
        notes: input.notes,
        status: input.status,
        isArchived: input.isArchived,
      },
    });

    await createAuditLog(tx, {
      action: "ITINERARY_UPDATED",
      entityType: "Itinerary",
      entityId: id,
      actorUserId: input.actorUserId ?? null,
      oldValues: current ?? undefined,
      newValues: {
        notes: updated.notes,
        status: updated.status,
        isArchived: updated.isArchived,
      },
    });

    if (!current?.isArchived && updated.isArchived) {
      await createAuditLog(tx, {
        action: updated.status === "CANCELLED" ? "ITINERARY_CANCELLED_AND_ARCHIVED" : "ITINERARY_ARCHIVED",
        entityType: "Itinerary",
        entityId: id,
        actorUserId: input.actorUserId ?? null,
        oldValues: { isArchived: current?.isArchived ?? false, status: current?.status ?? null },
        newValues: { isArchived: true, status: updated.status },
      });
    }

    if (current?.isArchived && !updated.isArchived) {
      await createAuditLog(tx, {
        action: "ITINERARY_UNARCHIVED",
        entityType: "Itinerary",
        entityId: id,
        actorUserId: input.actorUserId ?? null,
        oldValues: { isArchived: true, status: current.status },
        newValues: { isArchived: false, status: updated.status },
      });
    }

    if (updated.status === "CANCELLED" && updated.isArchived) {
      const detail = await findTripDetailOrThrow(tx, id);
      await queueFlightChangeNotifications(tx, {
        itinerary: detail,
        changeLabel: "Flight cancelled and archived",
      });
    }

    return updated;
  });
}

export async function deleteItinerary(id: string, actorUserId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const current = await findTripDetailOrThrow(tx, id);

    await queueFlightChangeNotifications(tx, {
      itinerary: current,
      changeLabel: "Flight deleted",
    });

    await createAuditLog(tx, {
      action: "ITINERARY_HARD_DELETED",
      entityType: "Itinerary",
      entityId: id,
      actorUserId: actorUserId ?? null,
      oldValues: {
        status: current.status,
        isArchived: current.isArchived,
        passengerIds: current.itineraryPassengers.map((item) => item.passenger.id),
        segmentCount: current.flightSegments.length,
      },
    });

    await tx.itinerary.delete({
      where: { id },
    });

    return { deleted: true, id };
  });
}

export async function updateTrip(id: string, input: TripInput & { status?: Prisma.ItineraryUpdateInput["status"] }) {
  return prisma.$transaction(async (tx) => {
    const current = await findTripDetailOrThrow(tx, id);
    const resolvedTravelers = await resolveTravelerRefsToPassengerIds(tx, {
      passengerIds: input.passengerIds,
      travelerRefs: input.travelerRefs,
      actorUserId: input.createdByUserId ?? null,
    });

    await tx.itinerary.update({
      where: { id },
      data: {
        notes: input.notes ?? null,
        status: input.status,
      },
    });

    await syncTripRelations(tx, id, {
      ...input,
      passengerIds: resolvedTravelers.passengerIds,
    });

    const updated = await findTripDetailOrThrow(tx, id);

    await createAuditLog(tx, {
      action: "TRIP_UPDATED",
      entityType: "Itinerary",
      entityId: id,
      actorUserId: input.createdByUserId ?? null,
      oldValues: {
        notes: current.notes,
        passengerIds: current.itineraryPassengers.map((item) => item.passenger.id),
        segmentCount: current.flightSegments.length,
      },
      newValues: {
        notes: updated.notes,
        passengerIds: updated.itineraryPassengers.map((item) => item.passenger.id),
        travelerRefsResolved: resolvedTravelers.resolutionSummary,
        segmentCount: updated.flightSegments.length,
      },
    });

    await queueFlightChangeNotifications(tx, {
      itinerary: updated,
      changeLabel: "Flight changed",
    });

    return updated;
  });
}

export async function addFlightSegment(input: FlightSegmentInput) {
  return prisma.$transaction(async (tx) => {
    const segment = await createFlightSegmentRecord(tx, input);

    await createAuditLog(tx, {
      action: "FLIGHT_SEGMENT_CREATED",
      entityType: "FlightSegment",
      entityId: segment.id,
      newValues: {
        itineraryId: input.itineraryId,
        flightNumber: segment.flightNumber,
        departureAirportId: input.departureAirportId,
        arrivalAirportId: input.arrivalAirportId,
      },
    });

    return segment;
  });
}

export async function listAirports() {
  return prisma.airport.findMany({
    orderBy: { code: "asc" },
  });
}

export async function listMandirs() {
  return prisma.mandir.findMany({
    orderBy: { name: "asc" },
  });
}

export async function listAirportOptions(search?: string) {
  const airports = await prisma.airport.findMany({
    where: search
      ? {
          OR: [
            { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { city: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined,
    orderBy: { code: "asc" },
    take: 20,
  });

  return airports.map((airport) => ({
    id: airport.id,
    label: airport.code,
    detail: [airport.name, airport.city].filter(Boolean).join(" · "),
  }));
}

export async function listTransportTasks() {
  return prisma.transportTask.findMany({
    orderBy: [{ status: "asc" }, { scheduledTimeLocal: "asc" }],
    include: {
      airport: true,
      mandir: true,
      itinerary: { include: { itineraryPassengers: { include: { passenger: true } } } },
      flightSegment: {
        include: {
          departureAirport: true,
          arrivalAirport: true,
        },
      },
      drivers: { include: { driver: true } },
    },
  });
}

export async function listDriverTransportTasksByChatId(chatId: string) {
  const driver = await prisma.driver.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true, name: true },
  });

  if (!driver) {
    return null;
  }

  const tasks = await prisma.transportTask.findMany({
    where: {
      drivers: {
        some: {
          driverId: driver.id,
        },
      },
    },
    orderBy: [{ status: "asc" }, { scheduledTimeLocal: "asc" }],
    include: {
      airport: true,
      mandir: true,
      itinerary: { include: { itineraryPassengers: { include: { passenger: true } } } },
      flightSegment: {
        include: {
          departureAirport: true,
          arrivalAirport: true,
        },
      },
      drivers: { include: { driver: true } },
    },
  });

  return {
    driver,
    tasks,
  };
}

export async function listDrivers(options?: { includeInactive?: boolean }) {
  return prisma.driver.findMany({
    where: options?.includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: {
      driverAirports: {
        include: { airport: true },
      },
    },
  });
}

export async function createDriver(input: {
  name: string;
  phone?: string | null;
  notes?: string | null;
  airportIds?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const driver = await tx.driver.create({
      data: {
        name: input.name,
        phone: normalizeOptionalPhone(input.phone),
        notes: input.notes ?? null,
      },
    });

    if ((input.airportIds?.length ?? 0) > 0) {
      await tx.driverAirport.createMany({
        data: input.airportIds!.map((airportId) => ({ driverId: driver.id, airportId })),
      });
    }

    return tx.driver.findUniqueOrThrow({
      where: { id: driver.id },
      include: {
        driverAirports: { include: { airport: true } },
      },
    });
  });
}

export async function updateDriver(
  id: string,
  input: {
    name?: string;
    phone?: string | null;
    notes?: string | null;
    isActive?: boolean;
    airportIds?: string[];
  },
) {
  return prisma.$transaction(async (tx) => {
    await tx.driver.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone === undefined ? undefined : normalizeOptionalPhone(input.phone),
        isActive: input.isActive,
        notes: input.notes,
      },
    });

    if (input.airportIds) {
      await tx.driverAirport.deleteMany({ where: { driverId: id } });
      if (input.airportIds.length > 0) {
        await tx.driverAirport.createMany({
          data: input.airportIds.map((airportId) => ({ driverId: id, airportId })),
        });
      }
    }

    return tx.driver.findUniqueOrThrow({
      where: { id },
      include: {
        driverAirports: { include: { airport: true } },
      },
    });
  });
}

export async function disableDriver(id: string) {
  return prisma.driver.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function assignDriversToTransportTask(input: {
  taskId: string;
  driverIds: string[];
  assignedByUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const currentTask = await tx.transportTask.findUnique({
      where: { id: input.taskId },
      include: {
        airport: true,
        mandir: true,
        itinerary: {
          include: {
            itineraryPassengers: {
              include: {
                passenger: {
                  include: {
                    userLinks: {
                      include: {
                        user: {
                          select: {
                            phone: true,
                          },
                        },
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        drivers: { include: { driver: true } },
      },
    });

    if (!currentTask) {
      throw new Error("Transport task not found.");
    }

    const existingAssignments = await tx.transportTaskDriver.findMany({
      where: { transportTaskId: input.taskId },
      select: { driverId: true },
    });

    await tx.transportTaskDriver.deleteMany({
      where: { transportTaskId: input.taskId },
    });

    await tx.transportTaskDriver.createMany({
      data: input.driverIds.map((driverId) => ({
        transportTaskId: input.taskId,
        driverId,
        assignedByUserId: input.assignedByUserId ?? null,
      })),
    });

    await tx.transportTask.update({
      where: { id: input.taskId },
      data: {
        status: input.driverIds.length > 0 ? "ASSIGNED" : "UNASSIGNED",
      },
    });

    await createAuditLog(tx, {
      action: "TRANSPORT_TASK_DRIVERS_ASSIGNED",
      entityType: "TransportTask",
      entityId: input.taskId,
      actorUserId: input.assignedByUserId ?? null,
      oldValues: { driverIds: existingAssignments.map((assignment) => assignment.driverId) },
      newValues: { driverIds: input.driverIds },
    });

    const updatedTask = await tx.transportTask.findUnique({
      where: { id: input.taskId },
      include: {
        airport: true,
        mandir: true,
        drivers: { include: { driver: true } },
      },
    });

    if (!updatedTask) {
      throw new Error("Transport task not found after assignment update.");
    }

    const changeLabel =
      existingAssignments.length === 0 && input.driverIds.length > 0
        ? `${updatedTask.taskType} assignment created`
        : existingAssignments.length > 0 && input.driverIds.length === 0
          ? `${updatedTask.taskType} assignment cancelled`
          : `${updatedTask.taskType} assignment changed`;

    await queueTransportChangeNotifications(tx, {
      task: updatedTask,
      passengers: currentTask.itinerary.itineraryPassengers.map((item) => ({
        id: item.passenger.id,
        firstName: item.passenger.firstName,
        lastName: item.passenger.lastName,
        phone: item.passenger.phone ?? item.passenger.userLinks[0]?.user.phone ?? null,
      })),
      changeLabel,
    });

    return updatedTask;
  });
}

export async function updateTransportTaskStatus(input: {
  taskId: string;
  status: TransportTaskStatus;
  note?: string | null;
  changedByUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.transportTask.findUnique({
      where: { id: input.taskId },
      select: { status: true },
    });

    if (!current) {
      throw new Error("Transport task not found.");
    }

    const updated = await tx.transportTask.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
      },
      include: {
        airport: true,
        mandir: true,
        drivers: { include: { driver: true } },
      },
    });

    await tx.transportTaskStatusHistory.create({
      data: {
        transportTaskId: input.taskId,
        oldStatus: current.status,
        newStatus: input.status,
        changedByUserId: input.changedByUserId ?? null,
        source: AuditSource.WEB,
        note: input.note ?? null,
      },
    });

    await createAuditLog(tx, {
      action: "TRANSPORT_TASK_STATUS_CHANGED",
      entityType: "TransportTask",
      entityId: input.taskId,
      actorUserId: input.changedByUserId ?? null,
      oldValues: { status: current.status },
      newValues: { status: input.status, note: input.note ?? null },
    });

    return updated;
  });
}

export async function driverRespondToTransportTask(input: {
  chatId: string;
  taskId: string;
  action: "ACCEPT" | "DECLINE" | "EN_ROUTE" | "PICKED_UP" | "DROPPED_OFF" | "COMPLETED";
}) {
  return prisma.$transaction(async (tx) => {
    const driver = await tx.driver.findUnique({
      where: { telegramChatId: input.chatId },
    });

    if (!driver) {
      throw new Error("Driver is not linked to this Telegram chat.");
    }

    const task = await tx.transportTask.findFirst({
      where: {
        id: input.taskId,
        drivers: {
          some: {
            driverId: driver.id,
          },
        },
      },
      include: {
        airport: true,
        mandir: true,
        flightSegment: {
          include: {
            departureAirport: true,
            arrivalAirport: true,
          },
        },
        itinerary: {
          include: {
            itineraryPassengers: {
              include: {
                passenger: true,
              },
            },
          },
        },
        drivers: {
          include: {
            driver: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error("Transport task not found for this driver.");
    }

    if (input.action === "DECLINE") {
      await tx.transportTaskDriver.deleteMany({
        where: {
          transportTaskId: input.taskId,
          driverId: driver.id,
        },
      });

      const remainingDriverCount = await tx.transportTaskDriver.count({
        where: { transportTaskId: input.taskId },
      });

      const nextStatus = remainingDriverCount > 0 ? task.status : TransportTaskStatus.UNASSIGNED;

      const updatedTask = await tx.transportTask.update({
        where: { id: input.taskId },
        data: { status: nextStatus },
        include: {
          airport: true,
          mandir: true,
          flightSegment: {
            include: {
              departureAirport: true,
              arrivalAirport: true,
            },
          },
          itinerary: {
            include: {
              itineraryPassengers: {
                include: {
                  passenger: true,
                },
              },
            },
          },
          drivers: { include: { driver: true } },
        },
      });

      await tx.transportTaskStatusHistory.create({
        data: {
          transportTaskId: input.taskId,
          oldStatus: task.status,
          newStatus: nextStatus,
          changedByDriverId: driver.id,
          source: AuditSource.BOT,
          note: "Driver declined assignment in Telegram.",
        },
      });

      await createAuditLog(tx, {
        action: "TRANSPORT_TASK_DRIVER_DECLINED",
        entityType: "TransportTask",
        entityId: input.taskId,
        source: AuditSource.BOT,
        newValues: { driverId: driver.id, status: nextStatus },
      });

      return {
        driver,
        task: updatedTask,
        message: remainingDriverCount > 0 ? "Assignment declined." : "Assignment declined. Task is now unassigned.",
      };
    }

    if (input.action === "ACCEPT") {
      await createAuditLog(tx, {
        action: "TRANSPORT_TASK_DRIVER_ACCEPTED",
        entityType: "TransportTask",
        entityId: input.taskId,
        source: AuditSource.BOT,
        newValues: { driverId: driver.id, status: task.status },
      });

      return {
        driver,
        task,
        message: "Assignment accepted.",
      };
    }

    const actionStatusMap: Record<
      Exclude<typeof input.action, "ACCEPT" | "DECLINE">,
      TransportTaskStatus
    > = {
      EN_ROUTE: TransportTaskStatus.EN_ROUTE,
      PICKED_UP: TransportTaskStatus.PICKED_UP,
      DROPPED_OFF: TransportTaskStatus.DROPPED_OFF,
      COMPLETED: TransportTaskStatus.COMPLETED,
    };

    const nextStatus = actionStatusMap[input.action];

    const updatedTask = await tx.transportTask.update({
      where: { id: input.taskId },
      data: { status: nextStatus },
      include: {
        airport: true,
        mandir: true,
        flightSegment: {
          include: {
            departureAirport: true,
            arrivalAirport: true,
          },
        },
        itinerary: {
          include: {
            itineraryPassengers: {
              include: {
                passenger: true,
              },
            },
          },
        },
        drivers: { include: { driver: true } },
      },
    });

    await tx.transportTaskStatusHistory.create({
      data: {
        transportTaskId: input.taskId,
        oldStatus: task.status,
        newStatus: nextStatus,
        changedByDriverId: driver.id,
        source: AuditSource.BOT,
        note: `Driver updated task to ${nextStatus}.`,
      },
    });

    await createAuditLog(tx, {
      action: "TRANSPORT_TASK_STATUS_UPDATED_BY_DRIVER",
      entityType: "TransportTask",
      entityId: input.taskId,
      source: AuditSource.BOT,
      newValues: { driverId: driver.id, oldStatus: task.status, newStatus: nextStatus },
    });

    return {
      driver,
      task: updatedTask,
      message: `Status updated to ${nextStatus}.`,
    };
  });
}

export async function listApprovalRequests() {
  return prisma.approvalRequest.findMany({
    orderBy: { requestedAt: "desc" },
    include: {
      requestedByUser: true,
      reviewedByUser: true,
      itinerary: true,
    },
  });
}

export async function reviewApprovalRequest(input: {
  id: string;
  status: ApprovalStatus;
  reviewComment?: string | null;
  reviewedByUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.findUnique({
      where: { id: input.id },
      include: { itinerary: true },
    });

    if (!approval) {
      throw new Error("Approval request not found.");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new Error("Approval request has already been reviewed.");
    }

    if (input.status === ApprovalStatus.APPROVED) {
      const proposedPayload = (approval.proposedPayload ?? {}) as Prisma.InputJsonObject;

      if ((approval.entityType === "FLIGHT_SEGMENT" || approval.entityType === "FLIGHT_SEGMENT_UPDATE") && approval.entityId) {
        await updateFlightSegmentRecord(tx, approval.entityId, proposedPayload);
      } else if (approval.entityType === "FLIGHT_SEGMENT_CREATE") {
        await createFlightSegmentRecord(tx, proposedPayload as unknown as FlightSegmentInput);
      } else if (approval.entityType === "ITINERARY_UPDATE") {
        const tripPayload = proposedPayload as unknown as TripInput & {
          status?: Prisma.ItineraryUpdateInput["status"];
          isArchived?: boolean;
        };
        if (Array.isArray(tripPayload.passengerIds) && Array.isArray(tripPayload.segments)) {
          await tx.itinerary.update({
            where: { id: approval.itineraryId },
            data: {
              notes: tripPayload.notes ?? null,
              status: tripPayload.status,
              isArchived: typeof tripPayload.isArchived === "boolean" ? tripPayload.isArchived : undefined,
            },
          });
          await syncTripRelations(tx, approval.itineraryId, {
            ...tripPayload,
            createdByUserId: input.reviewedByUserId,
          });
        } else {
          await tx.itinerary.update({
            where: { id: approval.itineraryId },
            data: {
              notes: typeof tripPayload.notes === "string" || tripPayload.notes === null ? tripPayload.notes : undefined,
              status: tripPayload.status,
              isArchived: typeof tripPayload.isArchived === "boolean" ? tripPayload.isArchived : undefined,
            },
          });
        }
      }
    }

    const reviewedApproval = await tx.approvalRequest.update({
      where: { id: input.id },
      data: {
        status: input.status,
        reviewComment: input.reviewComment ?? null,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
      },
      include: {
        requestedByUser: true,
        reviewedByUser: true,
        itinerary: true,
      },
    });

    const pendingCount = await tx.approvalRequest.count({
      where: {
        itineraryId: approval.itineraryId,
        status: ApprovalStatus.PENDING,
      },
    });

    if (pendingCount === 0) {
      const latestItinerary = await tx.itinerary.findUnique({
        where: { id: approval.itineraryId },
        select: { status: true },
      });
      const nextStatus =
        input.status === ApprovalStatus.APPROVED
          ? latestItinerary?.status === "CANCELLED"
            ? "CANCELLED"
            : latestItinerary?.status === "PENDING_APPROVAL" || !latestItinerary?.status
              ? "CONFIRMED"
              : latestItinerary.status
          : approval.itinerary.status === "CANCELLED"
            ? "CANCELLED"
            : "CONFIRMED";

      await tx.itinerary.update({
        where: { id: approval.itineraryId },
        data: {
          status: nextStatus,
        },
      });
    }

    if (
      input.status === ApprovalStatus.APPROVED &&
      ["FLIGHT_SEGMENT", "FLIGHT_SEGMENT_UPDATE", "FLIGHT_SEGMENT_CREATE", "ITINERARY_UPDATE"].includes(approval.entityType)
    ) {
      const detail = await findTripDetailOrThrow(tx, approval.itineraryId);
      const changeLabel =
        approval.entityType === "FLIGHT_SEGMENT_CREATE"
          ? "Flight added"
          : detail.status === "CANCELLED" && detail.isArchived
            ? "Flight cancelled and archived"
            : "Flight changed";

      await queueFlightChangeNotifications(tx, {
        itinerary: detail,
        changeLabel,
      });
    }

    await createAuditLog(tx, {
      action: "APPROVAL_REQUEST_REVIEWED",
      entityType: "ApprovalRequest",
      entityId: input.id,
      actorUserId: input.reviewedByUserId,
      oldValues: { status: approval.status },
      newValues: {
        status: input.status,
        reviewComment: input.reviewComment ?? null,
      },
    });

    return reviewedApproval;
  });
}

export async function createPublicSubmission(input: {
  rawPayload: Prisma.InputJsonValue;
  normalizedPayload?: Prisma.InputJsonValue;
  notes?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.publicSubmission.create({
      data: {
        rawPayload: input.rawPayload,
        normalizedPayload: input.normalizedPayload,
        notes: input.notes ?? null,
      },
    });

    await createAuditLog(tx, {
      action: "PUBLIC_SUBMISSION_CREATED",
      entityType: "PublicSubmission",
      entityId: submission.id,
      source: AuditSource.SYSTEM,
      newValues: {
        status: submission.status,
      },
    });

    return submission;
  });
}

export async function listPublicSubmissions(status?: SubmissionStatus) {
  return prisma.publicSubmission.findMany({
    where: status ? { status } : undefined,
    include: {
      reviewedByUser: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPublicSubmission(id: string) {
  return prisma.publicSubmission.findUnique({
    where: { id },
    include: {
      reviewedByUser: true,
      itinerary: true,
    },
  });
}

export async function reviewPublicSubmission(input: {
  id: string;
  status: "APPROVED" | "REJECTED" | "DUPLICATE_FLAGGED";
  reviewedByUserId: string;
  reviewNote?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.publicSubmission.findUnique({
      where: { id: input.id },
    });

    if (!submission) {
      throw new Error("Public submission not found.");
    }

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new Error("Public submission has already been reviewed.");
    }

    const reviewedSubmission = await tx.publicSubmission.update({
      where: { id: input.id },
      data: {
        status: input.status,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
        notes: input.reviewNote ?? submission.notes ?? null,
      },
      include: {
        itinerary: true,
        reviewedByUser: true,
      },
    });

    await createAuditLog(tx, {
      action: "PUBLIC_SUBMISSION_REVIEWED",
      entityType: "PublicSubmission",
      entityId: input.id,
      actorUserId: input.reviewedByUserId,
      oldValues: { status: submission.status },
      newValues: { status: input.status },
    });

    return reviewedSubmission;
  });
}

export async function createTripFromPublicSubmission(
  submissionId: string,
  input: Omit<TripInput, "passengerIds"> & {
    passengers: Array<{
      firstName: string;
      lastName: string;
      phone?: string | null;
      passengerType?: Prisma.PassengerCreateInput["passengerType"];
    }>;
    reviewedByUserId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.publicSubmission.findUnique({
      where: { id: submissionId },
      include: { itinerary: true },
    });

    if (!submission) {
      throw new Error("Public submission not found.");
    }

    if (submission.itinerary) {
      throw new Error("This submission has already been converted into an itinerary.");
    }

    if (input.passengers.length === 0) {
      throw new Error("At least one passenger is required.");
    }

    const createdPassengers = await Promise.all(
      input.passengers.map((passenger) =>
        tx.passenger.create({
          data: {
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            phone: normalizeOptionalPhone(passenger.phone ?? null),
            passengerType: passenger.passengerType ?? PassengerType.GUEST_SANTO,
          },
        }),
      ),
    );

    const itinerary = await tx.itinerary.create({
      data: {
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? input.reviewedByUserId,
        sourceSubmissionId: submissionId,
        itineraryPassengers: {
          create: createdPassengers.map((passenger) => ({
            passengerId: passenger.id,
          })),
        },
      },
    });

    await syncTripRelations(tx, itinerary.id, {
      ...input,
      passengerIds: createdPassengers.map((passenger) => passenger.id),
    });

    await tx.publicSubmission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: new Date(),
      },
    });

    await createAuditLog(tx, {
      action: "PUBLIC_SUBMISSION_CONVERTED",
      entityType: "PublicSubmission",
      entityId: submissionId,
      actorUserId: input.reviewedByUserId,
      oldValues: { status: submission.status },
      newValues: {
        status: SubmissionStatus.APPROVED,
        itineraryId: itinerary.id,
      },
    });

    return findTripDetailOrThrow(tx, itinerary.id);
  });
}

export async function syncGoogleSheetsSnapshot(input: GoogleSheetsSnapshotInput) {
  const syncedAt = new Date(input.syncedAt);
  if (Number.isNaN(syncedAt.getTime())) {
    throw new Error("Invalid syncedAt timestamp.");
  }

  return prisma.$transaction(async (tx) => {
    const existingLinks = await tx.externalSyncLink.findMany({
      where: { provider: GOOGLE_SHEETS_SYNC_PROVIDER },
      include: {
        itinerary: {
          select: {
            id: true,
            status: true,
            isArchived: true,
          },
        },
      },
    });

    const linksByExternalKey = new Map(existingLinks.map((link) => [link.externalKey, link]));
    const seenExternalKeys = new Set<string>();
    const summary = {
      created: 0,
      updated: 0,
      archived: 0,
      unarchived: 0,
      reviewRequired: 0,
      skippedChanges: 0,
      autoCreatedPassengers: 0,
      autoCreatedDrivers: 0,
    };

    for (const trip of input.trips) {
      const externalKey = normalizeSyncText(trip.externalKey);
      if (!externalKey) {
        throw new Error("Every synced trip must include an externalKey.");
      }

      if (seenExternalKeys.has(externalKey)) {
        throw new Error(`Duplicate externalKey detected in snapshot: ${externalKey}`);
      }

      seenExternalKeys.add(externalKey);
      const existingLink = linksByExternalKey.get(externalKey);
      const payloadHash = hashGoogleSheetsTripPayload(trip);
      const wasArchived = !!existingLink && (existingLink.itinerary.isArchived || existingLink.itinerary.status === ItineraryStatus.CANCELLED);

      let itineraryId = existingLink?.itineraryId ?? null;

      if (!itineraryId) {
        const itinerary = await tx.itinerary.create({
          data: {
            status: ItineraryStatus.CREATED,
          },
        });
        itineraryId = itinerary.id;
        summary.created += 1;

        await createAuditLog(tx, {
          action: "GOOGLE_SHEETS_TRIP_CREATED",
          entityType: "Itinerary",
          entityId: itinerary.id,
          source: AuditSource.IMPORT,
          newValues: {
            source: GOOGLE_SHEETS_SYNC_ACTOR,
            externalKey,
            sheetName: input.sheetName,
          },
        });
      } else {
        summary.updated += 1;
      }

      if (existingLink?.itinerary.isArchived || existingLink?.itinerary.status === ItineraryStatus.CANCELLED) {
        await tx.itinerary.update({
          where: { id: itineraryId },
          data: {
            status: ItineraryStatus.CREATED,
            isArchived: false,
          },
        });
        summary.unarchived += 1;

        await createAuditLog(tx, {
          action: "GOOGLE_SHEETS_TRIP_UNARCHIVED",
          entityType: "Itinerary",
          entityId: itineraryId,
          source: AuditSource.IMPORT,
          oldValues: {
            status: existingLink?.itinerary.status ?? null,
            isArchived: existingLink?.itinerary.isArchived ?? false,
          },
          newValues: {
            status: ItineraryStatus.CREATED,
            isArchived: false,
            source: GOOGLE_SHEETS_SYNC_ACTOR,
          },
        });
      }

      const resolvedPassengers = await resolveItineraryPassengersFromGoogleSheets(tx, {
        passengers: trip.passengers,
      });
      summary.autoCreatedPassengers += resolvedPassengers.createdCount;

      const resolvedDrivers = await resolveTransportAssignmentsFromGoogleSheets(tx, {
        pickupDriverName: trip.pickupDriverName,
        dropoffDriverName: trip.dropoffDriverName,
      });
      summary.autoCreatedDrivers += resolvedDrivers.createdCount;

      const segmentId = await syncFlightSegmentFromGoogleSheets(tx, {
        itineraryId,
        trip,
      });
      await upsertBookingFromGoogleSheetsSync(tx, {
        itineraryId,
        locatorNumber: trip.locatorNumber,
        cost: trip.cost,
      });

      const proposedRoster = buildProposedGoogleSheetsRoster(resolvedPassengers, resolvedDrivers);

      let appliedPassengerIds = proposedRoster.passengerIds;
      let appliedPickupDriverId = proposedRoster.pickupDriverId;
      let appliedDropoffDriverId = proposedRoster.dropoffDriverId;
      let pendingReview = false;

      if (!existingLink || wasArchived) {
        await applyItineraryPassengersFromGoogleSheetsSnapshot(tx, {
          itineraryId,
          passengerIds: proposedRoster.passengerIds,
        });
        await syncTransportAssignmentsByDriverIds(tx, {
          itineraryId,
          pickupDriverId: proposedRoster.pickupDriverId,
          dropoffDriverId: proposedRoster.dropoffDriverId,
        });
      } else {
        const currentRoster = await loadCurrentGoogleSheetsRoster(tx, itineraryId);
        const rosterMatches =
          arraysEqualAsSets(currentRoster.passengerIds, proposedRoster.passengerIds) &&
          currentRoster.pickupDriverId === proposedRoster.pickupDriverId &&
          currentRoster.dropoffDriverId === proposedRoster.dropoffDriverId;

        if (rosterMatches) {
          await clearStagedGoogleSheetsRosterDiff(tx, existingLink.id, syncedAt, payloadHash, input.sheetName, trip);
          if (existingLink.syncStatus === ExternalSyncStatus.REVIEW_REQUIRED) {
            await createAuditLog(tx, {
              action: "GOOGLE_SHEETS_ROSTER_DIFF_CLEARED",
              entityType: "Itinerary",
              entityId: itineraryId,
              source: AuditSource.IMPORT,
              oldValues: existingLink.pendingRosterDiff as Prisma.InputJsonValue | undefined,
              newValues: {
                source: GOOGLE_SHEETS_SYNC_ACTOR,
                externalKey,
              },
            });
          }
          appliedPassengerIds = currentRoster.passengerIds;
          appliedPickupDriverId = currentRoster.pickupDriverId;
          appliedDropoffDriverId = currentRoster.dropoffDriverId;
        } else {
          const pendingDiff = buildPendingRosterDiff({
            syncedAt,
            sourceRows: trip.sourceRows ?? [],
            current: currentRoster,
            proposed: proposedRoster,
          });
          await stagePendingGoogleSheetsRosterDiff(
            tx,
            {
              linkId: existingLink.id,
              syncedAt,
              payloadHash,
              sheetName: input.sheetName,
              trip,
            },
            pendingDiff,
          );
          await createAuditLog(tx, {
            action: "GOOGLE_SHEETS_ROSTER_DIFF_STAGED",
            entityType: "Itinerary",
            entityId: itineraryId,
            source: AuditSource.IMPORT,
            oldValues: pendingDiff.current as unknown as Prisma.InputJsonValue,
            newValues: pendingDiff.proposed as unknown as Prisma.InputJsonValue,
          });
          summary.reviewRequired += 1;
          summary.skippedChanges += 1;
          pendingReview = true;
          appliedPassengerIds = currentRoster.passengerIds;
          appliedPickupDriverId = currentRoster.pickupDriverId;
          appliedDropoffDriverId = currentRoster.dropoffDriverId;
        }
      }

      if (existingLink) {
        await tx.externalSyncLink.update({
          where: {
            provider_externalKey: {
              provider: GOOGLE_SHEETS_SYNC_PROVIDER,
              externalKey,
            },
          },
          data: {
            itineraryId,
            lastSeenAt: syncedAt,
            lastSyncedAt: syncedAt,
            ...(wasArchived
              ? {
                  syncStatus: ExternalSyncStatus.IN_SYNC,
                  lastPayloadHash: payloadHash,
                  sourceMetadata: buildGoogleSheetsSourceMetadata(input.sheetName, trip),
                  pendingRosterDiff: Prisma.JsonNull,
                  lastReviewDiffAt: null,
                }
              : {}),
          },
        });
      } else {
        await tx.externalSyncLink.create({
          data: {
            provider: GOOGLE_SHEETS_SYNC_PROVIDER,
            externalKey,
            itineraryId,
            syncStatus: ExternalSyncStatus.IN_SYNC,
            lastSeenAt: syncedAt,
            lastSyncedAt: syncedAt,
            lastPayloadHash: payloadHash,
            sourceMetadata: buildGoogleSheetsSourceMetadata(input.sheetName, trip),
          },
        });
      }

      await createAuditLog(tx, {
        action: existingLink ? "GOOGLE_SHEETS_TRIP_SYNCED" : "GOOGLE_SHEETS_TRIP_IMPORTED",
        entityType: "Itinerary",
        entityId: itineraryId,
        source: AuditSource.IMPORT,
        newValues: {
          source: GOOGLE_SHEETS_SYNC_ACTOR,
          externalKey,
          locatorNumber: trip.locatorNumber ?? null,
          passengerIds: appliedPassengerIds,
          segmentId,
          pickupDriverId: appliedPickupDriverId,
          dropoffDriverId: appliedDropoffDriverId,
          pendingReview,
        },
      });
    }

    const missingLinks = existingLinks.filter((link) => !seenExternalKeys.has(link.externalKey));

    for (const link of missingLinks) {
      if (!link.itinerary.isArchived || link.itinerary.status !== ItineraryStatus.CANCELLED) {
        await tx.itinerary.update({
          where: { id: link.itineraryId },
          data: {
            status: ItineraryStatus.CANCELLED,
            isArchived: true,
          },
        });
        summary.archived += 1;

        await createAuditLog(tx, {
          action: "GOOGLE_SHEETS_TRIP_ARCHIVED",
          entityType: "Itinerary",
          entityId: link.itineraryId,
          source: AuditSource.IMPORT,
          oldValues: {
            status: link.itinerary.status,
            isArchived: link.itinerary.isArchived,
          },
          newValues: {
            status: ItineraryStatus.CANCELLED,
            isArchived: true,
            source: GOOGLE_SHEETS_SYNC_ACTOR,
            externalKey: link.externalKey,
          },
        });
      }

      await tx.externalSyncLink.update({
        where: { id: link.id },
        data: {
          lastSyncedAt: syncedAt,
          syncStatus: ExternalSyncStatus.IN_SYNC,
          pendingRosterDiff: Prisma.JsonNull,
          lastReviewDiffAt: null,
        },
      });
    }

    return {
      sheetName: input.sheetName,
      syncedAt: syncedAt.toISOString(),
      processedTrips: input.trips.length,
      ...summary,
    };
  });
}

function buildGoogleSheetsSourceMetadata(sheetName: string, trip: GoogleSheetsTripInput) {
  return {
    sheetName,
    sourceRows: trip.sourceRows ?? [],
    locatorNumber: trip.locatorNumber ?? null,
  };
}

function buildProposedGoogleSheetsRoster(
  passengers: Awaited<ReturnType<typeof resolveItineraryPassengersFromGoogleSheets>>,
  drivers: Awaited<ReturnType<typeof resolveTransportAssignmentsFromGoogleSheets>>,
): GoogleSheetsRosterSnapshot {
  return {
    passengerIds: passengers.passengerIds,
    passengers: passengers.passengers,
    pickupDriverId: drivers.pickupDriverId,
    pickupDriverName: drivers.pickupDriverName,
    dropoffDriverId: drivers.dropoffDriverId,
    dropoffDriverName: drivers.dropoffDriverName,
  };
}

function buildPendingRosterDiff(input: {
  syncedAt: Date;
  sourceRows: number[];
  current: GoogleSheetsRosterSnapshot;
  proposed: GoogleSheetsRosterSnapshot;
}): GoogleSheetsPendingRosterDiff {
  return {
    source: "google-sheets",
    syncedAt: input.syncedAt.toISOString(),
    sourceRows: input.sourceRows,
    current: input.current,
    proposed: input.proposed,
  };
}

async function stagePendingGoogleSheetsRosterDiff(
  tx: Prisma.TransactionClient,
  input: {
    linkId: string;
    syncedAt: Date;
    payloadHash: string;
    sheetName: string;
    trip: GoogleSheetsTripInput;
  },
  pendingDiff: GoogleSheetsPendingRosterDiff,
) {
  await tx.externalSyncLink.update({
    where: { id: input.linkId },
    data: {
      syncStatus: ExternalSyncStatus.REVIEW_REQUIRED,
      lastSeenAt: input.syncedAt,
      lastSyncedAt: input.syncedAt,
      lastPayloadHash: input.payloadHash,
      sourceMetadata: buildGoogleSheetsSourceMetadata(input.sheetName, input.trip),
      pendingRosterDiff: pendingDiff as unknown as Prisma.InputJsonValue,
      lastReviewDiffAt: input.syncedAt,
    },
  });
}

async function clearStagedGoogleSheetsRosterDiff(
  tx: Prisma.TransactionClient,
  linkId: string,
  syncedAt: Date,
  payloadHash: string,
  sheetName: string,
  trip: GoogleSheetsTripInput,
) {
  await tx.externalSyncLink.update({
    where: { id: linkId },
    data: {
      syncStatus: ExternalSyncStatus.IN_SYNC,
      lastSeenAt: syncedAt,
      lastSyncedAt: syncedAt,
      lastPayloadHash: payloadHash,
      sourceMetadata: buildGoogleSheetsSourceMetadata(sheetName, trip),
      pendingRosterDiff: Prisma.JsonNull,
      lastReviewDiffAt: null,
    },
  });
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeOptionalPhone(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizePhone(value);
  return normalized.length > 0 ? normalized : null;
}

async function findAirportByCodeOrThrow(tx: Prisma.TransactionClient, code: string) {
  const airport = await tx.airport.findFirst({
    where: { code: normalizeSyncCode(code) },
  });

  if (!airport) {
    throw new Error(`Airport ${code} was not found.`);
  }

  return airport;
}

async function findPassengerBySyncedName(
  tx: Prisma.TransactionClient,
  input: { firstName: string; lastName: string },
) {
  const normalizedTarget = normalizeSyncPersonName(input.firstName, input.lastName);
  const normalizedSwappedTarget = normalizeSyncPersonName(input.lastName, input.firstName);
  if (!normalizedTarget) {
    return null;
  }

  const candidates = await tx.passenger.findMany({
    where: { isActive: true },
  });

  const exactFullMatches = candidates.filter((passenger) => {
    const normalizedPassengerName = normalizeSyncPersonName(passenger.firstName, passenger.lastName);
    const normalizedLegalName = normalizeSyncName(passenger.legalName);
    return normalizedPassengerName === normalizedTarget || normalizedLegalName === normalizedTarget;
  });
  if (exactFullMatches.length === 1) {
    return {
      passenger: exactFullMatches[0],
      strategy: "exact_full" as const,
    };
  }

  const exactSwappedMatches = candidates.filter((passenger) => {
    const normalizedPassengerName = normalizeSyncPersonName(passenger.firstName, passenger.lastName);
    const normalizedLegalName = normalizeSyncName(passenger.legalName);
    return normalizedPassengerName === normalizedSwappedTarget || normalizedLegalName === normalizedSwappedTarget;
  });
  if (exactSwappedMatches.length === 1) {
    return {
      passenger: exactSwappedMatches[0],
      strategy: "exact_swapped" as const,
    };
  }

  const fuzzyFullMatch = pickConfidentMatch(
    candidates.map((passenger) => ({
      passenger,
      score: Math.max(
        getSimilarityScore(normalizeSyncPersonName(passenger.firstName, passenger.lastName), normalizedTarget),
        getSimilarityScore(normalizeSyncName(passenger.legalName), normalizedTarget),
      ),
    })),
  );
  if (fuzzyFullMatch) {
    return {
      passenger: fuzzyFullMatch.passenger,
      strategy: "fuzzy_full" as const,
    };
  }

  const fuzzySwappedMatch = pickConfidentMatch(
    candidates.map((passenger) => ({
      passenger,
      score: Math.max(
        getSimilarityScore(normalizeSyncPersonName(passenger.firstName, passenger.lastName), normalizedSwappedTarget),
        getSimilarityScore(normalizeSyncName(passenger.legalName), normalizedSwappedTarget),
      ),
    })),
  );
  if (fuzzySwappedMatch) {
    return {
      passenger: fuzzySwappedMatch.passenger,
      strategy: "fuzzy_swapped" as const,
    };
  }

  return null;
}

async function createPassengerForGoogleSheetsSync(
  tx: Prisma.TransactionClient,
  input: { firstName: string; lastName: string },
) {
  const passenger = await tx.passenger.create({
    data: {
      firstName: normalizeSyncText(input.firstName),
      lastName: normalizeSyncText(input.lastName),
      passengerType: DEFAULT_SYNC_PASSENGER_TYPE,
      isActive: true,
    },
  });

  await createAuditLog(tx, {
    action: "PASSENGER_AUTO_CREATED_FROM_GOOGLE_SHEETS",
    entityType: "Passenger",
    entityId: passenger.id,
    source: AuditSource.IMPORT,
    newValues: {
      source: GOOGLE_SHEETS_SYNC_ACTOR,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
    },
  });

  return passenger;
}

async function ensurePassengerForGoogleSheetsSync(
  tx: Prisma.TransactionClient,
  input: { firstName: string; lastName: string },
) {
  const matched = await findPassengerBySyncedName(tx, input);
  if (matched) {
    if (matched.strategy !== "exact_full") {
      await createAuditLog(tx, {
        action: "PASSENGER_MATCHED_FROM_GOOGLE_SHEETS",
        entityType: "Passenger",
        entityId: matched.passenger.id,
        source: AuditSource.IMPORT,
        newValues: {
          source: GOOGLE_SHEETS_SYNC_ACTOR,
          strategy: matched.strategy,
          sheetName: buildPassengerDisplayName(input),
        },
      });
    }

    return {
      passenger: matched.passenger,
      mode: "matched" as const,
      matchStrategy: matched.strategy,
    };
  }

  return {
    passenger: await createPassengerForGoogleSheetsSync(tx, input),
    mode: "created" as const,
    matchStrategy: null,
  };
}

async function findDriverBySyncedName(tx: Prisma.TransactionClient, name: string) {
  const normalizedTarget = normalizeSyncName(name);
  if (!normalizedTarget) {
    return null;
  }

  const drivers = await tx.driver.findMany({
    where: { isActive: true },
    include: {
      driverAirports: { include: { airport: true } },
    },
  });

  const exactMatches = drivers.filter((driver) => normalizeSyncName(driver.name) === normalizedTarget);
  if (exactMatches.length === 1) {
    return {
      driver: exactMatches[0],
      strategy: "exact" as const,
    };
  }

  const fuzzyMatch = pickConfidentMatch(
    drivers.map((driver) => ({
      driver,
      score: getSimilarityScore(normalizeSyncName(driver.name), normalizedTarget),
    })),
  );
  if (!fuzzyMatch) {
    return null;
  }

  return {
    driver: fuzzyMatch.driver,
    strategy: "fuzzy" as const,
  };
}

async function createDriverForGoogleSheetsSync(tx: Prisma.TransactionClient, name: string) {
  const driver = await tx.driver.create({
    data: {
      name: normalizeSyncText(name),
      isActive: true,
    },
    include: {
      driverAirports: { include: { airport: true } },
    },
  });

  await createAuditLog(tx, {
    action: "DRIVER_AUTO_CREATED_FROM_GOOGLE_SHEETS",
    entityType: "Driver",
    entityId: driver.id,
    source: AuditSource.IMPORT,
    newValues: {
      source: GOOGLE_SHEETS_SYNC_ACTOR,
      name: driver.name,
    },
  });

  return driver;
}

async function ensureDriverForGoogleSheetsSync(tx: Prisma.TransactionClient, name?: string | null) {
  const normalizedName = normalizeSyncText(name);
  if (!normalizedName) {
    return null;
  }

  const matched = await findDriverBySyncedName(tx, normalizedName);
  if (matched) {
    if (matched.strategy !== "exact") {
      await createAuditLog(tx, {
        action: "DRIVER_MATCHED_FROM_GOOGLE_SHEETS",
        entityType: "Driver",
        entityId: matched.driver.id,
        source: AuditSource.IMPORT,
        newValues: {
          source: GOOGLE_SHEETS_SYNC_ACTOR,
          strategy: matched.strategy,
          name: normalizedName,
        },
      });
    }

    return {
      driver: matched.driver,
      mode: "matched" as const,
      matchStrategy: matched.strategy,
    };
  }

  return {
    driver: await createDriverForGoogleSheetsSync(tx, normalizedName),
    mode: "created" as const,
    matchStrategy: null,
  };
}

async function upsertBookingFromGoogleSheetsSync(
  tx: Prisma.TransactionClient,
  input: {
    itineraryId: string;
    locatorNumber?: string | null;
    cost?: string | null;
  },
) {
  const confirmationNumber = normalizeSyncText(input.locatorNumber) || null;
  const parsedCost = parseOptionalCost(input.cost);
  const existingBooking = await tx.booking.findUnique({
    where: { itineraryId: input.itineraryId },
  });

  if (!existingBooking && !confirmationNumber && parsedCost === null) {
    return null;
  }

  if (existingBooking) {
    return tx.booking.update({
      where: { itineraryId: input.itineraryId },
      data: {
        confirmationNumber,
        totalCost:
          existingBooking.totalCost === null && parsedCost !== null
            ? new Prisma.Decimal(parsedCost)
            : undefined,
      },
    });
  }

  return tx.booking.create({
    data: {
      itineraryId: input.itineraryId,
      confirmationNumber,
      totalCost: parsedCost === null ? null : new Prisma.Decimal(parsedCost),
    },
  });
}

async function resolveItineraryPassengersFromGoogleSheets(
  tx: Prisma.TransactionClient,
  input: {
    passengers: GoogleSheetsPassengerInput[];
  },
) {
  const resolvedPassengers = await Promise.all(
    input.passengers.map((passenger) =>
      ensurePassengerForGoogleSheetsSync(tx, {
        firstName: passenger.firstName,
        lastName: passenger.lastName,
      }),
    ),
  );

  const passengerMap = new Map<string, { id: string; name: string }>();
  let createdCount = 0;

  for (const entry of resolvedPassengers) {
    passengerMap.set(entry.passenger.id, {
      id: entry.passenger.id,
      name: buildPassengerDisplayName(entry.passenger),
    });
    if (entry.mode === "created") {
      createdCount += 1;
    }
  }

  return {
    passengerIds: Array.from(passengerMap.keys()),
    passengers: Array.from(passengerMap.values()),
    createdCount,
  };
}

async function applyItineraryPassengersFromGoogleSheetsSnapshot(
  tx: Prisma.TransactionClient,
  input: {
    itineraryId: string;
    passengerIds: string[];
  },
) {
  await tx.itineraryPassenger.deleteMany({
    where: { itineraryId: input.itineraryId },
  });

  if (input.passengerIds.length > 0) {
    await tx.itineraryPassenger.createMany({
      data: input.passengerIds.map((passengerId) => ({
        itineraryId: input.itineraryId,
        passengerId,
      })),
    });
  }
}

async function syncTransportTaskDriverAssignments(
  tx: Prisma.TransactionClient,
  input: {
    taskId: string;
    driverIds: string[];
  },
) {
  const currentTask = await tx.transportTask.findUnique({
    where: { id: input.taskId },
    select: { status: true },
  });

  if (!currentTask) {
    throw new Error("Transport task not found.");
  }

  await tx.transportTaskDriver.deleteMany({
    where: { transportTaskId: input.taskId },
  });

  if (input.driverIds.length > 0) {
    await tx.transportTaskDriver.createMany({
      data: input.driverIds.map((driverId) => ({
        transportTaskId: input.taskId,
        driverId,
      })),
    });
  }

  const nextStatus =
    input.driverIds.length > 0
      ? currentTask.status === TransportTaskStatus.UNASSIGNED
        ? TransportTaskStatus.ASSIGNED
        : currentTask.status
      : currentTask.status === TransportTaskStatus.ASSIGNED || currentTask.status === TransportTaskStatus.UNASSIGNED
        ? TransportTaskStatus.UNASSIGNED
        : currentTask.status;

  await tx.transportTask.update({
    where: { id: input.taskId },
    data: { status: nextStatus },
  });
}

async function syncTransportAssignmentsByDriverIds(
  tx: Prisma.TransactionClient,
  input: {
    itineraryId: string;
    pickupDriverId?: string | null;
    dropoffDriverId?: string | null;
  },
) {
  const tasks = await tx.transportTask.findMany({
    where: { itineraryId: input.itineraryId },
    include: {
      drivers: { include: { driver: true } },
    },
  });

  const pickupTask = tasks.find((task) => task.taskType === TransportTaskType.PICKUP);
  const dropoffTask = tasks.find((task) => task.taskType === TransportTaskType.DROPOFF);

  if (pickupTask) {
    await syncTransportTaskDriverAssignments(tx, {
      taskId: pickupTask.id,
      driverIds: input.pickupDriverId ? [input.pickupDriverId] : [],
    });
  }

  if (dropoffTask) {
    await syncTransportTaskDriverAssignments(tx, {
      taskId: dropoffTask.id,
      driverIds: input.dropoffDriverId ? [input.dropoffDriverId] : [],
    });
  }

  return {
    pickupDriverId: input.pickupDriverId ?? null,
    dropoffDriverId: input.dropoffDriverId ?? null,
  };
}

async function resolveTransportAssignmentsFromGoogleSheets(
  tx: Prisma.TransactionClient,
  input: {
    pickupDriverName?: string | null;
    dropoffDriverName?: string | null;
  },
) {
  const [pickupDriver, dropoffDriver] = await Promise.all([
    ensureDriverForGoogleSheetsSync(tx, input.pickupDriverName),
    ensureDriverForGoogleSheetsSync(tx, input.dropoffDriverName),
  ]);

  return {
    pickupDriverId: pickupDriver?.driver.id ?? null,
    pickupDriverName: pickupDriver?.driver.name ?? (normalizeSyncText(input.pickupDriverName) || null),
    dropoffDriverId: dropoffDriver?.driver.id ?? null,
    dropoffDriverName: dropoffDriver?.driver.name ?? (normalizeSyncText(input.dropoffDriverName) || null),
    createdCount: [pickupDriver, dropoffDriver].filter((entry) => entry?.mode === "created").length,
  };
}

async function loadCurrentGoogleSheetsRoster(tx: Prisma.TransactionClient, itineraryId: string): Promise<GoogleSheetsRosterSnapshot> {
  const itinerary = await tx.itinerary.findUniqueOrThrow({
    where: { id: itineraryId },
    include: {
      itineraryPassengers: {
        include: {
          passenger: true,
        },
      },
      transportTasks: {
        include: {
          drivers: {
            include: {
              driver: true,
            },
          },
        },
      },
    },
  });

  const pickupDrivers = itinerary.transportTasks
    .filter((task) => task.taskType === TransportTaskType.PICKUP)
    .flatMap((task) => task.drivers.map((entry) => entry.driver));
  const dropoffDrivers = itinerary.transportTasks
    .filter((task) => task.taskType === TransportTaskType.DROPOFF)
    .flatMap((task) => task.drivers.map((entry) => entry.driver));

  return {
    passengerIds: itinerary.itineraryPassengers.map((entry) => entry.passenger.id),
    passengers: itinerary.itineraryPassengers.map((entry) => ({
      id: entry.passenger.id,
      name: buildPassengerDisplayName(entry.passenger),
    })),
    pickupDriverId: pickupDrivers[0]?.id ?? null,
    pickupDriverName: pickupDrivers[0]?.name ?? null,
    dropoffDriverId: dropoffDrivers[0]?.id ?? null,
    dropoffDriverName: dropoffDrivers[0]?.name ?? null,
  };
}

export async function applyGoogleSheetsTravelerChanges(itineraryId: string, actorUserId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const syncLink = await tx.externalSyncLink.findFirst({
      where: {
        provider: GOOGLE_SHEETS_SYNC_PROVIDER,
        itineraryId,
      },
    });

    if (!syncLink || syncLink.syncStatus !== ExternalSyncStatus.REVIEW_REQUIRED || !syncLink.pendingRosterDiff) {
      throw new Error("No pending Google Sheets traveler changes were found for this itinerary.");
    }

    const pendingDiff = syncLink.pendingRosterDiff as GoogleSheetsPendingRosterDiff;
    const proposed = pendingDiff?.proposed;

    if (!proposed || !Array.isArray(proposed.passengerIds)) {
      throw new Error("The pending Google Sheets traveler diff is invalid.");
    }

    await applyItineraryPassengersFromGoogleSheetsSnapshot(tx, {
      itineraryId,
      passengerIds: proposed.passengerIds,
    });
    await syncTransportAssignmentsByDriverIds(tx, {
      itineraryId,
      pickupDriverId: proposed.pickupDriverId,
      dropoffDriverId: proposed.dropoffDriverId,
    });

    await tx.externalSyncLink.update({
      where: { id: syncLink.id },
      data: {
        syncStatus: ExternalSyncStatus.IN_SYNC,
        pendingRosterDiff: Prisma.JsonNull,
        lastReviewDiffAt: null,
      },
    });

    await createAuditLog(tx, {
      action: "GOOGLE_SHEETS_ROSTER_DIFF_APPLIED",
      entityType: "Itinerary",
      entityId: itineraryId,
      actorUserId: actorUserId ?? null,
      source: AuditSource.WEB,
      oldValues: pendingDiff.current as unknown as Prisma.InputJsonValue,
      newValues: pendingDiff.proposed as unknown as Prisma.InputJsonValue,
    });

    return findTripDetailOrThrow(tx, itineraryId);
  });
}

async function syncFlightSegmentFromGoogleSheets(
  tx: Prisma.TransactionClient,
  input: {
    itineraryId: string;
    trip: GoogleSheetsTripInput;
  },
) {
  const [departureAirport, arrivalAirport, existingSegments] = await Promise.all([
    findAirportByCodeOrThrow(tx, input.trip.departureAirport),
    findAirportByCodeOrThrow(tx, input.trip.arrivalAirport),
    tx.flightSegment.findMany({
      where: { itineraryId: input.itineraryId },
      orderBy: { segmentOrder: "asc" },
    }),
  ]);

  const departureTimeLocal = buildLocalDateTimeFromParts(input.trip.departureDate, input.trip.departureTime);
  const arrivalTimeLocal = buildLocalDateTimeFromParts(input.trip.arrivalDate, input.trip.arrivalTime);

  let segmentId: string;

  if (existingSegments[0]) {
    const updated = await updateFlightSegmentRecord(tx, existingSegments[0].id, {
      airline: normalizeSyncText(input.trip.airline),
      flightNumber: normalizeSyncText(input.trip.flightNumber).toUpperCase(),
      departureAirportId: departureAirport.id,
      arrivalAirportId: arrivalAirport.id,
      departureTimeLocal,
      arrivalTimeLocal,
    });
    segmentId = updated.id;

    if (existingSegments.length > 1) {
      await tx.transportTaskDriver.deleteMany({
        where: {
          transportTask: {
            flightSegmentId: {
              in: existingSegments.slice(1).map((segment) => segment.id),
            },
          },
        },
      });
      await tx.transportTask.deleteMany({
        where: {
          flightSegmentId: {
            in: existingSegments.slice(1).map((segment) => segment.id),
          },
        },
      });
      await tx.flightSegment.deleteMany({
        where: {
          id: {
            in: existingSegments.slice(1).map((segment) => segment.id),
          },
        },
      });
    }
  } else {
    const created = await createFlightSegmentRecord(tx, {
      itineraryId: input.itineraryId,
      segmentOrder: 1,
      airline: normalizeSyncText(input.trip.airline),
      flightNumber: normalizeSyncText(input.trip.flightNumber).toUpperCase(),
      departureAirportId: departureAirport.id,
      arrivalAirportId: arrivalAirport.id,
      departureTimeLocal,
      arrivalTimeLocal,
    });
    segmentId = created.id;
  }

  return segmentId;
}

export type TravelerRefInput = {
  entityType: "PASSENGER" | "USER" | "DRIVER";
  entityId: string;
};

const DEFAULT_AUTO_PASSENGER_TYPE = PassengerType.HARIBHAKTO;

async function ensurePassengerUserLink(tx: Prisma.TransactionClient, input: { userId: string; passengerId: string }) {
  const existing = await tx.passengerUserLink.findFirst({
    where: { userId: input.userId },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await tx.passengerUserLink.create({
    data: {
      userId: input.userId,
      passengerId: input.passengerId,
    },
  });
}

async function findPassengerMatchByIdentity(
  tx: Prisma.TransactionClient,
  input: { email?: string | null; phone?: string | null },
) {
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const normalizedPhone = normalizeOptionalPhone(input.phone);
  const clauses = [
    normalizedEmail ? { email: normalizedEmail } : undefined,
    normalizedPhone ? { phone: normalizedPhone } : undefined,
  ].filter(Boolean) as Prisma.PassengerWhereInput[];

  if (clauses.length === 0) {
    return null;
  }

  const matches = await tx.passenger.findMany({
    where: { OR: clauses },
    take: 2,
  });

  if (matches.length !== 1) {
    return null;
  }

  return matches[0];
}

async function createPassengerFromTraveler(
  tx: Prisma.TransactionClient,
  input:
    | {
        sourceType: "USER";
        user: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          phone?: string | null;
        };
        actorUserId?: string | null;
      }
    | {
        sourceType: "DRIVER";
        driver: {
          id: string;
          name: string;
          phone?: string | null;
        };
        actorUserId?: string | null;
      },
) {
  const parsedName =
    input.sourceType === "USER"
      ? {
          firstName: input.user.firstName.trim() || "Traveler",
          lastName: input.user.lastName.trim() || "Passenger",
        }
      : parseDisplayName(input.driver.name);

  const passenger = await tx.passenger.create({
    data: {
      firstName: parsedName.firstName?.trim() || "Traveler",
      lastName: parsedName.lastName?.trim() || "Passenger",
      email: input.sourceType === "USER" ? input.user.email.toLowerCase() : null,
      phone: normalizeOptionalPhone(input.sourceType === "USER" ? input.user.phone : input.driver.phone),
      passengerType: DEFAULT_AUTO_PASSENGER_TYPE,
      isActive: true,
    },
  });

  await createAuditLog(tx, {
    action: "PASSENGER_AUTO_CREATED_FOR_TRAVELER",
    entityType: "Passenger",
    entityId: passenger.id,
    actorUserId: input.actorUserId ?? null,
    source: AuditSource.WEB,
    newValues: {
      sourceType: input.sourceType,
      sourceId: input.sourceType === "USER" ? input.user.id : input.driver.id,
    },
  });

  return passenger;
}

async function resolveTravelerRefsToPassengerIds(
  tx: Prisma.TransactionClient,
  input: {
    passengerIds?: string[];
    travelerRefs?: TravelerRefInput[];
    actorUserId?: string | null;
  },
) {
  const resolvedPassengerIds = new Set((input.passengerIds ?? []).filter(Boolean));
  const resolutionSummary: Array<{ entityType: TravelerRefInput["entityType"]; entityId: string; passengerId: string; mode: string }> = [];

  for (const ref of input.travelerRefs ?? []) {
    if (ref.entityType === "PASSENGER") {
      resolvedPassengerIds.add(ref.entityId);
      resolutionSummary.push({ entityType: ref.entityType, entityId: ref.entityId, passengerId: ref.entityId, mode: "direct" });
      continue;
    }

    if (ref.entityType === "USER") {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: ref.entityId },
        include: {
          passengerUserLinks: {
            include: { passenger: true },
            take: 1,
          },
        },
      });

      let passenger: Awaited<ReturnType<typeof findPassengerMatchByIdentity>> = user.passengerUserLinks[0]?.passenger ?? null;
      let mode = "linked";

      if (!passenger) {
        passenger = await findPassengerMatchByIdentity(tx, {
          email: user.email,
          phone: user.phone,
        });
        if (passenger) {
          await ensurePassengerUserLink(tx, {
            userId: user.id,
            passengerId: passenger.id,
          });
          mode = "matched";
        }
      }

      if (!passenger) {
        passenger = await createPassengerFromTraveler(tx, {
          sourceType: "USER",
          user,
          actorUserId: input.actorUserId,
        });
        await ensurePassengerUserLink(tx, {
          userId: user.id,
          passengerId: passenger.id,
        });
        mode = "created";
      }

      resolvedPassengerIds.add(passenger.id);
      resolutionSummary.push({ entityType: ref.entityType, entityId: ref.entityId, passengerId: passenger.id, mode });
      continue;
    }

    const driver = await tx.driver.findUniqueOrThrow({
      where: { id: ref.entityId },
    });

    let passenger = await findPassengerMatchByIdentity(tx, {
      phone: driver.phone,
    });
    let mode = passenger ? "matched" : "created";

    if (!passenger) {
      passenger = await createPassengerFromTraveler(tx, {
        sourceType: "DRIVER",
        driver,
        actorUserId: input.actorUserId,
      });
    }

    resolvedPassengerIds.add(passenger.id);
    resolutionSummary.push({ entityType: ref.entityType, entityId: ref.entityId, passengerId: passenger.id, mode });
  }

  return {
    passengerIds: Array.from(resolvedPassengerIds),
    resolutionSummary,
  };
}

async function syncPassengerUserLink(tx: Prisma.TransactionClient, input: { userId: string; email: string; phone?: string | null }) {
  const match = await findPassengerMatchByIdentity(tx, {
    email: input.email,
    phone: input.phone,
  });

  if (!match) {
    return;
  }

  await ensurePassengerUserLink(tx, {
    userId: input.userId,
    passengerId: match.id,
  });
}

type TripSegmentInput = {
  segmentOrder: number;
  airline: string;
  flightNumber: string;
  departureAirportId: string;
  arrivalAirportId: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  transportEntries?: TripTransportEntryInput[];
};

type TripTransportEntryInput = {
  taskType: TransportTaskType;
  driverIds?: string[];
  notes?: string | null;
  scheduledTimeLocal?: string | null;
};

type TripInput = {
  notes?: string | null;
  passengerIds: string[];
  travelerRefs?: TravelerRefInput[];
  createdByUserId?: string | null;
  booking?: {
    confirmationNumber?: string | null;
    totalCost?: number | null;
  } | null;
  accommodation?: {
    notes?: string | null;
  } | null;
  segments: TripSegmentInput[];
};

export async function linkTelegramAccount(chatId: string, rawInput: string, telegramUsername?: string | null) {
  const normalizedInput = rawInput.trim();
  const normalizedPhone = normalizePhone(normalizedInput);
  const [users, passengers, drivers] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { email: normalizedInput.toLowerCase() },
          normalizedPhone ? { phone: normalizedPhone } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
    }),
    normalizedPhone
      ? prisma.passenger.findMany({
          where: { phone: normalizedPhone },
        })
      : Promise.resolve([]),
    normalizedPhone
      ? prisma.driver.findMany({
          where: { phone: normalizedPhone },
        })
      : Promise.resolve([]),
  ]);

  const totalMatches = users.length + passengers.length + drivers.length;
  const canLinkAllMatches =
    totalMatches > 0 &&
    users.length <= 1 &&
    passengers.length <= 1 &&
    drivers.length <= 1;

  if (!canLinkAllMatches) {
    return {
      linked: false,
      ambiguous: totalMatches > 1,
      matchCount: totalMatches,
    };
  }

  const linkedRecords = await prisma.$transaction(async (tx) => {
    const linked: Array<{ entityType: "USER" | "PASSENGER" | "DRIVER"; displayName: string; role: UserRole | null }> = [];

    if (users[0]) {
      const current = await tx.user.findUniqueOrThrow({ where: { id: users[0].id } });
      const updatedUser = await tx.user.update({
        where: { id: users[0].id },
        data: {
          telegramChatId: chatId,
          telegramUsername: telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED",
        entityType: "User",
        entityId: users[0].id,
        actorUserId: users[0].id,
        source: AuditSource.BOT,
        oldValues: { telegramChatId: current.telegramChatId ?? null },
        newValues: { telegramChatId: chatId, telegramUsername: telegramUsername ?? null },
      });

      linked.push({
        entityType: "USER",
        displayName: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
        role: updatedUser.role,
      });
    }

    if (passengers[0]) {
      const current = await tx.passenger.findUniqueOrThrow({ where: { id: passengers[0].id } });
      const updatedPassenger = await tx.passenger.update({
        where: { id: passengers[0].id },
        data: {
          telegramChatId: chatId,
          telegramUsername: telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED",
        entityType: "Passenger",
        entityId: passengers[0].id,
        source: AuditSource.BOT,
        oldValues: { telegramChatId: current.telegramChatId ?? null },
        newValues: { telegramChatId: chatId, telegramUsername: telegramUsername ?? null },
      });

      linked.push({
        entityType: "PASSENGER",
        displayName: `${updatedPassenger.firstName} ${updatedPassenger.lastName}`.trim(),
        role: null,
      });
    }

    if (drivers[0]) {
      const current = await tx.driver.findUniqueOrThrow({ where: { id: drivers[0].id } });
      const updatedDriver = await tx.driver.update({
        where: { id: drivers[0].id },
        data: {
          telegramChatId: chatId,
          telegramUsername: telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED",
        entityType: "Driver",
        entityId: drivers[0].id,
        source: AuditSource.BOT,
        oldValues: { telegramChatId: current.telegramChatId ?? null },
        newValues: { telegramChatId: chatId, telegramUsername: telegramUsername ?? null },
      });

      linked.push({
        entityType: "DRIVER",
        displayName: updatedDriver.name,
        role: null,
      });
    }

    return linked;
  });

  return {
    linked: true,
    ambiguous: false,
    matchCount: linkedRecords.length,
    linkedEntities: linkedRecords,
    entityType: linkedRecords[0]?.entityType ?? "USER",
    displayName: linkedRecords[0]?.displayName ?? "your record",
    role: linkedRecords[0]?.role ?? null,
  };
}

export async function linkTelegramEntity(input: {
  entityType: "USER" | "PASSENGER" | "DRIVER";
  entityId: string;
  chatId: string;
  telegramUsername?: string | null;
  actorUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    if (input.entityType === "USER") {
      const current = await tx.user.findUniqueOrThrow({ where: { id: input.entityId } });
      const updated = await tx.user.update({
        where: { id: input.entityId },
        data: {
          telegramChatId: input.chatId,
          telegramUsername: input.telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED_MANUALLY",
        entityType: "User",
        entityId: input.entityId,
        actorUserId: input.actorUserId ?? null,
        source: AuditSource.WEB,
        oldValues: { telegramChatId: current.telegramChatId ?? null },
        newValues: { telegramChatId: input.chatId, telegramUsername: input.telegramUsername ?? null },
      });

      return updated;
    }

    if (input.entityType === "PASSENGER") {
      const current = await tx.passenger.findUniqueOrThrow({ where: { id: input.entityId } });
      const updated = await tx.passenger.update({
        where: { id: input.entityId },
        data: {
          telegramChatId: input.chatId,
          telegramUsername: input.telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED_MANUALLY",
        entityType: "Passenger",
        entityId: input.entityId,
        actorUserId: input.actorUserId ?? null,
        source: AuditSource.WEB,
        oldValues: { telegramChatId: current.telegramChatId ?? null },
        newValues: { telegramChatId: input.chatId, telegramUsername: input.telegramUsername ?? null },
      });

      return updated;
    }

    const current = await tx.driver.findUniqueOrThrow({ where: { id: input.entityId } });
    const updated = await tx.driver.update({
      where: { id: input.entityId },
      data: {
        telegramChatId: input.chatId,
        telegramUsername: input.telegramUsername ?? null,
      },
    });

    await createAuditLog(tx, {
      action: "TELEGRAM_ACCOUNT_LINKED_MANUALLY",
      entityType: "Driver",
      entityId: input.entityId,
      actorUserId: input.actorUserId ?? null,
      source: AuditSource.WEB,
      oldValues: { telegramChatId: current.telegramChatId ?? null },
      newValues: { telegramChatId: input.chatId, telegramUsername: input.telegramUsername ?? null },
    });

    return updated;
  });
}

export async function exportTrips() {
  return prisma.itinerary.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      itineraryPassengers: { include: { passenger: true } },
      flightSegments: { orderBy: { segmentOrder: "asc" }, include: { departureAirport: true, arrivalAirport: true } },
      booking: true,
      accommodations: { include: { mandir: true } },
      transportTasks: { include: { airport: true, mandir: true, drivers: { include: { driver: true } } } },
    },
  });
}

export async function exportPassengers() {
  return prisma.passenger.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      itineraryPassengers: { include: { itinerary: true } },
    },
  });
}

export async function exportDrivers() {
  return prisma.driver.findMany({
    orderBy: { name: "asc" },
    include: {
      driverAirports: { include: { airport: true } },
      transportTaskDrivers: { include: { transportTask: true } },
    },
  });
}

export async function exportUsers() {
  return prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      adminAirports: { include: { airport: true } },
      coordinatorAirports: { include: { airport: true } },
    },
  });
}

const SYSTEM_REMINDER_WORKFLOWS = [
  {
    id: "flight-change",
    name: "Flight added / changed / cancelled",
    audience: "Scoped admins and coordinators",
    channel: "Telegram",
    schedule: "Immediate event notification",
  },
  {
    id: "transport-change",
    name: "Pickup / dropoff assigned / changed / cancelled",
    audience: "Scoped staff, passengers, and assigned drivers",
    channel: "Telegram + SMS",
    schedule: "Immediate event notification",
  },
  {
    id: "flight-48h",
    name: "48 hours before departure",
    audience: "Scoped staff, passengers, and relevant drivers",
    channel: "Telegram + SMS",
    schedule: "Scheduled",
  },
  {
    id: "dropoff-6h",
    name: "6 hours before departure",
    audience: "Dropoff drivers",
    channel: "SMS",
    schedule: "Scheduled",
  },
  {
    id: "pickup-6h",
    name: "6 hours before arrival",
    audience: "Pickup drivers",
    channel: "SMS",
    schedule: "Scheduled",
  },
] as const;

export function listSystemReminderWorkflows() {
  return SYSTEM_REMINDER_WORKFLOWS;
}

async function createQueuedNotification(
  tx: Prisma.TransactionClient,
  input: {
    notificationType: NotificationType;
    deliveryChannel: NotificationChannel;
    recipientUserId?: string | null;
    recipientPassengerId?: string | null;
    recipientDriverId?: string | null;
    recipientChatId?: string | null;
    recipientPhone?: string | null;
    payload: Prisma.InputJsonValue;
    dedupeKey?: string | null;
    providerName?: string | null;
  },
) {
  if (input.deliveryChannel === NotificationChannel.TELEGRAM && !input.recipientChatId) {
    return null;
  }

  const normalizedPhone = normalizeOptionalPhone(input.recipientPhone);
  if (input.deliveryChannel === NotificationChannel.SMS && !normalizedPhone) {
    return null;
  }

  if (input.dedupeKey) {
    const existing = await tx.notificationLog.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });

    if (existing) {
      return null;
    }
  }

  return tx.notificationLog.create({
    data: {
      notificationType: input.notificationType,
      deliveryChannel: input.deliveryChannel,
      recipientUserId: input.recipientUserId ?? null,
      recipientPassengerId: input.recipientPassengerId ?? null,
      recipientDriverId: input.recipientDriverId ?? null,
      recipientChatId: input.recipientChatId ?? null,
      recipientPhone: normalizedPhone,
      providerName: input.providerName ?? (input.deliveryChannel === NotificationChannel.SMS ? "twilio" : "telegram"),
      dedupeKey: input.dedupeKey ?? null,
      payload: input.payload,
      status: NotificationStatus.QUEUED,
    },
  });
}

async function listScopedUsersForAirports(
  tx: Prisma.TransactionClient,
  role: "ADMIN" | "COORDINATOR",
  airportIds: string[],
) {
  if (airportIds.length === 0) {
    return [];
  }

  return tx.user.findMany({
    where: role === UserRole.ADMIN
      ? {
          role: UserRole.ADMIN,
          isActive: true,
          telegramChatId: { not: null },
          adminAirports: {
            some: {
              airportId: {
                in: airportIds,
              },
            },
          },
        }
      : {
          role: UserRole.COORDINATOR,
          isActive: true,
          telegramChatId: { not: null },
          coordinatorAirports: {
            some: {
              airportId: {
                in: airportIds,
              },
            },
          },
        },
    include: {
      adminAirports: { include: { airport: true } },
      coordinatorAirports: { include: { airport: true } },
    },
  });
}

function buildFlightSummaryText(input: {
  changeLabel: string;
  route: string;
  flightNumbers: string[];
  passengers: Array<{ name: string; phone?: string | null }>;
  drivers: Array<{ name: string; taskType?: string | null }>;
  accommodation?: string | null;
}) {
  const passengerDetails = input.passengers
    .map((passenger) => `${passenger.name}${passenger.phone ? ` (${passenger.phone})` : ""}`)
    .join(", ");
  const driverDetails = input.drivers.map((driver) => driver.taskType ? `${driver.name} (${driver.taskType})` : driver.name).join(", ");

  return [
    `${input.changeLabel}`,
    `Route: ${input.route}`,
    `Flights: ${input.flightNumbers.join(", ") || "Not set"}`,
    passengerDetails ? `Passengers: ${passengerDetails}` : null,
    driverDetails ? `Drivers: ${driverDetails}` : null,
    input.accommodation ? `Accommodation: ${input.accommodation}` : null,
  ].filter(Boolean).join("\n");
}

function buildTransportSummaryText(input: {
  changeLabel: string;
  taskType: string;
  airportCode: string;
  scheduledTime?: Date | null;
  passengers: Array<{ name: string; phone?: string | null }>;
  drivers: Array<{ name: string; phone?: string | null }>;
}) {
  const scheduled =
    input.scheduledTime
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(input.scheduledTime)
      : "Not scheduled";

  return [
    `${input.changeLabel}`,
    `${input.taskType} at ${input.airportCode}`,
    `Scheduled: ${scheduled}`,
    `Passengers: ${input.passengers.map((passenger) => `${passenger.name}${passenger.phone ? ` (${passenger.phone})` : ""}`).join(", ") || "None"}`,
    `Drivers: ${input.drivers.map((driver) => `${driver.name}${driver.phone ? ` (${driver.phone})` : ""}`).join(", ") || "None"}`,
  ].join("\n");
}

async function queueFlightChangeNotifications(
  tx: Prisma.TransactionClient,
  input: {
    itinerary: Awaited<ReturnType<typeof findTripDetailOrThrow>>;
    changeLabel: string;
  },
) {
  const airportIds = Array.from(
    new Set(
      input.itinerary.flightSegments.flatMap((segment) => [segment.departureAirportId, segment.arrivalAirportId]),
    ),
  );
  const [admins, coordinators] = await Promise.all([
    listScopedUsersForAirports(tx, UserRole.ADMIN, airportIds),
    listScopedUsersForAirports(tx, UserRole.COORDINATOR, airportIds),
  ]);

  const route = input.itinerary.flightSegments.map((segment) => `${segment.departureAirport.code} -> ${segment.arrivalAirport.code}`).join(" · ");
  const flightNumbers = input.itinerary.flightSegments.map((segment) => segment.flightNumber);
  const passengers = input.itinerary.itineraryPassengers.map((item) => ({
    name: `${item.passenger.firstName} ${item.passenger.lastName}`,
    phone: item.passenger.phone,
  }));
  const drivers = input.itinerary.transportTasks.flatMap((task) =>
    task.drivers.map((entry) => ({ name: entry.driver.name, taskType: task.taskType })),
  );
  const accommodation = input.itinerary.accommodations.map((item) => item.notes ?? item.mandir?.name).filter(Boolean).join(" · ") || null;
  const text = buildFlightSummaryText({
    changeLabel: input.changeLabel,
    route,
    flightNumbers,
    passengers,
    drivers,
    accommodation,
  });

  for (const user of [...admins, ...coordinators]) {
    await createQueuedNotification(tx, {
      notificationType: NotificationType.FLIGHT_REMINDER,
      deliveryChannel: NotificationChannel.TELEGRAM,
      recipientUserId: user.id,
      recipientChatId: user.telegramChatId,
      payload: { text },
    });
  }
}

async function queueTransportChangeNotifications(
  tx: Prisma.TransactionClient,
  input: {
    task: Prisma.TransportTaskGetPayload<{
      include: {
        airport: true;
        mandir: true;
        drivers: {
          include: {
            driver: true;
          };
        };
      };
    }>;
    passengers: Array<{ id: string; firstName: string; lastName: string; phone?: string | null }>;
    changeLabel: string;
  },
) {
  const [admins, coordinators] = await Promise.all([
    listScopedUsersForAirports(tx, UserRole.ADMIN, [input.task.airport.id]),
    listScopedUsersForAirports(tx, UserRole.COORDINATOR, [input.task.airport.id]),
  ]);
  const passengers = input.passengers.map((passenger) => ({
    name: `${passenger.firstName} ${passenger.lastName}`,
    phone: passenger.phone,
  }));
  const drivers = input.task.drivers.map((entry) => ({
    name: entry.driver.name,
    phone: entry.driver.phone,
  }));
  const text = buildTransportSummaryText({
    changeLabel: input.changeLabel,
    taskType: input.task.taskType,
    airportCode: input.task.airport.code,
    scheduledTime: input.task.scheduledTimeLocal,
    passengers,
    drivers,
  });

  for (const user of [...admins, ...coordinators]) {
    await createQueuedNotification(tx, {
      notificationType:
        input.changeLabel.includes("cancel") ? NotificationType.ASSIGNMENT_CANCELLED : NotificationType.ASSIGNMENT_CHANGED,
      deliveryChannel: NotificationChannel.TELEGRAM,
      recipientUserId: user.id,
      recipientChatId: user.telegramChatId,
      payload: { text, taskId: input.task.id },
    });
  }

  for (const passenger of input.passengers) {
    await createQueuedNotification(tx, {
      notificationType:
        input.changeLabel.includes("cancel") ? NotificationType.ASSIGNMENT_CANCELLED : NotificationType.ASSIGNMENT_CHANGED,
      deliveryChannel: NotificationChannel.SMS,
      recipientPassengerId: passenger.id,
      recipientPhone: passenger.phone,
      payload: { text },
    });
  }

  for (const entry of input.task.drivers) {
    await createQueuedNotification(tx, {
      notificationType:
        input.changeLabel.includes("cancel") ? NotificationType.ASSIGNMENT_CANCELLED : NotificationType.ASSIGNMENT_CHANGED,
      deliveryChannel: NotificationChannel.SMS,
      recipientDriverId: entry.driver.id,
      recipientPhone: entry.driver.phone,
      payload: { text },
    });
  }
}

async function getAssignedAirportIdsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      adminAirports: true,
      coordinatorAirports: true,
    },
  });

  if (!user) {
    return null;
  }

  const airportIds =
    user.role === UserRole.ADMIN
      ? user.adminAirports.map((assignment) => assignment.airportId)
      : user.role === UserRole.COORDINATOR
        ? user.coordinatorAirports.map((assignment) => assignment.airportId)
        : [];

  return {
    user,
    airportIds,
  };
}

export async function listUpcomingFlightsForUserChat(chatId: string, limit = 8) {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    include: {
      adminAirports: { include: { airport: true } },
      coordinatorAirports: { include: { airport: true } },
    },
  });

  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.COORDINATOR)) {
    return null;
  }

  const airportIds =
    user.role === UserRole.ADMIN
      ? user.adminAirports.map((assignment) => assignment.airportId)
      : user.coordinatorAirports.map((assignment) => assignment.airportId);

  if (airportIds.length === 0) {
    return { user, flights: [] };
  }

  const flights = await prisma.flightSegment.findMany({
    where: {
      itinerary: { isArchived: false },
      departureTimeUtc: { gte: new Date() },
      OR: [
        { departureAirportId: { in: airportIds } },
        { arrivalAirportId: { in: airportIds } },
      ],
    },
    orderBy: { departureTimeUtc: "asc" },
    take: limit,
    include: {
      departureAirport: true,
      arrivalAirport: true,
      itinerary: {
        include: {
          itineraryPassengers: { include: { passenger: true } },
          transportTasks: { include: { drivers: { include: { driver: true } }, airport: true } },
        },
      },
    },
  });

  return { user, flights };
}

export async function listReminderRules() {
  return prisma.reminderRule.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      createdByUser: true,
      runs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
}

export async function createReminderRule(input: {
  name: string;
  trigger: ReminderTrigger;
  audience: ReminderAudience;
  channel: ReminderChannel;
  offsetMinutes?: number;
  template: string;
  createdByUserId: string;
}) {
  return prisma.reminderRule.create({
    data: {
      name: input.name,
      trigger: input.trigger,
      audience: input.audience,
      channel: input.channel,
      offsetMinutes: input.offsetMinutes ?? 0,
      template: input.template,
      createdByUserId: input.createdByUserId,
    },
  });
}

export async function updateReminderRule(
  id: string,
  input: {
    name?: string;
    isActive?: boolean;
    trigger?: ReminderTrigger;
    audience?: ReminderAudience;
    channel?: ReminderChannel;
    offsetMinutes?: number;
    template?: string;
  },
) {
  return prisma.reminderRule.update({
    where: { id },
    data: input,
  });
}

function renderReminderTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

async function queueReminderRun(
  tx: Prisma.TransactionClient,
  input: {
    ruleId: string;
    entityType: string;
    entityId: string;
    deliveryChannel: NotificationChannel;
    recipientChatId?: string | null;
    recipientPhone?: string | null;
    recipientPassengerId?: string | null;
    recipientDriverId?: string | null;
    recipientUserId?: string | null;
    scheduledFor: Date;
    payload: Prisma.InputJsonValue;
  },
) {
  const existing = await tx.reminderRun.findFirst({
    where: {
      reminderRuleId: input.ruleId,
      entityType: input.entityType,
      entityId: input.entityId,
      scheduledFor: input.scheduledFor,
    },
    select: { id: true },
  });

  if (existing) {
    return null;
  }

  const notification = await createQueuedNotification(tx, {
    notificationType: NotificationType.RULE_REMINDER,
    deliveryChannel: input.deliveryChannel,
    recipientUserId: input.recipientUserId ?? null,
    recipientPassengerId: input.recipientPassengerId ?? null,
    recipientDriverId: input.recipientDriverId ?? null,
    recipientChatId: input.recipientChatId ?? null,
    recipientPhone: input.recipientPhone ?? null,
    payload: input.payload,
    dedupeKey: `rule:${input.ruleId}:${input.entityType}:${input.entityId}:${input.scheduledFor.toISOString()}:${input.deliveryChannel}:${input.recipientUserId ?? input.recipientPassengerId ?? input.recipientDriverId ?? input.recipientChatId ?? input.recipientPhone ?? "unknown"}`,
  });

  if (!notification) {
    return null;
  }

  return tx.reminderRun.create({
    data: {
      reminderRuleId: input.ruleId,
      entityType: input.entityType,
      entityId: input.entityId,
      recipientChatId: input.recipientChatId ?? null,
      notificationLogId: notification.id,
      scheduledFor: input.scheduledFor,
      status: ReminderRunStatus.QUEUED,
    },
  });
}

export async function evaluateReminderRules() {
  const now = new Date();
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true },
  });

  for (const rule of rules) {
    try {
      await prisma.$transaction(async (tx) => {
        if (rule.trigger === ReminderTrigger.FLIGHT_DEPARTURE && rule.audience === ReminderAudience.PASSENGER) {
          const windowStart = new Date(now.getTime() + rule.offsetMinutes * 60 * 1000);
          const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);

          const segments = await tx.flightSegment.findMany({
            where: {
              departureTimeUtc: {
                gte: windowStart,
                lte: windowEnd,
              },
            },
            include: {
              itinerary: {
                include: {
                  itineraryPassengers: {
                    include: {
                      passenger: {
                        include: {
                          userLinks: {
                            include: { user: true },
                            take: 1,
                          },
                        },
                      },
                    },
                  },
                },
              },
              departureAirport: true,
              arrivalAirport: true,
            },
          });

          for (const segment of segments) {
            for (const item of segment.itinerary.itineraryPassengers) {
              const recipientChatId =
                rule.channel === ReminderChannel.TELEGRAM
                  ? item.passenger.telegramChatId ?? item.passenger.userLinks[0]?.user.telegramChatId ?? null
                  : null;
              const recipientPhone =
                rule.channel === ReminderChannel.SMS
                  ? item.passenger.phone ?? item.passenger.userLinks[0]?.user.phone ?? null
                  : null;

              if (!recipientChatId && !recipientPhone) {
                continue;
              }

              await queueReminderRun(tx, {
                ruleId: rule.id,
                entityType: "FlightSegment",
                entityId: `${segment.id}:${item.passenger.id}`,
                deliveryChannel: rule.channel === ReminderChannel.SMS ? NotificationChannel.SMS : NotificationChannel.TELEGRAM,
                recipientPassengerId: item.passenger.id,
                recipientChatId,
                recipientPhone,
                scheduledFor: segment.departureTimeUtc,
                payload: {
                  text: renderReminderTemplate(rule.template, {
                    passenger_name: `${item.passenger.firstName} ${item.passenger.lastName}`,
                    flight_number: segment.flightNumber,
                    departure_airport: segment.departureAirport.code,
                    arrival_airport: segment.arrivalAirport.code,
                  }),
                },
              });
            }
          }
        }

        if (rule.trigger === ReminderTrigger.PICKUP_SCHEDULED && rule.audience === ReminderAudience.DRIVER) {
          const windowStart = new Date(now.getTime() + rule.offsetMinutes * 60 * 1000);
          const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);

          const tasks = await tx.transportTask.findMany({
            where: {
              scheduledTimeUtc: {
                gte: windowStart,
                lte: windowEnd,
              },
            },
            include: {
              airport: true,
              mandir: true,
              drivers: {
                include: { driver: true },
              },
            },
          });

          for (const task of tasks) {
            for (const assignment of task.drivers) {
              const recipientChatId =
                rule.channel === ReminderChannel.TELEGRAM ? assignment.driver.telegramChatId : null;
              const recipientPhone =
                rule.channel === ReminderChannel.SMS ? assignment.driver.phone : null;

              if (!recipientChatId && !recipientPhone) {
                continue;
              }

              await queueReminderRun(tx, {
                ruleId: rule.id,
                entityType: "TransportTask",
                entityId: `${task.id}:${assignment.driver.id}`,
                deliveryChannel: rule.channel === ReminderChannel.SMS ? NotificationChannel.SMS : NotificationChannel.TELEGRAM,
                recipientDriverId: assignment.driver.id,
                recipientChatId,
                recipientPhone,
                scheduledFor: task.scheduledTimeUtc ?? now,
                payload: {
                  text: renderReminderTemplate(rule.template, {
                    driver_name: assignment.driver.name,
                    airport_code: task.airport.code,
                    mandir_name: task.mandir?.name ?? "destination",
                    task_type: task.taskType,
                  }),
                },
              });
            }
          }
        }

        await tx.reminderRule.update({
          where: { id: rule.id },
          data: {
            lastRunAt: now,
            lastError: null,
          },
        });
      });
    } catch (error) {
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: {
          lastRunAt: now,
          lastError: error instanceof Error ? error.message : "Unknown reminder error",
        },
      });
    }
  }
}

async function queueBuiltInScheduledNotifications() {
  const now = new Date();
  const windows = {
    departure48hStart: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    departure48hEnd: new Date(now.getTime() + (48 * 60 * 60 + 15 * 60) * 1000),
    departure6hStart: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    departure6hEnd: new Date(now.getTime() + (6 * 60 * 60 + 15 * 60) * 1000),
  };

  await prisma.$transaction(async (tx) => {
    const segments48h = await tx.flightSegment.findMany({
      where: {
        itinerary: { isArchived: false },
        departureTimeUtc: {
          gte: windows.departure48hStart,
          lte: windows.departure48hEnd,
        },
      },
      include: {
        departureAirport: true,
        arrivalAirport: true,
        itinerary: {
          include: {
            itineraryPassengers: {
              include: {
                passenger: {
                  include: {
                    userLinks: {
                      include: {
                        user: {
                          select: {
                            phone: true,
                          },
                        },
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
            accommodations: { include: { mandir: true } },
            transportTasks: { include: { drivers: { include: { driver: true } } } },
          },
        },
      },
    });

    for (const segment of segments48h) {
      const [admins, coordinators] = await Promise.all([
        listScopedUsersForAirports(tx, UserRole.ADMIN, [segment.departureAirportId]),
        listScopedUsersForAirports(tx, UserRole.COORDINATOR, [segment.departureAirportId]),
      ]);

      const passengerRows = segment.itinerary.itineraryPassengers.map((item) => ({
        name: `${item.passenger.firstName} ${item.passenger.lastName}`,
        phone: item.passenger.phone,
      }));
      const driverRows = segment.itinerary.transportTasks.flatMap((task) =>
        task.drivers.map((entry) => ({ name: entry.driver.name, taskType: task.taskType })),
      );
      const accommodation =
        segment.itinerary.accommodations.map((item) => item.notes ?? item.mandir?.name).filter(Boolean).join(" · ") || null;
      const text = buildFlightSummaryText({
        changeLabel: "48 hour flight reminder",
        route: `${segment.departureAirport.code} -> ${segment.arrivalAirport.code}`,
        flightNumbers: [segment.flightNumber],
        passengers: passengerRows,
        drivers: driverRows,
        accommodation,
      });

      for (const user of [...admins, ...coordinators]) {
        await createQueuedNotification(tx, {
          notificationType: NotificationType.REMINDER_24H,
          deliveryChannel: NotificationChannel.TELEGRAM,
          recipientUserId: user.id,
          recipientChatId: user.telegramChatId,
          dedupeKey: `builtin:48h:telegram:${segment.id}:${user.id}`,
          payload: { text },
        });
      }

      for (const item of segment.itinerary.itineraryPassengers) {
        await createQueuedNotification(tx, {
          notificationType: NotificationType.REMINDER_24H,
          deliveryChannel: NotificationChannel.SMS,
          recipientPassengerId: item.passenger.id,
          recipientPhone: item.passenger.phone ?? item.passenger.userLinks[0]?.user.phone ?? null,
          dedupeKey: `builtin:48h:sms:passenger:${segment.id}:${item.passenger.id}`,
          payload: { text },
        });
      }

      for (const task of segment.itinerary.transportTasks) {
        for (const entry of task.drivers) {
          await createQueuedNotification(tx, {
            notificationType: NotificationType.REMINDER_24H,
            deliveryChannel: NotificationChannel.SMS,
            recipientDriverId: entry.driver.id,
            recipientPhone: entry.driver.phone,
            dedupeKey: `builtin:48h:sms:driver:${segment.id}:${entry.driver.id}`,
            payload: { text },
          });
        }
      }
    }

    const dropoffTasks = await tx.transportTask.findMany({
      where: {
        itinerary: { isArchived: false },
        taskType: TransportTaskType.DROPOFF,
        flightSegment: {
          departureTimeUtc: {
            gte: windows.departure6hStart,
            lte: windows.departure6hEnd,
          },
        },
      },
      include: {
        airport: true,
        flightSegment: { include: { departureAirport: true, arrivalAirport: true } },
        itinerary: { include: { itineraryPassengers: { include: { passenger: true } } } },
        drivers: { include: { driver: true } },
      },
    });

    for (const task of dropoffTasks) {
      const text = buildTransportSummaryText({
        changeLabel: "6 hour dropoff reminder",
        taskType: task.taskType,
        airportCode: task.airport.code,
        scheduledTime: task.scheduledTimeLocal,
        passengers: task.itinerary.itineraryPassengers.map((item) => ({
          name: `${item.passenger.firstName} ${item.passenger.lastName}`,
          phone: item.passenger.phone,
        })),
        drivers: task.drivers.map((entry) => ({ name: entry.driver.name, phone: entry.driver.phone })),
      });

      for (const entry of task.drivers) {
        await createQueuedNotification(tx, {
          notificationType: NotificationType.REMINDER_2H,
          deliveryChannel: NotificationChannel.SMS,
          recipientDriverId: entry.driver.id,
          recipientPhone: entry.driver.phone,
          dedupeKey: `builtin:6h:dropoff:${task.id}:${entry.driver.id}`,
          payload: { text },
        });
      }
    }

    const pickupTasks = await tx.transportTask.findMany({
      where: {
        itinerary: { isArchived: false },
        taskType: TransportTaskType.PICKUP,
        flightSegment: {
          arrivalTimeUtc: {
            gte: windows.departure6hStart,
            lte: windows.departure6hEnd,
          },
        },
      },
      include: {
        airport: true,
        itinerary: { include: { itineraryPassengers: { include: { passenger: true } } } },
        drivers: { include: { driver: true } },
      },
    });

    for (const task of pickupTasks) {
      const text = buildTransportSummaryText({
        changeLabel: "6 hour pickup reminder",
        taskType: task.taskType,
        airportCode: task.airport.code,
        scheduledTime: task.scheduledTimeLocal,
        passengers: task.itinerary.itineraryPassengers.map((item) => ({
          name: `${item.passenger.firstName} ${item.passenger.lastName}`,
          phone: item.passenger.phone,
        })),
        drivers: task.drivers.map((entry) => ({ name: entry.driver.name, phone: entry.driver.phone })),
      });

      for (const entry of task.drivers) {
        await createQueuedNotification(tx, {
          notificationType: NotificationType.REMINDER_2H,
          deliveryChannel: NotificationChannel.SMS,
          recipientDriverId: entry.driver.id,
          recipientPhone: entry.driver.phone,
          dedupeKey: `builtin:6h:pickup:${task.id}:${entry.driver.id}`,
          payload: { text },
        });
      }
    }
  });
}

export async function processNotificationSchedules() {
  await evaluateReminderRules();
  await queueBuiltInScheduledNotifications();
}

export async function dispatchQueuedNotifications(limit = 10) {
  const notifications = await prisma.notificationLog.findMany({
    where: {
      status: NotificationStatus.QUEUED,
      deliveryChannel: NotificationChannel.TELEGRAM,
      recipientChatId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return notifications;
}

export async function dispatchQueuedSmsNotifications(limit = 10) {
  return prisma.notificationLog.findMany({
    where: {
      status: NotificationStatus.QUEUED,
      deliveryChannel: NotificationChannel.SMS,
      recipientPhone: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function markNotificationSent(id: string, providerMessageId?: string | null) {
  await prisma.$transaction(async (tx) => {
    await tx.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        providerMessageId: providerMessageId ?? undefined,
        attemptCount: { increment: 1 },
      },
    });

    await tx.reminderRun.updateMany({
      where: { notificationLogId: id },
      data: { status: ReminderRunStatus.SENT },
    });
  });
}

export async function markNotificationFailed(id: string, errorMessage: string, providerName?: string | null) {
  await prisma.$transaction(async (tx) => {
    await tx.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.FAILED,
        lastError: errorMessage,
        providerName: providerName ?? undefined,
        attemptCount: { increment: 1 },
      },
    });

    await tx.reminderRun.updateMany({
      where: { notificationLogId: id },
      data: {
        status: ReminderRunStatus.FAILED,
        errorMessage,
      },
    });
  });
}

export async function listUpcomingFlightSegments(limit = 30) {
  return prisma.flightSegment.findMany({
    where: {
      itinerary: { isArchived: false },
      // Temporarily show flights from the last 24 hours to debug timezone issues
      departureTimeUtc: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { departureTimeUtc: "asc" },
    take: limit,
    include: {
      departureAirport: true,
      arrivalAirport: true,
      itinerary: {
        include: {
          itineraryPassengers: { include: { passenger: true } },
        },
      },
    },
  });
}

export async function queueOneOffFlightReminder(input: {
  flightSegmentId: string;
  channel: "TELEGRAM" | "SMS" | "TELEGRAM_SMS";
  message?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const segment = await tx.flightSegment.findUnique({
      where: { id: input.flightSegmentId },
      include: {
        departureAirport: true,
        arrivalAirport: true,
        itinerary: {
          include: {
            itineraryPassengers: {
              include: {
                passenger: {
                  include: {
                    userLinks: {
                      include: { user: { select: { phone: true, telegramChatId: true } } },
                      take: 1,
                    },
                  },
                },
              },
            },
            accommodations: { include: { mandir: true } },
            transportTasks: { include: { drivers: { include: { driver: true } } } },
          },
        },
      },
    });

    if (!segment) {
      throw new Error("Flight segment not found.");
    }

    const passengerRows = segment.itinerary.itineraryPassengers.map((item) => ({
      name: `${item.passenger.firstName} ${item.passenger.lastName}`,
      phone: item.passenger.phone,
    }));
    const driverRows = segment.itinerary.transportTasks.flatMap((task) =>
      task.drivers.map((entry) => ({ name: entry.driver.name, taskType: task.taskType })),
    );
    const accommodation =
      segment.itinerary.accommodations
        .map((item) => item.notes ?? item.mandir?.name)
        .filter(Boolean)
        .join(" · ") || null;

    const text =
      input.message?.trim() ||
      buildFlightSummaryText({
        changeLabel: "Flight reminder",
        route: `${segment.departureAirport.code} → ${segment.arrivalAirport.code}`,
        flightNumbers: [segment.flightNumber],
        passengers: passengerRows,
        drivers: driverRows,
        accommodation,
      });

    // Minute-level bucket so re-sends after 1 minute are allowed
    const minuteBucket = Math.floor(Date.now() / 60_000);

    let queued = 0;

    for (const item of segment.itinerary.itineraryPassengers) {
      const passenger = item.passenger;

      if (input.channel === "TELEGRAM" || input.channel === "TELEGRAM_SMS") {
        const chatId =
          passenger.telegramChatId ?? passenger.userLinks[0]?.user.telegramChatId ?? null;
        const result = await createQueuedNotification(tx, {
          notificationType: NotificationType.FLIGHT_REMINDER,
          deliveryChannel: NotificationChannel.TELEGRAM,
          recipientPassengerId: passenger.id,
          recipientChatId: chatId,
          dedupeKey: `oneof:${segment.id}:telegram:${passenger.id}:${minuteBucket}`,
          payload: { text },
        });
        if (result) queued++;
      }

      if (input.channel === "SMS" || input.channel === "TELEGRAM_SMS") {
        const phone = passenger.phone ?? passenger.userLinks[0]?.user.phone ?? null;
        const result = await createQueuedNotification(tx, {
          notificationType: NotificationType.FLIGHT_REMINDER,
          deliveryChannel: NotificationChannel.SMS,
          recipientPassengerId: passenger.id,
          recipientPhone: phone,
          dedupeKey: `oneof:${segment.id}:sms:${passenger.id}:${minuteBucket}`,
          payload: { text },
        });
        if (result) queued++;
      }
    }

    return { queued };
  });
}
