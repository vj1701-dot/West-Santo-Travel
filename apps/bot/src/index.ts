import { prisma } from "@west-santo/data";

const pollMs = Number(process.env.BOT_HEALTH_POLL_MS ?? 60000);

async function logSnapshot() {
  const [pendingApprovals, pendingSubmissions, queuedNotifications] = await Promise.all([
    prisma.approvalRequest.count({ where: { status: "PENDING" } }),
    prisma.publicSubmission.count({ where: { status: "PENDING" } }),
    prisma.notificationLog.count({ where: { status: "QUEUED" } }),
  ]);

  console.log(
    `[bot] snapshot approvals=${pendingApprovals} submissions=${pendingSubmissions} notifications=${queuedNotifications}`,
  );
}

async function main() {
  console.log("[bot] service booting");

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn("[bot] TELEGRAM_BOT_TOKEN is not set. Running in scaffold mode.");
  }

  await logSnapshot();
  setInterval(() => {
    void logSnapshot();
  }, pollMs);
}

main().catch((error) => {
  console.error("[bot] fatal", error);
  process.exit(1);
});
