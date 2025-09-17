#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------
# External justclash service part
# --------------------------------------------

url_decode() {
    # shellcheck disable=SC3060
    local data="${1//+/ }"
    echo -n "$data" | sed 's/%/\\x/g' | xargs -0 printf '%b'
}

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

parse_ss_url() {
    local link="${1#ss://}" DEFAULT_SOCKS_PORT="$2"

    # Удаляем #, но сохраняем query (для plugin)
    link="${link%%#*}"

    local userinfo hostport method password server port decoded query_part
    #local plugin=""

    # Извлечение query (после ?)
    query_part=""
    # shellcheck disable=SC2249
    case "$link" in *\?*) query_part="${link#*\?}"; link="${link%%\?*}"; esac

    if echo "$link" | grep -q '@'; then
        userinfo="${link%@*}"
        hostport="${link#*@}"

        decoded="$(echo "$userinfo" | base64 -d 2>/dev/null)"
        if [ -n "$decoded" ] && echo "$decoded" | grep -q ':'; then
            method="$(url_decode "${decoded%%:*}")"  # Декодирование
            password="$(url_decode "${decoded#*:}")"  # Декодирование
        else
            method="$(url_decode "${userinfo%%:*}")"
            password="$(url_decode "${userinfo#*:}")"
        fi
    else
        decoded="$(echo "$link" | base64 -d 2>/dev/null)"
        userinfo="${decoded%@*}"
        hostport="${decoded#*@}"
        method="$(url_decode "${userinfo%%:*}")"
        password="$(url_decode "${userinfo#*:}")"
    fi

    server="${hostport%%:*}"
    port="${hostport##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_SOCKS_PORT

    # Парсинг query (например, для plugin)
    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        #case "$k" in
        #    plugin) plugin="$(url_decode "$v")" ;;
        #esac
    done

    # JSON
    printf '{"type":"ss","server":"%s","port":%s,"cipher":"%s","password":"%s","udp":true}\n' \
        "$server" "$port" "$method" "$password"
}

parse_socks5_url() {
    local link="$1" DEFAULT_SOCKS_PORT="$2"
    local raw="${link#socks5://}"

    local server="" port="" username="" password=""
    local userinfo="" hostport=""
    local name=""

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

    name="socks5_${server}_${port}"

    # Собираем JSON
    local json="\"type\":\"socks5\",\"name\":\"$name\",\"server\":\"$server\",\"port\":$port"
    [ -n "$username" ] && json="$json,\"username\":\"$username\""
    [ -n "$password" ] && json="$json,\"password\":\"$password\""
    json="$json,\"udp\":true"

    echo "{$json}"
}

parse_trojan_url() {
    local url="$1" DEFAULT_TLS_PORT="$2"

    local raw="${url#trojan://}"
    raw="${raw%%#*}"

    local userinfo="${raw%@*}"
    local hostport="${raw#*@}"
    local password="$(printf '%b' "$(echo "$userinfo" | sed 's/%\(..\)/\\x\1/g')")"

    local host="${hostport%%\?*}"
    local server="${host%%:*}"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port="$DEFAULT_TLS_PORT"

    local query_part=""
    # shellcheck disable=SC2249
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local sni="" insecure=0 net="tcp" fp="" alpn="" ws_path="" ws_host="" grpc_service=""
    local ss_enabled="" ss_method="" ss_password=""

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
            insecure|allowInsecure) [ "$v" = "1" ] && insecure=1 ;;
            type) net="$v" ;;
            fp|client-fingerprint) fp="$v" ;;
            alpn) alpn="$(url_decode "$v")" ;;
            path)
                if [ -n "$v" ]; then
                    ws_path="$(url_decode "$v")"
                else
                    ws_path="/"
                fi ;;
            host) ws_host="$(url_decode "$v")" ;;
            serviceName) grpc_service="$v" ;;
            ss) ss_enabled="$v" ;;
            ss-method) ss_method="$v" ;;
            ss-password) ss_password="$v" ;;
        esac
    done

    local json="\"type\":\"trojan\",\"server\":\"$server\",\"port\":$port,\"password\":\"$password\",\"udp\":true"

    [ -n "$sni" ] && json="$json,\"sni\":\"$sni\""
    [ "$insecure" = "1" ] && json="$json,\"skip-cert-verify\":true"
    json="$json,\"network\":\"$net\""

    [ -n "$fp" ] && json="$json,\"client-fingerprint\":\"$fp\""
    [ -n "$alpn" ] && json="$json,\"alpn\":[\"$(echo "$alpn" | tr ',' '","')\"]"

    if [ "$net" = "ws" ]; then
        json="$json,\"ws-opts\":{\"path\":\"$ws_path\""
        [ -n "$ws_host" ] && json="$json,\"headers\":{\"Host\":\"$ws_host\"}"
        json="$json}"
    fi

    if [ "$net" = "grpc" ]; then
        json="$json,\"grpc-opts\":{\"grpc-service-name\":\"$grpc_service\"}"
    fi

    if [ -n "$ss_enabled" ] && [ -n "$ss_method" ] && [ -n "$ss_password" ]; then
        json="$json,\"ss-opts\":{\"enabled\":true,\"method\":\"$ss_method\",\"password\":\"$ss_password\"}"
    fi

    echo "{$json}"
}

parse_vless_url() {
    local link="$1" DEFAULT_TLS_PORT="$2"
    local raw="${link#vless://}"
    raw="${raw%%#*}"

    local uuid="${raw%%@*}"
    local hostport="${raw#*@}"
    local host="${hostport%%\?*}"
    local server="${host%%:*}"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_TLS_PORT

    local query_part=""
    # shellcheck disable=SC2249
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local net="tcp" sec="" sni="" fp="" alpn="" flow="" penc=""
    local pbk="" sid="" spx="" sn="" enc=""

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
            type) net="$v" ;;
            security) sec="$v" ;;
            encryption) enc="$v" ;;
            sni|host) sni="$(url_decode "$v")" ;;
            fp) fp="$v" ;;
            alpn) alpn="$(url_decode "$v")" ;;
            flow) flow="$v" ;;
            pbk) pbk="$v" ;;
            sid) sid="$v" ;;
            spx|path)
                if [ -n "$v" ]; then
                    spx="$(url_decode "$v")"
                else
                    spx="/"
                fi ;;
            serviceName) sn="$v" ;;
            packetEncoding) penc="$v" ;;
        esac
    done

    local json="\"type\":\"vless\",\"uuid\":\"$uuid\",\"server\":\"$server\",\"port\":$port,\"encryption\":\"${enc:-none}\",\"network\":\"$net\",\"udp\":true"

    [ -n "$penc" ] && json="$json,\"packet-encoding\":\"$penc\""

    if [ "$sec" = "tls" ] || [ "$sec" = "reality" ]; then
        json="$json,\"tls\":true"
        [ -n "$sni" ] && json="$json,\"servername\":\"$sni\""
        [ -n "$fp" ] && json="$json,\"client-fingerprint\":\"$fp\""
        [ -n "$alpn" ] && json="$json,\"alpn\":[\"$(echo "$alpn" | tr ',' '","')\"]"
    fi

    if [ "$sec" = "reality" ]; then
        local ro=""
        [ -n "$pbk" ] && ro="$ro\"public-key\":\"$pbk\""
        [ -n "$sid" ] && ro="${ro:+$ro,}\"short-id\":\"$sid\""
        [ -n "$spx" ] && ro="${ro:+$ro,}\"spider-x\":\"$spx\""
        json="$json,\"reality-opts\":{$ro}"
    fi

    if [ "$net" = "tcp" ] && [ -n "$flow" ]; then
        json="$json,\"flow\":\"$flow\""
    fi

    if [ "$net" = "ws" ]; then
        local wso="\"path\":\"${spx:-/}\""
        [ -n "$sni" ] && wso="$wso,\"headers\":{\"Host\":\"$sni\"}"
        json="$json,\"ws-opts\":{$wso}"
    fi

    if [ "$net" = "grpc" ] && [ -n "$sn" ]; then
        json="$json,\"grpc-opts\":{\"service-name\":\"$sn\"}"
    fi

    json="{$json}"
    echo "$json"
}