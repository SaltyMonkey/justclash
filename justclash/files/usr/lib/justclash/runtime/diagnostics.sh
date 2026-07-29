#!/bin/ash
# shellcheck shell=dash

# Runtime functions extracted from the main service CLI.

diag_nft() {
    local table_name="$1"

    clog info "Verifying existence of NFTables table '$table_name'..."
    if ! nft list table inet "$table_name" >/dev/null 2>&1; then
        clog error "Table '$table_name' not found. Please create the required NFTables table."
        return 1
    fi

    clog info "Displaying current NFTables configuration:"
    nft list table inet "$table_name"

    clog info "NFTables check completed successfully."

    return 0
}

diag_route() {
    local routing_mark="$1"
    local route_table="$2"
    local ipv6_enabled="$3"
    local hex_mark

    hex_mark=$(printf "0x%x" "$routing_mark")

    clog info "Verifying existence of IPv4 policy routing rules and table '$route_table'..."
    if ! ip -4 rule list | grep -qF "fwmark ${hex_mark} lookup ${route_table}"; then
        clog error "Required IPv4 policy route rule is missing (fwmark ${hex_mark} lookup ${route_table})"
        return 1
    fi
    if ! ip -4 route show table "$route_table" 2>/dev/null | grep -Eq "local (default|0\.0\.0\.0/0|any) dev lo"; then
        clog error "Route table '$route_table' is incorrect or missing for IPv4"
        return 1
    fi

    if [ "$ipv6_enabled" -eq 1 ]; then
        clog info "Verifying existence of IPv6 policy routing rules and table '$route_table'..."
        if ! ip -6 rule list 2>/dev/null | grep -qF "fwmark ${hex_mark} lookup ${route_table}"; then
            clog error "Required IPv6 policy route rule is missing (fwmark ${hex_mark} lookup ${route_table})"
            return 1
        fi
        if ! ip -6 route show table "$route_table" 2>/dev/null | grep -Eq "local (default|::/0|any) dev lo"; then
            clog error "Route table '$route_table' is incorrect or missing for IPv6"
            return 1
        fi
    fi

    clog info "Displaying current policy routing configuration:"
    ip -4 rule list
    ip -4 route show table "$route_table" 2>/dev/null
    if [ "$ipv6_enabled" -eq 1 ]; then
        ip -6 rule list 2>/dev/null
        ip -6 route show table "$route_table" 2>/dev/null
    fi

    clog info "Policy routing check completed successfully."
    return 0
}

diag_proxy_resolver() {
    local target="$1"
    local dns_listen_port="$2"
    local timeout="$3"
    local ip_output exit_code ips

    if [ -z "$target" ] || [ -z "$dns_listen_port" ] || [ -z "$timeout" ]; then
        log warn "Usage: diag_proxy_resolver <domain> <port> <timeout>"
        return 1
    fi

    clog info "Testing Fake IP DNS resolution..."

    ip_output=$(nslookup -timeout="$timeout" "$target" 127.0.0.1:"$dns_listen_port" 2>/dev/null)
    exit_code=$?

    ips=$(echo "$ip_output" | awk '/^Address: / {print $2}')

    if [ "$exit_code" -ne 0 ] || [ -z "$ips" ]; then
        clog error "Fake IP DNS query failed"
        return 1
    else
        echo "$ips"
        clog info "Fake IP DNS query successful"
        return 0
    fi
}

diag_external_resolver() {
    if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
        log warn "Usage: diag_external_resolver <domain> <dns resolver>"
        return 1
    fi
    local target="$1"
    local resolver="$2"
    local timeout="$3"
    local ip_output exit_code ips

    clog info "Testing DNS resolution..."

    ip_output=$(nslookup -timeout="$timeout" "$target" "$resolver" 2>/dev/null)
    exit_code=$?

    ips=$(echo "$ip_output" | awk '/^Address: / {print $2}')

    if [ "$exit_code" -ne 0 ] || [ -z "$ips" ]; then
        clog error "External DNS query failed"
        return 1
    else
        clog info "External DNS query successful"
        return 0
    fi
}

diag_icmp() {
    local target="${1}"
    local count="${2}"
    local timeout="${3}"
    local ping_output exit_code

    if [ -z "$target" ] || [ -z "$count" ] || [ -z "$timeout" ]; then
        clog warn "Usage: diag_icmp <target> <count>"
        return 1
    fi

    ping_output=$(ping -c "$count" -W "$timeout" "$target" 2>&1)
    exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        clog info "Ping to ${target} is successful"
        clog info "$ping_output"
    else
        clog error "Ping to ${target} failed"
        clog error "$ping_output"
    fi
}

diag_mihomo_config() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        sed -E -e '/nameserver/!s/^([[:space:]]*"?[a-zA-Z0-9_-]*(password|secret|key|uuid|short-id|certificate|token|username|server|auth|url|header|age)[a-zA-Z0-9_-]*"?:).*/\1 "***REDACTED***"/' -e 's/AGE-SECRET-KEY-1[A-Z0-9]*/***REDACTED***/g' "$config_path"
    else
        clog error "Config file not found."
    fi
}

diag_mihomo_config_unsafe() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        cat "$config_path"
    else
        clog error "Config file not found."
    fi
}

diag_service_config() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        sed -E -e "/nameserver/!s/^([[:space:]]*(option|list)[[:space:]]+[a-zA-Z0-9_]*(password|secret|key|uuid|short_id|certificate|token|username|server|auth|subscription|proxy_link|url|header|age)[a-zA-Z0-9_]*[[:space:]]+).*/\1'***REDACTED***'/" "$config_path"
    else
        clog error "Service config file not found."
    fi
}

diag_service_config_unsafe() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        cat "$config_path"
    else
        clog error "Service config file not found."
    fi
}

diag_service_config_reset() {
    local default_config_path="$1"
    local config_path="$2"
    local backup_config_path="$3"

    if [ ! -f "$default_config_path" ]; then
        clog error "Default configuration file is missing. Restore is unavailable."
        return 1
    fi

    clog info "Restoring JustClash settings..."

    rm -f "$backup_config_path"

    if [ ! -f "$config_path" ]; then
        clog error "Current configuration file was not found; nothing to back up."
    else
        if ! mv "$config_path" "$backup_config_path"; then
            clog error "Failed to back up the current configuration file."
            return 1
        else
            clog info "Previous configuration file was saved to ${backup_config_path}"
        fi
    fi

    if ! cp "$default_config_path" "$config_path"; then
        clog error "Failed to restore the default configuration."
        return 1
    fi

    clog info "Default settings will be applied on the next service restart."
    return 0
}
