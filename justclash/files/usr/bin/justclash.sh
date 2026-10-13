#!/bin/ash
# shellcheck shell=dash
# ShellCheck cannot follow runtime imports or ash's dynamically scoped locals.
# shellcheck disable=SC2154

set -f # Disable path expansion (globbing) globally to safely iterate over user-defined lists containing *

# --------------------------------------------
# Main application orchestration
# UCI option types and defaults are applied once when the configuration loads.
# constants.sh supplies service constants, DEFAULT_* fallbacks and readonly
# NL (newline), CR and TAB before helpers and configuration modules load.
# NL separates collected UCI list values and the per-build nftables sidecar records.
# --------------------------------------------

# Simple self contained function for file import
# Will write logs at fail and call exit
import() {
    local file

    for file in "$@"; do
        # shellcheck disable=SC1090
        if ! . "$file" 2>/dev/null; then
            printf "error: Failed to load file %s\n" "$file" >&2
            logger -p "user.err" -t "${PROGNAME:-justclash}" "Failed to load file $file"
            exit 1
        fi
    done
}

import /usr/lib/justclash/constants.sh

cli_confirm_destructive() {
    local prompt="$1"
    local assume_yes="$2"
    local answer

    case "$assume_yes" in
    -y | -Y | --yes) return 0 ;;
    '') ;;
    *)
        printf 'error: Expected -y, -Y, or --yes\n' >&2
        return 2
        ;;
    esac

    [ -t 0 ] || {
        printf 'error: This command requires -y, -Y, or --yes in non-interactive mode\n' >&2
        return 2
    }

    printf '%s [y/N] ' "$prompt" >&2
    read -r answer || return 2

    case "$answer" in
    y | Y | yes | YES) return 0 ;;
    *)
        printf 'Cancelled.\n' >&2
        return 2
        ;;
    esac
}

core_prepare_safe_paths() {
    local api_tls="$1"
    local api_tls_cert="$2"
    local api_tls_key="$3"
    local mihomo_persistent_ext_rules="$4"
    local cert_dir key_dir
    local ruleset_file ruleset_label ruleset_id ruleset_behavior ruleset_format ruleset_url ruleset_auth safe_path

    safe_paths_clear
    safe_paths_add "$DASHBOARD_PATH"

    # 1. API TLS Cert/Key Paths
    if [ "$api_tls" -eq 1 ]; then
        cert_dir=$(readlink -f "$(dirname "$api_tls_cert")" 2>/dev/null || realpath "$(dirname "$api_tls_cert")" 2>/dev/null)
        key_dir=$(readlink -f "$(dirname "$api_tls_key")" 2>/dev/null || realpath "$(dirname "$api_tls_key")" 2>/dev/null)
        [ -n "$cert_dir" ] && safe_paths_add "$cert_dir"
        [ -n "$key_dir" ] && safe_paths_add "$key_dir"
    fi

    # 2. Persistent rulesets path
    if [ "$mihomo_persistent_ext_rules" -eq 1 ]; then
        safe_paths_add "$SYMLINKDIR_RULESETS"
    fi

    # 3. Custom local ruleset paths from user ruleset text files
    for ruleset_file in "$USER_RULESETS_FILE" "$USER_RULESETS_BLOCKS_FILE"; do
        [ -f "$ruleset_file" ] && [ -r "$ruleset_file" ] || continue
        # Keep the loop in this shell; exporting from a subshell is not a return channel.
        while IFS='|' read -r ruleset_label ruleset_id ruleset_behavior ruleset_format ruleset_url ruleset_auth || [ -n "$ruleset_url" ]; do
            case "$ruleset_label" in \#*) continue ;; esac
            ruleset_url=$(str_trim "$ruleset_url")
            case "$ruleset_url" in /*) ;; *) continue ;; esac
            safe_path=$(readlink -f "$(dirname "$ruleset_url")" 2>/dev/null || realpath "$(dirname "$ruleset_url")" 2>/dev/null)
            [ -n "$safe_path" ] && safe_paths_add "$safe_path"
        done <"$ruleset_file"
    done
    return 0
}

core_controller_address_read() {
    local controller_bind_interface router_selected_ipaddr

    config_get controller_bind_interface proxy controller_bind_interface
    network_flush_cache
    if [ "$controller_bind_interface" = "$CONTROLLER_BIND_UNSPECIFIED" ]; then
        router_selected_ipaddr="$CONTROLLER_BIND_ALL_IPV4"
    elif ! network_get_ipaddr router_selected_ipaddr "$controller_bind_interface" ||
        [ -z "$router_selected_ipaddr" ]; then
        log error "Controller bind network has no IPv4 address. Aborting startup." >&2
        return 1
    fi

    printf '%s' "$router_selected_ipaddr"
}

start() {
    local current_config_hash workdir_status
    local api_tls api_tls_cert api_tls_key dns_listen_port ipv6_enabled mihomo_gogc mihomo_gomaxprocs
    local mihomo_mem_limit mihomo_persistent_cache mihomo_persistent_ext_rules mixed_port nft_apply_changes
    local ntpd_start routing_mode tproxy_port use_mixed_port
    local router_selected_ipaddr
    local core_exit_code preflight_tproxy_port preflight_mixed_port

    if preflight_check_is_already_running "$PROGNAME start" "JustClash" "$CORE_PATH" "$$"; then
        return 0
    fi

    log info "Initializing JustClash service..."

    # Read settings used by this scenario.
    config_get ntpd_start settings ntpd_start
    config_get dns_listen_port proxy dns_listen_port
    config_get tproxy_port proxy tproxy_port
    config_get nft_apply_changes settings nft_apply_changes
    config_get mixed_port proxy mixed_port
    config_get use_mixed_port proxy use_mixed_port
    config_get api_tls proxy api_tls
    config_get api_tls_cert proxy api_tls_cert
    config_get api_tls_key proxy api_tls_key
    config_get mihomo_persistent_ext_rules settings mihomo_persistent_ext_rules
    config_get mihomo_persistent_cache settings mihomo_persistent_cache
    config_get mihomo_mem_limit settings mihomo_mem_limit
    config_get mihomo_gogc settings mihomo_gogc
    config_get mihomo_gomaxprocs settings mihomo_gomaxprocs
    config_get routing_mode settings routing_mode
    config_get ipv6_enabled settings ipv6_enabled

    if [ "$nft_apply_changes" = "1" ]; then
        preflight_tproxy_port="$tproxy_port"
    else
        preflight_tproxy_port=""
    fi

    preflight_mixed_port=""
    [ "$use_mixed_port" = "1" ] && preflight_mixed_port="$mixed_port"

    if [ -n "$ENV_JUSTCLASH_WAIT_WAN_MAX" ] && [ "$ENV_JUSTCLASH_WAIT_WAN_MAX" -gt 0 ]; then
        log info "Waiting for WAN (max ${ENV_JUSTCLASH_WAIT_WAN_MAX}s)..."
        local waited=0
        while [ "$waited" -lt "$ENV_JUSTCLASH_WAIT_WAN_MAX" ]; do
            if ip -4 route show default 2>/dev/null | grep -q default ||
                ip -6 route show default 2>/dev/null | grep -q default; then
                break
            fi
            sleep 1
            waited=$((waited + 1))
        done
    fi

    if [ -n "$ENV_JUSTCLASH_BOOT_DELAY" ] && [ "$ENV_JUSTCLASH_BOOT_DELAY" -gt 0 ]; then
        log info "Delaying start by ${ENV_JUSTCLASH_BOOT_DELAY}s..."
        sleep "$ENV_JUSTCLASH_BOOT_DELAY"
    fi

    router_selected_ipaddr=$(core_controller_address_read) || {
        log error "Controller address resolution failed. Aborting startup."
        return 1
    }

    preflight_check_requirement "$CORE_PATH" "$CORE_BIN_NAME" "$REQUIRED_TOOLS" || {
        log error "System requirement checks failed. Aborting startup."
        return 1
    }

    log info "Checking port configuration collisions"
    preflight_check_port_collisions \
        "$dns_listen_port" \
        "$preflight_tproxy_port" \
        "$preflight_mixed_port" \
        "$DEFAULT_EXTERNAL_CONTROLLER_PORT" || {
        log error "Port configuration validation failed. Aborting startup."
        return 1
    }

    log info "Checking active ports availability"
    preflight_check_ports_occupancy \
        "$dns_listen_port" \
        "$preflight_tproxy_port" \
        "$preflight_mixed_port" \
        "$DEFAULT_EXTERNAL_CONTROLLER_PORT" || {
        log error "Active ports check failed. Aborting startup."
        return 1
    }

    log info "Checking for non-critical conflicts"
    preflight_check_conflicts_warn \
        "$RESOLVCONF_FILEPATH" \
        "$ZAPRETINITD_FILEPATH" \
        "$BYEDPI_FILEPATH" \
        "$YOUTUBEUNBLOCK_FILEPATH" \
        "$B4_FILEPATH"

    log info "Fixing known compatibility problems"
    compat_fixes

    log info "Synchronizing system time"
    # Time synchronization is best effort; configuration was checked above.
    ntpd_force_sync "$ntpd_start" "$DEFAULT_NTP_IPS"

    log info "Updating scheduled tasks"
    cron_update || log warn "Scheduled tasks update failed; continuing startup without updated schedules."

    log info "Updating SAFE_PATHS environment variable"
    core_prepare_safe_paths \
        "$api_tls" \
        "$api_tls_cert" \
        "$api_tls_key" \
        "$mihomo_persistent_ext_rules" || {
        log error "Safe paths preparation failed. Aborting startup."
        return 1
    }

    current_config_hash=$(config_hash_filtered "$PROGNAME" "^${PROGNAME}\.settings\.(wait_for_wan|delayed_boot|ntpd_start|mihomo_autorestart|mihomo_cron_|mihomo_service_data_|mihomo_core_|mihomo_github_|mihomo_custom_core_url|mihomo_rulesets_files_download_url)") || {
        log error "Failed to calculate the current configuration hash."
        return 1
    }
    current_config_hash=$(workdir_cache_fingerprint \
        "$current_config_hash" \
        "$router_selected_ipaddr" \
        "$RULESETS_FILE" \
        "$RULESETS_BLOCKS_FILE" \
        "$USER_RULESETS_FILE" \
        "$USER_RULESETS_BLOCKS_FILE") || {
        log error "Failed to calculate the YAML input fingerprint."
        return 1
    }

    log info "Preparing Mihomo working directory"
    core_prepare_workdir \
        "$mihomo_persistent_ext_rules" \
        "$mihomo_persistent_cache" \
        "$current_config_hash"
    workdir_status=$?

    case "$workdir_status" in
    0)
        log info "Validating cached YAML configuration..."
        core_validate_yaml \
            "$CORE_PATH" \
            "$CORE_WORKDIR_PATH" \
            "$OUTPUT_YAML_CONFIG_PATH" || {
            log error "Configuration validation failed. Aborting startup."
            return 1
        }
        ;;
    1)
        log info "Generating YAML configuration..."
        core_generate_yaml "$router_selected_ipaddr" || {
            log error "YAML configuration generation failed. Aborting startup."
            return 1
        }
        workdir_cache_commit "$current_config_hash" "$CORE_WORKDIR_UCI_HASH_PATH" || {
            log error "Failed to commit the generated configuration cache."
            return 1
        }
        ;;
    *)
        log error "Working directory preparation failed. Aborting startup."
        return 1
        ;;
    esac

    log info "Configuring tproxy routing and creating NFTables table"
    run_nftables_apply || {
        log error "Firewall configuration failed. Aborting startup."
        return 1
    }

    log info "Modifying dnsmasq configuration"
    run_dnsmasq_update || {
        log error "Dnsmasq configuration failed. Aborting startup."
        run_dnsmasq_restore || log error "Dnsmasq rollback failed; backup retained."
        nf_table_remove
        return 1
    }

    nft_sets_watch_start \
        "$routing_mode" \
        "$nft_apply_changes" \
        "$ipv6_enabled" \
        "$ACTIVE_IPCIDR_RULESETS_PATH" \
        "$CORE_WORKDIR_RULES_PATH" \
        "$ASYNC_WORKER_PID_PATH"

    log info "Starting Mihomo core"
    start_core "$mihomo_mem_limit" "$mihomo_gogc" "$mihomo_gomaxprocs"
    core_exit_code=$?

    nft_async_worker_stop "$ASYNC_WORKER_PID_PATH"

    log warn "Mihomo core exited; restoring networking changes."
    run_dnsmasq_restore || core_exit_code=1
    nf_table_remove

    return "$core_exit_code"
}

stop() {
    local stop_status=0
    log info "Stopping JustClash service..."

    nft_async_worker_stop "$ASYNC_WORKER_PID_PATH"

    log info "Removing tproxy routing and NFTables table"
    nf_table_remove

    log info "Restoring default dnsmasq configuration"
    run_dnsmasq_restore || stop_status=1

    log info "Stopping core process"
    stop_core || stop_status=1
    return "$stop_status"
}

# WARNING: TRY TO NOT USE FUNC MANUALLY - MUST CLEAR ROUTES AND DNSMASQ
start_core() {
    local mihomo_mem_limit="$1"
    local mihomo_gogc="$2"
    local mihomo_gomaxprocs="$3"
    local attempt=0
    local exit_code=0

    log info "Starting core with up to $DEFAULT_CORE_RESTART_RETRIES retries"

    # shellcheck disable=SC2154
    if [ "$ENV_JUSTCLASH_RUN_CONTEXT" = "procd" ]; then
        while [ "$attempt" -lt "$DEFAULT_CORE_RESTART_RETRIES" ]; do
            (
                set -o pipefail
                if [ -n "$mihomo_mem_limit" ] && [ "$mihomo_mem_limit" != "0" ]; then
                    # shellcheck disable=SC2030
                    export GOMEMLIMIT="${mihomo_mem_limit}MiB"
                fi
                if [ -n "$mihomo_gogc" ] && [ "$mihomo_gogc" != "0" ]; then
                    # shellcheck disable=SC2030
                    export GOGC="$mihomo_gogc"
                fi
                if [ -n "$mihomo_gomaxprocs" ] && [ "$mihomo_gomaxprocs" != "$DEFAULT_MIHOMO_GOMAXPROCS" ]; then
                    # shellcheck disable=SC2030
                    export GOMAXPROCS="$mihomo_gomaxprocs"
                fi
                "$CORE_PATH" -d "$CORE_WORKDIR_PATH" 2>&1 | log_piped
            )
            exit_code=$?
            if [ "$exit_code" -eq 0 ] || [ "$exit_code" -eq 130 ] || [ "$exit_code" -eq 143 ] || [ "$exit_code" -eq 137 ]; then
                log info "Procd mode: Mihomo stopped gracefully"
                break
            fi

            log warn "Procd mode: Mihomo exited with code $exit_code"
            attempt=$((attempt + 1))
            log error "Procd mode: Mihomo crashed, attempt $attempt of $DEFAULT_CORE_RESTART_RETRIES"

            if [ "$attempt" -ge "$DEFAULT_CORE_RESTART_RETRIES" ]; then
                log error "Procd mode: failed to restart Mihomo after $DEFAULT_CORE_RESTART_RETRIES attempts; exiting"
                return "$exit_code"
            fi

            sleep 2
        done
    else
        # shellcheck disable=SC2030,SC2031
        (
            set -o pipefail
            if [ -n "$mihomo_mem_limit" ] && [ "$mihomo_mem_limit" != "0" ]; then
                export GOMEMLIMIT="${mihomo_mem_limit}MiB"
            fi
            if [ -n "$mihomo_gogc" ] && [ "$mihomo_gogc" != "0" ]; then
                export GOGC="$mihomo_gogc"
            fi
            if [ -n "$mihomo_gomaxprocs" ] && [ "$mihomo_gomaxprocs" != "$DEFAULT_MIHOMO_GOMAXPROCS" ]; then
                export GOMAXPROCS="$mihomo_gomaxprocs"
            fi
            "$CORE_PATH" -d "$CORE_WORKDIR_PATH" 2>&1 | log_piped
        )
        exit_code=$?
        if [ "$exit_code" -eq 0 ] || [ "$exit_code" -eq 130 ] || [ "$exit_code" -eq 143 ] || [ "$exit_code" -eq 137 ]; then
            log info "Manual mode: Mihomo stopped gracefully"
        else
            log warn "Manual mode: Mihomo exited with code $exit_code"
            log error "Manual mode: Mihomo crashed; exiting"
            return "$exit_code"
        fi
    fi

    return 0
}

# WARNING: TRY TO NOT USE FUNC MANUALLY - MUST CLEAR ROUTES AND DNSMASQ
stop_core() {
    pids=$(pgrep -f "$(basename "$CORE_PATH")")
    if [ -n "$pids" ]; then
        # DO NOT APPLY "" - STRING MUST BE SPLITTED AUTOMATICALLY
        # shellcheck disable=SC2086
        kill $pids 2>/dev/null
        log info "Core process stopped"
    else
        log info "Core process is not running"
    fi
}

# Reads nftables settings, then applies the selected routing mode.
run_nftables_apply() {
    local fake_ip_range fake_ip_range6 ipv6_enabled nft_apply_changes nft_doh_mode nft_dns_mode
    local nft_dot_mode nft_dot_quic_mode nft_ips_exclude nft_mac_exclude nft_ntp_mode nft_ntp_mode_router
    local nft_ports_exclude nft_ports_exclude_router nft_quic_mode nft_skuid_exclude_router pbr_priority
    local provider_routing_marks proxy_routing_marks routing_mode tproxy_input_interfaces tproxy_port
    local nft_res=0

    # Read settings used by this scenario.
    config_get routing_mode settings routing_mode
    config_get nft_apply_changes settings nft_apply_changes
    config_get tproxy_port proxy tproxy_port
    config_get pbr_priority settings pbr_priority
    config_get fake_ip_range proxy fake_ip_range
    config_get fake_ip_range6 proxy fake_ip_range6
    config_get tproxy_input_interfaces settings tproxy_input_interfaces
    config_get nft_quic_mode settings nft_quic_mode
    config_get nft_dns_mode settings nft_dns_mode
    config_get nft_dot_mode settings nft_dot_mode
    config_get nft_dot_quic_mode settings nft_dot_quic_mode
    config_get nft_doh_mode settings nft_doh_mode
    config_get nft_ntp_mode settings nft_ntp_mode
    config_get nft_ntp_mode_router settings nft_ntp_mode_router
    config_get nft_ports_exclude settings nft_ports_exclude
    config_get nft_ports_exclude_router settings nft_ports_exclude_router
    config_get nft_mac_exclude settings nft_mac_exclude
    config_get nft_ips_exclude settings nft_ips_exclude
    config_get nft_skuid_exclude_router settings nft_skuid_exclude_router
    config_get ipv6_enabled settings ipv6_enabled

    proxy_routing_marks=$(str_trim "$(config_routing_marks_read \
        proxies routing_mark)")
    provider_routing_marks=$(str_trim "$(config_routing_marks_read \
        proxy_provider override_routing_mark)")

    if [ "$nft_apply_changes" = "0" ]; then
        log info "Skipping nftables and PBR setup (disabled in configuration)"
        return 0
    fi

    if [ -z "$fake_ip_range" ] || [ -z "$tproxy_input_interfaces" ] ||
        { [ "$ipv6_enabled" = 1 ] && [ -z "$fake_ip_range6" ]; }; then
        log error "Nftables configuration is missing required options."
        return 1
    fi

    if [ "$routing_mode" = "partial" ]; then
        nft_table_partial_apply \
            "$nft_apply_changes" \
            "$tproxy_port" \
            "$fake_ip_range" \
            "$fake_ip_range6" \
            "$tproxy_input_interfaces" \
            "$nft_quic_mode" \
            "$nft_dot_mode" \
            "$nft_dot_quic_mode" \
            "$nft_ntp_mode" \
            "$nft_ntp_mode_router" \
            "$nft_doh_mode" \
            "$nft_skuid_exclude_router" \
            "$proxy_routing_marks" \
            "$provider_routing_marks" \
            "$nft_ports_exclude" \
            "$nft_ports_exclude_router" \
            "$nft_mac_exclude" \
            "$nft_ips_exclude" \
            "$ipv6_enabled" \
            "$ACTIVE_IPCIDR_RULESETS_PATH" \
            "$ACTIVE_STATIC_IPS_PATH" \
            "$ACTIVE_STATIC_SOURCE_IPS_PATH" \
            "$CORE_WORKDIR_RULES_PATH" \
            "$nft_dns_mode"
        nft_res=$?
    else
        nft_table_full_apply \
            "$nft_apply_changes" \
            "$tproxy_port" \
            "$fake_ip_range" \
            "$fake_ip_range6" \
            "$tproxy_input_interfaces" \
            "$nft_quic_mode" \
            "$nft_dot_mode" \
            "$nft_dot_quic_mode" \
            "$nft_ntp_mode" \
            "$nft_ntp_mode_router" \
            "$nft_doh_mode" \
            "$nft_skuid_exclude_router" \
            "$proxy_routing_marks" \
            "$provider_routing_marks" \
            "$nft_ports_exclude" \
            "$nft_ports_exclude_router" \
            "$nft_mac_exclude" \
            "$nft_ips_exclude" \
            "$ipv6_enabled" \
            "$nft_dns_mode"
        nft_res=$?
    fi

    if [ "$nft_res" -ne 0 ]; then
        return "$nft_res"
    fi

    policy_routing_apply \
        "$NF_TABLE_FWMARK_FINAL" \
        "$NF_ROUTE_TABLE" \
        "$pbr_priority" \
        "$ipv6_enabled"

    log warn "Tproxy: fwmark=$NF_TABLE_FWMARK_FINAL fwmark_proxy=$NF_TABLE_FWMARK_PROXY table=$NF_ROUTE_TABLE priority=$pbr_priority"
}

nf_table_remove() {
    nft_table_remove "$NF_TABLE_NAME"
    policy_routing_remove "$NF_TABLE_FWMARK_FINAL" "$NF_ROUTE_TABLE"

    log info "Tproxy rules and routing were removed"
}

run_dnsmasq_update() {
    local dns_listen_port dnsmasq_apply_changes
    # Read settings used by this scenario.
    config_get dnsmasq_apply_changes settings dnsmasq_apply_changes
    config_get dns_listen_port proxy dns_listen_port

    dnsmasq_update \
        "$dnsmasq_apply_changes" \
        "$dns_listen_port" \
        "$PROGNAME"
}

run_dnsmasq_restore() {
    dnsmasq_restore "$PROGNAME"
}

# Complex YAML section readers live with the scenario that consumes their values.
# Renderers receive normalized values once; ash already makes this interface
# verbose enough without adding a second configuration pass.
config_list_append() {
    local value="$1"
    JC_CONFIG_LIST_VALUE="${JC_CONFIG_LIST_VALUE:+${JC_CONFIG_LIST_VALUE}${NL}}${value}"
}

config_load_list() {
    JC_CONFIG_LIST_VALUE=""
    config_list_foreach "$1" "$2" config_list_append
}

config_proxy_read() {
    local section="$1" callback="$2"
    local name enabled proxy_link_uri dialer_proxy interface_name routing_mark
    local list_update_interval size_limit mode proxy_link_object use_for_update ip_version
    local src_routes enabled_list domain_routes geosite_list destip_routes geoip_list
    config_get name "$section" name
    [ -n "$name" ] || {
        log warn "Skip proxy without name: $section"
        return
    }
    config_get_bool enabled "$section" enabled
    [ "$enabled" -eq 1 ] || {
        log warn "Skip disabled proxy: $section"
        return
    }
    config_get routing_mark "$section" routing_mark
    [ -z "$routing_mark" ] || routing_mark=$(printf '%d' "$routing_mark")
    config_get proxy_link_uri "$section" proxy_link_uri
    config_get dialer_proxy "$section" dialer_proxy
    config_get interface_name "$section" interface_name
    config_get list_update_interval "$section" list_update_interval
    config_get size_limit "$section" size_limit
    config_get mode "$section" mode
    config_get proxy_link_object "$section" proxy_link_object
    config_get_bool use_for_update "$section" use_proxy_for_list_update
    config_get ip_version "$section" ip_version
    config_get src_routes "$section" additional_srcip_route
    config_get enabled_list "$section" enabled_list
    config_get domain_routes "$section" additional_domain_route
    config_get geosite_list "$section" enabled_geosite_list
    config_get destip_routes "$section" additional_destip_route
    config_get geoip_list "$section" enabled_geoip_list
    "$callback" "$name" "$proxy_link_uri" "$dialer_proxy" "$interface_name" "$routing_mark" "$list_update_interval" "$size_limit" "$mode" "$proxy_link_object" "$use_for_update" "$ip_version" "$src_routes" "$enabled_list" "$domain_routes" "$geosite_list" "$destip_routes" "$geoip_list"
}

config_proxy_group_read() {
    local section="$1" callback="$2"
    local name enabled proxies providers group_type strategy check_url expected_status
    local interval timeout max_failed lazy tolerance selected filter exclude_filter exclude_type
    local enabled_list update_interval size_limit use_for_update src_routes domain_routes geosite_list destip_routes geoip_list
    config_get name "$section" name
    [ -n "$name" ] || {
        log warn "Skip proxy group without a name: $section"
        return
    }
    config_get_bool enabled "$section" enabled
    [ "$enabled" -eq 1 ] || {
        log warn "Skip disabled proxy group: $section"
        return
    }
    config_get proxies "$section" proxies
    config_get providers "$section" providers
    [ -n "$proxies" ] || [ -n "$providers" ] || {
        log warn "Skip empty proxy group: $name"
        return
    }
    config_get group_type "$section" group_type
    config_get strategy "$section" strategy
    config_get check_url "$section" check_url
    config_get expected_status "$section" expected_status
    config_get interval "$section" check_interval
    config_get timeout "$section" check_timeout
    config_get max_failed "$section" max_failed_times
    config_get lazy "$section" lazy
    config_get tolerance "$section" tolerance
    config_get selected "$section" default_selected
    config_get filter "$section" filter
    config_get exclude_filter "$section" exclude_filter
    config_get exclude_type "$section" exclude_type
    config_get enabled_list "$section" enabled_list
    config_get update_interval "$section" list_update_interval
    config_get size_limit "$section" size_limit
    config_get_bool use_for_update "$section" use_proxy_group_for_list_update
    config_get src_routes "$section" additional_srcip_route
    config_get domain_routes "$section" additional_domain_route
    config_get geosite_list "$section" enabled_geosite_list
    config_get destip_routes "$section" additional_destip_route
    config_get geoip_list "$section" enabled_geoip_list
    "$callback" "$name" "$proxies" "$providers" "$group_type" "$strategy" "$check_url" "$expected_status" "$interval" "$timeout" "$max_failed" "$lazy" "$tolerance" "$selected" "$filter" "$exclude_filter" "$exclude_type" "$enabled_list" "$update_interval" "$size_limit" "$use_for_update" "$src_routes" "$domain_routes" "$geosite_list" "$destip_routes" "$geoip_list"
}

config_proxy_provider_read() {
    local section="$1" callback="$2"
    local name enabled subscription routing_mark ip_version interval size_limit
    local filter exclude_filter exclude_type proxy dialer interface_name auth hwid hwid_custom os_custom os_version_custom device_model_custom
    local user_agent private_key public_key
    local health_check expected_status check_url check_interval timeout lazy
    local reality_mlkem768
    config_get name "$section" name
    config_get subscription "$section" subscription
    if [ -z "$name" ] || [ -z "$subscription" ]; then
        log warn "Skip proxy provider without a name or subscription"
        return
    fi
    config_get_bool enabled "$section" enabled
    [ "$enabled" -eq 1 ] || {
        log warn "Skip disabled proxy provider: $section"
        return
    }
    config_get routing_mark "$section" override_routing_mark
    [ -z "$routing_mark" ] || routing_mark=$(printf '%d' "$routing_mark")
    config_get ip_version "$section" override_ip_version
    config_get interval "$section" update_interval
    config_get size_limit "$section" size_limit
    config_get filter "$section" filter
    config_get exclude_filter "$section" exclude_filter
    config_get exclude_type "$section" exclude_type
    config_get proxy "$section" proxy
    config_get dialer "$section" override_dialer_proxy
    config_get interface_name "$section" override_interface_name
    config_get auth "$section" header_authorization
    config_get hwid "$section" header_hwid
    config_get hwid_custom "$section" header_hwid_custom
    config_get os_custom "$section" header_os_custom
    config_get os_version_custom "$section" header_os_version_custom
    config_get device_model_custom "$section" header_device_model_custom
    config_get user_agent "$section" header_user_agent
    config_get private_key "$section" age_private_key
    config_get public_key "$section" header_age_public_key
    config_get_bool health_check "$section" health_check
    config_get expected_status "$section" health_check_expected_status
    config_get check_url "$section" health_check_url
    config_get check_interval "$section" health_check_interval
    config_get timeout "$section" health_check_timeout
    config_get_bool lazy "$section" health_check_lazy
    config_get_bool reality_mlkem768 "$section" override_reality_mlkem768
    "$callback" "$name" "$subscription" "$routing_mark" "$ip_version" "$interval" "$size_limit" "$filter" "$exclude_filter" "$exclude_type" "$proxy" "$dialer" "$interface_name" "$auth" "$hwid" "$hwid_custom" "$os_custom" "$os_version_custom" "$device_model_custom" "$user_agent" "$private_key" "$public_key" "$health_check" "$expected_status" "$check_url" "$check_interval" "$timeout" "$lazy" "$reality_mlkem768"
}

# Reads and validates YAML settings, then atomically promotes the generated document.
core_generate_yaml() {
    local router_selected_ipaddr="$1"

    # ash locals are dynamically scoped. Synchronous YAML callbacks update this
    # build state without leaking it into the process-wide environment.
    # OUT_RULES / OUT_RULESETS / OUT_FAKE_IP_RULES: JSON fragments accumulated by
    # rules.sh, groups.sh and proxies.sh, then wrapped and merged below.
    # OUT_PROXY_GROUPS / OUT_PROXIES / OUT_PROXY_PROVIDERS: rendered entities from
    # groups.sh / proxies.sh / providers.sh, copied into the final document here.
    # OUT_NAMES_RULESETS / OUT_NAMES_SUFFIXES / OUT_NAMES_GEOSITE: block DNS selectors
    # returned by rules.sh. OUT_MIXED_RULES / OUT_FINAL_RULES: its final rule arrays.
    local OUT_RULES="[]" OUT_RULESETS="{}" OUT_FAKE_IP_RULES="[]"
    local OUT_PROXY_GROUPS="[]" OUT_PROXIES="[]" OUT_PROXY_PROVIDERS=""
    local OUT_NAMES_RULESETS="" OUT_NAMES_SUFFIXES="" OUT_NAMES_GEOSITE=""
    local OUT_MIXED_RULES="" OUT_FINAL_RULES=""
    # Per-build newline-delimited sidecars, not process-global configuration:
    # NL is the readonly newline from constants.sh, not a literal backslash-n.
    # rules.sh writes name|source to _IPCIDR_RULESETS_BUFFER (all and block modes);
    # rules.sh/groups.sh/proxies.sh append destination CIDRs to _STATIC_IPS_BUFFER;
    # groups.sh/proxies.sh append source CIDRs to _STATIC_SOURCE_IPS_BUFFER.
    # This function writes them to ACTIVE_IPCIDR_RULESETS_PATH,
    # ACTIVE_STATIC_IPS_PATH and ACTIVE_STATIC_SOURCE_IPS_PATH. nftables reads
    # those files, never these locals. Keep writer callbacks in this shell.
    local _IPCIDR_RULESETS_BUFFER="" _STATIC_IPS_BUFFER="" _STATIC_SOURCE_IPS_BUFFER=""
    # Catalog text consumed by rules.sh; _RULESETS_CONTENT is temporarily replaced
    # by _BLOCK_RULESETS_CONTENT while handle_block_rule_section() runs.
    local _RULESETS_CONTENT="" _BLOCK_RULESETS_CONTENT=""
    local JC_CONFIG_LIST_VALUE=""
    # OUT_TEMPLATE is overwritten by each template helper; callers consume it immediately.
    # OUT_BUNDLE_* is overwritten by build_builtin_rules_bundle() in rules.sh:
    # IP_RULES / RULES split IP and other rules; RULESETS holds provider entries;
    # NAMES holds domain selectors; FAKEIPRULES holds Fake-IP selection rules.
    # Section callbacks consume these results before the next bundle is built.
    # GLOBAL_FAKE_IP_EXCLUDE_* are input filters shared with those callbacks.
    # shellcheck disable=SC2034
    local OUT_TEMPLATE="" OUT_BUNDLE_IP_RULES="" OUT_BUNDLE_RULES="" OUT_BUNDLE_RULESETS="" \
        OUT_BUNDLE_NAMES="" OUT_BUNDLE_FAKEIPRULES="" \
        GLOBAL_FAKE_IP_EXCLUDE_RULES="" GLOBAL_FAKE_IP_EXCLUDE_GEOSITES="" \
        GLOBAL_FAKE_IP_EXCLUDE_DOMAINS=""
    local ipv6_enabled
    local use_dashboard dashboard_repo dashboard_url
    local api_password log_level api_tls api_tls_cert api_tls_key interface_name
    local tproxy_port use_mixed_port mixed_port unified_delay tcp_concurrent
    local keep_alive_idle keep_alive_interval global_ua etag_support
    local profile_store_selected profile_store_fake_ip
    local core_ntp_enabled core_ntp_server core_ntp_port core_ntp_interval core_ntp_write_system
    local dns_listen_port dns_cache_max_size use_system_hosts
    local fake_ip_range fake_ip_range6 fake_ip_ttl
    local sniffer_enable sniffer_parse_pure_ip sniffer_override_destination
    local fake_ip_exclude_domains fake_ip_exclude_rulesets fake_ip_exclude_geosites
    local geodata_mode geodata_autoupdate geodata_autoupdate_interval geosite_url geoip_url
    local default_nameserver direct_nameserver proxy_server_nameserver nameserver
    local hosts nameserver_policy proxy_authentication
    local sniffer_force_domain sniffer_exclude_domain sniffer_skip_src_address sniffer_skip_dst_address
    local block_enabled block_enabled_list block_proxy block_update_interval block_size_limit
    local block_geosite_list block_domain_routes block_destip_routes block_geoip_list
    local mixed_exit_rule final_exit_rule
    local effective_interface_name
    local output_yaml_tmp_path active_static_ips_tmp_path active_source_ips_tmp_path active_ipcidr_rulesets_tmp_path
    local render_status

    local fake_ip_filter_data

    local nameserver_policy_custom hosts_content
    local rules_proxies rules_proxygroups rules_block rule_final rule_mixed
    local proxies proxy_groups rule_providers proxy_providers
    local names_rulesets_block_policy names_suffixes_block_policy
    local fake_ip_rules_proxy_groups fake_ip_rules_proxies
    local custom_real_ip_rules custom_real_ip_rulesets custom_real_ip_geosites
    local rulesets_block rulesets_proxygroup rulesets_proxies

    mkdir -p "$CORE_WORKDIR_PATH"

    # Read settings used by this scenario.
    config_get ipv6_enabled settings ipv6_enabled
    config_get use_dashboard proxy use_dashboard
    config_get dashboard_repo proxy dashboard_repo
    dashboard_url=""
    if [ "$use_dashboard" = "1" ]; then
        case "$dashboard_repo" in
        yacd-meta) config_get dashboard_url settings mihomo_dashboard_yacd_meta_url ;;
        zashboard) config_get dashboard_url settings mihomo_dashboard_zashboard_url ;;
        *) config_get dashboard_url settings mihomo_dashboard_metacubexd_url ;;
        esac
    fi
    config_get api_password proxy api_password
    config_get log_level proxy log_level
    config_get api_tls proxy api_tls
    config_get api_tls_cert proxy api_tls_cert
    config_get api_tls_key proxy api_tls_key
    config_get interface_name proxy interface_name
    config_get tproxy_port proxy tproxy_port
    config_get use_mixed_port proxy use_mixed_port
    config_get mixed_port proxy mixed_port
    config_get unified_delay proxy unified_delay
    config_get tcp_concurrent proxy tcp_concurrent
    config_get keep_alive_idle proxy keep_alive_idle
    config_get keep_alive_interval proxy keep_alive_interval
    config_get global_ua proxy global_ua
    config_get etag_support proxy etag_support
    config_get profile_store_selected proxy profile_store_selected
    config_get profile_store_fake_ip proxy profile_store_fake_ip
    config_get core_ntp_enabled proxy core_ntp_enabled
    config_get core_ntp_server proxy core_ntp_server
    config_get core_ntp_port proxy core_ntp_port
    config_get core_ntp_interval proxy core_ntp_interval
    config_get core_ntp_write_system proxy core_ntp_write_system
    config_get dns_listen_port proxy dns_listen_port
    config_get dns_cache_max_size proxy dns_cache_max_size
    config_get use_system_hosts proxy use_system_hosts
    config_get fake_ip_range proxy fake_ip_range
    config_get fake_ip_range6 proxy fake_ip_range6
    config_get fake_ip_ttl proxy fake_ip_ttl
    config_get sniffer_enable proxy sniffer_enable
    config_get sniffer_parse_pure_ip proxy sniffer_parse_pure_ip
    config_get sniffer_override_destination proxy sniffer_override_destination
    config_get fake_ip_exclude_domains proxy fake_ip_exclude_domains
    config_get fake_ip_exclude_rulesets proxy fake_ip_exclude_rulesets
    config_get fake_ip_exclude_geosites proxy fake_ip_exclude_geosites
    config_get geodata_mode proxy geodata_mode
    config_get geodata_autoupdate proxy geodata_autoupdate
    config_get geodata_autoupdate_interval proxy geodata_autoupdate_interval
    config_get geosite_url settings mihomo_geosite_url
    config_get geoip_url settings mihomo_geoip_url

    config_load_list proxy default_nameserver
    default_nameserver="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy direct_nameserver
    direct_nameserver="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy proxy_server_nameserver
    proxy_server_nameserver="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy nameserver
    nameserver="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy hosts
    hosts="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy nameserver_policy
    nameserver_policy="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy sniffer_force_domain
    sniffer_force_domain="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy sniffer_exclude_domain
    sniffer_exclude_domain="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy sniffer_skip_src_address
    sniffer_skip_src_address="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy sniffer_skip_dst_address
    sniffer_skip_dst_address="$JC_CONFIG_LIST_VALUE"
    config_load_list proxy proxy_authentication
    proxy_authentication="$JC_CONFIG_LIST_VALUE"

    config_get block_enabled block_rules enabled
    config_get block_enabled_list block_rules enabled_blocklist
    config_get block_proxy block_rules proxy
    config_get block_update_interval block_rules list_update_interval
    config_get block_size_limit block_rules size_limit
    config_get block_geosite_list block_rules enabled_geosite_blocklist
    config_get block_domain_routes block_rules additional_domain_blockroute
    config_get block_destip_routes block_rules additional_destip_blockroute
    config_get block_geoip_list block_rules enabled_geoip_blocklist
    config_get mixed_exit_rule mixed_port_rules exit_rule
    config_get final_exit_rule final_rules exit_rule
    effective_interface_name="$interface_name"

    global_ua=$(resolve_user_agent "$global_ua")

    [ -n "$effective_interface_name" ] && effective_interface_name=$(str_trim "$effective_interface_name")

    default_nameserver=$(fmt_values_as_json_array "$default_nameserver" "" "    ")
    direct_nameserver=$(fmt_values_as_json_array "$direct_nameserver" "" "    ")
    proxy_server_nameserver=$(fmt_values_as_json_array "$proxy_server_nameserver" "" "    ")
    nameserver=$(fmt_values_as_json_array "$nameserver" "" "    ")
    hosts_content=$(yaml_slash_multimap_build "$hosts") || return 1
    nameserver_policy_custom=$(yaml_slash_multimap_build "$nameserver_policy") || return 1
    sniffer_force_domain=$(fmt_values_as_json_array "$sniffer_force_domain" "" "    ")
    sniffer_exclude_domain=$(fmt_values_as_json_array "$sniffer_exclude_domain" "" "    ")
    sniffer_skip_src_address=$(fmt_values_as_json_array "$sniffer_skip_src_address" "" "    ")
    sniffer_skip_dst_address=$(fmt_values_as_json_array "$sniffer_skip_dst_address" "" "    ")
    proxy_authentication=$(fmt_values_as_json_array "$proxy_authentication" "" "    ")

    # MIXED PORT RULES section
    handle_mixed_port_rules_section "$mixed_exit_rule"
    rule_mixed="$OUT_MIXED_RULES"

    # FINAL RULE section
    handle_final_rule_section "$final_exit_rule"
    rule_final="$OUT_FINAL_RULES"

    # PROXY PROVIDERS section
    OUT_PROXY_PROVIDERS=""
    config_foreach \
        config_proxy_provider_read \
        proxy_provider \
        yaml_proxy_provider_append
    OUT_PROXY_PROVIDERS="{${OUT_PROXY_PROVIDERS%,}}"
    proxy_providers=$(
        printf '%s\n' "$OUT_PROXY_PROVIDERS" |
            yaml_json_format 2
    ) || return 1

    # Load ruleset files once into build-scoped caches to avoid repeated reads and argument copying.
    local user_block_rulesets=""
    if [ -f "$USER_RULESETS_BLOCKS_FILE" ]; then
        user_block_rulesets=$(cat "$USER_RULESETS_BLOCKS_FILE")
    fi
    _BLOCK_RULESETS_CONTENT=$(printf '%s\n%s' "$(cat "$RULESETS_BLOCKS_FILE")" "$user_block_rulesets")

    local user_rulesets=""
    if [ -f "$USER_RULESETS_FILE" ]; then
        user_rulesets=$(cat "$USER_RULESETS_FILE")
    fi
    _RULESETS_CONTENT=$(printf '%s\n%s' "$(cat "$RULESETS_FILE")" "$user_rulesets")

    # Cache exclusions in the current build context so section parsers can skip matching fake-ip rules.
    # Note: Values are wrapped in spaces (" $list ") to allow exact word matching
    # without regex. Using case *" $entry "* avoids partial match bugs
    # (e.g. matching "youtube" inside "youtube_ads").
    # shellcheck disable=SC2034
    GLOBAL_FAKE_IP_EXCLUDE_RULES=" $fake_ip_exclude_rulesets "
    GLOBAL_FAKE_IP_EXCLUDE_GEOSITES=" $fake_ip_exclude_geosites "
    GLOBAL_FAKE_IP_EXCLUDE_DOMAINS=" $fake_ip_exclude_domains "

    # BLOCK section
    # Temporarily swap the build-scoped ruleset cache so downstream builders use
    # blocklist definitions without copying the full database through arguments.
    local _saved_rulesets_content="$_RULESETS_CONTENT"
    _RULESETS_CONTENT="$_BLOCK_RULESETS_CONTENT"
    handle_block_rule_section \
        "$block_enabled" \
        "$block_enabled_list" \
        "$block_proxy" \
        "$block_update_interval" \
        "$block_size_limit" \
        "$block_geosite_list" \
        "$block_domain_routes" \
        "$block_destip_routes" \
        "$block_geoip_list"
    _RULESETS_CONTENT="$_saved_rulesets_content"
    rules_block="$OUT_RULES"
    rulesets_block="$OUT_RULESETS"
    names_rulesets_block_policy="$OUT_NAMES_RULESETS"
    names_suffixes_block_policy="$OUT_NAMES_SUFFIXES"
    names_geosite_block_policy="$OUT_NAMES_GEOSITE"

    # PROXY GROUP section
    OUT_RULES=""
    OUT_RULESETS=""
    OUT_PROXY_GROUPS=""
    OUT_FAKE_IP_RULES=""
    config_foreach \
        config_proxy_group_read \
        proxy_group \
        yaml_proxy_group_append
    OUT_RULES="[${OUT_RULES:-}]"
    OUT_RULESETS="{${OUT_RULESETS:-}}"
    OUT_PROXY_GROUPS="[${OUT_PROXY_GROUPS:-}]"
    OUT_FAKE_IP_RULES="[${OUT_FAKE_IP_RULES:-}]"
    rules_proxygroups="$OUT_RULES"
    rulesets_proxygroup="$OUT_RULESETS"
    proxy_groups="$OUT_PROXY_GROUPS"
    fake_ip_rules_proxy_groups="$OUT_FAKE_IP_RULES"

    # PROXY section
    OUT_RULES=""
    OUT_RULESETS=""
    OUT_PROXIES=""
    OUT_FAKE_IP_RULES=""
    config_foreach \
        config_proxy_read \
        proxies \
        yaml_proxy_append
    OUT_RULES="[${OUT_RULES:-}]"
    OUT_RULESETS="{${OUT_RULESETS:-}}"
    OUT_PROXIES="[${OUT_PROXIES:-}]"
    OUT_FAKE_IP_RULES="[${OUT_FAKE_IP_RULES:-}]"
    rules_proxies="$OUT_RULES"
    rulesets_proxies="$OUT_RULESETS"
    proxies="$OUT_PROXIES"
    fake_ip_rules_proxies="$OUT_FAKE_IP_RULES"

    nameserver_policy=$(yaml_nameserver_policy_build \
        "$nameserver_policy_custom" \
        "$names_rulesets_block_policy" \
        "$names_suffixes_block_policy" \
        "$names_geosite_block_policy") || return 1

    custom_real_ip_rules=$(build_fake_ip_rule_array "$fake_ip_exclude_domains" "DOMAIN-SUFFIX" "real-ip")

    custom_real_ip_rulesets=$(build_fake_ip_rule_array "$fake_ip_exclude_rulesets" "RULE-SET" "real-ip")
    custom_real_ip_geosites=$(build_fake_ip_rule_array "$fake_ip_exclude_geosites" "GEOSITE" "real-ip")

    fake_ip_filter_data=$(yaml_fake_ip_filter_build \
        "$custom_real_ip_rules" \
        "$custom_real_ip_rulesets" \
        "$custom_real_ip_geosites" \
        "$fake_ip_rules_proxy_groups" \
        "$fake_ip_rules_proxies") || return 1

    proxies=$(
        printf '%s\n' "$proxies" |
            yaml_json_format 2
    ) || return 1

    proxy_groups=$(
        printf '%s\n' "$proxy_groups" |
            yaml_json_format 2
    ) || return 1

    rule_providers=$(yaml_rule_providers_merge \
        "$rulesets_block" \
        "$rulesets_proxygroup" \
        "$rulesets_proxies") || return 1

    rules=$(yaml_rules_merge \
        "$rule_mixed" \
        "$rules_block" \
        "$rules_proxygroups" \
        "$rules_proxies" \
        "$rule_final") || return 1

    output_yaml_tmp_path=$(mktemp "${OUTPUT_YAML_CONFIG_PATH}.XXXXXX") || {
        log error "Failed to create a temporary YAML configuration."
        return 1
    }
    active_static_ips_tmp_path=$(mktemp "${ACTIVE_STATIC_IPS_PATH}.XXXXXX") || {
        log error "Failed to create a temporary static IP cache."
        rm -f "$output_yaml_tmp_path"
        return 1
    }
    active_source_ips_tmp_path=$(mktemp "${ACTIVE_STATIC_SOURCE_IPS_PATH}.XXXXXX") || {
        log error "Failed to create a temporary source IP cache."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path"
        return 1
    }
    active_ipcidr_rulesets_tmp_path=$(mktemp "${ACTIVE_IPCIDR_RULESETS_PATH}.XXXXXX") || {
        log error "Failed to create a temporary IPCIDR ruleset cache."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path"
        return 1
    }
    chmod 600 "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path" || {
        log error "Failed to secure temporary configuration artifacts."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    }

    {
        yaml_document_write_access \
            "$use_mixed_port" \
            "$mixed_port" \
            "$proxy_authentication" \
            "$use_dashboard" \
            "$DASHBOARD_PATH" \
            "$dashboard_url" \
            "$effective_interface_name" \
            "$ipv6_enabled" \
            "$api_tls" \
            "$router_selected_ipaddr" \
            "$DEFAULT_EXTERNAL_CONTROLLER_PORT" \
            "$api_password" \
            "$api_tls_cert" \
            "$api_tls_key" \
            "$log_level" \
            "$unified_delay" \
            "$tcp_concurrent" \
            "$NF_TABLE_FWMARK_PROXY" \
            "$global_ua" \
            "$etag_support" \
            "$keep_alive_idle" \
            "$keep_alive_interval" \
            "$profile_store_selected" \
            "$profile_store_fake_ip"
        yaml_document_write_geodata \
            "$geodata_mode" \
            "$geodata_autoupdate" \
            "$geodata_autoupdate_interval" \
            "$geoip_url" \
            "$geosite_url"
        yaml_document_write_listeners \
            "$tproxy_port" \
            "$ipv6_enabled"
        yaml_document_write_services \
            "$hosts_content" \
            "$core_ntp_enabled" \
            "$core_ntp_write_system" \
            "$core_ntp_server" \
            "$core_ntp_port" \
            "$core_ntp_interval" \
            "$rule_providers"
        yaml_document_write_dns \
            "$dns_cache_max_size" \
            "$dns_listen_port" \
            "$ipv6_enabled" \
            "$use_system_hosts" \
            "$nameserver_policy" \
            "$default_nameserver" \
            "$nameserver" \
            "$proxy_server_nameserver" \
            "$direct_nameserver" \
            "$fake_ip_range" \
            "$fake_ip_range6" \
            "$fake_ip_ttl" \
            "$fake_ip_filter_data"
        yaml_document_write_sniffer \
            "$sniffer_enable" \
            "$sniffer_parse_pure_ip" \
            "$sniffer_override_destination" \
            "$DEFAULT_HTTP_PORT" \
            "$DEFAULT_SECONDARY_HTTP_PORT_RANGE" \
            "$DEFAULT_SECONDARY_HTTP_PORT_RANGE_END" \
            "$DEFAULT_TLS_PORT" \
            "$DEFAULT_SECONDARY_TLS_PORT" \
            "$sniffer_exclude_domain" \
            "$sniffer_force_domain" \
            "$sniffer_skip_src_address" \
            "$sniffer_skip_dst_address"
        yaml_document_write_payloads \
            "$proxies" \
            "$proxy_groups" \
            "$proxy_providers" \
            "$rules"
    } >"$output_yaml_tmp_path"
    render_status=$?
    if [ "$render_status" -ne 0 ]; then
        log error "Failed to render the temporary YAML configuration."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi

    if ! printf '%s' "${_STATIC_IPS_BUFFER:+$_STATIC_IPS_BUFFER$NL}" >"$active_static_ips_tmp_path" ||
        ! printf '%s' "${_STATIC_SOURCE_IPS_BUFFER:+$_STATIC_SOURCE_IPS_BUFFER$NL}" >"$active_source_ips_tmp_path" ||
        ! printf '%s' "${_IPCIDR_RULESETS_BUFFER:+$_IPCIDR_RULESETS_BUFFER$NL}" >"$active_ipcidr_rulesets_tmp_path"; then
        log error "Failed to render temporary YAML sidecar caches."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi

    if [ -s "$active_ipcidr_rulesets_tmp_path" ] &&
        ! sort -u -o "$active_ipcidr_rulesets_tmp_path" "$active_ipcidr_rulesets_tmp_path"; then
        log error "Failed to sort the temporary IPCIDR ruleset cache."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi

    if [ -s "$active_static_ips_tmp_path" ] &&
        ! sort -u -o "$active_static_ips_tmp_path" "$active_static_ips_tmp_path"; then
        log error "Failed to sort the temporary static IP cache."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi

    if [ -s "$active_source_ips_tmp_path" ] &&
        ! sort -u -o "$active_source_ips_tmp_path" "$active_source_ips_tmp_path"; then
        log error "Failed to sort the temporary source IP cache."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi

    log info "Validating generated YAML configuration..."
    if ! core_validate_yaml "$CORE_PATH" "$CORE_WORKDIR_PATH" "$output_yaml_tmp_path"; then
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi

    if ! mv -f "$active_static_ips_tmp_path" "$ACTIVE_STATIC_IPS_PATH"; then
        log error "Failed to promote the static IP cache."
        rm -f "$output_yaml_tmp_path" "$active_static_ips_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi
    if ! mv -f "$active_source_ips_tmp_path" "$ACTIVE_STATIC_SOURCE_IPS_PATH"; then
        log error "Failed to promote the source IP cache."
        rm -f "$output_yaml_tmp_path" "$active_source_ips_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi
    if ! mv -f "$active_ipcidr_rulesets_tmp_path" "$ACTIVE_IPCIDR_RULESETS_PATH"; then
        log error "Failed to promote the IPCIDR ruleset cache."
        rm -f "$output_yaml_tmp_path" "$active_ipcidr_rulesets_tmp_path"
        return 1
    fi
    if ! mv -f "$output_yaml_tmp_path" "$OUTPUT_YAML_CONFIG_PATH"; then
        log error "Failed to promote the validated YAML configuration."
        rm -f "$output_yaml_tmp_path"
        return 1
    fi

    return 0
}

service_data_update() {
    local base_url

    # Read settings used by this scenario.
    config_get base_url settings mihomo_rulesets_files_download_url

    mkdir -p "$CORE_WORKDIR_PATH" "$PROG_ETC_DIR"

    service_data_file_update \
        "$base_url" "$RULESETS_FILENAME" "$RULESETS_FILE" "$CORE_WORKDIR_PATH" \
        "ruleset list" || return "$?"

    service_data_file_update \
        "$base_url" "$RULESETS_BLOCKS_FILENAME" "$RULESETS_BLOCKS_FILE" "$CORE_WORKDIR_PATH" \
        "block ruleset list" || return "$?"
}

# Returns 0 for a reusable cache, 1 for regeneration; other codes indicate workdir errors.
core_prepare_workdir() {
    local mihomo_persistent_ext_rules="$1"
    local mihomo_persistent_cache="$2"
    local current_hash="$3"
    local res=1 runtime_status

    log info "Preparing workdir $CORE_WORKDIR_PATH"

    workdir_ensure "$CORE_WORKDIR_PATH"
    runtime_status=$?
    if [ "$runtime_status" -ne 0 ]; then
        return "$runtime_status"
    fi

    if [ -d "$CORE_WORKDIR_PATH" ]; then
        workdir_cache_check \
            "$current_hash" \
            "$CORE_WORKDIR_UCI_HASH_PATH" \
            "$OUTPUT_YAML_CONFIG_PATH" \
            "$ACTIVE_IPCIDR_RULESETS_PATH" \
            "$ACTIVE_STATIC_IPS_PATH" \
            "$ACTIVE_STATIC_SOURCE_IPS_PATH"
        res=$?
    fi

    workdir_persistent_rules_apply \
        "$mihomo_persistent_ext_rules" \
        "$CORE_WORKDIR_RULES_PATH" \
        "$SYMLINKDIR_RULESETS"
    runtime_status=$?
    if [ "$runtime_status" -ne 0 ]; then
        return "$runtime_status"
    fi

    workdir_persistent_cache_apply \
        "$mihomo_persistent_cache" \
        "$CORE_WORKDIR_CACHE_DB_PATH" \
        "$SYMLINK_CACHE_DB_PATH"
    runtime_status=$?
    if [ "$runtime_status" -ne 0 ]; then
        return "$runtime_status"
    fi

    return "$res"
}

core_update() {
    local channel custom_url repository source_type

    # Read settings used by this scenario.
    config_get source_type settings mihomo_core_source_type
    config_get custom_url settings mihomo_custom_core_url
    config_get channel settings mihomo_github_channel
    config_get repository settings mihomo_github_repo

    core_update_run \
        "$source_type" "$custom_url" "$channel" "$repository" \
        "$CORE_WORKDIR_PATH" "$CORE_PATH" "$NO_DATA_STRING"
}

core_remove() {
    core_binary_remove "$CORE_PATH"
}

core_autorestart_cron_check() {
    cron_job_check "${INITD_PATH} reload"
}

core_autorestart_cron_add() {
    local schedule="$1"

    cron_job_add "$schedule" "${INITD_PATH} reload" "pgrep -f ${CORE_PATH} >/dev/null && ${INITD_PATH} reload # Core Autorestart" "Core autorestart"
}

core_autorestart_cron_remove() {
    cron_job_remove "${INITD_PATH} reload" "Core autorestart"
}

service_data_cron_check() {
    cron_job_check "# Service Data Update"
}

service_data_cron_add() {
    local schedule="$1"

    cron_job_add "$schedule" "# Service Data Update" "$PROG_PATH resources data update # Service Data Update" "Service data update"
}

service_data_cron_remove() {
    cron_job_remove "# Service Data Update" "Service data update"
}

scheduled_work_cron_add() {
    local start_schedule="$1"
    local stop_schedule="$2"

    cron_job_add "$start_schedule" "${INITD_PATH} start # Scheduled Work" "pgrep -f ${CORE_PATH} >/dev/null || ${INITD_PATH} start # Scheduled Work" "Scheduled work start" || return 1
    cron_job_add "$stop_schedule" "${INITD_PATH} stop # Scheduled Work" "pgrep -f ${CORE_PATH} >/dev/null && ${INITD_PATH} stop # Scheduled Work" "Scheduled work stop"
}

scheduled_work_cron_remove() {
    cron_job_remove "${INITD_PATH} start # Scheduled Work" "Scheduled work start"
    cron_job_remove "${INITD_PATH} stop # Scheduled Work" "Scheduled work stop"
}

cron_update() {
    local autorestart_enabled autorestart_schedule scheduled_work_enabled scheduled_work_start_schedule
    local scheduled_work_stop_schedule service_data_autoupdate_enabled service_data_update_schedule
    # Read settings used by this scenario.
    config_get autorestart_enabled settings mihomo_autorestart
    config_get autorestart_schedule settings mihomo_cron_autorestart_string
    config_get service_data_autoupdate_enabled settings mihomo_service_data_autoupdate
    config_get service_data_update_schedule settings mihomo_cron_service_data_update_string
    config_get scheduled_work_enabled settings mihomo_scheduled_work
    config_get scheduled_work_start_schedule settings mihomo_cron_scheduled_work_start_string
    config_get scheduled_work_stop_schedule settings mihomo_cron_scheduled_work_stop_string

    if [ "$autorestart_enabled" -eq 1 ]; then
        core_autorestart_cron_add "$autorestart_schedule" || return 1
    else
        core_autorestart_cron_remove
    fi

    if [ "$service_data_autoupdate_enabled" -eq 1 ]; then
        service_data_cron_add "$service_data_update_schedule" || return 1
    else
        service_data_cron_remove
    fi

    if [ "$scheduled_work_enabled" -eq 1 ]; then
        scheduled_work_cron_add \
            "$scheduled_work_start_schedule" \
            "$scheduled_work_stop_schedule" || return 1
    else
        scheduled_work_cron_remove
    fi
}

run_check_routes() {
    local ipv6_enabled

    # Read settings used by this scenario.
    config_get ipv6_enabled settings ipv6_enabled

    check_routes "$NF_TABLE_FWMARK_FINAL" "$NF_ROUTE_TABLE" "$ipv6_enabled"
}

run_check_dns_proxy() {
    local dns_listen_port
    local target="$1"

    # Read settings used by this scenario.
    config_get dns_listen_port proxy dns_listen_port

    check_dns_proxy "$target" "$dns_listen_port" "$NSLOOKUP_TIMEOUT"
}

check_report_full() {
    local running_status autoload_status hw_model os_ver

    service "$PROGNAME" running && running_status="active" || running_status="inactive"
    service "$PROGNAME" enabled && autoload_status="enabled" || autoload_status="disabled"

    os_ver=$(sysinfo_get_os_version)
    hw_model=$(sysinfo_get_hw_model)

    print_dpi_status() {
        local name="$1"
        local filepath="$2"
        if [ -f "$filepath" ]; then
            printf "  %-15s :: Installed\n" "$name"
        else
            printf "  %-15s :: Not installed\n" "$name"
        fi
    }

    echo ""
    echo "-- JustClash Diagnostic Report ---------------------------------"
    echo ""
    echo "  [ Device Info ]"
    printf "  %-15s :: %s\n" "Device" "${hw_model:-$NO_DATA_STRING}"
    printf "  %-15s :: %s\n" "OpenWrt" "${os_ver:-$NO_DATA_STRING}"
    printf "  %-15s :: %s\n" "Service Ver" "$JUSTCLASH_VERSION"
    printf "  %-15s :: %s\n" "Mihomo Ver" "$(core_info_mihomo "$CORE_PATH" "$NO_DATA_STRING")"
    printf "  %-15s :: %s\n" "HWID" "$(sysinfo_hwid_generate)"
    echo ""
    echo "  [ Service Status ]"
    printf "  %-15s :: %s\n" "Active" "$running_status"
    printf "  %-15s :: %s\n" "Autoload" "$autoload_status"
    echo ""
    echo "  [ ICMP Pings ]"
    echo "  Yandex ($DEFAULT_CHECK_IP_PING_YANDEX):"
    check_ping "$DEFAULT_CHECK_IP_PING_YANDEX" 2 2 | sed 's/^/    /'
    echo ""
    echo "  Google ($DEFAULT_CHECK_IP_PING_GOOGLE):"
    check_ping "$DEFAULT_CHECK_IP_PING_GOOGLE" 2 2 | sed 's/^/    /'
    echo ""
    echo "  GitHub ($DEFAULT_CHECK_DOMAIN_PING_GITHUB):"
    check_ping "$DEFAULT_CHECK_DOMAIN_PING_GITHUB" 2 2 | sed 's/^/    /'
    echo ""
    echo "  [ DNS Resolves ]"
    echo "  Proxy ($DEFAULT_CHECK_RESOLVE_URL_YANDEX):"
    run_check_dns_proxy "$DEFAULT_CHECK_RESOLVE_URL_YANDEX" | sed 's/^/    /'
    echo ""
    echo "  External ($DEFAULT_CHECK_RESOLVE_URL_YANDEX via $DEFAULT_CHECK_IP_PING_YANDEX):"
    check_dns_external "$DEFAULT_CHECK_RESOLVE_URL_YANDEX" "$DEFAULT_CHECK_IP_PING_YANDEX" "$NSLOOKUP_TIMEOUT" | sed 's/^/    /'
    echo ""
    echo "  External ($DEFAULT_CHECK_RESOLVE_URL_YANDEX via $DEFAULT_CHECK_IP_PING_GOOGLE):"
    check_dns_external "$DEFAULT_CHECK_RESOLVE_URL_YANDEX" "$DEFAULT_CHECK_IP_PING_GOOGLE" "$NSLOOKUP_TIMEOUT" | sed 's/^/    /'
    echo ""
    echo "  [ DPI Applications ]"
    print_dpi_status "Zapret" "$ZAPRETINITD_FILEPATH"
    print_dpi_status "ByeDPI" "$BYEDPI_FILEPATH"
    print_dpi_status "YoutubeUnblock" "$YOUTUBEUNBLOCK_FILEPATH"
    print_dpi_status "B4" "$B4_FILEPATH"
    echo ""
    echo "  [ NFT Tables ]"
    check_nft "$NF_TABLE_NAME" | sed 's/^/    /'
    echo ""
    echo "  [ Routes ]"
    run_check_routes | sed 's/^/    /'
    echo ""
    echo "  [ /etc/resolv.conf ]"
    sed 's/^/    /' /etc/resolv.conf
    echo ""
    echo "  [ Network Config ]"
    uci show network | sed -E -e "s/(\.[a-zA-Z0-9_]*(password|secret|key|psk|token|passphrase)[a-zA-Z0-9_]*)=.*/\1='***REDACTED***'/" -e 's/^/    /'
    echo ""
    echo "  [ DHCP Config ]"
    uci show dhcp | sed 's/^/    /'
    echo ""
    echo "  [ Service Config ]"
    config_show_service "$CONFIG_PATH" | sed 's/^/    /'
    echo ""
    echo "  [ Mihomo Config ]"
    config_show_mihomo "$OUTPUT_YAML_CONFIG_PATH" | sed 's/^/    /'
    echo ""
    echo "----------------------------------------------------------------"
    echo ""
}

check_report_safe() {
    local running_status autoload_status

    service "$PROGNAME" running && running_status="active" || running_status="inactive"
    service "$PROGNAME" enabled && autoload_status="enabled" || autoload_status="disabled"

    check_safe_item() {
        local label="$1"

        shift
        if "$@" >/dev/null 2>&1; then
            printf "  %-24s :: OK\n" "$label"
        else
            printf "  %-24s :: Failed\n" "$label"
        fi
    }

    echo ""
    echo "-- JustClash Redacted Diagnostic Report ------------------------"
    echo ""
    echo "  [ Versions ]"
    printf "  %-24s :: %s\n" "Service" "$JUSTCLASH_VERSION"
    printf "  %-24s :: %s\n" "Mihomo" "$(core_info_mihomo "$CORE_PATH" "$NO_DATA_STRING")"
    echo ""
    echo "  [ Service Status ]"
    printf "  %-24s :: %s\n" "Active" "$running_status"
    printf "  %-24s :: %s\n" "Autoload" "$autoload_status"
    echo ""
    echo "  [ Connectivity ]"
    check_safe_item "ICMP check 1" \
        check_ping "$DEFAULT_CHECK_IP_PING_YANDEX" 2 2
    check_safe_item "ICMP check 2" \
        check_ping "$DEFAULT_CHECK_IP_PING_GOOGLE" 2 2
    check_safe_item "Proxy DNS resolve" \
        run_check_dns_proxy "$DEFAULT_CHECK_RESOLVE_URL_YANDEX"
    check_safe_item "External DNS resolve" \
        check_dns_external \
        "$DEFAULT_CHECK_RESOLVE_URL_YANDEX" \
        "$DEFAULT_CHECK_IP_PING_GOOGLE" \
        "$NSLOOKUP_TIMEOUT"
    echo ""
    echo "  [ Runtime ]"
    check_safe_item "NFT state" check_nft "$NF_TABLE_NAME"
    check_safe_item "Policy routes" run_check_routes
    echo ""
    echo "  Configuration, addresses, domains, identifiers and raw network"
    echo "  state are intentionally omitted from this report."
    echo ""
    echo "----------------------------------------------------------------"
    echo ""
}

case "$1" in
start | run | up)
    import \
        /lib/functions/network.sh \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/compat.sh \
        /usr/lib/justclash/user_agents.sh \
        /usr/lib/justclash/uri.sh \
        /usr/lib/justclash/yaml.sh \
        /usr/lib/justclash/runtime/preflight.sh \
        /usr/lib/justclash/runtime/core.sh \
        /usr/lib/justclash/runtime/ntpd.sh \
        /usr/lib/justclash/runtime/dnsmasq.sh \
        /usr/lib/justclash/runtime/workdir.sh \
        /usr/lib/justclash/runtime/nftables.sh \
        /usr/lib/justclash/runtime/policy_routing.sh \
        /usr/lib/justclash/runtime/scheduler.sh
    config_init "$PROGNAME" || exit 1
    [ "$ENV_JUSTCLASH_RUN_CONTEXT" != "procd" ] && trap 'stop; exit 0' INT TERM HUP
    start
    ;;
stop | down | d)
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/nftables.sh \
        /usr/lib/justclash/runtime/policy_routing.sh \
        /usr/lib/justclash/runtime/dnsmasq.sh
    config_init "$PROGNAME"
    stop
    ;;
resources)
    case "$2:$3" in
    core:update)
        [ "$#" -eq 3 ] || {
            printf 'Usage: justclash.sh resources core update\n' >&2
            exit 2
        }
        import \
            /lib/functions.sh \
            /lib/config/uci.sh \
            /usr/lib/justclash/logging.sh \
            /usr/lib/justclash/helpers.sh \
            /usr/lib/justclash/config.sh \
            /usr/lib/justclash/runtime/downloads.sh \
            /usr/lib/justclash/runtime/core.sh \
            /usr/lib/justclash/runtime/core_update.sh
        config_init "$PROGNAME" || exit 1
        core_update
        ;;
    core:remove)
        [ "$#" -le 4 ] || {
            printf 'Usage: justclash.sh resources core remove [-y|-Y|--yes]\n' >&2
            exit 2
        }
        import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/core.sh
        cli_confirm_destructive "Remove the Mihomo core?" "$4" && core_remove
        ;;
    data:update)
        [ "$#" -eq 3 ] || {
            printf 'Usage: justclash.sh resources data update\n' >&2
            exit 2
        }
        import \
            /lib/functions.sh \
            /lib/config/uci.sh \
            /usr/lib/justclash/logging.sh \
            /usr/lib/justclash/helpers.sh \
            /usr/lib/justclash/config.sh \
            /usr/lib/justclash/runtime/downloads.sh
        config_init "$PROGNAME" || exit 1
        service_data_update
        ;;
    *)
        printf 'Usage: justclash.sh resources {core update|core remove [-y|-Y|--yes]|data update}\n' >&2
        exit 2
        ;;
    esac
    ;;
schedule)
    [ "$#" -eq 2 ] && [ "$2" = "sync" ] || {
        printf 'Usage: justclash.sh schedule sync\n' >&2
        exit 2
    }
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/scheduler.sh
    config_init "$PROGNAME"
    cron_update
    ;;
logs)
    [ "$#" -ge 2 ] && [ "$#" -le 3 ] || {
        printf 'Usage: justclash.sh logs {service|system} [N]\n' >&2
        exit 2
    }

    case "$3" in
    '') ;;
    *[!0-9]*)
        printf 'Usage: justclash.sh logs {service|system} [N]\n' >&2
        exit 2
        ;;
    esac

    import /usr/lib/justclash/logging.sh
    case "$2" in
    service | system)
        if [ -n "$3" ]; then
            systemlogs "$PROGNAME" "$3"
        else
            systemlogs "$PROGNAME"
        fi
        ;;
    *)
        printf 'Usage: justclash.sh logs {service|system} [N]\n' >&2
        exit 2
        ;;
    esac
    ;;
version)
    [ "$#" -eq 2 ] || {
        printf 'Usage: justclash.sh version {package|core}\n' >&2
        exit 2
    }

    case "$2" in
    package)
        echo "$JUSTCLASH_VERSION"
        ;;
    core)
        import /usr/lib/justclash/runtime/core.sh
        core_info_mihomo "$CORE_PATH" "$NO_DATA_STRING"
        ;;
    *)
        printf 'Usage: justclash.sh version {package|core}\n' >&2
        exit 2
        ;;
    esac
    ;;
check)
    case "$2" in
    '')
        [ "$#" -eq 1 ] || {
            printf 'Usage: justclash.sh check\n' >&2
            exit 2
        }
        import \
            /lib/functions.sh \
            /lib/config/uci.sh \
            /usr/lib/justclash/logging.sh \
            /usr/lib/justclash/helpers.sh \
            /usr/lib/justclash/config.sh \
            /usr/lib/justclash/runtime/core.sh \
            /usr/lib/justclash/runtime/diagnostics.sh
        config_init "$PROGNAME"
        check_report_safe
        ;;
    full)
        [ "$#" -eq 3 ] && [ "$3" = "--unsafe" ] || {
            printf 'Usage: justclash.sh check full --unsafe\n' >&2
            exit 2
        }
        import \
            /lib/functions.sh \
            /lib/config/uci.sh \
            /usr/lib/justclash/logging.sh \
            /usr/lib/justclash/helpers.sh \
            /usr/lib/justclash/config.sh \
            /usr/lib/justclash/runtime/core.sh \
            /usr/lib/justclash/runtime/diagnostics.sh
        config_init "$PROGNAME"
        check_report_full
        ;;
    nft)
        [ "$#" -eq 2 ] || {
            printf 'Usage: justclash.sh check nft\n' >&2
            exit 2
        }
        import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
        check_nft "$NF_TABLE_NAME"
        ;;
    routes)
        [ "$#" -eq 2 ] || {
            printf 'Usage: justclash.sh check routes\n' >&2
            exit 2
        }
        import \
            /lib/functions.sh \
            /lib/config/uci.sh \
            /usr/lib/justclash/logging.sh \
            /usr/lib/justclash/helpers.sh \
            /usr/lib/justclash/config.sh \
            /usr/lib/justclash/runtime/diagnostics.sh
        config_init "$PROGNAME"
        run_check_routes
        ;;
    ping)
        [ "$#" -ge 3 ] && [ "$#" -le 4 ] || {
            printf 'Usage: justclash.sh check ping TARGET [COUNT]\n' >&2
            exit 2
        }
        import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
        check_ping "$3" "${4:-3}" 2
        ;;
    dns-proxy)
        [ "$#" -eq 3 ] || {
            printf 'Usage: justclash.sh check dns-proxy DOMAIN\n' >&2
            exit 2
        }
        import \
            /lib/functions.sh \
            /lib/config/uci.sh \
            /usr/lib/justclash/logging.sh \
            /usr/lib/justclash/helpers.sh \
            /usr/lib/justclash/config.sh \
            /usr/lib/justclash/runtime/diagnostics.sh
        config_init "$PROGNAME"
        run_check_dns_proxy "$3"
        ;;
    dns-external)
        [ "$#" -eq 4 ] || {
            printf 'Usage: justclash.sh check dns-external DOMAIN RESOLVER\n' >&2
            exit 2
        }
        import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
        check_dns_external "$3" "$4" "$NSLOOKUP_TIMEOUT"
        ;;
    hwid)
        [ "$#" -eq 2 ] || {
            printf 'Usage: justclash.sh check hwid\n' >&2
            exit 2
        }
        import /usr/lib/justclash/helpers.sh
        sysinfo_hwid_generate
        echo ""
        ;;
    *)
        printf 'Usage: justclash.sh check [full --unsafe|nft|routes|ping TARGET [COUNT]|dns-proxy DOMAIN|dns-external DOMAIN RESOLVER|hwid]\n' >&2
        exit 2
        ;;
    esac
    ;;
config)
    case "$2" in
    show)
        case "$3" in
        mihomo)
            [ "$#" -le 4 ] || {
                printf 'Usage: justclash.sh config show mihomo [--unsafe]\n' >&2
                exit 2
            }
            import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
            case "$4" in
            '') config_show_mihomo "$OUTPUT_YAML_CONFIG_PATH" ;;
            --unsafe) config_show_mihomo_unsafe "$OUTPUT_YAML_CONFIG_PATH" ;;
            *)
                printf 'Usage: justclash.sh config show mihomo [--unsafe]\n' >&2
                exit 2
                ;;
            esac
            ;;
        service)
            [ "$#" -le 4 ] || {
                printf 'Usage: justclash.sh config show service [--unsafe]\n' >&2
                exit 2
            }
            import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
            case "$4" in
            '') config_show_service "$CONFIG_PATH" ;;
            --unsafe) config_show_service_unsafe "$CONFIG_PATH" ;;
            *)
                printf 'Usage: justclash.sh config show service [--unsafe]\n' >&2
                exit 2
                ;;
            esac
            ;;
        *)
            printf 'Usage: justclash.sh config show {mihomo|service} [--unsafe]\n' >&2
            exit 2
            ;;
        esac
        ;;
    reset)
        [ "$#" -le 3 ] || {
            printf 'Usage: justclash.sh config reset [-y|-Y|--yes]\n' >&2
            exit 2
        }
        import /usr/lib/justclash/logging.sh /usr/lib/justclash/config.sh
        cli_confirm_destructive "Reset the JustClash configuration?" "$3" &&
            config_reset "$DEFAULT_CONFIG_PATH" "$CONFIG_PATH" "$CONFIG_BAK_PATH"
        ;;
    *)
        printf 'Usage: justclash.sh config {show|reset}\n' >&2
        exit 2
        ;;
    esac
    ;;
help | '?' | command | h | -h | --help)
    import /usr/lib/justclash/help.sh
    help
    ;;
*)
    printf 'error: Unknown command\n' >&2
    printf "Type 'justclash.sh help' for a list of available commands.\n" >&2
    exit 1
    ;;
esac
