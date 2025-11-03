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
import { unitGroups } from "./dps_units.ts"; // DPS単位の表示に必要
import { swordRanks } from "./sword_ranks.ts"; 

const kv = await Deno.openKv();

const commands = [
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

// Botトークン取得 (環境変数)
const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN環境変数が設定されていません。");


// Bot本体 -----------------------------------------------------------------------
const bot = createBot({
  token: BOT_TOKEN,
  intents: Intents.Guilds | Intents.GuildMessages,
  events: {
    ready: async (bot) => {
      console.log(`[READY] Botが起動しました。ログインID: ${bot.id}`);

      // コマンドを再登録
      try {
        const existingCommands = await bot.helpers.getGlobalApplicationCommands();
        for (const cmd of existingCommands) {
            if (cmd.id) { 
                await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
            }
        }
        await bot.helpers.upsertGlobalApplicationCommands(commands);
        console.log("[SUCCESS] 新しいグローバルコマンド登録完了");
      } catch (error) {
        console.error("[ERROR] コマンドの登録中にエラーが発生しました:", error);
      }
    },
    
    // コマンド処理の中心部 ---------------------------------------------------------
    interactionCreate: async (bot, interaction) => {
      if (interaction.type !== InteractionTypes.ApplicationCommand || !interaction.guildId) return;

      const command = interaction.data?.name;
      console.log(`[INTERACTION] /${command} コマンドを受信しました。`);

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
                data: { content: "無効なランクが指定されました。ランク名を確認してください。", flags: 64 },
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
  
  // メンションするロールID - ※注意: ここを新しいサーバーのロールIDに更新してください！
  const roleMention = "<@&1434820667764899910>"; 
  
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
