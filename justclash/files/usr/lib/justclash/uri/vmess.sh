#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_vmess_url() {
    local link="$1" DEFAULT_TLS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5" routing_mark="$6" ip_version="$7"
    local body="${link#vmess://}"
    body="${body%%#*}"

    local raw="$body"
    local uuid="${raw%%@*}"
    local hostport="${raw#*@}"
    local host="${hostport%%\?*}"
    local server
    server="$(url_decode "${host%%:*}")"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_TLS_PORT
    port="${port//[!0-9]/}"
    [ -z "$port" ] && port="$DEFAULT_TLS_PORT"

    local query_part=""
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local net="tcp" httpupgrade=0 sec="" sni="" fp="" alpn="" penc="" insecure=0
    local pbk="" sid="" spx="" sn="" grpc_ua="" enc="" ech="" path=""
    local grpc_ping_interval=""
    local transport_host=""
    local tfo_value=0 alpn_json proxy_obj
    local tls_servername=""
    local pin_sha256="" name_cert_verify="" certificate="" private_key=""
    local shadow_tls_password="" shadow_tls_version=""
    local restls_password="" restls_version_hint="" restls_script=""
    local jls_username="" jls_password=""
    local support_x25519mlkem768=""

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        case "$k" in
        type)
            if [ "$v" = "httpupgrade" ]; then
                net="ws"
                httpupgrade=1
            else
                net="$v"
            fi
            ;;
        security) sec="$v" ;;
        encryption | cipher) enc="$v" ;;
        sni) sni="$(url_decode "$v")" ;;
        host)
            transport_host="$(url_decode "$v")"
            ;;
        fp | client-fingerprint) fp="$v" ;;
        alpn) alpn="$(url_decode "$v")" ;;
        tfo) is_truthy "$v" && tfo_value=1 ;;
        insecure | allowInsecure | skip-cert-verify | skipCertVerify) is_truthy "$v" && insecure=1 ;;
        pbk | public-key) pbk="$v" ;;
        pinSHA256 | fingerprint) pin_sha256="$(url_decode "$v")" ;;
        name-cert-verify | nameCertVerify | peer) name_cert_verify="$(url_decode "$v")" ;;
        certificate) certificate="$(url_decode "$v")" ;;
        privateKey | private-key) private_key="$(url_decode "$v")" ;;
        shadow-tls-password | shadowTlsPassword) shadow_tls_password="$(url_decode "$v")" ;;
        shadow-tls-version | shadowTlsVersion) shadow_tls_version="$v" ;;
        restls-password | restlsPassword) restls_password="$(url_decode "$v")" ;;
        restls-version-hint | restlsVersionHint | restlsVersion) restls_version_hint="$v" ;;
        restls-script | restlsScript) restls_script="$(url_decode "$v")" ;;
        jls-username | jlsUsername | jlsUser) jls_username="$(url_decode "$v")" ;;
        jls-password | jlsPassword) jls_password="$(url_decode "$v")" ;;
        support-x25519mlkem768 | x25519mlkem768 | support-x25519-mlkem768) is_truthy "$v" && support_x25519mlkem768=1 ;;
        sid | short-id) sid="$v" ;;
        spx)
            if [ -n "$v" ]; then
                spx="$(url_decode "$v")"
            else
                spx="/"
            fi
            ;;
        path)
            if [ -n "$v" ]; then
                path="$(url_decode "$v")"
            else
                path="/"
            fi
            ;;
        serviceName | service-name) sn="$(url_decode "$v")" ;;
        grpc-user-agent | grpcUserAgent) grpc_ua="$(url_decode "$v")" ;;
        ping-interval | pingInterval) grpc_ping_interval="${v//[!0-9]/}" ;;
        packetEncoding | packet-encoding) penc="$v" ;;
        ech) ech="$(url_decode "$v")" ;;
        esac
    done

    if [ -n "$path" ]; then
        case "$path" in
        /*) ;;
        *) path="/$path" ;;
        esac
    fi

    tls_servername="$sni"
    if [ -z "$tls_servername" ] && [ "$net" = "ws" ] && [ -n "$transport_host" ]; then
        tls_servername="$transport_host"
    fi

    if [ "$net" = "grpc" ] && [ -z "$sn" ]; then
        sn="/"
    fi

    alpn_json=$(json_array_from_csv "$alpn") || return 1

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg uuid "$uuid" \
            --arg server "$server" \
            --arg cipher "${enc:-auto}" \
            --arg net "$net" \
            --arg penc "$penc" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --arg routing_mark "$routing_mark" \
            --arg ip_version "$ip_version" \
            --arg sec "$sec" \
            --arg sni "$tls_servername" \
            --arg fp "$fp" \
            --arg pbk "$pbk" \
            --arg sid "$sid" \
            --arg spx "${spx:-/}" \
            --arg path "${path:-/}" \
            --arg ech "$ech" \
            --arg pin_sha256 "$pin_sha256" \
            --arg name_cert_verify "$name_cert_verify" \
            --arg certificate "$certificate" \
            --arg private_key "$private_key" \
            --arg shadow_tls_password "$shadow_tls_password" \
            --arg shadow_tls_version "$shadow_tls_version" \
            --arg restls_password "$restls_password" \
            --arg restls_version_hint "$restls_version_hint" \
            --arg restls_script "$restls_script" \
            --arg jls_username "$jls_username" \
            --arg jls_password "$jls_password" \
            --arg support_x25519mlkem768 "$support_x25519mlkem768" \
            --arg sn "$sn" \
            --arg grpc_ua "$grpc_ua" \
            --arg grpc_ping_interval "$grpc_ping_interval" \
            --arg transport_host "$transport_host" \
            --argjson port "$port" \
            --argjson tfo "$tfo_value" \
            --argjson httpupgrade "$httpupgrade" \
            --argjson insecure "$insecure" \
            --argjson alpn "$alpn_json" '
            {
                name: $name,
                type: "vmess",
                uuid: $uuid,
                server: $server,
                port: $port,
                alterId: 0,
                cipher: (if $cipher != "" then $cipher else "auto" end),
                network: $net,
                udp: true
            }
            + (if $penc == "none" then {}
               elif $penc == "packet" then {"packet-addr": true}
               else {xudp: true} end)
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
            + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
            + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
            + (if $tfo == 1 then {tfo: true} else {} end)
            + (if $sec == "tls" or $sec == "reality" or $shadow_tls_password != "" or $restls_password != "" or $jls_password != "" then
                    {tls: true}
                    + (if $sni != "" then {servername: $sni} else {} end)
                    + (if $insecure == 1 then {"skip-cert-verify": true} else {} end)
                    + (if $name_cert_verify != "" then {"name-cert-verify": $name_cert_verify} else {} end)
                    + (if $pin_sha256 != "" then {fingerprint: $pin_sha256} else {} end)
                    + (if $certificate != "" then {certificate: $certificate} else {} end)
                    + (if $private_key != "" then {"private-key": $private_key} else {} end)
                    + {"client-fingerprint": (if $fp != "" then $fp else "random" end)}
                    + (if ($alpn | length) > 0 then {alpn: $alpn} else {} end)
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
                else {} end)
            + (if $sec == "reality" then
                    {"reality-opts": (
                        (if $pbk != "" then {"public-key": $pbk} else {} end)
                        + (if $sid != "" then {"short-id": $sid} else {} end)
                        + (if $spx != "" then {"spider-x": $spx} else {} end)
                        + (if $support_x25519mlkem768 == "1" then {"support-x25519mlkem768": true} else {} end)
                    )}
                else {} end)
            + (if $ech != "" then {"ech-opts": {enable: true, config: $ech}} else {} end)
            + (if $net == "ws" then
                    {"ws-opts": (
                        {path: $path}
                        + (if $transport_host != "" then {headers: {Host: $transport_host}} else {} end)
                        + (if $httpupgrade == 1 then {"v2ray-http-upgrade": true} else {} end)
                    )}
                else {} end)
            + (if $net == "grpc" then
                    {"grpc-opts": (
                        {"grpc-service-name": $sn}
                        + (if $grpc_ua != "" then {"grpc-user-agent": $grpc_ua} else {} end)
                        + (if $grpc_ping_interval != "" then {"ping-interval": ($grpc_ping_interval | tonumber)} else {} end)
                    )}
                else {} end)
            + (if $net == "h2" then
                    {"h2-opts": (
                        {path: $path}
                        + (if $transport_host != "" then {host: [$transport_host]} else {} end)
                    )}
                else {} end)
            + (if $net == "http" then
                    {"http-opts": (
                        {path: [$path]}
                        + (if $transport_host != "" then {headers: {Host: [$transport_host]}} else {} end)
                    )}
                else {} end)
        '
    ) || return 1
    printf '%s' "$proxy_obj"
}
