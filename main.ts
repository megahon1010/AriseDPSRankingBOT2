import {
  createBot,
  startBot,
  Intents,
  ApplicationCommandOptionTypes,
  InteractionResponseTypes,
  InteractionTypes,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";
// 外部ファイルからのインポート
import { calculateSwords, calculateRemainingSwords } from "./sword_calculator.ts"; 
import { unitToExp, formatDps, unitList, unitGroups } from "./dps_units.ts";
import { swordRanks } from "./sword_ranks.ts"; 

const kv = await Deno.openKv();

// DPSランキングBotの主要機能 ------------------------------------------------------------

// DPSデータ保存用のインターフェース
type DpsRecord = {
  userId: bigint;
  guildId: bigint;
  value: number;
  unit: string;
};

// 剣のランク (swordRanks.tsから取得し、コマンド定義用に変換 - choicesの数が上限を超えたため、Bot内部でのみ使用)
const swordRanksChoices = swordRanks.map(rank => ({ name: rank, value: rank }));

const commands = [
  {
    name: "dps",
    description: "DPSを登録します。例: /dps 12345 Qi, /dps 1.0 Uc",
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
        description: `単位（例: K, M, Qi, Uvg, Uc ...）`,
        type: ApplicationCommandOptionTypes.String,
        required: true,
      },
    ],
  },
  {
    name: "dpsrank",
    description: "サーバー内DPSランキングを表示します。",
    type: 1,
  },
  {
    name: "dpsunits",
    description: "Botが対応している全DPS単位(K〜Dc)をグループ化して表示します。",
    type: 1,
  },
  {
    name: "sword",
    description: "剣の合成に必要な本数を計算します。",
    type: 1,
    options: [
      {
        name: "target_rank",
        description: "到達したい剣のランク (例: ur+, gr+, m+ など)",
        type: ApplicationCommandOptionTypes.String,
        required: true,
        // ❌ Discordの選択肢上限25個を超えたため choices を削除 ❌
      },
      {
        name: "owned_swords",
        description: "現在持っている剣のランクと本数(例: g:1,ss:2)",
        type: ApplicationCommandOptionTypes.String,
        required: false, 
      },
      {
        name: "base_rank",
        description: "不足数を換算したい基準ランク (省略可、デフォルトはE)",
        type: ApplicationCommandOptionTypes.String,
        required: false,
        // ❌ Discordの選択肢上限25個を超えたため choices を削除 ❌
      },
    ],
  },
  {
    name: "remind_on",
    description: "毎時18,38,58分に指定ロールをメンションする機能を有効にします。実行したチャンネルが対象。",
    type: 1,
  },
  {
    name: "remind_off",
    description: "自動メンション機能を無効にします。",
    type: 1,
  },
];

// Botトークン取得とロールID設定 (環境変数)
const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN環境変数が設定されていません。");

const ROLE_ID_TOP1 = Deno.env.get("ROLE_ID_TOP1") ?? "";
const ROLE_ID_TOP2 = Deno.env.get("ROLE_ID_TOP2") ?? "";
const ROLE_ID_TOP3 = Deno.env.get("ROLE_ID_TOP3") ?? "";
const ROLE_ID_TOP10 = Deno.env.get("ROLE_ID_TOP10") ?? "";

// KVからデータを取得してロールを更新する関数
async function updateRoles(bot: any, guildId: bigint) {
  console.log(`[ROLE_UPDATE] Starting role update for guild ${guildId}`);

  const dpsRecords: DpsRecord[] = [];
  try {
    const iter = kv.list({ prefix: ["dps_record"] });
    for await (const entry of iter) {
      if ((entry.value as DpsRecord).guildId === guildId) {
        dpsRecords.push(entry.value as DpsRecord);
      }
    }
  } catch (error) {
    console.error("[ERROR] ロール更新時のKV読み込みエラー:", error);
    return;
  }

  const sortedUsers = dpsRecords
    .sort((a, b) => {
      const aExp = unitToExp(a.unit) ?? 0;
      const bExp = unitToExp(b.unit) ?? 0;
      const aAbs = a.value * Math.pow(10, aExp);
      const bAbs = b.value * Math.pow(10, bExp);
      return bAbs - aAbs;
    });

  const roleMap = {
    1: ROLE_ID_TOP1,
    2: ROLE_ID_TOP2,
    3: ROLE_ID_TOP3,
    10: ROLE_ID_TOP10,
  };

  const guild = await bot.helpers.getGuild(guildId);
  if (!guild) {
    console.error(`[ERROR] Guild not found: ${guildId}`);
    return;
  }

  const currentMembers = await bot.helpers.getMembers(guildId);

  // 全メンバーからランキングロールを削除
  for (const [memberId, member] of currentMembers) {
    for (const roleId of Object.values(roleMap)) {
      try {
        if (roleId && member.roles.includes(BigInt(roleId))) {
          console.log(`[ROLE_UPDATE] Removing role ${roleId} from member ${memberId}`);
          await bot.helpers.removeRole(guildId, BigInt(memberId), BigInt(roleId));
        }
      } catch (error) {
        console.error(`[ERROR] ロール削除エラー (ユーザーID: ${memberId}):`, error);
      }
    }
  }

  // トップユーザーにロールを付与
  for (let i = 0; i < sortedUsers.length; i++) {
    const rank = i + 1;
    const { userId } = sortedUsers[i];
    const roleIdStr = roleMap[rank as keyof typeof roleMap];
    if (roleIdStr) {
      try {
        const roleId = BigInt(roleIdStr);
        console.log(`[ROLE_UPDATE] Adding role ${roleId} to member ${userId} (Rank: ${rank})`);
        await bot.helpers.addRole(guildId, BigInt(userId), roleId);
      } catch (error) {
        console.error(`[ERROR] ロール付与エラー (ランク: ${rank}, ユーザーID: ${userId}):`, error);
      }
    }
  }
  console.log("[ROLE_UPDATE] Role update complete.");
}

// Bot本体 -----------------------------------------------------------------------
const bot = createBot({
  token: BOT_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages,
  events: {
    ready: async (bot) => {
      console.log(`[READY] DPSランキングBotが起動しました。ログインID: ${bot.id}`);

      // 既存のコマンドをすべて削除して再登録
      try {
        const existingCommands = await bot.helpers.getGlobalApplicationCommands();
        for (const cmd of existingCommands) {
            if (cmd.id) { 
                await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
            }
        }
        console.log("[SUCCESS] 既存のグローバルコマンドをすべて削除しました。");

        // 新しいコマンドを登録
        await bot.helpers.upsertGlobalApplicationCommands(commands);
        console.log("[SUCCESS] 新しいグローバルDPSコマンド登録完了");
      } catch (error) {
        // 🚀 choices削除により、このエラーは解消されるはずです 🚀
        console.error("[ERROR] コマンドの登録中にエラーが発生しました:", error);
      }
    },
    
    // コマンド処理の中心部 ---------------------------------------------------------
    interactionCreate: async (bot, interaction) => {
      if (interaction.type !== InteractionTypes.ApplicationCommand || !interaction.guildId) return;

      const command = interaction.data?.name;
      console.log(`[INTERACTION] /${command} コマンドを受信しました。`);

      // --------------------- /dps ---------------------
      if (command === "dps") {
        const value = interaction.data?.options?.find((o) => o.name === "value")?.value;
        const unit = interaction.data?.options?.find((o) => o.name === "unit")?.value;

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
            data: { content: `単位「${unit}」は対応していません。**K, M, Qi, Uvg, Uc** など、正しい単位名を入力してください。`, flags: 64 },
          });
          return;
        }

        const userId = BigInt(interaction.user.id);
        const guildId = BigInt(interaction.guildId);
        
        const dpsRecord: DpsRecord = { userId, guildId, value, unit };
        await kv.set(["dps_record", userId.toString()], dpsRecord);

        updateRoles(bot, guildId).catch((error) => {
          console.error("[ERROR] Role update failed in background:", error);
        });

        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { content: `DPS(${formatDps(value, unit)})を登録しました！\nランキングとロールは数秒後に更新されます。`, flags: 64 },
        });
        console.log(`[SUCCESS] DPS登録完了: ${formatDps(value, unit)}`);
        return;
      }

      // --------------------- /dpsrank ---------------------
      if (command === "dpsrank") {
        const guildId = BigInt(interaction.guildId);
        
        const dpsRecords: DpsRecord[] = [];
        try {
          const iter = kv.list({ prefix: ["dps_record"] });
          for await (const entry of iter) {
            if ((entry.value as DpsRecord).guildId === guildId) {
              dpsRecords.push(entry.value as DpsRecord);
            }
          }
        } catch (error) {
          console.error("[ERROR] KVデータの読み込みエラー:", error);
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: '🤔 ランキングデータの読み込み中にエラーが発生しました。' },
          });
          return;
        }

        const ranking = dpsRecords
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
            const member = await bot.helpers.getMember(guildId, rec.userId).catch(() => null);
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

      // --------------------- /dpsunits ---------------------
      if (command === "dpsunits") {
        
        const fields = unitGroups.map(group => {
          const unitString = group.units.map(u => 
            `${u.symbol}: e+${u.exp}`
          ).join('\n');

          return {
            name: `🌐 ${group.name}`,
            value: `\`\`\`\n${unitString}\n\`\`\``,
            inline: true, 
          };
        });

        const embed = {
          color: 0x3498db,
          title: "⚔️ 対応DPS単位リスト (指数表記)",
          description: "Botが認識するDPS単位とその指数です。\nコマンド入力時は **シンボル** のみを使用してください。",
          fields: fields,
          footer: {
            text: "例: 12345 Qi, 1.0 Uc",
          },
        };

        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
          type: InteractionResponseTypes.ChannelMessageWithSource,
          data: { embeds: [embed], flags: 64 },
        });
        console.log("[SUCCESS] DPS単位リスト表示完了");
        return;
      }
      
      // --------------------- /sword ---------------------
      if (command === "sword") {
        const targetRank = interaction.data?.options?.find((o) => o.name === "target_rank")?.value as string;
        const ownedSwordsStr = interaction.data?.options?.find((o) => o.name === "owned_swords")?.value as string;
        const baseRank = (interaction.data?.options?.find((o) => o.name === "base_rank")?.value as string) || "e";

        if (ownedSwordsStr) {
          try {
            const ownedSwords = ownedSwordsStr.split(',').map(item => {
                const parts = item.split(':').map(p => p.trim());
                if (parts.length !== 2 || isNaN(parseInt(parts[1]))) {
                    throw new Error("Invalid format");
                }
                return { rank: parts[0], count: parseInt(parts[1], 10) };
            });

            const result = calculateRemainingSwords(targetRank, ownedSwords, baseRank); 

            if (result === null) {
              await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: { content: "無効なランクが指定されました。", flags: 64 },
              });
            } else if (result.needed === 0) {
                 await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                    type: InteractionResponseTypes.ChannelMessageWithSource,
                    data: { content: `**${targetRank.toUpperCase()}** ランクの剣は、持っている剣で達成可能です！`},
                });
            } else {
              await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: { 
                    content: `**${targetRank.toUpperCase()}** ランクの剣を1本作るには、不足している**${baseRank.toUpperCase()}** ランクの剣が **${result.needed}** 本必要です。`
                },
              });
            }
          } catch (error) {
            await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: { content: "所持剣の形式が正しくありません。\n例: `g:1,ss:2`", flags: 64 },
            });
          }
        } else {
          const swordsNeeded = calculateSwords(baseRank, targetRank);
          if (swordsNeeded === null) {
            await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
              type: InteractionResponseTypes.ChannelMessageWithSource,
              data: { content: "無効なランクが指定されました。", flags: 64 },
            });
          } else {
            await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
              type: InteractionResponseTypes.ChannelMessageWithSource,
              data: { content: `**${targetRank.toUpperCase()}** ランクの剣を1本作るには、**${swordsNeeded}** 本の **${baseRank.toUpperCase()}** ランクの剣が必要です。`},
            });
          }
        }
      }

      // --------------------- /remind_on ---------------------
      if (command === "remind_on") {
        const guildId = interaction.guildId;
        const channelId = interaction.channelId;

        if (guildId && channelId) {
          await kv.set(["guild_remind_channel", guildId.toString()], channelId.toString());
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: "毎時18,38,58分の自動メンションを有効にしました。このチャンネルに指定ロールへメンションされます。", flags: 64 },
          });
        }
      }

      // --------------------- /remind_off ---------------------
      if (command === "remind_off") {
        const guildId = interaction.guildId;
        if (guildId) {
          await kv.delete(["guild_remind_channel", guildId.toString()]);
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: "毎時18,38,58分の自動メンションを無効にしました。", flags: 64 },
          });
        }
      }
    },
  },
});

await startBot(bot);

// 連続リクエストを維持するためのCronジョブ（Deno Deployの仕様）
Deno.cron("Continuous Request", "*/2 * * * *", () => {
  console.log("running...");
});

// 自動メンション用Cronジョブ ---------------------------------------------------------
Deno.cron("Remind", "18,38,58 * * * *", async () => {
  console.log("Remind cron job running at 18, 38, 58 past the hour...");
  
  const guilds = kv.list({ prefix: ["guild_remind_channel"] });
  
  // メンションするロールID
  const roleMention = "<@&1426509530640158730>"; 
  
  for await (const entry of guilds) {
    const channelId = entry.value as string;
    
    try {
        await bot.helpers.sendMessage(BigInt(channelId), { content: `${roleMention} 残り時間わずかです！` }); 
        console.log(`Sent role remind message to channel ${channelId}`);
    } catch (error) {
        console.error(`[ERROR] Failed to send message to channel ${channelId}:`, error);
    }
  }
});
