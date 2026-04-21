import { listReminderRules, listSystemReminderWorkflows, listUpcomingFlightSegments } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ReminderRuleManager } from "@/components/reminder-rule-manager";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }

  const [rules, workflows, upcomingSegments] = await Promise.all([
    listReminderRules(),
    Promise.resolve(listSystemReminderWorkflows()),
    listUpcomingFlightSegments(),
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
      />
    </AppShell>
  );
}
