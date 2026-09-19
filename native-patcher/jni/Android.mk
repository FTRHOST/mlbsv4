LOCAL_PATH := $(call my-dir)

# 1. Prebuilt static frida-gumjs
include $(CLEAR_VARS)
LOCAL_MODULE := frida-gumjs-static
LOCAL_SRC_FILES := sdk/$(TARGET_ARCH_ABI)/libfrida-gumjs.a
include $(PREBUILT_STATIC_LIBRARY)

# 2. Build shared frida engine (the big one)
include $(CLEAR_VARS)
LOCAL_MODULE := frida-gumjs
LOCAL_SRC_FILES := dummy.cpp
LOCAL_WHOLE_STATIC_LIBRARIES := frida-gumjs-static
LOCAL_LDLIBS := -llog -landroid -lz -lm -ldl
# dummy.cpp only exists to materialize libc++ iostream symbols needed by the
# prebuilt archive. They are unreferenced, so --gc-sections would discard
# them and the link fails with undefined std::__ndk1::basic_filebuf etc.
# Keep everything in this repackaging module (size impact is negligible).
LOCAL_LDFLAGS := -Wl,--no-gc-sections
include $(BUILD_SHARED_LIBRARY)

# 3. Build our shared library (libmypatch.so)
include $(CLEAR_VARS)
LOCAL_MODULE := mypatch
LOCAL_SRC_FILES := main.cpp

# Enable exceptions and RTTI
LOCAL_CPPFLAGS := -fexceptions -frtti

# Include path for frida-gum/gumjs headers
LOCAL_C_INCLUDES := $(LOCAL_PATH)/sdk

# Dynamically link frida-gumjs
LOCAL_SHARED_LIBRARIES := frida-gumjs

# Specify Android system libraries needed by Frida-Gum
LOCAL_LDLIBS := -llog -landroid -lz -lm -ldl

include $(BUILD_SHARED_LIBRARY)

# 4. Build our bootstrap loader library (libmyloader.so)
include $(CLEAR_VARS)
LOCAL_MODULE := myloader
LOCAL_SRC_FILES := loader.cpp

# Enable exceptions and RTTI
LOCAL_CPPFLAGS := -fexceptions -frtti

# Specify Android system libraries needed by Loader
LOCAL_LDLIBS := -llog -landroid -lz -lm -ldl

include $(BUILD_SHARED_LIBRARY)
