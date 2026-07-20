/** * Battle Command Line Mod Module */
import { showGameNotification } from "../index";

// Menyimpan ID string pesan terakhir agar tidak diproses dua kali
let lastProcessedMessageRef = null;
let noCdHook = null;

export function setupBattleCommands(Assembly) {
  const BattleBridge = Assembly.class("BattleBridge");
  const CoolDownData = Assembly.class("Battle.CoolDownData");
  const EnterCoolDown = CoolDownData.method("EnterCoolDown");

  if (!BattleBridge || BattleBridge.handle.isNull()) return;

  const ShowChatHistoryText = BattleBridge.method("ShowChatHistoryText");
  if (ShowChatHistoryText) {
    ShowChatHistoryText.implementation = function (messageStr) {
      if (messageStr && !messageStr.handle.isNull()) {
        // 1. FILTER CHAT LAMA: Cek alamat memori objek System.String
        // Jika alamatnya sama dengan yang terakhir diproses, abaikan!
        const currentMessageRef = messageStr.handle.toString();

        if (currentMessageRef !== lastProcessedMessageRef) {
          lastProcessedMessageRef = currentMessageRef; // Update referensi terbaru

          const msg = messageStr.content
            ? messageStr.content.toString()
            : messageStr.toString();

          // 2. PERBAIKAN REGEX: Diubah agar bisa membaca tanda seru [!] di depan perintah
          const matches = [...msg.matchAll(/(#!?\w+)/g)];

          if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            if (lastMatch && lastMatch[1]) {
              const cmd = lastMatch[1].toLowerCase();
              console.log(`[Command] Detected: ${cmd}`);

              if (cmd === "#help") {
                showGameNotification(
                  "Battle Command",
                  "[00FF00]#help[-]: For show all command\n[00FF00]#nocd[-]: For no cooldown\n[00FF00]#!nocd[-]: To revert no cooldown",
                );
              } else if (cmd === "#nocd") {
                if (!noCdHook) {
                  // Hanya pasang jika belum ada hook aktif
                  noCdHook = Interceptor.attach(EnterCoolDown.virtualAddress, {
                    onEnter: function (args) {
                      args[2] = ptr(0);
                    },
                  });
                  console.log("[Mod] Cooldown disabled.");
                  showGameNotification(
                    "Battle Command",
                    "No Cooldown [00FF00]ON[-]",
                  );
                }
              } else if (cmd === "#!nocd") {
                if (noCdHook) {
                  noCdHook.detach(); // Lepas hook secara spesifik dan bersih
                  noCdHook = null;
                  console.log("[Mod] Cooldown reverted.");
                  showGameNotification(
                    "Battle Command",
                    "No Cooldown [FF0000]OFF[-]",
                  );
                }
              }
            }
          }
        }
      }
      return ShowChatHistoryText.invoke(this, messageStr);
    };
  }
}
