#!/bin/sh

# Load every parser into the current ash process, preserving the existing no-fork
# behavior. The filesystem gets more files; the router gets no extra processes.
_URI_LIBDIR="${JUSTCLASH_URI_LIBDIR:-/usr/lib/justclash/uri}"

# shellcheck disable=SC1091
. "$_URI_LIBDIR/common.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/virtual_direct.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/sudoku.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/shadowsocks.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/socks5.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/ssh.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/trojan.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/vless.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/vmess.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/hysteria2.sh" || return 1
# shellcheck disable=SC1091
. "$_URI_LIBDIR/mieru.sh" || return 1

unset _URI_LIBDIR
