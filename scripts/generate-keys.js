const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keysDir = path.join(__dirname, '..', 'keys');
const privateKeyPath = path.join(keysDir, 'private_key.pem');
const publicKeyPath = path.join(keysDir, 'public_key.der');
const cppFilePath = path.join(__dirname, '..', 'native-patcher', 'jni', 'main.cpp');

// check if keys already exist
const force = process.argv.includes('--force');
if (fs.existsSync(privateKeyPath) && !force) {
  console.error("[-] ERROR: Key pair already exists in 'keys/'.");
  console.error("[-] Overwriting keys will invalidate signature verification for any existing APKs built with the old public key.");
  console.error("[-] Use 'npm run gen-keys -- --force' if you are sure you want to regenerate keys.");
  process.exit(1);
}

console.log("[*] Generating RSA-2048 key pair...");
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'der'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);
console.log(`[+] Keys successfully saved:`);
console.log(`    Private Key: keys/private_key.pem (KEEP SECURE!)`);
console.log(`    Public Key: keys/public_key.der`);

// Now convert DER public key to C-style byte array
const hexBytes = [];
for (let i = 0; i < publicKey.length; i++) {
  hexBytes.push('0x' + publicKey[i].toString(16).padStart(2, '0'));
}

// Format C array nicely
let formattedBytes = '';
for (let i = 0; i < hexBytes.length; i++) {
  formattedBytes += hexBytes[i] + ', ';
  if ((i + 1) % 12 === 0) {
    formattedBytes += '\n    ';
  }
}
// remove trailing comma and space/newline
formattedBytes = formattedBytes.trim().replace(/,$/, '');

const filesToUpdate = [
  path.join(__dirname, '..', 'native-patcher', 'jni', 'main.cpp'),
  path.join(__dirname, '..', 'native-patcher', 'jni', 'loader.cpp')
];

console.log(`[*] Updating native public key in source files...`);
const regex = /(const\s+unsigned\s+char\s+rsa_public_key\[\]\s*=\s*\{)([\s\S]*?)(\};)/;

for (const filePath of filesToUpdate) {
  if (!fs.existsSync(filePath)) {
    console.error(`[-] ERROR: C++ source file not found at ${filePath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(filePath, 'utf8');
  if (!regex.test(content)) {
    console.error(`[-] ERROR: Could not find rsa_public_key declaration in ${path.basename(filePath)}!`);
    process.exit(1);
  }

  content = content.replace(regex, `$1\n    ${formattedBytes}\n$3`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[+] Successfully updated rsa_public_key in ${path.basename(filePath)}!`);
}

console.log("[!] Please compile the native library using ndk-build / running build.sh in native-patcher.");

