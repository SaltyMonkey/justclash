#!/bin/ash
# shellcheck shell=dash
# Per-section renderers append to dynamically scoped build state owned by core_generate_yaml().
# shellcheck disable=SC2034,SC2154,SC2329

template_proxy_group() {
    local name="$1" type="$2" url="$3" status="$4" interval="$5" timeout="$6" max_failed="$7" lazy="$8"
    local tolerance="$9" strategy="${10}" proxies="${11}" providers="${12}" filter="${13}" exclude_filter="${14}" exclude_type="${15}" default_selected="${16}"
    local out

    out="\"name\":\"$(str_json_escape "$name")\""
    out="$out,\"type\":\"$(str_json_escape "$type")\""
    out="$out,\"url\":\"$(str_json_escape "$url")\""
    out="$out,\"expected-status\":$status"
    out="$out,\"interval\":$interval"
    out="$out,\"timeout\":$timeout"
    out="$out,\"max-failed-times\":$max_failed"
    out="$out,\"lazy\":$lazy"

    if [ "$type" = "url-test" ] && [ -n "$tolerance" ]; then
        out="$out,\"tolerance\":\"$(str_json_escape "$tolerance")\""
    elif [ "$type" = "load-balance" ] && [ -n "$strategy" ]; then
        out="$out,\"strategy\":\"$(str_json_escape "$strategy")\""
    elif [ "$type" = "select" ] && [ -n "$default_selected" ]; then
        out="$out,\"default-selected\":\"$(str_json_escape "$default_selected")\""
    fi

    [ -n "$proxies" ] && out="$out,\"proxies\":[$proxies]"
    [ -n "$providers" ] && out="$out,\"use\":[$providers]"
    [ -n "$filter" ] && out="$out,\"filter\":\"$(str_json_escape "$filter")\""
    [ -n "$exclude_filter" ] && out="$out,\"exclude-filter\":\"$(str_json_escape "$exclude_filter")\""
    [ -n "$exclude_type" ] && out="$out,\"exclude-type\":\"$(str_json_escape "$exclude_type")\""

    OUT_TEMPLATE="{$out}"
}

yaml_proxy_group_append() {
    local name="$1" proxies_list="$2" providers_list="$3" group_type="$4" strategy="$5"
    local check_url="$6" expected_status="$7" interval="$8" check_timeout="$9"
    local max_failed_times="${10}" lazy="${11}" tolerance="${12}" default_selected="${13}"
    local filter="${14}" exclude_filter="${15}" exclude_type="${16}" enabled_list="${17}"
    local list_update_interval="${18}" size_limit="${19}" use_proxy_group_for_list_update="${20}"
    local additional_srcip_route="${21}" additional_domain_route="${22}"
    local enabled_geosite_list="${23}" additional_destip_route="${24}" enabled_geoip_list="${25}"
    local route_entries route_entry ip_cidr rules_fragment escaped_proxies escaped_providers group_json
    local download_proxy generated_rule

    [ -n "$proxies_list" ] && escaped_proxies=$(str_trim "$proxies_list" | fmt_list_to_json_array)
    [ -n "$providers_list" ] && escaped_providers=$(str_trim "$providers_list" | fmt_list_to_json_array)

    template_proxy_group \
        "$name" "$group_type" "$check_url" "$expected_status" "$interval" "$check_timeout" "$max_failed_times" "$(fmt_uci_bool_as_yaml "$lazy")" \
        "$tolerance" "$strategy" "$escaped_proxies" "$escaped_providers" "$filter" "$exclude_filter" "$exclude_type" "$default_selected"
    group_json="$OUT_TEMPLATE"

    OUT_PROXY_GROUPS="${OUT_PROXY_GROUPS:+$OUT_PROXY_GROUPS,}$group_json"
    [ "$use_proxy_group_for_list_update" -eq 1 ] && download_proxy="$name" || download_proxy=$DEFAULT_PROXY

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
