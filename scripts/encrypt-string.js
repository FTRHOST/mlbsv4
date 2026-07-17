/**
 * String Encryption Utility for MLBS Project
 * Usage: node scripts/encrypt-string.js <string> [type: js|cpp]
 */

const XOR_KEY_JS = "mlbs_cache_xor_key_a8d9f4e2c1";
const XOR_KEY_CPP = 0x5a;

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("Usage: node scripts/encrypt-string.js <string> [type: js|cpp]");
  process.exit(1);
}

const text = args[0];
const type = args[1] || "js";

if (type === "js") {
  let xorResult = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ XOR_KEY_JS.charCodeAt(i % XOR_KEY_JS.length);
    xorResult += String.fromCharCode(charCode);
  }
  
  let hexResult = "";
  for (let i = 0; i < xorResult.length; i++) {
    const code = xorResult.charCodeAt(i).toString(16);
    hexResult += (code.length < 2 ? "0" : "") + code;
  }
  console.log(`JS Encrypted: ${hexResult}`);
} else if (type === "cpp") {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const xored = text.charCodeAt(i) ^ XOR_KEY_CPP;
    result += "\\x" + xored.toString(16).padStart(2, "0");
  }
  console.log(`C++ Encrypted: ${result}`);
} else {
  console.log("Invalid type. Use 'js' or 'cpp'.");
}
