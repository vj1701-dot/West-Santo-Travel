import {
  driverRespondToTransportTask,
  dispatchQueuedNotifications,
  linkTelegramAccount,
  listDriverTransportTasksByChatId,
  markNotificationFailed,
  markNotificationSent,
  prisma,
} from "@west-santo/data";
import { formatPassengerNames } from "@west-santo/core";

const pollMs = Number(process.env.BOT_HEALTH_POLL_MS ?? 60000);
const token = process.env.TELEGRAM_BOT_TOKEN;

type TelegramUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      chat: {
        id: number;
      };
      message_id: number;
    };
    from: {
      username?: string;
    };
  };
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

async function sendMessage(
  chatId: number,
  text: string,
  includeContactButton = false,
  extraReplyMarkup?: Record<string, unknown>,
) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup:
      extraReplyMarkup ??
      (includeContactButton
        ? {
            keyboard: [[{ text: "Share phone number", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        : {
            remove_keyboard: true,
          }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  await telegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

function formatDriverTaskMessage(task: Awaited<ReturnType<typeof listDriverTransportTasksByChatId>> extends { tasks: infer T }
  ? T extends Array<infer U>
    ? U
    : never
  : never) {
  const passengerNames = formatPassengerNames(
    task.itinerary.itineraryPassengers.map((item) => ({
      firstName: item.passenger.firstName,
      lastName: item.passenger.lastName,
    })),
  );
  const flightLabel = task.flightSegment
    ? `${task.flightSegment.flightNumber} ${task.flightSegment.departureAirport.code} -> ${task.flightSegment.arrivalAirport.code}`
    : "Flight details not available";
  const scheduledTime = task.scheduledTimeLocal
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(task.scheduledTimeLocal)
    : "Not scheduled";

  return [
    `${task.taskType} assignment`,
    `Passengers: ${passengerNames || "Not set"}`,
    `Flight: ${flightLabel}`,
    `Airport: ${task.airport.code}`,
    `Mandir: ${task.mandir?.name ?? "Not set"}`,
    `Scheduled: ${scheduledTime}`,
    `Status: ${task.status}`,
    `Drivers: ${task.drivers.map((entry) => entry.driver.name).join(", ") || "None"}`,
    task.notes ? `Notes: ${task.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDriverTaskKeyboard(taskId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Accept", callback_data: `task:${taskId}:ACCEPT` },
        { text: "Decline", callback_data: `task:${taskId}:DECLINE` },
      ],
      [
        { text: "On the way", callback_data: `task:${taskId}:EN_ROUTE` },
        { text: "Picked up", callback_data: `task:${taskId}:PICKED_UP` },
      ],
      [
        { text: "Dropped off", callback_data: `task:${taskId}:DROPPED_OFF` },
        { text: "Completed", callback_data: `task:${taskId}:COMPLETED` },
      ],
    ],
  };
}

async function sendDriverAssignments(chatId: number) {
  const assignmentSet = await listDriverTransportTasksByChatId(String(chatId));

  if (!assignmentSet) {
    await sendMessage(chatId, "This Telegram chat is not linked to a driver record.");
    return;
  }

  if (assignmentSet.tasks.length === 0) {
    await sendMessage(chatId, `No active assignments for ${assignmentSet.driver.name}.`);
    return;
  }

  await sendMessage(chatId, `Assignments for ${assignmentSet.driver.name}:`);

  for (const task of assignmentSet.tasks) {
    await sendMessage(chatId, formatDriverTaskMessage(task), false, buildDriverTaskKeyboard(task.id));
  }
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
      const taskId =
        typeof (notification.payload as { taskId?: unknown })?.taskId === "string"
          ? String((notification.payload as { taskId?: string }).taskId)
          : null;
      const replyMarkup = taskId ? buildDriverTaskKeyboard(taskId) : undefined;
      await sendMessage(Number(chatId), text, false, replyMarkup);
      await markNotificationSent(notification.id);
    } catch (error) {
      await markNotificationFailed(notification.id, error instanceof Error ? error.message : "Failed to send notification");
    }
  }
}

async function handleCallbackQuery(update: TelegramUpdate) {
  const callbackQuery = update.callback_query;
  if (!callbackQuery?.data || !callbackQuery.message) return;

  const match = callbackQuery.data.match(/^task:([a-f0-9-]+):(ACCEPT|DECLINE|EN_ROUTE|PICKED_UP|DROPPED_OFF|COMPLETED)$/i);

  if (!match) {
    await answerCallbackQuery(callbackQuery.id, "Unsupported action.");
    return;
  }

  try {
    const result = await driverRespondToTransportTask({
      chatId: String(callbackQuery.message.chat.id),
      taskId: match[1],
      action: match[2].toUpperCase() as "ACCEPT" | "DECLINE" | "EN_ROUTE" | "PICKED_UP" | "DROPPED_OFF" | "COMPLETED",
    });

    await answerCallbackQuery(callbackQuery.id, result.message);
    await sendMessage(callbackQuery.message.chat.id, `${result.message}\n\n${formatDriverTaskMessage(result.task)}`, false, buildDriverTaskKeyboard(result.task.id));
  } catch (error) {
    await answerCallbackQuery(
      callbackQuery.id,
      error instanceof Error ? error.message : "Unable to update task.",
    );
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

  if (text === "/tasks" || text === "/assignments") {
    await sendDriverAssignments(message.chat.id);
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
    if (result.entityType === "DRIVER") {
      await sendDriverAssignments(message.chat.id);
    }
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
        if (update.callback_query) {
          await handleCallbackQuery(update);
        } else {
          await handleMessage(update);
        }
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
