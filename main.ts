import { createBot, startBot, Intents } from "npm:discordeno@18.0.1";
import { formatDps } from "./unit.ts";

const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN環境変数が設定されていません。");

type DpsRecord = { userId: bigint; guildId: bigint; dps: number };
const dpsRecords: DpsRecord[] = [];

const commands = [
  {
    name: "dps",
    description: "DPSを登録します。例: /dps 12345",
    type: 1,
    options: [
      {
        name: "value",
        description: "あなたのDPS値（例：12345, 1e15 など）",
        type: 10,
        required: true,
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
      // グローバルコマンド登録
      await bot.helpers.upsertGlobalApplicationCommands(commands);
      console.log("グローバルDPSコマンド登録完了");
      console.log("DPSランキングBot Ready!");
    },
    interactionCreate: async (bot, interaction) => {
      if (!interaction.guildId) return;

      if (interaction.data?.name === "dps") {
        const dpsValue = interaction.data?.options?.[0]?.value;
        if (typeof dpsValue !== "number" || !interaction.user?.id) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: "DPS値が不正です。" },
          });
          return;
        }
        const userId = BigInt(interaction.user.id);
        const guildId = BigInt(interaction.guildId);
        const index = dpsRecords.findIndex(
          (r) => r.userId === userId && r.guildId === guildId
        );
        if (index >= 0) {
          dpsRecords[index].dps = dpsValue;
        } else {
          dpsRecords.push({ userId, guildId, dps: dpsValue });
        }
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: 4,
          data: { content: `DPS(${formatDps(dpsValue)})を登録しました！` },
        });
        return;
      }

      if (interaction.data?.name === "dpsrank") {
        const guildId = BigInt(interaction.guildId);
        const ranking = dpsRecords
          .filter((r) => r.guildId === guildId)
          .sort((a, b) => b.dps - a.dps)
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
            return `${idx + 1}位: ${username} - ${formatDps(rec.dps)}`;
          })
        );
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: 4,
          data: { content: `DPSランキング\n${entries.join("\n")}` },
        });
        return;
      }
    },
    guildCreate: async (bot, guild) => {
      // 新規参加Guildにもコマンド登録（必要なら）
      await bot.helpers.upsertGuildApplicationCommands(guild.id, commands);
      console.log(`新規サーバーにDPSコマンド登録: ${guild.name} (${guild.id})`);
    },
  },
});

await startBot(bot);
Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});



