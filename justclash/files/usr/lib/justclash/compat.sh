#!/bin/ash
# Ash is checked as dash because ShellCheck still treats BusyBox as folklore.
# shellcheck shell=dash

# Disable bridge netfilter hooks that would otherwise process bridged traffic twice.

iptables_fix() {
    command -v sysctl >/dev/null 2>&1 || return 0
    lsmod 2>/dev/null | grep -q '^br_netfilter[[:space:]]' || return 0
    [ "$(sysctl -n net.bridge.bridge-nf-call-iptables 2>/dev/null)" = "1" ] || return 0

    sysctl -w net.bridge.bridge-nf-call-iptables=0
    sysctl -w net.bridge.bridge-nf-call-ip6tables=0
}

compat_fixes() {
    iptables_fix
}
