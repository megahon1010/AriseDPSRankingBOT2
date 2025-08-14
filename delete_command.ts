import { createBot, Intents } from "npm:discordeno@18.0.1";

const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
const bot = createBot({
  token: BOT_TOKEN,
  intents: Intents.Guilds,
});

// すべてのグローバルコマンドを削除
const commands = await bot.helpers.getGlobalApplicationCommands();
for (const cmd of commands) {
  await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
  console.log(`Deleted command: ${cmd.name}`);
}
