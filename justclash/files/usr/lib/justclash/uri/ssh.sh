#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060

parse_ssh_url() {
    local link="$1" default_port="${2:-22}" dialer_proxy="$3" name="$4"
    local interface_name="$5" routing_mark="$6" ip_version="$7"
    local raw="${link#ssh://}"
    local query_part="" authority userinfo="" hostport server="" port="" host_suffix=""
    local username="" password="" private_key="" private_key_passphrase=""
    local host_key="" host_key_algorithms="" decoded_value=""
    local host_key_json host_key_algorithms_json proxy_obj

    raw="${raw%%#*}"
    case "$raw" in
    *\?*)
        query_part="${raw#*\?}"
        raw="${raw%%\?*}"
        ;;
    esac

    # SSH URI paths identify remote resources, while a Mihomo SSH outbound
    # only needs the authority.
    authority="${raw%%/*}"

    case "$authority" in
    *@*)
        userinfo="${authority%@*}"
        hostport="${authority##*@}"
        ;;
    *)
        hostport="$authority"
        ;;
    esac

    # Ignore SSH URI connection parameters following the user name.
    userinfo="${userinfo%%;*}"
    case "$userinfo" in
    *:*)
        username="$(url_decode "${userinfo%%:*}")"
        password="$(url_decode "${userinfo#*:}")"
        ;;
    *)
        username="$(url_decode "$userinfo")"
        ;;
    esac

    case "$hostport" in
    \[*\]*)
        server="${hostport#\[}"
        server="${server%%\]*}"
        host_suffix="${hostport#*\]}"
        case "$host_suffix" in
        :*) port="${host_suffix#:}" ;;
        esac
        ;;
    *:*)
        server="${hostport%:*}"
        port="${hostport##*:}"
        ;;
    *)
        server="$hostport"
        ;;
    esac
    server="$(url_decode "$server")"

    while [ -n "$query_part" ]; do
        local param="${query_part%%&*}"
        query_part="${query_part#"$param"}"
        [ -n "$query_part" ] && query_part="${query_part#&}"

        local key="${param%%=*}"
        local value="${param#*=}"
        [ -n "$key" ] || continue

        case "$key" in
        username | user) username="$(url_decode "$value")" ;;
        password | pass) password="$(url_decode "$value")" ;;
        port) port="$(url_decode "$value")" ;;
        private-key | private_key | privateKey)
            private_key="$(url_decode "$value")"
            ;;
        private-key-passphrase | private_key_passphrase | privateKeyPassphrase)
            private_key_passphrase="$(url_decode "$value")"
            ;;
        host-key | host_key | hostKey)
            decoded_value="$(url_decode "$value")"
            host_key="${host_key:+$host_key,}$decoded_value"
            ;;
        host-key-algorithms | host_key_algorithms | hostKeyAlgorithms)
            decoded_value="$(url_decode "$value")"
            host_key_algorithms="${host_key_algorithms:+$host_key_algorithms,}$decoded_value"
            ;;
        esac
    done

    port="${port//[!0-9]/}"
    [ -n "$port" ] || port="$default_port"
    [ -n "$server" ] && [ -n "$username" ] || return 1

    host_key_json=$(json_array_from_csv "$host_key") || return 1
    host_key_algorithms_json=$(json_array_from_csv "$host_key_algorithms") || return 1

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg username "$username" \
            --arg password "$password" \
            --arg private_key "$private_key" \
            --arg private_key_passphrase "$private_key_passphrase" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --arg routing_mark "$routing_mark" \
            --arg ip_version "$ip_version" \
            --argjson port "$port" \
            --argjson host_key "$host_key_json" \
            --argjson host_key_algorithms "$host_key_algorithms_json" '
            {
                name: $name,
                type: "ssh",
                server: $server,
                port: $port,
                username: $username
            }
            + (if $password != "" then {password: $password} else {} end)
            + (if $private_key != "" then {"private-key": $private_key} else {} end)
            + (if $private_key_passphrase != "" then {"private-key-passphrase": $private_key_passphrase} else {} end)
            + (if ($host_key | length) > 0 then {"host-key": $host_key} else {} end)
            + (if ($host_key_algorithms | length) > 0 then {"host-key-algorithms": $host_key_algorithms} else {} end)
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
            + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
            + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}
