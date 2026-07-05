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
            } else if (cmd == "hideui" || cmd == "hidebar" || cmd == "hidename") {
              // Lazy-load instance just when needed for performance
              const instanceBattleBridge = Il2Cpp.gc.choose(BattleBridge);
              if (instanceBattleBridge.length > 0) {
                const objekAktifBattleBridge = instanceBattleBridge[0];
                try {
                  if (cmd == "hideui") {
                    // Specify 0 parameters in case of method overloading / obfuscation confusion
                    const mToggle = objekAktifBattleBridge.method("ToggleAllUIShow", 0) || objekAktifBattleBridge.method("ToggleAllUIShow");
                    if(mToggle) mToggle.invoke();
                    else console.log("[-] Method ToggleAllUIShow not found");
                  } else if (cmd == "hidebar") {
                    const mHideBar = objekAktifBattleBridge.method("SetHeroBloodShow", 1) || objekAktifBattleBridge.method("SetHeroBloodShow");
                    if(mHideBar) mHideBar.invoke(false);
                    else console.log("[-] Method SetHeroBloodShow not found");
                  } else if (cmd == "hidename") {
                    const mHideName = objekAktifBattleBridge.method("HideHeroNameAndFly", 1) || objekAktifBattleBridge.method("HideHeroNameAndFly");
                    if(mHideName) mHideName.invoke(true);
                    else console.log("[-] Method HideHeroNameAndFly not found");
                  }
                } catch (e) {
                  console.log(`[-] Error invoking command ${cmd}: ${e.message}`);
                }
              } else {
                 console.log("[-] No BattleBridge instance found");
              }
            }
          }
        }
      }
      return ShowChatHistoryText.invoke(this, messageObj);
    };
  }
}
