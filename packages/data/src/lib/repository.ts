import { ApprovalStatus, AuditSource, Prisma, SubmissionStatus, TransportTaskStatus, UserRole } from "@prisma/client";

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
  notes?: string | null;
};

type PublicSubmissionPayload = {
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
      notes: input.notes ?? null,
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
      notes: typeof input.notes === "string" || input.notes === null ? input.notes : current.notes,
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
      notes: segment.notes ?? null,
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

export async function listPassengers(search?: string) {
  return prisma.passenger.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { legalName: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined,
    include: {
      itineraryPassengers: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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
    notes?: string | null;
  },
) {
  return prisma.passenger.update({
    where: { id },
    data: input,
  });
}

export async function listUsers(search?: string) {
  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function createUser(input: {
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
}) {
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    },
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
  },
) {
  return prisma.user.update({
    where: { id },
    data: input,
  });
}

export async function findAuthorizedUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function findAuthorizedUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
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
      phone: input.phone ?? null,
      passengerType: input.passengerType,
      notes: input.notes ?? null,
    },
  });
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

export async function listTransportTasks() {
  return prisma.transportTask.findMany({
    orderBy: [{ status: "asc" }, { scheduledTimeLocal: "asc" }],
    include: {
      airport: true,
      mandir: true,
      itinerary: { include: { itineraryPassengers: { include: { passenger: true } } } },
      flightSegment: true,
      drivers: { include: { driver: true } },
    },
  });
}

export async function listDrivers() {
  return prisma.driver.findMany({
    orderBy: { name: "asc" },
    include: {
      driverAirports: {
        include: { airport: true },
      },
    },
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
        await tx.itinerary.update({
          where: { id: approval.itineraryId },
          data: {
            notes: typeof proposedPayload.notes === "string" || proposedPayload.notes === null ? proposedPayload.notes : undefined,
          },
        });
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

    let itineraryId: string | null = null;

    if (input.status === SubmissionStatus.APPROVED) {
      const itinerary = await createItineraryFromSubmission(tx, {
        submissionId: input.id,
        normalizedPayload: (submission.normalizedPayload ?? submission.rawPayload) as PublicSubmissionPayload,
        reviewedByUserId: input.reviewedByUserId,
        notes: input.reviewNote ?? submission.notes ?? null,
      });

      itineraryId = itinerary.id;
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
      newValues: { status: input.status, itineraryId },
    });

    return reviewedSubmission;
  });
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function linkTelegramAccount(chatId: string, rawInput: string, telegramUsername?: string | null) {
  const normalizedInput = rawInput.trim();
  const normalizedPhone = normalizePhone(normalizedInput);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedInput.toLowerCase() },
        normalizedPhone ? { phone: normalizedPhone } : undefined,
      ].filter(Boolean) as Prisma.UserWhereInput[],
    },
  });

  if (user) {
    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          telegramChatId: chatId,
          telegramUsername: telegramUsername ?? null,
        },
      });

      await createAuditLog(tx, {
        action: "TELEGRAM_ACCOUNT_LINKED",
        entityType: "User",
        entityId: user.id,
        actorUserId: user.id,
        source: AuditSource.BOT,
        oldValues: { telegramChatId: user.telegramChatId ?? null },
        newValues: { telegramChatId: chatId, telegramUsername: telegramUsername ?? null },
      });

      return updatedUser;
    });

    return {
      linked: true,
      role: updated.role,
      displayName: `${updated.firstName} ${updated.lastName}`,
    };
  }

  return {
    linked: false,
  };
}
