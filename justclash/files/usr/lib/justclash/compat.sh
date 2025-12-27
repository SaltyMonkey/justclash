#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------------------
# External justclash service part with compatibility fixes
# --------------------------------------------------------

compat_fixes() {
   iptables_fix
}

iptables_fix() {
    command -v sysctl >/dev/null 2>&1 || return 0

    [ "$(sysctl -n net.bridge.bridge-nf-call-iptables 2>/dev/null)" = "1" ] &&  sysctl -w net.bridge.bridge-nf-call-iptables=0
    [ "$(sysctl -n net.bridge.bridge-nf-call-ip6tables 2>/dev/null)" = "1" ] &&  sysctl -w net.bridge.bridge-nf-call-ip6tables=0
}
