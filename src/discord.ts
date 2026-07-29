export interface DiscordSettings {
  webhookUrl: string;
  displayName: string;
}

export interface DiscordDicePart {
  name: string;
  value: number;
}

export type DiscordResult =
  | {
      kind: "dice";
      formula: string;
      total: number;
      breakdown: string;
      parts?: DiscordDicePart[];
      createdAt: Date;
    }
  | {
      kind: "cards";
      cards: Array<{
        label: string;
        shortLabel: string;
        glyph: string;
      }>;
      remainingCards: number;
      deckSize: number;
      createdAt: Date;
    };

const discordSettingsKey = "rolling-tools.discord-settings";
const allowedWebhookHosts = new Set([
  "discord.com",
  "www.discord.com",
  "discordapp.com",
  "canary.discord.com",
  "ptb.discord.com",
]);

export function loadDiscordSettings(): DiscordSettings {
  try {
    const stored = window.localStorage.getItem(discordSettingsKey);
    if (!stored) return { webhookUrl: "", displayName: "" };

    const settings = JSON.parse(stored) as Partial<DiscordSettings>;
    return {
      webhookUrl: typeof settings.webhookUrl === "string" ? settings.webhookUrl : "",
      displayName: typeof settings.displayName === "string" ? settings.displayName : "",
    };
  } catch {
    return { webhookUrl: "", displayName: "" };
  }
}

export function saveDiscordSettings(settings: DiscordSettings): void {
  window.localStorage.setItem(discordSettingsKey, JSON.stringify(settings));
}

export function clearDiscordSettings(): void {
  window.localStorage.removeItem(discordSettingsKey);
}

export function normalizeDiscordWebhookUrl(value: string): string {
  const url = parseDiscordWebhookUrl(value);
  url.searchParams.delete("wait");
  return url.toString();
}

export function isDiscordWebhookUrl(value: string): boolean {
  try {
    parseDiscordWebhookUrl(value);
    return true;
  } catch {
    return false;
  }
}

export async function postDiscordResult(
  settings: DiscordSettings,
  result: DiscordResult,
): Promise<void> {
  const url = parseDiscordWebhookUrl(settings.webhookUrl);
  url.searchParams.set("wait", "true");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: (settings.displayName.trim() || "Rolling Tools").slice(0, 80),
      allowed_mentions: { parse: [] },
      embeds: [buildDiscordEmbed(result)],
    }),
  });

  if (!response.ok) {
    const message = await readDiscordError(response);
    throw new Error(message || `Discord returned ${response.status}.`);
  }
}

function parseDiscordWebhookUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Paste a complete Discord webhook URL.");
  }

  if (url.protocol !== "https:" || !allowedWebhookHosts.has(url.hostname)) {
    throw new Error("Use a webhook URL created by Discord.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const webhookIndex = segments.indexOf("webhooks");
  const apiSegment = segments[webhookIndex - 1];
  const webhookId = segments[webhookIndex + 1];
  const webhookToken = segments[webhookIndex + 2];
  if (
    webhookIndex < 1 ||
    (apiSegment !== "api" &&
      (!/^v\d+$/.test(apiSegment ?? "") || segments[webhookIndex - 2] !== "api")) ||
    !/^\d+$/.test(webhookId ?? "") ||
    !/^[A-Za-z0-9._-]+$/.test(webhookToken ?? "")
  ) {
    throw new Error("This does not look like a Discord channel webhook URL.");
  }

  return url;
}

function buildDiscordEmbed(result: DiscordResult) {
  if (result.kind === "dice") {
    return {
      title: truncate(`🎲 ${result.formula} = ${result.total}`, 256),
      description: truncate(result.breakdown, 4096),
      color: 0x2f6f8f,
      fields: result.parts?.map((part) => ({
        name: part.name,
        value: String(part.value),
        inline: true,
      })),
      footer: { text: "Rolling Tools • Dice tray" },
      timestamp: result.createdAt.toISOString(),
    };
  }

  const cardLines = result.cards.map(
    (card) => `${card.glyph} **${card.shortLabel}** — ${card.label}`,
  );
  return {
    title: `🃏 Drew ${result.cards.length} card${result.cards.length === 1 ? "" : "s"}`,
    description: truncate(cardLines.join("\n"), 4096),
    color: 0x9c3434,
    fields: [
      {
        name: "Deck",
        value: `${result.remainingCards}/${result.deckSize} cards left`,
        inline: true,
      },
    ],
    footer: { text: "Rolling Tools • Deck draw" },
    timestamp: result.createdAt.toISOString(),
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

async function readDiscordError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as { message?: unknown };
    return typeof error.message === "string" ? error.message : "";
  } catch {
    return "";
  }
}
