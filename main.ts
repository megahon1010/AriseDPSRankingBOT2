import {
  ApplicationCommandOptionTypes,
  Bot,
  createBot,
  Intents,
  InteractionResponseTypes,
  startBot,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";

const kv = await Deno.openKv();

interface DpsEntry {
  username: string;
  dps: bigint;
}

// 単位と乗数のマッピング
const units: Record<string, bigint> = {
  "No": 10n ** 30n,
  "Dc": 10n ** 33n,
  "Ud": 10n ** 36n,
};

// Discord Botクライアントの作成
const bot: Bot = createBot({
  token: Deno.env.get("DISCORD_TOKEN")!,
  intents: Intents.Guilds,
  events: {
    ready() {
      console.log("Bot is ready!");
    },
  },
});

// スラッシュコマンドの定義
bot.events.guildCreate = async (guild) => {
  const commands = [
    {
      name: "dps",
      description: "DPSを管理します。",
      options: [
        {
          name: "register",
          description: "自分のDPSを登録します。",
          type: ApplicationCommandOptionTypes.SubCommand,
          options: [
            {
              name: "value",
              description: "DPSの数値。",
              type: ApplicationCommandOptionTypes.String,
              required: true,
            },
            {
              name: "unit",
              description: "DPSの単位。",
              type: ApplicationCommandOptionTypes.String,
              choices: [
                { name: "No", value: "No" },
                { name: "Dc", value: "Dc" },
                { name: "Ud", value: "Ud" },
              ],
              required: false,
            },
          ],
        },
        {
          name: "ranking",
          description: "現在のDPSランキングを表示します。",
          type: ApplicationCommandOptionTypes.SubCommand,
        },
      ],
    },
  ];

  await bot.helpers.upsertGuildApplicationCommands(guild.id, commands);
};

// スラッシュコマンドの処理
bot.events.interactionCreate = async (interaction) => {
  if (!interaction.isApplicationCommand()) return;

  const command = interaction.data?.name;
  const subcommand = interaction.data?.options?.[0]?.name;

  if (command === "dps") {
    if (subcommand === "register") {
      await handleDpsRegister(interaction);
    } else if (subcommand === "ranking") {
      await handleDpsRanking(interaction);
    }
  }
};

/**
 * `/dps register` コマンドの処理
 */
async function handleDpsRegister(interaction: any) {
  const valueStr = interaction.data?.options?.[0]?.options?.[0]?.value as string;
  const unit = interaction.data?.options?.[0]?.options?.[1]?.value as string | undefined;
  const user = interaction.user;
  const guildId = interaction.guildId!;

  // 入力値のバリデーションを強化
  if (!/^\d+$/.test(valueStr)) {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: '🔢 DPSの数値は正の整数である必要があります。',
          flags: 64, // Ephemeral message
        },
      }
    );
    return;
  }

  try {
    let dpsValue = BigInt(valueStr);
    if (unit && units[unit]) {
      dpsValue *= units[unit];
    }

    const dpsEntry: DpsEntry = {
      username: user.username,
      dps: dpsValue,
    };

    // Deno.Kvにデータを保存
    await kv.set(["dps", guildId, user.id], dpsEntry);

    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: `✅ **${user.username}** さんのDPSを **${valueStr}${unit ? unit : ''}** に更新しました。`,
          flags: 64,
        },
      }
    );
    
    // ランキング更新とロール付与を実行
    await updateRoles(guildId);

  } catch (error) {
    console.error("DPS登録エラー:", error);
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: '🤔 データの保存中に予期せぬエラーが発生しました。',
          flags: 64,
        },
      }
    );
  }
}

/**
 * `/dps ranking` コマンドの処理
 */
async function handleDpsRanking(interaction: any) {
  const guildId = interaction.guildId!;
  const entries: [string, DpsEntry][] = [];

  try {
    const iter = kv.list({ prefix: ["dps", guildId] });
    for await (const entry of iter) {
      entries.push([entry.key[2] as string, entry.value as DpsEntry]);
    }
  } catch (error) {
    console.error("KVデータの読み込みエラー:", error);
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: '🤔 ランキングデータの読み込み中にエラーが発生しました。',
          flags: 64,
        },
      }
    );
    return;
  }

  const sortedUsers = entries.sort(([, a], [, b]) => (b.dps > a.dps) ? 1 : (b.dps < a.dps) ? -1 : 0);

  if (sortedUsers.length === 0) {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: 'ランキングデータがありません。',
        },
      }
    );
    return;
  }

  const rankingMessage = sortedUsers.slice(0, 10).map(([userId, entry], index) => {
    const rank = index + 1;
    const dpsStr = formatDps(entry.dps);
    return `**${rank}.** ${entry.username}: **${dpsStr}**`;
  }).join('\n');

  await bot.helpers.sendInteractionResponse(
    interaction.id,
    interaction.token,
    {
      type: InteractionResponseTypes.ChannelMessageWithSource,
      data: {
        content: `### DPSランキング 👑\n\n${rankingMessage}`,
      },
    }
  );
}

// DPSを単位付きの文字列に変換するヘルパー関数
function formatDps(dps: bigint): string {
  const sortedUnits = Object.entries(units).sort(([, a], [, b]) => (b > a) ? 1 : (b < a) ? -1 : 0);

  for (const [unit, value] of sortedUnits) {
    if (dps >= value) {
      const formatted = (dps / value).toString();
      return `${formatted}${unit}`;
    }
  }
  return dps.toString();
}

// ロールを更新する関数
async function updateRoles(guildId: bigint) {
  const entries: [string, DpsEntry][] = [];
  try {
    const iter = kv.list({ prefix: ["dps", guildId] });
    for await (const entry of iter) {
      entries.push([entry.key[2] as string, entry.value as DpsEntry]);
    }
  } catch (error) {
    console.error("ロール更新時のKV読み込みエラー:", error);
    return;
  }
  
  const sortedUsers = entries.sort(([, a], [, b]) => (b.dps > a.dps) ? 1 : (b.dps < a.dps) ? -1 : 0);

  const roleMap = {
      1: Deno.env.get("ROLE_ID_TOP1")!,
      2: Deno.env.get("ROLE_ID_TOP2")!,
      3: Deno.env.get("ROLE_ID_TOP3")!,
      10: Deno.env.get("ROLE_ID_TOP10")!,
  };

  // 全ユーザーの既存ロールを削除
  const guild = await bot.helpers.getGuild(guildId);
  if (guild) {
    for (const memberId of await guild.members) {
      try {
        const member = await bot.helpers.getMember(guildId, memberId);
        if (member) {
          for (const roleId of Object.values(roleMap)) {
            if (member.roles.includes(BigInt(roleId))) {
                await bot.helpers.removeRole(guildId, memberId, BigInt(roleId));
            }
          }
        }
      } catch (error) {
        console.error(`ロール削除エラー (ユーザーID: ${memberId}):`, error);
      }
    }
  }

  // 新しいランキングに基づいてロールを付与
  for (let i = 0; i < sortedUsers.length; i++) {
    const rank = i + 1;
    const [userId] = sortedUsers[i];
    if (roleMap[rank as keyof typeof roleMap]) {
      try {
        const roleId = BigInt(roleMap[rank as keyof typeof roleMap]);
        await bot.helpers.addRole(guildId, BigInt(userId), roleId);
      } catch (error) {
        console.error(`ロール付与エラー (ランク: ${rank}, ユーザーID: ${userId}):`, error);
      }
    }
  }
}

// ボットの起動

await startBot(bot);

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});
