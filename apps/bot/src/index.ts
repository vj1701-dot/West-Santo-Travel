import {
  dispatchQueuedNotifications,
  linkTelegramAccount,
  markNotificationFailed,
  markNotificationSent,
  prisma,
} from "@west-santo/data";

const pollMs = Number(process.env.BOT_HEALTH_POLL_MS ?? 60000);
const token = process.env.TELEGRAM_BOT_TOKEN;

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    contact?: {
      phone_number: string;
    };
    chat: {
      id: number;
    };
    from?: {
      username?: string;
    };
  };
};

async function telegram<T>(method: string, body?: Record<string, unknown>) {
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Telegram API ${method} failed with status ${response.status}`);
  }

  return (await response.json()) as { ok: boolean; result: T };
}

async function sendMessage(chatId: number, text: string, includeContactButton = false) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: includeContactButton
      ? {
          keyboard: [[{ text: "Share phone number", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      : {
          remove_keyboard: true,
        },
  });
}

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

async function processQueuedNotifications() {
  const notifications = await dispatchQueuedNotifications(10);

  for (const notification of notifications) {
    const chatId = notification.recipientChatId;
    const text = typeof (notification.payload as { text?: unknown })?.text === "string"
      ? String((notification.payload as { text?: string }).text)
      : "";

    if (!chatId || !text) {
      await markNotificationFailed(notification.id, "Missing chat id or text payload");
      continue;
    }

    try {
      await sendMessage(Number(chatId), text);
      await markNotificationSent(notification.id);
    } catch (error) {
      await markNotificationFailed(notification.id, error instanceof Error ? error.message : "Failed to send notification");
    }
  }
}

async function handleMessage(update: TelegramUpdate) {
  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const telegramUsername = message.from?.username ?? null;
  const text = message.text?.trim() ?? "";

  if (text === "/start") {
    await sendMessage(
      message.chat.id,
      "Send your phone number or share your contact so I can match it with your passenger, driver, or user record.",
      true,
    );
    return;
  }

  const rawInput = message.contact?.phone_number ?? text;
  if (!rawInput) {
    await sendMessage(message.chat.id, "Send a phone number or use the contact-share button.");
    return;
  }

  const result = await linkTelegramAccount(chatId, rawInput, telegramUsername);

  if (result.linked) {
    const displayName = "displayName" in result ? result.displayName : "your record";
    await sendMessage(message.chat.id, `Linked to ${displayName}.`);
    return;
  }

  if (result.ambiguous) {
    await sendMessage(
      message.chat.id,
      "More than one record matched that phone number. An admin or coordinator needs to link this chat manually.",
    );
    return;
  }

  await sendMessage(
    message.chat.id,
    "No matching record was found for that phone number. Ask an admin or coordinator to confirm your phone in the system.",
  );
}

async function pollTelegram() {
  if (!token) {
    console.warn("[bot] TELEGRAM_BOT_TOKEN is not set. Running in scaffold mode.");
    return;
  }

  let offset = 0;
  console.log("[bot] telegram polling enabled");

  while (true) {
    try {
      const response = await telegram<TelegramUpdate[]>("getUpdates", {
        timeout: 30,
        offset,
      });

      for (const update of response.result) {
        offset = update.update_id + 1;
        await handleMessage(update);
      }

      await processQueuedNotifications();
    } catch (error) {
      console.error("[bot] polling error", error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

async function main() {
  console.log("[bot] service booting");
  await logSnapshot();
  setInterval(() => {
    void logSnapshot();
  }, pollMs);

  await pollTelegram();
}

main().catch((error) => {
  console.error("[bot] fatal", error);
  process.exit(1);
});
