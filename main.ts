import {
  createBot,
  startBot,
  Intents,
  ApplicationCommandOptionTypes,
  InteractionResponseTypes,
  InteractionTypes,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";

// DPSランキングBotの主要機能 ------------------------------------------------------------

// 単位リスト
const unitList = [
  { exp: 3,  symbol: "K" },   { exp: 6,  symbol: "M" },   { exp: 9,  symbol: "B" },
  { exp: 12, symbol: "T" },   { exp: 15, symbol: "Qa" },  { exp: 18, symbol: "Qi" },
  { exp: 21, symbol: "Sx" },  { exp: 24, symbol: "Sp" },  { exp: 27, symbol: "Oc" },
  { exp: 30, symbol: "No" },  { exp: 33, symbol: "De" },  { exp: 36, symbol: "Ud" },
  { exp: 39, symbol: "Dd" },  { exp: 42, symbol: "Td" },  { exp: 45, symbol: "Qad" },
  { exp: 48, symbol: "Qid" }, { exp: 51, symbol: "Sxd" }, { exp: 54, symbol: "Spd" },
  { exp: 57, symbol: "Ocd" }, { exp: 60, symbol: "Nod" }, { exp: 63, symbol: "Vg" },
  { exp: 66, symbol: "Uvg" }, { exp: 69, symbol: "Dvg" }, { exp: 72, symbol: "Tvg" },
  { exp: 75, symbol: "Qavg" },
];

function unitToExp(symbol: string): number | null {
  const found = unitList.find(u => u.symbol === symbol);
  return found ? found.exp : null;
}

function formatDps(value: number, unit: string): string {
  return `${value}${unit}`;
}

// DPSデータ（メモリ保持。実運用はDB推奨）
type DpsRecord = { userId: bigint; guildId: bigint; value: number; unit: string };
const dpsRecords: DpsRecord[] = [];

// Discordコマンド定義
const unitChoices = unitList
  .filter(u => u.symbol.length <= 25)
  .slice(0, 25)
  .map(u => ({ name: u.symbol, value: u.symbol }));

const commands = [
  {
    name: "dps",
    description: "DPSを登録します。例: /dps 12345 Qi",
    type: 1,
    options: [
      {
        name: "value",
        description: "あなたのDPS数値（例：12345, 1.2 など）",
        type: ApplicationCommandOptionTypes.Number,
        required: true,
      },
      {
        name: "unit",
        description: `単位（例: K, M, Qi ...）`,
        type: ApplicationCommandOptionTypes.String,
        required: true,
        choices: unitChoices
      },
    ],
  },
  {
    name: "dpsrank",
    description: "サーバー内DPSランキングを表示します。",
    type: 1,
  },
  {
    name: "deletecommands",
    description: "Botのグローバルコマンドをすべて削除します（管理者向け）",
    type: 1,
  }
];

// Botトークン取得
const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN環境変数が設定されていません。");

// Bot本体 -----------------------------------------------------------------------
const bot = createBot({
  token: BOT_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages,
  events: {
    ready: async (bot) => {
      console.log(`[READY] DPSランキングBotが起動しました。ログインID: ${bot.id}`);

      try {
        // 新しいコマンドを登録
        await bot.helpers.upsertGlobalApplicationCommands(commands);
        console.log("[SUCCESS] グローバルDPSコマンド登録完了");
      } catch (error) {
        console.error("[ERROR] コマンドの登録中にエラーが発生しました:", error);
      }
    },
    interactionCreate: async (bot, interaction) => {
      if (interaction.type !== InteractionTypes.ApplicationCommand || !interaction.guildId) return;

      const command = interaction.data?.name;
      console.log(`[INTERACTION] /${command} コマンドを受信しました。`);

      if (command === "dps") {
        const value = interaction.data?.options?.find(o => o.name === "value")?.value;
        const unit = interaction.data?.options?.find(o => o.name === "unit")?.value;

        if (typeof value !== "number" || typeof unit !== "string" || !interaction.user?.id) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: "DPS値または単位が不正です。", flags: 64 },
          });
          return;
        }

        const exp = unitToExp(unit);
        if (exp === null) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: `単位「${unit}」は対応していません。`, flags: 64 },
          });
          return;
        }

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
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { content: `DPS(${formatDps(value, unit)})を登録しました！`, flags: 64 },
        });
        console.log(`[SUCCESS] DPS登録完了: ${formatDps(value, unit)}`);
        return;
      }

      if (command === "dpsrank") {
        const guildId = BigInt(interaction.guildId);
        const ranking = dpsRecords
          .filter((r) => r.guildId === guildId)
          .sort((a, b) => {
            const aExp = unitToExp(a.unit) ?? 0;
            const bExp = unitToExp(b.unit) ?? 0;
            const aAbs = a.value * Math.pow(10, aExp);
            const bAbs = b.value * Math.pow(10, bExp);
            return bAbs - aAbs;
          })
          .slice(0, 10);

        if (ranking.length === 0) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: "まだDPS記録がありません。", flags: 64 },
          });
          return;
        }
        
        const entries = await Promise.all(
          ranking.map(async (rec, idx) => {
            const member = await bot.helpers.getMember(guildId, rec.userId);
            const username = member?.user?.username ?? "Unknown";
            return `${idx + 1}位: ${username} - ${formatDps(rec.value, rec.unit)}`;
          })
        );
        
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { content: `DPSランキング（単位降順）\n${entries.join("\n")}` },
        });
        console.log("[SUCCESS] DPSランキング表示完了");
        return;
      }

      if (command === "deletecommands") {
        const commands = await bot.helpers.getGlobalApplicationCommands();
        if (commands.length === 0) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: "削除対象のグローバルコマンドはありません。", flags: 64 },
          });
          console.log("[INFO] 削除対象のグローバルコマンドはありません。");
          return;
        }
        
        let resultMsg = "";
        for (const cmd of commands) {
          // cmd.idがundefinedではないことを確認
          if (cmd.id) { 
            await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
            const msg = `コマンド削除完了: ${cmd.name} (ID: ${cmd.id.toString()})`;
            resultMsg += msg + "\n";
            console.log(`[SUCCESS] ${msg}`);
          }
        }
        
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { content: resultMsg + "全グローバルコマンドの削除処理が終了しました。", flags: 64 },
        });
        console.log("[SUCCESS] 全グローバルコマンドの削除処理が終了しました。");
        return;
      }
    },
  },
});

await startBot(bot);

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});
