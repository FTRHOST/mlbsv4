#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Help command output
show_help() {
    echo "Usage: ./build.sh [options]"
    echo "Options:"
    echo "  --all         Build everything (JS encryption fallback, myloader, and mypatch) [Default]"
    echo "  --js-only     Only run encrypt.py to generate hook_bytes.h from scripts/hook.js"
    echo "  --loader-only Only compile libmyloader.so (Bootstrap Loader)"
    echo "  --patch-only  Only compile libmypatch.so (Payload Engine)"
    echo "  --clean       Clean NDK compilation objects and output libraries"
    echo "  -h, --help    Show this help message"
}

# Parse options
BUILD_JS=true
BUILD_LOADER=true
BUILD_PATCH=true
CLEAN_ONLY=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --all) BUILD_JS=true; BUILD_LOADER=true; BUILD_PATCH=true; shift ;;
        --js-only) BUILD_JS=true; BUILD_LOADER=false; BUILD_PATCH=false; shift ;;
        --loader-only) BUILD_JS=false; BUILD_LOADER=true; BUILD_PATCH=false; shift ;;
        --patch-only) BUILD_JS=false; BUILD_LOADER=false; BUILD_PATCH=true; shift ;;
        --clean) CLEAN_ONLY=true; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown parameter: $1"; show_help; exit 1 ;;
    esac
done

# Perform clean if requested
if [ "$CLEAN_ONLY" = true ]; then
    echo "=== Cleaning NDK build files ==="
    if command -v ndk-build &> /dev/null; then
        ndk-build -C . clean
    else
        rm -rf obj/ libs/
        echo "Removed obj/ and libs/ directories manually."
    fi
    echo "Clean complete."
    exit 0
fi

# Step 1: Encrypt JS Hook if requested
if [ "$BUILD_JS" = true ]; then
    echo "=== Step 1: Encrypting JS Hook ==="
    python3 encrypt.py
fi

# Step 2: Compile native libraries using ndk-build
if [ "$BUILD_LOADER" = true ] || [ "$BUILD_PATCH" = true ]; then
    echo ""
    echo "=== Step 2: Compiling Native Library ==="
    
    # Check for ndk-build in PATH
    if ! command -v ndk-build &> /dev/null; then
        echo "Error: 'ndk-build' not found in PATH."
        echo "Please set your NDK path, for example:"
        echo "export PATH=\$PATH:/path/to/android-ndk"
        exit 1
    fi

    # Determine what modules to build
    MODULES=""
    if [ "$BUILD_LOADER" = true ] && [ "$BUILD_PATCH" = true ]; then
        ndk-build -C .
    elif [ "$BUILD_LOADER" = true ]; then
        ndk-build -C . APP_MODULES=myloader
    elif [ "$BUILD_PATCH" = true ]; then
        ndk-build -C . APP_MODULES=mypatch
    fi
fi

echo ""
echo "=== Build Successful! ==="
echo "You can find your compiled libraries in the libs/ folder:"
ls -R libs/ 2>/dev/null || echo "libs/ folder (empty)"
