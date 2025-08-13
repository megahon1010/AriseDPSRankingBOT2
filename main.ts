import {
  ApplicationCommandOptionTypes,
  Bot,
  createBot,
  Intents,
  InteractionResponseTypes,
  startBot,
  InteractionTypes,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";

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

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN") || "";
const GUILD_ID = Deno.env.get("GUILD_ID") || "";
const ROLE_ID_TOP1 = Deno.env.get("ROLE_ID_TOP1") || "";
const ROLE_ID_TOP2 = Deno.env.get("ROLE_ID_TOP2") || "";
const ROLE_ID_TOP3 = Deno.env.get("ROLE_ID_TOP3") || "";
const ROLE_ID_TOP10 = Deno.env.get("ROLE_ID_TOP10") || "";

const bot: Bot = createBot({
  token: DISCORD_TOKEN,
  intents: Intents.Guilds,
  events: {
    ready() {
      console.log(`[READY] Bot is ready! Logged in as ${bot.id}`);
      if (!GUILD_ID) {
        console.error("[ERROR] GUILD_ID is not set in environment variables.");
      }
    },
    interactionCreate(interaction) {
      console.log(`[INTERACTION] Received interaction type: ${interaction.type}`);
    },
  },
});

bot.events.guildCreate = async (guild) => {
  console.log(`[GUILD_CREATE] Bot joined guild: ${guild.name} (${guild.id})`);
  if (guild.id.toString() !== GUILD_ID) {
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
    console.log(`[SUCCESS] Successfully registered commands for guild ${GUILD_ID}`);
  } catch (error) {
    console.error(`[ERROR] Failed to register commands:`, error);
  }
};

bot.events.interactionCreate = async (interaction) => {
  if (interaction.type !== InteractionTypes.ApplicationCommand) return;

  try {
    const command = interaction.data?.name;
    const subcommand = interaction.data?.options?.[0]?.name;

    console.log(`[COMMAND] Command received: /${command} ${subcommand}`);

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
};

async function handleDpsRegister(interaction: any) {
  const valueStr = interaction.data?.options?.[0]?.options?.[0]?.value as string;
  const unit = interaction.data?.options?.[0]?.options?.[1]?.value as string | undefined;
  const user = interaction.user;
  const guildId = interaction.guildId!;

  console.log(`[REGISTER] User: ${user.username}, Value: ${valueStr}, Unit: ${unit}`);

  if (!/^\d+$/.test(valueStr)) {
    return bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: '🔢 DPSの数値は正の整数である必要があります。',
          flags: 64,
        },
      }
    );
  }

  try {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.DeferredChannelMessageWithSource,
        data: {
          flags: 64,
        },
      }
    );

    let dpsValue = BigInt(valueStr);
    if (unit && units[unit]) {
      dpsValue *= units[unit];
    }

    const dpsEntry: DpsEntry = {
      username: user.username,
      dps: dpsValue,
    };

    await kv.set(["dps", guildId, user.id], dpsEntry);
    console.log(`[REGISTER] DPS saved for user ${user.username}.`);

    updateRoles(guildId).catch(error => {
      console.error("[ERROR] Role update failed in background:", error);
    });
    
    await bot.helpers.editOriginalInteractionResponse(
        bot.id,
        interaction.token,
        {
          content: `✅ **${user.username}** さんのDPSを **${valueStr}${unit ? unit : ''}** に更新しました。\nランキングとロールは数秒後に更新されます。`,
        }
      );

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

async function handleDpsRanking(interaction: any) {
  const guildId = interaction.guildId!;
  const entries: [string, DpsEntry][] = [];

  try {
    const iter = kv.list({ prefix: ["dps", guildId] });
    for await (const entry of iter) {
      entries.push([entry.key[2] as string, entry.value as DpsEntry]);
    }
  } catch (error) {
    console.error("[ERROR] KVデータの読み込みエラー:", error);
    return bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: '🤔 ランキングデータの読み込み中にエラーが発生しました。',
        },
      }
    );
  }

  const sortedUsers = entries.sort(([, a], [, b]) => (b.dps > a.dps) ? 1 : (b.dps < a.dps) ? -1 : 0);

  if (sortedUsers.length === 0) {
    return bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: InteractionResponseTypes.ChannelMessageWithSource,
        data: {
          content: 'ランキングデータがありません。',
        },
      }
    );
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

  const roleMap = {
      1: ROLE_ID_TOP1,
      2: ROLE_ID_TOP2,
      3: ROLE_ID_TOP3,
      10: ROLE_ID_TOP10,
  };

  const guild = await bot.helpers.getGuild(guildId);
  if (!guild) return;

  const currentMembers = await bot.helpers.getMembers(guildId);

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

  for (let i = 0; i < sortedUsers.length; i++) {
    const rank = i + 1;
    const [userId] = sortedUsers[i];
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

try {
  if (!DISCORD_TOKEN) {
    throw new Error("[ERROR] DISCORD_TOKEN is not set.");
  }
  await startBot(bot);
} catch (error) {
  console.error("[ERROR] Bot failed to start:", error);
}

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});




