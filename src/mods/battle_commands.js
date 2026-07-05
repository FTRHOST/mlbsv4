/**
 * Battle Command Line Mod Module
 */

import { showGameNotification } from "../index";

export function setupBattleCommands(Assembly) {
  const BattleBridge = Assembly.class("BattleBridge");
  if (!BattleBridge || BattleBridge.handle.isNull()) return;

  const ShowChatHistoryText = BattleBridge.method("ShowChatHistoryText");
  if (ShowChatHistoryText) {
    ShowChatHistoryText.implementation = function (messageStr) {
      if (messageStr) {
        // Karena parameternya System.String, kita baca string-nya langsung
        const msg = messageStr.content ? messageStr.content.toString() : messageStr.toString();
        const matches = [...msg.matchAll(/#(\w+)/g)];

        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];

          if (lastMatch && lastMatch[1]) {
            const cmd = lastMatch[1].toLowerCase();
            console.log(`[Command] Detected: ${cmd}`);

            if (cmd == "help") {
              showGameNotification(
                "Battle Command",
                "[00FF00]#help[-]: For show all command\nSorry to say method for hide ui has been change by moonton",
              );
            } /* else if (cmd == "hideui" || cmd == "hidebar" || cmd == "hidename") {
              const activeBattleBridge = this;
              try {
                if (cmd == "hideui") {
                  const mToggle = activeBattleBridge.method("ToggleAllUIShow", 0) || activeBattleBridge.method("ToggleAllUIShow");
                  if(mToggle) mToggle.invoke();
                } else if (cmd == "hidebar") {
                  const mHideBar = activeBattleBridge.method("SetHeroBloodShow", 1) || activeBattleBridge.method("SetHeroBloodShow");
                  if(mHideBar) mHideBar.invoke(false);
                } else if (cmd == "hidename") {
                  const mHideName = activeBattleBridge.method("HideHeroNameAndFly", 1) || activeBattleBridge.method("HideHeroNameAndFly");
                  if(mHideName) mHideName.invoke(true);
                }
              } catch (e) {
                console.log(`[-] Error invoking command ${cmd}: ${e.message}`);
              }
            } */
          }
        }
      }
      
      // Untuk instance method, kita harus memanggil fungsi aslinya seperti ini di frida-il2cpp-bridge:
      // Menggunakan 'this' sebagai instance context, bukan 'ShowChatHistoryText.invoke()'
      return ShowChatHistoryText.invoke(this, messageStr);
    };
  }
}
