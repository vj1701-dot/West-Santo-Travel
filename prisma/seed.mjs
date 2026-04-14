import {
  ApprovalStatus,
  PassengerType,
  PrismaClient,
  TransportTaskStatus,
  TransportTaskType,
  UserRole,
} from "@prisma/client";
import { localDateTimeStringToDate, zonedLocalDateTimeToUtc } from "@west-santo/core";

const prisma = new PrismaClient();

async function main() {
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

  const [lax, ord] = await Promise.all([
    prisma.airport.create({
      data: {
        code: "LAX",
        name: "Los Angeles International",
        city: "Los Angeles",
        state: "CA",
        country: "USA",
        timeZone: "America/Los_Angeles",
      },
    }),
    prisma.airport.create({
      data: {
        code: "ORD",
        name: "Chicago O'Hare",
        city: "Chicago",
        state: "IL",
        country: "USA",
        timeZone: "America/Chicago",
      },
    }),
  ]);

  const [laMandir, chicagoMandir] = await Promise.all([
    prisma.mandir.create({ data: { name: "LA Mandir", city: "Los Angeles" } }),
    prisma.mandir.create({ data: { name: "Chicago Mandir", city: "Chicago" } }),
  ]);

  await prisma.airportMandirMapping.createMany({
    data: [
      { airportId: lax.id, mandirId: laMandir.id, isDefault: true },
      { airportId: ord.id, mandirId: chicagoMandir.id, isDefault: true },
    ],
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@westsanto.org",
      phone: "5550001111",
      firstName: "Amit",
      lastName: "Patel",
      role: UserRole.ADMIN,
    },
  });

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
