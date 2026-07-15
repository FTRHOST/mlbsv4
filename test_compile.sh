#!/bin/bash
# Mock ndk-build just to verify syntax
g++ -std=c++14 -fsyntax-only -I native-patcher/jni native-patcher/jni/main.cpp -I native-patcher/jni/sdk/include
