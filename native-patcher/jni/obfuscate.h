#pragma once

#include <string>
#include <array>
#include <utility>

template <size_t N>
class XorString {
public:
    constexpr XorString(const char(&str)[N]) : XorString(str, std::make_index_sequence<N - 1>{}) {}

    const char* get() {
        if (!decrypted) {
            for (size_t i = 0; i < N - 1; ++i) {
                data[i] ^= Key;
            }
            data[N - 1] = '\0';
            decrypted = true;
        }
        return data.data();
    }

private:
    template <size_t... Is>
    constexpr XorString(const char(&str)[N], std::index_sequence<Is...>) : data{ (str[Is] ^ Key)..., '\0' }, decrypted(false) {}

    static constexpr char Key = 0x5A;
    std::array<char, N> data;
    bool decrypted;
};

#define OBFUSCATE(str) ([]() { static auto obfuscated = XorString<sizeof(str)>(str); return obfuscated.get(); }())
