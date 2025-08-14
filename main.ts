import { createBot, startBot, Intents } from "npm:discordeno@18.0.1";

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
        type: 10,
        required: true,
      },
      {
        name: "unit",
        description: `単位（例: K, M, Qi ...）`,
        type: 3,
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
      // コマンドを一度全削除（古いコマンドの二重登録防止）
      const existingCommands = await bot.helpers.getGlobalApplicationCommands();
      if (existingCommands.length === 0) {
        console.log("削除対象のグローバルコマンドはありません。");
      }
      for (const cmd of existingCommands) {
        // IDが存在し、型がbigintかstringかを確認
        if (!cmd.id) {
          console.error(`コマンドにIDがありません: ${JSON.stringify(cmd)}`);
          continue;
      }
  // Discordeno v18は通常cmd.idはbigint型
  await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
  console.log(`コマンド削除完了: ${cmd.name} (ID: ${cmd.id})`);
}
      console.log("全グローバルコマンドの削除処理が終了しました。");

      // 新しいコマンドを登録
      await bot.helpers.upsertGlobalApplicationCommands(commands);
      console.log("グローバルDPSコマンド登録完了");
      console.log("DPSランキングBot Ready!");
    },
    interactionCreate: async (bot, interaction) => {
      if (!interaction.guildId) return;

      // DPS登録
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
        const exp = unitToExp(unit);
        if (exp === null) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: `単位「${unit}」は対応していません。` },
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
          type: 4,
          data: { content: `DPS(${formatDps(value, unit)})を登録しました！` },
        });
        return;
      }

      // DPSランキング表示
      if (interaction.data?.name === "dpsrank") {
        const guildId = BigInt(interaction.guildId);
        const ranking = dpsRecords
          .filter((r) => r.guildId === guildId)
          .sort((a, b) => {
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
          data: { content: `DPSランキング（単位降順）\n${entries.join("\n")}` },
        });
        return;
      }

      // コマンド削除（管理者用コマンド）
      if (interaction.data?.name === "deletecommands") {
        const commands = await bot.helpers.getGlobalApplicationCommands();
        if (commands.length === 0) {
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: "削除対象のグローバルコマンドはありません。" },
          });
          console.log("削除対象のグローバルコマンドはありません。");
          return;
        }
        let resultMsg = "";
        for (const cmd of commands) {
          await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
          const msg = `コマンド削除完了: ${cmd.name} (ID: ${cmd.id})`;
          resultMsg += msg + "\n";
          console.log(msg);
        }
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: 4,
          data: { content: resultMsg + "全グローバルコマンドの削除処理が終了しました。" },
        });
        console.log("全グローバルコマンドの削除処理が終了しました。");
        // 必要なら再登録: await bot.helpers.upsertGlobalApplicationCommands(commands);
        return;
      }
    },
  },
});

await startBot(bot);

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});
