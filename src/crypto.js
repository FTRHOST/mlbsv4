/**
 * Cryptographic Utility for Cache Integrity Verification
 */

const SALT = "mlbs_cache_integrity_salt_5b47a9ef38";

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256(ascii) {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;

  const words = [];
  const asciiLength = ascii[lengthProperty] * 8;

  let hash = sha256.h = sha256.h || [];
  let k = sha256.k = sha256.k || [];
  let primeCounter = k[lengthProperty];

  const isPrime = (n) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  const getFractionalBits = (n) => {
    return ((n - Math.floor(n)) * maxWord) | 0;
  };

  let candidate = 2;
  while (primeCounter < 64) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = getFractionalBits(mathPow(candidate, 1 / 2));
      }
      k[primeCounter] = getFractionalBits(mathPow(candidate, 1 / 3));
      primeCounter++;
    }
    candidate++;
  }

  const wordsLength = (asciiLength + 64 >> 9 << 4) + 15;
  for (i = 0; i < wordsLength; i++) {
    words[i] = 0;
  }

  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[asciiLength >> 5] |= 0x80 << (24 - (asciiLength % 32));
  words[wordsLength] = asciiLength;

  let w = [];
  let a, b, c, d, e, f, g, h;
  let temp1, temp2;

  let h0 = hash[0], h1 = hash[1], h2 = hash[2], h3 = hash[3],
      h4 = hash[4], h5 = hash[5], h6 = hash[6], h7 = hash[7];

  for (i = 0; i < wordsLength; i += 16) {
    a = h0; b = h1; c = h2; d = h3;
    e = h4; f = h5; g = h6; h = h7;

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j];
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      temp1 = (h + S1 + ch + k[j] + w[j]) | 0;

      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const hex = (v) => {
    let s = '', hashe = 0;
    for (let x = 0; x < 4; x++) {
      hashe = (v >> (24 - x * 8)) & 0xff;
      s += (hashe < 16 ? '0' : '') + hashe.toString(16);
    }
    return s;
  };

  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
}

/**
 * Calculates a secure signature hash for the cached user parameters
 */
export function calculateCacheSignature(uid, role, ban, isAllowed, timestamp) {
  const normUid = String(uid || "").trim();
  const normRole = String(role || "user").trim();
  const normBan = ban === true ? "1" : "0";
  const normAllowed = isAllowed === true ? "1" : "0";
  const normTime = String(timestamp || "0").trim();
  
  const rawString = `${SALT}|${normUid}|${normRole}|${normBan}|${normAllowed}|${normTime}|${SALT}`;
  return sha256(rawString);
}

/**
 * Verifies that the cached data has a valid signature and hasn't been tampered with
 */
export function verifyCacheSignature(cached) {
  if (!cached || typeof cached !== 'object') return false;
  if (!cached.uid || !cached.signature) return false;
  
  const expectedSig = calculateCacheSignature(
    cached.uid,
    cached.role,
    cached.ban,
    cached.is_allowed,
    cached.timestamp
  );
  
  return expectedSig === cached.signature;
}
