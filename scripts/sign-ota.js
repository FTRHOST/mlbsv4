const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const keysDir = path.join(__dirname, '..', 'keys');
const privateKeyPath = path.join(keysDir, 'private_key.pem');
const distDir = path.join(__dirname, '..', 'dist');
const agentJsPath = path.join(distDir, 'agent.js');
const publicDir = path.join(__dirname, '..', 'public');
const hookOtaPath = path.join(publicDir, 'hook.js');
const hookSigPath = path.join(publicDir, 'hook.js.sig');
const nativeScriptsDir = path.join(__dirname, '..', 'native-patcher', 'scripts');
const nativeHookPath = path.join(nativeScriptsDir, 'hook.js');

if (!fs.existsSync(privateKeyPath)) {
  console.error("[-] ERROR: Private key not found at keys/private_key.pem");
  console.error("[-] Please generate RSA key pair first by running: npm run gen-keys");
  process.exit(1);
}

console.log("[*] Step 1: Compiling Frida script index.js...");
try {
  // Execute frida compilation command
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log("[+] Frida script successfully compiled.");
} catch (e) {
  console.error("[-] ERROR during frida compile:", e.message);
  process.exit(1);
}

if (!fs.existsSync(agentJsPath)) {
  console.error(`[-] ERROR: Compiled agent not found at ${agentJsPath}`);
  process.exit(1);
}

const jsCode = fs.readFileSync(agentJsPath);

console.log("[*] Step 2: Signing Frida script with Private Key...");
const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
const sign = crypto.createSign('SHA256');
sign.update(jsCode);
const signature = sign.sign({
  key: privateKeyPem,
  padding: crypto.constants.RSA_PKCS1_PADDING
});

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy agent.js to public/hook.js and signature to public/hook.js.sig
fs.writeFileSync(hookOtaPath, jsCode);
fs.writeFileSync(hookSigPath, signature);
console.log(`[+] OTA Update Files Created:`);
console.log(`    Script: public/hook.js`);
console.log(`    Signature: public/hook.js.sig`);

// Step 3: Copy to native patcher scripts for embedded fallback & encrypt it
console.log("[*] Step 3: Copying compiled script to native patcher as fallback...");
if (!fs.existsSync(nativeScriptsDir)) {
  fs.mkdirSync(nativeScriptsDir, { recursive: true });
}
fs.writeFileSync(nativeHookPath, jsCode);
console.log(`    Copied to ${nativeHookPath}`);

console.log("[*] Step 4: Running native encrypt.py to update hook_bytes.h...");
try {
  execSync('python3 encrypt.py', { stdio: 'inherit', cwd: path.join(__dirname, '..', 'native-patcher') });
  console.log("[+] Fallback hook_bytes.h updated successfully.");
} catch (e) {
  console.error("[-] WARNING: Failed to run encrypt.py:", e.message);
  console.error("[-] Please make sure python3 is installed and encrypt.py is correct.");
}

console.log("\n[+] Success! OTA script signed and prepared.");
console.log("[!] Please deploy/redeploy your project to Vercel/Firebase to make the OTA update live.");
console.log("[!] Note: The device will search for OTA files at: <server-url> and <server-url>.sig");
