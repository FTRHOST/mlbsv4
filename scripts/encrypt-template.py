import sys

def encrypt(data, key=0x5a):
    return bytes([b ^ key for b in data])

if len(sys.argv) < 2:
    print("Usage: python scripts/encrypt-template.py <input_file> <output_header>")
    sys.exit(1)

input_file = sys.argv[1]
output_header = sys.argv[2]

with open(input_file, 'rb') as f:
    data = f.read()

encrypted = encrypt(data)

with open(output_header, 'w') as f:
    f.write('/* Automatically generated. Do not edit. */\n')
    f.write('#ifndef TEMPLATE_BYTES_H\n')
    f.write('#define TEMPLATE_BYTES_H\n\n')
    f.write(f'const unsigned int template_bytes_len = {len(encrypted)};\n')
    f.write('const unsigned char template_bytes[] = {\n    ')
    for i, b in enumerate(encrypted):
        f.write(f'0x{b:02x}, ')
        if (i + 1) % 12 == 0:
            f.write('\n    ')
    f.write('\n};\n\n')
    f.write('#endif\n')

print(f"Encrypted {len(data)} bytes to {output_header}")
