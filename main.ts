import {
  ApplicationCommandOptionTypes,
  Bot,
  createBot,
  Intents,
  InteractionResponseTypes,
  startBot,
  InteractionTypes,
  Interaction,
  GuildMember,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";

type Messages = {
  dpsMustBeInteger: string;
  dpsRegisterSuccess: (username: string, value: string, unit?: string) => string;
  dpsRegisterFailed: string;
  rankingLoadFailed: string;
  noRankingData: string;
  rankingTitle: string;
};

const messages: Messages = {
  dpsMustBeInteger: '🔢 DPSの数値は正の整数である必要があります。',
  dpsRegisterSuccess: (username, value, unit) =>
    `✅ **${username}** さんのDPSを **${value}${unit ?? ''}** に更新しました。\nランキングとロールは数秒後に更新されます。`,
  dpsRegisterFailed: '🤔 データの保存中に予期せぬエラーが発生しました。',
  rankingLoadFailed: '🤔 ランキングデータの読み込み中にエラーが発生しました。',
  noRankingData: 'ランキングデータがありません。',
  rankingTitle: '### DPSランキング 👑\n\n',
};

const REQUIRED_ENV = [
  "DISCORD_TOKEN",
  "GUILD_ID",
  "ROLE_ID_TOP1",
  "ROLE_ID_TOP2",
  "ROLE_ID_TOP3",
  "ROLE_ID_TOP10",
];

for (const key of REQUIRED_ENV) {
  if (!Deno.env.get(key)) {
    throw new Error(`[ERROR] 必須環境変数 ${key} が未設定です。`);
  }
}

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN")!;
const GUILD_ID = BigInt(Deno.env.get("GUILD_ID")!);
const ROLE_ID_TOP1 = BigInt(Deno.env.get("ROLE_ID_TOP1")!);
const ROLE_ID_TOP2 = BigInt(Deno.env.get("ROLE_ID_TOP2")!);
const ROLE_ID_TOP3 = BigInt(Deno.env.get("ROLE_ID_TOP3")!);
const ROLE_ID_TOP10 = BigInt(Deno.env.get("ROLE_ID_TOP10")!);

const kv = await Deno.openKv();

interface DpsEntry {
  username: string;
  dps: bigint;
}

const units: Record<string, bigint> = {
  "No": 10n ** 30n,
  "Dc": 10n ** 33n,
  "Ud": 10n ** 36n,
};

const bot: Bot = createBot({
  token: DISCORD_TOKEN,
  intents: Intents.Guilds,
  events: {
    ready() {
      console.log(`[READY] Bot is ready! Logged in as ${bot.id}`);
    },
    guildCreate: async (guild) => {
      console.log(`[GUILD_CREATE] Bot joined guild: ${guild.name} (${guild.id})`);
      if (guild.id !== GUILD_ID) {
        console.warn(`[WARNING] Bot joined an unconfigured guild. Guild ID: ${guild.id}`);
        return;
      }

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

      try {
        await bot.helpers.upsertGuildApplicationCommands(guild.id, commands);
        console.log(`[SUCCESS] Successfully registered commands for guild ${guild.id}`);
      } catch (error) {
        console.error(`[ERROR] Failed to register commands:`, error);
      }
    },
    interactionCreate: async (interaction: Interaction) => {
      if (interaction.type !== InteractionTypes.ApplicationCommand) return;
      const command = interaction.data?.name;
      const subcommand = interaction.data?.options?.[0]?.name;

      console.log(`[COMMAND] Command received: /${String(command)} ${String(subcommand)}`);

      try {
        if (command === "dps") {
          if (subcommand === "register") {
            await handleDpsRegister(interaction);
          } else if (subcommand === "ranking") {
            await handleDpsRanking(interaction);
          }
        }
      } catch (error) {
        console.error(`[ERROR] An error occurred in command handler:`, error);
      }
    },
  },
});

async function handleDpsRegister(interaction: Interaction) {
  const valueStr = interaction.data?.options?.[0]?.options?.[0]?.value as string;
  const unit = interaction.data?.options?.[0]?.options?.[1]?.value as string | undefined;
  const user = interaction.user!;
  const guildId = interaction.guildId!;

  console.log(`[REGISTER] User: ${user.username}, Value: ${valueStr}, Unit: ${unit}`);

  if (!/^\d+$/.test(valueStr)) {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: messages.dpsMustBeInteger,
          flags: 64,
        },
      }
    );
    return;
  }

  try {
    // 仮応答
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredChannelMessageWithSource,
        data: { flags: 64 },
      }
    );

    let dpsValue = BigInt(valueStr);
    if (unit && units[unit]) dpsValue *= units[unit];

    const dpsEntry: DpsEntry = {
      username: user.username,
      dps: dpsValue,
    };

    await kv.set(["dps", guildId, user.id], dpsEntry);
    console.log(`[REGISTER] DPS saved for user ${user.username}.`);

    // 差分のみロール更新
    await updateRoles(guildId);

    await bot.helpers.editOriginalInteractionResponse(
      bot.id,
      interaction.token,
      {
        content: messages.dpsRegisterSuccess(user.username, valueStr, unit),
      }
    );

  } catch (error) {
    console.error("DPS登録エラー:", error);
    await bot.helpers.editOriginalInteractionResponse(
      bot.id,
      interaction.token,
      {
        content: messages.dpsRegisterFailed,
      }
    );
  }
}

async function handleDpsRanking(interaction: Interaction) {
  const guildId = interaction.guildId!;
  const entries: [string, DpsEntry][] = [];

  try {
    const iter = kv.list({ prefix: ["dps", guildId] });
    for await (const entry of iter) {
      entries.push([entry.key[2] as string, entry.value as DpsEntry]);
    }
  } catch (error) {
    console.error("[ERROR] KVデータの読み込みエラー:", error);
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: { content: messages.rankingLoadFailed },
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
        data: { content: messages.noRankingData },
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
      data: { content: messages.rankingTitle + rankingMessage },
    }
  );
}

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

async function updateRoles(guildId: bigint) {
  console.log(`[ROLE_UPDATE] Starting role update for guild ${guildId}`);
  const entries: [string, DpsEntry][] = [];
  try {
    const iter = kv.list({ prefix: ["dps", guildId] });
    for await (const entry of iter) {
      entries.push([entry.key[2] as string, entry.value as DpsEntry]);
    }
  } catch (error) {
    console.error("[ERROR] ロール更新時のKV読み込みエラー:", error);
    return;
  }

  const sortedUsers = entries.sort(([, a], [, b]) => (b.dps > a.dps) ? 1 : (b.dps < a.dps) ? -1 : 0);

  const roleMap: Record<number, bigint> = {
    1: ROLE_ID_TOP1,
    2: ROLE_ID_TOP2,
    3: ROLE_ID_TOP3,
    10: ROLE_ID_TOP10,
  };

  const guild = await bot.helpers.getGuild(guildId);
  if (!guild) return;

  const members = await bot.helpers.getMembers(guildId);
  const idToMember: Record<string, GuildMember> = {};
  for (const [memberId, member] of members) {
    idToMember[memberId] = member;
  }

  // 検索用: 各ロールごとの新しい該当者
  const newRoleMembers: Record<bigint, Set<string>> = {};
  for (const roleId of Object.values(roleMap)) {
    newRoleMembers[roleId] = new Set<string>();
  }

  for (let i = 0; i < sortedUsers.length; i++) {
    const rank = i + 1;
    const [userId] = sortedUsers[i];
    const roleId = roleMap[rank as keyof typeof roleMap];
    if (roleId) newRoleMembers[roleId].add(userId);
  }

  // 変更点のみ反映
  for (const [memberId, member] of members) {
    for (const roleId of Object.values(roleMap)) {
      const hasRoleNow = member.roles.includes(roleId);
      const shouldHaveRole = newRoleMembers[roleId].has(memberId);

      if (hasRoleNow && !shouldHaveRole) {
        try {
          await bot.helpers.removeRole(guildId, BigInt(memberId), roleId);
          console.log(`[ROLE_UPDATE] Removed role ${roleId} from member ${memberId}`);
        } catch (error) {
          console.error(`[ERROR] ロール削除エラー (ユーザーID: ${memberId}):`, error);
        }
      } else if (!hasRoleNow && shouldHaveRole) {
        try {
          await bot.helpers.addRole(guildId, BigInt(memberId), roleId);
          console.log(`[ROLE_UPDATE] Added role ${roleId} to member ${memberId}`);
        } catch (error) {
          console.error(`[ERROR] ロール付与エラー (ユーザーID: ${memberId}):`, error);
        }
      }
    }
  }

  console.log("[ROLE_UPDATE] Role update complete.");
}

await startBot(bot);

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});





