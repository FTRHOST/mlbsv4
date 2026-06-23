# Compile for modern 64-bit and backwards compatible 32-bit ARM architectures
APP_ABI := arm64-v8a armeabi-v7a

# Minimum platform version (Lollipop 5.0)
APP_PLATFORM := android-21

# Use LLVM libc++ static runtime
APP_STL := c++_static
