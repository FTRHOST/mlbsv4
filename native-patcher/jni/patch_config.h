#ifndef PATCH_CONFIG_H
#define PATCH_CONFIG_H

#include <string>
#include <fstream>
#include <sstream>
#include <stdlib.h>
#include <sys/system_properties.h>
#include <android/log.h>

#define CONFIG_LOG_TAG "MLBSConfig"

/**
 * PatchConfig represents the application configurations.
 * It parses properties files formatted as simple 'key=value' pairs,
 * and handles configuration priority:
 * 1. System Properties (Overrides set via ADB - in-memory, no files)
 * 2. Sandboxed configuration (working_dir/patch_config.properties)
 * 3. Hardcoded defaults
 */
struct PatchConfig {
    std::string server_url = "https://mlbsv4.vercel.app/hook.js";
    int timeout_ms = 5000;
    bool verbose = false;

    // Helper to read Android system properties
    static std::string read_system_property(const char *prop_name) {
        char val[PROP_VALUE_MAX] = {0};
        int len = __system_property_get(prop_name, val);
        if (len > 0) {
            return std::string(val, len);
        }
        return "";
    }

    // Helper to trim spaces, tabs, and newlines
    static std::string trim(const std::string &str) {
        size_t first = str.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) return "";
        size_t last = str.find_last_not_of(" \t\r\n");
        return str.substr(first, (last - first + 1));
    }

    // Load key-value properties from string content
    void parse_properties(const std::string &content) {
        std::stringstream ss(content);
        std::string line;
        while (std::getline(ss, line)) {
            line = trim(line);
            // Skip empty lines and comment lines
            if (line.empty() || line[0] == '#') continue;

            size_t eq_pos = line.find('=');
            if (eq_pos == std::string::npos) continue;

            std::string key = trim(line.substr(0, eq_pos));
            std::string value = trim(line.substr(eq_pos + 1));

            if (key == "server_url") {
                server_url = value;
            } else if (key == "timeout_ms") {
                timeout_ms = atoi(value.c_str());
            } else if (key == "verbose") {
                verbose = (value == "true" || value == "1");
            }
        }
    }

    // Systematically load settings with fallback hierarchy
    static PatchConfig load(const std::string &working_dir) {
        PatchConfig config;

        // Load Sandboxed properties config (default location)
        std::string sandbox_path = working_dir + "/patch_config.properties";
        std::ifstream sandbox_file(sandbox_path.c_str());
        if (sandbox_file.good()) {
            std::stringstream buffer;
            buffer << sandbox_file.rdbuf();
            sandbox_file.close();
            config.parse_properties(buffer.str());
            __android_log_print(ANDROID_LOG_INFO, CONFIG_LOG_TAG, "Loaded config from sandbox: %s", sandbox_path.c_str());
        } else {
            sandbox_file.close();
            // Create default file if none exists
            std::ofstream outfile(sandbox_path.c_str());
            if (outfile.is_open()) {
                outfile << "# MLBS Configuration Properties\n";
                outfile << "# Format: key=value\n\n";
                outfile << "server_url=https://mlbsv4.vercel.app/hook.js\n";
                outfile << "timeout_ms=5000\n";
                outfile << "verbose=false\n";
                outfile.close();
                __android_log_print(ANDROID_LOG_INFO, CONFIG_LOG_TAG, "Created default configuration file at: %s", sandbox_path.c_str());
            }
        }

        // Priority 1: System Property overrides (highest priority, set via ADB in-memory)
        std::string prop_server = read_system_property("debug.mlbs.server");
        if (!prop_server.empty()) {
            config.server_url = prop_server;
            __android_log_print(ANDROID_LOG_INFO, CONFIG_LOG_TAG, "Overrode server_url from system property: %s", config.server_url.c_str());
        }

        std::string prop_timeout = read_system_property("debug.mlbs.timeout");
        if (!prop_timeout.empty()) {
            config.timeout_ms = atoi(prop_timeout.c_str());
            __android_log_print(ANDROID_LOG_INFO, CONFIG_LOG_TAG, "Overrode timeout_ms from system property: %d", config.timeout_ms);
        }

        std::string prop_verbose = read_system_property("debug.mlbs.verbose");
        if (!prop_verbose.empty()) {
            config.verbose = (prop_verbose == "true" || prop_verbose == "1");
            __android_log_print(ANDROID_LOG_INFO, CONFIG_LOG_TAG, "Overrode verbose mode from system property: %s", config.verbose ? "true" : "false");
        }

        return config;
    }
};

#endif // PATCH_CONFIG_H
