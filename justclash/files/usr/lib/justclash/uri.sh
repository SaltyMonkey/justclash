#!/bin/sh

# Load every parser into the current ash process, preserving the existing no-fork
# behavior. The filesystem gets more files; the router gets no extra processes.

# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/common.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/virtual_direct.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/sudoku.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/shadowsocks.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/socks5.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/ssh.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/trojan.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/vless.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/vmess.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/hysteria2.sh" || return 1
# shellcheck disable=SC1091
. "/usr/lib/justclash/uri/mieru.sh" || return 1
