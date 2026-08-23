#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <cstdlib>

namespace std {
    inline namespace __ndk1 {
        __attribute__((visibility("default"))) __attribute__((noreturn))
        void __libcpp_verbose_abort(const char* format, ...) noexcept {
            std::abort();
        }

        template class basic_filebuf<char, char_traits<char>>;
        template class basic_stringbuf<char, char_traits<char>, allocator<char>>;
        template class basic_stringstream<char, char_traits<char>, allocator<char>>;
        template class basic_ostringstream<char, char_traits<char>, allocator<char>>;
        template class basic_ofstream<char, char_traits<char>>;
    }
}
