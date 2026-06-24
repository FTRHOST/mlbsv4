#include <jni.h>
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <android/log.h>
#include <sstream>
#include <fstream>
#include <string>
#include <cstdio>
#include "patch_config.h"
#include "frida-gumjs.h"
#include "hook_bytes.h"

#include <time.h>
#include <stdarg.h>

#define LOG_TAG "NativePatcher"

extern std::string g_log_dir;
void write_ota_log(const char *format, ...);
bool is_user_admin_local(const std::string &working_dir);
std::string decrypt_cache_script(const std::string &enc);
extern const std::string MAGIC_ENC_HEADER;
bool g_enable_logging = false;

#define LOGI(...) write_ota_log(__VA_ARGS__)
#define LOGE(...) write_ota_log(__VA_ARGS__)

// Global JavaVM reference
JavaVM *g_vm = NULL;

// Global variables for realtime Frida hot reloading
static GumScript *g_current_script = NULL;
static GumScriptBackend *g_backend = NULL;
static std::string g_current_script_hash = "";
static std::string g_server_url = "";
static std::string g_working_dir = "";
static int g_timeout_ms = 5000;

// RSA-2048 Public Key in DER format (placeholder).
// Please replace this with your actual DER public key from `xxd -i public_key.der`.
const unsigned char rsa_public_key[] = {
    0x30, 0x82, 0x01, 0x22, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 
    0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x03, 0x82, 0x01, 0x0f, 0x00, 
    0x30, 0x82, 0x01, 0x0a, 0x02, 0x82, 0x01, 0x01, 0x00, 0x8f, 0xb9, 0x89, 
    0xbb, 0x3b, 0xe1, 0xde, 0x0f, 0x48, 0x91, 0x92, 0xad, 0x1a, 0xa2, 0x0b, 
    0x39, 0xd9, 0x49, 0x6d, 0x6a, 0x54, 0xf6, 0x26, 0xcf, 0xd2, 0xc1, 0x32, 
    0x81, 0x2a, 0x36, 0x3e, 0x1a, 0x97, 0x45, 0x51, 0xf5, 0xc3, 0xce, 0x58, 
    0xa9, 0x82, 0x75, 0xf6, 0x75, 0x94, 0xc2, 0x33, 0xc2, 0x00, 0xd2, 0x53, 
    0x51, 0x77, 0xa2, 0x0c, 0x73, 0xed, 0x35, 0x44, 0x78, 0x1c, 0xfa, 0x89, 
    0xcd, 0x20, 0xba, 0xc4, 0xbe, 0x6a, 0x8f, 0xae, 0xb3, 0x4b, 0xba, 0x29, 
    0x23, 0x10, 0x09, 0x3f, 0x4d, 0xc3, 0x29, 0xba, 0x70, 0xab, 0x11, 0x3d, 
    0xe6, 0x6f, 0xd0, 0x80, 0x5a, 0xf6, 0x01, 0x24, 0x35, 0xa6, 0x18, 0xb6, 
    0x17, 0xb2, 0xd1, 0xfd, 0x2d, 0xc1, 0x51, 0x6f, 0x92, 0xaf, 0x1b, 0x84, 
    0x98, 0xa8, 0xef, 0x4d, 0x25, 0xde, 0xe4, 0xe1, 0x53, 0x5d, 0x47, 0x8d, 
    0x4e, 0x79, 0x4a, 0x74, 0x34, 0xf0, 0x06, 0xc6, 0x0e, 0xa3, 0x7a, 0x24, 
    0x6a, 0x7f, 0xd0, 0x64, 0x0c, 0x44, 0x02, 0xbc, 0x9c, 0x07, 0x5f, 0xdb, 
    0xe0, 0x37, 0xea, 0xd7, 0x76, 0x0f, 0x1b, 0xde, 0x8c, 0x0e, 0x41, 0x86, 
    0x7e, 0xab, 0xcc, 0x76, 0xed, 0x13, 0x85, 0xd1, 0x2e, 0xb1, 0x9c, 0x22, 
    0xba, 0x90, 0xff, 0xd1, 0xe6, 0x29, 0xfe, 0xd7, 0x42, 0xe2, 0xc1, 0xb8, 
    0x30, 0x5a, 0x23, 0xc2, 0x0d, 0x50, 0xfe, 0xa2, 0x17, 0xa9, 0x5a, 0x27, 
    0xb6, 0x55, 0x20, 0xfc, 0x01, 0x14, 0x41, 0xda, 0x67, 0x5a, 0xf1, 0x78, 
    0x4c, 0xb9, 0x2b, 0x43, 0x84, 0x27, 0xc4, 0x25, 0x8b, 0x08, 0xff, 0x72, 
    0xd1, 0xa5, 0xa0, 0x7e, 0x01, 0xae, 0x2c, 0xa0, 0xc3, 0x53, 0x6b, 0x23, 
    0xc7, 0x38, 0x8e, 0x9b, 0xc0, 0x68, 0x70, 0xb3, 0xe2, 0xc0, 0x4b, 0xc9, 
    0x3f, 0xf4, 0xa7, 0xfd, 0x77, 0x86, 0x40, 0xc1, 0x19, 0x22, 0x42, 0xde, 
    0x1d, 0x02, 0x03, 0x01, 0x00, 0x01
};

// Dummy function to force the linker to resolve C++ standard library iostream symbols
__attribute__((used)) void __force_stl_linking_dummy() {
    std::basic_stringstream<char> ss;
    ss << "Force linker to load C++ streams";
    std::string str = ss.str();
    
    std::basic_stringbuf<char> sb;
    sb.str(str);
    
    std::basic_filebuf<char> fb;
    fb.open("/dev/null", std::ios_base::out);
    fb.close();
    
    std::basic_ofstream<char> ofs;
    ofs.open("/dev/null");
    ofs << str;
    ofs.close();
}

// Implement the verbose abort function expected by modern Frida-GumJS static binaries
#if defined(_LIBCPP_VERSION) && _LIBCPP_VERSION >= 180000
#define ABORT_NOEXCEPT noexcept
#else
#define ABORT_NOEXCEPT
#endif

namespace std {
    inline namespace __ndk1 {
        __attribute__((visibility("default"))) __attribute__((noreturn))
        void __libcpp_verbose_abort(const char* format, ...) ABORT_NOEXCEPT {
            abort();
        }
    }
}

// Explicit strong template instantiations to force compiler to emit these symbols
template class std::basic_filebuf<char>;
template class std::basic_stringbuf<char>;
template class std::basic_stringstream<char>;
template class std::basic_ostringstream<char>;
template class std::basic_ofstream<char>;

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

std::string get_working_dir(JNIEnv *env, jobject context) {
    if (!context) return "";
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
    return "";
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
    
    jmethodID set_req_prop = env->GetMethodID(conn_class, "setRequestProperty", "(Ljava/lang/String;Ljava/lang/String;)V");
    if (set_req_prop) {
        jstring ua_key = env->NewStringUTF("User-Agent");
        jstring ua_val = env->NewStringUTF("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36");
        env->CallVoidMethod(conn_obj, set_req_prop, ua_key, ua_val);
        env->DeleteLocalRef(ua_key);
        env->DeleteLocalRef(ua_val);
        check_and_clear_exceptions(env);
    }

    jmethodID get_response_code = env->GetMethodID(conn_class, "getResponseCode", "()I");
    if (get_response_code) {
        jint response_code = env->CallIntMethod(conn_obj, get_response_code);
        if (check_and_clear_exceptions(env) || response_code != 200) {
             return "";
        }
    }

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

static std::string g_user_info_json = "";
static std::string g_async_user_response = "";
static bool g_async_user_response_ready = false;
static std::string g_async_m_ui_id = "";

std::string get_android_id(JNIEnv *env) {
    if (!env) return "0000000000000000";
    jclass act_thread_class = env->FindClass("android/app/ActivityThread");
    if (env->ExceptionCheck() || !act_thread_class) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    jmethodID current_app_method = env->GetStaticMethodID(act_thread_class, "currentApplication", "()Landroid/app/Application;");
    if (env->ExceptionCheck() || !current_app_method) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    jobject app_obj = env->CallStaticObjectMethod(act_thread_class, current_app_method);
    if (env->ExceptionCheck() || !app_obj) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    
    jclass context_class = env->FindClass("android/content/Context");
    if (env->ExceptionCheck() || !context_class) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    jmethodID get_resolver_method = env->GetMethodID(context_class, "getContentResolver", "()Landroid/content/ContentResolver;");
    if (env->ExceptionCheck() || !get_resolver_method) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    jobject resolver_obj = env->CallObjectMethod(app_obj, get_resolver_method);
    if (env->ExceptionCheck() || !resolver_obj) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    
    jclass secure_class = env->FindClass("android/provider/Settings$Secure");
    if (env->ExceptionCheck() || !secure_class) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    jmethodID get_string_method = env->GetStaticMethodID(secure_class, "getString", "(Landroid/content/ContentResolver;Ljava/lang/String;)Ljava/lang/String;");
    if (env->ExceptionCheck() || !get_string_method) {
        env->ExceptionClear();
        return "0000000000000000";
    }
    jstring j_android_id_prop = env->NewStringUTF("android_id");
    jstring j_android_id = (jstring)env->CallStaticObjectMethod(secure_class, get_string_method, resolver_obj, j_android_id_prop);
    env->DeleteLocalRef(j_android_id_prop);
    if (env->ExceptionCheck()) {
        env->ExceptionClear();
    }
    
    std::string android_id = "0000000000000000";
    if (j_android_id) {
        const char *str = env->GetStringUTFChars(j_android_id, NULL);
        if (str) {
            android_id = str;
            env->ReleaseStringUTFChars(j_android_id, str);
        }
        env->DeleteLocalRef(j_android_id);
    }
    return android_id;
}

extern "C" __attribute__((visibility("default"))) const char* register_user_native(const char *m_ui_id) {
    g_user_info_json = "";
    if (!g_vm) return g_user_info_json.c_str();
    JNIEnv *env = NULL;
    jint res = g_vm->GetEnv((void**)&env, JNI_VERSION_1_6);
    bool attached = false;
    if (res == JNI_EDETACHED) {
        if (g_vm->AttachCurrentThread(&env, NULL) != 0) {
            LOGE("Failed to attach thread for JNI registration");
            return g_user_info_json.c_str();
        }
        attached = true;
    }
    
    if (env) {
        std::string android_id = get_android_id(env);
        LOGI("Attempting native registration. Android ID: %s, Game ID: %s", android_id.c_str(), m_ui_id);
        
        std::string base_url = "https://mlbsv4.vercel.app";
        if (!g_server_url.empty()) {
            size_t last_slash = g_server_url.find_last_of('/');
            if (last_slash != std::string::npos) {
                base_url = g_server_url.substr(0, last_slash);
            } else {
                base_url = g_server_url;
            }
        }
        
        jclass url_class = env->FindClass("java/net/URL");
        if (url_class) {
            jmethodID url_ctor = env->GetMethodID(url_class, "<init>", "(Ljava/lang/String;)V");
            std::string post_url = base_url + "/api/users";
            jstring j_url_str = env->NewStringUTF(post_url.c_str());
            jobject url_obj = env->NewObject(url_class, url_ctor, j_url_str);
            env->DeleteLocalRef(j_url_str);
            
            if (url_obj) {
                jmethodID open_conn = env->GetMethodID(url_class, "openConnection", "()Ljava/net/URLConnection;");
                jobject conn_obj = env->CallObjectMethod(url_obj, open_conn);
                
                if (conn_obj) {
                    jclass conn_class = env->FindClass("java/net/HttpURLConnection");
                    if (conn_class) {
                        jmethodID set_method = env->GetMethodID(conn_class, "setRequestMethod", "(Ljava/lang/String;)V");
                        jmethodID set_prop = env->GetMethodID(conn_class, "setRequestProperty", "(Ljava/lang/String;Ljava/lang/String;)V");
                        jmethodID set_do_output = env->GetMethodID(conn_class, "setDoOutput", "(Z)V");
                        jmethodID set_conn_timeout = env->GetMethodID(conn_class, "setConnectTimeout", "(I)V");
                        
                        jstring j_post = env->NewStringUTF("POST");
                        env->CallVoidMethod(conn_obj, set_method, j_post);
                        env->DeleteLocalRef(j_post);
                        
                        jstring j_content_type = env->NewStringUTF("Content-Type");
                        jstring j_json = env->NewStringUTF("application/json");
                        env->CallVoidMethod(conn_obj, set_prop, j_content_type, j_json);
                        env->DeleteLocalRef(j_content_type);
                        env->DeleteLocalRef(j_json);
                        
                        jstring j_api_key_header = env->NewStringUTF("x-api-key");
                        jstring j_api_key_val = env->NewStringUTF("mlbs_secret_token_2026");
                        env->CallVoidMethod(conn_obj, set_prop, j_api_key_header, j_api_key_val);
                        env->DeleteLocalRef(j_api_key_header);
                        env->DeleteLocalRef(j_api_key_val);
                        
                        env->CallVoidMethod(conn_obj, set_do_output, JNI_TRUE);
                        env->CallVoidMethod(conn_obj, set_conn_timeout, 10000);
                        
                        jmethodID get_output_stream = env->GetMethodID(conn_class, "getOutputStream", "()Ljava/io/OutputStream;");
                        jobject os_obj = env->CallObjectMethod(conn_obj, get_output_stream);
                        if (os_obj) {
                            jclass os_class = env->FindClass("java/io/OutputStream");
                            jmethodID write_bytes = env->GetMethodID(os_class, "write", "([B)V");
                            jmethodID close_os = env->GetMethodID(os_class, "close", "()V");
                            
                            std::string body = "{\"uid\":\"" + android_id + "\",\"m_uiID\":\"" + std::string(m_ui_id) + "\"}";
                            jbyteArray j_body_bytes = env->NewByteArray(body.length());
                            env->SetByteArrayRegion(j_body_bytes, 0, body.length(), (const jbyte*)body.data());
                            
                            env->CallVoidMethod(os_obj, write_bytes, j_body_bytes);
                            env->CallVoidMethod(os_obj, close_os);
                            env->DeleteLocalRef(j_body_bytes);
                        }
                        
                        jmethodID get_response_code = env->GetMethodID(conn_class, "getResponseCode", "()I");
                        jint code = env->CallIntMethod(conn_obj, get_response_code);
                        LOGI("User registration API response code: %d", code);
                        
                        jmethodID disconnect = env->GetMethodID(conn_class, "disconnect", "()V");
                        env->CallVoidMethod(conn_obj, disconnect);
                    }
                }
            }
        }
        if (env->ExceptionCheck()) {
            env->ExceptionClear();
        }
        
        // Now call GET user info using android_id as primary key
        std::string get_url = base_url + "/api/users/" + android_id;
        LOGI("Fetching user info from: %s", get_url.c_str());
        g_user_info_json = download_url(env, get_url, 10000);
        
        // Update logging flag dynamically based on the server-returned role
        if (!g_user_info_json.empty()) {
            if (g_user_info_json.find("\"role\":\"admin\"") != std::string::npos) {
                g_enable_logging = true;
            } else {
                g_enable_logging = false;
            }
        }
        
        LOGI("User info fetched: %s", g_user_info_json.c_str());
        
        if (env->ExceptionCheck()) {
            env->ExceptionClear();
        }
    }
    
    if (attached) {
        g_vm->DetachCurrentThread();
    }
    
    return g_user_info_json.c_str();
}

void* register_user_worker(void* arg) {
    JNIEnv *env = NULL;
    if (!g_vm) {
        g_async_user_response_ready = true;
        return NULL;
    }
    jint res = g_vm->AttachCurrentThread(&env, NULL);
    if (res != 0 || !env) {
        LOGE("Failed to attach worker thread to JVM");
        g_async_user_response_ready = true;
        return NULL;
    }

    std::string android_id = get_android_id(env);
    LOGI("Attempting background native registration. Android ID: %s, Game ID: %s", android_id.c_str(), g_async_m_ui_id.c_str());
    
    std::string base_url = "https://mlbsv4.vercel.app";
    if (!g_server_url.empty()) {
        size_t last_slash = g_server_url.find_last_of('/');
        if (last_slash != std::string::npos) {
            base_url = g_server_url.substr(0, last_slash);
        } else {
            base_url = g_server_url;
        }
    }
    
    jclass url_class = env->FindClass("java/net/URL");
    if (url_class) {
        jmethodID url_ctor = env->GetMethodID(url_class, "<init>", "(Ljava/lang/String;)V");
        std::string post_url = base_url + "/api/users";
        jstring j_url_str = env->NewStringUTF(post_url.c_str());
        jobject url_obj = env->NewObject(url_class, url_ctor, j_url_str);
        env->DeleteLocalRef(j_url_str);
        
        if (url_obj) {
            jmethodID open_conn = env->GetMethodID(url_class, "openConnection", "()Ljava/net/URLConnection;");
            jobject conn_obj = env->CallObjectMethod(url_obj, open_conn);
            
            if (conn_obj) {
                jclass conn_class = env->FindClass("java/net/HttpURLConnection");
                if (conn_class) {
                    jmethodID set_method = env->GetMethodID(conn_class, "setRequestMethod", "(Ljava/lang/String;)V");
                    jmethodID set_prop = env->GetMethodID(conn_class, "setRequestProperty", "(Ljava/lang/String;Ljava/lang/String;)V");
                    jmethodID set_do_output = env->GetMethodID(conn_class, "setDoOutput", "(Z)V");
                    jmethodID set_conn_timeout = env->GetMethodID(conn_class, "setConnectTimeout", "(I)V");
                    
                    jstring j_post = env->NewStringUTF("POST");
                    env->CallVoidMethod(conn_obj, set_method, j_post);
                    env->DeleteLocalRef(j_post);
                    
                    jstring j_content_type = env->NewStringUTF("Content-Type");
                    jstring j_json = env->NewStringUTF("application/json");
                    env->CallVoidMethod(conn_obj, set_prop, j_content_type, j_json);
                    env->DeleteLocalRef(j_content_type);
                    env->DeleteLocalRef(j_json);
                    
                    jstring j_api_key_header = env->NewStringUTF("x-api-key");
                    jstring j_api_key_val = env->NewStringUTF("mlbs_secret_token_2026");
                    env->CallVoidMethod(conn_obj, set_prop, j_api_key_header, j_api_key_val);
                    env->DeleteLocalRef(j_api_key_header);
                    env->DeleteLocalRef(j_api_key_val);
                    
                    env->CallVoidMethod(conn_obj, set_do_output, JNI_TRUE);
                    env->CallVoidMethod(conn_obj, set_conn_timeout, 10000);
                    
                    jmethodID get_output_stream = env->GetMethodID(conn_class, "getOutputStream", "()Ljava/io/OutputStream;");
                    jobject os_obj = env->CallObjectMethod(conn_obj, get_output_stream);
                    if (os_obj) {
                        jclass os_class = env->FindClass("java/io/OutputStream");
                        jmethodID write_bytes = env->GetMethodID(os_class, "write", "([B)V");
                        jmethodID close_os = env->GetMethodID(os_class, "close", "()V");
                        
                        std::string body = "{\"uid\":\"" + android_id + "\",\"m_uiID\":\"" + g_async_m_ui_id + "\"}";
                        jbyteArray j_body_bytes = env->NewByteArray(body.length());
                        env->SetByteArrayRegion(j_body_bytes, 0, body.length(), (const jbyte*)body.data());
                        
                        env->CallVoidMethod(os_obj, write_bytes, j_body_bytes);
                        env->CallVoidMethod(os_obj, close_os);
                        env->DeleteLocalRef(j_body_bytes);
                    }
                    
                    jmethodID get_response_code = env->GetMethodID(conn_class, "getResponseCode", "()I");
                    jint code = env->CallIntMethod(conn_obj, get_response_code);
                    LOGI("User background registration API response code: %d", code);
                    
                    jmethodID disconnect = env->GetMethodID(conn_class, "disconnect", "()V");
                    env->CallVoidMethod(conn_obj, disconnect);
                }
            }
        }
    }
    if (env->ExceptionCheck()) {
        env->ExceptionClear();
    }
    
    // Now call GET user info using android_id as primary key
    std::string get_url = base_url + "/api/users/" + android_id;
    LOGI("Fetching user info from: %s (background)", get_url.c_str());
    g_async_user_response = download_url(env, get_url, 10000);
    
    // Update logging flag dynamically based on the server-returned role
    if (!g_async_user_response.empty()) {
        if (g_async_user_response.find("\"role\":\"admin\"") != std::string::npos) {
            g_enable_logging = true;
        } else {
            g_enable_logging = false;
        }
    }
    
    LOGI("User info fetched in background: %s", g_async_user_response.c_str());
    
    if (env->ExceptionCheck()) {
        env->ExceptionClear();
    }

    g_async_user_response_ready = true;
    g_vm->DetachCurrentThread();
    return NULL;
}

extern "C" __attribute__((visibility("default"))) void register_user_native_async(const char *m_ui_id) {
    g_async_user_response = "";
    g_async_user_response_ready = false;
    g_async_m_ui_id = m_ui_id ? m_ui_id : "";
    
    pthread_t thread;
    if (pthread_create(&thread, NULL, register_user_worker, NULL) == 0) {
        pthread_detach(thread);
    } else {
        LOGE("Failed to create background worker thread for registration");
        g_async_user_response_ready = true;
    }
}

extern "C" __attribute__((visibility("default"))) const char* get_async_registration_response() {
    return g_async_user_response.c_str();
}

extern "C" __attribute__((visibility("default"))) bool is_async_registration_ready() {
    return g_async_user_response_ready;
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
    jmethodID sig_get_instance = env->GetStaticMethodID(sig_class, "getInstance", "(Ljava/lang/String;)Ljava/security/Signature;");
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

std::string g_log_dir = "";
pthread_mutex_t g_log_mutex = PTHREAD_MUTEX_INITIALIZER;

void write_ota_log(const char *format, ...) {
    if (!g_enable_logging) {
        return;
    }

    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    // 1. Log to Android logcat
    __android_log_print(ANDROID_LOG_INFO, "NativePatcher", "%s", buffer);

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

// Frida script message redirector to Logcat
static void on_message(const gchar *message, GBytes *data, gpointer user_data) {
    if (!g_enable_logging) {
        return;
    }

    JsonParser *parser = json_parser_new();
    if (json_parser_load_from_data(parser, message, -1, NULL)) {
        JsonNode *root_node = json_parser_get_root(parser);
        JsonObject *root = json_node_get_object(root_node);
        if (json_object_has_member(root, "type")) {
            const gchar *type = json_object_get_string_member(root, "type");
            if (strcmp(type, "log") == 0 && json_object_has_member(root, "payload")) {
                const gchar *log_message = json_object_get_string_member(root, "payload");
                __android_log_print(ANDROID_LOG_INFO, "FridaJS", "%s", log_message);
            } else {
                __android_log_print(ANDROID_LOG_INFO, "FridaJS", "%s", message);
            }
        }
    }
    g_object_unref(parser);
}

bool is_user_admin_local(const std::string &working_dir) {
    std::string cache_path = working_dir + "/auth_cache.json";
    std::ifstream file(cache_path.c_str());
    if (!file.good()) {
        file.close();
        return false;
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    file.close();
    std::string content = buffer.str();
    
    // Trim leading whitespace
    size_t first = content.find_first_not_of(" \t\r\n");
    if (first != std::string::npos) {
        content = content.substr(first);
    }
    
    if (!content.empty() && content[0] == '{' && content.find("\"role\":\"admin\"") != std::string::npos) {
        return true;
    }
    return false;
}

const unsigned char CACHE_XOR_KEY = 0x5B;
const std::string MAGIC_ENC_HEADER = "ENC\x01";

std::string encrypt_cache_script(const std::string &plain) {
    std::string enc = MAGIC_ENC_HEADER;
    for (size_t i = 0; i < plain.length(); i++) {
        enc += (char)(plain[i] ^ CACHE_XOR_KEY);
    }
    return enc;
}

std::string decrypt_cache_script(const std::string &enc) {
    if (enc.length() < MAGIC_ENC_HEADER.length() || enc.substr(0, MAGIC_ENC_HEADER.length()) != MAGIC_ENC_HEADER) {
        return "";
    }
    std::string plain = "";
    for (size_t i = MAGIC_ENC_HEADER.length(); i < enc.length(); i++) {
        plain += (char)(enc[i] ^ CACHE_XOR_KEY);
    }
    return plain;
}

static void load_frida_script(const std::string &js_code) {
    if (g_current_script != NULL) {
        LOGI("Unloading old Frida script...");
        gum_script_unload_sync(g_current_script, NULL);
        g_object_unref(g_current_script);
        g_current_script = NULL;
    }
    
    LOGI("Loading Frida script...");
    GError *error = NULL;
    g_current_script = gum_script_backend_create_sync(g_backend, "hook", js_code.c_str(), NULL, NULL, &error);
    if (error != NULL) {
        LOGE("Error creating hooking script: %s", error->message);
        g_clear_error(&error);
        return;
    }
    
    gum_script_set_message_handler(g_current_script, on_message, NULL, NULL);
    gum_script_load_sync(g_current_script, NULL);
    LOGI("Frida script loaded and executed successfully!");
}

static gboolean check_ota_update_timer(gpointer data) {
    JNIEnv *env = NULL;
    if (g_vm->GetEnv((void**)&env, JNI_VERSION_1_6) == JNI_EDETACHED) {
        if (g_vm->AttachCurrentThread(&env, NULL) != 0) {
            LOGE("[OTA Timer] Failed to attach thread to JVM");
            return TRUE;
        }
    }
    
    if (g_server_url.empty()) return TRUE;
    
    std::string sig_url = g_server_url + ".sig";
    // LOGI("[OTA Timer] Checking for realtime script update...");
    
    std::string ota_js = download_url(env, g_server_url, g_timeout_ms);
    std::string ota_sig = download_url(env, sig_url, g_timeout_ms);
    
    if (!ota_js.empty() && !ota_sig.empty()) {
        // Check if cache files exist on disk
        std::string cache_path = g_working_dir + "/hook_cache.js";
        std::string sig_path = g_working_dir + "/hook_cache.js.sig";
        std::ifstream cache_file(cache_path.c_str());
        std::ifstream sig_file(sig_path.c_str());
        bool cache_missing = !cache_file.good() || !sig_file.good();
        cache_file.close();
        sig_file.close();

        if (ota_js != g_current_script_hash || cache_missing) {
            LOGI("[OTA Timer] Update or missing cache detected! Verifying signature...");
            if (verify_rsa_signature(env, ota_js, ota_sig, rsa_public_key, sizeof(rsa_public_key))) {
                
                // Save to cache
                bool is_admin = is_user_admin_local(g_working_dir);
                if (is_admin) {
                    write_file(cache_path, ota_js);
                    LOGI("[OTA Timer] Saved plaintext cache for admin.");
                } else {
                    std::string encrypted_js = encrypt_cache_script(ota_js);
                    write_file(cache_path, encrypted_js);
                    LOGI("[OTA Timer] Saved encrypted cache for non-admin.");
                }
                write_file(sig_path, ota_sig);
                
                // Hot reload only if it is a new version
                if (ota_js != g_current_script_hash) {
                    LOGI("[OTA Timer] Performing HOT RELOAD!");
                    load_frida_script(ota_js);
                    g_current_script_hash = ota_js;
                } else {
                    LOGI("[OTA Timer] Local cache populated successfully.");
                }
            } else {
                LOGE("[OTA Timer] Signature verification FAILED for updated/missing script!");
            }
        }
    }
    
    return TRUE; // Continue calling this timer callback
}

// Forward declaration helper for the initial one-shot timer
static gboolean check_ota_update_timer_initial(gpointer data) {
    check_ota_update_timer(NULL);
    g_timeout_add(10000, check_ota_update_timer, NULL);
    return FALSE; // Return FALSE so it only runs once
}

// Native Patcher background thread
static void *patcher_thread(void *arg) {
    LOGI("Patcher thread started. Waiting 1 second before initializing JNI...");
    sleep(1);
    
    JNIEnv *env = NULL;
    jint res = g_vm->GetEnv((void**)&env, JNI_VERSION_1_6);
    bool attached = false;
    if (res == JNI_EDETACHED) {
        if (g_vm->AttachCurrentThread(&env, NULL) != 0) {
            LOGE("Failed to attach patcher thread to JVM");
            return NULL;
        }
        attached = true;
    }
    
    jobject context = get_context(env);
    std::string working_dir = get_working_dir(env, context);
    g_log_dir = working_dir;
    g_working_dir = working_dir;
    
    g_enable_logging = is_user_admin_local(working_dir);
    
    // Clean up log file if user is non-admin
    if (!g_enable_logging && !g_log_dir.empty()) {
        std::string log_path = g_log_dir + "/ota_log.txt";
        remove(log_path.c_str());
    }
    
    LOGI("Working directory: %s", working_dir.c_str());
    
    PatchConfig config = PatchConfig::load(working_dir);
    std::string server_url = config.server_url;
    int timeout_ms = config.timeout_ms;
    
    // Store configuration to globals
    g_server_url = server_url;
    g_timeout_ms = timeout_ms;
    
    std::string js_code_str = "";
    
    std::string cached_js = read_file(working_dir + "/hook_cache.js");
    std::string cached_sig = read_file(working_dir + "/hook_cache.js.sig");
    if (!cached_js.empty() && !cached_sig.empty()) {
        bool is_admin = is_user_admin_local(working_dir);
        std::string processed_js = "";
        bool loaded_ok = false;
        
        if (cached_js.compare(0, MAGIC_ENC_HEADER.length(), MAGIC_ENC_HEADER) == 0) {
            // It is encrypted
            processed_js = decrypt_cache_script(cached_js);
            loaded_ok = !processed_js.empty();
        } else {
            // It is plaintext
            if (is_admin) {
                processed_js = cached_js;
                loaded_ok = true;
            } else {
                LOGE("Plaintext cached script is not allowed for non-admin users! Rejecting and deleting.");
                std::string cache_path = working_dir + "/hook_cache.js";
                std::string sig_path = working_dir + "/hook_cache.js.sig";
                remove(cache_path.c_str());
                remove(sig_path.c_str());
                loaded_ok = false;
            }
        }
        
        if (loaded_ok && verify_rsa_signature(env, processed_js, cached_sig, rsa_public_key, sizeof(rsa_public_key))) {
            LOGI("Cached script signature verified. Loading cache.");
            js_code_str = processed_js;
        } else {
            LOGE("Cached script verification or signature check FAILED!");
        }
    }

    if (js_code_str.empty()) {
        LOGI("Loading built-in fallback script...");
        unsigned char *decrypted = (unsigned char *)malloc(hook_bytes_len + 1);
        if (decrypted) {
            for (unsigned int i = 0; i < hook_bytes_len; i++) {
                decrypted[i] = hook_bytes[i] ^ xor_key;
            }
            decrypted[hook_bytes_len] = '\0';
            js_code_str = (const char*)decrypted;
            free(decrypted);
        }
    }
    
    if (js_code_str.empty()) {
        LOGE("No valid hook script available to execute!");
        return NULL;
    }
    
    LOGI("Initializing Frida-Gum runtime...");
    gum_init_embedded();
    
    g_backend = gum_script_backend_obtain_qjs();
    if (!g_backend) {
        LOGE("Failed to load QuickJS backend engine");
        return NULL;
    }
    
    g_current_script_hash = js_code_str;
    load_frida_script(js_code_str);
    
    // Check for realtime updates: first check in 2 seconds, then every 10 seconds.
    g_timeout_add(2000, check_ota_update_timer_initial, NULL);
    
    GMainLoop *loop = g_main_loop_new(NULL, FALSE);
    g_main_loop_run(loop);
    
    return NULL;
}

// Android entry point
extern "C" jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    LOGI("libmypatch.so successfully loaded by target APK.");
    g_vm = vm;
    
    if (reserved == (void*)0x9999) {
        __force_stl_linking_dummy();
    }
    
    pthread_t thread;
    if (pthread_create(&thread, NULL, patcher_thread, NULL) != 0) {
        LOGE("Failed to spawn patcher background thread");
    } else {
        pthread_detach(thread);
    }
    
    return JNI_VERSION_1_6;
}
