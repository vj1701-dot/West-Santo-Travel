import {
  ApprovalStatus,
  AuditSource,
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

import { formatPassengerNames, localDateTimeStringToDate, summarizeDashboard, zonedLocalDateTimeToUtc } from "@west-santo/core";

import { prisma } from "./prisma";

function toSummaryRole(role?: string | null): UserRole {
  if (role === "ADMIN" || role === "COORDINATOR" || role === "PASSENGER") {
    return role;
  }

  return UserRole.ADMIN;
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

export async function getDashboardSnapshot(role?: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const safeRole = toSummaryRole(role);

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
      passengerUserLinks: { include: { passenger: true } },
    },
  });
}

export async function findAuthorizedUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      passengerUserLinks: { include: { passenger: true } },
    },
  });
}

export async function syncUserIdentityOnLogin(input: {
  email: string;
  provider?: string | null;
  subject?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      return null;
    }

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        identityProvider: input.provider ?? user.identityProvider ?? "keycloak",
        identitySubject: input.subject ?? user.identitySubject,
        identityLinkedAt: user.identityLinkedAt ?? new Date(),
      },
      include: {
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

export async function listItineraries() {
  return prisma.itinerary.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      itineraryPassengers: { include: { passenger: true } },
      flightSegments: { orderBy: { segmentOrder: "asc" }, include: { departureAirport: true, arrivalAirport: true } },
      transportTasks: { include: { airport: true, mandir: true, drivers: { include: { driver: true } } } },
      booking: true,
      accommodations: { include: { mandir: true } },
      approvalRequests: { orderBy: { requestedAt: "desc" } },
    },
  });
}

export async function listPassengerItineraries(userId: string) {
  const link = await prisma.passengerUserLink.findFirst({
    where: { userId },
    select: { passengerId: true },
  });

  if (!link) {
    return [];
  }

  return prisma.itinerary.findMany({
    where: {
      itineraryPassengers: {
        some: {
          passengerId: link.passengerId,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      itineraryPassengers: { include: { passenger: true } },
      flightSegments: { orderBy: { segmentOrder: "asc" }, include: { departureAirport: true, arrivalAirport: true } },
      transportTasks: { include: { airport: true, mandir: true, drivers: { include: { driver: true } } } },
      booking: true,
      accommodations: { include: { mandir: true } },
      approvalRequests: { orderBy: { requestedAt: "desc" } },
    },
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
    },
  });
}

export async function createItinerary(input: { notes?: string | null; passengerIds: string[]; createdByUserId?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const itinerary = await tx.itinerary.create({
      data: {
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
        itineraryPassengers: {
          create: input.passengerIds.map((passengerId) => ({
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
        passengerIds: input.passengerIds,
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
    const itinerary = await tx.itinerary.create({
      data: {
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
        itineraryPassengers: {
          create: input.passengerIds.map((passengerId) => ({
            passengerId,
          })),
        },
      },
    });

    await syncTripRelations(tx, itinerary.id, input);

    await createAuditLog(tx, {
      action: "TRIP_CREATED",
      entityType: "Itinerary",
      entityId: itinerary.id,
      actorUserId: input.createdByUserId ?? null,
      newValues: {
        notes: input.notes ?? null,
        passengerIds: input.passengerIds,
        segmentCount: input.segments.length,
        booking: input.booking ?? null,
        accommodation: input.accommodation ?? null,
        transportEntries: input.segments.map((segment) => segment.transportEntries?.length ?? 0),
      },
    });

    return findTripDetailOrThrow(tx, itinerary.id);
  });
}

export async function updateItinerary(id: string, input: { notes?: string | null; status?: Prisma.ItineraryUpdateInput["status"] }) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.itinerary.findUnique({
      where: { id },
      select: { notes: true, status: true },
    });

    const updated = await tx.itinerary.update({
      where: { id },
      data: input,
    });

    await createAuditLog(tx, {
      action: "ITINERARY_UPDATED",
      entityType: "Itinerary",
      entityId: id,
      oldValues: current ?? undefined,
      newValues: {
        notes: updated.notes,
        status: updated.status,
      },
    });

    return updated;
  });
}

export async function updateTrip(id: string, input: TripInput & { status?: Prisma.ItineraryUpdateInput["status"] }) {
  return prisma.$transaction(async (tx) => {
    const current = await findTripDetailOrThrow(tx, id);

    await tx.itinerary.update({
      where: { id },
      data: {
        notes: input.notes ?? null,
        status: input.status,
      },
    });

    await syncTripRelations(tx, id, input);

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
        segmentCount: updated.flightSegments.length,
      },
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

    return tx.transportTask.findUnique({
      where: { id: input.taskId },
      include: {
        airport: true,
        mandir: true,
        drivers: { include: { driver: true } },
      },
    });
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
        };
        if (Array.isArray(tripPayload.passengerIds) && Array.isArray(tripPayload.segments)) {
          await tx.itinerary.update({
            where: { id: approval.itineraryId },
            data: {
              notes: tripPayload.notes ?? null,
              status: tripPayload.status,
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
      await tx.itinerary.update({
        where: { id: approval.itineraryId },
        data: {
          status: input.status === ApprovalStatus.APPROVED ? "CONFIRMED" : approval.itinerary.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
        },
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

async function syncPassengerUserLink(tx: Prisma.TransactionClient, input: { userId: string; email: string; phone?: string | null }) {
  const phone = normalizeOptionalPhone(input.phone);
  const matches = await tx.passenger.findMany({
    where: {
      OR: [
        { email: input.email.toLowerCase() },
        phone ? { phone } : undefined,
      ].filter(Boolean) as Prisma.PassengerWhereInput[],
    },
    select: { id: true },
    take: 2,
  });

  if (matches.length !== 1) {
    return;
  }

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
      passengerId: matches[0].id,
    },
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

  const matches = [
    ...users.map((user) => ({ entityType: "User" as const, entityId: user.id })),
    ...passengers.map((passenger) => ({ entityType: "Passenger" as const, entityId: passenger.id })),
    ...drivers.map((driver) => ({ entityType: "Driver" as const, entityId: driver.id })),
  ];

  if (matches.length !== 1) {
    return {
      linked: false,
      ambiguous: matches.length > 1,
      matchCount: matches.length,
    };
  }

  const match = matches[0];

  const linkedRecord = await prisma.$transaction(async (tx) => {
    if (match.entityType === "User") {
      const current = await tx.user.findUniqueOrThrow({ where: { id: match.entityId } });
      const updatedUser = await tx.user.update({
        where: { id: match.entityId },
        data: {
          telegramChatId: chatId,
          telegramUsername: telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED",
        entityType: "User",
        entityId: match.entityId,
        actorUserId: match.entityId,
        source: AuditSource.BOT,
        oldValues: { telegramChatId: current.telegramChatId ?? null },
        newValues: { telegramChatId: chatId, telegramUsername: telegramUsername ?? null },
      });

      return {
        entityType: "USER",
        displayName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        role: updatedUser.role,
      };
    }

    if (match.entityType === "Passenger") {
      const current = await tx.passenger.findUniqueOrThrow({ where: { id: match.entityId } });
      const updatedPassenger = await tx.passenger.update({
        where: { id: match.entityId },
        data: {
          telegramChatId: chatId,
          telegramUsername: telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED",
        entityType: "Passenger",
        entityId: match.entityId,
        source: AuditSource.BOT,
        oldValues: { telegramChatId: current.telegramChatId ?? null },
        newValues: { telegramChatId: chatId, telegramUsername: telegramUsername ?? null },
      });

      return {
        entityType: "PASSENGER",
        displayName: `${updatedPassenger.firstName} ${updatedPassenger.lastName}`,
        role: null,
      };
    }

    const current = await tx.driver.findUniqueOrThrow({ where: { id: match.entityId } });
    const updatedDriver = await tx.driver.update({
      where: { id: match.entityId },
      data: {
        telegramChatId: chatId,
        telegramUsername: telegramUsername ?? null,
      },
    });

    await createAuditLog(tx, {
      action: "TELEGRAM_ACCOUNT_LINKED",
      entityType: "Driver",
      entityId: match.entityId,
      source: AuditSource.BOT,
      oldValues: { telegramChatId: current.telegramChatId ?? null },
      newValues: { telegramChatId: chatId, telegramUsername: telegramUsername ?? null },
    });

    return {
      entityType: "DRIVER",
      displayName: updatedDriver.name,
      role: null,
    };
  });

  return {
    linked: true,
    ambiguous: false,
    matchCount: 1,
    ...linkedRecord,
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
    recipientChatId?: string | null;
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

  const notification = await tx.notificationLog.create({
    data: {
      notificationType: NotificationType.RULE_REMINDER,
      recipientChatId: input.recipientChatId ?? null,
      payload: input.payload,
      status: NotificationStatus.QUEUED,
    },
  });

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
                      passenger: true,
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
              if (!item.passenger.telegramChatId) {
                continue;
              }

              await queueReminderRun(tx, {
                ruleId: rule.id,
                entityType: "FlightSegment",
                entityId: `${segment.id}:${item.passenger.id}`,
                recipientChatId: item.passenger.telegramChatId,
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
              if (!assignment.driver.telegramChatId) {
                continue;
              }

              await queueReminderRun(tx, {
                ruleId: rule.id,
                entityType: "TransportTask",
                entityId: `${task.id}:${assignment.driver.id}`,
                recipientChatId: assignment.driver.telegramChatId,
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

export async function dispatchQueuedNotifications(limit = 10) {
  const notifications = await prisma.notificationLog.findMany({
    where: {
      status: NotificationStatus.QUEUED,
      recipientChatId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return notifications;
}

export async function markNotificationSent(id: string) {
  await prisma.$transaction(async (tx) => {
    await tx.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    await tx.reminderRun.updateMany({
      where: { notificationLogId: id },
      data: { status: ReminderRunStatus.SENT },
    });
  });
}

export async function markNotificationFailed(id: string, errorMessage: string) {
  await prisma.$transaction(async (tx) => {
    await tx.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.FAILED,
        lastError: errorMessage,
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
