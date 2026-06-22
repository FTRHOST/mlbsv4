LOCAL_PATH := $(call my-dir)

# 1. Declare the prebuilt static library for frida-gumjs
include $(CLEAR_VARS)
LOCAL_MODULE := frida-gumjs
LOCAL_SRC_FILES := sdk/$(TARGET_ARCH_ABI)/libfrida-gumjs.a
include $(PREBUILT_STATIC_LIBRARY)

# 2. Build our shared library (libmypatch.so)
include $(CLEAR_VARS)
LOCAL_MODULE := mypatch
LOCAL_SRC_FILES := main.cpp

# Enable exceptions and RTTI
LOCAL_CPPFLAGS := -fexceptions -frtti

# Include path for frida-gum/gumjs headers
LOCAL_C_INCLUDES := $(LOCAL_PATH)/sdk

# Link the static library
LOCAL_STATIC_LIBRARIES := frida-gumjs

# Specify Android system libraries needed by Frida-Gum
LOCAL_LDLIBS := -llog -landroid -lz -lm -ldl

include $(BUILD_SHARED_LIBRARY)

# 3. Build our bootstrap loader library (libmyloader.so)
include $(CLEAR_VARS)
LOCAL_MODULE := myloader
LOCAL_SRC_FILES := loader.cpp

# Enable exceptions and RTTI
LOCAL_CPPFLAGS := -fexceptions -frtti

# Specify Android system libraries needed by Loader
LOCAL_LDLIBS := -llog -landroid -lz -lm -ldl

include $(BUILD_SHARED_LIBRARY)

