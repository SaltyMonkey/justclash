#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC2154

CONFIG_FLAG_TYPE='or("0","1")'

# Validate through UCI and apply missing defaults to the loaded configuration.
config_section_validate() {
    local config_schema_type="$1" config_schema_section="$2"
    local config_schema_spec config_schema_option config_schema_value config_schema_result
    local config_schema_tail config_schema_head config_schema_default config_schema_escaped
    shift 2

    /sbin/validate_data "$PROGNAME" "$config_schema_type" "$config_schema_section" "$@" \
        >/dev/null 2>&1
    config_schema_result=$?
    # config_foreach does not collect failures; the last section gets no pardon.
    [ "$config_schema_result" -eq 0 ] || validation_failed=1

    for config_schema_spec in "$@"; do
        config_schema_option="${config_schema_spec%%:*}"
        if [ "$config_schema_result" -ne 0 ]; then
            /sbin/validate_data "$PROGNAME" "$config_schema_type" "$config_schema_section" \
                "$config_schema_spec" >/dev/null 2>&1 ||
                log error "Invalid configuration option: $config_schema_type.$config_schema_option"
        fi
        config_get config_schema_value "$config_schema_section" "$config_schema_option"
        [ -z "$config_schema_value" ] || continue

        config_schema_tail="${config_schema_spec#*:}"
        config_schema_default=""
        while [ "$config_schema_tail" != "${config_schema_tail#*:}" ]; do
            config_schema_head="${config_schema_tail%%:*}"
            config_schema_tail="${config_schema_tail#*:}"
            config_schema_escaped=0
            while [ "$config_schema_head" != "${config_schema_head%\\}" ]; do
                config_schema_head="${config_schema_head%\\}"
                config_schema_escaped=$((1 - config_schema_escaped))
            done
            [ "$config_schema_escaped" -eq 0 ] || continue
            config_schema_default="$config_schema_tail"
            break
        done

        # The native parser truncates colon-containing defaults, including URLs.
        [ -n "$config_schema_default" ] || continue
        config_set "$config_schema_section" "$config_schema_option" "$config_schema_default"
    done

    return "$config_schema_result"
}

validate_main_section() {
    local cron_type='regex("([-0-9*/]|\,)+([ 	]+([-0-9*/]|\,)+){4}")'
    local https_url_type='regex("^https\://.+$")'

    config_section_validate main "${1:-}" \
        "ipv6_enabled:$CONFIG_FLAG_TYPE:$DEFAULT_IPV6_ENABLED" \
        "ntpd_start:$CONFIG_FLAG_TYPE:$DEFAULT_NTPD_START" \
        "nft_apply_changes:$CONFIG_FLAG_TYPE:$DEFAULT_NFT_APPLY_CHANGES" \
        "dnsmasq_apply_changes:$CONFIG_FLAG_TYPE:$DEFAULT_DNSMASQ_APPLY_CHANGES" \
        "mihomo_persistent_ext_rules:$CONFIG_FLAG_TYPE:$DEFAULT_MIHOMO_PERSISTENT_EXT_RULES" \
        "mihomo_persistent_cache:$CONFIG_FLAG_TYPE:$DEFAULT_MIHOMO_PERSISTENT_CACHE" \
        "mihomo_autorestart:$CONFIG_FLAG_TYPE:0" \
        "mihomo_service_data_autoupdate:$CONFIG_FLAG_TYPE:0" \
        "mihomo_scheduled_work:$CONFIG_FLAG_TYPE:0" \
        "mihomo_mem_limit:uinteger(10):$DEFAULT_MIHOMO_MEM_LIMIT" \
        "mihomo_gogc:uinteger(10):$DEFAULT_MIHOMO_GOGC" \
        "mihomo_gomaxprocs:uinteger(10):$DEFAULT_MIHOMO_GOMAXPROCS" \
        "routing_mode:or(\"full\",\"partial\"):$DEFAULT_ROUTING_MODE" \
        "pbr_priority:and(uinteger(10),range(1,32766)):$DEFAULT_PBR_PRIORITY" \
        "tproxy_input_interfaces:list(network):$DEFAULT_INPUT_INTERFACE" \
        'nft_ports_exclude:list(and(port,min(1)))' \
        'nft_ports_exclude_router:list(and(port,min(1)))' \
        "nft_quic_mode:or(\"BY RULES\",\"DROP\"):$DEFAULT_NFT_MODE" \
        "nft_dot_mode:or(\"BY RULES\",\"DROP\"):$DEFAULT_NFT_MODE" \
        "nft_dot_quic_mode:or(\"BY RULES\",\"DROP\"):$DEFAULT_NFT_MODE" \
        "nft_doh_mode:or(\"BY RULES\",\"DROP\"):$DEFAULT_NFT_MODE" \
        "nft_dns_mode:or(\"BY RULES\",\"DROP\",\"HIJACK\"):$DEFAULT_NFT_MODE" \
        "nft_ntp_mode:or(\"BY RULES\",\"DROP\",\"DIRECT\"):$DEFAULT_NFT_MODE" \
        "nft_ntp_mode_router:or(\"BY RULES\",\"DROP\",\"DIRECT\"):$DEFAULT_NFT_MODE" \
        "mihomo_core_source_type:or(\"github\",\"custom\"):$DEFAULT_MIHOMO_SOURCE_CORE" \
        "mihomo_cron_autorestart_string:$cron_type" \
        "mihomo_cron_service_data_update_string:$cron_type" \
        "mihomo_cron_scheduled_work_start_string:$cron_type:$DEFAULT_SCHEDULED_WORK_START_CRON" \
        "mihomo_cron_scheduled_work_stop_string:$cron_type:$DEFAULT_SCHEDULED_WORK_STOP_CRON" \
        "mihomo_github_channel:string(1):$DEFAULT_MIHOMO_UPDATE_CHANNEL" \
        "mihomo_github_repo:string(1):$DEFAULT_MIHOMO_GITHUB_REPO" \
        "mihomo_rulesets_files_download_url:$https_url_type:$DEFAULT_MIHOMO_RULESETS_FILES_DOWNLOAD_URL" \
        "mihomo_dashboard_zashboard_url:$https_url_type:$DEFAULT_DASHBOARD_ZASHBOARD_URL" \
        "mihomo_dashboard_metacubexd_url:$https_url_type:$DEFAULT_DASHBOARD_METACUBEXD_URL" \
        "mihomo_dashboard_yacd_meta_url:$https_url_type:$DEFAULT_DASHBOARD_YACD_META_URL" \
        "mihomo_geosite_url:$https_url_type:$DEFAULT_GEOSITE_URL" \
        "mihomo_geoip_url:$https_url_type:$DEFAULT_GEOIP_URL"
}

validate_proxy_section() {
    config_section_validate proxy "${1:-}" \
        "use_dashboard:$CONFIG_FLAG_TYPE:0" \
        "api_tls:$CONFIG_FLAG_TYPE:$DEFAULT_API_TLS" \
        "use_mixed_port:$CONFIG_FLAG_TYPE:0" \
        "core_ntp_enabled:$CONFIG_FLAG_TYPE:0" \
        "geodata_autoupdate:$CONFIG_FLAG_TYPE:0" \
        "geodata_mode:$CONFIG_FLAG_TYPE:0" \
        "unified_delay:$CONFIG_FLAG_TYPE:0" \
        "tcp_concurrent:$CONFIG_FLAG_TYPE:0" \
        "etag_support:$CONFIG_FLAG_TYPE:0" \
        "use_system_hosts:$CONFIG_FLAG_TYPE:0" \
        "profile_store_selected:$CONFIG_FLAG_TYPE:0" \
        "profile_store_fake_ip:$CONFIG_FLAG_TYPE:0" \
        "core_ntp_write_system:$CONFIG_FLAG_TYPE:0" \
        "sniffer_enable:$CONFIG_FLAG_TYPE:0" \
        "sniffer_parse_pure_ip:$CONFIG_FLAG_TYPE:0" \
        "sniffer_override_destination:$CONFIG_FLAG_TYPE:0" \
        "keep_alive_idle:uinteger(10):$DEFAULT_KEEP_ALIVE_IDLE" \
        "keep_alive_interval:uinteger(10):$DEFAULT_KEEP_ALIVE_INTERVAL" \
        "core_ntp_interval:uinteger(10):$DEFAULT_CORE_NTP_INTERVAL" \
        "dns_cache_max_size:uinteger(10):$DEFAULT_DNS_CACHE_MAX_SIZE" \
        "fake_ip_ttl:uinteger(10):$DEFAULT_FAKE_IP_TTL" \
        "geodata_autoupdate_interval:uinteger(10):$DEFAULT_GEODATA_UPDATE_INTERVAL" \
        "tproxy_port:and(port,min(1)):$DEFAULT_TPROXY_PORT" \
        "dns_listen_port:and(port,min(1)):$DEFAULT_DNS_LISTEN_PORT" \
        "mixed_port:and(port,min(1)):$DEFAULT_MIXED_PORT" \
        "mixed_port_bind_interface:or(\"-\",network):$DEFAULT_MIXED_PORT_BIND_INTERFACE" \
        "core_ntp_port:and(port,min(1)):$DEFAULT_NTP_PORT" \
        "controller_bind_interface:or(\"-\",network):$DEFAULT_CONTROLLER_BIND_INTERFACE" \
        'interface_name:network' \
        "api_tls_cert:regex(\"/.*\"):$DEFAULT_API_TLS_CERT_PATH" \
        "api_tls_key:regex(\"/.*\"):$DEFAULT_API_TLS_KEY_PATH" \
        'fake_ip_range:cidr4' \
        'fake_ip_range6:cidr6' \
        "dashboard_repo:string(1):$DEFAULT_EXTERNAL_PANEL"
}

validate_block_rules_section() {
    config_section_validate block_rules "${1:-}" \
        "enabled:$CONFIG_FLAG_TYPE:1" \
        "list_update_interval:uinteger(10):$DEFAULT_RULESET_INTERVAL" \
        'size_limit:uinteger(10):10485760' \
        "proxy:and(maxlength(64),regex(\"[-A-Za-z0-9_]+\")):$DEFAULT_PROXY"
}

validate_mixed_port_rules_section() {
    config_section_validate mixed_port_rules "${1:-}" \
        "exit_rule:or(\"BY RULES\",and(maxlength(64),regex(\"[-A-Za-z0-9_]+\"))):$DEFAULT_PROXY"
}

validate_final_rules_section() {
    config_section_validate final_rules "${1:-}" \
        "exit_rule:and(maxlength(64),regex(\"[-A-Za-z0-9_]+\")):$DEFAULT_PROXY"
}

validate_proxy_provider_section() {
    local name_type='and(maxlength(64),regex("[-A-Za-z0-9_]+"))'
    local http_url_type='regex("https?\://.+")'

    config_section_validate proxy_provider "${1:-}" \
        'enabled:bool:1' \
        "name:$name_type" \
        "subscription:$http_url_type" \
        "override_dialer_proxy:$name_type" \
        'override_interface_name:network' \
        'override_routing_mark:and(uinteger,range(1,2147483647),not(or(range(3,3),range(255,255))))' \
        'override_ip_version:or("dual","ipv4","ipv6","ipv4-prefer","ipv6-prefer"):dual' \
        'override_reality_mlkem768:bool:0' \
        "update_interval:uinteger(10):$DEFAULT_PROVIDERUPDATE_INTERVAL" \
        'size_limit:uinteger(10):10485760' \
        "proxy:$name_type:$DEFAULT_PROXY" \
        'header_hwid:or("real","spoofed")' \
        'header_hwid_custom:string' \
        'header_os_custom:string' \
        'header_os_version_custom:string' \
        'header_device_model_custom:string' \
        'header_authorization:string' \
        'header_user_agent:string' \
        'age_private_key:regex("AGE-SECRET-KEY.*")' \
        'header_age_public_key:regex("age1.*")' \
        'health_check:bool:0' \
        "health_check_url:$http_url_type:$DEFAULT_HEALTHCHECK_URL" \
        "health_check_expected_status:and(uinteger(10),range(100,599)):$DEFAULT_HEALTHCHECK_RESULT" \
        "health_check_interval:and(uinteger(10),range(1,31536000)):$DEFAULT_HEALTHCHECK_INTERVAL" \
        "health_check_timeout:and(uinteger(10),range(100,60000)):$DEFAULT_HEALTHCHECK_TIMEOUT" \
        'health_check_lazy:bool:0' \
        'filter:string' \
        'exclude_filter:string' \
        'exclude_type:string'
}

validate_proxies_section() {
    local name_type='and(maxlength(64),regex("[-A-Za-z0-9_]+"))'

    config_section_validate proxies "${1:-}" \
        'enabled:bool:1' \
        "name:$name_type" \
        'mode:or("object","uri"):uri' \
        'proxy_link_object:string(1)' \
        'proxy_link_uri:string(1)' \
        "dialer_proxy:$name_type" \
        'interface_name:network' \
        'routing_mark:and(uinteger,range(1,2147483647),not(or(range(3,3),range(255,255))))' \
        'ip_version:or("dual","ipv4","ipv6","ipv4-prefer","ipv6-prefer"):dual' \
        'enabled_list:list(string(1))' \
        'use_proxy_for_list_update:bool:0' \
        "list_update_interval:uinteger(10):$DEFAULT_RULESET_INTERVAL" \
        'size_limit:uinteger(10):10485760' \
        'enabled_geosite_list:list(string(1))' \
        'enabled_geoip_list:list(string(1))' \
        'additional_udp_dst_port_route:list(and(port,min(1)))' \
        'additional_tcp_dst_port_route:list(and(port,min(1)))' \
        'additional_domain_route:list(string(1))' \
        'additional_destip_route:list(cidr)' \
        'additional_srcip_route:list(cidr)'
}

validate_proxy_group_section() {
    local name_type='and(maxlength(64),regex("[-A-Za-z0-9_]+"))'
    local http_url_type='regex("https?\://.+")'
    local section="${1:-}" group_type

    config_get group_type "$section" group_type
    if [ "$group_type" = "select" ]; then
        set -- \
            "check_url:$http_url_type" \
            'expected_status:and(uinteger(10),range(100,599))' \
            'check_interval:and(uinteger(10),range(1,31536000))' \
            'check_timeout:and(uinteger(10),range(100,60000))' \
            'max_failed_times:and(uinteger(10),range(1,100))' \
            'lazy:bool'
    else
        set -- \
            "check_url:$http_url_type:$DEFAULT_HEALTHCHECK_URL" \
            "expected_status:and(uinteger(10),range(100,599)):$DEFAULT_HEALTHCHECK_RESULT" \
            "check_interval:and(uinteger(10),range(1,31536000)):$DEFAULT_GROUP_HEALTHCHECK_INTERVAL" \
            "check_timeout:and(uinteger(10),range(100,60000)):$DEFAULT_HEALTHCHECK_TIMEOUT" \
            "max_failed_times:and(uinteger(10),range(1,100)):$DEFAULT_HEALTHCHECK_MAX_FAILED_TIMES" \
            'lazy:bool:0'
    fi

    config_section_validate proxy_group "$section" \
        'enabled:bool:1' \
        "name:$name_type" \
        'group_type:or("select","fallback","load-balance","url-test")' \
        'strategy:or("consistent-hashing","round-robin","sticky-sessions")' \
        "proxies:list($name_type)" \
        "providers:list($name_type)" \
        "$@" \
        'tolerance:and(uinteger(10),range(0,10000))' \
        'default_selected:string(1)' \
        'filter:string' \
        'exclude_filter:string' \
        'exclude_type:string' \
        'enabled_list:list(string(1))' \
        'use_proxy_group_for_list_update:bool:0' \
        "list_update_interval:uinteger(10):$DEFAULT_RULESET_INTERVAL" \
        'size_limit:uinteger(10):10485760' \
        'enabled_geosite_list:list(string(1))' \
        'enabled_geoip_list:list(string(1))' \
        'additional_udp_dst_port_route:list(and(port,min(1)))' \
        'additional_tcp_dst_port_route:list(and(port,min(1)))' \
        'additional_domain_route:list(string(1))' \
        'additional_destip_route:list(cidr)' \
        'additional_srcip_route:list(cidr)'
}

# Validate and apply defaults to the loaded configuration in memory once.
config_validate() {
    local validation_failed=0

    log info "Starting configuration validation"
    validate_main_section settings
    validate_proxy_section proxy
    validate_block_rules_section block_rules
    validate_mixed_port_rules_section mixed_port_rules
    validate_final_rules_section final_rules

    config_foreach validate_proxy_provider_section proxy_provider
    config_foreach validate_proxies_section proxies
    config_foreach validate_proxy_group_section proxy_group
    [ "$validation_failed" -eq 0 ]
} 2>/dev/null
