import {
  dispatchQueuedSmsNotifications,
  markNotificationFailed,
  markNotificationSent,
  processNotificationSchedules,
  prisma,
} from "@west-santo/data";

const tickMs = Number(process.env.SCHEDULER_TICK_MS ?? 60000);
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
const twilioMmsMediaUrl = process.env.TWILIO_MMS_MEDIA_URL;
const twilioMessagingServiceSid = process.env.MESSAGING_SERVICE_SID;

async function sendTwilioMessage(to: string, body: string) {
  if (!twilioAccountSid || !twilioAuthToken) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }

  if (!twilioFromNumber && !twilioMessagingServiceSid) {
    throw new Error("Twilio sender is not configured. Set TWILIO_FROM_NUMBER or MESSAGING_SERVICE_SID.");
  }

  const payload = new URLSearchParams({
    To: to,
    Body: body,
  });

  if (twilioMessagingServiceSid) {
    payload.set("MessagingServiceSid", twilioMessagingServiceSid);
  } else if (twilioFromNumber) {
    payload.set("From", twilioFromNumber);
  }

  if (twilioMmsMediaUrl) {
    payload.set("MediaUrl", twilioMmsMediaUrl);
  } else if (body.length > 160) {
    payload.set("SendAsMms", "true");
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  const json = (await response.json()) as { message?: unknown; sid?: unknown };

  if (!response.ok) {
    throw new Error(typeof json.message === "string" ? json.message : "Twilio MMS request failed.");
  }

  return typeof json.sid === "string" ? json.sid : null;
}

async function processQueuedSms() {
  const notifications = await dispatchQueuedSmsNotifications(20);

  for (const notification of notifications) {
    const phone = notification.recipientPhone;
    const text =
      typeof (notification.payload as { text?: unknown })?.text === "string"
        ? String((notification.payload as { text?: string }).text)
        : "";

    if (!phone || !text) {
      await markNotificationFailed(notification.id, "Missing phone number or text payload", "twilio");
      continue;
    }

    try {
      const providerMessageId = await sendTwilioMessage(phone, text);
      await markNotificationSent(notification.id, providerMessageId);
    } catch (error) {
      await markNotificationFailed(notification.id, error instanceof Error ? error.message : "Failed to send SMS", "twilio");
    }
  }
}

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
  await processNotificationSchedules();
  await processQueuedSms();
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
