#!/bin/ash
# shellcheck shell=dash

# Runtime functions extracted from the main service CLI.

check_safe_item() {
    local label="$1"

    shift
    if "$@" >/dev/null 2>&1; then
        printf "  %-24s :: OK\n" "$label"
    else
        printf "  %-24s :: Failed\n" "$label"
    fi
}

check_https() {
    curl --connect-timeout 3 --max-time 5 \
        --proto '=https' --proto-redir '=https' \
        -fsSL -o /dev/null -- "$1"
}

check_report_connectivity() {
    local target

    echo "  [ RU Connectivity ]"
    for target in ya.ru mail.ru rutube.ru; do
        check_safe_item "HTTPS $target" check_https "https://$target"
    done
    echo ""
    echo "  [ Non-RU Connectivity ]"
    for target in github.com www.cloudflare.com google.com; do
        check_safe_item "HTTPS $target" check_https "https://$target/favicon.ico"
    done
}

check_report_dnsmasq() {
    local section='dhcp.@dnsmasq[0]' dns_listen_port servers noresolv
    local upstream_status="Unavailable" noresolv_status="Unavailable"

    config_get dns_listen_port proxy dns_listen_port
    # Inspect the same instance JustClash configures, without dumping its neighbours.
    if [ "$(uci -q get "$section" 2>/dev/null)" = dnsmasq ]; then
        if [ -n "$dns_listen_port" ]; then
            servers=$(uci -q get "${section}.server" 2>/dev/null) || servers=""
            case " $servers " in
            *" 127.0.0.1#${dns_listen_port} "*) upstream_status="Present" ;;
            *) upstream_status="Absent" ;;
            esac
        fi
        noresolv=$(uci -q get "${section}.noresolv" 2>/dev/null) || noresolv=""
        case "$noresolv" in
        1 | on | true | yes | enabled) noresolv_status="Enabled" ;;
        '' | 0 | off | false | no | disabled) noresolv_status="Disabled" ;;
        *) noresolv_status="Unknown" ;;
        esac
    fi

    echo "  [ Dnsmasq ]"
    printf "  %-24s :: %s\n" "Mihomo DNS upstream" "$upstream_status"
    printf "  %-24s :: %s\n" "noresolv" "$noresolv_status"
}

check_nft() {
    local table_name="$1"

    clog info "Verifying existence of NFTables table '$table_name'..."
    if ! nft list table inet "$table_name" >/dev/null 2>&1; then
        clog error "Table '$table_name' not found. Please create the required NFTables table."
        return 1
    fi

    if [ "${2:-}" = "--unsafe" ]; then
        clog info "Displaying current NFTables configuration:"
        nft list table inet "$table_name" || return 1
    fi

    clog info "NFTables check completed successfully."

    return 0
}

check_routes() {
    local routing_mark="$1"
    local route_table="$2"
    local ipv6_enabled="$3"
    local hex_mark mark_spec

    hex_mark=$(printf "0x%x" "$routing_mark")
    mark_spec="$hex_mark/$hex_mark"

    clog info "Verifying existence of IPv4 policy routing rules and table '$route_table'..."
    if ! policy_routing_rule_present -4 "$mark_spec" "$route_table"; then
        clog error "Required IPv4 policy route rule is missing (fwmark ${mark_spec} lookup ${route_table})"
        return 1
    fi
    if ! ip -4 route show table "$route_table" 2>/dev/null | grep -Eq "local (default|0\.0\.0\.0/0|any) dev lo"; then
        clog error "Route table '$route_table' is incorrect or missing for IPv4"
        return 1
    fi

    if [ "$ipv6_enabled" -eq 1 ]; then
        clog info "Verifying existence of IPv6 policy routing rules and table '$route_table'..."
        if ! policy_routing_rule_present -6 "$mark_spec" "$route_table"; then
            clog error "Required IPv6 policy route rule is missing (fwmark ${mark_spec} lookup ${route_table})"
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

check_dns_proxy() {
    local target="$1"
    local dns_listen_port="$2"
    local timeout="$3"
    local ip_output exit_code ips

    if [ -z "$target" ] || [ -z "$dns_listen_port" ] || [ -z "$timeout" ]; then
        log warn "Usage: check_dns_proxy <domain> <port> <timeout>"
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

check_dns_external() {
    if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
        log warn "Usage: check_dns_external <domain> <dns resolver>"
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

config_show_mihomo() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        sed -E -e '/nameserver/!s/^([[:space:]]*"?[a-zA-Z0-9_-]*(password|secret|key|uuid|short-id|certificate|token|username|server|auth|url|header|age)[a-zA-Z0-9_-]*"?:).*/\1 "***REDACTED***"/' -e 's/AGE-SECRET-KEY-1[A-Z0-9]*/***REDACTED***/g' "$config_path"
    else
        clog error "Config file not found."
    fi
}

config_show_mihomo_unsafe() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        cat "$config_path"
    else
        clog error "Config file not found."
    fi
}

config_show_service() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        sed -E -e "/nameserver/!s/^([[:space:]]*(option|list)[[:space:]]+[a-zA-Z0-9_]*(password|secret|key|uuid|short_id|certificate|token|username|server|auth|subscription|proxy_link|url|header|age)[a-zA-Z0-9_]*[[:space:]]+).*/\1'***REDACTED***'/" "$config_path"
    else
        clog error "Service config file not found."
    fi
}

config_show_service_unsafe() {
    local config_path="$1"

    if [ -f "$config_path" ]; then
        cat "$config_path"
    else
        clog error "Service config file not found."
    fi
}
