import {
  createBot,
  startBot,
  Intents,
  ApplicationCommandOptionTypes,
  InteractionResponseTypes,
  InteractionTypes,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";
import { calculateSwords, calculateRemainingSwords, convertFromTo } from "./sword_calculator.ts";

const kv = await Deno.openKv();

// DPSランキングBotの主要機能 ------------------------------------------------------------

// DPSデータ保存用のインターフェース
type DpsRecord = {
  userId: bigint;
  guildId: bigint;
  value: number;
  unit: string;
};

// 単位リスト (既存のリスト + 単位表の単位をすべて追加)
const unitList = [
  // 既存のリスト
  { exp: 3, symbol: "K" },
  { exp: 6, symbol: "M" },
  { exp: 9, symbol: "B" },
  { exp: 12, symbol: "T" },
  { exp: 15, symbol: "Qa" },
  { exp: 18, symbol: "Qi" },
  { exp: 21, symbol: "Sx" },
  { exp: 24, symbol: "Sp" },
  { exp: 27, symbol: "Oc" },
  { exp: 30, symbol: "No" },
  { exp: 33, symbol: "De" },
  { exp: 36, symbol: "Ud" },
  { exp: 39, symbol: "Dd" },
  { exp: 42, symbol: "Td" },
  { exp: 45, symbol: "Qad" },
  { exp: 48, symbol: "Qid" },
  { exp: 51, symbol: "Sxd" },
  { exp: 54, symbol: "Spd" },
  { exp: 57, symbol: "Ocd" },
  { exp: 60, symbol: "Nod" },
  { exp: 63, symbol: "Vg" },
  { exp: 66, symbol: "Uvg" },
  { exp: 69, symbol: "Dvg" },
  { exp: 72, symbol: "Tvg" },
  { exp: 75, symbol: "Qavg" },
  // 単位表の追加分 (exp 93以降は、既存リストの最後尾(75)から連番で追加)
  // U-, D-, T- は既存リストと重複するため省略
  // Qa- (Qad, Qidは既存)
  { exp: 78, symbol: "Qivig" }, // Qivg
  { exp: 81, symbol: "Sxg" },
  { exp: 84, symbol: "Spg" },
  { exp: 87, symbol: "Ocg" },
  { exp: 90, symbol: "Nog" },
  
  // 1e33 - 1e75 は既存リストに含まれるため、 exp93 から開始 (画像に合わせて調整)
  
  // d (1e33) -> d (1e33)
  { exp: 33, symbol: "Ud" },
  { exp: 36, symbol: "Dd" },
  { exp: 39, symbol: "Td" },
  { exp: 42, symbol: "Qad" },
  { exp: 45, symbol: "Qid" },
  { exp: 48, symbol: "Sxd" },
  { exp: 51, symbol: "Spd" },
  { exp: 54, symbol: "Ocd" },
  { exp: 57, symbol: "Nod" },
  { exp: 60, symbol: "Vg" },

  // vg (1e63) -> vg (1e63)
  { exp: 63, symbol: "Uvg" },
  { exp: 66, symbol: "Dvg" },
  { exp: 69, symbol: "Tvg" },
  { exp: 72, symbol: "Qavg" },
  { exp: 75, symbol: "Qivg" }, // Qi- (1e78)
  { exp: 78, symbol: "Sxg" },
  { exp: 81, symbol: "Spg" },
  { exp: 84, symbol: "Ocg" },
  { exp: 87, symbol: "Nog" },

  // tg (1e93)
  { exp: 93, symbol: "Utg" },
  { exp: 96, symbol: "Dtg" },
  { exp: 99, symbol: "Ttg" },
  { exp: 102, symbol: "Qatg" },
  { exp: 105, symbol: "Qitg" },
  { exp: 108, symbol: "Sxtg" },
  { exp: 111, symbol: "Sptg" },
  { exp: 114, symbol: "Octg" },
  { exp: 117, symbol: "Notg" },
  { exp: 120, symbol: "Qag" },
  
  // qag (1e123)
  { exp: 123, symbol: "Uqag" },
  { exp: 126, symbol: "Dqag" },
  { exp: 129, symbol: "Tqag" },
  { exp: 132, symbol: "Qaqag" },
  { exp: 135, symbol: "Qiqag" },
  { exp: 138, symbol: "Sxqag" },
  { exp: 141, symbol: "Spqag" },
  { exp: 144, symbol: "Ocqag" },
  { exp: 147, symbol: "Noqag" },
  { exp: 150, symbol: "Qig" },

  // qig (1e153)
  { exp: 153, symbol: "Uqig" },
  { exp: 156, symbol: "Dqig" },
  { exp: 159, symbol: "Tqig" },
  { exp: 162, symbol: "Qaqig" },
  { exp: 165, symbol: "Qiqig" },
  { exp: 168, symbol: "Sxqig" },
  { exp: 171, symbol: "Spqig" },
  { exp: 174, symbol: "Ocqig" },
  { exp: 177, symbol: "Noqig" },
  { exp: 180, symbol: "Sxg" },

  // sxg (1e183)
  { exp: 183, symbol: "Usxg" },
  { exp: 186, symbol: "Dsxg" },
  { exp: 189, symbol: "Tsxg" },
  { exp: 192, symbol: "Qasxg" },
  { exp: 195, symbol: "Qisxg" },
  { exp: 198, symbol: "Sxsxg" },
  { exp: 201, symbol: "Spsxg" },
  { exp: 204, symbol: "Ocsxg" },
  { exp: 207, symbol: "Nosxg" },
  { exp: 210, symbol: "Spg" },

  // spg (1e213)
  { exp: 213, symbol: "Uspg" },
  { exp: 216, symbol: "Dspg" },
  { exp: 219, symbol: "Tspg" },
  { exp: 222, symbol: "Qaspg" },
  { exp: 225, symbol: "Qispg" },
  { exp: 228, symbol: "Sxslg" },
  { exp: 231, symbol: "Spspg" },
  { exp: 234, symbol: "Ocspg" },
  { exp: 237, symbol: "Nospg" },
  { exp: 240, symbol: "Ocg" },

  // ocg (1e243)
  { exp: 243, symbol: "Uocg" },
  { exp: 246, symbol: "Docg" },
  { exp: 249, symbol: "Tocg" },
  { exp: 252, symbol: "Qaocg" },
  { exp: 255, symbol: "Qiocg" },
  { exp: 258, symbol: "Sxocg" },
  { exp: 261, symbol: "Spocg" },
  { exp: 264, symbol: "Ococg" },
  { exp: 267, symbol: "Noocg" },
  { exp: 270, symbol: "Nog" },

  // nog (1e273)
  { exp: 273, symbol: "Unog" },
  { exp: 276, symbol: "Dnog" },
  { exp: 279, symbol: "Tnog" },
  { exp: 282, symbol: "Qanog" },
  { exp: 285, symbol: "Qinog" },
  { exp: 288, symbol: "Sxnogs" },
  { exp: 291, symbol: "Spnog" },
  { exp: 294, symbol: "Ocnog" },
  { exp: 297, symbol: "Nonog" },
  { exp: 300, symbol: "c" },

  // c (1e303)
  { exp: 303, symbol: "Uc" },
  { exp: 306, symbol: "Dc" },
];


function unitToExp(symbol: string): number | null {
  // 後方互換性のため、シンボルが重複しないように注意し、大文字・小文字を無視して検索
  const found = unitList.find((u) => u.symbol.toLowerCase() === symbol.toLowerCase());
  return found ? found.exp : null;
}

function formatDps(value: number, unit: string): string {
  return `${value}${unit}`;
}

// Discordコマンド定義
// 単位が多すぎるため、Discordの選択肢制限 (25個) に合わせて、expの低いものから25個を選択
const unitChoices = unitList
  .filter((u) => u.symbol.length <= 25)
  .sort((a, b) => a.exp - b.exp) // expの低い順にソート
  .slice(0, 25)
  .map((u) => ({ name: u.symbol, value: u.symbol }));
  
// 剣のランク (GRとGR+を含む)
const swordRanksChoices = [
    "e", "d", "c", "b", "a", "s", "ss", "g", "n", "n+",
    "m", "m+", "gm", "gm+", "ugm", "ugm+", "hgm", "hgm+", "r", "r+", "mr", "mr+", "gr", "gr+"
].map(rank => ({ name: rank, value: rank }));

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
        choices: unitChoices,
      },
    ],
  },
  {
    name: "dpsrank",
    description: "サーバー内DPSランキングを表示します。",
    type: 1,
  },
  {
    name: "sword",
    description: "剣の合成に必要な本数を計算します。",
    type: 1,
    options: [
      {
        name: "target_rank",
        description: "到達したい剣のランク",
        type: ApplicationCommandOptionTypes.String,
        required: true,
        choices: swordRanksChoices,
      },
      {
        name: "owned_swords",
        description: "現在持っている剣のランクと本数(例: g:1,ss:2)",
        type: ApplicationCommandOptionTypes.String,
        required: false, // 任意
      },
      {
        name: "base_rank",
        description: "不足数を換算したい基準ランク (省略可、デフォルトはE)",
        type: ApplicationCommandOptionTypes.String,
        required: false,
        choices: swordRanksChoices,
      },
    ],
  },
  {
    name: "remind_on",
    description: "毎時00,20,40分にメンションする機能を有効にします。実行したチャンネルが対象になります。",
    type: 1,
  },
  {
    name: "remind_off",
    description: "自動メンション機能を無効にします。",
    type: 1,
  },
];

// Botトークン取得とロールID設定
const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN環境変数が設定されていません。");

const ROLE_ID_TOP1 = Deno.env.get("ROLE_ID_TOP1") ?? "";
const ROLE_ID_TOP2 = Deno.env.get("ROLE_ID_TOP2") ?? "";
const ROLE_ID_TOP3 = Deno.env.get("ROLE_ID_TOP3") ?? "";
const ROLE_ID_TOP10 = Deno.env.get("ROLE_ID_TOP10") ?? "";

// KVからデータを取得してロールを更新する関数
async function updateRoles(bot: any, guildId: bigint) {
  console.log(`[ROLE_UPDATE] Starting role update for guild ${guildId}`);

  // KVからデータを読み込み
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
        // グローバルコマンドをすべて取得して削除
        const existingCommands = await bot.helpers.getGlobalApplicationCommands();
        for (const cmd of existingCommands) {
            if (cmd.id) { // ここでidの存在をチェック
                await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
            }
        }
        console.log("[SUCCESS] 既存のグローバルコマンドをすべて削除しました。");

        // 新しいコマンドを登録
        await bot.helpers.upsertGlobalApplicationCommands(commands);
        console.log("[SUCCESS] 新しいグローバルDPSコマンド登録完了");
      } catch (error) {
        console.error("[ERROR] コマンドの登録中にエラーが発生しました:", error);
      }
    },
    interactionCreate: async (bot, interaction) => {
      if (interaction.type !== InteractionTypes.ApplicationCommand || !interaction.guildId) return;

      const command = interaction.data?.name;
      console.log(`[INTERACTION] /${command} コマンドを受信しました。`);

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
            data: { content: `単位「${unit}」は対応していません。`, flags: 64 },
          });
          return;
        }

        const userId = BigInt(interaction.user.id);
        const guildId = BigInt(interaction.guildId);
        
        // KVにデータを保存
        const dpsRecord: DpsRecord = {
          userId,
          guildId,
          value,
          unit,
        };
        await kv.set(["dps_record", userId.toString()], dpsRecord);

        // ロール更新はバックグラウンドで実行
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

      if (command === "dpsrank") {
        const guildId = BigInt(interaction.guildId);
        
        // KVからデータを読み込み
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

      if (command === "sword") {
        const targetRank = interaction.data?.options?.find((o) => o.name === "target_rank")?.value as string;
        const ownedSwordsStr = interaction.data?.options?.find((o) => o.name === "owned_swords")?.value as string;
        const baseRank = (interaction.data?.options?.find((o) => o.name === "base_rank")?.value as string) || "e";

        if (ownedSwordsStr) {
          try {
            // 所持剣の文字列を正規表現で解析
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
          // 所持剣が指定されていない場合は、以前のロジックを使用
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

      // メンション機能のコマンドロジック
      if (command === "remind_on") {
        const guildId = interaction.guildId;
        const channelId = interaction.channelId;

        if (guildId && channelId) {
          await kv.set(["guild_remind_channel", guildId.toString()], channelId.toString());
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: "毎時00,20,40分の自動メンションを有効にしました。このチャンネルに送信されます。", flags: 64 },
          });
        }
      }

      if (command === "remind_off") {
        const guildId = interaction.guildId;
        if (guildId) {
          await kv.delete(["guild_remind_channel", guildId.toString()]);
          await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: { content: "毎時00,20,40分の自動メンションを無効にしました。", flags: 64 },
          });
        }
      }
    },
  },
});

await startBot(bot);

// 連続リクエストを維持するためのCronジョブ（既存）
Deno.cron("Continuous Request", "*/2 * * * *", () => {
  console.log("running...");
});

// 新しいメンション用Cronジョブ
Deno.cron("Remind", "0,20,40 * * * *", async () => {
  console.log("Remind cron job running...");
  
  // KVから通知設定されているチャンネルIDをすべて取得
  const guilds = kv.list({ prefix: ["guild_remind_channel"] });
  
  for await (const entry of guilds) {
    const channelId = entry.value as string;
    
    // チャンネルにメッセージを送信
    try {
        // ⚠️ ここをメンションしたいロールIDに置き換えてください ⚠️
        await bot.helpers.sendMessage(BigInt(channelId), { content: "<@&1404446958286012446> 残り時間わずかです！" }); 
        console.log(`Sent remind message to channel ${channelId}`);
    } catch (error) {
        console.error(`[ERROR] Failed to send message to channel ${channelId}:`, error);
    }
  }
});
