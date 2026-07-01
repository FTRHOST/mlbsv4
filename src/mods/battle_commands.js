/**
 * Battle Command Line Mod Module
 */

import { showGameNotification } from "../index";

export function setupBattleCommands(Assembly) {
  const BattleBridge = Assembly.class("BattleBridge");
  if (!BattleBridge || BattleBridge.handle.isNull()) return;

  const ShowChatHistoryText = BattleBridge.method("ShowChatHistoryText");
  if (ShowChatHistoryText) {
    ShowChatHistoryText.implementation = function (messageObj) {
      const instanceBattleBridge = Il2Cpp.gc.choose(BattleBridge);
      const objekAktifBattleBridge = instanceBattleBridge[0];
      const il2cppStr = messageObj;
      const rawContent = il2cppStr.content;

      if (rawContent) {
        const msg = rawContent.toString();
        const matches = [...msg.matchAll(/#(\w+)/g)];

        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];

          if (lastMatch && lastMatch[1]) {
            const cmd = lastMatch[1].toLowerCase();
            console.log(`[Command] Detected: ${cmd}`);

            if (cmd == "help") {
              showGameNotification(
                "Battle Command",
                "[00FF00]#help[-]: For show all command\n[00FF00]#hideui[-]: For hide all ui on battle\n[00FF00]#hidebar[-]: For hide bar health on battle\n[00ff00]#hidename[-]: For hide name only",
              );
            } else if (cmd == "hideui") {
              objekAktifBattleBridge.method("ToggleAllUIShow").invoke();
            } else if (cmd == "hidebar") {
              objekAktifBattleBridge.method("SetHeroBloodShow").invoke(false);
            } else if (cmd == "hidename") {
              objekAktifBattleBridge.method("HideHeroNameAndFly").invoke(true);
            }
          }
        }
      }
      return this.method("ShowChatHistoryText").invoke(il2cppStr.handle);
    };
  }
}
