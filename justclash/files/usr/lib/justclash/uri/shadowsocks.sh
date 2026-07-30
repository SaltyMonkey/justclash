#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC3060
# Protocol-specific URI parser. Kept separate so one parser no longer
# requires scrolling through the collected history of every other protocol.

parse_ss_url() {
    local link="${1#ss://}" DEFAULT_SOCKS_PORT="$2" dialer_proxy="$3" name="$4" interface_name="$5" routing_mark="$6" ip_version="$7"
    local userinfo hostport method password server port decoded query_part proxy_obj
    query_part=""

    case "$link" in *\?*)
        query_part="${link#*\?}"
        link="${link%%\?*}"
        ;;
    esac

    if printf '%s\n' "$link" | grep -q '@'; then
        userinfo="${link%@*}"
        hostport="${link#*@}"

        # Check if starts with 2022- (plain text)
        if printf '%s\n' "$userinfo" | grep -q '^2022-'; then
            # Plain text format for 2022 ciphers
            method="${userinfo%%:*}"
            local pass_part="${userinfo#*:}"

            # Check for second password (EIH) presence
            if printf '%s\n' "$pass_part" | grep -q ':.*:'; then
                # Format: method:serverPass:clientPass
                password="${pass_part}"
            else
                password="${pass_part}"
            fi
        else
            # Try base64 on entire userinfo
            decoded="$(printf '%s' "$userinfo" | base64 -d 2>/dev/null)"
            if [ -n "$decoded" ] && printf '%s\n' "$decoded" | grep -q ':'; then
                method="$(url_decode "${decoded%%:*}")"
                password="$(url_decode "${decoded#*:}")"
            else
                # Check for segmented base64 (Base64(method):Base64(pass) or Base64(method):Base64(psk1):Base64(psk2))
                local method_part="${userinfo%%:*}"
                local pass_part="${userinfo#*:}"
                local decoded_method=""
                decoded_method="$(printf '%s' "$method_part" | base64 -d 2>/dev/null)"

                case "$decoded_method" in
                aes-* | chacha20-* | xchacha20-* | 2022-* | rc4-* | blake3-*)
                    method="$decoded_method"
                    if printf '%s\n' "$pass_part" | grep -q ':'; then
                        local psk1_part="${pass_part%%:*}"
                        local psk2_part="${pass_part#*:}"
                        local psk1_dec="" psk2_dec=""
                        psk1_dec="$(printf '%s' "$psk1_part" | base64 -d 2>/dev/null)"
                        psk2_dec="$(printf '%s' "$psk2_part" | base64 -d 2>/dev/null)"
                        if [ -n "$psk1_dec" ] && [ -n "$psk2_dec" ]; then
                            password="${psk1_dec}:${psk2_dec}"
                        else
                            password="$(url_decode "$pass_part")"
                        fi
                    else
                        local pass_dec=""
                        pass_dec="$(printf '%s' "$pass_part" | base64 -d 2>/dev/null)"
                        if [ -n "$pass_dec" ]; then
                            password="$pass_dec"
                        else
                            password="$(url_decode "$pass_part")"
                        fi
                    fi
                    ;;
                *)
                    # Plain text fallback
                    method="$(url_decode "$method_part")"
                    password="$(url_decode "$pass_part")"
                    ;;
                esac
            fi
        fi
    else
        # Fully base64-encoded
        decoded="$(printf '%s' "$link" | base64 -d 2>/dev/null)"
        userinfo="${decoded%@*}"
        hostport="${decoded#*@}"
        method="$(url_decode "${userinfo%%:*}")"
        password="$(url_decode "${userinfo#*:}")"
    fi

    server="$(url_decode "${hostport%%:*}")"
    port="${hostport##*:}"
    [ "$server" = "$port" ] && port=$DEFAULT_SOCKS_PORT
    port="${port//[!0-9]/}"
    [ -z "$port" ] && port="$DEFAULT_SOCKS_PORT"

    # Parse query parameters for plugins
    local plugin_param=""
    local client_fingerprint=""

    local temp_query="$query_part"
    while [ -n "$temp_query" ]; do
        local param="${temp_query%%&*}"
        temp_query="${temp_query#"$param"}"
        [ -n "$temp_query" ] && temp_query="${temp_query#&}"

        local k="${param%%=*}"
        local v="${param#*=}"
        [ -z "$k" ] && continue

        case "$k" in
        plugin) plugin_param="$(url_decode "$v")" ;;
        client-fingerprint | clientFingerprint | fp) client_fingerprint="$(url_decode "$v")" ;;
        esac
    done

    local plugin_name=""
    local plugin_host="" plugin_password="" plugin_version="" plugin_mode="" plugin_username=""
    local plugin_path="" plugin_tls="" plugin_mux="" plugin_skip_cert_verify=""
    local plugin_name_cert_verify="" plugin_fingerprint="" plugin_cert="" plugin_key=""
    local plugin_alpn=""

    if [ -n "$plugin_param" ]; then
        plugin_name="${plugin_param%%;*}"
        case "$plugin_name" in
        obfs-local | simple-obfs) plugin_name="obfs" ;;
        v2ray) plugin_name="v2ray-plugin" ;;
        gost) plugin_name="gost-plugin" ;;
        esac

        local opts_part="${plugin_param#*;}"
        [ "$opts_part" = "$plugin_param" ] && opts_part=""

        local OIFS="$IFS"
        IFS=";"
        for opt in $opts_part; do
            IFS="$OIFS"
            [ -z "$opt" ] && continue
            local opt_k="${opt%%=*}"
            local opt_v="${opt#*=}"

            if [ "$opt_k" = "$opt" ]; then
                case "$opt_k" in
                tls) plugin_tls="true" ;;
                mux) plugin_mux="true" ;;
                skip-cert-verify | allowInsecure | insecure) plugin_skip_cert_verify="true" ;;
                esac
            else
                case "$opt_k" in
                host | obfs-host) plugin_host="$opt_v" ;;
                password | shadow-tls-password | jls-password) plugin_password="$opt_v" ;;
                version | shadow-tls-version) plugin_version="$opt_v" ;;
                obfs | mode | obfs-mode) plugin_mode="$opt_v" ;;
                username | jls-username) plugin_username="$opt_v" ;;
                path) plugin_path="$opt_v" ;;
                tls) if is_truthy "$opt_v"; then plugin_tls="true"; else plugin_tls="false"; fi ;;
                mux) if is_truthy "$opt_v"; then plugin_mux="true"; else plugin_mux="false"; fi ;;
                skip-cert-verify | allowInsecure | insecure) if is_truthy "$opt_v"; then plugin_skip_cert_verify="true"; else plugin_skip_cert_verify="false"; fi ;;
                name-cert-verify | nameCertVerify | peer) plugin_name_cert_verify="$opt_v" ;;
                fingerprint | pinSHA256) plugin_fingerprint="$opt_v" ;;
                client-fingerprint | clientFingerprint | fp) client_fingerprint="$opt_v" ;;
                certificate) plugin_cert="$opt_v" ;;
                private-key | privateKey) plugin_key="$opt_v" ;;
                alpn) plugin_alpn="$opt_v" ;;
                esac
            fi
            IFS=";"
        done
        IFS="$OIFS"

        # For v2ray-plugin: mihomo detects tls by checking if "tls" appears
        # anywhere in the raw plugin string (strings.Contains(plugin, "tls"))
        if [ "$plugin_name" = "v2ray-plugin" ] && [ -z "$plugin_tls" ]; then
            case "$plugin_param" in *tls*) plugin_tls="true" ;; esac
        fi
    fi

    local alpn_json="[]"
    if [ -n "$plugin_alpn" ]; then
        alpn_json=$(json_array_from_csv "$plugin_alpn") || return 1
    fi

    proxy_obj=$(
        jq -nc \
            --arg name "$name" \
            --arg server "$server" \
            --arg cipher "$method" \
            --arg password "$password" \
            --arg dialer_proxy "$dialer_proxy" \
            --arg interface_name "$interface_name" \
            --arg routing_mark "$routing_mark" \
            --arg ip_version "$ip_version" \
            --arg plugin_name "$plugin_name" \
            --arg plugin_host "$plugin_host" \
            --arg plugin_password "$plugin_password" \
            --arg plugin_version "$plugin_version" \
            --arg plugin_mode "$plugin_mode" \
            --arg plugin_username "$plugin_username" \
            --arg plugin_path "$plugin_path" \
            --arg plugin_tls "$plugin_tls" \
            --arg plugin_mux "$plugin_mux" \
            --arg plugin_skip_cert_verify "$plugin_skip_cert_verify" \
            --arg plugin_name_cert_verify "$plugin_name_cert_verify" \
            --arg plugin_fingerprint "$plugin_fingerprint" \
            --arg plugin_cert "$plugin_cert" \
            --arg plugin_key "$plugin_key" \
            --argjson plugin_alpn "$alpn_json" \
            --arg client_fingerprint "$client_fingerprint" \
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
            + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
            + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
            + (if $plugin_name == "obfs" then
                    {
                        plugin: "obfs",
                        "plugin-opts": (
                            {}
                            + (if $plugin_mode != "" then {mode: $plugin_mode} else {mode: "http"} end)
                            + (if $plugin_host != "" then {host: $plugin_host} else {} end)
                        )
                    }
                else {} end)
            + (if $plugin_name == "v2ray-plugin" then
                    {
                        plugin: "v2ray-plugin",
                        "plugin-opts": (
                            {}
                            + (if $plugin_mode != "" then {mode: $plugin_mode} else {mode: "websocket"} end)
                            + (if $plugin_tls == "true" then {tls: true} else {} end)
                            + (if $plugin_host != "" then {host: $plugin_host} else {} end)
                            + (if $plugin_path != "" then {path: $plugin_path} else {} end)
                            + (if $plugin_mux == "true" then {mux: true} elif $plugin_mux == "false" then {mux: false} else {} end)
                            + (if $plugin_skip_cert_verify == "true" then {"skip-cert-verify": true} else {} end)
                            + (if $plugin_name_cert_verify != "" then {"name-cert-verify": $plugin_name_cert_verify} else {} end)
                            + (if $plugin_fingerprint != "" then {fingerprint: $plugin_fingerprint} else {} end)
                            + (if $plugin_cert != "" then {certificate: $plugin_cert} else {} end)
                            + (if $plugin_key != "" then {"private-key": $plugin_key} else {} end)
                            + (if ($plugin_mode == "" or $plugin_mode == "websocket" or $plugin_mode == "ws") then
                                    {headers: (
                                        {"User-Agent": $ws_user_agent}
                                        + (if $plugin_host != "" then {Host: $plugin_host} else {} end)
                                    )}
                                else {} end)
                        )
                    }
                else {} end)
            + (if $plugin_name == "gost-plugin" then
                    {
                        plugin: "gost-plugin",
                        "plugin-opts": (
                            {}
                            + (if $plugin_mode != "" then {mode: $plugin_mode} else {mode: "websocket"} end)
                            + (if $plugin_tls == "true" then {tls: true} else {} end)
                            + (if $plugin_host != "" then {host: $plugin_host} else {} end)
                            + (if $plugin_path != "" then {path: $plugin_path} else {} end)
                            + (if $plugin_mux == "true" then {mux: true} elif $plugin_mux == "false" then {mux: false} else {} end)
                            + (if $plugin_skip_cert_verify == "true" then {"skip-cert-verify": true} else {} end)
                            + (if $plugin_name_cert_verify != "" then {"name-cert-verify": $plugin_name_cert_verify} else {} end)
                            + (if $plugin_fingerprint != "" then {fingerprint: $plugin_fingerprint} else {} end)
                            + (if $plugin_cert != "" then {certificate: $plugin_cert} else {} end)
                            + (if $plugin_key != "" then {"private-key": $plugin_key} else {} end)
                            + (if ($plugin_mode == "" or $plugin_mode == "websocket" or $plugin_mode == "ws") and $plugin_host != "" then
                                    {headers: {Host: $plugin_host}}
                                else {} end)
                        )
                    }
                else {} end)
            + (if $plugin_name == "shadow-tls" then
                    {
                        plugin: "shadow-tls",
                        "plugin-opts": (
                            {}
                            + (if $plugin_host != "" then {host: $plugin_host} else {} end)
                            + (if $plugin_password != "" then {password: $plugin_password} else {} end)
                            + (if $plugin_version != "" then {version: ($plugin_version | tonumber)} else {version: 2} end)
                            + (if ($plugin_alpn | length) > 0 then {alpn: $plugin_alpn} else {} end)
                        )
                    }
                    + (if $client_fingerprint != "" then {"client-fingerprint": $client_fingerprint} else {} end)
                else {} end)
            + (if $plugin_name == "jls" then
                    {
                        plugin: "jls",
                        "plugin-opts": (
                            {}
                            + (if $plugin_host != "" then {host: $plugin_host} else {} end)
                            + (if $plugin_username != "" then {username: $plugin_username} else {} end)
                            + (if $plugin_password != "" then {password: $plugin_password} else {} end)
                        )
                    }
                    + (if $client_fingerprint != "" then {"client-fingerprint": $client_fingerprint} else {} end)
                else {} end)
        '
    ) || return 1

    printf '%s' "$proxy_obj"
}
