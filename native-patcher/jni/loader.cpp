#include <jni.h>
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <android/log.h>
#include <dlfcn.h>
#include <sstream>
#include <fstream>
#include <string>

#define LOG_TAG "NativeLoader"

#include <time.h>
#include <stdarg.h>

std::string g_log_dir = "";
void write_ota_log(const char *format, ...);

#define LOGI(...) write_ota_log(__VA_ARGS__)
#define LOGE(...) write_ota_log(__VA_ARGS__)

// Global JavaVM reference
JavaVM *g_vm = NULL;

// RSA-2048 Public Key in DER format (placeholder).
// Automatically updated by generate-keys.js.
const unsigned char rsa_public_key[] = {
    0x30, 0x82, 0x01, 0x22, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 
    0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x03, 0x82, 0x01, 0x0f, 0x00, 
    0x30, 0x82, 0x01, 0x0a, 0x02, 0x82, 0x01, 0x01, 0x00, 0xb8, 0xc9, 0x36, 
    0x4a, 0xce, 0x9c, 0xa1, 0xea, 0x47, 0xa6, 0xa0, 0x27, 0x89, 0x30, 0xcb, 
    0x73, 0xf2, 0xfe, 0x28, 0x16, 0xce, 0x85, 0x21, 0xf0, 0x25, 0x27, 0xc1, 
    0x05, 0x4e, 0x41, 0xd4, 0xe9, 0x9f, 0x0d, 0x43, 0x21, 0x04, 0xb0, 0x1e, 
    0xd4, 0xbd, 0x1a, 0xa7, 0x65, 0x72, 0x98, 0x77, 0xf4, 0x91, 0x66, 0xf0, 
    0x7a, 0x48, 0xcb, 0x97, 0xba, 0xc2, 0x01, 0xd8, 0xe7, 0x65, 0xba, 0xbe, 
    0xcd, 0x90, 0x3a, 0xf4, 0x2a, 0x02, 0xfd, 0x34, 0xdb, 0xf9, 0x81, 0xa0, 
    0x59, 0x08, 0x78, 0xb5, 0xbf, 0xd2, 0xa2, 0xf8, 0x8a, 0x01, 0x32, 0x8a, 
    0x13, 0x93, 0xfe, 0x16, 0x9a, 0xe7, 0x9b, 0xec, 0xcc, 0xfd, 0xed, 0x34, 
    0x51, 0xc8, 0x8d, 0x7b, 0x51, 0x21, 0xb6, 0xc4, 0x22, 0x1f, 0x34, 0x53, 
    0x14, 0xd1, 0x4a, 0xfc, 0xbe, 0x8a, 0xed, 0x58, 0x4c, 0xc4, 0xf1, 0x62, 
    0x5c, 0xca, 0x94, 0xc5, 0x7e, 0x8f, 0xd2, 0xa6, 0xa6, 0xdb, 0x03, 0x22, 
    0xf8, 0x19, 0x1a, 0x65, 0x40, 0x8a, 0xb5, 0x67, 0x85, 0x0f, 0x46, 0xda, 
    0xbe, 0x57, 0x91, 0xbd, 0x5c, 0x6c, 0xac, 0x2d, 0x98, 0xf4, 0x4f, 0xe5, 
    0xd6, 0x52, 0xf6, 0xa4, 0x29, 0x2a, 0x5c, 0x14, 0x00, 0x08, 0x8c, 0x11, 
    0x0e, 0x28, 0x35, 0xa0, 0x8d, 0xa5, 0xf8, 0x4f, 0xbb, 0x60, 0x17, 0x86, 
    0xb1, 0x99, 0xb3, 0xa3, 0x77, 0x69, 0x03, 0xf4, 0x8d, 0x5c, 0x1e, 0x46, 
    0xfd, 0x1b, 0x09, 0xfe, 0xc0, 0xb2, 0x74, 0x9b, 0x6e, 0xf4, 0x52, 0xf6, 
    0x68, 0xe7, 0x62, 0xd3, 0xf7, 0xfe, 0x3c, 0x6f, 0xb2, 0x4c, 0x92, 0xb7, 
    0x87, 0x9e, 0xc5, 0x13, 0xad, 0x4d, 0x7b, 0xde, 0xe2, 0x10, 0x12, 0x55, 
    0xdd, 0x67, 0xa7, 0xa7, 0x53, 0x90, 0xf5, 0x1e, 0xd7, 0x67, 0x77, 0x02, 
    0xde, 0x57, 0x44, 0x6f, 0xf7, 0xb3, 0x07, 0xfa, 0x3c, 0xdb, 0x54, 0xfc, 
    0x99, 0x02, 0x03, 0x01, 0x00, 0x01
};

// Helper function to check and clear JNI exceptions to prevent crashing
bool check_and_clear_exceptions(JNIEnv *env) {
    if (env->ExceptionCheck()) {
        env->ExceptionDescribe();
        env->ExceptionClear();
        return true;
    }
    return false;
}

// JNI Helper: Retrieve application context dynamically
jobject get_context(JNIEnv *env) {
    jclass activity_thread = env->FindClass("android/app/ActivityThread");
    if (!activity_thread || check_and_clear_exceptions(env)) return NULL;
    
    jmethodID current_app = env->GetStaticMethodID(activity_thread, "currentApplication", "()Landroid/app/Application;");
    if (!current_app || check_and_clear_exceptions(env)) return NULL;
    
    jobject context = env->CallStaticObjectMethod(activity_thread, current_app);
    if (check_and_clear_exceptions(env)) return NULL;
    
    return context;
}

// JNI Helper: Read an asset file from APK
std::string read_asset(JNIEnv *env, jobject context, const std::string &asset_name) {
    if (!context) return "";
    jclass context_class = env->GetObjectClass(context);
    jmethodID get_assets = env->GetMethodID(context_class, "getAssets", "()Landroid/content/res/AssetManager;");
    if (!get_assets || check_and_clear_exceptions(env)) return "";
    jobject asset_manager = env->CallObjectMethod(context, get_assets);
    if (!asset_manager || check_and_clear_exceptions(env)) return "";
    
    jclass am_class = env->GetObjectClass(asset_manager);
    jmethodID open_method = env->GetMethodID(am_class, "open", "(Ljava/lang/String;)Ljava/io/InputStream;");
    if (!open_method || check_and_clear_exceptions(env)) return "";
    
    jstring j_asset_name = env->NewStringUTF(asset_name.c_str());
    jobject stream_obj = env->CallObjectMethod(asset_manager, open_method, j_asset_name);
    env->DeleteLocalRef(j_asset_name);
    if (check_and_clear_exceptions(env) || !stream_obj) return "";
    
    jclass stream_class = env->FindClass("java/io/InputStream");
    jmethodID read_method = env->GetMethodID(stream_class, "read", "([B)I");
    jmethodID close_method = env->GetMethodID(stream_class, "close", "()V");
    
    jclass baos_class = env->FindClass("java/io/ByteArrayOutputStream");
    jmethodID baos_ctor = env->GetMethodID(baos_class, "<init>", "()V");
    jobject baos_obj = env->NewObject(baos_class, baos_ctor);
    
    jmethodID baos_write = env->GetMethodID(baos_class, "write", "([BII)V");
    jmethodID baos_to_array = env->GetMethodID(baos_class, "toByteArray", "()[B");
    
    jbyteArray buffer = env->NewByteArray(1024);
    jint bytes_read = 0;
    while (true) {
        bytes_read = env->CallIntMethod(stream_obj, read_method, buffer);
        if (check_and_clear_exceptions(env) || bytes_read == -1) break;
        env->CallVoidMethod(baos_obj, baos_write, buffer, 0, bytes_read);
        if (check_and_clear_exceptions(env)) break;
    }
    
    env->CallVoidMethod(stream_obj, close_method);
    check_and_clear_exceptions(env);
    
    jbyteArray result_bytes = (jbyteArray)env->CallObjectMethod(baos_obj, baos_to_array);
    if (check_and_clear_exceptions(env) || !result_bytes) return "";
    
    jsize len = env->GetArrayLength(result_bytes);
    jbyte *bytes = env->GetByteArrayElements(result_bytes, NULL);
    std::string response((char *)bytes, len);
    env->ReleaseByteArrayElements(result_bytes, bytes, JNI_ABORT);
    
    return response;
}

// JNI Helper: Download raw bytes from URL using HttpURLConnection
std::string download_url(JNIEnv *env, const std::string &url_str, int timeout_ms) {
    jclass url_class = env->FindClass("java/net/URL");
    if (!url_class || check_and_clear_exceptions(env)) return "";
    
    jmethodID url_ctor = env->GetMethodID(url_class, "<init>", "(Ljava/lang/String;)V");
    if (!url_ctor || check_and_clear_exceptions(env)) return "";
    
    jstring jurl_str = env->NewStringUTF(url_str.c_str());
    jobject url_obj = env->NewObject(url_class, url_ctor, jurl_str);
    env->DeleteLocalRef(jurl_str);
    if (check_and_clear_exceptions(env) || !url_obj) return "";
    
    jmethodID open_conn = env->GetMethodID(url_class, "openConnection", "()Ljava/net/URLConnection;");
    if (!open_conn || check_and_clear_exceptions(env)) return "";
    
    jobject conn_obj = env->CallObjectMethod(url_obj, open_conn);
    if (check_and_clear_exceptions(env) || !conn_obj) return "";
    
    jclass conn_class = env->FindClass("java/net/HttpURLConnection");
    if (!conn_class || check_and_clear_exceptions(env)) return "";
    
    jmethodID set_conn_timeout = env->GetMethodID(conn_class, "setConnectTimeout", "(I)V");
    jmethodID set_read_timeout = env->GetMethodID(conn_class, "setReadTimeout", "(I)V");
    if (set_conn_timeout) env->CallVoidMethod(conn_obj, set_conn_timeout, timeout_ms);
    if (set_read_timeout) env->CallVoidMethod(conn_obj, set_read_timeout, timeout_ms);
    check_and_clear_exceptions(env);
    
    jmethodID get_input_stream = env->GetMethodID(conn_class, "getInputStream", "()Ljava/io/InputStream;");
    if (!get_input_stream || check_and_clear_exceptions(env)) return "";
    
    jobject stream_obj = env->CallObjectMethod(conn_obj, get_input_stream);
    if (check_and_clear_exceptions(env) || !stream_obj) return "";
    
    jclass stream_class = env->FindClass("java/io/InputStream");
    jmethodID read_method = env->GetMethodID(stream_class, "read", "([B)I");
    jmethodID close_method = env->GetMethodID(stream_class, "close", "()V");
    
    jclass baos_class = env->FindClass("java/io/ByteArrayOutputStream");
    jmethodID baos_ctor = env->GetMethodID(baos_class, "<init>", "()V");
    jobject baos_obj = env->NewObject(baos_class, baos_ctor);
    
    jmethodID baos_write = env->GetMethodID(baos_class, "write", "([BII)V");
    jmethodID baos_to_array = env->GetMethodID(baos_class, "toByteArray", "()[B");
    
    jbyteArray buffer = env->NewByteArray(4096);
    jint bytes_read = 0;
    
    while (true) {
        bytes_read = env->CallIntMethod(stream_obj, read_method, buffer);
        if (check_and_clear_exceptions(env) || bytes_read == -1) break;
        env->CallVoidMethod(baos_obj, baos_write, buffer, 0, bytes_read);
        if (check_and_clear_exceptions(env)) break;
    }
    
    env->CallVoidMethod(stream_obj, close_method);
    check_and_clear_exceptions(env);
    
    jbyteArray result_bytes = (jbyteArray)env->CallObjectMethod(baos_obj, baos_to_array);
    if (check_and_clear_exceptions(env) || !result_bytes) return "";
    
    jsize len = env->GetArrayLength(result_bytes);
    jbyte *bytes = env->GetByteArrayElements(result_bytes, NULL);
    std::string response((char *)bytes, len);
    env->ReleaseByteArrayElements(result_bytes, bytes, JNI_ABORT);
    
    return response;
}

// JNI Helper: Verify RSA signature using SHA256withRSA
bool verify_rsa_signature(JNIEnv *env, const std::string &data, const std::string &sig_data, const unsigned char *pub_key_bytes, int pub_key_len) {
    jclass key_factory_class = env->FindClass("java/security/KeyFactory");
    if (!key_factory_class || check_and_clear_exceptions(env)) return false;
    
    jmethodID kf_get_instance = env->GetStaticMethodID(key_factory_class, "getInstance", "(Ljava/lang/String;)Ljava/security/KeyFactory;");
    jstring j_rsa = env->NewStringUTF("RSA");
    jobject kf_obj = env->CallStaticObjectMethod(key_factory_class, kf_get_instance, j_rsa);
    env->DeleteLocalRef(j_rsa);
    if (check_and_clear_exceptions(env) || !kf_obj) return false;
    
    jclass x509_spec_class = env->FindClass("java/security/spec/X509EncodedKeySpec");
    jmethodID spec_ctor = env->GetMethodID(x509_spec_class, "<init>", "([B)V");
    
    jbyteArray j_key_bytes = env->NewByteArray(pub_key_len);
    env->SetByteArrayRegion(j_key_bytes, 0, pub_key_len, (const jbyte*)pub_key_bytes);
    jobject spec_obj = env->NewObject(x509_spec_class, spec_ctor, j_key_bytes);
    env->DeleteLocalRef(j_key_bytes);
    if (check_and_clear_exceptions(env) || !spec_obj) return false;
    
    jmethodID kf_gen_public = env->GetMethodID(key_factory_class, "generatePublic", "(Ljava/security/spec/KeySpec;)Ljava/security/PublicKey;");
    jobject pub_key_obj = env->CallObjectMethod(kf_obj, kf_gen_public, spec_obj);
    if (check_and_clear_exceptions(env) || !pub_key_obj) return false;
    
    jclass sig_class = env->FindClass("java/security/Signature");
    jmethodID sig_get_instance = env->GetStaticMethodID(sig_class, "getInstance", "(Ljava/security/Signature;");
    if (!sig_get_instance) {
        sig_get_instance = env->GetStaticMethodID(sig_class, "getInstance", "(Ljava/lang/String;)Ljava/security/Signature;");
    }
    jstring j_sha256 = env->NewStringUTF("SHA256withRSA");
    jobject sig_obj = env->CallStaticObjectMethod(sig_class, sig_get_instance, j_sha256);
    env->DeleteLocalRef(j_sha256);
    if (check_and_clear_exceptions(env) || !sig_obj) return false;
    
    jmethodID sig_init_verify = env->GetMethodID(sig_class, "initVerify", "(Ljava/security/PublicKey;)V");
    env->CallVoidMethod(sig_obj, sig_init_verify, pub_key_obj);
    if (check_and_clear_exceptions(env)) return false;
    
    jmethodID sig_update = env->GetMethodID(sig_class, "update", "([B)V");
    jbyteArray j_data_bytes = env->NewByteArray(data.length());
    env->SetByteArrayRegion(j_data_bytes, 0, data.length(), (const jbyte*)data.data());
    env->CallVoidMethod(sig_obj, sig_update, j_data_bytes);
    env->DeleteLocalRef(j_data_bytes);
    if (check_and_clear_exceptions(env)) return false;
    
    jmethodID sig_verify = env->GetMethodID(sig_class, "verify", "([B)Z");
    jbyteArray j_sig_bytes = env->NewByteArray(sig_data.length());
    env->SetByteArrayRegion(j_sig_bytes, 0, sig_data.length(), (const jbyte*)sig_data.data());
    jboolean verified = env->CallBooleanMethod(sig_obj, sig_verify, j_sig_bytes);
    env->DeleteLocalRef(j_sig_bytes);
    if (check_and_clear_exceptions(env)) return false;
    
    return (verified == JNI_TRUE);
}

// Light C++ Parser: Extract simple XML tag values
std::string parse_xml_tag(const std::string &xml_content, const std::string &tag) {
    std::string start_tag = "<" + tag + ">";
    std::string end_tag = "</" + tag + ">";
    size_t start_pos = xml_content.find(start_tag);
    if (start_pos == std::string::npos) return "";
    start_pos += start_tag.length();
    size_t end_pos = xml_content.find(end_tag, start_pos);
    if (end_pos == std::string::npos) return "";
    return xml_content.substr(start_pos, end_pos - start_pos);
}

// Load existing config, or write default XML config file
std::string load_or_create_config(const std::string &working_dir) {
    std::string config_path = working_dir + "/patch_config.xml";
    std::ifstream infile(config_path.c_str());
    if (infile.good()) {
        std::stringstream buffer;
        buffer << infile.rdbuf();
        infile.close();
        return buffer.str();
    }
    infile.close();
    
    std::string default_config = 
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
        "<patch-config>\n"
        "    <server-url>https://mlbsv4.vercel.app/hook.js</server-url>\n"
        "    <timeout-ms>5000</timeout-ms>\n"
        "</patch-config>\n";
        
    std::ofstream outfile(config_path.c_str());
    if (outfile.is_open()) {
        outfile << default_config;
        outfile.close();
        LOGI("Created default configuration file at: %s", config_path.c_str());
    }
    return default_config;
}

// Simple File Writers/Readers
bool write_file(const std::string &path, const std::string &content) {
    std::ofstream outfile(path.c_str(), std::ios::binary);
    if (outfile.is_open()) {
        outfile.write(content.data(), content.length());
        outfile.close();
        return true;
    }
    return false;
}

std::string read_file(const std::string &path) {
    std::ifstream infile(path.c_str(), std::ios::binary);
    if (infile.good()) {
        std::stringstream buffer;
        buffer << infile.rdbuf();
        infile.close();
        return buffer.str();
    }
    infile.close();
    return "";
}

pthread_mutex_t g_log_mutex = PTHREAD_MUTEX_INITIALIZER;

void write_ota_log(const char *format, ...) {
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    // 1. Log to Android logcat
    __android_log_print(ANDROID_LOG_INFO, "NativeLoader", "%s", buffer);

    // 2. Append to log file in configuration directory
    pthread_mutex_lock(&g_log_mutex);
    if (!g_log_dir.empty()) {
        std::string log_path = g_log_dir + "/ota_log.txt";
        std::ofstream outfile(log_path.c_str(), std::ios::app);
        if (outfile.is_open()) {
            time_t now = time(0);
            struct tm *tstruct = localtime(&now);
            char time_buf[80];
            if (tstruct) {
                strftime(time_buf, sizeof(time_buf), "%Y-%m-%d %X", tstruct);
                outfile << "[" << time_buf << "] " << buffer << "\n";
            } else {
                outfile << buffer << "\n";
            }
            outfile.close();
        }
    }
    pthread_mutex_unlock(&g_log_mutex);
}

std::string get_internal_dir(JNIEnv *env, jobject context) {
    if (!context) return "/data/local/tmp";
    jclass context_class = env->GetObjectClass(context);
    jmethodID get_files_dir = env->GetMethodID(context_class, "getFilesDir", "()Ljava/io/File;");
    if (get_files_dir && !check_and_clear_exceptions(env)) {
        jobject file_obj = env->CallObjectMethod(context, get_files_dir);
        if (file_obj && !check_and_clear_exceptions(env)) {
            jclass file_class = env->GetObjectClass(file_obj);
            jmethodID get_absolute_path = env->GetMethodID(file_class, "getAbsolutePath", "()Ljava/lang/String;");
            jstring path_str = (jstring)env->CallObjectMethod(file_obj, get_absolute_path);
            if (path_str && !check_and_clear_exceptions(env)) {
                const char *path_chars = env->GetStringUTFChars(path_str, NULL);
                std::string path(path_chars);
                env->ReleaseStringUTFChars(path_str, path_chars);
                return path;
            }
        }
    }
    return "/data/local/tmp";
}

std::string get_working_dir(JNIEnv *env, jobject context) {
    if (!context) return "/data/local/tmp";
    jclass context_class = env->GetObjectClass(context);
    jmethodID get_ext_files_dir = env->GetMethodID(context_class, "getExternalFilesDir", "(Ljava/lang/String;)Ljava/io/File;");
    jobject file_obj = NULL;
    
    if (get_ext_files_dir && !check_and_clear_exceptions(env)) {
        file_obj = env->CallObjectMethod(context, get_ext_files_dir, NULL);
        check_and_clear_exceptions(env);
    }
    
    if (!file_obj) {
        jmethodID get_files_dir = env->GetMethodID(context_class, "getFilesDir", "()Ljava/io/File;");
        if (get_files_dir && !check_and_clear_exceptions(env)) {
            file_obj = env->CallObjectMethod(context, get_files_dir);
            check_and_clear_exceptions(env);
        }
    }
    
    if (!file_obj) return "/data/local/tmp";
    
    jclass file_class = env->GetObjectClass(file_obj);
    jmethodID get_absolute_path = env->GetMethodID(file_class, "getAbsolutePath", "()Ljava/lang/String;");
    jstring path_str = (jstring)env->CallObjectMethod(file_obj, get_absolute_path);
    if (check_and_clear_exceptions(env) || !path_str) return "/data/local/tmp";
    
    const char *path_chars = env->GetStringUTFChars(path_str, NULL);
    std::string path(path_chars);
    env->ReleaseStringUTFChars(path_str, path_chars);
    
    return path;
}

// Native Patcher background thread
static void *loader_thread(void *arg) {
    LOGI("Loader thread started. Waiting 1 second before initializing JNI...");
    sleep(1);
    
    JNIEnv *env = NULL;
    jint res = g_vm->GetEnv((void**)&env, JNI_VERSION_1_6);
    bool attached = false;
    if (res == JNI_EDETACHED) {
        if (g_vm->AttachCurrentThread(&env, NULL) != 0) {
            LOGE("Failed to attach loader thread to JVM");
            return NULL;
        }
        attached = true;
    }
    
    jobject context = get_context(env);
    std::string working_dir = get_working_dir(env, context);
    std::string internal_dir = get_internal_dir(env, context);
    
    // Initialize global log directory for writing ota_log.txt
    g_log_dir = working_dir;
    
    // Truncate ota_log.txt on startup
    if (!g_log_dir.empty()) {
        std::string log_path = g_log_dir + "/ota_log.txt";
        std::ofstream outfile(log_path.c_str(), std::ios::trunc);
        if (outfile.is_open()) {
            outfile << "=== OTA Loader Session Started ===\n";
            outfile.close();
        }
    }
    
    LOGI("Loader configuration directory (working_dir): %s", working_dir.c_str());
    LOGI("Loader cache directory (internal_dir): %s", internal_dir.c_str());
    
    std::string xml_content = load_or_create_config(working_dir);
    std::string server_url = parse_xml_tag(xml_content, "server-url");
    std::string timeout_str = parse_xml_tag(xml_content, "timeout-ms");
    int timeout_ms = 5000;
    if (!timeout_str.empty()) {
        timeout_ms = atoi(timeout_str.c_str());
    }
    
    std::string payload_path = internal_dir + "/libmypatch_cache.so";
    std::string payload_sig_path = payload_path + ".sig";
    
    // Step 1: Determine the signature of our current active library
    std::string current_sig = "";
    bool has_cached_lib = false;
    
    // Check if cache file exists and has a signature
    std::ifstream cache_file(payload_path.c_str());
    if (cache_file.good()) {
        cache_file.close();
        current_sig = read_file(payload_sig_path);
        if (!current_sig.empty()) {
            has_cached_lib = true;
            LOGI("Found cached payload library. Current signature length: %d", (int)current_sig.length());
        }
    } else {
        cache_file.close();
    }
    
    // If no cache signature, check the built-in library signature from APK assets
    if (current_sig.empty() && context) {
        current_sig = read_asset(env, context, "libmypatch.so.sig");
        if (!current_sig.empty()) {
            LOGI("Found built-in library signature in assets. Current signature length: %d", (int)current_sig.length());
        } else {
            LOGI("Built-in library signature not found in assets.");
        }
    }
    
    bool needs_download = false;
    std::string ota_sig = "";
    
    if (!server_url.empty()) {
        size_t last_slash = server_url.find_last_of('/');
        std::string base_url = (last_slash != std::string::npos) ? server_url.substr(0, last_slash) : server_url;
        std::string lib_url = base_url + "/libmypatch.so";
        std::string sig_url = lib_url + ".sig";
        
        LOGI("Attempting to download remote library signature from: %s", sig_url.c_str());
        ota_sig = download_url(env, sig_url, timeout_ms);
        
        if (!ota_sig.empty()) {
            if (ota_sig == current_sig) {
                LOGI("OTA check: Remote library signature matches current local library. Skipping download.");
            } else {
                LOGI("OTA check: Remote library signature differs (or local is missing). New library version is available.");
                needs_download = true;
            }
        } else {
            LOGE("Failed to download library signature from OTA URL. Offline or server error.");
        }
        
        if (needs_download) {
            LOGI("Attempting OTA Library download from: %s", lib_url.c_str());
            std::string ota_lib = download_url(env, lib_url, timeout_ms);
            if (!ota_lib.empty()) {
                LOGI("Downloaded library. Verifying RSA Digital Signature...");
                if (verify_rsa_signature(env, ota_lib, ota_sig, rsa_public_key, sizeof(rsa_public_key))) {
                    LOGI("Library signature verification SUCCESS! Saving new library to cache.");
                    if (write_file(payload_path, ota_lib)) {
                        write_file(payload_sig_path, ota_sig);
                        has_cached_lib = true;
                    } else {
                        LOGE("Failed to write downloaded library to cache directory!");
                    }
                } else {
                    LOGE("Library signature verification FAILED for downloaded OTA library!");
                }
            } else {
                LOGE("Failed to download library binary from OTA URL.");
            }
        }
    }
    
    void *handle = NULL;
    
    // Try to load cached library first (if it exists and has a valid signature)
    if (has_cached_lib) {
        LOGI("Attempting to load cached library from cache path...");
        std::string cached_lib = read_file(payload_path);
        std::string cached_sig = read_file(payload_sig_path);
        if (!cached_lib.empty() && !cached_sig.empty()) {
            if (verify_rsa_signature(env, cached_lib, cached_sig, rsa_public_key, sizeof(rsa_public_key))) {
                LOGI("Cached library signature verified. Loading cache via dlopen...");
                handle = dlopen(payload_path.c_str(), RTLD_NOW);
                if (!handle) {
                    LOGE("Failed to load cached library via dlopen: %s", dlerror());
                }
            } else {
                LOGE("Cached library signature verification FAILED!");
            }
        }
    }
    
    // Fallback: Load built-in fallback libmypatch.so from APK library path
    if (!handle) {
        LOGI("Loading built-in fallback libmypatch.so from APK...");
        handle = dlopen("libmypatch.so", RTLD_NOW);
        if (!handle) {
            LOGE("Failed to load built-in fallback library libmypatch.so: %s", dlerror());
        }
    }
    
    if (attached) {
        g_vm->DetachCurrentThread();
    }
    
    if (handle) {
        LOGI("Dynamic library loaded successfully! Resolving JNI_OnLoad...");
        typedef jint (*JNI_OnLoad_t)(JavaVM*, void*);
        JNI_OnLoad_t target_JNI_OnLoad = (JNI_OnLoad_t)dlsym(handle, "JNI_OnLoad");
        if (target_JNI_OnLoad) {
            LOGI("Invoking JNI_OnLoad of target library...");
            target_JNI_OnLoad(g_vm, NULL);
        } else {
            LOGE("Failed to resolve JNI_OnLoad in target library");
        }
    } else {
        LOGE("No valid target library could be loaded!");
    }
    
    return NULL;
}

// Android entry point
extern "C" jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    LOGI("libmyloader.so (Bootstrap Loader) successfully loaded by target APK.");
    g_vm = vm;
    
    pthread_t thread;
    if (pthread_create(&thread, NULL, loader_thread, NULL) != 0) {
        LOGE("Failed to spawn loader background thread");
    } else {
        pthread_detach(thread);
    }
    
    return JNI_VERSION_1_6;
}
