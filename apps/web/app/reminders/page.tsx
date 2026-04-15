import { listReminderRules } from "@west-santo/data";
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

  const rules = await listReminderRules();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Reminders"
        title="Rule-based reminders"
        description="Create simple triggers and message templates without writing code."
      />
      <ReminderRuleManager
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
      />
    </AppShell>
  );
}
