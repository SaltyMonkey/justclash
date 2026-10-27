#!/bin/ash
# shellcheck shell=dash

policy_routing_rule_present() {
    local family="$1" mark_spec="$2" route_table="$3"

    ip "$family" rule show 2>/dev/null |
        grep -qE "fwmark ${mark_spec} lookup ${route_table}([[:space:]]|$)"
}

policy_routing_cleanup() {
    local routing_mark="$1" route_table="$2"
    local hex_mark family mark_spec

    hex_mark=$(printf "0x%x" "$routing_mark")
    mark_spec="$hex_mark/$hex_mark"
    for family in -4 -6; do
        while policy_routing_rule_present "$family" "$mark_spec" "$route_table"; do
            ip "$family" rule del fwmark "$mark_spec" table "$route_table" 2>/dev/null || return 1
        done
    done
}

policy_routing_apply() {
    local routing_mark="$1"
    local route_table="$2"
    local priority="$3"
    local ipv6_enabled="$4"

    policy_routing_cleanup "$routing_mark" "$route_table" || return 1
    ip -4 rule add fwmark "$routing_mark/$routing_mark" table "$route_table" priority "$priority" 2>/dev/null || true

    if ! ip -4 route show table "$route_table" 2>/dev/null | grep -Eq "local (default|0\.0\.0\.0/0|any) dev lo"; then
        ip -4 route add local 0.0.0.0/0 dev lo table "$route_table" 2>/dev/null || true
    fi

    if [ "$ipv6_enabled" -eq 1 ]; then
        ip -6 rule add fwmark "$routing_mark/$routing_mark" table "$route_table" priority "$priority" 2>/dev/null || true
        if ! ip -6 route show table "$route_table" 2>/dev/null | grep -Eq "local (default|::/0|any) dev lo"; then
            ip -6 route add local ::/0 dev lo table "$route_table" 2>/dev/null || true
        fi
    fi
    return 0
}

policy_routing_remove() {
    local routing_mark="$1"
    local route_table="$2"

    policy_routing_cleanup "$routing_mark" "$route_table" || return 1
    ip -4 route flush table "$route_table" 2>/dev/null || true
    ip -6 route flush table "$route_table" 2>/dev/null || true
}
