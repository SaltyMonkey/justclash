#!/bin/ash
# Ash is checked as dash because ShellCheck still treats BusyBox as folklore.
# shellcheck shell=dash

_COMPAT_LIBDIR="${JUSTCLASH_COMPAT_LIBDIR:-/usr/lib/justclash/compat}"

# shellcheck disable=SC1091
. "$_COMPAT_LIBDIR/iptables.sh" || return 1

unset _COMPAT_LIBDIR

compat_fixes() {
    iptables_fix
}
