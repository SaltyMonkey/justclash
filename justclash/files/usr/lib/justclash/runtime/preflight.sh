#!/bin/ash
# shellcheck shell=dash

# Generic startup checks. Configuration loading and orchestration belong to the caller.

# Returns 0 when ports are unique, 4 when configured ports conflict.
check_port_collisions() {
    local dns_port="$1"
    local tproxy_port="$2"
    local mixed_port="$3"
    local api_port="$4"
    local ports=""
    local p

    for p in "$dns_port" "$tproxy_port" "$mixed_port" "$api_port"; do
        [ -z "$p" ] && continue
        if echo "$ports" | grep -qw "$p"; then
            log error "Port collision detected. Port $p is configured multiple times"
            return 4
        fi
        ports="${ports:+$ports }$p"
    done

    return 0
}

# Returns 0 when ports become available, 4 when another service keeps a port busy.
check_ports_occupancy() {
    local dns_port="$1"
    local tproxy_port="$2"
    local mixed_port="$3"
    local api_port="$4"
    local ports=""
    local p

    for p in "$dns_port" "$tproxy_port" "$mixed_port" "$api_port"; do
        [ -z "$p" ] && continue
        ports="${ports:+$ports }$p"
    done

    local attempt=1
    local busy_port=""
    while [ "$attempt" -le 3 ]; do
        busy_port=""
        for p in $ports; do
            if netstat -lntu 2>/dev/null | grep -qE "[:.]${p}\b"; then
                busy_port="$p"
                break
            fi
        done
        [ -z "$busy_port" ] && break
        log warn "Port $busy_port is busy. Retrying in 1s..."
        sleep 1
        attempt=$((attempt + 1))
    done

    if [ -n "$busy_port" ]; then
        log error "Port $busy_port is already in use by another service"
        return 4
    fi

    return 0
}
# Predicate: returns 0 when either the script or core is already running, 1 otherwise.
check_is_already_running() {
    local script_pattern="$1"
    local program_name="$2"
    local core_path="$3"
    local self_pid="$4"
    local pid

    for pid in $(pgrep -f "$script_pattern" 2>/dev/null); do
        if [ "$pid" != "$self_pid" ]; then
            log warn "Another instance of $program_name script is already running (PID $pid)."
            return 0
        fi
    done

    if pgrep -f "$(basename "$core_path")" >/dev/null 2>&1; then
        log warn "$program_name core is already running."
        return 0
    fi

    return 1
}

# Returns 0 when requirements are available, 3 when a required component is missing.
check_requirement() {
    local core_path="$1"
    local core_name="$2"
    local required_tools="$3"
    local cmd ret=0

    if [ ! -x "$core_path" ]; then
        log error "Requirement is missing: $core_name binary is not installed."
        ret=3
    fi

    for cmd in $required_tools; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            log error "Requirement is missing: $cmd is not installed."
            ret=3
        fi
    done

    return "$ret"
}

check_for_conflicts_warn() {
    local dhcp_config_path="$1"
    local warn_patterns="$2"
    local resolvconf_path="$3"
    local zapret_path="$4"
    local byedpi_path="$5"
    local youtube_unblock_path="$6"
    local b4_path="$7"
    local resolvconf_res
    local found_patterns formatted_patterns
    local service_path detected_services service_name

    # Check for DHCP config leftovers
    # shellcheck disable=SC2086
    found_patterns=$(is_pattern_in_file "$dhcp_config_path" $warn_patterns)
    if [ -n "$found_patterns" ]; then
        formatted_patterns=$(echo "$found_patterns" | sed 's/ /, /g')
        log warn "DHCP configuration contains leftover patterns: $formatted_patterns"
    fi

    # Check for external DNS in resolv.conf
    awk '$1 == "nameserver" && $2 != "127.0.0.1" && $2 != "0.0.0.0" && $2 != "::1" && $2 != "::" { found=1 } END { exit !found }' "$resolvconf_path"
    resolvconf_res=$?

    if [ "$resolvconf_res" -eq 0 ]; then
        log warn "External DNS servers listed in /etc/resolv.conf may bypass proxy rules"
    fi

    # Check for potentially conflicting services
    detected_services=""
    for service_path in "$zapret_path" "$byedpi_path" "$youtube_unblock_path" "$b4_path"; do
        if [ -f "$service_path" ]; then
            service_name="${service_path##*/}"
            detected_services="${detected_services:+$detected_services, }$service_name"
        fi
    done

    if [ -n "$detected_services" ]; then
        log warn "Potential conflict: active DPI or proxy services detected ($detected_services)"
    fi
}
