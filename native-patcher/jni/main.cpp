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
#define LIBMYPATCH_SO
#include "patch_config.h"
#include "frida-gumjs.h"
#include "hook_bytes.h"

#include <time.h>
#include <stdarg.h>

#define LOG_TAG "NativePatcher"

extern std::string g_log_dir;
std::string g_external_dir = "";
void write_admin_log(const char *tag, const char *format, ...);
bool is_user_admin_local(const std::string &working_dir);
std::string decrypt_cache_script(const std::string &enc);
extern const std::string MAGIC_ENC_HEADER;
bool g_enable_logging = false;
bool g_is_admin = false;
#define LOGI(...) write_admin_log(LOG_TAG, __VA_ARGS__)
#define LOGE(...) write_admin_log(LOG_TAG, __VA_ARGS__)

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

std::string get_external_files_dir(JNIEnv *env, jobject context) {
    if (!context) return "";
    jclass context_class = env->GetObjectClass(context);
    jmethodID get_ext_files_dir = env->GetMethodID(context_class, "getExternalFilesDir", "(Ljava/lang/String;)Ljava/io/File;");
    if (get_ext_files_dir && !check_and_clear_exceptions(env)) {
        jobject file_obj = env->CallObjectMethod(context, get_ext_files_dir, NULL);
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
                g_is_admin = true;
                AdminDevConfig dev_config = AdminDevConfig::load(g_external_dir, g_working_dir);
                g_enable_logging = dev_config.log;
            } else {
                g_is_admin = false;
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
            g_is_admin = true;
            AdminDevConfig dev_config = AdminDevConfig::load(g_external_dir, g_working_dir);
            g_enable_logging = dev_config.log;
        } else {
            g_is_admin = false;
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

static std::string g_room_data_payload = "";

void* send_room_data_worker(void* arg) {
    if (!g_vm) return NULL;
    JNIEnv *env = NULL;
    jint res = g_vm->GetEnv((void**)&env, JNI_VERSION_1_6);
    bool attached = false;
    if (res == JNI_EDETACHED) {
        if (g_vm->AttachCurrentThread(&env, NULL) != 0) {
            LOGE("Failed to attach thread for room data sending");
            return NULL;
        }
        attached = true;
    }
    
    if (env) {
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
            std::string post_url = base_url + "/api/rooms";
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
                            
                            jbyteArray j_body_bytes = env->NewByteArray(g_room_data_payload.length());
                            env->SetByteArrayRegion(j_body_bytes, 0, g_room_data_payload.length(), (const jbyte*)g_room_data_payload.data());
                            
                            env->CallVoidMethod(os_obj, write_bytes, j_body_bytes);
                            env->CallVoidMethod(os_obj, close_os);
                            env->DeleteLocalRef(j_body_bytes);
                        }
                        
                        jmethodID get_response_code = env->GetMethodID(conn_class, "getResponseCode", "()I");
                        jint code = env->CallIntMethod(conn_obj, get_response_code);
                        LOGI("Room data send response code: %d", code);
                        
                        jmethodID disconnect = env->GetMethodID(conn_class, "disconnect", "()V");
                        env->CallVoidMethod(conn_obj, disconnect);
                    }
                }
            }
        }
    }
    if (env->ExceptionCheck()) {
        env->ExceptionClear();
    }
    if (attached) {
        g_vm->DetachCurrentThread();
    }
    return NULL;
}

extern "C" __attribute__((visibility("default"))) void send_room_data_native(const char *json_payload) {
    if (!json_payload) return;
    g_room_data_payload = json_payload;
    pthread_t thread;
    if (pthread_create(&thread, NULL, send_room_data_worker, NULL) == 0) {
        pthread_detach(thread);
    } else {
        LOGE("Failed to create background worker thread for room data sending");
    }
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

std::string read_file(const std::string &path);

// JNI Helper: Read file using Java API (more reliable for Android storage)
std::string read_file_jni(JNIEnv *env, const std::string &path) {
    if (!env || path.empty()) return "";
    
    jclass file_class = env->FindClass("java/io/File");
    jmethodID file_ctor = env->GetMethodID(file_class, "<init>", "(Ljava/lang/String;)V");
    jstring j_path = env->NewStringUTF(path.c_str());
    jobject file_obj = env->NewObject(file_class, file_ctor, j_path);
    
    jmethodID exists_method = env->GetMethodID(file_class, "exists", "()Z");
    if (!env->CallBooleanMethod(file_obj, exists_method)) {
        env->DeleteLocalRef(j_path);
        return "";
    }

    jclass fis_class = env->FindClass("java/io/FileInputStream");
    jmethodID fis_ctor = env->GetMethodID(fis_class, "<init>", "(Ljava/io/File;)V");
    jobject fis_obj = env->NewObject(fis_class, fis_ctor, file_obj);
    if (env->ExceptionCheck()) {
        env->ExceptionClear();
        env->DeleteLocalRef(j_path);
        return "";
    }

    // Read full file content
    jclass baos_class = env->FindClass("java/io/ByteArrayOutputStream");
    jmethodID baos_ctor = env->GetMethodID(baos_class, "<init>", "()V");
    jobject baos_obj = env->NewObject(baos_class, baos_ctor);
    
    jmethodID baos_write = env->GetMethodID(baos_class, "write", "([BII)V");
    jmethodID baos_to_array = env->GetMethodID(baos_class, "toByteArray", "()[B");
    jmethodID fis_read = env->GetMethodID(fis_class, "read", "([B)I");
    
    jbyteArray jbuffer = env->NewByteArray(4096);
    jint bytes_read;
    while ((bytes_read = env->CallIntMethod(fis_obj, fis_read, jbuffer)) != -1) {
        if (env->ExceptionCheck()) break;
        env->CallVoidMethod(baos_obj, baos_write, jbuffer, 0, bytes_read);
    }
    
    if (env->ExceptionCheck()) env->ExceptionClear();

    jbyteArray result_bytes = (jbyteArray)env->CallObjectMethod(baos_obj, baos_to_array);
    std::string content = "";
    if (result_bytes) {
        jsize len = env->GetArrayLength(result_bytes);
        jbyte *bytes = env->GetByteArrayElements(result_bytes, NULL);
        content.assign((char *)bytes, len);
        env->ReleaseByteArrayElements(result_bytes, bytes, JNI_ABORT);
    }
    
    jmethodID close_method = env->GetMethodID(fis_class, "close", "()V");
    env->CallVoidMethod(fis_obj, close_method);
    
    env->DeleteLocalRef(j_path);
    if (env->ExceptionCheck()) env->ExceptionClear();
    
    return content;
}

std::string read_file(const std::string &path) {
    if (path.empty()) return "";
    
    // Try C++ standard way first
    std::ifstream infile(path.c_str(), std::ios::binary);
    if (infile.good()) {
        std::stringstream buffer;
        buffer << infile.rdbuf();
        infile.close();
        return buffer.str();
    }
    infile.close();

    // If it fails, try JNI way (much more reliable on Android for data folders)
    if (g_vm) {
        JNIEnv *env = NULL;
        bool attached = false;
        if (g_vm->GetEnv((void**)&env, JNI_VERSION_1_6) == JNI_EDETACHED) {
            if (g_vm->AttachCurrentThread(&env, NULL) == 0) attached = true;
        }
        
        if (env) {
            std::string content = read_file_jni(env, path);
            if (attached) g_vm->DetachCurrentThread();
            if (!content.empty()) return content;
        }
    }
    
    return "";
}

std::string g_log_dir = "";
pthread_mutex_t g_log_mutex = PTHREAD_MUTEX_INITIALIZER;

void write_admin_log(const char *tag, const char *format, ...) {
    if (!g_is_admin) return;

    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    // 1. Log to Android logcat
    __android_log_print(ANDROID_LOG_INFO, tag, "%s", buffer);

    // 2. Append to log file in external directory if possible, else internal
    if (g_enable_logging) {
        pthread_mutex_lock(&g_log_mutex);
        std::string log_dir = !g_external_dir.empty() ? g_external_dir : g_log_dir;
        if (!log_dir.empty()) {
            std::string log_path = log_dir + "/log.txt";
            std::ofstream outfile(log_path.c_str(), std::ios::app);
            if (outfile.is_open()) {
                time_t now = time(0);
                struct tm *tstruct = localtime(&now);
                char time_buf[80];
                if (tstruct) {
                    strftime(time_buf, sizeof(time_buf), "%Y-%m-%d %X", tstruct);
                    outfile << "[" << time_buf << "] [" << tag << "] " << buffer << "\n";
                } else {
                    outfile << "[" << tag << "] " << buffer << "\n";
                }
                outfile.close();
            }
        }
        pthread_mutex_unlock(&g_log_mutex);
    }
}

// Frida script message redirector to Logcat
static void on_message(const gchar *message, GBytes *data, gpointer user_data) {
    if (!g_is_admin) return;

    JsonParser *parser = json_parser_new();
    if (json_parser_load_from_data(parser, message, -1, NULL)) {
        JsonNode *root_node = json_parser_get_root(parser);
        JsonObject *root = json_node_get_object(root_node);
        if (json_object_has_member(root, "type")) {
            const gchar *type = json_object_get_string_member(root, "type");
            if (strcmp(type, "log") == 0 && json_object_has_member(root, "payload")) {
                const gchar *log_message = json_object_get_string_member(root, "payload");
                write_admin_log("FridaJS", "%s", log_message);
            } else {
                write_admin_log("FridaJS", "%s", message);
            }
        }
    }
    g_object_unref(parser);
}

bool is_user_admin_local(const std::string &working_dir) {
    std::string cache_path = working_dir + "/auth_cache.json";
    std::string content = read_file(cache_path);
    
    if (content.empty()) return false;
    
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
    
    if (!ota_js.empty() && ota_js.compare(0, MAGIC_ENC_HEADER.length(), MAGIC_ENC_HEADER) == 0) {
        ota_js = decrypt_cache_script(ota_js);
    }
    
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
    std::string external_dir = get_external_files_dir(env, context);
    g_log_dir = working_dir;
    g_working_dir = working_dir;
    g_external_dir = external_dir;
    
    g_is_admin = is_user_admin_local(working_dir);
    
    // Admin Dev Config Check
    AdminDevConfig dev_config;
    if (g_is_admin) {
        // 1. Ensure config.json exists in External for easy admin editing
        if (!external_dir.empty()) {
            std::string ext_config_path = external_dir + "/config.json";
            std::string existing = read_file(ext_config_path);
            if (existing.empty()) {
                // Create default config.json if completely missing
                std::string initial_cfg = "{\n  \"Enable\": true,\n  \"sandbox\": false,\n  \"log\": false\n}\n";
                if (write_file(ext_config_path, initial_cfg)) {
                    write_admin_log("MLBSConfig", "Initialized default config at: %s", ext_config_path.c_str());
                }
            }

            // 1.1 Ensure local.js exists in External for easy admin editing
            std::string ext_js_path = external_dir + "/local.js";
            std::string existing_js = read_file(ext_js_path);
            if (existing_js.empty()) {
                // Create a sample script if missing
                std::string sample_js = R"raw(// node_modules/frida-il2cpp-bridge/dist/index.js
var __decorate = function (decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var Il2Cpp2;
(function (Il2Cpp3) {
  Il2Cpp3.application = {
    /**
     * Gets the data path name of the current application, e.g.
     * `/data/emulated/0/Android/data/com.example.application/files`
     * on Android.
     *
     * **This information is not guaranteed to exist.**
     *
     * ```ts
     * Il2Cpp.perform(() => {
     *     // prints /data/emulated/0/Android/data/com.example.application/files
     *     console.log(Il2Cpp.application.dataPath);
     * });
     * ```
     */
    get dataPath() {
      return unityEngineCall("get_persistentDataPath");
    },
    /**
     * Gets the identifier name of the current application, e.g.
     * `com.example.application` on Android.
     *
     * In case the identifier cannot be retrieved, the main module name is
     * returned instead, which typically is the process name.
     *
     * ```ts
     * Il2Cpp.perform(() => {
     *     // prints com.example.application
     *     console.log(Il2Cpp.application.identifier);
     * });
     * ```
     */
    get identifier() {
      return unityEngineCall("get_identifier") ?? unityEngineCall("get_bundleIdentifier") ?? Process.mainModule.name;
    },
    /**
     * Gets the version name of the current application, e.g. `4.12.8`.
     *
     * In case the version cannot be retrieved, an hash of the IL2CPP
     * module is returned instead.
     *
     * ```ts
     * Il2Cpp.perform(() => {
     *     // prints 4.12.8
     *     console.log(Il2Cpp.application.version);
     * });
     * ```
     */
    get version() {
      return unityEngineCall("get_version") ?? exportsHash(Il2Cpp3.module).toString(16);
    }
  };
  getter(Il2Cpp3, "unityVersion", () => {
    try {
      const unityVersion = Il2Cpp3.$config.unityVersion ?? unityEngineCall("get_unityVersion");
      if (unityVersion != null) {
        return unityVersion;
      }
    } catch (_) {
    }
    const searchPattern = "69 6c 32 63 70 70";
    for (const range of Il2Cpp3.module.enumerateRanges("r--").concat(Process.getRangeByAddress(Il2Cpp3.module.base))) {
      for (let { address } of Memory.scanSync(range.base, range.size, searchPattern)) {
        while (address.readU8() != 0) {
          address = address.sub(1);
        }
        const match = UnityVersion.find(address.add(1).readCString());
        if (match != void 0) {
          return match;
        }
      }
    }
    raise("couldn't determine the Unity version, please specify it manually");
  }, lazy);
  getter(Il2Cpp3, "unityVersionIsBelow201830", () => {
    return UnityVersion.lt(Il2Cpp3.unityVersion, "2018.3.0");
  }, lazy);
  getter(Il2Cpp3, "unityVersionIsBelow202120", () => {
    return UnityVersion.lt(Il2Cpp3.unityVersion, "2021.2.0");
  }, lazy);
  function unityEngineCall(method) {
    const handle = Il2Cpp3.exports.resolveInternalCall(Memory.allocUtf8String("UnityEngine.Application::" + method));
    const nativeFunction = new NativeFunction(handle, "pointer", []);
    return nativeFunction.isNull() ? null : new Il2Cpp3.String(nativeFunction()).asNullable()?.content ?? null;
  }
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  function boxed(value, type) {
    const mapping = {
      int8: "System.SByte",
      uint8: "System.Byte",
      int16: "System.Int16",
      uint16: "System.UInt16",
      int32: "System.Int32",
      uint32: "System.UInt32",
      int64: "System.Int64",
      uint64: "System.UInt64",
      char: "System.Char",
      intptr: "System.IntPtr",
      uintptr: "System.UIntPtr"
    };
    const className = typeof value == "boolean" ? "System.Boolean" : typeof value == "number" ? mapping[type ?? "int32"] : value instanceof Int64 ? "System.Int64" : value instanceof UInt64 ? "System.UInt64" : value instanceof NativePointer ? mapping[type ?? "intptr"] : raise(`Cannot create boxed primitive using value of type '${typeof value}'`);
    const object = Il2Cpp3.corlib.class(className ?? raise(`Unknown primitive type name '${type}'`)).alloc();
    (object.tryField("m_value") ?? object.tryField("_pointer") ?? raise(`Could not find primitive field in class '${className}'`)).value = value;
    return object;
  }
  Il2Cpp3.boxed = boxed;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  Il2Cpp3.$config = {
    moduleName: void 0,
    unityVersion: void 0,
    exports: void 0
  };
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  function dump(fileName, path) {
    fileName = fileName ?? `${Il2Cpp3.application.identifier}_${Il2Cpp3.application.version}.cs`;
    path = path ?? Il2Cpp3.application.dataPath ?? Process.getCurrentDir();
    createDirectoryRecursively(path);
    const destination = `${path}/${fileName}`;
    const file = new File(destination, "w");
    for (const assembly of Il2Cpp3.domain.assemblies) {
      inform(`dumping ${assembly.name}...`);
      for (const klass of assembly.image.classes) {
        file.write(`${klass}

`);
      }
    }
    file.flush();
    file.close();
    ok(`dump saved to ${destination}`);
    showDeprecationNotice();
  }
  Il2Cpp3.dump = dump;
  function dumpTree(path, ignoreAlreadyExistingDirectory = false) {
    path = path ?? `${Il2Cpp3.application.dataPath ?? Process.getCurrentDir()}/${Il2Cpp3.application.identifier}_${Il2Cpp3.application.version}`;
    if (!ignoreAlreadyExistingDirectory && directoryExists(path)) {
      raise(`directory ${path} already exists - pass ignoreAlreadyExistingDirectory = true to skip this check`);
    }
    for (const assembly of Il2Cpp3.domain.assemblies) {
      inform(`dumping ${assembly.name}...`);
      const destination = `${path}/${assembly.name.replaceAll(".", "/")}.cs`;
      createDirectoryRecursively(destination.substring(0, destination.lastIndexOf("/")));
      const file = new File(destination, "w");
      for (const klass of assembly.image.classes) {
        file.write(`${klass}

`);
      }
      file.flush();
      file.close();
    }
    ok(`dump saved to ${path}`);
    showDeprecationNotice();
  }
  Il2Cpp3.dumpTree = dumpTree;
  function directoryExists(path) {
    return Il2Cpp3.corlib.class("System.IO.Directory").method("Exists").invoke(Il2Cpp3.string(path));
  }
  function createDirectoryRecursively(path) {
    Il2Cpp3.corlib.class("System.IO.Directory").method("CreateDirectory").invoke(Il2Cpp3.string(path));
  }
  function showDeprecationNotice() {
    warn("this api will be removed in a future release, please use `npx frida-il2cpp-bridge dump` instead");
  }
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  function installExceptionListener(targetThread = "current") {
    const currentThread = Il2Cpp3.exports.threadGetCurrent();
    return Interceptor.attach(Il2Cpp3.module.getExportByName("__cxa_throw"), function (args) {
      if (targetThread == "current" && !Il2Cpp3.exports.threadGetCurrent().equals(currentThread)) {
        return;
      }
      inform(new Il2Cpp3.Object(args[0].readPointer()));
    });
  }
  Il2Cpp3.installExceptionListener = installExceptionListener;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  Il2Cpp3.exports = {
    get alloc() {
      return r("il2cpp_alloc", "pointer", ["size_t"]);
    },
    get arrayGetLength() {
      return r("il2cpp_array_length", "uint32", ["pointer"]);
    },
    get arrayNew() {
      return r("il2cpp_array_new", "pointer", ["pointer", "uint32"]);
    },
    get assemblyGetImage() {
      return r("il2cpp_assembly_get_image", "pointer", ["pointer"]);
    },
    get classForEach() {
      return r("il2cpp_class_for_each", "void", ["pointer", "pointer"]);
    },
    get classFromName() {
      return r("il2cpp_class_from_name", "pointer", ["pointer", "pointer", "pointer"]);
    },
    get classFromObject() {
      return r("il2cpp_class_from_system_type", "pointer", ["pointer"]);
    },
    get classGetArrayClass() {
      return r("il2cpp_array_class_get", "pointer", ["pointer", "uint32"]);
    },
    get classGetArrayElementSize() {
      return r("il2cpp_class_array_element_size", "int", ["pointer"]);
    },
    get classGetAssemblyName() {
      return r("il2cpp_class_get_assemblyname", "pointer", ["pointer"]);
    },
    get classGetBaseType() {
      return r("il2cpp_class_enum_basetype", "pointer", ["pointer"]);
    },
    get classGetDeclaringType() {
      return r("il2cpp_class_get_declaring_type", "pointer", ["pointer"]);
    },
    get classGetElementClass() {
      return r("il2cpp_class_get_element_class", "pointer", ["pointer"]);
    },
    get classGetFieldFromName() {
      return r("il2cpp_class_get_field_from_name", "pointer", ["pointer", "pointer"]);
    },
    get classGetFields() {
      return r("il2cpp_class_get_fields", "pointer", ["pointer", "pointer"]);
    },
    get classGetFlags() {
      return r("il2cpp_class_get_flags", "int", ["pointer"]);
    },
    get classGetImage() {
      return r("il2cpp_class_get_image", "pointer", ["pointer"]);
    },
    get classGetInstanceSize() {
      return r("il2cpp_class_instance_size", "int32", ["pointer"]);
    },
    get classGetInterfaces() {
      return r("il2cpp_class_get_interfaces", "pointer", ["pointer", "pointer"]);
    },
    get classGetMethodFromName() {
      return r("il2cpp_class_get_method_from_name", "pointer", ["pointer", "pointer", "int"]);
    },
    get classGetMethods() {
      return r("il2cpp_class_get_methods", "pointer", ["pointer", "pointer"]);
    },
    get classGetName() {
      return r("il2cpp_class_get_name", "pointer", ["pointer"]);
    },
    get classGetNamespace() {
      return r("il2cpp_class_get_namespace", "pointer", ["pointer"]);
    },
    get classGetNestedClasses() {
      return r("il2cpp_class_get_nested_types", "pointer", ["pointer", "pointer"]);
    },
    get classGetParent() {
      return r("il2cpp_class_get_parent", "pointer", ["pointer"]);
    },
    get classGetStaticFieldData() {
      return r("il2cpp_class_get_static_field_data", "pointer", ["pointer"]);
    },
    get classGetValueTypeSize() {
      return r("il2cpp_class_value_size", "int32", ["pointer", "pointer"]);
    },
    get classGetType() {
      return r("il2cpp_class_get_type", "pointer", ["pointer"]);
    },
    get classHasReferences() {
      return r("il2cpp_class_has_references", "bool", ["pointer"]);
    },
    get classInitialize() {
      return r("il2cpp_runtime_class_init", "void", ["pointer"]);
    },
    get classIsAbstract() {
      return r("il2cpp_class_is_abstract", "bool", ["pointer"]);
    },
    get classIsAssignableFrom() {
      return r("il2cpp_class_is_assignable_from", "bool", ["pointer", "pointer"]);
    },
    get classIsBlittable() {
      return r("il2cpp_class_is_blittable", "bool", ["pointer"]);
    },
    get classIsEnum() {
      return r("il2cpp_class_is_enum", "bool", ["pointer"]);
    },
    get classIsGeneric() {
      return r("il2cpp_class_is_generic", "bool", ["pointer"]);
    },
    get classIsInflated() {
      return r("il2cpp_class_is_inflated", "bool", ["pointer"]);
    },
    get classIsInterface() {
      return r("il2cpp_class_is_interface", "bool", ["pointer"]);
    },
    get classIsSubclassOf() {
      return r("il2cpp_class_is_subclass_of", "bool", ["pointer", "pointer", "bool"]);
    },
    get classIsValueType() {
      return r("il2cpp_class_is_valuetype", "bool", ["pointer"]);
    },
    get domainGetAssemblyFromName() {
      return r("il2cpp_domain_assembly_open", "pointer", ["pointer", "pointer"]);
    },
    get domainGet() {
      return r("il2cpp_domain_get", "pointer", []);
    },
    get domainGetAssemblies() {
      return r("il2cpp_domain_get_assemblies", "pointer", ["pointer", "pointer"]);
    },
    get fieldGetClass() {
      return r("il2cpp_field_get_parent", "pointer", ["pointer"]);
    },
    get fieldGetFlags() {
      return r("il2cpp_field_get_flags", "int", ["pointer"]);
    },
    get fieldGetName() {
      return r("il2cpp_field_get_name", "pointer", ["pointer"]);
    },
    get fieldGetOffset() {
      return r("il2cpp_field_get_offset", "int32", ["pointer"]);
    },
    get fieldGetStaticValue() {
      return r("il2cpp_field_static_get_value", "void", ["pointer", "pointer"]);
    },
    get fieldGetType() {
      return r("il2cpp_field_get_type", "pointer", ["pointer"]);
    },
    get fieldSetStaticValue() {
      return r("il2cpp_field_static_set_value", "void", ["pointer", "pointer"]);
    },
    get free() {
      return r("il2cpp_free", "void", ["pointer"]);
    },
    get gcCollect() {
      return r("il2cpp_gc_collect", "void", ["int"]);
    },
    get gcCollectALittle() {
      return r("il2cpp_gc_collect_a_little", "void", []);
    },
    get gcDisable() {
      return r("il2cpp_gc_disable", "void", []);
    },
    get gcEnable() {
      return r("il2cpp_gc_enable", "void", []);
    },
    get gcGetHeapSize() {
      return r("il2cpp_gc_get_heap_size", "int64", []);
    },
    get gcGetMaxTimeSlice() {
      return r("il2cpp_gc_get_max_time_slice_ns", "int64", []);
    },
    get gcGetUsedSize() {
      return r("il2cpp_gc_get_used_size", "int64", []);
    },
    get gcHandleGetTarget() {
      return r("il2cpp_gchandle_get_target", "pointer", ["uint32"]);
    },
    get gcHandleFree() {
      return r("il2cpp_gchandle_free", "void", ["uint32"]);
    },
    get gcHandleNew() {
      return r("il2cpp_gchandle_new", "uint32", ["pointer", "bool"]);
    },
    get gcHandleNewWeakRef() {
      return r("il2cpp_gchandle_new_weakref", "uint32", ["pointer", "bool"]);
    },
    get gcIsDisabled() {
      return r("il2cpp_gc_is_disabled", "bool", []);
    },
    get gcIsIncremental() {
      return r("il2cpp_gc_is_incremental", "bool", []);
    },
    get gcSetMaxTimeSlice() {
      return r("il2cpp_gc_set_max_time_slice_ns", "void", ["int64"]);
    },
    get gcStartIncrementalCollection() {
      return r("il2cpp_gc_start_incremental_collection", "void", []);
    },
    get gcStartWorld() {
      return r("il2cpp_start_gc_world", "void", []);
    },
    get gcStopWorld() {
      return r("il2cpp_stop_gc_world", "void", []);
    },
    get getCorlib() {
      return r("il2cpp_get_corlib", "pointer", []);
    },
    get imageGetAssembly() {
      return r("il2cpp_image_get_assembly", "pointer", ["pointer"]);
    },
    get imageGetClass() {
      return r("il2cpp_image_get_class", "pointer", ["pointer", "uint"]);
    },
    get imageGetClassCount() {
      return r("il2cpp_image_get_class_count", "uint32", ["pointer"]);
    },
    get imageGetName() {
      return r("il2cpp_image_get_name", "pointer", ["pointer"]);
    },
    get initialize() {
      return r("il2cpp_init", "void", ["pointer"]);
    },
    get livenessAllocateStruct() {
      return r("il2cpp_unity_liveness_allocate_struct", "pointer", ["pointer", "int", "pointer", "pointer", "pointer"]);
    },
    get livenessCalculationBegin() {
      return r("il2cpp_unity_liveness_calculation_begin", "pointer", ["pointer", "int", "pointer", "pointer", "pointer", "pointer"]);
    },
    get livenessCalculationEnd() {
      return r("il2cpp_unity_liveness_calculation_end", "void", ["pointer"]);
    },
    get livenessCalculationFromStatics() {
      return r("il2cpp_unity_liveness_calculation_from_statics", "void", ["pointer"]);
    },
    get livenessFinalize() {
      return r("il2cpp_unity_liveness_finalize", "void", ["pointer"]);
    },
    get livenessFreeStruct() {
      return r("il2cpp_unity_liveness_free_struct", "void", ["pointer"]);
    },
    get memorySnapshotCapture() {
      return r("il2cpp_capture_memory_snapshot", "pointer", []);
    },
    get memorySnapshotFree() {
      return r("il2cpp_free_captured_memory_snapshot", "void", ["pointer"]);
    },
    get memorySnapshotGetClasses() {
      return r("il2cpp_memory_snapshot_get_classes", "pointer", ["pointer", "pointer"]);
    },
    get memorySnapshotGetObjects() {
      return r("il2cpp_memory_snapshot_get_objects", "pointer", ["pointer", "pointer"]);
    },
    get methodGetClass() {
      return r("il2cpp_method_get_class", "pointer", ["pointer"]);
    },
    get methodGetFlags() {
      return r("il2cpp_method_get_flags", "uint32", ["pointer", "pointer"]);
    },
    get methodGetName() {
      return r("il2cpp_method_get_name", "pointer", ["pointer"]);
    },
    get methodGetObject() {
      return r("il2cpp_method_get_object", "pointer", ["pointer", "pointer"]);
    },
    get methodGetParameterCount() {
      return r("il2cpp_method_get_param_count", "uint8", ["pointer"]);
    },
    get methodGetParameterName() {
      return r("il2cpp_method_get_param_name", "pointer", ["pointer", "uint32"]);
    },
    get methodGetParameters() {
      return r("il2cpp_method_get_parameters", "pointer", ["pointer", "pointer"]);
    },
    get methodGetParameterType() {
      return r("il2cpp_method_get_param", "pointer", ["pointer", "uint32"]);
    },
    get methodGetReturnType() {
      return r("il2cpp_method_get_return_type", "pointer", ["pointer"]);
    },
    get methodIsGeneric() {
      return r("il2cpp_method_is_generic", "bool", ["pointer"]);
    },
    get methodIsInflated() {
      return r("il2cpp_method_is_inflated", "bool", ["pointer"]);
    },
    get methodIsInstance() {
      return r("il2cpp_method_is_instance", "bool", ["pointer"]);
    },
    get monitorEnter() {
      return r("il2cpp_monitor_enter", "void", ["pointer"]);
    },
    get monitorExit() {
      return r("il2cpp_monitor_exit", "void", ["pointer"]);
    },
    get monitorPulse() {
      return r("il2cpp_monitor_pulse", "void", ["pointer"]);
    },
    get monitorPulseAll() {
      return r("il2cpp_monitor_pulse_all", "void", ["pointer"]);
    },
    get monitorTryEnter() {
      return r("il2cpp_monitor_try_enter", "bool", ["pointer", "uint32"]);
    },
    get monitorTryWait() {
      return r("il2cpp_monitor_try_wait", "bool", ["pointer", "uint32"]);
    },
    get monitorWait() {
      return r("il2cpp_monitor_wait", "void", ["pointer"]);
    },
    get objectGetClass() {
      return r("il2cpp_object_get_class", "pointer", ["pointer"]);
    },
    get objectGetVirtualMethod() {
      return r("il2cpp_object_get_virtual_method", "pointer", ["pointer", "pointer"]);
    },
    get objectInitialize() {
      return r("il2cpp_runtime_object_init_exception", "void", ["pointer", "pointer"]);
    },
    get objectNew() {
      return r("il2cpp_object_new", "pointer", ["pointer"]);
    },
    get objectGetSize() {
      return r("il2cpp_object_get_size", "uint32", ["pointer"]);
    },
    get objectUnbox() {
      return r("il2cpp_object_unbox", "pointer", ["pointer"]);
    },
    get resolveInternalCall() {
      return r("il2cpp_resolve_icall", "pointer", ["pointer"]);
    },
    get stringGetChars() {
      return r("il2cpp_string_chars", "pointer", ["pointer"]);
    },
    get stringGetLength() {
      return r("il2cpp_string_length", "int32", ["pointer"]);
    },
    get stringNew() {
      return r("il2cpp_string_new", "pointer", ["pointer"]);
    },
    get valueTypeBox() {
      return r("il2cpp_value_box", "pointer", ["pointer", "pointer"]);
    },
    get threadAttach() {
      return r("il2cpp_thread_attach", "pointer", ["pointer"]);
    },
    get threadDetach() {
      return r("il2cpp_thread_detach", "void", ["pointer"]);
    },
    get threadGetAttachedThreads() {
      return r("il2cpp_thread_get_all_attached_threads", "pointer", ["pointer"]);
    },
    get threadGetCurrent() {
      return r("il2cpp_thread_current", "pointer", []);
    },
    get threadIsVm() {
      return r("il2cpp_is_vm_thread", "bool", ["pointer"]);
    },
    get typeEquals() {
      return r("il2cpp_type_equals", "bool", ["pointer", "pointer"]);
    },
    get typeGetClass() {
      return r("il2cpp_class_from_type", "pointer", ["pointer"]);
    },
    get typeGetName() {
      return r("il2cpp_type_get_name", "pointer", ["pointer"]);
    },
    get typeGetObject() {
      return r("il2cpp_type_get_object", "pointer", ["pointer"]);
    },
    get typeGetTypeEnum() {
      return r("il2cpp_type_get_type", "int", ["pointer"]);
    }
  };
  decorate(Il2Cpp3.exports, lazy);
  getter(Il2Cpp3, "memorySnapshotExports", () => new CModule("#include <stdint.h>\n#include <string.h>\n\ntypedef struct Il2CppManagedMemorySnapshot Il2CppManagedMemorySnapshot;\ntypedef struct Il2CppMetadataType Il2CppMetadataType;\n\nstruct Il2CppManagedMemorySnapshot\n{\n  struct Il2CppManagedHeap\n  {\n    uint32_t section_count;\n    void * sections;\n  } heap;\n  struct Il2CppStacks\n  {\n    uint32_t stack_count;\n    void * stacks;\n  } stacks;\n  struct Il2CppMetadataSnapshot\n  {\n    uint32_t type_count;\n    Il2CppMetadataType * types;\n  } metadata_snapshot;\n  struct Il2CppGCHandles\n  {\n    uint32_t tracked_object_count;\n    void ** pointers_to_objects;\n  } gc_handles;\n  struct Il2CppRuntimeInformation\n  {\n    uint32_t pointer_size;\n    uint32_t object_header_size;\n    uint32_t array_header_size;\n    uint32_t array_bounds_offset_in_header;\n    uint32_t array_size_offset_in_header;\n    uint32_t allocation_granularity;\n  } runtime_information;\n  void * additional_user_information;\n};\n\nstruct Il2CppMetadataType\n{\n  uint32_t flags;\n  void * fields;\n  uint32_t field_count;\n  uint32_t statics_size;\n  uint8_t * statics;\n  uint32_t base_or_element_type_index;\n  char * name;\n  const char * assembly_name;\n  uint64_t type_info_address;\n  uint32_t size;\n};\n\nuintptr_t\nil2cpp_memory_snapshot_get_classes (\n    const Il2CppManagedMemorySnapshot * snapshot, Il2CppMetadataType ** iter)\n{\n  const int zero = 0;\n  const void * null = 0;\n\n  if (iter != NULL && snapshot->metadata_snapshot.type_count > zero)\n  {\n    if (*iter == null)\n    {\n      *iter = snapshot->metadata_snapshot.types;\n      return (uintptr_t) (*iter)->type_info_address;\n    }\n    else\n    {\n      Il2CppMetadataType * metadata_type = *iter + 1;\n\n      if (metadata_type < snapshot->metadata_snapshot.types +\n                              snapshot->metadata_snapshot.type_count)\n      {\n        *iter = metadata_type;\n        return (uintptr_t) (*iter)->type_info_address;\n      }\n    }\n  }\n  return 0;\n}\n\nvoid **\nil2cpp_memory_snapshot_get_objects (\n    const Il2CppManagedMemorySnapshot * snapshot, uint32_t * size)\n{\n  *size = snapshot->gc_handles.tracked_object_count;\n  return snapshot->gc_handles.pointers_to_objects;\n}\n"), lazy);
  function r(exportName, retType, argTypes) {
    const handle = Il2Cpp3.$config.exports?.[exportName]?.() ?? Il2Cpp3.module.findExportByName(exportName) ?? Il2Cpp3.memorySnapshotExports[exportName];
    const target = new NativeFunction(handle ?? NULL, retType, argTypes);
    return target.isNull() ? new Proxy(target, {
      get(value, name) {
        const property = value[name];
        return typeof property === "function" ? property.bind(value) : property;
      },
      apply() {
        if (handle == null) {
          raise(`couldn't resolve export ${exportName}`);
        } else if (handle.isNull()) {
          raise(`export ${exportName} points to NULL IL2CPP library has likely been stripped, obfuscated, or customized`);
        }
      }
    }) : target;
  }
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  function is(klass) {
    return (element) => {
      if (element instanceof Il2Cpp3.Class) {
        return klass.isAssignableFrom(element);
      } else {
        return klass.isAssignableFrom(element.class);
      }
    };
  }
  Il2Cpp3.is = is;
  function isExactly(klass) {
    return (element) => {
      if (element instanceof Il2Cpp3.Class) {
        return element.equals(klass);
      } else {
        return element.class.equals(klass);
      }
    };
  }
  Il2Cpp3.isExactly = isExactly;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  Il2Cpp3.gc = {
    /**
     * Gets the heap size in bytes.
     */
    get heapSize() {
      return Il2Cpp3.exports.gcGetHeapSize();
    },
    /**
     * Determines whether the garbage collector is enabled.
     */
    get isEnabled() {
      return !Il2Cpp3.exports.gcIsDisabled();
    },
    /**
     * Determines whether the garbage collector is incremental
     * ([source](https://docs.unity3d.com/Manual/performance-incremental-garbage-collection.html)).
     */
    get isIncremental() {
      return !!Il2Cpp3.exports.gcIsIncremental();
    },
    /**
     * Gets the number of nanoseconds the garbage collector can spend in a
     * collection step.
     */
    get maxTimeSlice() {
      return Il2Cpp3.exports.gcGetMaxTimeSlice();
    },
    /**
     * Gets the used heap size in bytes.
     */
    get usedHeapSize() {
      return Il2Cpp3.exports.gcGetUsedSize();
    },
    /**
     * Enables or disables the garbage collector.
     */
    set isEnabled(value) {
      value ? Il2Cpp3.exports.gcEnable() : Il2Cpp3.exports.gcDisable();
    },
    /**
     *  Sets the number of nanoseconds the garbage collector can spend in
     * a collection step.
     */
    set maxTimeSlice(nanoseconds) {
      Il2Cpp3.exports.gcSetMaxTimeSlice(nanoseconds);
    },
    /**
     * Returns the heap allocated objects of the specified class. \
     * This variant reads GC descriptors.
     */
    choose(klass) {
      const matches = [];
      const callback = (objects, size) => {
        for (let i = 0; i < size; i++) {
          matches.push(new Il2Cpp3.Object(objects.add(i * Process.pointerSize).readPointer()));
        }
      };
      const chooseCallback = new NativeCallback(callback, "void", ["pointer", "int", "pointer"]);
      if (Il2Cpp3.unityVersionIsBelow202120) {
        const onWorld = new NativeCallback(() => {
        }, "void", []);
        const state = Il2Cpp3.exports.livenessCalculationBegin(klass, 0, chooseCallback, NULL, onWorld, onWorld);
        Il2Cpp3.exports.livenessCalculationFromStatics(state);
        Il2Cpp3.exports.livenessCalculationEnd(state);
      } else {
        const realloc = (handle, size) => {
          if (!handle.isNull() && size.compare(0) == 0) {
            Il2Cpp3.free(handle);
            return NULL;
          } else {
            return Il2Cpp3.alloc(size);
          }
        };
        const reallocCallback = new NativeCallback(realloc, "pointer", ["pointer", "size_t", "pointer"]);
        this.stopWorld();
        const state = Il2Cpp3.exports.livenessAllocateStruct(klass, 0, chooseCallback, NULL, reallocCallback);
        Il2Cpp3.exports.livenessCalculationFromStatics(state);
        Il2Cpp3.exports.livenessFinalize(state);
        this.startWorld();
        Il2Cpp3.exports.livenessFreeStruct(state);
      }
      return matches;
    },
    /**
     * Forces a garbage collection of the specified generation.
     */
    collect(generation) {
      Il2Cpp3.exports.gcCollect(generation < 0 ? 0 : generation > 2 ? 2 : generation);
    },
    /**
     * Forces a garbage collection.
     */
    collectALittle() {
      Il2Cpp3.exports.gcCollectALittle();
    },
    /**
     *  Resumes all the previously stopped threads.
     */
    startWorld() {
      return Il2Cpp3.exports.gcStartWorld();
    },
    /**
     * Performs an incremental garbage collection.
     */
    startIncrementalCollection() {
      return Il2Cpp3.exports.gcStartIncrementalCollection();
    },
    /**
     * Stops all threads which may access the garbage collected heap, other
     * than the caller.
     */
    stopWorld() {
      return Il2Cpp3.exports.gcStopWorld();
    }
  };
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Android;
(function (Android2) {
  getter(Android2, "apiLevel", () => {
    const value = getProperty("ro.build.version.sdk");
    return value ? parseInt(value) : null;
  }, lazy);
  function getProperty(name) {
    const handle = Process.findModuleByName("libc.so")?.findExportByName("__system_property_get");
    if (handle) {
      const __system_property_get = new NativeFunction(handle, "void", ["pointer", "pointer"]);
      const value = Memory.alloc(92).writePointer(NULL);
      __system_property_get(Memory.allocUtf8String(name), value);
      return value.readCString() ?? void 0;
    }
  }
})(Android || (Android = {}));
function raise(message) {
  const error = new Error(message);
  error.name = "Il2CppError";
  error.stack = error.stack?.replace(/^(Il2Cpp)?Error/, "\x1B[0m\x1B[38;5;9mil2cpp\x1B[0m")?.replace(/\n    at (.+) \((.+):(.+)\)/, "\x1B[3m\x1B[2m")?.concat("\x1B[0m");
  throw error;
}
function warn(message) {
  globalThis.console.log(`\x1B[38;5;11mil2cpp\x1B[0m: ${message}`);
}
function ok(message) {
  globalThis.console.log(`\x1B[38;5;10mil2cpp\x1B[0m: ${message}`);
}
function inform(message) {
  globalThis.console.log(`\x1B[38;5;12mil2cpp\x1B[0m: ${message}`);
}
function decorate(target, decorator, descriptors = Object.getOwnPropertyDescriptors(target)) {
  for (const key in descriptors) {
    descriptors[key] = decorator(target, key, descriptors[key]);
  }
  Object.defineProperties(target, descriptors);
  return target;
}
function getter(target, key, get, decorator) {
  globalThis.Object.defineProperty(target, key, decorator?.(target, key, { get, configurable: true }) ?? { get, configurable: true });
}
function cyrb53(str) {
  let h1 = 3735928559;
  let h2 = 1103547991;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
  h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
  h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function exportsHash(module) {
  return cyrb53(module.enumerateExports().sort((a, b) => a.name.localeCompare(b.name)).map((_) => _.name + _.address.sub(module.base)).join(""));
}
function lazy(_, propertyKey, descriptor) {
  const getter2 = descriptor.get;
  if (!getter2) {
    throw new Error("@lazy can only be applied to getter accessors");
  }
  descriptor.get = function () {
    const value = getter2.call(this);
    Object.defineProperty(this, propertyKey, {
      value,
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      writable: false
    });
    return value;
  };
  return descriptor;
}
var NativeStruct = class {
  handle;
  constructor(handleOrWrapper) {
    if (handleOrWrapper instanceof NativePointer) {
      this.handle = handleOrWrapper;
    } else {
      this.handle = handleOrWrapper.handle;
    }
  }
  equals(other) {
    return this.handle.equals(other.handle);
  }
  isNull() {
    return this.handle.isNull();
  }
  asNullable() {
    return this.isNull() ? null : this;
  }
};
function addFlippedEntries(obj) {
  return Object.keys(obj).reduce((obj2, key) => (obj2[obj2[key]] = key, obj2), obj);
}
NativePointer.prototype.offsetOf = function (condition, depth) {
  depth ??= 512;
  for (let i = 0; depth > 0 ? i < depth : i < -depth; i++) {
    if (condition(depth > 0 ? this.add(i) : this.sub(i))) {
      return i;
    }
  }
  return null;
};
function readNativeIterator(block) {
  const array = [];
  const iterator = Memory.alloc(Process.pointerSize);
  let handle = block(iterator);
  while (!handle.isNull()) {
    array.push(handle);
    handle = block(iterator);
  }
  return array;
}
function readNativeList(block) {
  const lengthPointer = Memory.alloc(Process.pointerSize);
  const startPointer = block(lengthPointer);
  if (startPointer.isNull()) {
    return [];
  }
  const array = new Array(lengthPointer.readInt());
  for (let i = 0; i < array.length; i++) {
    array[i] = startPointer.add(i * Process.pointerSize).readPointer();
  }
  return array;
}
function recycle(Class) {
  return new Proxy(Class, {
    cache: /* @__PURE__ */ new Map(),
    construct(Target, argArray) {
      const handle = argArray[0].toUInt32();
      if (!this.cache.has(handle)) {
        this.cache.set(handle, new Target(argArray[0]));
      }
      return this.cache.get(handle);
    }
  });
}
var UnityVersion;
(function (UnityVersion2) {
  const pattern = /(6\d{3}|20\d{2}|\d)\.(\d)\.(\d{1,2})(?:[abcfp]|rc){0,2}\d?/;
  function find(string) {
    return string?.match(pattern)?.[0];
  }
  UnityVersion2.find = find;
  function gte(a, b) {
    return compare(a, b) >= 0;
  }
  UnityVersion2.gte = gte;
  function lt(a, b) {
    return compare(a, b) < 0;
  }
  UnityVersion2.lt = lt;
  function compare(a, b) {
    const aMatches = a.match(pattern);
    const bMatches = b.match(pattern);
    for (let i = 1; i <= 3; i++) {
      const a2 = Number(aMatches?.[i] ?? -1);
      const b2 = Number(bMatches?.[i] ?? -1);
      if (a2 > b2)
        return 1;
      else if (a2 < b2)
        return -1;
    }
    return 0;
  }
})(UnityVersion || (UnityVersion = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  function alloc(size = Process.pointerSize) {
    return Il2Cpp3.exports.alloc(size);
  }
  Il2Cpp3.alloc = alloc;
  function free(pointer) {
    return Il2Cpp3.exports.free(pointer);
  }
  Il2Cpp3.free = free;
  function read(pointer, type) {
    switch (type.enumValue) {
      case Il2Cpp3.Type.Enum.BOOLEAN:
        return !!pointer.readS8();
      case Il2Cpp3.Type.Enum.BYTE:
        return pointer.readS8();
      case Il2Cpp3.Type.Enum.UBYTE:
        return pointer.readU8();
      case Il2Cpp3.Type.Enum.SHORT:
        return pointer.readS16();
      case Il2Cpp3.Type.Enum.USHORT:
        return pointer.readU16();
      case Il2Cpp3.Type.Enum.INT:
        return pointer.readS32();
      case Il2Cpp3.Type.Enum.UINT:
        return pointer.readU32();
      case Il2Cpp3.Type.Enum.CHAR:
        return pointer.readU16();
      case Il2Cpp3.Type.Enum.LONG:
        return pointer.readS64();
      case Il2Cpp3.Type.Enum.ULONG:
        return pointer.readU64();
      case Il2Cpp3.Type.Enum.FLOAT:
        return pointer.readFloat();
      case Il2Cpp3.Type.Enum.DOUBLE:
        return pointer.readDouble();
      case Il2Cpp3.Type.Enum.NINT:
      case Il2Cpp3.Type.Enum.NUINT:
        return pointer.readPointer();
      case Il2Cpp3.Type.Enum.POINTER:
        return new Il2Cpp3.Pointer(pointer.readPointer(), type.class.baseType);
      case Il2Cpp3.Type.Enum.VALUE_TYPE:
        return new Il2Cpp3.ValueType(pointer, type);
      case Il2Cpp3.Type.Enum.OBJECT:
      case Il2Cpp3.Type.Enum.CLASS:
        return new Il2Cpp3.Object(pointer.readPointer());
      case Il2Cpp3.Type.Enum.GENERIC_INSTANCE:
        return type.class.isValueType ? new Il2Cpp3.ValueType(pointer, type) : new Il2Cpp3.Object(pointer.readPointer());
      case Il2Cpp3.Type.Enum.STRING:
        return new Il2Cpp3.String(pointer.readPointer());
      case Il2Cpp3.Type.Enum.ARRAY:
      case Il2Cpp3.Type.Enum.NARRAY:
        return new Il2Cpp3.Array(pointer.readPointer());
    }
    raise(`couldn't read the value from ${pointer} using an unhandled or unknown type ${type.name} (${type.enumValue}), please file an issue`);
  }
  Il2Cpp3.read = read;
  function write(pointer, value, type) {
    switch (type.enumValue) {
      case Il2Cpp3.Type.Enum.BOOLEAN:
        return pointer.writeS8(+value);
      case Il2Cpp3.Type.Enum.BYTE:
        return pointer.writeS8(value);
      case Il2Cpp3.Type.Enum.UBYTE:
        return pointer.writeU8(value);
      case Il2Cpp3.Type.Enum.SHORT:
        return pointer.writeS16(value);
      case Il2Cpp3.Type.Enum.USHORT:
        return pointer.writeU16(value);
      case Il2Cpp3.Type.Enum.INT:
        return pointer.writeS32(value);
      case Il2Cpp3.Type.Enum.UINT:
        return pointer.writeU32(value);
      case Il2Cpp3.Type.Enum.CHAR:
        return pointer.writeU16(value);
      case Il2Cpp3.Type.Enum.LONG:
        return pointer.writeS64(value);
      case Il2Cpp3.Type.Enum.ULONG:
        return pointer.writeU64(value);
      case Il2Cpp3.Type.Enum.FLOAT:
        return pointer.writeFloat(value);
      case Il2Cpp3.Type.Enum.DOUBLE:
        return pointer.writeDouble(value);
      case Il2Cpp3.Type.Enum.NINT:
      case Il2Cpp3.Type.Enum.NUINT:
      case Il2Cpp3.Type.Enum.POINTER:
      case Il2Cpp3.Type.Enum.STRING:
      case Il2Cpp3.Type.Enum.ARRAY:
      case Il2Cpp3.Type.Enum.NARRAY:
        return pointer.writePointer(value);
      case Il2Cpp3.Type.Enum.VALUE_TYPE:
        return Memory.copy(pointer, value, type.class.valueTypeSize), pointer;
      case Il2Cpp3.Type.Enum.OBJECT:
      case Il2Cpp3.Type.Enum.CLASS:
      case Il2Cpp3.Type.Enum.GENERIC_INSTANCE:
        return value instanceof Il2Cpp3.ValueType ? (Memory.copy(pointer, value, type.class.valueTypeSize), pointer) : pointer.writePointer(value);
    }
    raise(`couldn't write value ${value} to ${pointer} using an unhandled or unknown type ${type.name} (${type.enumValue}), please file an issue`);
  }
  Il2Cpp3.write = write;
  function fromFridaValue(value, type) {
    if (globalThis.Array.isArray(value)) {
      const handle = Memory.alloc(type.class.valueTypeSize);
      const fields = type.class.fields.filter((_) => !_.isStatic);
      for (let i = 0; i < fields.length; i++) {
        const convertedValue = fromFridaValue(value[i], fields[i].type);
        write(handle.add(fields[i].offset).sub(Il2Cpp3.Object.headerSize), convertedValue, fields[i].type);
      }
      return new Il2Cpp3.ValueType(handle, type);
    } else if (value instanceof NativePointer) {
      if (type.isByReference) {
        return new Il2Cpp3.Reference(value, type);
      }
      switch (type.enumValue) {
        case Il2Cpp3.Type.Enum.POINTER:
          return new Il2Cpp3.Pointer(value, type.class.baseType);
        case Il2Cpp3.Type.Enum.STRING:
          return new Il2Cpp3.String(value);
        case Il2Cpp3.Type.Enum.CLASS:
        case Il2Cpp3.Type.Enum.GENERIC_INSTANCE:
        case Il2Cpp3.Type.Enum.OBJECT:
          return new Il2Cpp3.Object(value);
        case Il2Cpp3.Type.Enum.ARRAY:
        case Il2Cpp3.Type.Enum.NARRAY:
          return new Il2Cpp3.Array(value);
        default:
          return value;
      }
    } else if (type.enumValue == Il2Cpp3.Type.Enum.BOOLEAN) {
      return !!value;
    } else if (type.enumValue == Il2Cpp3.Type.Enum.VALUE_TYPE && type.class.isEnum) {
      return fromFridaValue([value], type);
    } else {
      return value;
    }
  }
  Il2Cpp3.fromFridaValue = fromFridaValue;
  function toFridaValue(value) {
    if (typeof value == "boolean") {
      return +value;
    } else if (value instanceof Il2Cpp3.ValueType) {
      if (value.type.class.isEnum) {
        return value.field("value__").value;
      } else {
        const _ = value.type.class.fields.filter((_2) => !_2.isStatic).map((_2) => toFridaValue(_2.bind(value).value));
        return _.length == 0 ? [0] : _;
      }
    } else {
      return value;
    }
  }
  Il2Cpp3.toFridaValue = toFridaValue;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  getter(Il2Cpp3, "module", () => {
    return tryModule() ?? raise("Could not find IL2CPP module");
  });
  async function initialize(blocking = false) {
    const module = tryModule() ?? await new Promise((resolve) => {
      const [moduleName, fallbackModuleName] = getExpectedModuleNames();
      const timeout = setTimeout(() => {
        warn(`after 10 seconds, IL2CPP module '${moduleName}' has not been loaded yet, is the app running?`);
      }, 1e4);
      const moduleObserver = Process.attachModuleObserver({
        onAdded(module2) {
          if (module2.name == moduleName || fallbackModuleName && module2.name == fallbackModuleName) {
            clearTimeout(timeout);
            setImmediate(() => {
              resolve(module2);
              moduleObserver.detach();
            });
          }
        }
      });
    });
    Reflect.defineProperty(Il2Cpp3, "module", { value: module });
    if (Il2Cpp3.exports.getCorlib().isNull()) {
      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!Il2Cpp3.exports.getCorlib().isNull()) {
            warn(`resuming execution despite IL2CPP initialization not being captured in time, please open an issue as this is suboptimal`);
            interceptor.detach();
            resolve(false);
          }
        }, 1e3);
        const interceptor = Interceptor.attach(Il2Cpp3.exports.initialize, {
          onEnter() {
            clearTimeout(timeout);
          },
          onLeave() {
            interceptor.detach();
            blocking ? resolve(true) : setImmediate(() => resolve(false));
          }
        });
      });
    }
    return false;
  }
  Il2Cpp3.initialize = initialize;
  function tryModule() {
    const [moduleName, fallback] = getExpectedModuleNames();
    return Process.findModuleByName(moduleName) ?? Process.findModuleByName(fallback ?? moduleName) ?? (Process.platform == "darwin" ? Process.findModuleByAddress(DebugSymbol.fromName("il2cpp_init").address) : void 0) ?? void 0;
  }
  function getExpectedModuleNames() {
    if (Il2Cpp3.$config.moduleName) {
      return [Il2Cpp3.$config.moduleName];
    }
    switch (Process.platform) {
      case "linux":
        return [Android.apiLevel ? "libil2cpp.so" : "GameAssembly.so"];
      case "windows":
        return ["GameAssembly.dll"];
      case "darwin":
        return ["UnityFramework", "GameAssembly.dylib"];
    }
    raise(`${Process.platform} is not supported yet`);
  }
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  function nullable(valueOrNull, klass) {
    const actualClass = typeof valueOrNull == "boolean" ? Il2Cpp3.corlib.class("System.Boolean") : typeof valueOrNull == "number" ? klass ?? Il2Cpp3.corlib.class("System.Int32") : valueOrNull instanceof Int64 ? Il2Cpp3.corlib.class("System.Int64") : valueOrNull instanceof UInt64 ? Il2Cpp3.corlib.class("System.UInt64") : valueOrNull instanceof NativePointer ? klass ?? Il2Cpp3.corlib.class("System.IntPtr") : valueOrNull instanceof Il2Cpp3.ValueType ? valueOrNull.type.class : klass ?? raise(`A class must be specified when constructing a nullable for value '${valueOrNull}'`);
    if (actualClass.isValueType == false) {
      raise(`Cannot create nullable value type out of a reference type '${actualClass.type.name}'`);
    }
    const inflatedClass = Il2Cpp3.corlib.class("System.Nullable`1").inflate(actualClass);
    const struct = new Il2Cpp3.ValueType(Memory.alloc(inflatedClass.valueTypeSize), inflatedClass.type);
    (struct.tryField("hasValue") ?? struct.field("has_value")).value = valueOrNull != null;
    if (valueOrNull != null) {
      struct.field("value").value = valueOrNull;
    }
    return struct;
  }
  Il2Cpp3.nullable = nullable;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  async function perform(block, flag = "bind") {
    let attachedThread = null;
    try {
      const isInMainThread = await Il2Cpp3.initialize(flag == "main");
      if (flag == "main" && !isInMainThread) {
        return perform(() => Il2Cpp3.mainThread.schedule(block), "free");
      }
      if (Il2Cpp3.currentThread == null) {
        attachedThread = Il2Cpp3.domain.attach();
      }
      if (flag == "bind" && attachedThread != null) {
        Script.bindWeak(globalThis, () => attachedThread?.detach());
      }
      const result = block();
      return result instanceof Promise ? await result : result;
    } catch (error) {
      Script.nextTick((_) => {
        throw _;
      }, error);
      return Promise.reject(error);
    } finally {
      if (flag == "free" && attachedThread != null) {
        attachedThread.detach();
      }
    }
  }
  Il2Cpp3.perform = perform;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Tracer {
    /** @internal */
    #state = {
      depth: 0,
      buffer: [],
      history: /* @__PURE__ */ new Set(),
      flush: () => {
        if (this.#state.depth == 0) {
          const message = `
${this.#state.buffer.join("\n")}
`;
          if (this.#verbose) {
            inform(message);
          } else {
            const hash = cyrb53(message);
            if (!this.#state.history.has(hash)) {
              this.#state.history.add(hash);
              inform(message);
            }
          }
          this.#state.buffer.length = 0;
        }
      }
    };
    /** @internal */
    #threadId = Il2Cpp3.mainThread.id;
    /** @internal */
    #verbose = false;
    /** @internal */
    #applier;
    /** @internal */
    #targets = [];
    /** @internal */
    #domain;
    /** @internal */
    #assemblies;
    /** @internal */
    #classes;
    /** @internal */
    #methods;
    /** @internal */
    #assemblyFilter;
    /** @internal */
    #classFilter;
    /** @internal */
    #methodFilter;
    /** @internal */
    #parameterFilter;
    constructor(applier) {
      this.#applier = applier;
    }
    /** */
    thread(thread) {
      this.#threadId = thread.id;
      return this;
    }
    /** Determines whether print duplicate logs. */
    verbose(value) {
      this.#verbose = value;
      return this;
    }
    /** Sets the application domain as the place where to find the target methods. */
    domain() {
      this.#domain = Il2Cpp3.domain;
      return this;
    }
    /** Sets the passed `assemblies` as the place where to find the target methods. */
    assemblies(...assemblies) {
      this.#assemblies = assemblies;
      return this;
    }
    /** Sets the passed `classes` as the place where to find the target methods. */
    classes(...classes) {
      this.#classes = classes;
      return this;
    }
    /** Sets the passed `methods` as the target methods. */
    methods(...methods) {
      this.#methods = methods;
      return this;
    }
    /** Filters the assemblies where to find the target methods. */
    filterAssemblies(filter) {
      this.#assemblyFilter = filter;
      return this;
    }
    /** Filters the classes where to find the target methods. */
    filterClasses(filter) {
      this.#classFilter = filter;
      return this;
    }
    /** Filters the target methods. */
    filterMethods(filter) {
      this.#methodFilter = filter;
      return this;
    }
    /** Filters the target methods. */
    filterParameters(filter) {
      this.#parameterFilter = filter;
      return this;
    }
    /** Commits the current changes by finding the target methods. */
    and() {
      const filterMethod = (method) => {
        if (this.#parameterFilter == void 0) {
          this.#targets.push(method);
          return;
        }
        for (const parameter of method.parameters) {
          if (this.#parameterFilter(parameter)) {
            this.#targets.push(method);
            break;
          }
        }
      };
      const filterMethods = (values) => {
        for (const method of values) {
          filterMethod(method);
        }
      };
      const filterClass = (klass) => {
        if (this.#methodFilter == void 0) {
          filterMethods(klass.methods);
          return;
        }
        for (const method of klass.methods) {
          if (this.#methodFilter(method)) {
            filterMethod(method);
          }
        }
      };
      const filterClasses = (values) => {
        for (const klass of values) {
          filterClass(klass);
        }
      };
      const filterAssembly = (assembly) => {
        if (this.#classFilter == void 0) {
          filterClasses(assembly.image.classes);
          return;
        }
        for (const klass of assembly.image.classes) {
          if (this.#classFilter(klass)) {
            filterClass(klass);
          }
        }
      };
      const filterAssemblies = (assemblies) => {
        for (const assembly of assemblies) {
          filterAssembly(assembly);
        }
      };
      const filterDomain = (domain) => {
        if (this.#assemblyFilter == void 0) {
          filterAssemblies(domain.assemblies);
          return;
        }
        for (const assembly of domain.assemblies) {
          if (this.#assemblyFilter(assembly)) {
            filterAssembly(assembly);
          }
        }
      };
      this.#methods ? filterMethods(this.#methods) : this.#classes ? filterClasses(this.#classes) : this.#assemblies ? filterAssemblies(this.#assemblies) : this.#domain ? filterDomain(this.#domain) : void 0;
      this.#assemblies = void 0;
      this.#classes = void 0;
      this.#methods = void 0;
      this.#assemblyFilter = void 0;
      this.#classFilter = void 0;
      this.#methodFilter = void 0;
      this.#parameterFilter = void 0;
      return this;
    }
    /** Starts tracing. */
    attach() {
      for (const target of this.#targets) {
        if (!target.virtualAddress.isNull()) {
          try {
            this.#applier(target, this.#state, this.#threadId);
          } catch (e) {
            switch (e.message) {
              case /unable to intercept function at \w+; please file a bug/.exec(e.message)?.input:
              case "already replaced this function":
                break;
              default:
                throw e;
            }
          }
        }
      }
    }
  }
  Il2Cpp3.Tracer = Tracer;
  function trace(parameters = false) {
    const applier = () => (method, state, threadId) => {
      const paddedVirtualAddress = method.relativeVirtualAddress.toString(16).padStart(8, "0");
      Interceptor.attach(method.virtualAddress, {
        onEnter() {
          if (this.threadId == threadId) {
            state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(state.depth++)}\u250C\u2500\x1B[35m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m`);
          }
        },
        onLeave() {
          if (this.threadId == threadId) {
            state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(--state.depth)}\u2514\u2500\x1B[33m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m`);
            state.flush();
          }
        }
      });
    };
    const applierWithParameters = () => (method, state, threadId) => {
      const paddedVirtualAddress = method.relativeVirtualAddress.toString(16).padStart(8, "0");
      const startIndex = +!method.isStatic | +Il2Cpp3.unityVersionIsBelow201830;
      const callback = function (...args) {
        if (this.threadId == threadId) {
          const thisParameter = method.isStatic ? void 0 : new Il2Cpp3.Parameter("this", -1, method.class.type);
          const parameters2 = thisParameter ? [thisParameter].concat(method.parameters) : method.parameters;
          state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(state.depth++)}\u250C\u2500\x1B[35m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m(${parameters2.map((e) => `\x1B[32m${e.name}\x1B[0m = \x1B[31m${Il2Cpp3.fromFridaValue(args[e.position + startIndex], e.type)}\x1B[0m`).join(", ")})`);
        }
        const returnValue = method.nativeFunction(...args);
        if (this.threadId == threadId) {
          state.buffer.push(`\x1B[2m0x${paddedVirtualAddress}\x1B[0m ${`\u2502 `.repeat(--state.depth)}\u2514\u2500\x1B[33m${method.class.type.name}::\x1B[1m${method.name}\x1B[0m\x1B[0m${returnValue == void 0 ? "" : ` = \x1B[36m${Il2Cpp3.fromFridaValue(returnValue, method.returnType)}`}\x1B[0m`);
          state.flush();
        }
        return returnValue;
      };
      method.revert();
      const nativeCallback = new NativeCallback(callback, method.returnType.fridaAlias, method.fridaSignature);
      Interceptor.replace(method.virtualAddress, nativeCallback);
    };
    return new Il2Cpp3.Tracer(parameters ? applierWithParameters() : applier());
  }
  Il2Cpp3.trace = trace;
  function backtrace(mode) {
    const methods = Il2Cpp3.domain.assemblies.flatMap((_) => _.image.classes.flatMap((_2) => _2.methods.filter((_3) => !_3.virtualAddress.isNull()))).sort((_, __) => _.virtualAddress.compare(__.virtualAddress));
    const searchInsert = (target) => {
      let left = 0;
      let right = methods.length - 1;
      while (left <= right) {
        const pivot = Math.floor((left + right) / 2);
        const comparison = methods[pivot].virtualAddress.compare(target);
        if (comparison == 0) {
          return methods[pivot];
        } else if (comparison > 0) {
          right = pivot - 1;
        } else {
          left = pivot + 1;
        }
      }
      return methods[right];
    };
    const applier = () => (method, state, threadId) => {
      Interceptor.attach(method.virtualAddress, function () {
        if (this.threadId == threadId) {
          const handles = globalThis.Thread.backtrace(this.context, mode);
          handles.unshift(method.virtualAddress);
          for (const handle of handles) {
            if (handle.compare(Il2Cpp3.module.base) > 0 && handle.compare(Il2Cpp3.module.base.add(Il2Cpp3.module.size)) < 0) {
              const method2 = searchInsert(handle);
              if (method2) {
                const offset = handle.sub(method2.virtualAddress);
                if (offset.compare(4095) < 0) {
                  state.buffer.push(`\x1B[2m0x${method2.relativeVirtualAddress.toString(16).padStart(8, "0")}\x1B[0m\x1B[2m+0x${offset.toString(16).padStart(3, `0`)}\x1B[0m ${method2.class.type.name}::\x1B[1m${method2.name}\x1B[0m`);
                }
              }
            }
          }
          state.flush();
        }
      });
    };
    return new Il2Cpp3.Tracer(applier());
  }
  Il2Cpp3.backtrace = backtrace;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Array2 extends NativeStruct {
    /** Gets the Il2CppArray struct size, possibly equal to `Process.pointerSize * 4`. */
    static get headerSize() {
      return Il2Cpp3.corlib.class("System.Array").instanceSize;
    }
    /** @internal Gets a pointer to the first element of the current array. */
    get elements() {
      const array2 = Il2Cpp3.string("vfsfitvnm").object.method("ToCharArray", 0).invoke();
      const offset = Memory.scanSync(array2.handle, 255, "76 00 66 00 73 00 66 00 69 00 74 00 76 00 6e 00 6d 00")[0]?.address?.sub(array2.handle) ?? raise("couldn't find the elements offset in the native array struct");
      getter(Il2Cpp3.Array.prototype, "elements", function () {
        return new Il2Cpp3.Pointer(this.handle.add(offset), this.elementType);
      }, lazy);
      return this.elements;
    }
    /** Gets the size of the object encompassed by the current array. */
    get elementSize() {
      return this.elementType.class.arrayElementSize;
    }
    /** Gets the type of the object encompassed by the current array. */
    get elementType() {
      return this.object.class.type.class.baseType;
    }
    /** Gets the total number of elements in all the dimensions of the current array. */
    get length() {
      return Il2Cpp3.exports.arrayGetLength(this);
    }
    /** Gets the encompassing object of the current array. */
    get object() {
      return new Il2Cpp3.Object(this);
    }
    /** Gets the element at the specified index of the current array. */
    get(index) {
      if (index < 0 || index >= this.length) {
        raise(`cannot get element at index ${index} as the array length is ${this.length}`);
      }
      return this.elements.get(index);
    }
    /** Sets the element at the specified index of the current array. */
    set(index, value) {
      if (index < 0 || index >= this.length) {
        raise(`cannot set element at index ${index} as the array length is ${this.length}`);
      }
      this.elements.set(index, value);
    }
    /** */
    toString() {
      return this.isNull() ? "null" : `[${this.elements.read(this.length, 0)}]`;
    }
    /** Iterable. */
    *[Symbol.iterator]() {
      for (let i = 0; i < this.length; i++) {
        yield this.elements.get(i);
      }
    }
  }
  __decorate([
    lazy
  ], Array2.prototype, "elementSize", null);
  __decorate([
    lazy
  ], Array2.prototype, "elementType", null);
  __decorate([
    lazy
  ], Array2.prototype, "length", null);
  __decorate([
    lazy
  ], Array2.prototype, "object", null);
  __decorate([
    lazy
  ], Array2, "headerSize", null);
  Il2Cpp3.Array = Array2;
  function array(klass, lengthOrElements) {
    const length = typeof lengthOrElements == "number" ? lengthOrElements : lengthOrElements.length;
    const array2 = new Il2Cpp3.Array(Il2Cpp3.exports.arrayNew(klass, length));
    if (globalThis.Array.isArray(lengthOrElements)) {
      array2.elements.write(lengthOrElements);
    }
    return array2;
  }
  Il2Cpp3.array = array;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  let Assembly = class Assembly extends NativeStruct {
    /** Gets the image of this assembly. */
    get image() {
      if (Il2Cpp3.exports.assemblyGetImage.isNull()) {
        const runtimeModule = this.object.tryMethod("GetType", 1)?.invoke(Il2Cpp3.string("<Module>"))?.asNullable()?.tryMethod("get_Module")?.invoke() ?? this.object.tryMethod("GetModules", 1)?.invoke(false)?.get(0) ?? raise(`couldn't find the runtime module object of assembly ${this.name}`);
        return new Il2Cpp3.Image(runtimeModule.field("_impl").value);
      }
      return new Il2Cpp3.Image(Il2Cpp3.exports.assemblyGetImage(this));
    }
    /** Gets the name of this assembly. */
    get name() {
      return this.image.name.replace(".dll", "");
    }
    /** Gets the encompassing object of the current assembly. */
    get object() {
      for (const _ of Il2Cpp3.domain.object.method("GetAssemblies", 1).invoke(false)) {
        if (_.field("_mono_assembly").value.equals(this)) {
          return _;
        }
      }
      raise("couldn't find the object of the native assembly struct");
    }
  };
  __decorate([
    lazy
  ], Assembly.prototype, "name", null);
  __decorate([
    lazy
  ], Assembly.prototype, "object", null);
  Assembly = __decorate([
    recycle
  ], Assembly);
  Il2Cpp3.Assembly = Assembly;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  let Class = class Class extends NativeStruct {
    /** Gets the actual size of the instance of the current class. */
    get actualInstanceSize() {
      const SystemString = Il2Cpp3.corlib.class("System.String");
      const offset = SystemString.handle.offsetOf((_) => _.readInt() == SystemString.instanceSize - 2) ?? raise("couldn't find the actual instance size offset in the native class struct");
      getter(Il2Cpp3.Class.prototype, "actualInstanceSize", function () {
        return this.handle.add(offset).readS32();
      }, lazy);
      return this.actualInstanceSize;
    }
    /** Gets the array class which encompass the current class. */
    get arrayClass() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.classGetArrayClass(this, 1));
    }
    /** Gets the size of the object encompassed by the current array class. */
    get arrayElementSize() {
      return Il2Cpp3.exports.classGetArrayElementSize(this);
    }
    /** Gets the name of the assembly in which the current class is defined. */
    get assemblyName() {
      return Il2Cpp3.exports.classGetAssemblyName(this).readUtf8String().replace(".dll", "");
    }
    /** Gets the class that declares the current nested class. */
    get declaringClass() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.classGetDeclaringType(this)).asNullable();
    }
    /** Gets the encompassed type of this array, reference, pointer or enum type. */
    get baseType() {
      return new Il2Cpp3.Type(Il2Cpp3.exports.classGetBaseType(this)).asNullable();
    }
    /** Gets the class of the object encompassed or referred to by the current array, pointer or reference class. */
    get elementClass() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.classGetElementClass(this)).asNullable();
    }
    /** Gets the fields of the current class. */
    get fields() {
      return readNativeIterator((_) => Il2Cpp3.exports.classGetFields(this, _)).map((_) => new Il2Cpp3.Field(_));
    }
    /** Gets the flags of the current class. */
    get flags() {
      return Il2Cpp3.exports.classGetFlags(this);
    }
    /** Gets the full name (namespace + name) of the current class. */
    get fullName() {
      return this.namespace ? `${this.namespace}.${this.name}` : this.name;
    }
    /** Gets the generic class of the current class if the current class is inflated. */
    get genericClass() {
      const klass = this.image.tryClass(this.fullName)?.asNullable();
      return klass?.equals(this) ? null : klass ?? null;
    }
    /** Gets the generics parameters of this generic class. */
    get generics() {
      if (!this.isGeneric && !this.isInflated) {
        return [];
      }
      const types = this.type.object.method("GetGenericArguments").invoke();
      return globalThis.Array.from(types).map((_) => new Il2Cpp3.Class(Il2Cpp3.exports.classFromObject(_)));
    }
    /** Determines whether the GC has tracking references to the current class instances. */
    get hasReferences() {
      return !!Il2Cpp3.exports.classHasReferences(this);
    }
    /** Determines whether ther current class has a valid static constructor. */
    get hasStaticConstructor() {
      const staticConstructor = this.tryMethod(".cctor");
      return staticConstructor != null && !staticConstructor.virtualAddress.isNull();
    }
    /** Gets the image in which the current class is defined. */
    get image() {
      return new Il2Cpp3.Image(Il2Cpp3.exports.classGetImage(this));
    }
    /** Gets the size of the instance of the current class. */
    get instanceSize() {
      return Il2Cpp3.exports.classGetInstanceSize(this);
    }
    /** Determines whether the current class is abstract. */
    get isAbstract() {
      return !!Il2Cpp3.exports.classIsAbstract(this);
    }
    /** Determines whether the current class is blittable. */
    get isBlittable() {
      return !!Il2Cpp3.exports.classIsBlittable(this);
    }
    /** Determines whether the current class is an enumeration. */
    get isEnum() {
      return !!Il2Cpp3.exports.classIsEnum(this);
    }
    /** Determines whether the current class is a generic one. */
    get isGeneric() {
      return !!Il2Cpp3.exports.classIsGeneric(this);
    }
    /** Determines whether the current class is inflated. */
    get isInflated() {
      return !!Il2Cpp3.exports.classIsInflated(this);
    }
    /** Determines whether the current class is an interface. */
    get isInterface() {
      return !!Il2Cpp3.exports.classIsInterface(this);
    }
    /** Determines whether the current class is a struct. */
    get isStruct() {
      return this.isValueType && !this.isEnum;
    }
    /** Determines whether the current class is a value type. */
    get isValueType() {
      return !!Il2Cpp3.exports.classIsValueType(this);
    }
    /** Gets the interfaces implemented or inherited by the current class. */
    get interfaces() {
      return readNativeIterator((_) => Il2Cpp3.exports.classGetInterfaces(this, _)).map((_) => new Il2Cpp3.Class(_));
    }
    /** Gets the methods implemented by the current class. */
    get methods() {
      return readNativeIterator((_) => Il2Cpp3.exports.classGetMethods(this, _)).map((_) => new Il2Cpp3.Method(_));
    }
    /** Gets the name of the current class. */
    get name() {
      return Il2Cpp3.exports.classGetName(this).readUtf8String();
    }
    /** Gets the namespace of the current class. */
    get namespace() {
      return Il2Cpp3.exports.classGetNamespace(this).readUtf8String() || void 0;
    }
    /** Gets the classes nested inside the current class. */
    get nestedClasses() {
      return readNativeIterator((_) => Il2Cpp3.exports.classGetNestedClasses(this, _)).map((_) => new Il2Cpp3.Class(_));
    }
    /** Gets the class from which the current class directly inherits. */
    get parent() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.classGetParent(this)).asNullable();
    }
    /** Gets the pointer class of the current class. */
    get pointerClass() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.classFromObject(this.type.object.method("MakePointerType").invoke()));
    }
    /** Gets the rank (number of dimensions) of the current array class. */
    get rank() {
      let rank = 0;
      const name = this.name;
      for (let i = this.name.length - 1; i > 0; i--) {
        const c = name[i];
        if (c == "]")
          rank++;
        else if (c == "[" || rank == 0)
          break;
        else if (c == ",")
          rank++;
        else
          break;
      }
      return rank;
    }
    /** Gets a pointer to the static fields of the current class. */
    get staticFieldsData() {
      return Il2Cpp3.exports.classGetStaticFieldData(this);
    }
    /** Gets the size of the instance - as a value type - of the current class. */
    get valueTypeSize() {
      return Il2Cpp3.exports.classGetValueTypeSize(this, NULL);
    }
    /** Gets the type of the current class. */
    get type() {
      return new Il2Cpp3.Type(Il2Cpp3.exports.classGetType(this));
    }
    /** Allocates a new object of the current class. */
    alloc() {
      return new Il2Cpp3.Object(Il2Cpp3.exports.objectNew(this));
    }
    /** Gets the field identified by the given name. */
    field(name) {
      return this.tryField(name) ?? raise(`couldn't find field ${name} in class ${this.type.name}`);
    }
    /** Gets the hierarchy of the current class. */
    *hierarchy(options) {
      let klass = options?.includeCurrent ?? true ? this : this.parent;
      while (klass) {
        yield klass;
        klass = klass.parent;
      }
    }
    /** Builds a generic instance of the current generic class. */
    inflate(...classes) {
      if (!this.isGeneric) {
        raise(`cannot inflate class ${this.type.name} as it has no generic parameters`);
      }
      if (this.generics.length != classes.length) {
        raise(`cannot inflate class ${this.type.name} as it needs ${this.generics.length} generic parameter(s), not ${classes.length}`);
      }
      const types = classes.map((_) => _.type.object);
      const typeArray = Il2Cpp3.array(Il2Cpp3.corlib.class("System.Type"), types);
      const inflatedType = this.type.object.method("MakeGenericType", 1).invoke(typeArray);
      return new Il2Cpp3.Class(Il2Cpp3.exports.classFromObject(inflatedType));
    }
    /** Calls the static constructor of the current class. */
    initialize() {
      Il2Cpp3.exports.classInitialize(this);
      return this;
    }
    /** Determines whether an instance of `other` class can be assigned to a variable of the current type. */
    isAssignableFrom(other) {
      return !!Il2Cpp3.exports.classIsAssignableFrom(this, other);
    }
    /** Determines whether the current class derives from `other` class. */
    isSubclassOf(other, checkInterfaces) {
      return !!Il2Cpp3.exports.classIsSubclassOf(this, other, +checkInterfaces);
    }
    /** Gets the method identified by the given name and parameter count. */
    method(name, parameterCount = -1) {
      return this.tryMethod(name, parameterCount) ?? raise(`couldn't find method ${name} in class ${this.type.name}`);
    }
    /** Gets the nested class with the given name. */
    nested(name) {
      return this.tryNested(name) ?? raise(`couldn't find nested class ${name} in class ${this.type.name}`);
    }
    /** Allocates a new object of the current class and calls its default constructor. */
    new() {
      const object = this.alloc();
      const exceptionArray = Memory.alloc(Process.pointerSize);
      Il2Cpp3.exports.objectInitialize(object, exceptionArray);
      const exception = exceptionArray.readPointer();
      if (!exception.isNull()) {
        raise(new Il2Cpp3.Object(exception).toString());
      }
      return object;
    }
    /** Gets the field with the given name. */
    tryField(name) {
      return new Il2Cpp3.Field(Il2Cpp3.exports.classGetFieldFromName(this, Memory.allocUtf8String(name))).asNullable();
    }
    /** Gets the method with the given name and parameter count. */
    tryMethod(name, parameterCount = -1) {
      return new Il2Cpp3.Method(Il2Cpp3.exports.classGetMethodFromName(this, Memory.allocUtf8String(name), parameterCount)).asNullable();
    }
    /** Gets the nested class with the given name. */
    tryNested(name) {
      return this.nestedClasses.find((_) => _.name == name);
    }
    /** */
    toString() {
      const inherited = [this.parent].concat(this.interfaces);
      return `// ${this.assemblyName}
${this.isEnum ? `enum` : this.isStruct ? `struct` : this.isInterface ? `interface` : `class`} ${this.type.name}${inherited ? ` : ${inherited.map((_) => _?.type.name).join(`, `)}` : ``}
{
    ${this.fields.join(`
    `)}
    ${this.methods.join(`
    `)}
}`;
    }
    /** Executes a callback for every defined class. */
    static enumerate(block) {
      const callback = new NativeCallback((_) => block(new Il2Cpp3.Class(_)), "void", ["pointer", "pointer"]);
      return Il2Cpp3.exports.classForEach(callback, NULL);
    }
  };
  __decorate([
    lazy
  ], Class.prototype, "arrayClass", null);
  __decorate([
    lazy
  ], Class.prototype, "arrayElementSize", null);
  __decorate([
    lazy
  ], Class.prototype, "assemblyName", null);
  __decorate([
    lazy
  ], Class.prototype, "declaringClass", null);
  __decorate([
    lazy
  ], Class.prototype, "baseType", null);
  __decorate([
    lazy
  ], Class.prototype, "elementClass", null);
  __decorate([
    lazy
  ], Class.prototype, "fields", null);
  __decorate([
    lazy
  ], Class.prototype, "flags", null);
  __decorate([
    lazy
  ], Class.prototype, "fullName", null);
  __decorate([
    lazy
  ], Class.prototype, "generics", null);
  __decorate([
    lazy
  ], Class.prototype, "hasReferences", null);
  __decorate([
    lazy
  ], Class.prototype, "hasStaticConstructor", null);
  __decorate([
    lazy
  ], Class.prototype, "image", null);
  __decorate([
    lazy
  ], Class.prototype, "instanceSize", null);
  __decorate([
    lazy
  ], Class.prototype, "isAbstract", null);
  __decorate([
    lazy
  ], Class.prototype, "isBlittable", null);
  __decorate([
    lazy
  ], Class.prototype, "isEnum", null);
  __decorate([
    lazy
  ], Class.prototype, "isGeneric", null);
  __decorate([
    lazy
  ], Class.prototype, "isInflated", null);
  __decorate([
    lazy
  ], Class.prototype, "isInterface", null);
  __decorate([
    lazy
  ], Class.prototype, "isValueType", null);
  __decorate([
    lazy
  ], Class.prototype, "interfaces", null);
  __decorate([
    lazy
  ], Class.prototype, "methods", null);
  __decorate([
    lazy
  ], Class.prototype, "name", null);
  __decorate([
    lazy
  ], Class.prototype, "namespace", null);
  __decorate([
    lazy
  ], Class.prototype, "nestedClasses", null);
  __decorate([
    lazy
  ], Class.prototype, "parent", null);
  __decorate([
    lazy
  ], Class.prototype, "pointerClass", null);
  __decorate([
    lazy
  ], Class.prototype, "rank", null);
  __decorate([
    lazy
  ], Class.prototype, "staticFieldsData", null);
  __decorate([
    lazy
  ], Class.prototype, "valueTypeSize", null);
  __decorate([
    lazy
  ], Class.prototype, "type", null);
  Class = __decorate([
    recycle
  ], Class);
  Il2Cpp3.Class = Class;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  function delegate(klass, block) {
    const SystemDelegate = Il2Cpp3.corlib.class("System.Delegate");
    const SystemMulticastDelegate = Il2Cpp3.corlib.class("System.MulticastDelegate");
    if (!SystemDelegate.isAssignableFrom(klass)) {
      raise(`cannot create a delegate for ${klass.type.name} as it's a non-delegate class`);
    }
    if (klass.equals(SystemDelegate) || klass.equals(SystemMulticastDelegate)) {
      raise(`cannot create a delegate for neither ${SystemDelegate.type.name} nor ${SystemMulticastDelegate.type.name}, use a subclass instead`);
    }
    const delegate2 = klass.alloc();
    const key = delegate2.handle.toString();
    const Invoke = delegate2.tryMethod("Invoke") ?? raise(`cannot create a delegate for ${klass.type.name}, there is no Invoke method`);
    delegate2.method(".ctor").invoke(delegate2, Invoke.handle);
    const callback = Invoke.wrap(block);
    delegate2.field("method_ptr").value = callback;
    delegate2.field("invoke_impl").value = callback;
    Il2Cpp3._callbacksToKeepAlive[key] = callback;
    return delegate2;
  }
  Il2Cpp3.delegate = delegate;
  Il2Cpp3._callbacksToKeepAlive = {};
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  let Domain = class Domain extends NativeStruct {
    /** Gets the assemblies that have been loaded into the execution context of the application domain. */
    get assemblies() {
      let handles = readNativeList((_) => Il2Cpp3.exports.domainGetAssemblies(this, _));
      if (handles.length == 0) {
        const assemblyObjects = this.object.method("GetAssemblies").overload().invoke();
        handles = globalThis.Array.from(assemblyObjects).map((_) => _.field("_mono_assembly").value);
      }
      return handles.map((_) => new Il2Cpp3.Assembly(_));
    }
    /** Gets the encompassing object of the application domain. */
    get object() {
      return Il2Cpp3.corlib.class("System.AppDomain").method("get_CurrentDomain").invoke();
    }
    /** Opens and loads the assembly with the given name. */
    assembly(name) {
      return this.tryAssembly(name) ?? raise(`couldn't find assembly ${name}`);
    }
    /** Attached a new thread to the application domain. */
    attach() {
      return new Il2Cpp3.Thread(Il2Cpp3.exports.threadAttach(this));
    }
    /** Opens and loads the assembly with the given name. */
    tryAssembly(name) {
      return new Il2Cpp3.Assembly(Il2Cpp3.exports.domainGetAssemblyFromName(this, Memory.allocUtf8String(name))).asNullable();
    }
  };
  __decorate([
    lazy
  ], Domain.prototype, "assemblies", null);
  __decorate([
    lazy
  ], Domain.prototype, "object", null);
  Domain = __decorate([
    recycle
  ], Domain);
  Il2Cpp3.Domain = Domain;
  getter(Il2Cpp3, "domain", () => {
    return new Il2Cpp3.Domain(Il2Cpp3.exports.domainGet());
  }, lazy);
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Field extends NativeStruct {
    /** Gets the class in which this field is defined. */
    get class() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.fieldGetClass(this));
    }
    /** Gets the flags of the current field. */
    get flags() {
      return Il2Cpp3.exports.fieldGetFlags(this);
    }
    /** Determines whether this field value is known at compile time. */
    get isLiteral() {
      return (this.flags & 64) != 0;
    }
    /** Determines whether this field is static. */
    get isStatic() {
      return (this.flags & 16) != 0;
    }
    /** Determines whether this field is thread static. */
    get isThreadStatic() {
      const offset = Il2Cpp3.corlib.class("System.AppDomain").field("type_resolve_in_progress").offset;
      getter(Il2Cpp3.Field.prototype, "isThreadStatic", function () {
        return this.offset == offset;
      }, lazy);
      return this.isThreadStatic;
    }
    /** Gets the access modifier of this field. */
    get modifier() {
      switch (this.flags & 7) {
        case 1:
          return "private";
        case 2:
          return "private protected";
        case 3:
          return "internal";
        case 4:
          return "protected";
        case 5:
          return "protected internal";
        case 6:
          return "public";
      }
    }
    /** Gets the name of this field. */
    get name() {
      return Il2Cpp3.exports.fieldGetName(this).readUtf8String();
    }
    /** Gets the offset of this field, calculated as the difference with its owner virtual address. */
    get offset() {
      return Il2Cpp3.exports.fieldGetOffset(this);
    }
    /** Gets the type of this field. */
    get type() {
      return new Il2Cpp3.Type(Il2Cpp3.exports.fieldGetType(this));
    }
    /** Gets the value of this field. */
    get value() {
      if (!this.isStatic) {
        raise(`cannot access instance field ${this.class.type.name}::${this.name} from a class, use an object instead`);
      }
      const handle = Memory.alloc(Process.pointerSize);
      Il2Cpp3.exports.fieldGetStaticValue(this.handle, handle);
      return Il2Cpp3.read(handle, this.type);
    }
    /** Sets the value of this field. Thread static or literal values cannot be altered yet. */
    set value(value) {
      if (!this.isStatic) {
        raise(`cannot access instance field ${this.class.type.name}::${this.name} from a class, use an object instead`);
      }
      if (this.isThreadStatic || this.isLiteral) {
        raise(`cannot write the value of field ${this.name} as it's thread static or literal`);
      }
      const handle = (
        // pointer-like values should be passed as-is, but boxed
        // value types (primitives included) must be unboxed first
        value instanceof Il2Cpp3.Object && this.type.class.isValueType ? value.unbox() : value instanceof NativeStruct ? value.handle : value instanceof NativePointer ? value : Il2Cpp3.write(Memory.alloc(this.type.class.valueTypeSize), value, this.type)
      );
      Il2Cpp3.exports.fieldSetStaticValue(this.handle, handle);
    }
    /** */
    toString() {
      return `${this.isThreadStatic ? `[ThreadStatic] ` : ``}${this.isStatic ? `static ` : ``}${this.type.name} ${this.name}${this.isLiteral ? ` = ${this.type.class.isEnum ? Il2Cpp3.read(this.value.handle, this.type.class.baseType) : this.value}` : ``};${this.isThreadStatic || this.isLiteral ? `` : ` // 0x${this.offset.toString(16)}`}`;
    }
    /**
     * @internal
     * Binds the current field to a {@link Il2Cpp.Object} or a
     * {@link Il2Cpp.ValueType} (also known as *instances*), so that it is
     * possible to retrieve its value - see {@link Il2Cpp.Field.value} for
     * details. \
     * Binding a static field is forbidden.
     */
    bind(instance) {
      if (this.isStatic) {
        raise(`cannot bind static field ${this.class.type.name}::${this.name} to an instance`);
      }
      const offset = this.offset - (instance instanceof Il2Cpp3.ValueType ? Il2Cpp3.Object.headerSize : 0);
      return new Proxy(this, {
        get(target, property) {
          if (property == "value") {
            return Il2Cpp3.read(instance.handle.add(offset), target.type);
          }
          return Reflect.get(target, property);
        },
        set(target, property, value) {
          if (property == "value") {
            Il2Cpp3.write(instance.handle.add(offset), value, target.type);
            return true;
          }
          return Reflect.set(target, property, value);
        }
      });
    }
  }
  __decorate([
    lazy
  ], Field.prototype, "class", null);
  __decorate([
    lazy
  ], Field.prototype, "flags", null);
  __decorate([
    lazy
  ], Field.prototype, "isLiteral", null);
  __decorate([
    lazy
  ], Field.prototype, "isStatic", null);
  __decorate([
    lazy
  ], Field.prototype, "isThreadStatic", null);
  __decorate([
    lazy
  ], Field.prototype, "modifier", null);
  __decorate([
    lazy
  ], Field.prototype, "name", null);
  __decorate([
    lazy
  ], Field.prototype, "offset", null);
  __decorate([
    lazy
  ], Field.prototype, "type", null);
  Il2Cpp3.Field = Field;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class GCHandle {
    handle;
    /** @internal */
    constructor(handle) {
      this.handle = handle;
    }
    /** Gets the object associated to this handle. */
    get target() {
      return new Il2Cpp3.Object(Il2Cpp3.exports.gcHandleGetTarget(this.handle)).asNullable();
    }
    /** Frees this handle. */
    free() {
      return Il2Cpp3.exports.gcHandleFree(this.handle);
    }
  }
  Il2Cpp3.GCHandle = GCHandle;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  let Image = class Image extends NativeStruct {
    /** Gets the assembly in which the current image is defined. */
    get assembly() {
      return new Il2Cpp3.Assembly(Il2Cpp3.exports.imageGetAssembly(this));
    }
    /** Gets the amount of classes defined in this image. */
    get classCount() {
      if (Il2Cpp3.unityVersionIsBelow201830) {
        return this.classes.length;
      } else {
        return Il2Cpp3.exports.imageGetClassCount(this);
      }
    }
    /** Gets the classes defined in this image. */
    get classes() {
      if (Il2Cpp3.unityVersionIsBelow201830) {
        const types = this.assembly.object.method("GetTypes").invoke(false);
        const classes = globalThis.Array.from(types, (_) => new Il2Cpp3.Class(Il2Cpp3.exports.classFromObject(_)));
        const Module = this.tryClass("<Module>");
        if (Module) {
          classes.unshift(Module);
        }
        return classes;
      } else {
        return globalThis.Array.from(globalThis.Array(this.classCount), (_, i) => new Il2Cpp3.Class(Il2Cpp3.exports.imageGetClass(this, i)));
      }
    }
    /** Gets the name of this image. */
    get name() {
      return Il2Cpp3.exports.imageGetName(this).readUtf8String();
    }
    /** Gets the class with the specified name defined in this image. */
    class(name) {
      return this.tryClass(name) ?? raise(`couldn't find class ${name} in assembly ${this.name}`);
    }
    /** Gets the class with the specified name defined in this image. */
    tryClass(name) {
      const dotIndex = name.lastIndexOf(".");
      const classNamespace = Memory.allocUtf8String(dotIndex == -1 ? "" : name.slice(0, dotIndex));
      const className = Memory.allocUtf8String(name.slice(dotIndex + 1));
      return new Il2Cpp3.Class(Il2Cpp3.exports.classFromName(this, classNamespace, className)).asNullable();
    }
  };
  __decorate([
    lazy
  ], Image.prototype, "assembly", null);
  __decorate([
    lazy
  ], Image.prototype, "classCount", null);
  __decorate([
    lazy
  ], Image.prototype, "classes", null);
  __decorate([
    lazy
  ], Image.prototype, "name", null);
  Image = __decorate([
    recycle
  ], Image);
  Il2Cpp3.Image = Image;
  getter(Il2Cpp3, "corlib", () => {
    return new Il2Cpp3.Image(Il2Cpp3.exports.getCorlib());
  }, lazy);
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class MemorySnapshot extends NativeStruct {
    /** Captures a memory snapshot. */
    static capture() {
      return new Il2Cpp3.MemorySnapshot();
    }
    /** Creates a memory snapshot with the given handle. */
    constructor(handle = Il2Cpp3.exports.memorySnapshotCapture()) {
      super(handle);
    }
    /** Gets any initialized class. */
    get classes() {
      return readNativeIterator((_) => Il2Cpp3.exports.memorySnapshotGetClasses(this, _)).map((_) => new Il2Cpp3.Class(_));
    }
    /** Gets the objects tracked by this memory snapshot. */
    get objects() {
      return readNativeList((_) => Il2Cpp3.exports.memorySnapshotGetObjects(this, _)).filter((_) => !_.isNull()).map((_) => new Il2Cpp3.Object(_));
    }
    /** Frees this memory snapshot. */
    free() {
      Il2Cpp3.exports.memorySnapshotFree(this);
    }
  }
  __decorate([
    lazy
  ], MemorySnapshot.prototype, "classes", null);
  __decorate([
    lazy
  ], MemorySnapshot.prototype, "objects", null);
  Il2Cpp3.MemorySnapshot = MemorySnapshot;
  function memorySnapshot(block) {
    const memorySnapshot2 = Il2Cpp3.MemorySnapshot.capture();
    const result = block(memorySnapshot2);
    memorySnapshot2.free();
    return result;
  }
  Il2Cpp3.memorySnapshot = memorySnapshot;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Method extends NativeStruct {
    /** Gets the class in which this method is defined. */
    get class() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.methodGetClass(this));
    }
    /** Gets the flags of the current method. */
    get flags() {
      return Il2Cpp3.exports.methodGetFlags(this, NULL);
    }
    /** Gets the implementation flags of the current method. */
    get implementationFlags() {
      const implementationFlagsPointer = Memory.alloc(Process.pointerSize);
      Il2Cpp3.exports.methodGetFlags(this, implementationFlagsPointer);
      return implementationFlagsPointer.readU32();
    }
    /** */
    get fridaSignature() {
      const types = [];
      for (const parameter of this.parameters) {
        types.push(parameter.type.fridaAlias);
      }
      if (!this.isStatic || Il2Cpp3.unityVersionIsBelow201830) {
        types.unshift("pointer");
      }
      if (this.isInflated) {
        types.push("pointer");
      }
      return types;
    }
    /** Gets the generic parameters of this generic method. */
    get generics() {
      if (!this.isGeneric) {
        return [];
      }
      const types = this.object.method("GetGenericArguments").invoke();
      return globalThis.Array.from(types).map((_) => new Il2Cpp3.Class(Il2Cpp3.exports.classFromObject(_)));
    }
    /** Determines whether this method is external. */
    get isExternal() {
      return (this.implementationFlags & 4096) != 0;
    }
    /** Determines whether this method is generic. */
    get isGeneric() {
      return !!Il2Cpp3.exports.methodIsGeneric(this);
    }
    /** Determines whether this method is inflated (generic with a concrete type parameter). */
    get isInflated() {
      return !!Il2Cpp3.exports.methodIsInflated(this);
    }
    /** Determines whether this method is static. */
    get isStatic() {
      return !Il2Cpp3.exports.methodIsInstance(this);
    }
    /** Determines whether this method is synchronized. */
    get isSynchronized() {
      return (this.implementationFlags & 32) != 0;
    }
    /** Gets the access modifier of this method. */
    get modifier() {
      switch (this.flags & 7) {
        case 1:
          return "private";
        case 2:
          return "private protected";
        case 3:
          return "internal";
        case 4:
          return "protected";
        case 5:
          return "protected internal";
        case 6:
          return "public";
      }
    }
    /** Gets the name of this method. */
    get name() {
      return Il2Cpp3.exports.methodGetName(this).readUtf8String();
    }
    /** @internal */
    get nativeFunction() {
      return new NativeFunction(this.virtualAddress, this.returnType.fridaAlias, this.fridaSignature);
    }
    /** Gets the encompassing object of the current method. */
    get object() {
      return new Il2Cpp3.Object(Il2Cpp3.exports.methodGetObject(this, NULL));
    }
    /** Gets the amount of parameters of this method. */
    get parameterCount() {
      return Il2Cpp3.exports.methodGetParameterCount(this);
    }
    /** Gets the parameters of this method. */
    get parameters() {
      return globalThis.Array.from(globalThis.Array(this.parameterCount), (_, i) => {
        const parameterName = Il2Cpp3.exports.methodGetParameterName(this, i).readUtf8String();
        const parameterType = Il2Cpp3.exports.methodGetParameterType(this, i);
        return new Il2Cpp3.Parameter(parameterName, i, new Il2Cpp3.Type(parameterType));
      });
    }
    /** Gets the relative virtual address (RVA) of this method. */
    get relativeVirtualAddress() {
      return this.virtualAddress.sub(Il2Cpp3.module.base);
    }
    /** Gets the return type of this method. */
    get returnType() {
      return new Il2Cpp3.Type(Il2Cpp3.exports.methodGetReturnType(this));
    }
    /** Gets the virtual address (VA) of this method. */
    get virtualAddress() {
      const FilterTypeName = Il2Cpp3.corlib.class("System.Reflection.Module").initialize().field("FilterTypeName").value;
      const FilterTypeNameMethodPointer = FilterTypeName.field("method_ptr").value;
      const FilterTypeNameMethod = FilterTypeName.field("method").value;
      const offset = FilterTypeNameMethod.offsetOf((_) => _.readPointer().equals(FilterTypeNameMethodPointer)) ?? raise("couldn't find the virtual address offset in the native method struct");
      getter(Il2Cpp3.Method.prototype, "virtualAddress", function () {
        return this.handle.add(offset).readPointer();
      }, lazy);
      Il2Cpp3.corlib.class("System.Reflection.Module").method(".cctor").invoke();
      return this.virtualAddress;
    }
    /** Replaces the body of this method. */
    set implementation(block) {
      try {
        Interceptor.replace(this.virtualAddress, this.wrap(block));
      } catch (e) {
        switch (e.message) {
          case "access violation accessing 0x0":
            raise(`couldn't set implementation for method ${this.name} as it has a NULL virtual address`);
          case /unable to intercept function at \w+; please file a bug/.exec(e.message)?.input:
            warn(`couldn't set implementation for method ${this.name} as it may be a thunk`);
            break;
          case "already replaced this function":
            warn(`couldn't set implementation for method ${this.name} as it has already been replaced by a thunk`);
            break;
          default:
            throw e;
        }
      }
    }
    /** Creates a generic instance of the current generic method. */
    inflate(...classes) {
      if (!this.isGeneric || this.generics.length != classes.length) {
        for (const method of this.overloads()) {
          if (method.isGeneric && method.generics.length == classes.length) {
            return method.inflate(...classes);
          }
        }
        raise(`could not find inflatable signature of method ${this.name} with ${classes.length} generic parameter(s)`);
      }
      const types = classes.map((_) => _.type.object);
      const typeArray = Il2Cpp3.array(Il2Cpp3.corlib.class("System.Type"), types);
      const inflatedMethodObject = this.object.method("MakeGenericMethod", 1).invoke(typeArray);
      return new Il2Cpp3.Method(inflatedMethodObject.field("mhandle").value);
    }
    /** Invokes this method. */
    invoke(...parameters) {
      if (!this.isStatic) {
        raise(`cannot invoke non-static method ${this.name} as it must be invoked throught a Il2Cpp.Object, not a Il2Cpp.Class`);
      }
      return this.invokeRaw(NULL, ...parameters);
    }
    /** @internal */
    invokeRaw(instance, ...parameters) {
      const allocatedParameters = parameters.map(Il2Cpp3.toFridaValue);
      if (!this.isStatic || Il2Cpp3.unityVersionIsBelow201830) {
        allocatedParameters.unshift(instance);
      }
      if (this.isInflated) {
        allocatedParameters.push(this.handle);
      }
      try {
        const returnValue = this.nativeFunction(...allocatedParameters);
        return Il2Cpp3.fromFridaValue(returnValue, this.returnType);
      } catch (e) {
        if (e == null) {
          raise("an unexpected native invocation exception occurred, this is due to parameter types mismatch");
        }
        switch (e.message) {
          case "bad argument count":
            raise(`couldn't invoke method ${this.name} as it needs ${this.parameterCount} parameter(s), not ${parameters.length}`);
          case "expected a pointer":
          case "expected number":
          case "expected array with fields":
            raise(`couldn't invoke method ${this.name} using incorrect parameter types`);
        }
        throw e;
      }
    }
    /** Gets the overloaded method with the given parameter types. */
    overload(...typeNamesOrClasses) {
      const method = this.tryOverload(...typeNamesOrClasses);
      return method ?? raise(`couldn't find overloaded method ${this.name}(${typeNamesOrClasses.map((_) => _ instanceof Il2Cpp3.Class ? _.type.name : _)})`);
    }
    /** @internal */
    *overloads() {
      for (const klass of this.class.hierarchy()) {
        for (const method of klass.methods) {
          if (this.name == method.name) {
            yield method;
          }
        }
      }
    }
    /** Gets the parameter with the given name. */
    parameter(name) {
      return this.tryParameter(name) ?? raise(`couldn't find parameter ${name} in method ${this.name}`);
    }
    /** Restore the original method implementation. */
    revert() {
      Interceptor.revert(this.virtualAddress);
      Interceptor.flush();
    }
    /** Gets the overloaded method with the given parameter types. */
    tryOverload(...typeNamesOrClasses) {
      const minScore = typeNamesOrClasses.length * 1;
      const maxScore = typeNamesOrClasses.length * 2;
      let candidate = void 0;
      loop: for (const method of this.overloads()) {
        if (method.parameterCount != typeNamesOrClasses.length)
          continue;
        let score = 0;
        let i = 0;
        for (const parameter of method.parameters) {
          const desiredTypeNameOrClass = typeNamesOrClasses[i];
          if (desiredTypeNameOrClass instanceof Il2Cpp3.Class) {
            if (parameter.type.is(desiredTypeNameOrClass.type)) {
              score += 2;
            } else if (parameter.type.class.isAssignableFrom(desiredTypeNameOrClass)) {
              score += 1;
            } else {
              continue loop;
            }
          } else if (parameter.type.name == desiredTypeNameOrClass) {
            score += 2;
          } else {
            continue loop;
          }
          i++;
        }
        if (score < minScore) {
          continue;
        } else if (score == maxScore) {
          return method;
        } else if (candidate == void 0 || score > candidate[0]) {
          candidate = [score, method];
        } else if (score == candidate[0]) {
          let i2 = 0;
          for (const parameter of candidate[1].parameters) {
            if (parameter.type.class.isAssignableFrom(method.parameters[i2].type.class)) {
              candidate = [score, method];
              continue loop;
            }
            i2++;
          }
        }
      }
      return candidate?.[1];
    }
    /** Gets the parameter with the given name. */
    tryParameter(name) {
      return this.parameters.find((_) => _.name == name);
    }
    /** */
    toString() {
      return `${this.isStatic ? `static ` : ``}${this.returnType.name} ${this.name}${this.generics.length > 0 ? `<${this.generics.map((_) => _.type.name).join(",")}>` : ""}(${this.parameters.join(`, `)});${this.virtualAddress.isNull() ? `` : ` // 0x${this.relativeVirtualAddress.toString(16).padStart(8, `0`)}`}`;
    }
    /**
     * @internal
     * Binds the current method to a {@link Il2Cpp.Object} or a
     * {@link Il2Cpp.ValueType} (also known as *instances*), so that it is
     * possible to invoke it - see {@link Il2Cpp.Method.invoke} for
     * details. \
     * Binding a static method is forbidden.
     */
    bind(instance) {
      if (this.isStatic) {
        raise(`cannot bind static method ${this.class.type.name}::${this.name} to an instance`);
      }
      return new Proxy(this, {
        get(target, property, receiver) {
          switch (property) {
            case "invoke":
              const handle = instance instanceof Il2Cpp3.ValueType ? target.class.isValueType ? instance.handle.sub(structMethodsRequireObjectInstances() ? Il2Cpp3.Object.headerSize : 0) : raise(`cannot invoke method ${target.class.type.name}::${target.name} against a value type, you must box it first`) : target.class.isValueType ? instance.handle.add(structMethodsRequireObjectInstances() ? 0 : Il2Cpp3.Object.headerSize) : instance.handle;
              return target.invokeRaw.bind(target, handle);
            case "overloads":
              return function* () {
                for (const method of target[property]()) {
                  if (!method.isStatic) {
                    yield method;
                  }
                }
              };
            case "inflate":
            case "overload":
            case "tryOverload":
              const member = Reflect.get(target, property).bind(receiver);
              return function (...args) {
                return member(...args)?.bind(instance);
              };
          }
          return Reflect.get(target, property);
        }
      });
    }
    /** @internal */
    wrap(block) {
      const startIndex = +!this.isStatic | +Il2Cpp3.unityVersionIsBelow201830;
      return new NativeCallback((...args) => {
        const thisObject = this.isStatic ? this.class : this.class.isValueType ? new Il2Cpp3.ValueType(args[0].add(structMethodsRequireObjectInstances() ? Il2Cpp3.Object.headerSize : 0), this.class.type) : new Il2Cpp3.Object(args[0]);
        const parameters = this.parameters.map((_, i) => Il2Cpp3.fromFridaValue(args[i + startIndex], _.type));
        const result = block.call(thisObject, ...parameters);
        return Il2Cpp3.toFridaValue(result);
      }, this.returnType.fridaAlias, this.fridaSignature);
    }
  }
  __decorate([
    lazy
  ], Method.prototype, "class", null);
  __decorate([
    lazy
  ], Method.prototype, "flags", null);
  __decorate([
    lazy
  ], Method.prototype, "implementationFlags", null);
  __decorate([
    lazy
  ], Method.prototype, "fridaSignature", null);
  __decorate([
    lazy
  ], Method.prototype, "generics", null);
  __decorate([
    lazy
  ], Method.prototype, "isExternal", null);
  __decorate([
    lazy
  ], Method.prototype, "isGeneric", null);
  __decorate([
    lazy
  ], Method.prototype, "isInflated", null);
  __decorate([
    lazy
  ], Method.prototype, "isStatic", null);
  __decorate([
    lazy
  ], Method.prototype, "isSynchronized", null);
  __decorate([
    lazy
  ], Method.prototype, "modifier", null);
  __decorate([
    lazy
  ], Method.prototype, "name", null);
  __decorate([
    lazy
  ], Method.prototype, "nativeFunction", null);
  __decorate([
    lazy
  ], Method.prototype, "object", null);
  __decorate([
    lazy
  ], Method.prototype, "parameterCount", null);
  __decorate([
    lazy
  ], Method.prototype, "parameters", null);
  __decorate([
    lazy
  ], Method.prototype, "relativeVirtualAddress", null);
  __decorate([
    lazy
  ], Method.prototype, "returnType", null);
  Il2Cpp3.Method = Method;
  let structMethodsRequireObjectInstances = () => {
    const object = Il2Cpp3.corlib.class("System.Int64").alloc();
    object.field("m_value").value = 3735928559;
    const result = object.method("Equals", 1).overload(object.class).invokeRaw(object, 3735928559);
    return (structMethodsRequireObjectInstances = () => result)();
  };
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Object2 extends NativeStruct {
    /** Gets the Il2CppObject struct size, possibly equal to `Process.pointerSize * 2`. */
    static get headerSize() {
      return Il2Cpp3.corlib.class("System.Object").instanceSize;
    }
    /**
     * Returns the same object, but having its parent class as class.
     * It basically is the C# `base` keyword, so that parent members can be
     * accessed.
     *
     * **Example** \
     * Consider the following classes:
     * ```csharp
     * class Foo
     * {
     *     int foo()
     *     {
     *          return 1;
     *     }
     * }
     * class Bar : Foo
     * {
     *     new int foo()
     *     {
     *          return 2;
     *     }
     * }
     * ```
     * then:
     * ```ts
     * const Bar: Il2Cpp.Class = ...;
     * const bar = Bar.new();
     *
     * console.log(bar.foo()); // 2
     * console.log(bar.base.foo()); // 1
     * ```
     */
    get base() {
      if (this.class.parent == null) {
        raise(`class ${this.class.type.name} has no parent`);
      }
      return new Proxy(this, {
        get(target, property, receiver) {
          if (property == "class") {
            return Reflect.get(target, property).parent;
          } else if (property == "base") {
            return Reflect.getOwnPropertyDescriptor(Il2Cpp3.Object.prototype, property).get.bind(receiver)();
          }
          return Reflect.get(target, property);
        }
      });
    }
    /** Gets the class of this object. */
    get class() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.objectGetClass(this));
    }
    /** Returns a monitor for this object. */
    get monitor() {
      return new Il2Cpp3.Object.Monitor(this);
    }
    /** Gets the size of the current object. */
    get size() {
      return Il2Cpp3.exports.objectGetSize(this);
    }
    /** Gets the non-static field with the given name of the current class hierarchy. */
    field(name) {
      return this.tryField(name) ?? raise(`couldn't find non-static field ${name} in hierarchy of class ${this.class.type.name}`);
    }
    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy. */
    method(name, parameterCount = -1) {
      return this.tryMethod(name, parameterCount) ?? raise(`couldn't find non-static method ${name} in hierarchy of class ${this.class.type.name}`);
    }
    /** Creates a reference to this object. */
    ref(pin) {
      return new Il2Cpp3.GCHandle(Il2Cpp3.exports.gcHandleNew(this, +pin));
    }
    /** Gets the correct virtual method from the given virtual method. */
    virtualMethod(method) {
      return new Il2Cpp3.Method(Il2Cpp3.exports.objectGetVirtualMethod(this, method)).bind(this);
    }
    /** Gets the non-static field with the given name of the current class hierarchy, if it exists. */
    tryField(name) {
      const field = this.class.tryField(name);
      if (field?.isStatic) {
        for (const klass of this.class.hierarchy({ includeCurrent: false })) {
          for (const field2 of klass.fields) {
            if (field2.name == name && !field2.isStatic) {
              return field2.bind(this);
            }
          }
        }
        return void 0;
      }
      return field?.bind(this);
    }
    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy, if it exists. */
    tryMethod(name, parameterCount = -1) {
      const method = this.class.tryMethod(name, parameterCount);
      if (method?.isStatic) {
        for (const klass of this.class.hierarchy()) {
          for (const method2 of klass.methods) {
            if (method2.name == name && !method2.isStatic && (parameterCount < 0 || method2.parameterCount == parameterCount)) {
              return method2.bind(this);
            }
          }
        }
        return void 0;
      }
      return method?.bind(this);
    }
    /** */
    toString() {
      return this.isNull() ? "null" : this.method("ToString", 0).invoke().content ?? "null";
    }
    /** Unboxes the value type (either a primitive, a struct or an enum) out of this object. */
    unbox() {
      return this.class.isValueType ? new Il2Cpp3.ValueType(Il2Cpp3.exports.objectUnbox(this), this.class.type) : raise(`couldn't unbox instances of ${this.class.type.name} as they are not value types`);
    }
    /** Creates a weak reference to this object. */
    weakRef(trackResurrection) {
      return new Il2Cpp3.GCHandle(Il2Cpp3.exports.gcHandleNewWeakRef(this, +trackResurrection));
    }
  }
  __decorate([
    lazy
  ], Object2.prototype, "class", null);
  __decorate([
    lazy
  ], Object2.prototype, "size", null);
  __decorate([
    lazy
  ], Object2, "headerSize", null);
  Il2Cpp3.Object = Object2;
  (function (Object3) {
    class Monitor {
      handle;
      /** @internal */
      constructor(handle) {
        this.handle = handle;
      }
      /** Acquires an exclusive lock on the current object. */
      enter() {
        return Il2Cpp3.exports.monitorEnter(this.handle);
      }
      /** Release an exclusive lock on the current object. */
      exit() {
        return Il2Cpp3.exports.monitorExit(this.handle);
      }
      /** Notifies a thread in the waiting queue of a change in the locked object's state. */
      pulse() {
        return Il2Cpp3.exports.monitorPulse(this.handle);
      }
      /** Notifies all waiting threads of a change in the object's state. */
      pulseAll() {
        return Il2Cpp3.exports.monitorPulseAll(this.handle);
      }
      /** Attempts to acquire an exclusive lock on the current object. */
      tryEnter(timeout) {
        return !!Il2Cpp3.exports.monitorTryEnter(this.handle, timeout);
      }
      /** Releases the lock on an object and attempts to block the current thread until it reacquires the lock. */
      tryWait(timeout) {
        return !!Il2Cpp3.exports.monitorTryWait(this.handle, timeout);
      }
      /** Releases the lock on an object and blocks the current thread until it reacquires the lock. */
      wait() {
        return Il2Cpp3.exports.monitorWait(this.handle);
      }
    }
    Object3.Monitor = Monitor;
  })(Object2 = Il2Cpp3.Object || (Il2Cpp3.Object = {}));
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Parameter {
    /** Name of this parameter. */
    name;
    /** Position of this parameter. */
    position;
    /** Type of this parameter. */
    type;
    constructor(name, position, type) {
      this.name = name;
      this.position = position;
      this.type = type;
    }
    /** */
    toString() {
      return `${this.type.name} ${this.name}`;
    }
  }
  Il2Cpp3.Parameter = Parameter;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Pointer extends NativeStruct {
    type;
    constructor(handle, type) {
      super(handle);
      this.type = type;
    }
    /** Gets the element at the given index. */
    get(index) {
      return Il2Cpp3.read(this.handle.add(index * this.type.class.arrayElementSize), this.type);
    }
    /** Reads the given amount of elements starting at the given offset. */
    read(length, offset = 0) {
      const values = new globalThis.Array(length);
      for (let i = 0; i < length; i++) {
        values[i] = this.get(i + offset);
      }
      return values;
    }
    /** Sets the given element at the given index */
    set(index, value) {
      Il2Cpp3.write(this.handle.add(index * this.type.class.arrayElementSize), value, this.type);
    }
    /** */
    toString() {
      return this.handle.toString();
    }
    /** Writes the given elements starting at the given index. */
    write(values, offset = 0) {
      for (let i = 0; i < values.length; i++) {
        this.set(i + offset, values[i]);
      }
    }
  }
  Il2Cpp3.Pointer = Pointer;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Reference extends NativeStruct {
    type;
    constructor(handle, type) {
      super(handle);
      this.type = type;
    }
    /** Gets the element referenced by the current reference. */
    get value() {
      return Il2Cpp3.read(this.handle, this.type);
    }
    /** Sets the element referenced by the current reference. */
    set value(value) {
      Il2Cpp3.write(this.handle, value, this.type);
    }
    /** */
    toString() {
      return this.isNull() ? "null" : `->${this.value}`;
    }
  }
  Il2Cpp3.Reference = Reference;
  function reference(value, type) {
    const handle = Memory.alloc(Process.pointerSize);
    switch (typeof value) {
      case "boolean":
        return new Il2Cpp3.Reference(handle.writeS8(+value), Il2Cpp3.corlib.class("System.Boolean").type);
      case "number":
        switch (type?.enumValue) {
          case Il2Cpp3.Type.Enum.UBYTE:
            return new Il2Cpp3.Reference(handle.writeU8(value), type);
          case Il2Cpp3.Type.Enum.BYTE:
            return new Il2Cpp3.Reference(handle.writeS8(value), type);
          case Il2Cpp3.Type.Enum.CHAR:
          case Il2Cpp3.Type.Enum.USHORT:
            return new Il2Cpp3.Reference(handle.writeU16(value), type);
          case Il2Cpp3.Type.Enum.SHORT:
            return new Il2Cpp3.Reference(handle.writeS16(value), type);
          case Il2Cpp3.Type.Enum.UINT:
            return new Il2Cpp3.Reference(handle.writeU32(value), type);
          case Il2Cpp3.Type.Enum.INT:
            return new Il2Cpp3.Reference(handle.writeS32(value), type);
          case Il2Cpp3.Type.Enum.ULONG:
            return new Il2Cpp3.Reference(handle.writeU64(value), type);
          case Il2Cpp3.Type.Enum.LONG:
            return new Il2Cpp3.Reference(handle.writeS64(value), type);
          case Il2Cpp3.Type.Enum.FLOAT:
            return new Il2Cpp3.Reference(handle.writeFloat(value), type);
          case Il2Cpp3.Type.Enum.DOUBLE:
            return new Il2Cpp3.Reference(handle.writeDouble(value), type);
        }
      case "object":
        if (value instanceof Il2Cpp3.ValueType || value instanceof Il2Cpp3.Pointer) {
          return new Il2Cpp3.Reference(value.handle, value.type);
        } else if (value instanceof Il2Cpp3.Object) {
          return new Il2Cpp3.Reference(handle.writePointer(value), value.class.type);
        } else if (value instanceof Il2Cpp3.String || value instanceof Il2Cpp3.Array) {
          return new Il2Cpp3.Reference(handle.writePointer(value), value.object.class.type);
        } else if (value instanceof NativePointer) {
          switch (type?.enumValue) {
            case Il2Cpp3.Type.Enum.NUINT:
            case Il2Cpp3.Type.Enum.NINT:
              return new Il2Cpp3.Reference(handle.writePointer(value), type);
          }
        } else if (value instanceof Int64) {
          return new Il2Cpp3.Reference(handle.writeS64(value), Il2Cpp3.corlib.class("System.Int64").type);
        } else if (value instanceof UInt64) {
          return new Il2Cpp3.Reference(handle.writeU64(value), Il2Cpp3.corlib.class("System.UInt64").type);
        }
      default:
        raise(`couldn't create a reference to ${value} using an unhandled type ${type?.name}`);
    }
  }
  Il2Cpp3.reference = reference;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class String extends NativeStruct {
    /** Gets the content of this string. */
    get content() {
      return Il2Cpp3.exports.stringGetChars(this).readUtf16String(this.length);
    }
    /** @unsafe Sets the content of this string - it may write out of bounds! */
    set content(value) {
      const offset = Il2Cpp3.string("vfsfitvnm").handle.offsetOf((_) => _.readInt() == 9) ?? raise("couldn't find the length offset in the native string struct");
      globalThis.Object.defineProperty(Il2Cpp3.String.prototype, "content", {
        set(value2) {
          Il2Cpp3.exports.stringGetChars(this).writeUtf16String(value2 ?? "");
          this.handle.add(offset).writeS32(value2?.length ?? 0);
        }
      });
      this.content = value;
    }
    /** Gets the length of this string. */
    get length() {
      return Il2Cpp3.exports.stringGetLength(this);
    }
    /** Gets the encompassing object of the current string. */
    get object() {
      return new Il2Cpp3.Object(this);
    }
    /** */
    toString() {
      return this.isNull() ? "null" : `"${this.content}"`;
    }
  }
  Il2Cpp3.String = String;
  function string(content) {
    return new Il2Cpp3.String(Il2Cpp3.exports.stringNew(Memory.allocUtf8String(content ?? "")));
  }
  Il2Cpp3.string = string;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class Thread extends NativeStruct {
    /** Gets the native id of the current thread. */
    get id() {
      let get = function () {
        return this.internal.field("thread_id").value.toNumber();
      };
      if (Process.platform != "windows") {
        const currentThreadId = Process.getCurrentThreadId();
        const currentPosixThread = ptr(get.apply(Il2Cpp3.currentThread));
        const offset = currentPosixThread.offsetOf((_) => _.readS32() == currentThreadId, 1024) ?? raise(`couldn't find the offset for determining the kernel id of a posix thread`);
        const _get = get;
        get = function () {
          return ptr(_get.apply(this)).add(offset).readS32();
        };
      }
      getter(Il2Cpp3.Thread.prototype, "id", get, lazy);
      return this.id;
    }
    /** Gets the encompassing internal object (System.Threding.InternalThreead) of the current thread. */
    get internal() {
      return this.object.tryField("internal_thread")?.value ?? this.object;
    }
    /** Determines whether the current thread is the garbage collector finalizer one. */
    get isFinalizer() {
      return !Il2Cpp3.exports.threadIsVm(this);
    }
    /** Gets the managed id of the current thread. */
    get managedId() {
      return this.object.method("get_ManagedThreadId").invoke();
    }
    /** Gets the encompassing object of the current thread. */
    get object() {
      return new Il2Cpp3.Object(this);
    }
    /** @internal */
    get staticData() {
      return this.internal.field("static_data").value;
    }
    /** @internal */
    get synchronizationContext() {
      const get_ExecutionContext = this.object.tryMethod("GetMutableExecutionContext") ?? this.object.method("get_ExecutionContext");
      const executionContext = get_ExecutionContext.invoke();
      const synchronizationContext = executionContext.tryField("_syncContext")?.value ?? executionContext.tryMethod("get_SynchronizationContext")?.invoke() ?? this.tryLocalValue(Il2Cpp3.corlib.class("System.Threading.SynchronizationContext"));
      return synchronizationContext?.asNullable() ?? null;
    }
    /** Detaches the thread from the application domain. */
    detach() {
      return Il2Cpp3.exports.threadDetach(this);
    }
    /** Schedules a callback on the current thread. */
    schedule(block) {
      const Post = this.synchronizationContext?.tryMethod("Post");
      if (Post == null) {
        return Process.runOnThread(this.id, block);
      }
      return new Promise((resolve) => {
        const delegate = Il2Cpp3.delegate(Il2Cpp3.corlib.class("System.Threading.SendOrPostCallback"), () => {
          const result = block();
          setImmediate(() => resolve(result));
        });
        Script.bindWeak(globalThis, () => {
          delegate.field("method_ptr").value = delegate.field("invoke_impl").value = Il2Cpp3.exports.domainGet;
        });
        Post.invoke(delegate, NULL);
      });
    }
    /** @internal */
    tryLocalValue(klass) {
      for (let i = 0; i < 16; i++) {
        const base = this.staticData.add(i * Process.pointerSize).readPointer();
        if (!base.isNull()) {
          const object = new Il2Cpp3.Object(base.readPointer()).asNullable();
          if (object?.class?.isSubclassOf(klass, false)) {
            return object;
          }
        }
      }
    }
  }
  __decorate([
    lazy
  ], Thread.prototype, "internal", null);
  __decorate([
    lazy
  ], Thread.prototype, "isFinalizer", null);
  __decorate([
    lazy
  ], Thread.prototype, "managedId", null);
  __decorate([
    lazy
  ], Thread.prototype, "object", null);
  __decorate([
    lazy
  ], Thread.prototype, "staticData", null);
  __decorate([
    lazy
  ], Thread.prototype, "synchronizationContext", null);
  Il2Cpp3.Thread = Thread;
  getter(Il2Cpp3, "attachedThreads", () => {
    if (Il2Cpp3.exports.threadGetAttachedThreads.isNull()) {
      const currentThreadHandle = Il2Cpp3.currentThread?.handle ?? raise("Current thread is not attached to IL2CPP");
      const pattern = currentThreadHandle.toMatchPattern();
      const threads = [];
      for (const range of Process.enumerateRanges("rw-")) {
        if (range.file == void 0) {
          const matches = Memory.scanSync(range.base, range.size, pattern);
          if (matches.length == 1) {
            while (true) {
              const handle = matches[0].address.sub(matches[0].size * threads.length).readPointer();
              if (handle.isNull() || !handle.readPointer().equals(currentThreadHandle.readPointer())) {
                break;
              }
              threads.unshift(new Il2Cpp3.Thread(handle));
            }
            break;
          }
        }
      }
      return threads;
    }
    return readNativeList(Il2Cpp3.exports.threadGetAttachedThreads).map((_) => new Il2Cpp3.Thread(_));
  });
  getter(Il2Cpp3, "currentThread", () => {
    return new Il2Cpp3.Thread(Il2Cpp3.exports.threadGetCurrent()).asNullable();
  });
  getter(Il2Cpp3, "mainThread", () => {
    return Il2Cpp3.attachedThreads[0];
  });
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  let Type = class Type extends NativeStruct {
    /** */
    static get Enum() {
      const _ = (_2, block = (_3) => _3) => block(Il2Cpp3.corlib.class(_2)).type.enumValue;
      const initial = {
        VOID: _("System.Void"),
        BOOLEAN: _("System.Boolean"),
        CHAR: _("System.Char"),
        BYTE: _("System.SByte"),
        UBYTE: _("System.Byte"),
        SHORT: _("System.Int16"),
        USHORT: _("System.UInt16"),
        INT: _("System.Int32"),
        UINT: _("System.UInt32"),
        LONG: _("System.Int64"),
        ULONG: _("System.UInt64"),
        NINT: _("System.IntPtr"),
        NUINT: _("System.UIntPtr"),
        FLOAT: _("System.Single"),
        DOUBLE: _("System.Double"),
        POINTER: _("System.IntPtr", (_2) => _2.field("m_value")),
        VALUE_TYPE: _("System.Decimal"),
        OBJECT: _("System.Object"),
        STRING: _("System.String"),
        CLASS: _("System.Array"),
        ARRAY: _("System.Void", (_2) => _2.arrayClass),
        NARRAY: _("System.Void", (_2) => new Il2Cpp3.Class(Il2Cpp3.exports.classGetArrayClass(_2, 2))),
        GENERIC_INSTANCE: _("System.Int32", (_2) => _2.interfaces.find((_3) => _3.name.endsWith("`1")))
      };
      Reflect.defineProperty(this, "Enum", { value: initial });
      return addFlippedEntries({
        ...initial,
        VAR: _("System.Action`1", (_2) => _2.generics[0]),
        MVAR: _("System.Array", (_2) => _2.method("AsReadOnly", 1).generics[0])
      });
    }
    /** Gets the class of this type. */
    get class() {
      return new Il2Cpp3.Class(Il2Cpp3.exports.typeGetClass(this));
    }
    /** */
    get fridaAlias() {
      function getValueTypeFields(type) {
        const instanceFields = type.class.fields.filter((_) => !_.isStatic);
        return instanceFields.length == 0 ? ["char"] : instanceFields.map((_) => _.type.fridaAlias);
      }
      if (this.isByReference) {
        return "pointer";
      }
      switch (this.enumValue) {
        case Il2Cpp3.Type.Enum.VOID:
          return "void";
        case Il2Cpp3.Type.Enum.BOOLEAN:
          return "bool";
        case Il2Cpp3.Type.Enum.CHAR:
          return "uchar";
        case Il2Cpp3.Type.Enum.BYTE:
          return "int8";
        case Il2Cpp3.Type.Enum.UBYTE:
          return "uint8";
        case Il2Cpp3.Type.Enum.SHORT:
          return "int16";
        case Il2Cpp3.Type.Enum.USHORT:
          return "uint16";
        case Il2Cpp3.Type.Enum.INT:
          return "int32";
        case Il2Cpp3.Type.Enum.UINT:
          return "uint32";
        case Il2Cpp3.Type.Enum.LONG:
          return "int64";
        case Il2Cpp3.Type.Enum.ULONG:
          return "uint64";
        case Il2Cpp3.Type.Enum.FLOAT:
          return "float";
        case Il2Cpp3.Type.Enum.DOUBLE:
          return "double";
        case Il2Cpp3.Type.Enum.NINT:
        case Il2Cpp3.Type.Enum.NUINT:
        case Il2Cpp3.Type.Enum.POINTER:
        case Il2Cpp3.Type.Enum.STRING:
        case Il2Cpp3.Type.Enum.ARRAY:
        case Il2Cpp3.Type.Enum.NARRAY:
          return "pointer";
        case Il2Cpp3.Type.Enum.VALUE_TYPE:
          return this.class.isEnum ? this.class.baseType.fridaAlias : getValueTypeFields(this);
        case Il2Cpp3.Type.Enum.CLASS:
        case Il2Cpp3.Type.Enum.OBJECT:
        case Il2Cpp3.Type.Enum.GENERIC_INSTANCE:
          return this.class.isStruct ? getValueTypeFields(this) : this.class.isEnum ? this.class.baseType.fridaAlias : "pointer";
        default:
          return "pointer";
      }
    }
    /** Determines whether this type is passed by reference. */
    get isByReference() {
      return this.name.endsWith("&");
    }
    /** Determines whether this type is primitive. */
    get isPrimitive() {
      switch (this.enumValue) {
        case Il2Cpp3.Type.Enum.BOOLEAN:
        case Il2Cpp3.Type.Enum.CHAR:
        case Il2Cpp3.Type.Enum.BYTE:
        case Il2Cpp3.Type.Enum.UBYTE:
        case Il2Cpp3.Type.Enum.SHORT:
        case Il2Cpp3.Type.Enum.USHORT:
        case Il2Cpp3.Type.Enum.INT:
        case Il2Cpp3.Type.Enum.UINT:
        case Il2Cpp3.Type.Enum.LONG:
        case Il2Cpp3.Type.Enum.ULONG:
        case Il2Cpp3.Type.Enum.FLOAT:
        case Il2Cpp3.Type.Enum.DOUBLE:
        case Il2Cpp3.Type.Enum.NINT:
        case Il2Cpp3.Type.Enum.NUINT:
          return true;
        default:
          return false;
      }
    }
    /** Gets the name of this type. */
    get name() {
      const handle = Il2Cpp3.exports.typeGetName(this);
      try {
        return handle.readUtf8String();
      } finally {
        Il2Cpp3.free(handle);
      }
    }
    /** Gets the encompassing object of the current type. */
    get object() {
      return new Il2Cpp3.Object(Il2Cpp3.exports.typeGetObject(this));
    }
    /** Gets the {@link Il2Cpp.Type.Enum} value of the current type. */
    get enumValue() {
      return Il2Cpp3.exports.typeGetTypeEnum(this);
    }
    is(other) {
      if (Il2Cpp3.exports.typeEquals.isNull()) {
        return this.object.method("Equals").invoke(other.object);
      }
      return !!Il2Cpp3.exports.typeEquals(this, other);
    }
    /** */
    toString() {
      return this.name;
    }
  };
  __decorate([
    lazy
  ], Type.prototype, "class", null);
  __decorate([
    lazy
  ], Type.prototype, "fridaAlias", null);
  __decorate([
    lazy
  ], Type.prototype, "isByReference", null);
  __decorate([
    lazy
  ], Type.prototype, "isPrimitive", null);
  __decorate([
    lazy
  ], Type.prototype, "name", null);
  __decorate([
    lazy
  ], Type.prototype, "object", null);
  __decorate([
    lazy
  ], Type.prototype, "enumValue", null);
  __decorate([
    lazy
  ], Type, "Enum", null);
  Type = __decorate([
    recycle
  ], Type);
  Il2Cpp3.Type = Type;
})(Il2Cpp2 || (Il2Cpp2 = {}));
var Il2Cpp2;
(function (Il2Cpp3) {
  class ValueType extends NativeStruct {
    type;
    constructor(handle, type) {
      super(handle);
      this.type = type;
    }
    /** Boxes the current value type in a object. */
    box() {
      return new Il2Cpp3.Object(Il2Cpp3.exports.valueTypeBox(this.type.class, this));
    }
    /** Gets the non-static field with the given name of the current class hierarchy. */
    field(name) {
      return this.tryField(name) ?? raise(`couldn't find non-static field ${name} in hierarchy of class ${this.type.name}`);
    }
    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy. */
    method(name, parameterCount = -1) {
      return this.tryMethod(name, parameterCount) ?? raise(`couldn't find non-static method ${name} in hierarchy of class ${this.type.name}`);
    }
    /** Gets the non-static field with the given name of the current class hierarchy, if it exists. */
    tryField(name) {
      const field = this.type.class.tryField(name);
      if (field?.isStatic) {
        for (const klass of this.type.class.hierarchy()) {
          for (const field2 of klass.fields) {
            if (field2.name == name && !field2.isStatic) {
              return field2.bind(this);
            }
          }
        }
        return void 0;
      }
      return field?.bind(this);
    }
    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy, if it exists. */
    tryMethod(name, parameterCount = -1) {
      const method = this.type.class.tryMethod(name, parameterCount);
      if (method?.isStatic) {
        for (const klass of this.type.class.hierarchy()) {
          for (const method2 of klass.methods) {
            if (method2.name == name && !method2.isStatic && (parameterCount < 0 || method2.parameterCount == parameterCount)) {
              return method2.bind(this);
            }
          }
        }
        return void 0;
      }
      return method?.bind(this);
    }
    /** */
    toString() {
      const ToString = this.method("ToString", 0);
      return this.isNull() ? "null" : (
        // If ToString is defined within a value type class, we can
        // avoid a boxing operation.
        ToString.class.isValueType ? ToString.invoke().content ?? "null" : this.box().toString() ?? "null"
      );
    }
  }
  Il2Cpp3.ValueType = ValueType;
})(Il2Cpp2 || (Il2Cpp2 = {}));
globalThis.Il2Cpp = Il2Cpp2;

// src/indeks.js

/**
 * ====================================================================
 * FRIDA SCRIPT: DYNAMIC GAME ACTIVITY MODIFIER (IL2CPP)
 * ====================================================================
 * Skrip ini telah dioptimalkan secara signifikan:
 * 1. Menggunakan Il2Cpp Bridge built-in perform pipeline untuk inisialisasi yang aman.
 * 2. Menggantikan traversal manual O(N) linear scan class (yang memakan waktu
 *    detik/menit dan berisiko membekukan game) dengan lookup native O(1) via il2cpp_class_from_name.
 * 3. Menghapus log spamming di dalam loop filter memori untuk performa optimal.
 */

// ====================================================================
// SECTION 1: GLOBAL CONFIGURATION (KONFIGURASI GLOBAL)
// ====================================================================
// Nama library target IL2CPP game
const TARGET_LIB = "liblogic.so";

// Aktifkan modifikasi aktivitas di memori (true = aktif, false = mati/normal)
const ENABLE_ACTIVITY_MOD = true;

// Daftar iActivityType yang ingin DIUBAH secara dinamis di memori RAM
// Format: { tipe_asal: tipe_tujuan }
const REDIRECT_ACTIVITY_TYPES = {
  626: 0, // Mengubah tipe 626 (aktivitas rilis fitur/skin) menjadi tipe 0 di memori
  209: 0
};

// ====================================================================
// SECTION 2: MEMORY UTILITIES & CACHE STATE
// ====================================================================
// Penyimpanan tipe asli sebelum dimodifikasi untuk dipulihkan saat penyimpanan (save)
const originalTypes = {};

/**
 * Memproses list aktivitas di memori RAM:
 * - Mengubah tipe aktivitas yang terdaftar di REDIRECT_ACTIVITY_TYPES.
 */
function filterActivityList(listPtr) {
  if (!ENABLE_ACTIVITY_MOD) return;
  console.log("[*] filterActivityList: listPtr = " + listPtr);
  if (listPtr.isNull()) {
    console.log("    [!] listPtr is NULL");
    return;
  }

  const itemsArray = listPtr.add(0x10).readPointer();
  if (itemsArray.isNull()) {
    console.log("    [!] itemsArray is NULL");
    return;
  }

  let size = listPtr.add(0x18).readS32();
  console.log("    size = " + size);
  let modifiedCount = 0;
  let seenTypes = new Set();

  for (let i = 0; i < size; i++) {
    const activityPtr = itemsArray.add(0x20 + i * 8).readPointer();
    if (activityPtr.isNull()) continue;

    const iActivityId = activityPtr.add(0x10).readU32();
    let iActivityType = activityPtr.add(0x14).readU32();

    seenTypes.add(iActivityType);

    // Ubah tipe di memori RAM jika terdaftar di REDIRECT_ACTIVITY_TYPES
    if (REDIRECT_ACTIVITY_TYPES.hasOwnProperty(iActivityType)) {
      const targetType = REDIRECT_ACTIVITY_TYPES[iActivityType];
      console.log("    [*] filterActivityList: Mengubah iActivityType " + iActivityType + " -> " + targetType + " (ActivityId: " + iActivityId + ") di memori.");

      originalTypes[iActivityId] = iActivityType; // Simpan tipe asli untuk direstore saat penyimpanan ke disk
      activityPtr.add(0x14).writeU32(targetType);
      modifiedCount++;
    }
  }

  console.log("    Tipe aktivitas yang terlihat di list ini: " + Array.from(seenTypes).join(", "));
  if (modifiedCount > 0) {
    console.log("[+] filterActivityList: Berhasil memproses list (Diubah: " + modifiedCount + ")");
  }
}

/**
 * Mengembalikan tipe aktivitas ke nilai aslinya sebelum disimpan ke disk (cache)
 * agar file penyimpanan fisik tidak rusak/terkontaminasi dengan angka modifikasi (0).
 */
function restoreOriginalTypes(listPtr) {
  if (listPtr.isNull()) return;
  const itemsArray = listPtr.add(0x10).readPointer();
  if (itemsArray.isNull()) return;

  let size = listPtr.add(0x18).readS32();
  for (let i = 0; i < size; i++) {
    const activityPtr = itemsArray.add(0x20 + i * 8).readPointer();
    if (activityPtr.isNull()) continue;

    const iActivityId = activityPtr.add(0x10).readU32();
    if (originalTypes.hasOwnProperty(iActivityId)) {
      const originalType = originalTypes[iActivityId];
      console.log(`    [!] restoreOriginalTypes: Mengembalikan iActivityType -> ${originalType} (ActivityId: ${iActivityId}) sebelum disimpan.`);
      activityPtr.add(0x14).writeU32(originalType);
    }
  }
}

/**
 * Menerapkan kembali tipe modifikasi setelah proses penyimpanan selesai.
 */
function reapplyRedirectTypes(listPtr) {
  if (listPtr.isNull()) return;
  const itemsArray = listPtr.add(0x10).readPointer();
  if (itemsArray.isNull()) return;

  let size = listPtr.add(0x18).readS32();
  for (let i = 0; i < size; i++) {
    const activityPtr = itemsArray.add(0x20 + i * 8).readPointer();
    if (activityPtr.isNull()) continue;

    const iActivityId = activityPtr.add(0x10).readU32();
    if (originalTypes.hasOwnProperty(iActivityId)) {
      const targetType = REDIRECT_ACTIVITY_TYPES[originalTypes[iActivityId]];
      console.log(`    [!] reapplyRedirectTypes: Mengubah kembali iActivityType -> ${targetType} (ActivityId: ${iActivityId}) setelah disimpan.`);
      activityPtr.add(0x14).writeU32(targetType);
    }
  }
}

// ====================================================================
// SECTION 3: FRIDA & IL2CPP INITIALIZATION PIPELINE
// ====================================================================
function main() {
  console.log("[*] Waiting for EGL Rendering to be ready...");

  // Deteksi EGL Ready (eglSwapBuffers)
  let eglSwapBuffers = null;
  const libEGL = Process.findModuleByName("libEGL.so") || Process.findModuleByName("libGLESv2.so");

  if (libEGL) {
    try {
      eglSwapBuffers = libEGL.getExportByName("eglSwapBuffers");
    } catch (e) {
      eglSwapBuffers = null;
    }
  }

  if (!eglSwapBuffers) {
    try {
      eglSwapBuffers = Module.findExportByName(null, "eglSwapBuffers");
    } catch (e) {
      eglSwapBuffers = null;
    }
  }

  if (eglSwapBuffers) {
    let frameCount = 0;
    const eglHook = Interceptor.attach(eglSwapBuffers, {
      onEnter: function (args) {
        frameCount++;
        if (frameCount >= 2) { // Tunggu 2 frame rendering stabil
          eglHook.detach();
          console.log("[+] EGL Rendering is READY.");
          waitForLogicLib();
        }
      }
    });
  } else {
    setTimeout(main, 50);
  }
}

function waitForLogicLib() {
  console.log(`[*] Monitoring for ${TARGET_LIB}...`);

  const mod = Process.findModuleByName(TARGET_LIB);
  if (mod) {
    setupIl2CppHook(mod);
  } else {
    let dlopen = null;
    try {
      dlopen = Module.findExportByName(null, "android_dlopen_ext") ||
        Module.findExportByName(null, "dlopen");
    } catch (e) {
      const libc = Process.findModuleByName("libc.so");
      if (libc) {
        try {
          dlopen = libc.getExportByName("android_dlopen_ext") || libc.getExportByName("dlopen");
        } catch (e2) {
          dlopen = null;
        }
      }
    }

    if (dlopen) {
      const monitor = Interceptor.attach(dlopen, {
        onEnter: function (args) { this.path = args[0].readUtf8String(); },
        onLeave: function (retval) {
          if (this.path && this.path.indexOf(TARGET_LIB) !== -1) {
            monitor.detach();
            const targetMod = Process.getModuleByName(TARGET_LIB);
            setupIl2CppHook(targetMod);
          }
        }
      });
    } else {
      console.log("[!] Error: Could not find dlopen to monitor.");
      setTimeout(waitForLogicLib);
    }
  }
}

function setupIl2CppHook(targetMod) {
  const il2cpp_init = targetMod.findExportByName ? targetMod.findExportByName("il2cpp_init") : targetMod.getExportByName("il2cpp_init");
  if (il2cpp_init) {
    const il2cpp_domain_get = targetMod.findExportByName ? targetMod.findExportByName("il2cpp_domain_get") : targetMod.getExportByName("il2cpp_domain_get");
    let isInitialized = false;
    if (il2cpp_domain_get) {
      const get_domain = new NativeFunction(il2cpp_domain_get, 'pointer', []);
      if (!get_domain().isNull()) {
        isInitialized = true;
      }
    }

    if (isInitialized) {
      console.log(`[+] ${targetMod.name} is ALREADY initialized. Executing hooks now...`);
      setTimeout(() => {
        Il2Cpp.$config.moduleName = TARGET_LIB;
        Il2Cpp.perform(() => executeSimpleHooks(targetMod));
      });
    } else {
      Interceptor.attach(il2cpp_init, {
        onLeave: function (retval) {
          console.log(`[+] ${targetMod.name} (il2cpp_init) finished. Executing hooks...`);
          Il2Cpp.$config.moduleName = TARGET_LIB;
          Il2Cpp.perform(() => executeSimpleHooks(targetMod));
        }
      });
    }
  } else {
    console.log(`[!] Error: il2cpp_init not found in ${targetMod.name}`);
  }
}

// ====================================================================
// SECTION 4: IL2CPP REFLECTION HOOK ENGINE
// ====================================================================
function executeSimpleHooks(targetMod) {
  console.log("[!] Starting IL2CPP Hooks Execution...");


// Domain
const assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

// Class
const GameInit = assembly.class("GameInit");

// Method
// ===GameInit
const IsSandBoxIp = GameInit.method("IsSandBoxIp");


// Hook Contoh boolean
IsSandBoxIp.implementation = function () {
console.log("Mengubah atau mereturn value IsSandBoxIp mode GM ke true :1");
return true;
}

}

// Jalankan Script Utama
setImmediate(main);


)raw";
                if (write_file(ext_js_path, sample_js)) {
                    write_admin_log("MLBSConfig", "Initialized sample local.js at: %s", ext_js_path.c_str());
                }
            }
        }

        // 2. Load config with dual-path awareness (External & Internal)
        dev_config = AdminDevConfig::load(external_dir, working_dir);
        
        // 3. Auto-sync Config from External to Internal if readable (makes it root-independent)
        if (!external_dir.empty() && !working_dir.empty()) {
            std::string ext_cfg = read_file(external_dir + "/config.json");
            if (!ext_cfg.empty()) {
                write_file(working_dir + "/config.json", ext_cfg);
            }
        }

        // 4. Update logging based on config
        g_enable_logging = dev_config.log;

        if (!dev_config.enable) {
            write_admin_log("MLBSConfig", "Development mode: Frida Patching DISABLED via config.json");
            if (attached) g_vm->DetachCurrentThread();
            return NULL;
        }
    }
    
    // Clean up log file if user is non-admin
    if (!g_enable_logging && !g_log_dir.empty()) {
        std::string log_path = g_log_dir + "/log.txt";
        remove(log_path.c_str());
    }
    
    LOGI("Working directory: %s", working_dir.c_str());
    LOGI("External directory: %s", external_dir.c_str());
    
    PatchConfig config = PatchConfig::load(working_dir);
    std::string server_url = config.server_url;
    int timeout_ms = config.timeout_ms;
    
    // Store configuration to globals
    g_server_url = server_url;
    g_timeout_ms = timeout_ms;
    
    std::string js_code_str = "";
    
    // Check for local sandbox script if enabled
    if (dev_config.sandbox) {
        std::string local_js_ext = "";
        std::string local_js_int = "";
        
        // 1. Try to read from External (User Editable via ADB/File Manager)
        if (!external_dir.empty()) {
            std::string ext_path = external_dir + "/local.js";
            local_js_ext = read_file(ext_path);
            
            // If we have content from external, try to sync it to internal
            // This allows the app to have a "safe" copy if external permissions are wonky
            if (!local_js_ext.empty()) {
                std::string int_path = working_dir + "/local.js";
                if (write_file(int_path, local_js_ext)) {
                    write_admin_log("MLBSConfig", "Sandbox mode: Synced local.js from External to Internal.");
                }
            }
        }

        // 2. Load the script (Prefer external if just read, otherwise use internal fallback)
        if (!local_js_ext.empty()) {
            js_code_str = local_js_ext;
            write_admin_log("MLBSConfig", "Sandbox mode: Loading local script from EXTERNAL path.");
        } else {
            std::string int_path = working_dir + "/local.js";
            js_code_str = read_file(int_path);
            if (!js_code_str.empty()) {
                write_admin_log("MLBSConfig", "Sandbox mode: Loading local script from INTERNAL fallback.");
            }
        }

        if (js_code_str.empty()) {
            write_admin_log("MLBSConfig", "Sandbox mode enabled but local.js not found or readable.");
            write_admin_log("MLBSConfig", "Tip: Push your script to: %s/local.js", external_dir.c_str());
        }
    }
    
    if (js_code_str.empty()) {
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
    
    // Check for realtime updates: only if NOT in sandbox mode
    if (!dev_config.sandbox) {
        // first check in 2 seconds, then every 10 seconds.
        g_timeout_add(2000, check_ota_update_timer_initial, NULL);
    } else {
        write_admin_log("MLBSConfig", "Sandbox mode active: Realtime OTA updates DISABLED.");
    }
    
    GMainLoop *loop = g_main_loop_new(NULL, FALSE);
    g_main_loop_run(loop);
    
    return NULL;
}

static gboolean reload_script_idle_callback(gpointer data) {
    std::string *js_code = static_cast<std::string*>(data);
    LOGI("[Idle Callback] Executing script hot reload on GMainLoop thread...");
    load_frida_script(*js_code);
    delete js_code;
    return FALSE;
}

static void* reload_worker_thread(void* arg) {
    LOGI("[Reload Thread] Started. Sleeping 150ms to allow V8 stack to unwind...");
    usleep(150000); // 150ms
    
    JNIEnv *env = NULL;
    bool attached = false;
    if (g_vm) {
        jint res = g_vm->GetEnv((void**)&env, JNI_VERSION_1_6);
        if (res == JNI_EDETACHED) {
            if (g_vm->AttachCurrentThread(&env, NULL) == 0) {
                attached = true;
            } else {
                LOGE("[Reload Thread] Failed to attach thread to JVM");
            }
        }
    }

    LOGI("[Reload Thread] Refreshing configuration...");
    g_is_admin = is_user_admin_local(g_working_dir);
    PatchConfig config = PatchConfig::load(g_working_dir);
    g_server_url = config.server_url;
    g_timeout_ms = config.timeout_ms;

    if (!g_enable_logging) {
        std::string log_dir = !g_external_dir.empty() ? g_external_dir : g_working_dir;
        if (!log_dir.empty()) {
            std::string log_path = log_dir + "/log.txt";
            remove(log_path.c_str());
        }
    }

    // 1. Reload the Frida script (Only if NOT in sandbox mode)
    AdminDevConfig dev_config = AdminDevConfig::load(g_external_dir, g_working_dir);
    if (!dev_config.sandbox) {
        if (env && !g_server_url.empty()) {
            std::string sig_url = g_server_url + ".sig";
            LOGI("[Reload Thread] Fetching remote script for immediate update/reload: %s", g_server_url.c_str());
            std::string ota_js = download_url(env, g_server_url, g_timeout_ms);
            std::string ota_sig = download_url(env, sig_url, g_timeout_ms);
            
            if (!ota_js.empty() && ota_js.compare(0, MAGIC_ENC_HEADER.length(), MAGIC_ENC_HEADER) == 0) {
                ota_js = decrypt_cache_script(ota_js);
            }

            if (!ota_js.empty() && !ota_sig.empty()) {
                if (verify_rsa_signature(env, ota_js, ota_sig, rsa_public_key, sizeof(rsa_public_key))) {
                    std::string cache_path = g_working_dir + "/hook_cache.js";
                    std::string sig_path = g_working_dir + "/hook_cache.js.sig";
                    
                    bool is_admin = is_user_admin_local(g_working_dir);
                    if (is_admin) {
                        write_file(cache_path, ota_js);
                        LOGI("[Reload Thread] Saved plaintext cache for admin.");
                    } else {
                        std::string encrypted_js = encrypt_cache_script(ota_js);
                        write_file(cache_path, encrypted_js);
                        LOGI("[Reload Thread] Saved encrypted cache for non-admin.");
                    }
                    write_file(sig_path, ota_sig);
                    
                    LOGI("[Reload Thread] Dispatching script reload to main context...");
                    g_idle_add(reload_script_idle_callback, new std::string(ota_js));
                    g_current_script_hash = ota_js;
                } else {
                    LOGE("[Reload Thread] Signature verification FAILED for updated script!");
                }
            } else {
                LOGE("[Reload Thread] Failed to fetch script update from server.");
                // Fallback: Reload from local cache or built-in script if offline
                std::string js_code_str = "";
                std::string cached_js = read_file(g_working_dir + "/hook_cache.js");
                std::string cached_sig = read_file(g_working_dir + "/hook_cache.js.sig");
                if (!cached_js.empty() && !cached_sig.empty()) {
                    bool is_admin = is_user_admin_local(g_working_dir);
                    std::string processed_js = "";
                    bool loaded_ok = false;
                    
                    if (cached_js.compare(0, MAGIC_ENC_HEADER.length(), MAGIC_ENC_HEADER) == 0) {
                        processed_js = decrypt_cache_script(cached_js);
                        loaded_ok = !processed_js.empty();
                    } else {
                        if (is_admin) {
                            processed_js = cached_js;
                            loaded_ok = true;
                        } else {
                            LOGE("[Reload Thread] Plaintext cached script is not allowed for non-admin! Rejecting cache.");
                            std::string cache_path = g_working_dir + "/hook_cache.js";
                            std::string sig_path = g_working_dir + "/hook_cache.js.sig";
                            remove(cache_path.c_str());
                            remove(sig_path.c_str());
                        }
                    }
                    
                    if (loaded_ok && verify_rsa_signature(env, processed_js, cached_sig, rsa_public_key, sizeof(rsa_public_key))) {
                        js_code_str = processed_js;
                    }
                }
                if (js_code_str.empty()) {
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
                if (!js_code_str.empty()) {
                    LOGI("[Reload Thread] Loading fallback script...");
                    g_idle_add(reload_script_idle_callback, new std::string(js_code_str));
                    g_current_script_hash = js_code_str;
                }
            }
        }
    } else {
        LOGI("[Reload Thread] Sandbox mode active: Skipping script OTA update.");
    }

    // 2. Check for library updates
    if (env && !g_server_url.empty()) {
        size_t last_slash = g_server_url.find_last_of('/');
        std::string base_url = (last_slash != std::string::npos) ? g_server_url.substr(0, last_slash) : g_server_url;
        
#if defined(__aarch64__)
        std::string arch = "arm64-v8a";
#elif defined(__arm__)
        std::string arch = "armeabi-v7a";
#else
        std::string arch = "arm64-v8a";
#endif
        
        std::string lib_url = base_url + "/" + arch + "/libmypatch.so";
        std::string sig_url = lib_url + ".sig";
        
        std::string payload_path = g_working_dir + "/libmypatch_cache.so";
        std::string payload_sig_path = payload_path + ".sig";
        
        std::string current_sig = read_file(payload_sig_path);
        
        LOGI("[Reload Thread] Checking library OTA update from: %s", sig_url.c_str());
        std::string ota_sig = download_url(env, sig_url, g_timeout_ms);
        
        if (!ota_sig.empty()) {
            if (ota_sig == current_sig) {
                LOGI("[Reload Thread] Library OTA check: Remote signature matches local. No library update needed.");
            } else {
                LOGI("[Reload Thread] Library OTA check: Remote signature differs (or local is missing). New library version is available!");
                LOGI("[Reload Thread] Downloading latest library version from: %s", lib_url.c_str());
                std::string ota_lib = download_url(env, lib_url, g_timeout_ms);
                if (!ota_lib.empty()) {
                    LOGI("[Reload Thread] Downloaded library binary. Verifying RSA Digital Signature...");
                    if (verify_rsa_signature(env, ota_lib, ota_sig, rsa_public_key, sizeof(rsa_public_key))) {
                        LOGI("[Reload Thread] Library signature verification SUCCESS! Saving to cache.");
                        if (write_file(payload_path, ota_lib)) {
                            write_file(payload_sig_path, ota_sig);
                            LOGI("[Reload Thread] Library OTA update complete. Will load this version on next launch.");
                        } else {
                            LOGE("[Reload Thread] Failed to write downloaded library to cache!");
                        }
                    } else {
                        LOGE("[Reload Thread] Library signature verification FAILED for downloaded OTA library!");
                    }
                } else {
                    LOGE("[Reload Thread] Failed to download library binary from OTA URL.");
                }
            }
        } else {
            LOGI("[Reload Thread] Library OTA check: Failed to download remote library signature (offline or server unreachable).");
        }
    }

    if (attached && g_vm) {
        g_vm->DetachCurrentThread();
    }
    LOGI("[Reload Thread] Finished successfully.");
    return NULL;
}

extern "C" __attribute__((visibility("default"))) void reload_frida_script_native() {
    pthread_t thread;
    if (pthread_create(&thread, NULL, reload_worker_thread, NULL) == 0) {
        pthread_detach(thread);
    } else {
        LOGE("Failed to spawn reload worker thread");
    }
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
