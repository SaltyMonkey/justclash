#!/bin/ash
# shellcheck shell=dash
# Per-section renderers append to dynamically scoped build state owned by core_generate_yaml().
# OUT_TEMPLATE is a scratch result overwritten by template helpers and consumed
# immediately by their callers (including rules.sh). OUT_PROXY_PROVIDERS accumulates
# provider JSON fragments for core_generate_yaml(); neither variable is exported.
# shellcheck disable=SC2034,SC2154

build_hwid_header_fragment() {
    local hwid device_os version_os device_model
    hwid=$(sysinfo_hwid_generate)
    device_os=$(sysinfo_get_os_name)
    version_os=$(sysinfo_get_os_version)
    device_model=$(sysinfo_get_hw_model)
    template_hwid_header "$hwid" "$device_os" "$version_os" "$device_model"
}

template_proxy_provider() {
    local url="$1" interval="$2" size_limit="$3" proxy="$4" filter="$5" exclude_filter="$6" exclude_type="$7"
    local override_dialer="$8" override_ifname="$9" override_fwmark="${10}" override_ip_version="${11}" hwid_header="${12}"
    local hc_enabled="${13}" hc_url="${14}" hc_status="${15}" hc_interval="${16}" hc_timeout="${17}" hc_lazy="${18}"
    local age_priv="${19}" reality_mlkem768="${20}"
    local out override_json hc_json

    out="\"type\":\"http\",\"url\":\"$(str_json_escape "$url")\",\"interval\":$interval,\"size-limit\":$size_limit,\"proxy\":\"$proxy\""
    [ -n "$filter" ] && out="$out,\"filter\":\"$(str_json_escape "$filter")\""
    [ -n "$exclude_filter" ] && out="$out,\"exclude-filter\":\"$(str_json_escape "$exclude_filter")\""
    [ -n "$exclude_type" ] && out="$out,\"exclude-type\":\"$(str_json_escape "$exclude_type")\""

    # Override object
    override_json="\"udp\":true"
    [ -n "$override_dialer" ] && override_json="$override_json,\"dialer-proxy\":\"$(str_json_escape "$override_dialer")\""
    [ -n "$override_ifname" ] && override_json="$override_json,\"interface-name\":\"$(str_json_escape "$override_ifname")\""
    [ -n "$override_ip_version" ] && override_json="$override_json,\"ip-version\":\"$override_ip_version\""
    [ -n "$override_fwmark" ] && override_json="$override_json,\"routing-mark\":$override_fwmark"
    [ "$reality_mlkem768" = "1" ] && override_json="$override_json,\"override-expr\":[\"$(str_json_escape '.["reality-opts"] |= (select(. != null) | .["support-x25519mlkem768"] = true)')\"]"
    out="$out,\"override\":{$override_json}"

    # Optional HWID headers
    [ -n "$hwid_header" ] && out="$out,$hwid_header"

    # Health check object
    if [ "$hc_enabled" -eq 1 ]; then
        hc_json="\"enable\":true,\"lazy\":$hc_lazy,\"url\":\"$(str_json_escape "$hc_url")\",\"expected-status\":$hc_status,\"interval\":$hc_interval,\"timeout\":$hc_timeout"
        out="$out,\"health-check\":{$hc_json}"
    fi

    # Optional AGE keys
    [ -n "$age_priv" ] && out="$out,\"age-private-key\":\"$(str_json_escape "$age_priv")\""

    OUT_TEMPLATE="{$out}"
}

resolve_user_agent() {
    local ua="$1"

    case "$ua" in
    __random__)
        user_agent_rand
        ;;
    __justclash__)
        local service_ver="${JUSTCLASH_VERSION:-unknown}"
        printf '%s\n' "JustClash/${service_ver}"
        ;;
    __mihomo__)
        local core_ver
        core_ver=$(core_info_mihomo "$CORE_PATH" "$NO_DATA_STRING")
        printf '%s\n' "Mihomo/${core_ver}"
        ;;
    *)
        printf '%s\n' "$ua"
        ;;
    esac
}

template_headers() {
    local hwid_enabled="$1"
    local auth_token="$2"
    local user_agent="$3"
    local age_pub_key="$4"
    local hwid_custom="$5"
    local device_os_custom="$6"
    local version_os_custom="$7"
    local device_model_custom="$8"
    local headers_fragment=""
    local hwid device_os version_os device_model
    local hwid_headers_enabled=0

    # 1. Build HWID headers as arrays if enabled
    case "$hwid_enabled" in
    1 | real)
        hwid=$(sysinfo_hwid_generate)
        device_os=$(sysinfo_get_os_name)
        version_os=$(sysinfo_get_os_version)
        device_model=$(sysinfo_get_hw_model)
        hwid_headers_enabled=1
        ;;
    spoofed)
        hwid="$hwid_custom"
        device_os="$device_os_custom"
        version_os="$version_os_custom"
        device_model="$device_model_custom"
        hwid_headers_enabled=1
        ;;
    *) ;;
    esac

    if [ "$hwid_headers_enabled" -eq 1 ]; then
        headers_fragment=$(printf '"x-hwid":["%s"],"x-os":["%s"],"x-os-version":["%s"],"x-device-model":["%s"]' \
            "$(str_json_escape "$hwid")" \
            "$(str_json_escape "$device_os")" \
            "$(str_json_escape "$version_os")" \
            "$(str_json_escape "$device_model")")
    fi

    # 2. Build Authorization header as array if auth token is set
    if [ -n "$auth_token" ]; then
        local auth_entry
        auth_entry=$(printf '"Authorization":["%s"]' "$(str_json_escape "$auth_token")")

        headers_fragment="${headers_fragment:+$headers_fragment,}$auth_entry"
    fi

    # 3. Build User-Agent header as array if user_agent is set
    if [ -n "$user_agent" ]; then
        local ua_entry
        ua_entry=$(printf '"User-Agent":["%s"]' "$(str_json_escape "$user_agent")")

        headers_fragment="${headers_fragment:+$headers_fragment,}$ua_entry"
    fi

    # 4. Build AGE public key header if set
    if [ -n "$age_pub_key" ]; then
        local age_pub_entry
        age_pub_entry=$(printf '"X-Age-Public-Key":["%s"]' "$(str_json_escape "$age_pub_key")")

        headers_fragment="${headers_fragment:+$headers_fragment,}$age_pub_entry"
    fi

    # Final output generation
    if [ -n "$headers_fragment" ]; then
        OUT_TEMPLATE=$(printf '"header":{%s}' "$headers_fragment")
    else
        OUT_TEMPLATE=""
    fi
}

yaml_proxy_provider_append() {
    local name="$1" url="$2" override_routing_mark="$3" override_ip_version="$4"
    local interval="$5" size_limit="$6" filter="$7" exclude_filter="$8" exclude_type="$9"
    local proxy="${10}" override_dialer_proxy="${11}" override_interface_name="${12}"
    local header_authorization="${13}" header_hwid="${14}" header_hwid_custom="${15}"
    local header_os_custom="${16}" header_os_version_custom="${17}" header_device_model_custom="${18}"
    local header_user_agent="${19}" age_private_key="${20}" header_age_public_key="${21}"
    local health_check="${22}" hc_expected_status="${23}" hc_url="${24}"
    local hc_interval="${25}" hc_timeout="${26}" hc_lazy="${27}" reality_mlkem768="${28}"
    local provider_json headers

    headers=""
    header_user_agent=$(resolve_user_agent "$header_user_agent")
    template_headers \
        "$header_hwid" "$header_authorization" "$header_user_agent" "$header_age_public_key" \
        "$header_hwid_custom" "$header_os_custom" "$header_os_version_custom" "$header_device_model_custom"
    headers="$OUT_TEMPLATE"
    hc_lazy=$(fmt_uci_bool_as_yaml "$hc_lazy")

    template_proxy_provider \
        "$url" "$interval" "$size_limit" "$proxy" "$filter" "$exclude_filter" "$exclude_type" \
        "$override_dialer_proxy" "$override_interface_name" "$override_routing_mark" "$override_ip_version" "$headers" \
        "$health_check" "$hc_url" "$hc_expected_status" "$hc_interval" "$hc_timeout" "$hc_lazy" \
        "$age_private_key" "$reality_mlkem768"
    provider_json="$OUT_TEMPLATE"

    OUT_PROXY_PROVIDERS="$OUT_PROXY_PROVIDERS\"$(str_json_escape "$name")\":$provider_json,"
}
