import { listRecentNotificationLogs, listReminderRules, listSystemReminderWorkflows, listUpcomingFlightSegments } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ReminderRuleManager } from "@/components/reminder-rule-manager";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
const INVALID_SCOPE_AIRPORT_ID = "00000000-0000-0000-0000-000000000000";

export default async function RemindersPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }

  const coordinatorAirportIds =
    currentUser.role === "COORDINATOR"
      ? currentUser.coordinatorAirports.length > 0
        ? currentUser.coordinatorAirports.map((assignment) => assignment.airportId)
        : [INVALID_SCOPE_AIRPORT_ID]
      : undefined;
  const [rules, workflows, upcomingSegments, recentNotifications] = await Promise.all([
    listReminderRules(currentUser.role === "COORDINATOR" ? { createdByUserId: currentUser.id } : undefined),
    Promise.resolve(listSystemReminderWorkflows()),
    listUpcomingFlightSegments(30, { airportIds: coordinatorAirportIds }),
    listRecentNotificationLogs(50, { airportIds: coordinatorAirportIds }),
  ]);

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Reminders"
        title="Notifications and reminders"
        description="Built-in travel workflows run automatically. Advanced rules are available for extra cases."
      />
      <ReminderRuleManager
        workflows={workflows}
        rules={rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          isActive: rule.isActive,
          trigger: rule.trigger,
          audience: rule.audience,
          channel: rule.channel,
          offsetMinutes: rule.offsetMinutes,
          template: rule.template,
          lastRunAt: rule.lastRunAt?.toISOString() ?? null,
          lastError: rule.lastError,
        }))}
        upcomingFlights={upcomingSegments.map((s) => ({
          id: s.id,
          flightNumber: s.flightNumber,
          departureAirport: s.departureAirport.code,
          arrivalAirport: s.arrivalAirport.code,
          departureTimeLocal: s.departureTimeLocal.toISOString(),
          departureTimeZone: s.departureTimeZone,
          passengerCount: s.itinerary.itineraryPassengers.length,
        }))}
        recentNotifications={recentNotifications.map((item) => ({
          id: item.id,
          status: item.status,
          deliveryChannel: item.deliveryChannel,
          notificationType: item.notificationType,
          providerName: item.providerName,
          recipientPhone: item.recipientPhone,
          recipientLabel:
            item.recipientPassenger
              ? [item.recipientPassenger.firstName, item.recipientPassenger.lastName].filter(Boolean).join(" ")
              : item.recipientDriver?.name ??
                [item.recipientUser?.firstName, item.recipientUser?.lastName].filter(Boolean).join(" ").trim() ??
                item.recipientUser?.email ??
                null,
          attemptCount: item.attemptCount,
          lastError: item.lastError,
          createdAt: item.createdAt.toISOString(),
          sentAt: item.sentAt?.toISOString() ?? null,
        }))}
      />
    </AppShell>
  );
}
