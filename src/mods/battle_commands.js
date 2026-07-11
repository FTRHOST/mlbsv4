/**
 * Battle Command Line Mod Module
 */

import { showGameNotification } from "../index";

export function setupBattleCommands(Assembly) {
  const BattleBridge = Assembly.class("BattleBridge");
  const CoolDownData = Assembly.class("Battle.CoolDownData");

  const EnterCoolDown = CoolDownData.method("EnterCoolDown");

  if (!BattleBridge || BattleBridge.handle.isNull()) return;

  const ShowChatHistoryText = BattleBridge.method("ShowChatHistoryText");
  if (ShowChatHistoryText) {
    ShowChatHistoryText.implementation = function (messageStr) {
      if (messageStr) {
        // Karena parameternya System.String, kita baca string-nya langsung
        const msg = messageStr.content
          ? messageStr.content.toString()
          : messageStr.toString();
        const matches = [...msg.matchAll(/#(\w+)/g)];

        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];

          if (lastMatch && lastMatch[1]) {
            const cmd = lastMatch[1].toLowerCase();
            console.log(`[Command] Detected: ${cmd}`);

            if (cmd == "help") {
              showGameNotification(
                "Battle Command",
                "[00FF00]#help[-]: For show all command\n[00FF00]#nocd[-]: For no cooldown, add ! on command to revert no cooldown\nSorry to say method for hide ui has been change by moonton",
              );
            } else if (cmd == "nocd") {
              Interceptor.attach(EnterCoolDown.virtualAddress, {
                onEnter: function (args) {
                  args[2] = ptr(0);
                  // Blok ini kosong, fungsi asli tidak akan mengeksekusi
                  // instruksi apapun sampai keluar dari fungsi.
                },
                onLeave: function (retval) {
                  // Opsional: Anda juga bisa mengubah nilai balik (*return value*)
                },
              });
            } else if (cmd == "!nocd") {
              Interceptor.revert(EnterCoolDown.virtualAddress);
            }
          }
        }
      }

      // Untuk instance method, kita harus memanggil fungsi aslinya seperti ini di frida-il2cpp-bridge:
      // Menggunakan 'this' sebagai instance context, bukan 'ShowChatHistoryText.invoke()'
      return ShowChatHistoryText.invoke(this, messageStr);
    };
  }
}
