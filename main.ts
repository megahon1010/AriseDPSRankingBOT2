// DPSランキングBot 複数サーバー対応 Deno/Discordeno v18版
import { createBot, startBot, Intents } from "npm:discordeno@18.0.1";
import { formatDps } from "./unit.ts";

// 環境変数からBotトークン取得（Deno CLI用）
const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN環境変数が設定されていません。");

type DpsRecord = { userId: bigint; guildId: bigint; dps: number };

// 簡易データベース（実運用はDB等推奨）
const dpsRecords: DpsRecord[] = [];

// コマンド定義
const commands = [
  {
    name: "dps",
    description: "DPSを登録します。例: /dps 12345",
    type: 1,
    options: [
      {
        name: "value",
        description: "あなたのDPS値（例：12345, 1e15 など）",
        type: 10, // Number
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
      // 参加している全Guildにコマンド登録
      for (const [guildId, guild] of bot.guilds) {
        await bot.helpers.upsertGuildApplicationCommands(guildId, commands);
        console.log(`DPSコマンド登録: ${guild.name} (${guildId})`);
      }
      console.log("DPSランキングBot Ready!");
    },
    interactionCreate: async (bot, interaction) => {
      if (!interaction.guildId) return;

      // DPS登録コマンド
      if (interaction.data?.name === "dps") {
        const dpsValue = interaction.data?.options?.[0]?.value;
        if (typeof dpsValue !== "number" || !interaction.user?.id) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: "DPS値が不正です。" },
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
          dpsRecords[index].dps = dpsValue;
        } else {
          dpsRecords.push({ userId, guildId, dps: dpsValue });
        }
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: 4,
          data: { content: `DPS(${formatDps(dpsValue)})を登録しました！` }, // 単位付き表示
        });
        return;
      }

      // DPSランキング表示
      if (interaction.data?.name === "dpsrank") {
        const guildId = BigInt(interaction.guildId);
        // サーバーごとにランキング抽出＆降順ソート
        const ranking = dpsRecords
          .filter((r) => r.guildId === guildId)
          .sort((a, b) => b.dps - a.dps)
          .slice(0, 10); // 上位10人
        if (ranking.length === 0) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: "まだDPS記録がありません。" },
          });
          return;
        }
        // 名前取得
        const entries = await Promise.all(
          ranking.map(async (rec, idx) => {
            const member = await bot.helpers.getMember(guildId, rec.userId);
            const username = member.user?.username ?? "Unknown";
            return `${idx + 1}位: ${username} - ${formatDps(rec.dps)}`; // 単位付き表示
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
      // 新規参加Guildにもコマンド登録
      await bot.helpers.upsertGuildApplicationCommands(guild.id, commands);
      console.log(`新規サーバーにDPSコマンド登録: ${guild.name} (${guild.id})`);
    },
  },
});

// 起動
await startBot(bot);

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});

