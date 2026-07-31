#!/bin/ash
# shellcheck shell=dash
# Dynamically scoped YAML build state is provided by core_generate_yaml().
# shellcheck disable=SC2034,SC2154

: "${JUSTCLASH_CONSTANTS_LOADED:?constants.sh must be loaded before yaml/rules.sh}"

build_fake_ip_rule_array() {
    local entries="$1"
    local rule_type="$2"
    local action="${3:-fake-ip}"
    local entry generated_rule rules="" rt

    for entry in $entries; do
        [ -n "$entry" ] || continue
        rt="$rule_type"

        # Auto-detect DOMAIN-WILDCARD if entry contains *
        if [ "$rt" = "DOMAIN-SUFFIX" ]; then
            case "$entry" in
            *[*]*) rt="DOMAIN-WILDCARD" ;;
            esac
        fi

        generated_rule="$rt,$entry,$action"
        rules="${rules:+$rules,}\"$(str_json_escape "$generated_rule")\""
    done

    printf '[%s]' "${rules:-}"
}

lookup_many_rulesets_full() {
    local keys="$1"

    # Optimization: Uses global _RULESETS_CONTENT (or _BLOCK_RULESETS_CONTENT swapped at caller)
    # to avoid passing large strings via function arguments (which causes heavy copying in ash).
    # Uses a single awk invocation to efficiently filter all matching keys in one pass.
    printf '%s\n' "$_RULESETS_CONTENT" | awk -F'|' -v keys="$keys" '
        BEGIN {
            split(keys, arr, /[[:space:]]+/)
            for (i in arr) {
                if (arr[i] != "") {
                    need[arr[i]] = 1
                }
            }
        }
        { gsub(/\r/, "") }
        $1 !~ /^#/ && ($2 in need) {
            print $0
        }
    '
}

build_manual_rules_array() {
    local route_entries="$1"
    local rule_prefix="$2"
    local target_name="$3"
    local extra_suffix="$4"
    local route_entry generated_rule rules_fragment=""

    for route_entry in $route_entries; do
        [ -n "$route_entry" ] || continue

        [ -n "$extra_suffix" ] && generated_rule="$rule_prefix,$route_entry,$target_name,$extra_suffix" || generated_rule="$rule_prefix,$route_entry,$target_name"

        rules_fragment="${rules_fragment:+$rules_fragment,}\"$generated_rule\""
    done

    printf '%s' "$rules_fragment"
}

build_builtin_rules_bundle() {
    local enabled_list="$1"
    local target_name="$2"
    local download_proxy="$3"
    local list_update_interval="$4"
    local size_limit="$5"
    local rule_mode="${6:-all}"
    local ruleset_lines ruleset_line ruleset_name ruleset_behavior ruleset_format ruleset_url ruleset_fields generated_rule ruleset_auth
    local rules_fragment="" ip_rules_fragment="" rulesets_fragment="" names_fragment="" fake_ip_rules_fragment=""
    local added_rulesets="|"

    # Queries the active ruleset database (globally defined in _RULESETS_CONTENT)
    ruleset_lines=$(lookup_many_rulesets_full "$enabled_list")

    local old_ifs="$IFS"
    # shellcheck disable=SC2154
    IFS="$NL"
    for ruleset_line in $ruleset_lines; do
        IFS="$old_ifs"
        [ -z "$ruleset_line" ] && continue

        ruleset_name="${ruleset_line#*|}"
        ruleset_name="${ruleset_name%%|*}"

        case "$added_rulesets" in
        *"|$ruleset_name|"*)
            log warn "Skip duplicated ruleset: $ruleset_name"
            continue
            ;;
        esac

        ruleset_fields="${ruleset_line#*|}"
        ruleset_name="${ruleset_fields%%|*}"
        ruleset_fields="${ruleset_fields#*|}"
        ruleset_behavior="${ruleset_fields%%|*}"
        ruleset_fields="${ruleset_fields#*|}"
        ruleset_format="${ruleset_fields%%|*}"
        ruleset_url="${ruleset_fields#*|}"

        # Extract optional Authorization header field (6th field)
        ruleset_auth=""
        case "$ruleset_url" in
        *\|*)
            ruleset_auth=$(str_trim "${ruleset_url#*|}")
            ruleset_url="${ruleset_url%%|*}"
            ;;
        esac

        [ "$ruleset_behavior" = "ipcidr" ] && generated_rule="RULE-SET,$ruleset_name,$target_name,no-resolve" || generated_rule="RULE-SET,$ruleset_name,$target_name"
        case "$ruleset_url" in
        http://* | https://*)
            local headers=""
            if [ -n "$ruleset_auth" ]; then
                template_headers "0" "$ruleset_auth" ""
                headers="$OUT_TEMPLATE"
            fi
            template_ruleset_http "$ruleset_name" "$ruleset_url" "$ruleset_behavior" "$ruleset_format" "$download_proxy" "$list_update_interval" "$size_limit" "$headers"
            rulesets_fragment="${rulesets_fragment}\"$(str_json_escape "$ruleset_name")\":$OUT_TEMPLATE,"
            ;;
        *)
            template_ruleset_file "$ruleset_url" "$ruleset_behavior" "$ruleset_format"
            rulesets_fragment="${rulesets_fragment}\"$(str_json_escape "$ruleset_name")\":$OUT_TEMPLATE,"
            ;;
        esac
        added_rulesets="$added_rulesets$ruleset_name|"

        case "$rule_mode" in
        all)
            # IP-based rulesets emitted separately so callers place them before domain rules.
            if [ "$ruleset_behavior" = "ipcidr" ]; then
                ip_rules_fragment="${ip_rules_fragment:+$ip_rules_fragment,}\"$generated_rule\""
                _IPCIDR_RULESETS_BUFFER="${_IPCIDR_RULESETS_BUFFER:+$_IPCIDR_RULESETS_BUFFER$NL}$ruleset_name|$ruleset_url"
            else
                rules_fragment="${rules_fragment:+$rules_fragment,}\"$generated_rule\""
            fi
            ;;
        non-domain-only)
            if [ "$ruleset_behavior" != "domain" ]; then
                rules_fragment="${rules_fragment:+$rules_fragment,}\"$generated_rule\""
            fi
            ;;
        esac

        if [ "$ruleset_behavior" = "domain" ]; then
            names_fragment="${names_fragment:+$names_fragment,}\"rule-set:$ruleset_name\""
            case "$GLOBAL_FAKE_IP_EXCLUDE_RULES" in
            *" $ruleset_name "*) ;;
            *) fake_ip_rules_fragment="${fake_ip_rules_fragment:+$fake_ip_rules_fragment,}\"RULE-SET,$ruleset_name,fake-ip\"" ;;
            esac
        fi
        IFS="$NL"
    done
    IFS="$old_ifs"

    OUT_BUNDLE_IP_RULES="${ip_rules_fragment:-}"
    OUT_BUNDLE_RULES="$rules_fragment"
    OUT_BUNDLE_RULESETS="${rulesets_fragment%,}"
    OUT_BUNDLE_NAMES="$names_fragment"
    OUT_BUNDLE_FAKEIPRULES="$fake_ip_rules_fragment"
}

template_ruleset_http() {
    local name="$1" url="$2" behavior="$3" format="$4" proxy="$5" interval="$6" size_limit="$7" headers="$8"
    local out
    local ext="$format"
    if [ "$behavior" = "ipcidr" ] && [ "$format" = "text" ]; then
        ext="list"
    fi

    out="\"type\":\"http\",\"path\":\"$(str_json_escape "${CORE_WORKDIR_RULES_PATH}/${name}.${ext}")\",\"url\":\"$(str_json_escape "$url")\",\"behavior\":\"$(str_json_escape "$behavior")\",\"format\":\"$(str_json_escape "$format")\",\"proxy\":\"$(str_json_escape "$proxy")\",\"interval\":$interval,\"size-limit\":$size_limit"
    [ -n "$headers" ] && out="$out,$headers"

    OUT_TEMPLATE="{$out}"
}

template_ruleset_file() {
    local path="$1" behavior="$2" format="$3"
    local out

    out="\"type\":\"file\",\"path\":\"$(str_json_escape "$path")\",\"behavior\":\"$(str_json_escape "$behavior")\",\"format\":\"$(str_json_escape "$format")\""

    OUT_TEMPLATE="{$out}"
}

handle_block_rule_section() {
    local enabled="$1" enabled_blocklist="$2" download_proxy="$3" list_update_interval="$4"
    local size_limit="$5" route_entries="$6" additional_domain_blockroute="$7"
    local additional_destip_blockroute="$8" enabled_geoip_blocklist="$9"
    local rules_array="" selected_rulesets="" list_rulesets_names="" list_suffix_names="" list_geosite_names=""
    local generated_rule route_entry rules_fragment

    if [ "$enabled" -ne 1 ]; then
        log warn "Skip disabled proxy group: block_rules"
        OUT_RULES="[]"
        OUT_RULESETS="{}"
        OUT_NAMES_RULESETS=""
        OUT_NAMES_SUFFIXES=""
        OUT_NAMES_GEOSITE=""
        return
    fi

    # --- 1. Domain-based Block Rules ---
    for route_entry in $route_entries; do
        [ -n "$route_entry" ] && {
            list_geosite_names="${list_geosite_names:+$list_geosite_names,}$route_entry"
        }
    done
    if [ -n "$list_geosite_names" ]; then
        list_geosite_names="geosite:$list_geosite_names"
    fi

    if [ -n "$enabled_blocklist" ]; then
        build_builtin_rules_bundle "$enabled_blocklist" "REJECT" "$download_proxy" "$list_update_interval" "$size_limit" "non-domain-only"
        [ -n "$OUT_BUNDLE_RULESETS" ] && selected_rulesets="${selected_rulesets:+$selected_rulesets,}$OUT_BUNDLE_RULESETS"
        [ -n "$OUT_BUNDLE_NAMES" ] && list_rulesets_names=$(printf '%s' "$OUT_BUNDLE_NAMES" | sed 's/"//g; s/,rule-set:/,/g')
    fi

    for route_entry in $additional_domain_blockroute; do
        [ -n "$route_entry" ] && {
            list_suffix_names="${list_suffix_names:+$list_suffix_names,}+.$route_entry"
        }
    done

    # --- 2. IP-based Block Rules (at the bottom) ---
    for ip_cidr in $additional_destip_blockroute; do
        [ -n "$ip_cidr" ] && _STATIC_IPS_BUFFER="${_STATIC_IPS_BUFFER:+$_STATIC_IPS_BUFFER$NL}$ip_cidr"
    done
    rules_fragment=$(build_manual_rules_array "$additional_destip_blockroute" "IP-CIDR" "REJECT" "no-resolve")
    [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

    route_entries="$enabled_geoip_blocklist"
    rules_fragment=$(build_manual_rules_array "$route_entries" "GEOIP" "REJECT" "no-resolve")
    [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

    if [ -n "$enabled_blocklist" ] && [ -n "$OUT_BUNDLE_RULES" ]; then
        rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_RULES"
    fi

    OUT_RULES="[${rules_array:-}]"
    OUT_RULESETS="{${selected_rulesets:-}}"
    OUT_NAMES_RULESETS="$list_rulesets_names"
    OUT_NAMES_GEOSITE="$list_geosite_names"
    OUT_NAMES_SUFFIXES="$list_suffix_names"
}

handle_mixed_port_rules_section() {
    local exit_rule="$1"
    local rules rule_str
    if [ "$exit_rule" = "BY RULES" ]; then
        rules="[]"
    else
        rule_str=$(printf 'IN-TYPE,SOCKS/HTTP,%s' "${exit_rule:-$DEFAULT_PROXY}")
        rules="[\"${rule_str:-}\"]"
    fi

    OUT_MIXED_RULES="$rules"
}

handle_final_rule_section() {
    local exit_rule="$1"
    local rule_str rules
    rule_str=$(printf 'MATCH,%s' "${exit_rule:-$DEFAULT_PROXY}")

    rules="[\"${rule_str:-}\"]"

    OUT_FINAL_RULES="$rules"
}
