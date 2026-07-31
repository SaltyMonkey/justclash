#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_vless_url() {
    local link="$1" DEFAULT_TLS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5" routing_mark="$6" ip_version="$7"
    local raw="${link#vless://}"
    raw="${raw%%#*}"

    local uuid="${raw%%@*}"
    local hostport="${raw#*@}"
    local host="${hostport%%\?*}"
    local server
    server="$(str_url_decode "${host%%:*}")"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_TLS_PORT
    port="${port//[!0-9]/}"
    [ -z "$port" ] && port="$DEFAULT_TLS_PORT"

    local query_part=""
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local net="tcp" httpupgrade=0 sec="" sni="" fp="" alpn="" flow="" penc="" insecure=0
    local pbk="" sid="" spx="" sn="" grpc_ua="" enc="" ech="" path=""
    local grpc_ping_interval=""
    local transport_host="" xhttp_mode="" xhttp_extra=""
    local tfo_value=0 alpn_json proxy_obj xhttp_extra_json='{}'
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
        encryption) enc="$v" ;;
        sni) sni="$(str_url_decode "$v")" ;;
        host)
            transport_host="$(str_url_decode "$v")"
            ;;
        fp | client-fingerprint) fp="$v" ;;
        alpn) alpn="$(str_url_decode "$v")" ;;
        flow) flow="$v" ;;
        tfo) uri_is_truthy "$v" && tfo_value=1 ;;
        insecure | allowInsecure | skip-cert-verify | skipCertVerify) uri_is_truthy "$v" && insecure=1 ;;
        pbk | public-key) pbk="$v" ;;
        pinSHA256 | fingerprint) pin_sha256="$(str_url_decode "$v")" ;;
        name-cert-verify | nameCertVerify | peer) name_cert_verify="$(str_url_decode "$v")" ;;
        certificate) certificate="$(str_url_decode "$v")" ;;
        privateKey | private-key) private_key="$(str_url_decode "$v")" ;;
        shadow-tls-password | shadowTlsPassword) shadow_tls_password="$(str_url_decode "$v")" ;;
        shadow-tls-version | shadowTlsVersion) shadow_tls_version="$v" ;;
        restls-password | restlsPassword) restls_password="$(str_url_decode "$v")" ;;
        restls-version-hint | restlsVersionHint | restlsVersion) restls_version_hint="$v" ;;
        restls-script | restlsScript) restls_script="$(str_url_decode "$v")" ;;
        jls-username | jlsUsername | jlsUser) jls_username="$(str_url_decode "$v")" ;;
        jls-password | jlsPassword) jls_password="$(str_url_decode "$v")" ;;
        support-x25519mlkem768 | x25519mlkem768 | support-x25519-mlkem768) uri_is_truthy "$v" && support_x25519mlkem768=1 ;;
        sid | short-id) sid="$v" ;;
        spx)
            if [ -n "$v" ]; then
                spx="$(str_url_decode "$v")"
            else
                spx="/"
            fi
            ;;
        path)
            if [ -n "$v" ]; then
                path="$(str_url_decode "$v")"
            else
                path="/"
            fi
            ;;
        serviceName | service-name) sn="$(str_url_decode "$v")" ;;
        grpc-user-agent | grpcUserAgent) grpc_ua="$(str_url_decode "$v")" ;;
        ping-interval | pingInterval) grpc_ping_interval="${v//[!0-9]/}" ;;
        packetEncoding | packet-encoding) penc="$v" ;;
        ech) ech="$(str_url_decode "$v")" ;;
        mode) xhttp_mode="$(str_url_decode "$v")" ;;
        extra) xhttp_extra="$(str_url_decode "$v")" ;;
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

    alpn_json=$(uri_json_array_from_csv "$alpn") || return 1
    if [ -n "$xhttp_extra" ] && [ "$xhttp_extra" != "null" ]; then
        xhttp_extra_json="$(printf '%s' "$xhttp_extra" | jq -c 'if type == "object" then . else {} end' 2>/dev/null)"
        [ -n "$xhttp_extra_json" ] || xhttp_extra_json='{}'
    fi

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg uuid "$uuid" \
            --arg server "$server" \
            --arg encryption "${enc:-none}" \
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
            --arg flow "$flow" \
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
            --arg xhttp_mode "$xhttp_mode" \
            --argjson port "$port" \
            --argjson tfo "$tfo_value" \
            --argjson httpupgrade "$httpupgrade" \
            --argjson insecure "$insecure" \
            --argjson alpn "$alpn_json" \
            --argjson xhttp_extra "$xhttp_extra_json" '
            {
                name: $name,
                type: "vless",
                uuid: $uuid,
                server: $server,
                port: $port,
                encryption: $encryption,
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
            + (if $net == "tcp" and $flow != "" then {flow: $flow} else {} end)
            + (if $net == "ws" then
                    ($xhttp_extra | if type == "object" then . else {} end) as $xe
                    | {"ws-opts": (
                        {path: $path}
                        + (if $transport_host != "" or ($xe.headers // null) != null then
                                {headers: (
                                    (if $transport_host != "" then {Host: $transport_host} else {} end)
                                    + (if ($xe.headers // null) != null then $xe.headers else {} end)
                                )}
                           else {} end)
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
            + (if $net == "xhttp" then
                    ($xhttp_extra | if type == "object" then . else {} end) as $xe
                    | ($xe.xmux // $xe["reuse-settings"] // $xe.reuseSettings // {}) as $xmux
                    | {"xhttp-opts": (
                        {path: (
                            if $path != "" then
                                $path
                            elif (($xe.path // "") | tostring) != "" then
                                $xe.path
                            else
                                "/"
                            end
                        )}
                        + (if $transport_host != "" then
                                {host: $transport_host}
                           elif (($xe.host // "") | tostring) != "" then
                                {host: $xe.host}
                           else {} end)
                        + (if $xhttp_mode == "stream-one" or $xhttp_mode == "stream-up" or $xhttp_mode == "packet-up" then
                                {mode: $xhttp_mode}
                           elif $xhttp_mode == "auto" then
                                (if ($xe.mode // "") == "stream-one" or ($xe.mode // "") == "stream-up" or ($xe.mode // "") == "packet-up" then
                                        {mode: $xe.mode}
                                 elif $sec == "tls" then
                                        {mode: "stream-up"}
                                 elif $sec == "reality" then
                                        (if ($xe.downloadSettings // null) != null then {mode: "stream-up"} else {mode: "stream-one"} end)
                                 else
                                        {mode: "packet-up"}
                                 end)
                           elif ($xe.mode // "") == "stream-one" or ($xe.mode // "") == "stream-up" or ($xe.mode // "") == "packet-up" then
                                {mode: $xe.mode}
                           else {} end)
                        + (if ($xe.headers // null) != null then {headers: $xe.headers} else {} end)
                        + (if ($xe.noGRPCHeader // null) != null then {"no-grpc-header": $xe.noGRPCHeader}
                           elif ($xe["no-grpc-header"] // null) != null then {"no-grpc-header": $xe["no-grpc-header"]}
                           else {} end)
                        + (if (($xe.xPaddingBytes // "") | tostring) != "" then {"x-padding-bytes": $xe.xPaddingBytes}
                           elif (($xe["x-padding-bytes"] // "") | tostring) != "" then {"x-padding-bytes": $xe["x-padding-bytes"]}
                           else {} end)
                        + (if (($xe.scMaxEachPostBytes // "") | tostring) != "" then {"sc-max-each-post-bytes": $xe.scMaxEachPostBytes}
                           elif (($xe["sc-max-each-post-bytes"] // "") | tostring) != "" then {"sc-max-each-post-bytes": $xe["sc-max-each-post-bytes"]}
                           else {} end)
                        + (if (($xe.scMinPostsIntervalMs // "") | tostring) != "" then {"sc-min-posts-interval-ms": $xe.scMinPostsIntervalMs}
                           elif (($xe["sc-min-posts-interval-ms"] // "") | tostring) != "" then {"sc-min-posts-interval-ms": $xe["sc-min-posts-interval-ms"]}
                           else {} end)
                        + (if (($xe.sessionIDPlacement // "") | tostring) != "" then {"session-placement": $xe.sessionIDPlacement}
                           elif (($xe.sessionPlacement // "") | tostring) != "" then {"session-placement": $xe.sessionPlacement}
                           elif (($xe["session-placement"] // "") | tostring) != "" then {"session-placement": $xe["session-placement"]}
                           else {} end)
                        + (if (($xe.sessionIDKey // "") | tostring) != "" then {"session-key": $xe.sessionIDKey}
                           elif (($xe.sessionKey // "") | tostring) != "" then {"session-key": $xe.sessionKey}
                           elif (($xe["session-key"] // "") | tostring) != "" then {"session-key": $xe["session-key"]}
                           else {} end)
                        + (if (($xe.sessionIDTable // "") | tostring) != "" then {"session-table": $xe.sessionIDTable}
                           elif (($xe["session-table"] // "") | tostring) != "" then {"session-table": $xe["session-table"]}
                           else {} end)
                        + (if (($xe.sessionIDLength // "") | tostring) != "" then {"session-length": ($xe.sessionIDLength | tostring)}
                           elif (($xe["session-length"] // "") | tostring) != "" then {"session-length": ($xe["session-length"] | tostring)}
                           else {} end)
                         + (if ($xe.noSseHeader // null) != null then {"no-sse-header": $xe.noSseHeader}
                            elif ($xe["no-sse-header"] // null) != null then {"no-sse-header": $xe["no-sse-header"]}
                            else {} end)
                         + (if ($xe.xPaddingObfsMode // null) != null then {"x-padding-obfs-mode": $xe.xPaddingObfsMode}
                            elif ($xe["x-padding-obfs-mode"] // null) != null then {"x-padding-obfs-mode": $xe["x-padding-obfs-mode"]}
                            else {} end)
                         + (if (($xe.xPaddingKey // "") | tostring) != "" then {"x-padding-key": $xe.xPaddingKey}
                            elif (($xe["x-padding-key"] // "") | tostring) != "" then {"x-padding-key": $xe["x-padding-key"]}
                            else {} end)
                         + (if (($xe.xPaddingHeader // "") | tostring) != "" then {"x-padding-header": $xe.xPaddingHeader}
                            elif (($xe["x-padding-header"] // "") | tostring) != "" then {"x-padding-header": $xe["x-padding-header"]}
                            else {} end)
                         + (if (($xe.xPaddingPlacement // "") | tostring) != "" then {"x-padding-placement": $xe.xPaddingPlacement}
                            elif (($xe["x-padding-placement"] // "") | tostring) != "" then {"x-padding-placement": $xe["x-padding-placement"]}
                            else {} end)
                         + (if (($xe.xPaddingMethod // "") | tostring) != "" then {"x-padding-method": $xe.xPaddingMethod}
                            elif (($xe["x-padding-method"] // "") | tostring) != "" then {"x-padding-method": $xe["x-padding-method"]}
                            else {} end)
                         + (if (($xe.uplinkHTTPMethod // "") | tostring) != "" then {"uplink-http-method": $xe.uplinkHTTPMethod}
                            elif (($xe.uplinkHttpMethod // "") | tostring) != "" then {"uplink-http-method": $xe.uplinkHttpMethod}
                            elif (($xe["uplink-http-method"] // "") | tostring) != "" then {"uplink-http-method": $xe["uplink-http-method"]}
                            else {} end)
                         + (if (($xe.seqIDPlacement // "") | tostring) != "" then {"seq-placement": $xe.seqIDPlacement}
                            elif (($xe.seqPlacement // "") | tostring) != "" then {"seq-placement": $xe.seqPlacement}
                            elif (($xe["seq-placement"] // "") | tostring) != "" then {"seq-placement": $xe["seq-placement"]}
                            else {} end)
                         + (if (($xe.seqIDKey // "") | tostring) != "" then {"seq-key": $xe.seqIDKey}
                            elif (($xe.seqKey // "") | tostring) != "" then {"seq-key": $xe.seqKey}
                            elif (($xe["seq-key"] // "") | tostring) != "" then {"seq-key": $xe["seq-key"]}
                            else {} end)
                         + (if (($xe.uplinkDataPlacement // "") | tostring) != "" then {"uplink-data-placement": $xe.uplinkDataPlacement}
                            elif (($xe["uplink-data-placement"] // "") | tostring) != "" then {"uplink-data-placement": $xe["uplink-data-placement"]}
                            else {} end)
                         + (if (($xe.uplinkDataKey // "") | tostring) != "" then {"uplink-data-key": $xe.uplinkDataKey}
                            elif (($xe["uplink-data-key"] // "") | tostring) != "" then {"uplink-data-key": $xe["uplink-data-key"]}
                            else {} end)
                         + (if (($xe.uplinkChunkSize // "") | tostring) != "" then {"uplink-chunk-size": ($xe.uplinkChunkSize | tonumber)}
                            elif (($xe["uplink-chunk-size"] // "") | tostring) != "" then {"uplink-chunk-size": ($xe["uplink-chunk-size"] | tonumber)}
                            else {} end)
                         + (if (($xe.scMaxBufferedPosts // "") | tostring) != "" then {"sc-max-buffered-posts": ($xe.scMaxBufferedPosts | tonumber)}
                            elif (($xe["sc-max-buffered-posts"] // "") | tostring) != "" then {"sc-max-buffered-posts": ($xe["sc-max-buffered-posts"] | tonumber)}
                            else {} end)
                         + (if (($xe.scStreamUpServerSecs // "") | tostring) != "" then {"sc-stream-up-server-secs": $xe.scStreamUpServerSecs}
                            elif (($xe["sc-stream-up-server-secs"] // "") | tostring) != "" then {"sc-stream-up-server-secs": $xe["sc-stream-up-server-secs"]}
                            else {} end)
                        + (if ($xmux | type) == "object" and ($xmux | length) > 0 then
                                {"reuse-settings": (
                                    {}
                                    + (if (($xmux.maxConnections // "") | tostring) != "" then {"max-connections": $xmux.maxConnections} else {} end)
                                    + (if (($xmux.maxConcurrency // "") | tostring) != "" then {"max-concurrency": $xmux.maxConcurrency} else {} end)
                                    + (if (($xmux.cMaxReuseTimes // "") | tostring) != "" then {"c-max-reuse-times": $xmux.cMaxReuseTimes} else {} end)
                                    + (if (($xmux.hMaxRequestTimes // "") | tostring) != "" then {"h-max-request-times": $xmux.hMaxRequestTimes} else {} end)
                                    + (if (($xmux.hMaxReusableSecs // "") | tostring) != "" then {"h-max-reusable-secs": $xmux.hMaxReusableSecs} else {} end)
                                    + (if (($xmux.hKeepAlivePeriod // "") | tostring) != "" then {"h-keep-alive-period": ($xmux.hKeepAlivePeriod | tonumber)}
                                       elif (($xmux["h-keep-alive-period"] // "") | tostring) != "" then {"h-keep-alive-period": ($xmux["h-keep-alive-period"] | tonumber)}
                                       else {} end)
                                )}
                           else {} end)
                        + (if ($xe.downloadSettings // null) != null and (($xe.downloadSettings | type) == "object") then
                                ($xe.downloadSettings) as $ds
                                | ($ds.xhttpSettings // {}) as $dx
                                | ($dx.extra // {}) as $dxe
                                | ($ds.xmux // $ds["reuse-settings"] // $ds.reuseSettings // $dx.xmux // $dx["reuse-settings"] // $dx.reuseSettings // $dxe.xmux // $dxe["reuse-settings"] // $dxe.reuseSettings // {}) as $dsmux
                                | {"download-settings": (
                                    {}
                                    + (if (($ds.path // "") | tostring) != "" then {path: $ds.path}
                                       elif (($dx.path // "") | tostring) != "" then {path: $dx.path}
                                       else {} end)
                                    + (if (($ds.host // "") | tostring) != "" then {host: $ds.host}
                                       elif (($dx.host // "") | tostring) != "" then {host: $dx.host}
                                       else {} end)
                                    + (if ($ds.headers // null) != null then {headers: $ds.headers}
                                       elif ($dx.headers // null) != null then {headers: $dx.headers}
                                       else {} end)
                                    + (if ($dsmux | type) == "object" and ($dsmux | length) > 0 then
                                            {"reuse-settings": (
                                                {}
                                                + (if (($dsmux.maxConnections // "") | tostring) != "" then {"max-connections": $dsmux.maxConnections} else {} end)
                                                + (if (($dsmux.maxConcurrency // "") | tostring) != "" then {"max-concurrency": $dsmux.maxConcurrency} else {} end)
                                                + (if (($dsmux.cMaxReuseTimes // "") | tostring) != "" then {"c-max-reuse-times": $dsmux.cMaxReuseTimes} else {} end)
                                                + (if (($dsmux.hMaxRequestTimes // "") | tostring) != "" then {"h-max-request-times": $dsmux.hMaxRequestTimes} else {} end)
                                                + (if (($dsmux.hMaxReusableSecs // "") | tostring) != "" then {"h-max-reusable-secs": $dsmux.hMaxReusableSecs} else {} end)
                                                + (if (($dsmux.hKeepAlivePeriod // "") | tostring) != "" then {"h-keep-alive-period": ($dsmux.hKeepAlivePeriod | tonumber)}
                                                   elif (($dsmux["h-keep-alive-period"] // "") | tostring) != "" then {"h-keep-alive-period": ($dsmux["h-keep-alive-period"] | tonumber)}
                                                   else {} end)
                                            )}
                                       else {} end)
                                    + (if (($ds.server // "") | tostring) != "" then {server: $ds.server} else {} end)
                                    + (if (($ds.port // "") | tostring) != "" then {port: ($ds.port | tonumber)} else {} end)
                                    + (if ($ds.tls // null) != null then {tls: $ds.tls} else {} end)
                                    + (if ($ds.alpn // null) != null and (($ds.alpn | type) == "array") and (($ds.alpn | length) > 0) then {alpn: $ds.alpn} else {} end)
                                    + (if ($ds["ech-opts"] // null) != null then {"ech-opts": $ds["ech-opts"]}
                                       elif ($ds.echOpts // null) != null then {"ech-opts": $ds.echOpts}
                                       else {} end)
                                    + (if ($ds["reality-opts"] // null) != null then {"reality-opts": $ds["reality-opts"]}
                                       elif (($ds.pbk // "") | tostring) != "" or (($ds.publicKey // "") | tostring) != "" or (($ds.sid // "") | tostring) != "" or (($ds.shortId // "") | tostring) != "" or (($ds.spx // "") | tostring) != "" or (($ds.spiderX // "") | tostring) != "" then
                                            {"reality-opts": (
                                                (if (($ds.pbk // "") | tostring) != "" then {"public-key": $ds.pbk}
                                                 elif (($ds.publicKey // "") | tostring) != "" then {"public-key": $ds.publicKey}
                                                 else {} end)
                                                + (if (($ds.sid // "") | tostring) != "" then {"short-id": $ds.sid}
                                                   elif (($ds.shortId // "") | tostring) != "" then {"short-id": $ds.shortId}
                                                   else {} end)
                                                + (if (($ds.spx // "") | tostring) != "" then {"spider-x": $ds.spx}
                                                   elif (($ds.spiderX // "") | tostring) != "" then {"spider-x": $ds.spiderX}
                                                   else {} end)
                                            )}
                                       else {} end)
                                    + (if ($ds.skipCertVerify // null) != null then {"skip-cert-verify": $ds.skipCertVerify}
                                       elif ($ds["skip-cert-verify"] // null) != null then {"skip-cert-verify": $ds["skip-cert-verify"]}
                                       else {} end)
                                    + (if (($ds.fingerprint // "") | tostring) != "" then {fingerprint: $ds.fingerprint} else {} end)
                                    + (if (($ds.certificate // "") | tostring) != "" then {certificate: $ds.certificate} else {} end)
                                    + (if (($ds.privateKey // "") | tostring) != "" then {"private-key": $ds.privateKey}
                                       elif (($ds["private-key"] // "") | tostring) != "" then {"private-key": $ds["private-key"]}
                                       else {} end)
                                    + (if (($ds.servername // "") | tostring) != "" then {servername: $ds.servername} else {} end)
                                    + (if (($ds.clientFingerprint // "") | tostring) != "" then {"client-fingerprint": $ds.clientFingerprint}
                                       elif (($ds["client-fingerprint"] // "") | tostring) != "" then {"client-fingerprint": $ds["client-fingerprint"]}
                                       else {} end)
                                    + (if (($dxe.sessionIDPlacement // "") | tostring) != "" then {"session-placement": $dxe.sessionIDPlacement}
                                       elif (($dxe.sessionPlacement // "") | tostring) != "" then {"session-placement": $dxe.sessionPlacement}
                                       elif (($ds.sessionIDPlacement // "") | tostring) != "" then {"session-placement": $ds.sessionIDPlacement}
                                       elif (($ds.sessionPlacement // "") | tostring) != "" then {"session-placement": $ds.sessionPlacement}
                                       elif (($ds["session-placement"] // "") | tostring) != "" then {"session-placement": $ds["session-placement"]}
                                       else {} end)
                                    + (if (($dxe.sessionIDKey // "") | tostring) != "" then {"session-key": $dxe.sessionIDKey}
                                       elif (($dxe.sessionKey // "") | tostring) != "" then {"session-key": $dxe.sessionKey}
                                       elif (($ds.sessionIDKey // "") | tostring) != "" then {"session-key": $ds.sessionIDKey}
                                       elif (($ds.sessionKey // "") | tostring) != "" then {"session-key": $ds.sessionKey}
                                       elif (($ds["session-key"] // "") | tostring) != "" then {"session-key": $ds["session-key"]}
                                       else {} end)
                                    + (if (($dxe.sessionIDTable // "") | tostring) != "" then {"session-table": $dxe.sessionIDTable}
                                       elif (($ds.sessionIDTable // "") | tostring) != "" then {"session-table": $ds.sessionIDTable}
                                       elif (($ds["session-table"] // "") | tostring) != "" then {"session-table": $ds["session-table"]}
                                       else {} end)
                                    + (if (($dxe.sessionIDLength // "") | tostring) != "" then {"session-length": ($dxe.sessionIDLength | tostring)}
                                       elif (($ds.sessionIDLength // "") | tostring) != "" then {"session-length": ($ds.sessionIDLength | tostring)}
                                       elif (($ds["session-length"] // "") | tostring) != "" then {"session-length": ($ds["session-length"] | tostring)}
                                       else {} end)
                                    + (if ($dxe.noSseHeader // null) != null then {"no-sse-header": $dxe.noSseHeader}
                                       elif ($ds.noSseHeader // null) != null then {"no-sse-header": $ds.noSseHeader}
                                       elif ($ds["no-sse-header"] // null) != null then {"no-sse-header": $ds["no-sse-header"]}
                                       else {} end)
                                    + (if ($dxe.xPaddingObfsMode // null) != null then {"x-padding-obfs-mode": $dxe.xPaddingObfsMode}
                                       elif ($ds.xPaddingObfsMode // null) != null then {"x-padding-obfs-mode": $ds.xPaddingObfsMode}
                                       elif ($ds["x-padding-obfs-mode"] // null) != null then {"x-padding-obfs-mode": $ds["x-padding-obfs-mode"]}
                                       else {} end)
                                    + (if (($dxe.xPaddingKey // "") | tostring) != "" then {"x-padding-key": $dxe.xPaddingKey}
                                       elif (($ds.xPaddingKey // "") | tostring) != "" then {"x-padding-key": $ds.xPaddingKey}
                                       elif (($ds["x-padding-key"] // "") | tostring) != "" then {"x-padding-key": $ds["x-padding-key"]}
                                       else {} end)
                                    + (if (($dxe.xPaddingHeader // "") | tostring) != "" then {"x-padding-header": $dxe.xPaddingHeader}
                                       elif (($ds.xPaddingHeader // "") | tostring) != "" then {"x-padding-header": $ds.xPaddingHeader}
                                       elif (($ds["x-padding-header"] // "") | tostring) != "" then {"x-padding-header": $ds["x-padding-header"]}
                                       else {} end)
                                    + (if (($dxe.xPaddingPlacement // "") | tostring) != "" then {"x-padding-placement": $dxe.xPaddingPlacement}
                                       elif (($ds.xPaddingPlacement // "") | tostring) != "" then {"x-padding-placement": $ds.xPaddingPlacement}
                                       elif (($ds["x-padding-placement"] // "") | tostring) != "" then {"x-padding-placement": $ds["x-padding-placement"]}
                                       else {} end)
                                    + (if (($dxe.xPaddingMethod // "") | tostring) != "" then {"x-padding-method": $dxe.xPaddingMethod}
                                       elif (($ds.xPaddingMethod // "") | tostring) != "" then {"x-padding-method": $ds.xPaddingMethod}
                                       elif (($ds["x-padding-method"] // "") | tostring) != "" then {"x-padding-method": $ds["x-padding-method"]}
                                       else {} end)
                                    + (if (($dxe.uplinkHTTPMethod // "") | tostring) != "" then {"uplink-http-method": $dxe.uplinkHTTPMethod}
                                       elif (($dxe.uplinkHttpMethod // "") | tostring) != "" then {"uplink-http-method": $dxe.uplinkHttpMethod}
                                       elif (($ds.uplinkHTTPMethod // "") | tostring) != "" then {"uplink-http-method": $ds.uplinkHTTPMethod}
                                       elif (($ds.uplinkHttpMethod // "") | tostring) != "" then {"uplink-http-method": $ds.uplinkHttpMethod}
                                       elif (($ds["uplink-http-method"] // "") | tostring) != "" then {"uplink-http-method": $ds["uplink-http-method"]}
                                       else {} end)
                                    + (if (($dxe.seqIDPlacement // "") | tostring) != "" then {"seq-placement": $dxe.seqIDPlacement}
                                       elif (($dxe.seqPlacement // "") | tostring) != "" then {"seq-placement": $dxe.seqPlacement}
                                       elif (($ds.seqIDPlacement // "") | tostring) != "" then {"seq-placement": $ds.seqIDPlacement}
                                       elif (($ds.seqPlacement // "") | tostring) != "" then {"seq-placement": $ds.seqPlacement}
                                       elif (($ds["seq-placement"] // "") | tostring) != "" then {"seq-placement": $ds["seq-placement"]}
                                       else {} end)
                                    + (if (($dxe.seqIDKey // "") | tostring) != "" then {"seq-key": $dxe.seqIDKey}
                                       elif (($dxe.seqKey // "") | tostring) != "" then {"seq-key": $dxe.seqKey}
                                       elif (($ds.seqIDKey // "") | tostring) != "" then {"seq-key": $ds.seqIDKey}
                                       elif (($ds.seqKey // "") | tostring) != "" then {"seq-key": $ds.seqKey}
                                       elif (($ds["seq-key"] // "") | tostring) != "" then {"seq-key": $ds["seq-key"]}
                                       else {} end)
                                    + (if (($dxe.uplinkDataPlacement // "") | tostring) != "" then {"uplink-data-placement": $dxe.uplinkDataPlacement}
                                       elif (($ds.uplinkDataPlacement // "") | tostring) != "" then {"uplink-data-placement": $ds.uplinkDataPlacement}
                                       elif (($ds["uplink-data-placement"] // "") | tostring) != "" then {"uplink-data-placement": $ds["uplink-data-placement"]}
                                       else {} end)
                                    + (if (($dxe.uplinkDataKey // "") | tostring) != "" then {"uplink-data-key": $dxe.uplinkDataKey}
                                       elif (($ds.uplinkDataKey // "") | tostring) != "" then {"uplink-data-key": $ds.uplinkDataKey}
                                       elif (($ds["uplink-data-key"] // "") | tostring) != "" then {"uplink-data-key": $ds["uplink-data-key"]}
                                       else {} end)
                                    + (if (($dxe.uplinkChunkSize // "") | tostring) != "" then {"uplink-chunk-size": ($dxe.uplinkChunkSize | tonumber)}
                                       elif (($ds.uplinkChunkSize // "") | tostring) != "" then {"uplink-chunk-size": ($ds.uplinkChunkSize | tonumber)}
                                       elif (($ds["uplink-chunk-size"] // "") | tostring) != "" then {"uplink-chunk-size": ($ds["uplink-chunk-size"] | tonumber)}
                                       else {} end)
                                    + (if (($dxe.scMaxBufferedPosts // "") | tostring) != "" then {"sc-max-buffered-posts": ($dxe.scMaxBufferedPosts | tonumber)}
                                       elif (($ds.scMaxBufferedPosts // "") | tostring) != "" then {"sc-max-buffered-posts": ($ds.scMaxBufferedPosts | tonumber)}
                                       elif (($ds["sc-max-buffered-posts"] // "") | tostring) != "" then {"sc-max-buffered-posts": ($ds["sc-max-buffered-posts"] | tonumber)}
                                       else {} end)
                                    + (if (($dxe.scStreamUpServerSecs // "") | tostring) != "" then {"sc-stream-up-server-secs": $dxe.scStreamUpServerSecs}
                                       elif (($ds.scStreamUpServerSecs // "") | tostring) != "" then {"sc-stream-up-server-secs": $ds.scStreamUpServerSecs}
                                       elif (($ds["sc-stream-up-server-secs"] // "") | tostring) != "" then {"sc-stream-up-server-secs": $ds["sc-stream-up-server-secs"]}
                                       else {} end)
                                    + (if (($dxe.scMaxEachPostBytes // "") | tostring) != "" then {"sc-max-each-post-bytes": $dxe.scMaxEachPostBytes}
                                       elif (($ds.scMaxEachPostBytes // "") | tostring) != "" then {"sc-max-each-post-bytes": $ds.scMaxEachPostBytes}
                                       elif (($ds["sc-max-each-post-bytes"] // "") | tostring) != "" then {"sc-max-each-post-bytes": $ds["sc-max-each-post-bytes"]}
                                       else {} end)
                                    + (if (($dxe.scMinPostsIntervalMs // "") | tostring) != "" then {"sc-min-posts-interval-ms": $dxe.scMinPostsIntervalMs}
                                       elif (($ds.scMinPostsIntervalMs // "") | tostring) != "" then {"sc-min-posts-interval-ms": $ds.scMinPostsIntervalMs}
                                       elif (($ds["sc-min-posts-interval-ms"] // "") | tostring) != "" then {"sc-min-posts-interval-ms": $ds["sc-min-posts-interval-ms"]}
                                       else {} end)
                                )}
                           else {} end)
                    )}
                else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}

# Parse vmess:// URI (VMessAEAD format: vmess://uuid@host:port?security=...&type=...)
