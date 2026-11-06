#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_simple_proxy_url() {
    local link="$1" default_socks_port="$2" dialer_proxy="$3" name="$4" interface_name="$5" routing_mark="$6" ip_version="$7"
    local raw="$link" resolve_destination=false
    case "$raw" in
    socks5+resolve://*)
        raw="${raw#socks5+resolve://}"
        resolve_destination=true
        ;;
    socks5://*)
        raw="${raw#socks5://}"
        ;;
    *) return 1 ;;
    esac

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

    local parsed_hostport
    parsed_hostport=$(uri_parse_hostport "$hostport" "$default_socks_port") || return 1
    server="${parsed_hostport%:*}"
    port="${parsed_hostport##*:}"
    port="${port//[!0-9]/}"
    [ -z "$port" ] && port="$default_socks_port"

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
            --argjson resolve_destination "$resolve_destination" \
            --argjson port "$port" '
            {
                name: $name,
                type: "socks5",
                udp: true,
                server: $server,
                port: $port
            }
            + (if $resolve_destination then {"resolve-destination": true} else {} end)
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
