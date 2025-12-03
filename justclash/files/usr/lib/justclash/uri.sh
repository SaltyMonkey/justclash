#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------
# External justclash parsers/generators part
# --------------------------------------------

parse_ss_url() {
    local link="${1#ss://}" DEFAULT_SOCKS_PORT="$2" dialer_proxy="$3"

    link="${link%%#*}"

    local userinfo hostport method password server port decoded query_part
    query_part=""

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

    server="${hostport%%:*}"
    port="${hostport##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_SOCKS_PORT
    port=$(echo "$port" | tr -cd '0-9')

    local json="\"type\":\"ss\",\"udp\":true,\"server\":\"$server\",\"port\":$port,\"cipher\":\"$method\",\"password\":\"$password\""
    [ -n "$dialer_proxy" ] && json="$json,\"dialer-proxy\":\"$dialer_proxy\""

    echo "{$json}"
}

parse_simple_proxy_url() {
    local link="$1" DEFAULT_SOCKS_PORT="$2" dialer_proxy="$3"
    raw="$link"
    raw="${raw#https://}"
    raw="${raw#socks://}"
    raw="${raw#socks4://}"
    raw="${raw#socks5://}"

    local server="" port="" username="" password=""
    local userinfo="" hostport=""

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

    # JSON
    local json="\"type\":\"socks5\",\"udp\":true\",\"server\":\"$server\",\"port\":$port"
    [ -n "$username" ] && json="$json,\"username\":\"$username\""
    [ -n "$password" ] && json="$json,\"password\":\"$password\""
    [ -n "$dialer_proxy" ] && json="$json,\"dialer-proxy\":\"$dialer_proxy\""

    echo "{$json}"
}

parse_trojan_url() {
    local url="$1" DEFAULT_TLS_PORT="$2" dialer_proxy="$3"

    local raw="${url#trojan://}"
    raw="${url#trojan-go://}"
    raw="${raw%%#*}"

    local userinfo="${raw%@*}"
    local hostport="${raw#*@}"
    local password="$(printf '%b' "$(echo "$userinfo" | sed 's/%\(..\)/\\x\1/g')")"

    local host="${hostport%%\?*}"
    local server="${host%%:*}"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port="$DEFAULT_TLS_PORT"
    port=$(echo "$port" | tr -cd '0-9')

    local query_part=""
    # shellcheck disable=SC2249
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local sni="" insecure=0 net="tcp" fp="" alpn="" ws_path="" ws_host="" grpc_service=""
    local ss_enabled="" ss_method="" ss_password=""
    local security="" pbk="" sid="" spx="" ech=""

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
            serviceName) grpc_service="$v" ;;
            ss) ss_enabled="$v" ;;
            ss-method) ss_method="$v" ;;
            ss-password) ss_password="$v" ;;
        esac
    done

    local json="\"type\":\"trojan\",\"server\":\"$server\",\"port\":$port,\"password\":\"$password\",\"udp\":true"

    [ -n "$dialer_proxy" ] && json="$json,\"dialer-proxy\":\"$dialer_proxy\""
    [ -n "$sni" ] && json="$json,\"sni\":\"$sni\""
    [ "$insecure" = "1" ] && json="$json,\"skip-cert-verify\":true"
    json="$json,\"network\":\"$net\""

    [ -n "$fp" ] && json="$json,\"client-fingerprint\":\"$fp\""
    [ -n "$alpn" ] && json="$json,\"alpn\":[\"$(echo "$alpn" | tr ',' '","')\"]"

    if [ "$net" = "ws" ]; then
        local wso="\"path\":\"${ws_path:-/}\""
        [ -n "$ws_host" ] && wso="$wso,\"headers\":{\"Host\":\"$ws_host\"}"
        json="$json,\"ws-opts\":{$wso}"
    fi

    if [ "$net" = "grpc" ]; then
        local grpco="\"grpc-service-name\":\"$grpc_service\""
        json="$json,\"grpc-opts\":{$grpco}"
    fi

    if [ "$security" = "reality" ]; then
        local realo="\"public-key\":\"$pbk\""
        [ -n "$sid" ] && realo="$realo,\"short-id\":\"$sid\""
        [ -n "$spx" ] && realo="$realo,\"spider-x\":\"$spx\""
        json="$json,\"reality-opts\":{$realo}"
    fi

    if [ -n "$ech" ]; then
        local echo="\"enable\":true,\"config\":\"$ech\""
        json="$json,\"ech-opts\":{$echo}"
    fi

    if [ -n "$ss_enabled" ] && [ -n "$ss_method" ] && [ -n "$ss_password" ]; then
        local sso="\"enabled\":true,\"method\":\"$ss_method\",\"password\":\"$ss_password\""
        json="$json,\"ss-opts\":{$sso}"
    fi

    echo "{$json}"
}

parse_vless_url() {
    local link="$1" DEFAULT_TLS_PORT="$2" dialer_proxy="$3"
    local raw="${link#vless://}"
    raw="${raw%%#*}"

    local uuid="${raw%%@*}"
    local hostport="${raw#*@}"
    local host="${hostport%%\?*}"
    local server="${host%%:*}"
    local port="${host##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_TLS_PORT
    port=$(echo "$port" | tr -cd '0-9')

    local query_part=""
    # shellcheck disable=SC2249
    case "$hostport" in *\?*) query_part="${hostport#*\?}" ;; esac

    local net="tcp" sec="" sni="" fp="" alpn="" flow="" penc=""
    local pbk="" sid="" spx="" sn="" enc="" ech=""

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
            ech) ech="$(url_decode "$v")" ;;
        esac
    done

    local json="\"type\":\"vless\",\"uuid\":\"$uuid\",\"server\":\"$server\",\"port\":$port,\"encryption\":\"${enc:-none}\",\"network\":\"$net\",\"udp\":true"

    [ -n "$penc" ] && json="$json,\"packet-encoding\":\"$penc\""
    [ -n "$dialer_proxy" ] && json="$json,\"dialer-proxy\":\"$dialer_proxy\""

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

    if [ -n "$ech" ]; then
        local echo="\"enable\":true,\"config\":\"$ech\""
        json="$json,\"ech-opts\":{$echo}"
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
        local grpco="\"service-name\":\"$sn\""
        json="$json,\"grpc-opts\":{$grpco}"
    fi

    echo "{$json}"
}

parse_hysteria2_url() {
    local url="$1" DEFAULT_HY2_PORT="$2" dialer_proxy="$3"

    local raw="${url#hysteria2://}"
    raw="${raw#hy2://}"
    raw="${raw%%#*}"

    local userinfo hostport password server port query_part
    query_part=""

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

    local sni="" insecure=0 obfs="" obfs_password="" up="" down="" ports="" alpn="" fingerprint="" ech=""

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
            insecure) [ "$v" = "1" ] && insecure=1 ;;
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

    local json="\"type\":\"hysteria2\",\"server\":\"$server\",\"port\":$port,\"udp\":true"

    [ -n "$password" ] && json="$json,\"password\":\"$password\""
    [ -n "$dialer_proxy" ] && json="$json,\"dialer-proxy\":\"$dialer_proxy\""
    [ -n "$sni" ] && json="$json,\"sni\":\"$sni\""
    [ "$insecure" = "1" ] && json="$json,\"skip-cert-verify\":true"

    if [ -n "$obfs" ] && [ "$obfs" != "none" ]; then
        json="$json,\"obfs\":\"$obfs\""
        [ -n "$obfs_password" ] && json="$json,\"obfs-password\":\"$obfs_password\""
    fi

    [ -n "$up" ] && json="$json,\"up\":\"$up\""
    [ -n "$down" ] && json="$json,\"down\":\"$down\""
    [ -n "$ports" ] && json="$json,\"ports\":\"$ports\""
    [ -n "$alpn" ] && json="$json,\"alpn\":[\"$(echo "$alpn" | tr ',' '","')\"]"
    [ -n "$fingerprint" ] && json="$json,\"fingerprint\":\"$fingerprint\""

    if [ -n "$ech" ]; then
        local echo="\"enable\":true,\"config\":\"$ech\""
        json="$json,\"ech-opts\":{$echo}"
    fi

    echo "{$json}"
}


#Supports only one port/port-range + transport combination
parse_mieru_url() {
    local link="$1" dialer_proxy="$2"
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

    local json
    json="\"type\":\"mieru\""
    json="$json,\"server\":\"$server\""
    json="$json,\"udp\":true"
    [ -n "$handshake_mode" ] && json="$json,\"handshake-mode\":\"$handshake_mode\""
    [ -n "$transport" ] && json="$json,\"transport\":\"$transport\""
    [ -n "$username" ] && json="$json,\"username\":\"$username\""
    [ -n "$password" ] && json="$json,\"password\":\"$password\""
    [ -n "$dialer_proxy" ] && json="$json,\"dialer-proxy\":\"$dialer_proxy\""
    [ -n "$multiplexing" ] && json="$json,\"multiplexing\":\"$multiplexing\""
    [ -n  "$port" ] && json="$json,\"port\":\"$port\""

    echo "{$json}"
}
