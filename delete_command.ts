import { createBot, Intents } from "npm:discordeno@18.0.1";

const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
const bot = createBot({
  token: BOT_TOKEN,
  intents: Intents.Guilds,
});

const commandName = "dps"; // 消したいコマンド名

const commands = await bot.helpers.getGlobalApplicationCommands();
const target = commands.find(cmd => cmd.name === commandName);

if (target) {
  await bot.helpers.deleteGlobalApplicationCommand(target.id);
  console.log(`${commandName} コマンドを削除しました`);
} else {
  console.log(`${commandName} コマンドは見つかりませんでした`);
}
