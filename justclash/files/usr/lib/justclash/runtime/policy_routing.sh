#!/bin/ash
# shellcheck shell=dash

policy_routing_cleanup() {
    local routing_mark="$1"
    local route_table="$2"
    local hex_mark
    hex_mark=$(printf "0x%x" "$routing_mark")
    while ip -4 rule show 2>/dev/null | grep -qF "fwmark ${hex_mark} lookup ${route_table}"; do
        ip -4 rule del fwmark "$routing_mark" table "$route_table" 2>/dev/null || true
    done
    while ip -6 rule show 2>/dev/null | grep -qF "fwmark ${hex_mark} lookup ${route_table}"; do
        ip -6 rule del fwmark "$routing_mark" table "$route_table" 2>/dev/null || true
    done
}

policy_routing_apply() {
    local routing_mark="$1"
    local route_table="$2"
    local priority="$3"
    local ipv6_enabled="$4"

    policy_routing_cleanup "$routing_mark" "$route_table"
    ip -4 rule add fwmark "$routing_mark" table "$route_table" priority "$priority" 2>/dev/null || true

    if ! ip -4 route show table "$route_table" 2>/dev/null | grep -Eq "local (default|0\.0\.0\.0/0|any) dev lo"; then
        ip -4 route add local 0.0.0.0/0 dev lo table "$route_table" 2>/dev/null || true
    fi

    if [ "$ipv6_enabled" -eq 1 ]; then
        ip -6 rule add fwmark "$routing_mark" table "$route_table" priority "$priority" 2>/dev/null || true
        if ! ip -6 route show table "$route_table" 2>/dev/null | grep -Eq "local (default|::/0|any) dev lo"; then
            ip -6 route add local ::/0 dev lo table "$route_table" 2>/dev/null || true
        fi
    fi
    return 0
}

policy_routing_remove() {
    local routing_mark="$1"
    local route_table="$2"

    policy_routing_cleanup "$routing_mark" "$route_table"
    ip -4 route flush table "$route_table" 2>/dev/null || true
    ip -6 route flush table "$route_table" 2>/dev/null || true
}
