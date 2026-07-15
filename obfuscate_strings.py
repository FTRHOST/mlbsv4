import re

with open('native-patcher/jni/main.cpp', 'r') as f:
    content = f.read()

# Add include for obfuscate.h
if '#include "obfuscate.h"' not in content:
    content = content.replace('#include "hook_bytes.h"', '#include "hook_bytes.h"\n#include "obfuscate.h"')

# Replace strings with OBFUSCATE macro
strings_to_obfuscate = [
    r'"https://mlbsv4\.vercel\.app"',
    r'"mlbs_secret_token_2026"',
    r'"Mozilla/5\.0 \(Linux; Android 10; K\) AppleWebKit/537\.36 \(KHTML, like Gecko\) Chrome/124\.0\.0\.0 Mobile Safari/537\.36"',
    r'"x-api-key"',
    r'"User-Agent"',
    r'"Content-Type"',
    r'"application/json"',
    r'"android/app/ActivityThread"',
    r'"currentApplication"',
    r'"\(\)Landroid/app/Application;"',
    r'"getFilesDir"',
    r'"\(\)Ljava/io/File;"',
    r'"getAbsolutePath"',
    r'"\(\)Ljava/lang/String;"',
    r'"getExternalFilesDir"',
    r'"\(Ljava/lang/String;\)Ljava/io/File;"',
    r'"java/net/URL"',
    r'"<init>"',
    r'"\(Ljava/lang/String;\)V"',
    r'"openConnection"',
    r'"\(\)Ljava/net/URLConnection;"',
    r'"java/net/HttpURLConnection"',
    r'"setConnectTimeout"',
    r'"\(I\)V"',
    r'"setReadTimeout"',
    r'"setRequestProperty"',
    r'"\(Ljava/lang/String;Ljava/lang/String;\)V"',
    r'"getResponseCode"',
    r'"\(\)I"',
    r'"getInputStream"',
    r'"\(\)Ljava/io/InputStream;"',
    r'"java/io/InputStream"',
    r'"read"',
    r'"\(\[B\)I"',
    r'"close"',
    r'"\(\)V"',
    r'"java/io/ByteArrayOutputStream"',
    r'"write"',
    r'"\(\[BII\)V"',
    r'"toByteArray"',
    r'"\(\)\[B"',
    r'"android/content/Context"',
    r'"getContentResolver"',
    r'"\(\)Landroid/content/ContentResolver;"',
    r'"android/provider/Settings\$Secure"',
    r'"getString"',
    r'"\(Landroid/content/ContentResolver;Ljava/lang/String;\)Ljava/lang/String;"',
    r'"android_id"',
    r'"setRequestMethod"',
    r'"setDoOutput"',
    r'"\(Z\)V"',
    r'"POST"',
    r'"getOutputStream"',
    r'"\(\)Ljava/io/OutputStream;"',
    r'"java/io/OutputStream"',
    r'"\(\[B\)V"',
    r'"disconnect"',
    r'"java/security/KeyFactory"',
    r'"getInstance"',
    r'"\(Ljava/lang/String;\)Ljava/security/KeyFactory;"',
    r'"RSA"',
    r'"java/security/spec/X509EncodedKeySpec"',
    r'"\(\[B\)V"',
    r'"generatePublic"',
    r'"\(Ljava/security/spec/KeySpec;\)Ljava/security/PublicKey;"',
    r'"java/security/Signature"',
    r'"\(Ljava/lang/String;\)Ljava/security/Signature;"',
    r'"SHA256withRSA"',
    r'"initVerify"',
    r'"\(Ljava/security/PublicKey;\)V"',
    r'"update"',
    r'"verify"',
    r'"\(\[B\)Z"',
    r'"java/io/File"',
    r'"exists"',
    r'"\(\)Z"',
    r'"java/io/FileInputStream"',
    r'"\(Ljava/io/File;\)V"',
]

for s in strings_to_obfuscate:
    # Use re.sub to carefully replace exact string literals
    # We want to match "string" but not something like "string123" if it's a partial match.
    # The raw string in the list already includes quotes.
    pattern = re.compile(s)
    content = pattern.sub(lambda match: f'OBFUSCATE({match.group(0)})', content)

with open('native-patcher/jni/main.cpp', 'w') as f:
    f.write(content)
