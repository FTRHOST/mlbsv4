import re
import os

def encrypt_string(plain_text, xor_key):
    return [ord(c) ^ xor_key for c in plain_text]

def main():
    main_cpp_path = 'native-patcher/jni/main.cpp'
    header_path = 'native-patcher/jni/sample_js_bytes.h'
    
    with open(main_cpp_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find sample_js raw string
    # std::string sample_js = R"raw(CONTENT)raw";
    pattern = r'(std::string sample_js = R"raw\()(.*?)(\)raw";)'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print("Could not find sample_js in main.cpp")
        return

    sample_js_content = match.group(2)
    xor_key = 0x5C # Different key from hook_bytes
    encrypted_bytes = encrypt_string(sample_js_content, xor_key)

    # Generate header file
    with open(header_path, 'w', encoding='utf-8') as f:
        f.write('/* Automatically generated. Do not edit. */\n')
        f.write('#ifndef SAMPLE_JS_BYTES_H\n')
        f.write('#define SAMPLE_JS_BYTES_H\n\n')
        f.write(f'const unsigned char sample_js_xor_key = 0x{xor_key:02x};\n')
        f.write(f'const unsigned int sample_js_bytes_len = {len(encrypted_bytes)};\n\n')
        f.write('const unsigned char sample_js_bytes[] = {\n    ')
        
        for i, b in enumerate(encrypted_bytes):
            f.write(f'0x{b:02x}')
            if i < len(encrypted_bytes) - 1:
                f.write(', ')
                if (i + 1) % 12 == 0:
                    f.write('\n    ')
        
        f.write('\n};\n\n')
        f.write('#endif\n')

    # Replace in main.cpp
    replacement = """#include "sample_js_bytes.h"
            if (existing_js.empty()) {
                // Create a sample script if missing
                unsigned char *decrypted_sample = (unsigned char *)malloc(sample_js_bytes_len + 1);
                std::string sample_js = "";
                if (decrypted_sample) {
                    for (unsigned int i = 0; i < sample_js_bytes_len; i++) {
                        decrypted_sample[i] = sample_js_bytes[i] ^ sample_js_xor_key;
                    }
                    decrypted_sample[sample_js_bytes_len] = '\\0';
                    sample_js = (const char*)decrypted_sample;
                    free(decrypted_sample);
                }
                if (!sample_js.empty() && write_file(ext_js_path, sample_js)) {"""
    
    # We need to replace the whole block including the #include if possible, 
    # but let's just replace the specific section.
    # The pattern matches: std::string sample_js = R"raw(...)raw";
    # We also need to add #include "sample_js_bytes.h" at the top of the file or near the usage.
    
    new_content = content.replace(match.group(0), replacement.replace('#include "sample_js_bytes.h"\n', ''))
    
    # Add #include at the top if not present
    if '#include "sample_js_bytes.h"' not in new_content:
        new_content = new_content.replace('#include "hook_bytes.h"', '#include "hook_bytes.h"\n#include "sample_js_bytes.h"')
        
    with open(main_cpp_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Successfully encrypted sample_js and updated {main_cpp_path}")

if __name__ == '__main__':
    main()
