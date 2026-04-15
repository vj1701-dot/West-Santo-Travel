import { evaluateReminderRules, prisma } from "@west-santo/data";

const tickMs = Number(process.env.SCHEDULER_TICK_MS ?? 60000);

async function processReminderScan() {
  const [upcomingTasks, unassignedTasks] = await Promise.all([
    prisma.transportTask.count({
      where: {
        status: { in: ["ASSIGNED", "UNASSIGNED"] },
        scheduledTimeUtc: {
          gte: new Date(),
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.transportTask.count({
      where: {
        status: "UNASSIGNED",
        scheduledTimeUtc: {
          gte: new Date(),
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  console.log(`[scheduler] upcoming_tasks=${upcomingTasks} unassigned_24h=${unassignedTasks}`);
  await evaluateReminderRules();
}

async function main() {
  console.log("[scheduler] service booting");
  await processReminderScan();
  setInterval(() => {
    void processReminderScan();
  }, tickMs);
}

main().catch((error) => {
  console.error("[scheduler] fatal", error);
  process.exit(1);
});
