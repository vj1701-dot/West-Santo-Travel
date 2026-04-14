import "server-only";

import {
  getDashboardSnapshot,
  getItineraryDetail,
  listApprovalRequests,
  listItineraries,
  listPassengers,
  listTransportTasks,
} from "@west-santo/data";

import type { Approval, Itinerary, OverviewData, Passenger, TransportTask } from "./types";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Not scheduled";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toneForStatus(status: string): "neutral" | "warning" | "success" {
  if (status === "PENDING" || status === "PENDING_APPROVAL" || status === "UNASSIGNED") {
    return "warning";
  }

  if (status === "APPROVED" || status === "ASSIGNED" || status === "CONFIRMED" || status === "COMPLETED") {
    return "success";
  }

  return "neutral";
}

export const dataAdapter = {
  async getOverview(): Promise<OverviewData> {
    const overview = await getDashboardSnapshot();

    return {
      metrics: overview.metrics.map((metric) => ({
        label: metric.label,
        value: String(metric.value),
        detail: "Live database snapshot",
      })),
      upcomingItineraries: overview.itineraries.map((itinerary) => ({
        id: itinerary.id,
        route: itinerary.primaryRoute,
        flightLabel: itinerary.status,
        departureDate: "Current pipeline",
        status: itinerary.status,
        statusTone: toneForStatus(itinerary.status),
        passengerSummary: itinerary.passengers,
        transportSummary: itinerary.notes ?? "No itinerary notes",
        mandir: "Mapped from transport tasks",
      })),
      queue: overview.transportTasks.slice(0, 3).map((task) => ({
        label: `${task.type} ${task.airport}`,
        value: task.status,
        detail: `${task.passengers} · Drivers: ${task.drivers}`,
      })),
    };
  },

  async listItineraries(): Promise<Itinerary[]> {
    const itineraries = await listItineraries();

    return itineraries.map((itinerary, index) => ({
      id: itinerary.id,
      code: `WRS-${String(index + 1).padStart(3, "0")}`,
      route:
        itinerary.flightSegments.map((segment) => `${segment.departureAirport.code} -> ${segment.arrivalAirport.code}`).join(", ") ||
        "No route assigned",
      flightLabel: itinerary.flightSegments.map((segment) => segment.flightNumber).join(", ") || "No segments",
      passengerCount: itinerary.itineraryPassengers.length,
      transportSummary:
        itinerary.transportTasks.length > 0
          ? `${itinerary.transportTasks.length} transport task(s)`
          : "No transport tasks",
      approvalState: itinerary.approvalRequests[0]?.status ?? "No approvals",
      status: itinerary.status,
      statusTone: toneForStatus(itinerary.status),
      segments: itinerary.flightSegments.map((segment) => ({
        id: segment.id,
        airline: segment.airline,
        flightNumber: segment.flightNumber,
        route: `${segment.departureAirport.code} -> ${segment.arrivalAirport.code}`,
        departureTime: formatDateTime(segment.departureTimeLocal),
        arrivalTime: formatDateTime(segment.arrivalTimeLocal),
        notes: segment.notes ?? "No segment notes",
      })),
    }));
  },

  async listTransportTasks(): Promise<TransportTask[]> {
    const tasks = await listTransportTasks();

    return tasks.map((task) => ({
      id: task.id,
      type: task.taskType,
      airport: task.airport.code,
      mandir: task.mandir?.name ?? "Unassigned",
      scheduledTime: formatDateTime(task.scheduledTimeLocal),
      drivers: task.drivers.map((driver) => driver.driver.name),
      status: task.status,
      statusTone: toneForStatus(task.status),
      notes: task.notes ?? "No operational notes",
    }));
  },

  async listApprovals(): Promise<Approval[]> {
    const approvals = await listApprovalRequests();

    return approvals.map((approval) => ({
      id: approval.id,
      title: `${approval.entityType} review`,
      subject: approval.itineraryId,
      requestedBy: `${approval.requestedByUser.firstName} ${approval.requestedByUser.lastName}`,
      requestedAt: formatDateTime(approval.requestedAt),
      impact: approval.reviewComment ?? "Pending review",
      status: approval.status,
      statusTone: toneForStatus(approval.status),
      deltas: [JSON.stringify(approval.proposedPayload)],
    }));
  },

  async listPassengers(): Promise<Passenger[]> {
    const passengers = await listPassengers();

    return passengers.map((passenger) => ({
      id: passenger.id,
      name: `${passenger.firstName} ${passenger.lastName}`,
      legalName: passenger.legalName ?? "Not provided",
      contact: passenger.email ?? passenger.phone ?? "No contact provided",
      telegram: passenger.telegramChatId ? `Linked chat_id ${passenger.telegramChatId}` : "Unlinked",
      passengerType: passenger.passengerType,
      itineraryCount: passenger.itineraryPassengers.length,
      notes: passenger.notes ?? "No passenger notes",
    }));
  },

  getItineraryDetail,
};
