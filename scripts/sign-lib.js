const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const keysDir = path.join(__dirname, '..', 'keys');
const privateKeyPath = path.join(keysDir, 'private_key.pem');
const publicDir = path.join(__dirname, '..', 'public');
const nativePatcherDir = path.join(__dirname, '..', 'native-patcher');

// We search in libs/ for compiled targets
const libsDir = path.join(nativePatcherDir, 'libs');

if (!fs.existsSync(privateKeyPath)) {
  console.error("[-] ERROR: Private key not found at keys/private_key.pem");
  console.error("[-] Please generate RSA key pair first by running: npm run gen-keys");
  process.exit(1);
}

if (!fs.existsSync(libsDir)) {
  console.error(`[-] ERROR: Native libraries folder not found at ${libsDir}`);
  console.error("[-] Please compile the libraries first by running build.sh in native-patcher.");
  process.exit(1);
}

const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');

// Function to sign a file
function signFile(inputFilePath, outputSoPath, outputSigPath) {
  if (!fs.existsSync(inputFilePath)) {
    console.error(`[-] File not found: ${inputFilePath}`);
    return false;
  }

  console.log(`[*] Signing ${path.basename(inputFilePath)}...`);
  const fileBuffer = fs.readFileSync(inputFilePath);
  
  const sign = crypto.createSign('SHA256');
  sign.update(fileBuffer);
  const signature = sign.sign({
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING
  });

  fs.writeFileSync(outputSoPath, fileBuffer);
  fs.writeFileSync(outputSigPath, signature);
  console.log(`[+] OTA Library files created successfully:`);
  console.log(`    Binary: ${path.relative(process.cwd(), outputSoPath)}`);
  console.log(`    Signature: ${path.relative(process.cwd(), outputSigPath)}`);
  return true;
}

// Find targets in the build outputs (e.g. arm64-v8a, armeabi-v7a, x86, x86_64)
const architectures = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
let foundAny = false;

for (const arch of architectures) {
  const archLibPath = path.join(libsDir, arch, 'libmypatch.so');
  if (fs.existsSync(archLibPath)) {
    foundAny = true;
    
    // We create separate folders or target names for different architectures if needed.
    // For simplicity, we can output arch-specific files to public, e.g. public/arm64-v8a/libmypatch.so
    const targetArchDir = path.join(publicDir, arch);
    if (!fs.existsSync(targetArchDir)) {
      fs.mkdirSync(targetArchDir, { recursive: true });
    }
    
    const outputSoPath = path.join(targetArchDir, 'libmypatch.so');
    const outputSigPath = path.join(targetArchDir, 'libmypatch.so.sig');
    signFile(archLibPath, outputSoPath, outputSigPath);

    // Copy signature to native-patcher assets folder so it can be packaged inside APK
    const assetsDir = path.join(nativePatcherDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    fs.copyFileSync(outputSigPath, path.join(assetsDir, 'libmypatch.so.sig'));
    console.log(`    Copied signature to native-patcher assets directory for APK packaging.`);
    
    // Also copy to root level as a fallback or default (typically arm64-v8a)
    if (arch === 'arm64-v8a') {
      signFile(archLibPath, path.join(publicDir, 'libmypatch.so'), path.join(publicDir, 'libmypatch.so.sig'));
    }
  }
}

if (!foundAny) {
  console.warn("[-] WARNING: No compiled libmypatch.so found in native-patcher/libs/.");
  console.warn("[-] Please compile your libraries first (e.g., using ndk-build) before signing them.");
} else {
  console.log("\n[+] Success! Dynamic libraries signed and prepared.");
  console.log("[!] Please deploy/redeploy to make these OTA binary updates live.");
}
