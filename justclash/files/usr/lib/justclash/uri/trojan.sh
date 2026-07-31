#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_trojan_url() {
    local url="$1" DEFAULT_TLS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5" routing_mark="$6" ip_version="$7" random_ua="$8"

    local raw="${url#trojan://}"
    raw="${raw#trojan-go://}"
    raw="${raw%%#*}"

    local userinfo="${raw%@*}"
    local hostport="${raw#*@}"
    local password
    password="$(printf '%b' "$(printf '%s' "$userinfo" | sed 's/%\(..\)/\\x\1/g')")"

    local host="${hostport%%\?*}"
    local server
    server="$(str_url_decode "${host%%:*}")"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port="$DEFAULT_TLS_PORT"
    port="${port//[!0-9]/}"
    [ -z "$port" ] && port="$DEFAULT_TLS_PORT"

    local query_part=""
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local sni="" insecure=0 net="tcp" httpupgrade=0 fp="" alpn="" ws_path="" ws_host="" grpc_service="" grpc_ua="" grpc_ping_interval=""
    local ss_enabled="" ss_method="" ss_password=""
    local security="" pbk="" sid="" spx="" ech="" flow="" pin_sha256="" name_cert_verify=""
    local shadow_tls_password="" shadow_tls_version=""
    local restls_password="" restls_version_hint="" restls_script=""
    local jls_username="" jls_password=""
    local support_x25519mlkem768=""
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
        sni) sni="$(str_url_decode "$v")" ;;
        insecure | allowInsecure | skip-cert-verify | skipCertVerify) uri_is_truthy "$v" && insecure=1 ;;
        type)
            if [ "$v" = "httpupgrade" ]; then
                net="ws"
                httpupgrade=1
            else
                net="$v"
            fi
            ;;
        security) security="$v" ;;
        pbk | public-key) pbk="$v" ;;
        sid | short-id) sid="$v" ;;
        spx) spx="$(str_url_decode "$v")" ;;
        flow) flow="$v" ;;
        pinSHA256 | fingerprint) pin_sha256="$(str_url_decode "$v")" ;;
        name-cert-verify | nameCertVerify | peer) name_cert_verify="$(str_url_decode "$v")" ;;
        shadow-tls-password | shadowTlsPassword) shadow_tls_password="$(str_url_decode "$v")" ;;
        shadow-tls-version | shadowTlsVersion) shadow_tls_version="$v" ;;
        restls-password | restlsPassword) restls_password="$(str_url_decode "$v")" ;;
        restls-version-hint | restlsVersionHint | restlsVersion) restls_version_hint="$v" ;;
        restls-script | restlsScript) restls_script="$(str_url_decode "$v")" ;;
        jls-username | jlsUsername | jlsUser) jls_username="$(str_url_decode "$v")" ;;
        jls-password | jlsPassword) jls_password="$(str_url_decode "$v")" ;;
        support-x25519mlkem768 | x25519mlkem768 | support-x25519-mlkem768) uri_is_truthy "$v" && support_x25519mlkem768=1 ;;
        ech) ech="$(str_url_decode "$v")" ;;
        fp | client-fingerprint | clientFingerprint) fp="$v" ;;
        alpn) alpn="$(str_url_decode "$v")" ;;
        path)
            if [ -n "$v" ]; then
                ws_path="$(str_url_decode "$v")"
            else
                ws_path="/"
            fi
            ;;
        host) ws_host="$(str_url_decode "$v")" ;;
        serviceName | service-name) grpc_service="$(str_url_decode "$v")" ;;
        grpc-user-agent | grpcUserAgent) grpc_ua="$(str_url_decode "$v")" ;;
        ping-interval | pingInterval) grpc_ping_interval="${v//[!0-9]/}" ;;
        ss) ss_enabled="$v" ;;
        ss-method) ss_method="$v" ;;
        ss-password) ss_password="$v" ;;
        esac
    done

    if [ "$net" = "grpc" ] && [ -z "$grpc_service" ]; then
        grpc_service="/"
    fi

    alpn_json=$(uri_json_array_from_csv "$alpn") || return 1

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
            --arg net "$net" \
            --arg fp "$fp" \
            --arg ws_path "${ws_path:-/}" \
            --arg ws_host "$ws_host" \
            --arg grpc_service "$grpc_service" \
            --arg grpc_ua "$grpc_ua" \
            --arg grpc_ping_interval "$grpc_ping_interval" \
            --arg security "$security" \
            --arg pbk "$pbk" \
            --arg sid "$sid" \
            --arg spx "$spx" \
            --arg ech "$ech" \
            --arg flow "$flow" \
            --arg pin_sha256 "$pin_sha256" \
            --arg name_cert_verify "$name_cert_verify" \
            --arg shadow_tls_password "$shadow_tls_password" \
            --arg shadow_tls_version "$shadow_tls_version" \
            --arg restls_password "$restls_password" \
            --arg restls_version_hint "$restls_version_hint" \
            --arg restls_script "$restls_script" \
            --arg jls_username "$jls_username" \
            --arg jls_password "$jls_password" \
            --arg support_x25519mlkem768 "$support_x25519mlkem768" \
            --arg ss_method "$ss_method" \
            --arg ss_password "$ss_password" \
            --arg ss_enabled "$ss_enabled" \
            --argjson port "$port" \
            --argjson httpupgrade "$httpupgrade" \
            --argjson insecure "$insecure" \
            --argjson alpn "$alpn_json" \
            --arg ws_user_agent "$random_ua" '
            {
                name: $name,
                type: "trojan",
                server: $server,
                port: $port,
                password: $password,
                udp: true,
                network: $net
            }
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
            + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
            + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
            + (if $net == "ws" then
                    {network: "ws"}
                    + {"ws-opts": (
                        {path: $ws_path}
                        + {headers: (
                            {"User-Agent": $ws_user_agent}
                            + (if $ws_host != "" then {Host: $ws_host} else {} end)
                          )}
                        + (if $httpupgrade == 1 then {"v2ray-http-upgrade": true} else {} end)
                    )}
                elif $net == "grpc" then
                    {network: "grpc"}
                    + {"grpc-opts": (
                        {"grpc-service-name": $grpc_service}
                        + (if $grpc_ua != "" then {"grpc-user-agent": $grpc_ua} else {} end)
                        + (if $grpc_ping_interval != "" then {"ping-interval": ($grpc_ping_interval | tonumber)} else {} end)
                    )}
                else
                    (if $net != "" and $net != "tcp" then {network: $net} else {} end)
                end)
            + (if $security == "none" and $shadow_tls_password == "" and $restls_password == "" and $jls_password == "" then
                    {tls: false}
                else
                    {tls: true}
                    + (if $sni != "" then {sni: $sni} else {} end)
                    + (if $insecure == 1 then {"skip-cert-verify": true} else {} end)
                    + (if $name_cert_verify != "" then {"name-cert-verify": $name_cert_verify} else {} end)
                    + (if $pin_sha256 != "" then {fingerprint: $pin_sha256} else {} end)
                    + (if $flow != "" and $net != "ws" and $net != "grpc" then {flow: $flow} else {} end)
                    + {"client-fingerprint": (if $fp != "" then $fp else "random" end)}
                    + (if ($alpn | length) > 0 then {alpn: $alpn} else {} end)
                    + (if $ech != "" then {"ech-opts": {enable: true, config: $ech}} else {} end)
                    + (if $shadow_tls_password != "" then
                            {"shadow-tls-opts": {
                                version: (if ($shadow_tls_version | test("^[0-9]+$")) then ($shadow_tls_version | tonumber) else 2 end),
                                password: $shadow_tls_password
                            }}
                        else {} end)
                    + (if $restls_password != "" then
                            {"restls-opts": (
                                {password: $restls_password}
                                + (if $restls_version_hint != "" then {"version-hint": $restls_version_hint} else {} end)
                                + (if $restls_script != "" then {"restls-script": $restls_script} else {} end)
                            )}
                        else {} end)
                    + (if $jls_password != "" then
                            {"jls-opts": (
                                {password: $jls_password}
                                + (if $jls_username != "" then {username: $jls_username} else {} end)
                            )}
                        else {} end)
                end)
            + (if $security == "reality" then
                    {"reality-opts": (
                        (if $pbk != "" then {"public-key": $pbk} else {} end)
                        + (if $sid != "" then {"short-id": $sid} else {} end)
                        + (if $spx != "" then {"spider-x": $spx} else {} end)
                        + (if $support_x25519mlkem768 == "1" then {"support-x25519mlkem768": true} else {} end)
                    )}
                else {} end)
            + (if $ss_enabled != "" and $ss_method != "" and $ss_password != "" then
                    {"ss-opts": {enabled: true, method: $ss_method, password: $ss_password}}
                else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}
