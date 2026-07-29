#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_hysteria2_url() {
    local url="$1" DEFAULT_HY2_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5" routing_mark="$6" ip_version="$7"


    local raw="${url#hysteria2://}"
    raw="${raw#hy2://}"
    raw="${raw%%#*}"

    local userinfo hostport password server port ports query_part
    ports=""
    query_part=""

    case "$raw" in *\?*) query_part="${raw#*\?}"; raw="${raw%%\?*}"; esac

    if printf '%s\n' "$raw" | grep -q '@'; then
        userinfo="${raw%@*}"
        hostport="${raw#*@}"
        password="$(url_decode "$userinfo")"
    else
        hostport="$raw"
        password=""
    fi

    server="${hostport%%:*}"
    port="${hostport##*:}"
    [ "$server" = "$port" ] && port="${DEFAULT_HY2_PORT:-443}"

    case "$port" in
        *[,-]*)
            ports="$port"
            port="${ports%%[,-]*}"
            ;;
    esac
    port="${port//[!0-9]/}"
    [ -z "$port" ] && port="${DEFAULT_HY2_PORT:-443}"

    local sni="" insecure=0 obfs="" obfs_password="" obfs_min="" obfs_max="" bbr_profile=""
    local up="" down="" alpn="" pin_sha256="" ech="" handshake_timeout="" hop_interval="" name_cert_verify=""
    local obfs_min_value="" obfs_max_value="" handshake_timeout_value=""
    local alpn_json proxy_obj

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        case "$k" in
            sni) sni="$(url_decode "$v")" ;;
            insecure|allowInsecure|skip-cert-verify|skipCertVerify) is_truthy "$v" && insecure=1 ;;
            obfs) obfs="$(url_decode "$v")" ;;
            obfs-password|obfsPassword) obfs_password="$(url_decode "$v")" ;;
            obfs-min-packet-size|obfs-min|obfsMinPacketSize|obfsMin) obfs_min="$v" ;;
            obfs-max-packet-size|obfs-max|obfsMaxPacketSize|obfsMax) obfs_max="$v" ;;
            bbr-profile|bbrProfile|bbr) bbr_profile="$(url_decode "$v")" ;;
            up|upmbps) up="$(url_decode "$v")" ;;
            down|downmbps) down="$(url_decode "$v")" ;;
            ports) ports="$(url_decode "$v")" ;;
            hop-interval|hop_interval|hopInterval) hop_interval="$(url_decode "$v")" ;;
            handshake-timeout|handshakeTimeout) handshake_timeout="$v" ;;
            alpn) alpn="$(url_decode "$v")" ;;
            pinSHA256|fingerprint|fp|client-fingerprint|clientFingerprint) pin_sha256="$v" ;;
            ech) ech="$(url_decode "$v")" ;;
            name-cert-verify|nameCertVerify|peer) name_cert_verify="$(url_decode "$v")" ;;
        esac
    done

    [ -n "$obfs_min" ] && obfs_min_value="${obfs_min//[!0-9]/}"
    [ -n "$obfs_max" ] && obfs_max_value="${obfs_max//[!0-9]/}"
    [ -n "$handshake_timeout" ] && handshake_timeout_value="${handshake_timeout//[!0-9]/}"
    alpn_json=$(json_array_from_csv "$alpn") || return 1

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --arg routing_mark "$routing_mark" \
            --arg ip_version "$ip_version" \
            --arg sni "$sni" \
            --arg obfs "$obfs" \
            --arg obfs_password "$obfs_password" \
            --arg obfs_min "$obfs_min_value" \
            --arg obfs_max "$obfs_max_value" \
            --arg bbr_profile "$bbr_profile" \
            --arg ports "$ports" \
            --arg hop_interval "$hop_interval" \
            --arg pin_sha256 "$pin_sha256" \
            --arg ech "$ech" \
            --arg handshake_timeout "$handshake_timeout_value" \
            --arg name_cert_verify "$name_cert_verify" \
            --argjson port "$port" \
            --argjson insecure "$insecure" \
            --argjson alpn "$alpn_json" \
            --arg up "$up" \
            --arg down "$down" '
            {
                name: $name,
                type: "hysteria2",
                server: $server,
                port: $port,
                udp: true
            }
            + (if $password != "" then {password: $password} else {} end)
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
            + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
            + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
            + (if $sni != "" then {sni: $sni} else {} end)
            + (if $insecure == 1 then {"skip-cert-verify": true} else {} end)
            + (if $name_cert_verify != "" then {"name-cert-verify": $name_cert_verify} else {} end)
            + (if $obfs != "" and $obfs != "none" then
                    {obfs: $obfs}
                    + (if $obfs_password != "" then {"obfs-password": $obfs_password} else {} end)
                    + (if $obfs_min != "" then {"obfs-min-packet-size": ($obfs_min | tonumber)} else {} end)
                    + (if $obfs_max != "" then {"obfs-max-packet-size": ($obfs_max | tonumber)} else {} end)
                else {} end)
            + (if $up != "" then {up: (if ($up | test("^[0-9]+$")) then ($up | tonumber) else $up end)} else {} end)
            + (if $down != "" then {down: (if ($down | test("^[0-9]+$")) then ($down | tonumber) else $down end)} else {} end)
            + (if $bbr_profile != "" then {"bbr-profile": $bbr_profile} else {} end)
            + (if $ports != "" then {ports: $ports} else {} end)
            + (if $hop_interval != "" then {"hop-interval": (if ($hop_interval | test("^[0-9]+$")) then ($hop_interval | tonumber) else $hop_interval end)} else {} end)
            + (if ($alpn | length) > 0 then {alpn: $alpn} else {} end)
            + (if $pin_sha256 != "" then {fingerprint: $pin_sha256} else {} end)
            + (if $handshake_timeout != "" then {"handshake-timeout": ($handshake_timeout | tonumber)} else {} end)
            + (if $ech != "" then {"ech-opts": {enable: true, config: $ech}} else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}

#Supports only one port/port-range + transport combination
