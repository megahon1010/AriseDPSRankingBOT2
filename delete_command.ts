import { createBot, Intents } from "npm:discordeno@18.0.1";
import * as log from "https://deno.land/std@0.208.0/log/mod.ts";

await log.setup({
  handlers: {
    console: new log.handlers.ConsoleHandler("DEBUG"),
  },
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});

const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN") ?? "";
const bot = createBot({
  token: BOT_TOKEN,
  intents: Intents.Guilds,
});

try {
  const commands = await bot.helpers.getGlobalApplicationCommands();
  if (commands.length === 0) {
    log.info("グローバルコマンドはありません。");
  }
  for (const cmd of commands) {
    await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
    log.info(`Deleted command: ${cmd.name} (ID: ${cmd.id})`);
  }
  log.info("全てのグローバルコマンドの削除処理が完了しました。");
} catch (err) {
  log.error(`コマンド削除中にエラー: ${err}`);
}
