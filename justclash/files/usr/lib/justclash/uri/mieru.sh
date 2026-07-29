#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_mieru_url() {
    local link="$1" dialer_proxy="$2" name="$3" interface_name="$4" routing_mark="$5" ip_version="$6"
    local raw="${link#mierus://}"
    raw="${raw%%#*}"

    local auth_host_query
    auth_host_query="${raw%%\?*}"
    local query_part=""
    case "$raw" in *\?*) query_part="${raw#*\?}" ;; esac

    local auth=""
    local server=""

    case "$auth_host_query" in *@*)
        auth="${auth_host_query%@*}"
        server="${auth_host_query#*@}"
        ;;
    *)
        server="$auth_host_query"
        ;;
    esac

    local username="" password=""
    if [ -n "$auth" ]; then
        case "$auth" in *:*)
            username="$(url_decode "${auth%%:*}")"
            password="$(url_decode "${auth#*:}")"
            ;;
        *)
            username="$(url_decode "$auth")"
            ;;
        esac
    fi

    local multiplexing="" transport="" handshake_mode="" traffic_pattern=""
    local port_val="" port_range=""

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        case "$k" in
            multiplexing) multiplexing="$v" ;;
            handshake-mode) handshake_mode="$v" ;;
            traffic-pattern) traffic_pattern="$(url_decode "$v")" ;;
            port)
                local decoded_port
                decoded_port="$(url_decode "$v")"
                case "$decoded_port" in
                    *-*)
                        port_range="$decoded_port"
                        port_val=""
                        ;;
                    *)
                        port_val="$decoded_port"
                        port_range=""
                        ;;
                esac
                ;;
            protocol)
                local decoded_proto
                decoded_proto="$(url_decode "$v")"
                transport=$(printf '%s' "$decoded_proto" | tr '[:upper:]' '[:lower:]')
                ;;
        esac
    done

    local proxy_obj
    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg handshake_mode "$handshake_mode" \
            --arg transport "$transport" \
            --arg username "$username" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --arg routing_mark "$routing_mark" \
            --arg ip_version "$ip_version" \
            --arg multiplexing "$multiplexing" \
            --arg traffic_pattern "$traffic_pattern" \
            --arg port_range "$port_range" \
            --arg port_val "$port_val" '
            {
                name: $name,
                type: "mieru",
                server: $server,
                udp: true
            }
            + (if $handshake_mode != "" then {"handshake-mode": $handshake_mode} else {} end)
            + (if $transport != "" then {transport: $transport} else {} end)
            + (if $username != "" then {username: $username} else {} end)
            + (if $password != "" then {password: $password} else {} end)
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
            + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
            + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
            + (if $multiplexing != "" then {multiplexing: $multiplexing} else {} end)
            + (if $traffic_pattern != "" then {"traffic-pattern": $traffic_pattern} else {} end)
            + (if $port_range != "" then {"port-range": $port_range} else {} end)
            + (if $port_val != "" then {port: ($port_val | tonumber)} else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}
