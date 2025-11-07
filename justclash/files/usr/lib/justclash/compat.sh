#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------------------
# External justclash service part with compatibility fixes
# --------------------------------------------------------

compat_fixes() {
   friendlyWRT_fix
}

friendlyWRT_fix() {
     if ! command -v lsmod >/dev/null 2>&1; then
        return 1
    else
        if lsmod | grep -qF br_netfilter && [ "$(sysctl -n net.bridge.bridge-nf-call-iptables 2>/dev/null)" = "1" ]; then
            sysctl -w net.bridge.bridge-nf-call-iptables=0
            sysctl -w net.bridge.bridge-nf-call-ip6tables=0
            return 0
        fi
    fi
}