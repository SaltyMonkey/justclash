#!/bin/ash
# shellcheck shell=dash
# Per-section renderers append to dynamically scoped build state owned by core_generate_yaml().
# shellcheck disable=SC2034,SC2154,SC2329

yaml_proxy_append() {
    local name="$1" proxy_link_uri="$2" dialer_proxy="$3" interface_name="$4" routing_mark="$5"
    local list_update_interval="$6" size_limit="$7" mode="$8" proxy_link_object="$9"
    local use_proxy_for_list_update="${10}" ip_version="${11}"
    local additional_srcip_route="${12}" enabled_list="${13}" additional_domain_route="${14}"
    local enabled_geosite_list="${15}" additional_destip_route="${16}" enabled_geoip_list="${17}"
    local route_entries route_entry ip_cidr rules_fragment proxy_obj=""
    local download_proxy generated_rule

    if [ "$mode" = "object" ]; then
        [ -z "$proxy_link_object" ] && {
            log warn "Skip empty proxy '$name'"
            return
        }

        proxy_obj=$(printf '%s' "$proxy_link_object" | jq -c --arg name "$name" '. + {name: $name}')

        [ -z "$proxy_obj" ] && {
            log warn "Failed to process object for '$name'"
            return
        }
    else
        [ -z "$proxy_link_uri" ] && {
            log warn "Skip empty '$name'"
            return
        }
        proxy_link_uri=$(str_trim "$proxy_link_uri")

        [ -n "$dialer_proxy" ] && dialer_proxy=$(str_trim "$dialer_proxy")
        [ -n "$interface_name" ] && interface_name=$(str_trim "$interface_name")

        case "$proxy_link_uri" in
        direct://*) proxy_obj=$(parse_direct_url "$name" "$dialer_proxy" "$interface_name" "$routing_mark" "$ip_version") ;;
        ss://*) proxy_obj=$(parse_ss_url "$proxy_link_uri" "$DEFAULT_SOCKS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        socks5://*) proxy_obj=$(parse_simple_proxy_url "$proxy_link_uri" "$DEFAULT_SOCKS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        socks://*) proxy_obj=$(parse_simple_proxy_url "$proxy_link_uri" "$DEFAULT_SOCKS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        ssh://*) proxy_obj=$(parse_ssh_url "$proxy_link_uri" "$DEFAULT_SSH_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        trojan://*) proxy_obj=$(parse_trojan_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version" "$(user_agent_rand)") ;;
        trojan-go://*) proxy_obj=$(parse_trojan_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version" "$(user_agent_rand)") ;;
        hy2://*) proxy_obj=$(parse_hysteria2_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        hysteria2://*) proxy_obj=$(parse_hysteria2_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        vless://*) proxy_obj=$(parse_vless_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        vmess://*) proxy_obj=$(parse_vmess_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        mierus://*) proxy_obj=$(parse_mieru_url "$proxy_link_uri" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        sudoku://*) proxy_obj=$(parse_sudoku_url "$proxy_link_uri" "$dialer_proxy" "$name" "$interface_name" "$routing_mark" "$ip_version") ;;
        *)
            log warn "Unknown proxy link type: $proxy_link_uri"
            return
            ;;
        esac

        [ -z "$proxy_obj" ] && {
            log warn "Failed to parse proxy link: $proxy_link_uri"
            return
        }
    fi

    OUT_PROXIES="${OUT_PROXIES:+$OUT_PROXIES,}$proxy_obj"
    [ "$use_proxy_for_list_update" -eq 1 ] && download_proxy="$name" || download_proxy=$DEFAULT_PROXY

    route_entries="$additional_srcip_route"
    for ip_cidr in $route_entries; do
        [ -n "$ip_cidr" ] && _STATIC_SOURCE_IPS_BUFFER="${_STATIC_SOURCE_IPS_BUFFER:+$_STATIC_SOURCE_IPS_BUFFER$NL}$ip_cidr"
    done
    rules_fragment=$(build_manual_rules_array "$route_entries" "SRC-IP-CIDR" "$name" "no-resolve")
    [ -n "$rules_fragment" ] && OUT_RULES="${OUT_RULES:+$OUT_RULES,}$rules_fragment"

    # Compile ruleset bundle early so we have domain/IP rulesets separated
    if [ -n "$enabled_list" ]; then
        build_builtin_rules_bundle "$enabled_list" "$name" "$download_proxy" "$list_update_interval" "$size_limit"
        [ -n "$OUT_BUNDLE_RULESETS" ] && OUT_RULESETS="${OUT_RULESETS:+$OUT_RULESETS,}$OUT_BUNDLE_RULESETS"
        [ -n "$OUT_BUNDLE_FAKEIPRULES" ] && OUT_FAKE_IP_RULES="${OUT_FAKE_IP_RULES:+$OUT_FAKE_IP_RULES,}$OUT_BUNDLE_FAKEIPRULES"
    fi

    # --- 2. Domain-based Rules (above IP destination rules) ---
    # Custom Domain Suffixes
    route_entries="$additional_domain_route"
    for route_entry in $route_entries; do
        [ -n "$route_entry" ] && {
            generated_rule="DOMAIN-SUFFIX,$route_entry,$name"
            OUT_RULES="${OUT_RULES:+$OUT_RULES,}\"$generated_rule\""
            case "$GLOBAL_FAKE_IP_EXCLUDE_DOMAINS" in
            *" $route_entry "*) ;;
            *) OUT_FAKE_IP_RULES="${OUT_FAKE_IP_RULES:+$OUT_FAKE_IP_RULES,}\"DOMAIN-SUFFIX,$route_entry,fake-ip\"" ;;
            esac
        }
    done

    # GEOSITE rules
    route_entries="$enabled_geosite_list"
    for route_entry in $route_entries; do
        [ -n "$route_entry" ] && {
            generated_rule="GEOSITE,$route_entry,$name"
            OUT_RULES="${OUT_RULES:+$OUT_RULES,}\"$generated_rule\""
            case "$GLOBAL_FAKE_IP_EXCLUDE_GEOSITES" in
            *" $route_entry "*) ;;
            *) OUT_FAKE_IP_RULES="${OUT_FAKE_IP_RULES:+$OUT_FAKE_IP_RULES,}\"GEOSITE,$route_entry,fake-ip\"" ;;
            esac
        }
    done

    # Domain Rulesets (from the bundle)
    if [ -n "$enabled_list" ] && [ -n "$OUT_BUNDLE_RULES" ]; then
        OUT_RULES="${OUT_RULES:+$OUT_RULES,}$OUT_BUNDLE_RULES"
    fi

    # --- 3. IP-based Destination Rules (at the bottom) ---
    # Custom Destination IPs
    route_entries="$additional_destip_route"
    for ip_cidr in $route_entries; do
        [ -n "$ip_cidr" ] && _STATIC_IPS_BUFFER="${_STATIC_IPS_BUFFER:+$_STATIC_IPS_BUFFER$NL}$ip_cidr"
    done
    rules_fragment=$(build_manual_rules_array "$route_entries" "IP-CIDR" "$name" "no-resolve")
    [ -n "$rules_fragment" ] && OUT_RULES="${OUT_RULES:+$OUT_RULES,}$rules_fragment"

    # GEOIP rules
    route_entries="$enabled_geoip_list"
    rules_fragment=$(build_manual_rules_array "$route_entries" "GEOIP" "$name" "no-resolve")
    [ -n "$rules_fragment" ] && OUT_RULES="${OUT_RULES:+$OUT_RULES,}$rules_fragment"

    # IP Rulesets (from the bundle)
    if [ -n "$enabled_list" ] && [ -n "$OUT_BUNDLE_IP_RULES" ]; then
        OUT_RULES="${OUT_RULES:+$OUT_RULES,}$OUT_BUNDLE_IP_RULES"
    fi
}
