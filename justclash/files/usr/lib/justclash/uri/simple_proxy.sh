#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_simple_proxy_url() {
    local link="$1" DEFAULT_SOCKS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5" routing_mark="$6" ip_version="$7"
    local raw="$link"
    raw="${raw#socks://}"
    raw="${raw#socks5://}"

    local server="" port="" username="" password=""
    local userinfo="" hostport="" proxy_obj

    if printf '%s\n' "$raw" | grep -q '@'; then
        userinfo="${raw%@*}"
        hostport="${raw#*@}"

        if printf '%s\n' "$userinfo" | grep -q ':'; then
            username="$(str_url_decode "${userinfo%%:*}")"
            password="$(str_url_decode "${userinfo#*:}")"
        else
            username="$(str_url_decode "$userinfo")"
        fi
    else
        hostport="$raw"
    fi

    # host:port
    server="$(str_url_decode "${hostport%%:*}")"

    port="${hostport##*:}"
    [ -z "$port" ] && port="$DEFAULT_SOCKS_PORT"
    port="${port//[!0-9]/}"
    [ -z "$port" ] && port="$DEFAULT_SOCKS_PORT"

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg username "$username" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --arg routing_mark "$routing_mark" \
            --arg ip_version "$ip_version" \
            --argjson port "$port" '
            {
                name: $name,
                type: "socks5",
                udp: true,
                server: $server,
                port: $port
            }
            + (if $username != "" then {username: $username} else {} end)
            + (if $password != "" then {password: $password} else {} end)
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
            + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
            + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}
