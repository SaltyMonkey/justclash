#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------
# External justclash parsers/generators part
# --------------------------------------------

parse_sudoku_url() {
    local link="$1" dialer_proxy="$2" name="$3" interface_name="$4"
    local padding_min="${5:-5}" padding_max="${6:-15}"
    local raw payload

    raw="$link"
    raw="${raw#sudoku://}"

    payload="$(printf '%s' "$raw" | base64 -d 2>/dev/null)" || {
        echo "Error: failed to decode sudoku:// link" >&2
        return 1
    }

    echo "$payload" | jq -c \
        --arg name "$name" \
        --arg dialer_proxy "$dialer_proxy" \
        --arg interface_name "$interface_name" \
        --argjson padding_min "$padding_min" \
        --argjson padding_max "$padding_max" '

    {
        name: $name,
        type: "sudoku",
        server: .h,
        port: .p,
        key: .k,
        udp: true
    }

    # aead-method (default: chacha20-poly1305)
    + (if (.e? and (.e | length > 0))
        then {"aead-method": .e}
        else {"aead-method": "chacha20-poly1305"}
      end)

    # table-type supports symmetric and directional upstream modes.
    + {
        "table-type": (
          if (.a? and (.a != null)) then
            (
              .a
              | tostring
              | ascii_downcase
              | if . == "ascii" or . == "prefer_ascii" then
                    "prefer_ascii"
                elif . == "entropy" or . == "prefer_entropy" or . == "" then
                    "prefer_entropy"
                elif . == "up_ascii_down_entropy" or . == "up_entropy_down_ascii" then
                    .
                elif . == "up_prefer_ascii_down_prefer_entropy" then
                    "up_ascii_down_entropy"
                elif . == "up_prefer_entropy_down_prefer_ascii" then
                    "up_entropy_down_ascii"
                else
                    .
                end
            )
          else
            "prefer_entropy"
          end
        )
      }

    # padding
    + {
        "padding-min": $padding_min,
        "padding-max": $padding_max
      }

    # custom-tables
    + (if (.ts? and (.ts | type == "array") and (.ts | length > 0))
        then {"custom-tables": .ts}
        else {}
      end)

    # custom-table
    + (if ((.ts? | not) or (.ts | length == 0)) and (.t? and (.t | length > 0))
        then {"custom-table": .t}
        else {}
      end)

    # enable-pure-downlink = NOT(PackedDownlink)
    + (if (.x? != null)
        then {"enable-pure-downlink": (.x | not)}
        else {"enable-pure-downlink": true}
      end)

    # httpmask object (upstream style)
    + (if (.hd? != null) or (.hm? and (.hm | length > 0)) or (.ht? != null) or (.hh? and (.hh | length > 0)) or (.hx? and (.hx | length > 0)) or (.hy? and (.hy | length > 0))
        then {"httpmask": (
            {}
            + (if (.hd? != null) then {disable: .hd} else {} end)
            + (if (.hm? and (.hm | length > 0)) then {mode: .hm} else {} end)
            + (if (.ht? != null) then {tls: .ht} else {} end)
            + (if (.hh? and (.hh | length > 0)) then {host: .hh} else {} end)
            + (if (.hy? and (.hy | length > 0)) then {"path-root": .hy} else {} end)
            + (if (.hx? and (.hx | length > 0)) then {multiplex: .hx} else {} end)
        )}
        else {}
      end)

    # dialer-proxy
    + (if ($dialer_proxy | length > 0)
        then {"dialer-proxy": $dialer_proxy}
        else {}
      end)
    + (if ($interface_name | length > 0)
        then {"interface-name": $interface_name}
        else {}
      end)
    '
}

is_uint() {
    case "$1" in
        ''|*[!0-9]*) return 1 ;;
        *) return 0 ;;
    esac
}

require_uint() {
    is_uint "$1" || {
        echo "Error: expected unsigned integer, got '$1'" >&2
        return 1
    }
}

is_truthy() {
    case "$1" in
        1|true|TRUE|True|yes|YES|on|ON) return 0 ;;
        *) return 1 ;;
    esac
}

json_array_from_csv() {
    local value="$1"

    if [ -z "$value" ]; then
        echo '[]'
        return 0
    fi

    printf '%s' "$value" | jq -Rc '
        split(",")
        | map(gsub("^\\s+|\\s+$"; ""))
        | map(select(length > 0))
    '
}

parse_ss_url() {
    local link="${1#ss://}" DEFAULT_SOCKS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5"
    local userinfo hostport method password server port decoded query_part proxy_obj
    query_part=""

    # shellcheck disable=SC2249
    case "$link" in *\?*) query_part="${link#*\?}"; link="${link%%\?*}"; esac

    if echo "$link" | grep -q '@'; then
        userinfo="${link%@*}"
        hostport="${link#*@}"

        # Проверяем, начинается ли с 2022- (plain text)
        if echo "$userinfo" | grep -q '^2022-'; then
            # Plain text format для 2022 ciphers
            method="${userinfo%%:*}"
            local pass_part="${userinfo#*:}"

            # Проверяем наличие второго пароля (EIH)
            if echo "$pass_part" | grep -q ':.*:'; then
                # Формат: method:serverPass:clientPass
                password="${pass_part}"
            else
                password="${pass_part}"
            fi
        else
            # Пробуем base64
            decoded="$(echo "$userinfo" | base64 -d 2>/dev/null)"
            if [ -n "$decoded" ] && echo "$decoded" | grep -q ':'; then
                method="$(url_decode "${decoded%%:*}")"
                password="$(url_decode "${decoded#*:}")"
            else
                # Plain text fallback
                method="$(url_decode "${userinfo%%:*}")"
                password="$(url_decode "${userinfo#*:}")"
            fi
        fi
    else
        # Полностью base64-encoded
        decoded="$(echo "$link" | base64 -d 2>/dev/null)"
        userinfo="${decoded%@*}"
        hostport="${decoded#*@}"
        method="$(url_decode "${userinfo%%:*}")"
        password="$(url_decode "${userinfo#*:}")"
    fi

    server="$(url_decode "${hostport%%:*}")"
    port="${hostport##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_SOCKS_PORT
    port=$(echo "$port" | tr -cd '0-9')
    [ -z "$port" ] && port="$DEFAULT_SOCKS_PORT"

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg cipher "$method" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --argjson port "$port" '
            {
                name: $name,
                type: "ss",
                udp: true,
                server: $server,
                port: $port,
                cipher: $cipher,
                password: $password
            }
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}

parse_simple_proxy_url() {
    local link="$1" DEFAULT_SOCKS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5"
    local raw="$link"
    raw="${raw#socks://}"
    raw="${raw#socks5://}"

    local server="" port="" username="" password=""
    local userinfo="" hostport="" proxy_obj

    if echo "$raw" | grep -q '@'; then
        userinfo="${raw%@*}"
        hostport="${raw#*@}"

        if echo "$userinfo" | grep -q ':'; then
            username="$(url_decode "${userinfo%%:*}")"
            password="$(url_decode "${userinfo#*:}")"
        else
            username="$(url_decode "$userinfo")"
        fi
    else
        hostport="$raw"
    fi

    # host:port
    server="$(url_decode "${hostport%%:*}")"

    port="${hostport##*:}"
    [ -z "$port" ] && port="$DEFAULT_SOCKS_PORT"
    port=$(echo "$port" | tr -cd '0-9')
    [ -z "$port" ] && port="$DEFAULT_SOCKS_PORT"

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg username "$username" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
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
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}

parse_trojan_url() {
    local url="$1" DEFAULT_TLS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5"

    local raw="${url#trojan://}"
    raw="${raw#trojan-go://}"
    raw="${raw%%#*}"

    local userinfo="${raw%@*}"
    local hostport="${raw#*@}"
    local password="$(printf '%b' "$(echo "$userinfo" | sed 's/%\(..\)/\\x\1/g')")"

    local host="${hostport%%\?*}"
    local server="$(url_decode "${host%%:*}")"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port="$DEFAULT_TLS_PORT"
    port=$(echo "$port" | tr -cd '0-9')
    [ -z "$port" ] && port="$DEFAULT_TLS_PORT"

    local query_part=""
    # shellcheck disable=SC2249
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local sni="" insecure=0 net="tcp" httpupgrade=0 fp="" alpn="" ws_path="" ws_host="" grpc_service="" grpc_ua="" grpc_ping_interval=""
    local ss_enabled="" ss_method="" ss_password=""
    local security="" pbk="" sid="" spx="" ech=""
    local alpn_json proxy_obj

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        # shellcheck disable=SC2249
        case "$k" in
            sni|peer) sni="$(url_decode "$v")" ;;
            insecure|allowInsecure) is_truthy "$v" && insecure=1 ;;
            type)
                if [ "$v" = "httpupgrade" ]; then
                    net="ws"
                    httpupgrade=1
                else
                    net="$v"
                fi ;;
            security) security="$v" ;;
            pbk|public-key) pbk="$v" ;;
            sid|short-id) sid="$v" ;;
            spx) spx="$(url_decode "$v")" ;;
            ech) ech="$(url_decode "$v")" ;;
            fp|client-fingerprint) fp="$v" ;;
            alpn) alpn="$(url_decode "$v")" ;;
            path)
                if [ -n "$v" ]; then
                    ws_path="$(url_decode "$v")"
                else
                    ws_path="/"
                fi ;;
            host) ws_host="$(url_decode "$v")" ;;
            serviceName|service-name) grpc_service="$v" ;;
            grpc-user-agent|grpcUserAgent) grpc_ua="$(url_decode "$v")" ;;
            ping-interval|pingInterval) grpc_ping_interval="$(echo "$v" | tr -cd '0-9')" ;;
            ss) ss_enabled="$v" ;;
            ss-method) ss_method="$v" ;;
            ss-password) ss_password="$v" ;;
        esac
    done

    if [ "$net" = "grpc" ] && [ -z "$grpc_service" ]; then
        grpc_service="/"
    fi

    alpn_json=$(json_array_from_csv "$alpn") || return 1

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
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
            --arg ss_method "$ss_method" \
            --arg ss_password "$ss_password" \
            --arg ss_enabled "$ss_enabled" \
            --argjson port "$port" \
            --argjson httpupgrade "$httpupgrade" \
            --argjson insecure "$insecure" \
            --argjson alpn "$alpn_json" '
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
            + (if $sni != "" then {sni: $sni} else {} end)
            + (if $insecure == 1 then {"skip-cert-verify": true} else {} end)
            + (if $fp != "" then {"client-fingerprint": $fp} else {} end)
            + (if ($alpn | length) > 0 then {alpn: $alpn} else {} end)
            + (if $net == "ws" then
                    {"ws-opts": (
                        {path: $ws_path}
                        + (if $ws_host != "" then {headers: {Host: $ws_host}} else {} end)
                        + (if $httpupgrade == 1 then {"v2ray-http-upgrade": true} else {} end)
                    )}
                else {} end)
            + (if $net == "grpc" then
                    {"grpc-opts": (
                        {"grpc-service-name": $grpc_service}
                        + (if $grpc_ua != "" then {"grpc-user-agent": $grpc_ua} else {} end)
                        + (if $grpc_ping_interval != "" then {"ping-interval": ($grpc_ping_interval | tonumber)} else {} end)
                    )}
                else {} end)
            + (if $security == "reality" then
                    {"reality-opts": (
                        (if $pbk != "" then {"public-key": $pbk} else {} end)
                        + (if $sid != "" then {"short-id": $sid} else {} end)
                        + (if $spx != "" then {"spider-x": $spx} else {} end)
                    )}
                else {} end)
            + (if $ech != "" then {"ech-opts": {enable: true, config: $ech}} else {} end)
            + (if $ss_enabled != "" and $ss_method != "" and $ss_password != "" then
                    {"ss-opts": {enabled: true, method: $ss_method, password: $ss_password}}
                else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}

parse_vless_url() {
    local link="$1" DEFAULT_TLS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5"
    local raw="${link#vless://}"
    raw="${raw%%#*}"

    local uuid="${raw%%@*}"
    local hostport="${raw#*@}"
    local host="${hostport%%\?*}"
    local server="$(url_decode "${host%%:*}")"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_TLS_PORT
    port=$(echo "$port" | tr -cd '0-9')
    [ -z "$port" ] && port="$DEFAULT_TLS_PORT"

    local query_part=""
    # shellcheck disable=SC2249
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local net="tcp" httpupgrade=0 sec="" sni="" fp="" alpn="" flow="" penc="" insecure=0
    local pbk="" sid="" spx="" sn="" grpc_ua="" enc="" ech="" path=""
    local grpc_ping_interval=""
    local transport_host="" xhttp_mode="" xhttp_extra=""
    local tfo_value=0 alpn_json proxy_obj xhttp_extra_json='{}'
    local tls_servername=""

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        # shellcheck disable=SC2249
        case "$k" in
            type)
                if [ "$v" = "httpupgrade" ]; then
                    net="ws"
                    httpupgrade=1
                else
                    net="$v"
                fi ;;
            security) sec="$v" ;;
            encryption) enc="$v" ;;
            sni) sni="$(url_decode "$v")" ;;
            host)
                transport_host="$(url_decode "$v")" ;;
            fp|client-fingerprint) fp="$v" ;;
            alpn) alpn="$(url_decode "$v")" ;;
            flow) flow="$v" ;;
            tfo) is_truthy "$v" && tfo_value=1 ;;
            insecure|allowInsecure) is_truthy "$v" && insecure=1 ;;
            pbk|public-key) pbk="$v" ;;
            sid|short-id) sid="$v" ;;
            spx)
                if [ -n "$v" ]; then
                    spx="$(url_decode "$v")"
                else
                    spx="/"
                fi ;;
            path)
                if [ -n "$v" ]; then
                    path="$(url_decode "$v")"
                else
                    path="/"
                fi ;;
            serviceName|service-name) sn="$v" ;;
            grpc-user-agent|grpcUserAgent) grpc_ua="$(url_decode "$v")" ;;
            ping-interval|pingInterval) grpc_ping_interval="$(echo "$v" | tr -cd '0-9')" ;;
            packetEncoding|packet-encoding) penc="$v" ;;
            ech) ech="$(url_decode "$v")" ;;
            mode) xhttp_mode="$(url_decode "$v")" ;;
            extra) xhttp_extra="$(url_decode "$v")" ;;
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
            --arg sec "$sec" \
            --arg sni "$tls_servername" \
            --arg fp "$fp" \
            --arg pbk "$pbk" \
            --arg sid "$sid" \
            --arg spx "${spx:-/}" \
            --arg path "${path:-/}" \
            --arg ech "$ech" \
            --arg flow "$flow" \
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
            + (if $penc != "" then {"packet-encoding": $penc} else {} end)
            + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
            + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
            + (if $tfo == 1 then {tfo: true} else {} end)
            + (if $sec == "tls" or $sec == "reality" then
                    {tls: true}
                    + (if $sni != "" then {servername: $sni} else {} end)
                    + (if $insecure == 1 then {"skip-cert-verify": true} else {} end)
                    + (if $fp != "" then {"client-fingerprint": $fp} else {} end)
                    + (if ($alpn | length) > 0 then {alpn: $alpn} else {} end)
                else {} end)
            + (if $sec == "reality" then
                    {"reality-opts": (
                        (if $pbk != "" then {"public-key": $pbk} else {} end)
                        + (if $sid != "" then {"short-id": $sid} else {} end)
                        + (if $spx != "" then {"spider-x": $spx} else {} end)
                    )}
                else {} end)
            + (if $ech != "" then {"ech-opts": {enable: true, config: $ech}} else {} end)
            + (if $net == "tcp" and $flow != "" then {flow: $flow} else {} end)
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
                        + (if ($xmux | type) == "object" and ($xmux | length) > 0 then
                                {"reuse-settings": (
                                    {}
                                    + (if (($xmux.maxConnections // "") | tostring) != "" then {"max-connections": $xmux.maxConnections} else {} end)
                                    + (if (($xmux.maxConcurrency // "") | tostring) != "" then {"max-concurrency": $xmux.maxConcurrency} else {} end)
                                    + (if (($xmux.cMaxReuseTimes // "") | tostring) != "" then {"c-max-reuse-times": $xmux.cMaxReuseTimes} else {} end)
                                    + (if (($xmux.hMaxRequestTimes // "") | tostring) != "" then {"h-max-request-times": $xmux.hMaxRequestTimes} else {} end)
                                    + (if (($xmux.hMaxReusableSecs // "") | tostring) != "" then {"h-max-reusable-secs": $xmux.hMaxReusableSecs} else {} end)
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
                                    + (if ($ds.noGRPCHeader // null) != null then {"no-grpc-header": $ds.noGRPCHeader}
                                       elif ($ds["no-grpc-header"] // null) != null then {"no-grpc-header": $ds["no-grpc-header"]}
                                       elif ($dx.noGRPCHeader // null) != null then {"no-grpc-header": $dx.noGRPCHeader}
                                       elif ($dx["no-grpc-header"] // null) != null then {"no-grpc-header": $dx["no-grpc-header"]}
                                       else {} end)
                                    + (if (($ds.xPaddingBytes // "") | tostring) != "" then {"x-padding-bytes": $ds.xPaddingBytes}
                                       elif (($ds["x-padding-bytes"] // "") | tostring) != "" then {"x-padding-bytes": $ds["x-padding-bytes"]}
                                       elif (($dx.xPaddingBytes // "") | tostring) != "" then {"x-padding-bytes": $dx.xPaddingBytes}
                                       elif (($dx["x-padding-bytes"] // "") | tostring) != "" then {"x-padding-bytes": $dx["x-padding-bytes"]}
                                       else {} end)
                                    + (if ($dsmux | type) == "object" and ($dsmux | length) > 0 then
                                            {"reuse-settings": (
                                                {}
                                                + (if (($dsmux.maxConnections // "") | tostring) != "" then {"max-connections": $dsmux.maxConnections} else {} end)
                                                + (if (($dsmux.maxConcurrency // "") | tostring) != "" then {"max-concurrency": $dsmux.maxConcurrency} else {} end)
                                                + (if (($dsmux.cMaxReuseTimes // "") | tostring) != "" then {"c-max-reuse-times": $dsmux.cMaxReuseTimes} else {} end)
                                                + (if (($dsmux.hMaxRequestTimes // "") | tostring) != "" then {"h-max-request-times": $dsmux.hMaxRequestTimes} else {} end)
                                                + (if (($dsmux.hMaxReusableSecs // "") | tostring) != "" then {"h-max-reusable-secs": $dsmux.hMaxReusableSecs} else {} end)
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
                                )}
                           elif ($xe.downloadSettings // null) != null then
                                {"download-settings": $xe.downloadSettings}
                           else {} end)
                    )}
                else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}

parse_hysteria2_url() {
    local url="$1" DEFAULT_HY2_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5"

    local raw="${url#hysteria2://}"
    raw="${raw#hy2://}"
    raw="${raw%%#*}"

    local userinfo hostport password server port query_part
    query_part=""

    # shellcheck disable=SC2249
    case "$raw" in *\?*) query_part="${raw#*\?}"; raw="${raw%%\?*}"; esac

    if echo "$raw" | grep -q '@'; then
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
    port=$(echo "$port" | tr -cd '0-9')
    [ -z "$port" ] && port="${DEFAULT_HY2_PORT:-443}"

    local sni="" insecure=0 obfs="" obfs_password="" up="" down="" ports="" alpn="" fingerprint="" ech=""
    local up_value="" down_value="" alpn_json proxy_obj

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        # shellcheck disable=SC2249
        case "$k" in
            sni) sni="$(url_decode "$v")" ;;
            insecure|allowInsecure) is_truthy "$v" && insecure=1 ;;
            obfs) obfs="$(url_decode "$v")" ;;
            obfs-password|obfsPassword) obfs_password="$(url_decode "$v")" ;;
            up|upmbps) up="$v" ;;
            down|downmbps) down="$v" ;;
            ports) ports="$(url_decode "$v")" ;;
            alpn) alpn="$(url_decode "$v")" ;;
            fingerprint|fp) fingerprint="$v" ;;
            ech) ech="$(url_decode "$v")" ;;
        esac
    done

    [ -n "$up" ] && {
        up_value=$(echo "$up" | tr -cd '0-9')
        require_uint "$up_value" || return 1
    }
    [ -n "$down" ] && {
        down_value=$(echo "$down" | tr -cd '0-9')
        require_uint "$down_value" || return 1
    }
    alpn_json=$(json_array_from_csv "$alpn") || return 1

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --arg sni "$sni" \
            --arg obfs "$obfs" \
            --arg obfs_password "$obfs_password" \
            --arg ports "$ports" \
            --arg fingerprint "$fingerprint" \
            --arg ech "$ech" \
            --argjson port "$port" \
            --argjson insecure "$insecure" \
            --argjson alpn "$alpn_json" \
            --arg up "$up_value" \
            --arg down "$down_value" '
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
            + (if $sni != "" then {sni: $sni} else {} end)
            + (if $insecure == 1 then {"skip-cert-verify": true} else {} end)
            + (if $obfs != "" and $obfs != "none" then
                    {obfs: $obfs}
                    + (if $obfs_password != "" then {"obfs-password": $obfs_password} else {} end)
                else {} end)
            + (if $up != "" then {up: ($up | tonumber)} else {} end)
            + (if $down != "" then {down: ($down | tonumber)} else {} end)
            + (if $ports != "" then {ports: $ports} else {} end)
            + (if ($alpn | length) > 0 then {alpn: $alpn} else {} end)
            + (if $fingerprint != "" then {fingerprint: $fingerprint} else {} end)
            + (if $ech != "" then {"ech-opts": {enable: true, config: $ech}} else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}

#Supports only one port/port-range + transport combination
parse_mieru_url() {
    local link="$1" dialer_proxy="$2" name="$3" interface_name="$4"
    local raw="${link#mierus://}"
    raw="${raw%%#*}"

    local auth_host_query
    auth_host_query="${raw%%\?*}"
    local query_part=""
    # shellcheck disable=SC2249
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

    local multiplexing transport handshake_mode port
    multiplexing="" transport="" handshake_mode="" port=""

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        # shellcheck disable=SC2249
        case "$k" in
            # Seems MTU aren't there in mihomo
            #mtu) mtu="$v" ;;
            multiplexing) multiplexing="$v" ;;
            protocol) transport="$v" ;;
            handshake-mode) handshake_mode="$v" ;;
            port) port="$v" ;;
        esac
    done

    local proxy_obj

    if [ -n "$port" ]; then
        port=$(echo "$port" | tr -cd '0-9')
        [ -z "$port" ] && port=""
    fi

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
            --arg multiplexing "$multiplexing" \
            --arg port "$port" '
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
            + (if $multiplexing != "" then {multiplexing: $multiplexing} else {} end)
            + (if $port != "" then {port: ($port | tonumber)} else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}
