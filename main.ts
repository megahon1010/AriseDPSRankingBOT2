import { createBot, startBot, Intents } from "npm:discordeno@18.0.1";
import { unitList, parseDps, formatDps, unitToExp } from "./unit.ts";

const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN環境変数が設定されていません。");

type DpsRecord = { userId: bigint; guildId: bigint; value: number; unit: string };

// 簡易データベース（実運用はDB等推奨）
const dpsRecords: DpsRecord[] = [];

const commands = [
  {
    name: "dps",
    description: "DPSを登録します。例: /dps 12345 M",
    type: 1,
    options: [
      {
        name: "value",
        description: "あなたのDPS値（例：12345, 1.2 など）",
        type: 10,
        required: true,
      },
      {
        name: "unit",
        description: `単位（例：${unitList.map(u => u.symbol).slice(0,7).join(", ")}...）`,
        type: 3, // String
        required: true,
        choices: unitList.map(u => ({ name: u.symbol, value: u.symbol })),
      },
    ],
  },
  {
    name: "dpsrank",
    description: "サーバー内DPSランキングを表示します。",
    type: 1,
  },
];

const bot = createBot({
  token: BOT_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages,
  events: {
    ready: async (bot) => {
      await bot.helpers.upsertGlobalApplicationCommands(commands);
      console.log("DPSランキングBot Ready!");
      console.log("グローバルDPSコマンド登録完了");
    },
    interactionCreate: async (bot, interaction) => {
      if (!interaction.guildId) return;

      // DPS登録コマンド
      if (interaction.data?.name === "dps") {
        const value = interaction.data?.options?.find(o => o.name === "value")?.value;
        const unit = interaction.data?.options?.find(o => o.name === "unit")?.value;
        if (typeof value !== "number" || typeof unit !== "string" || !interaction.user?.id) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: "DPS値または単位が不正です。" },
          });
          return;
        }
        // 単位バリデーション
        const exp = unitToExp(unit);
        if (exp === null) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: `単位「${unit}」は対応していません。` },
          });
          return;
        }
        // 登録（上書き）
        const userId = BigInt(interaction.user.id);
        const guildId = BigInt(interaction.guildId);
        const index = dpsRecords.findIndex(
          (r) => r.userId === userId && r.guildId === guildId
        );
        if (index >= 0) {
          dpsRecords[index].value = value;
          dpsRecords[index].unit = unit;
        } else {
          dpsRecords.push({ userId, guildId, value, unit });
        }
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: 4,
          data: { content: `DPS(${formatDps(value, unit)})を登録しました！` },
        });
        return;
      }

      // DPSランキング表示
      if (interaction.data?.name === "dpsrank") {
        const guildId = BigInt(interaction.guildId);
        // ランキング抽出＆降順ソート（単位も考慮して並べる）
        const ranking = dpsRecords
          .filter((r) => r.guildId === guildId)
          .sort((a, b) => {
            // DPS値を絶対値で比較（数値×10^exp）
            const aAbs = a.value * Math.pow(10, unitToExp(a.unit) ?? 0);
            const bAbs = b.value * Math.pow(10, unitToExp(b.unit) ?? 0);
            return bAbs - aAbs;
          })
          .slice(0, 10);
        if (ranking.length === 0) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: "まだDPS記録がありません。" },
          });
          return;
        }
        const entries = await Promise.all(
          ranking.map(async (rec, idx) => {
            const member = await bot.helpers.getMember(guildId, rec.userId);
            const username = member.user?.username ?? "Unknown";
            return `${idx + 1}位: ${username} - ${formatDps(rec.value, rec.unit)}`;
          })
        );
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: 4,
          data: { content: `DPSランキング（単位順）\n${entries.join("\n")}` },
        });
        return;
      }
    },
  },
});

await startBot(bot);

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});




