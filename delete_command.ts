import { createBot, Intents } from "npm:discordeno@18.0.1";
import * as log from "https://deno.land/std@0.208.0/log/mod.ts";

await log.setup({
  handlers: {
    console: new log.handlers.ConsoleHandler("INFO", {
      formatter: "{levelName} {msg}",
    }),
  },
  loggers: {
    default: {
      level: "INFO",
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
    log.info("削除対象のグローバルコマンドはありません。");
  }
  for (const cmd of commands) {
    await bot.helpers.deleteGlobalApplicationCommand(cmd.id);
    log.info(`コマンド削除完了: ${cmd.name} (ID: ${cmd.id})`);
  }
  log.info("全グローバルコマンドの削除処理が終了しました。");
} catch (err) {
  log.error(`コマンド削除中にエラー: ${err}`);
}
