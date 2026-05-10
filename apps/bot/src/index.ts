import {
  createTelegramAiSubmissionDraft,
  driverRespondToTransportTask,
  dispatchQueuedNotifications,
  findTelegramAdminByChatId,
  linkTelegramAccount,
  listDriverTransportTasksByChatId,
  listUpcomingFlightsForUserChat,
  markNotificationFailed,
  markNotificationSent,
  prisma,
} from "@west-santo/data";
import { formatPassengerNames } from "@west-santo/core";
import { z } from "zod";

const pollMs = Number(process.env.BOT_HEALTH_POLL_MS ?? 60000);
const token = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? null;

const aiPassengerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().nullable().optional(),
  passengerType: z.enum(["WEST_SANTO", "GUEST_SANTO", "HARIBHAKTO"]).nullable().optional(),
  extractedName: z.string().nullable().optional(),
});

const aiSegmentSchema = z.object({
  airline: z.string().min(1),
  flightNumber: z.string().min(1),
  departureAirport: z.string().min(3),
  arrivalAirport: z.string().min(3),
  departureTimeLocal: z.string().min(1),
  arrivalTimeLocal: z.string().min(1),
});

const aiItinerarySchema = z.object({
  submitterName: z.string().nullable().optional(),
  submitterPhone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  passengers: z.array(aiPassengerSchema).min(1),
  segments: z.array(aiSegmentSchema).min(1),
});

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    code: issue.code,
    message: issue.message,
  }));
}

function logBotError(event: string, error: unknown, context?: Record<string, unknown>) {
  if (error instanceof z.ZodError) {
    console.error(`[bot] ${event}`, {
      ...context,
      issues: formatZodIssues(error),
    });
    return;
  }

  if (error instanceof Error) {
    console.error(`[bot] ${event}`, {
      ...context,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  console.error(`[bot] ${event}`, {
    ...context,
    error,
  });
}

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
    caption?: string;
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
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

async function getTelegramFileUrl(fileId: string) {
  const response = await telegram<{ file_path?: string }>("getFile", { file_id: fileId });
  const filePath = response.result.file_path;

  if (!filePath) {
    throw new Error("Telegram did not return a file path.");
  }

  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

function normalizeGeminiImageMimeType(value?: string | null) {
  const normalized = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp" || normalized === "image/heic" || normalized === "image/heif") {
    return normalized;
  }

  return "image/jpeg";
}

async function extractItineraryWithGemini(input: { text?: string | null; image?: { mimeType: string; data: string } | null }) {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const parts: Array<Record<string, unknown>> = [
    {
      text: [
        "Extract itinerary data from the provided Telegram message.",
        "Return JSON only with keys: submitterName, submitterPhone, notes, passengers, segments.",
        "Each passenger must contain firstName, lastName, optional phone, optional passengerType, optional extractedName.",
        "Each segment must contain airline, flightNumber, departureAirport, arrivalAirport, departureTimeLocal, arrivalTimeLocal.",
        "Use passengerType only when clearly implied and restrict it to WEST_SANTO, GUEST_SANTO, HARIBHAKTO.",
        "Normalize airport values to IATA airport codes when possible.",
        "Keep datetime strings as seen in the itinerary if you cannot infer timezone-safe conversion.",
      ].join("\n"),
    },
  ];

  if (input.text?.trim()) {
    parts.push({ text: `Message text:\n${input.text.trim()}` });
  }

  if (input.image) {
    parts.push({
      inline_data: {
        mime_type: input.image.mimeType,
        data: input.image.data,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!rawText) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (error) {
    logBotError("gemini json parse failed", error, {
      rawTextPreview: rawText.slice(0, 1000),
      hasText: Boolean(input.text?.trim()),
      hasImage: Boolean(input.image),
      imageMimeType: input.image?.mimeType ?? null,
    });
    throw new Error("Gemini did not return valid JSON.");
  }

  const parsed = aiItinerarySchema.safeParse(parsedJson);
  if (!parsed.success) {
    logBotError("gemini itinerary schema validation failed", parsed.error, {
      parsedJson,
      hasText: Boolean(input.text?.trim()),
      hasImage: Boolean(input.image),
      imageMimeType: input.image?.mimeType ?? null,
    });
    throw new Error(parsed.error.issues[0]?.message ?? "Gemini response was missing required itinerary fields.");
  }

  return parsed.data;
}

function buildSubmissionReply(input: {
  submissionId: string;
  matchedCount: number;
  ambiguousCount: number;
  unresolvedCount: number;
}) {
  const lines = [
    `Draft itinerary created: ${input.submissionId}`,
    `Matched travelers: ${input.matchedCount}`,
    `Ambiguous travelers: ${input.ambiguousCount}`,
    `Unresolved travelers: ${input.unresolvedCount}`,
  ];

  if (appBaseUrl) {
    lines.push(`Review: ${appBaseUrl}/submissions/${input.submissionId}/edit`);
  }

  return lines.join("\n");
}

async function tryCreateAiItineraryDraft(update: TelegramUpdate) {
  const message = update.message;
  if (!message) {
    return false;
  }

  const chatId = String(message.chat.id);
  const adminUser = await findTelegramAdminByChatId(chatId);
  const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
  const messageText = message.text?.trim() ?? message.caption?.trim() ?? "";

  if (!adminUser) {
    return false;
  }

  if (!messageText && !hasPhoto) {
    return false;
  }

  let image: { mimeType: string; data: string } | null = null;
  if (hasPhoto) {
    const photo = [...message.photo!].sort((left, right) => (right.file_size ?? 0) - (left.file_size ?? 0))[0];

    try {
      const fileUrl = await getTelegramFileUrl(photo.file_id);
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error("Unable to download the Telegram image.");
      }
      const mimeType = normalizeGeminiImageMimeType(response.headers.get("content-type"));
      const buffer = Buffer.from(await response.arrayBuffer());
      image = {
        mimeType,
        data: buffer.toString("base64"),
      };
    } catch (error) {
      logBotError("telegram image fetch failed", error, {
        chatId,
        telegramUsername: message.from?.username ?? null,
        hasText: Boolean(messageText),
        photoCount: message.photo?.length ?? 0,
        selectedPhotoFileId: photo.file_id,
      });
      throw error;
    }
  }

  try {
    const extracted = await extractItineraryWithGemini({
      text: messageText || null,
      image,
    });

    console.log("[bot] itinerary extraction succeeded", {
      chatId,
      telegramUsername: message.from?.username ?? null,
      adminUserId: adminUser.id,
      hasText: Boolean(messageText),
      hasImage: Boolean(image),
      passengerCount: extracted.passengers.length,
      segmentCount: extracted.segments.length,
    });

    const draft = await createTelegramAiSubmissionDraft({
      submitterName: extracted.submitterName ?? adminUser.name ?? `${adminUser.firstName} ${adminUser.lastName}`.trim(),
      submitterPhone: extracted.submitterPhone ?? adminUser.phone ?? null,
      notes: extracted.notes ?? null,
      passengers: extracted.passengers.map((passenger) => ({
        ...passenger,
        extractedName: passenger.extractedName ?? `${passenger.firstName} ${passenger.lastName}`.trim(),
      })),
      segments: extracted.segments,
      source: {
        chatId,
        telegramUsername: message.from?.username ?? null,
        messageText: messageText || null,
        imageMimeType: image?.mimeType ?? null,
      },
      actorUserId: adminUser.id,
      responseSummary: `Telegram AI draft ${extracted.passengers.length} travelers / ${extracted.segments.length} segments`,
    });

    const matchedCount = draft.passengerMatches.filter((item) => item.matchStatus === "MATCHED").length;
    const ambiguousCount = draft.passengerMatches.filter((item) => item.matchStatus === "AMBIGUOUS").length;
    const unresolvedCount = draft.passengerMatches.filter((item) => item.matchStatus === "UNRESOLVED").length;

    console.log("[bot] itinerary draft created", {
      chatId,
      telegramUsername: message.from?.username ?? null,
      adminUserId: adminUser.id,
      submissionId: draft.submission.id,
      matchedCount,
      ambiguousCount,
      unresolvedCount,
    });

    await sendMessage(
      message.chat.id,
      buildSubmissionReply({
        submissionId: draft.submission.id,
        matchedCount,
        ambiguousCount,
        unresolvedCount,
      }),
    );

    return true;
  } catch (error) {
    logBotError("itinerary draft creation failed", error, {
      chatId,
      telegramUsername: message.from?.username ?? null,
      adminUserId: adminUser.id,
      hasText: Boolean(messageText),
      textPreview: messageText.slice(0, 300),
      hasImage: Boolean(image),
      imageMimeType: image?.mimeType ?? null,
    });
    throw error;
  }
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
      "Admins and coordinators can send their email address or phone number. Passengers and drivers should send a phone number in any format, or share their contact, so I can match the right record.",
      true,
    );
    return;
  }

  if (text === "/tasks" || text === "/assignments") {
    await sendDriverAssignments(message.chat.id);
    return;
  }

  if (text === "/upcoming") {
    const upcoming = await listUpcomingFlightsForUserChat(chatId);

    if (!upcoming) {
      await sendMessage(message.chat.id, "This command is available only for Telegram-linked admin or coordinator accounts.");
      return;
    }

    if (upcoming.flights.length === 0) {
      await sendMessage(message.chat.id, "No upcoming flights for your assigned airports.");
      return;
    }

    const text = upcoming.flights.map((segment) => {
      const departureTime = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(segment.departureTimeLocal);

      return [
        `${segment.flightNumber} ${segment.departureAirport.code} -> ${segment.arrivalAirport.code}`,
        `Departure: ${departureTime}`,
        `Passengers: ${formatPassengerNames(segment.itinerary.itineraryPassengers.map((item) => item.passenger)) || "None"}`,
        `Transport: ${segment.itinerary.transportTasks
          .filter((task) => task.flightSegmentId === segment.id)
          .map((task) => `${task.taskType}: ${task.drivers.map((entry) => entry.driver.name).join(", ") || "Unassigned"}`)
          .join(" · ") || "None"}`,
      ].join("\n");
    }).join("\n\n");

    await sendMessage(message.chat.id, text);
    return;
  }

  try {
    const createdDraft = await tryCreateAiItineraryDraft(update);
    if (createdDraft) {
      return;
    }
  } catch (error) {
    await sendMessage(
      message.chat.id,
      error instanceof Error ? `Unable to create itinerary draft: ${error.message}` : "Unable to create itinerary draft.",
    );
    return;
  }

  const rawInput = message.contact?.phone_number ?? text;
  if (!rawInput) {
    await sendMessage(message.chat.id, "Send an email address, phone number, or use the contact-share button.");
    return;
  }

  const result = await linkTelegramAccount(chatId, rawInput, telegramUsername);

  if (result.linked) {
    const linkedSummary =
      "linkedEntities" in result && Array.isArray(result.linkedEntities) && result.linkedEntities.length > 0
        ? result.linkedEntities.map((item) => `${item.displayName} (${item.entityType.toLowerCase()})`).join(", ")
        : ("displayName" in result ? result.displayName : "your record");
    await sendMessage(message.chat.id, `Linked to ${linkedSummary}.`);
    if (
      "linkedEntities" in result &&
      Array.isArray(result.linkedEntities) &&
      result.linkedEntities.some((item) => item.entityType === "DRIVER")
    ) {
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
    "No matching record was found for that email address or phone number. Ask an admin or coordinator to confirm your contact details in the system.",
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
