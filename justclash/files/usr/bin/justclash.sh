#!/bin/ash
# shellcheck shell=dash
# ShellCheck cannot follow runtime imports or ash's dynamically scoped locals.
# shellcheck disable=SC2154

set -f # Disable path expansion (globbing) globally to safely iterate over user-defined lists containing *

# --------------------------------------------
# Main application orchestration
# Simple UCI reads and validation stay with their owning scenarios.
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

core_prepare_safe_paths() {
    local api_tls="$1"
    local api_tls_cert="$2"
    local api_tls_key="$3"
    local mihomo_persistent_ext_rules="$4"
    local cert_dir key_dir
    local ruleset_url safe_path rulesets_files=""

    safe_paths_clear
    safe_paths_add "$DASHBOARD_PATH"

    # 1. API TLS Cert/Key Paths from validated startup config
    if [ "$api_tls" -eq 1 ]; then
        cert_dir=$(readlink -f "$(dirname "$api_tls_cert")" 2>/dev/null || realpath "$(dirname "$api_tls_cert")" 2>/dev/null)
        key_dir=$(readlink -f "$(dirname "$api_tls_key")" 2>/dev/null || realpath "$(dirname "$api_tls_key")" 2>/dev/null)
        [ -n "$cert_dir" ] && safe_paths_add "$cert_dir"
        [ -n "$key_dir" ] && safe_paths_add "$key_dir"
    fi

    # 2. Persistent rulesets path from validated startup config
    if [ "$mihomo_persistent_ext_rules" -eq 1 ]; then
        safe_paths_add "$SYMLINKDIR_RULESETS"
    fi

    # 3. Custom local ruleset paths from user ruleset text files
    [ -f "$USER_RULESETS_FILE" ] && rulesets_files="$rulesets_files $USER_RULESETS_FILE"
    [ -f "$USER_RULESETS_BLOCKS_FILE" ] && rulesets_files="$rulesets_files $USER_RULESETS_BLOCKS_FILE"

    if [ -n "$rulesets_files" ]; then
        # shellcheck disable=SC2086
        awk -F'|' '$2 ~ /^\// { print $2 }' $rulesets_files 2>/dev/null | while read -r ruleset_url; do
            [ -n "$ruleset_url" ] || continue
            safe_path=$(readlink -f "$(dirname "$ruleset_url")" 2>/dev/null || realpath "$(dirname "$ruleset_url")" 2>/dev/null)
            [ -n "$safe_path" ] && safe_paths_add "$safe_path"
        done
    fi
}

start() {
    local validation_failed=0
    local current_config_hash workdir_status
    local api_tls api_tls_cert api_tls_key dns_listen_port ipv6_enabled mihomo_gogc mihomo_gomaxprocs
    local mihomo_mem_limit mihomo_persistent_cache mihomo_persistent_ext_rules mixed_port nft_apply_changes
    local nft_apply_changes_router ntpd_start routing_mode tproxy_port
    local controller_bind_interface router_selected_ipaddr
    local core_exit_code preflight_tproxy_port

    if preflight_check_is_already_running "$PROGNAME start" "JustClash" "$CORE_PATH" "$$"; then
        return 0
    fi

    log info "Initializing JustClash service..."

    # Read settings used by this scenario.
    config_get ntpd_start settings ntpd_start "$DEFAULT_NTPD_START"
    config_get dns_listen_port proxy dns_listen_port "$DEFAULT_DNS_LISTEN_PORT"
    config_get tproxy_port proxy tproxy_port
    config_get nft_apply_changes settings nft_apply_changes "$DEFAULT_NFT_APPLY_CHANGES"
    config_get mixed_port proxy mixed_port "$DEFAULT_MIXED_PORT"
    config_get api_tls proxy api_tls "$DEFAULT_API_TLS"
    config_get api_tls_cert proxy api_tls_cert "$DEFAULT_API_TLS_CERT_PATH"
    config_get api_tls_key proxy api_tls_key "$DEFAULT_API_TLS_KEY_PATH"
    config_get mihomo_persistent_ext_rules settings mihomo_persistent_ext_rules "$DEFAULT_MIHOMO_PERSISTENT_EXT_RULES"
    config_get mihomo_persistent_cache settings mihomo_persistent_cache "$DEFAULT_MIHOMO_PERSISTENT_CACHE"
    config_get mihomo_mem_limit settings mihomo_mem_limit "$DEFAULT_MIHOMO_MEM_LIMIT"
    config_get mihomo_gogc settings mihomo_gogc "$DEFAULT_MIHOMO_GOGC"
    config_get mihomo_gomaxprocs settings mihomo_gomaxprocs "$DEFAULT_MIHOMO_GOMAXPROCS"
    config_get routing_mode settings routing_mode "$DEFAULT_ROUTING_MODE"
    config_get nft_apply_changes_router settings nft_apply_changes_router "$DEFAULT_NFT_APPLY_CHANGES_ROUTER"
    config_get ipv6_enabled settings ipv6_enabled "$DEFAULT_IPV6_ENABLED"
    config_get controller_bind_interface proxy controller_bind_interface

    # Validate before applying any changes.
    config_validate_bool "$ntpd_start" "settings.ntpd_start" || validation_failed=1
    config_validate_bool "$nft_apply_changes" "settings.nft_apply_changes" || validation_failed=1
    config_validate_bool "$api_tls" "proxy.api_tls" || validation_failed=1
    config_validate_bool "$mihomo_persistent_ext_rules" "settings.mihomo_persistent_ext_rules" || validation_failed=1
    config_validate_bool "$mihomo_persistent_cache" "settings.mihomo_persistent_cache" || validation_failed=1
    config_validate_bool "$nft_apply_changes_router" "settings.nft_apply_changes_router" || validation_failed=1
    config_validate_bool "$ipv6_enabled" "settings.ipv6_enabled" || validation_failed=1

    config_validate_port "$dns_listen_port" "proxy.dns_listen_port" || validation_failed=1
    config_validate_port "$tproxy_port" "proxy.tproxy_port" || validation_failed=1
    config_validate_port "$mixed_port" "proxy.mixed_port" || validation_failed=1

    config_validate_uint "$mihomo_mem_limit" "settings.mihomo_mem_limit" || validation_failed=1
    config_validate_uint "$mihomo_gogc" "settings.mihomo_gogc" || validation_failed=1
    config_validate_uint "$mihomo_gomaxprocs" "settings.mihomo_gomaxprocs" || validation_failed=1

    if ! val_is_choice "$routing_mode" full partial; then
        config_validation_error "settings.routing_mode must be 'full' or 'partial'"
        validation_failed=1
    fi

    if [ "$controller_bind_interface" != "$CONTROLLER_BIND_UNSPECIFIED" ] &&
        ! val_is_ifname "$controller_bind_interface"; then
        config_validation_error "proxy.controller_bind_interface must name a logical network or be '-'"
        validation_failed=1
    fi

    if [ "$api_tls" = "1" ]; then
        config_validate_absolute_path "$api_tls_cert" "proxy.api_tls_cert" || validation_failed=1
        config_validate_absolute_path "$api_tls_key" "proxy.api_tls_key" || validation_failed=1
    fi

    if [ "$validation_failed" -ne 0 ]; then
        log error "Startup configuration validation failed. Aborting startup."
        return 1
    fi

    if [ "$nft_apply_changes" = "1" ]; then
        preflight_tproxy_port="$tproxy_port"
    else
        preflight_tproxy_port=""
    fi

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

    network_flush_cache
    if [ "$controller_bind_interface" = "$CONTROLLER_BIND_UNSPECIFIED" ]; then
        router_selected_ipaddr="$CONTROLLER_BIND_ALL_IPV4"
    else
        if ! network_get_ipaddr router_selected_ipaddr "$controller_bind_interface" ||
            [ -z "$router_selected_ipaddr" ]; then
            log error "Controller bind network has no IPv4 address. Aborting startup."
            return 1
        fi
    fi

    preflight_check_requirement "$CORE_PATH" "$CORE_BIN_NAME" "$REQUIRED_TOOLS" || {
        log error "System requirement checks failed. Aborting startup."
        return 1
    }

    log info "Checking port configuration collisions"
    preflight_check_port_collisions \
        "$dns_listen_port" \
        "$preflight_tproxy_port" \
        "$mixed_port" \
        "$DEFAULT_EXTERNAL_CONTROLLER_PORT" || {
        log error "Port configuration validation failed. Aborting startup."
        return 1
    }

    log info "Checking active ports availability"
    preflight_check_ports_occupancy \
        "$dns_listen_port" \
        "$preflight_tproxy_port" \
        "$mixed_port" \
        "$DEFAULT_EXTERNAL_CONTROLLER_PORT" || {
        log error "Active ports check failed. Aborting startup."
        return 1
    }

    log info "Checking for non-critical conflicts"
    preflight_check_conflicts_warn \
        "$DHCP_CONFIG_FILEPATH" \
        "$WARN_PATTERNS_DHCP_CONFIG" \
        "$RESOLVCONF_FILEPATH" \
        "$ZAPRETINITD_FILEPATH" \
        "$BYEDPI_FILEPATH" \
        "$YOUTUBEUNBLOCK_FILEPATH" \
        "$B4_FILEPATH"

    log info "Fixing known compatibility problems"
    compat_fixes

    log info "Synchronizing system time"
    ntpd_force_sync \
        "$ntpd_start" \
        "$DEFAULT_NTP_IPS"

    log info "Updating SAFE_PATHS environment variable"
    core_prepare_safe_paths \
        "$api_tls" \
        "$api_tls_cert" \
        "$api_tls_key" \
        "$mihomo_persistent_ext_rules"

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
    run_dnsmasq_update

    log info "Updating scheduled tasks"
    cron_update

    nft_sets_watch_start \
        "$routing_mode" \
        "$nft_apply_changes" \
        "$nft_apply_changes_router" \
        "$ipv6_enabled" \
        "$ACTIVE_IPCIDR_RULESETS_PATH" \
        "$CORE_WORKDIR_RULES_PATH" \
        "$ASYNC_WORKER_PID_PATH"

    log info "Starting Mihomo core"
    start_core "$mihomo_mem_limit" "$mihomo_gogc" "$mihomo_gomaxprocs"
    core_exit_code=$?

    nft_async_worker_stop "$ASYNC_WORKER_PID_PATH"

    log warn "Mihomo core exited; restoring networking changes."
    run_dnsmasq_restore
    nf_table_remove

    return "$core_exit_code"
}

stop() {
    log info "Stopping JustClash service..."

    nft_async_worker_stop "$ASYNC_WORKER_PID_PATH"

    log info "Removing tproxy routing and NFTables table"
    nf_table_remove

    log info "Restoring default dnsmasq configuration"
    run_dnsmasq_restore

    log info "Stopping core process"
    stop_core
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

# Reads and validates nftables settings, then applies the selected routing mode.
run_nftables_apply() {
    local validation_failed=0
    local fake_ip_range fake_ip_range6 ipv6_enabled nft_apply_changes nft_apply_changes_router nft_doh_mode nft_dns_udp_mode
    local nft_dot_mode nft_dot_quic_mode nft_ips_exclude nft_mac_exclude nft_ntp_mode nft_ntp_mode_router
    local nft_ports_exclude nft_ports_exclude_router nft_quic_mode nft_skuid_exclude_router pbr_priority
    local provider_routing_marks proxy_routing_marks routing_mode tproxy_input_interfaces tproxy_port
    local nft_res=0

    # Read settings used by this scenario.
    config_get routing_mode settings routing_mode "$DEFAULT_ROUTING_MODE"
    config_get nft_apply_changes settings nft_apply_changes "$DEFAULT_NFT_APPLY_CHANGES"
    config_get nft_apply_changes_router settings nft_apply_changes_router "$DEFAULT_NFT_APPLY_CHANGES_ROUTER"
    config_get tproxy_port proxy tproxy_port
    config_get pbr_priority settings pbr_priority "$DEFAULT_PBR_PRIORITY"
    config_get fake_ip_range proxy fake_ip_range
    config_get fake_ip_range6 proxy fake_ip_range6
    config_get tproxy_input_interfaces settings tproxy_input_interfaces "$DEFAULT_INPUT_INTERFACE"
    config_get nft_quic_mode settings nft_quic_mode
    config_get nft_dns_udp_mode settings nft_dns_udp_mode
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
    config_get ipv6_enabled settings ipv6_enabled "$DEFAULT_IPV6_ENABLED"

    proxy_routing_marks=$(str_trim "$(config_routing_marks_read \
        "$NF_TABLE_FWMARK_FINAL $NF_TABLE_FWMARK_PROXY" proxies routing_mark)")
    provider_routing_marks=$(str_trim "$(config_routing_marks_read \
        "$NF_TABLE_FWMARK_FINAL $NF_TABLE_FWMARK_PROXY" proxy_provider override_routing_mark)")

    # Validate before applying any changes.
    config_validate_bool "$nft_apply_changes" "settings.nft_apply_changes" || validation_failed=1
    config_validate_bool "$nft_apply_changes_router" "settings.nft_apply_changes_router" || validation_failed=1
    config_validate_bool "$ipv6_enabled" "settings.ipv6_enabled" || validation_failed=1

    if ! val_is_choice "$routing_mode" full partial; then
        config_validation_error "settings.routing_mode must be 'full' or 'partial'"
        validation_failed=1
    fi

    if [ "$nft_apply_changes" = "1" ] || [ "$nft_apply_changes_router" = "1" ]; then
        config_validate_port "$tproxy_port" "proxy.tproxy_port" || validation_failed=1
        if ! val_is_uint "$pbr_priority" ||
            [ "$pbr_priority" -lt 1 ] 2>/dev/null ||
            [ "$pbr_priority" -gt 32766 ] 2>/dev/null; then
            config_validation_error "settings.pbr_priority must be an integer from 1 to 32766"
            validation_failed=1
        fi

        case "$proxy_routing_marks" in
        *-1*)
            config_validation_error "proxies.routing_mark contains an invalid or reserved mark"
            validation_failed=1
            ;;
        esac
        case "$provider_routing_marks" in
        *-1*)
            config_validation_error "proxy_provider.override_routing_mark contains an invalid or reserved mark"
            validation_failed=1
            ;;
        esac

        if [ "$nft_apply_changes" = "1" ]; then
            [ -n "$fake_ip_range" ] || {
                config_validation_error "proxy.fake_ip_range is required"
                validation_failed=1
            }
            if [ "$ipv6_enabled" = "1" ] && [ -z "$fake_ip_range6" ]; then
                config_validation_error "proxy.fake_ip_range6 is required when IPv6 is enabled"
                validation_failed=1
            fi

            config_validate_interface_list "$tproxy_input_interfaces" "settings.tproxy_input_interfaces" || validation_failed=1
            config_validate_port_list "$nft_ports_exclude" "settings.nft_ports_exclude" || validation_failed=1
            config_validate_nft_mode "$nft_quic_mode" "settings.nft_quic_mode" || validation_failed=1
            config_validate_nft_dns_udp_mode "$nft_dns_udp_mode" "settings.nft_dns_udp_mode" || validation_failed=1
            config_validate_nft_mode "$nft_dot_mode" "settings.nft_dot_mode" || validation_failed=1
            config_validate_nft_mode "$nft_dot_quic_mode" "settings.nft_dot_quic_mode" || validation_failed=1
            config_validate_nft_mode "$nft_doh_mode" "settings.nft_doh_mode" || validation_failed=1
            config_validate_nft_ntp_mode "$nft_ntp_mode" "settings.nft_ntp_mode" || validation_failed=1
        fi

        if [ "$nft_apply_changes_router" = "1" ]; then
            config_validate_port_list "$nft_ports_exclude_router" "settings.nft_ports_exclude_router" || validation_failed=1
            config_validate_nft_ntp_mode "$nft_ntp_mode_router" "settings.nft_ntp_mode_router" || validation_failed=1
        fi
    fi

    if [ "$validation_failed" -ne 0 ]; then
        log error "Nftables configuration validation failed."
        return 1
    fi

    if [ "$nft_apply_changes" = "0" ] && [ "$nft_apply_changes_router" = "0" ]; then
        log info "Skipping nftables and PBR setup (disabled in configuration)"
        return 0
    fi

    if [ "$routing_mode" = "partial" ]; then
        nft_table_partial_apply \
            "$nft_apply_changes" \
            "$nft_apply_changes_router" \
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
            "$nft_dns_udp_mode"
        nft_res=$?
    else
        nft_table_full_apply \
            "$nft_apply_changes" \
            "$nft_apply_changes_router" \
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
            "$nft_dns_udp_mode"
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
    local validation_failed=0
    local dns_listen_port dnsmasq_apply_changes
    # Read settings used by this scenario.
    config_get dnsmasq_apply_changes settings dnsmasq_apply_changes "$DEFAULT_DNSMASQ_APPLY_CHANGES"
    config_get dns_listen_port proxy dns_listen_port "$DEFAULT_DNS_LISTEN_PORT"

    # Validate before applying any changes.
    config_validate_bool "$dnsmasq_apply_changes" "settings.dnsmasq_apply_changes" || validation_failed=1

    if [ "$dnsmasq_apply_changes" = "1" ]; then
        config_validate_port "$dns_listen_port" "proxy.dns_listen_port" || validation_failed=1
    fi

    if [ "$validation_failed" -ne 0 ]; then
        log error "Dnsmasq configuration validation failed."
        return 1
    fi

    dnsmasq_update \
        "$dnsmasq_apply_changes" \
        "$dns_listen_port" \
        "$PROGNAME"
}

run_dnsmasq_restore() {
    local validation_failed=0
    local dns_listen_port dnsmasq_apply_changes
    # Read settings used by this scenario.
    config_get dnsmasq_apply_changes settings dnsmasq_apply_changes "$DEFAULT_DNSMASQ_APPLY_CHANGES"
    config_get dns_listen_port proxy dns_listen_port "$DEFAULT_DNS_LISTEN_PORT"

    # Validate before applying any changes.
    config_validate_bool "$dnsmasq_apply_changes" "settings.dnsmasq_apply_changes" || validation_failed=1

    if [ "$dnsmasq_apply_changes" = "1" ]; then
        config_validate_port "$dns_listen_port" "proxy.dns_listen_port" || validation_failed=1
    fi

    if [ "$validation_failed" -ne 0 ]; then
        log error "Dnsmasq configuration validation failed."
        return 1
    fi

    dnsmasq_restore \
        "$dnsmasq_apply_changes" \
        "$dns_listen_port" \
        "$PROGNAME"
}

# Complex YAML section readers live with the scenario that owns their validation.
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
    local section="$1" callback="$2" reserved_marks="$3"
    local name enabled proxy_link_uri dialer_proxy interface_name routing_mark
    local list_update_interval size_limit mode proxy_link_object use_for_update ip_version
    local src_routes enabled_list domain_routes geosite_list destip_routes geoip_list
    config_get name "$section" name
    [ -n "$name" ] || {
        log warn "Skip proxy without name: $section"
        return
    }
    config_get_bool enabled "$section" enabled 1
    [ "$enabled" -eq 1 ] || {
        log warn "Skip disabled proxy: $section"
        return
    }
    config_get routing_mark "$section" routing_mark
    routing_mark=$(val_parse_routing_mark "$routing_mark" "$reserved_marks")
    [ "$routing_mark" != -1 ] || {
        log warn "Skip proxy '$section' due to invalid routing mark"
        return
    }
    config_get proxy_link_uri "$section" proxy_link_uri
    config_get dialer_proxy "$section" dialer_proxy
    config_get interface_name "$section" interface_name
    config_get list_update_interval "$section" list_update_interval "$DEFAULT_RULESET_INTERVAL"
    val_is_uint "$list_update_interval" || {
        log warn "Invalid list update interval for proxy '$name'; using default"
        list_update_interval="$DEFAULT_RULESET_INTERVAL"
    }
    config_get size_limit "$section" size_limit 0
    val_is_uint "$size_limit" || {
        log warn "Invalid size limit for proxy '$name'; using zero"
        size_limit=0
    }
    config_get mode "$section" mode uri
    config_get proxy_link_object "$section" proxy_link_object
    config_get_bool use_for_update "$section" use_proxy_for_list_update 0
    config_get ip_version "$section" ip_version dual
    ip_version=$(val_parse_ip_version "$ip_version")
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
    config_get_bool enabled "$section" enabled 1
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
    config_get check_url "$section" check_url "$DEFAULT_HEALTHCHECK_URL"
    config_get expected_status "$section" expected_status "$DEFAULT_HEALTHCHECK_RESULT"
    val_is_uint "$expected_status" || expected_status="$DEFAULT_HEALTHCHECK_RESULT"
    config_get interval "$section" interval "$DEFAULT_GROUP_HEALTHCHECK_INTERVAL"
    val_is_uint "$interval" || interval="$DEFAULT_GROUP_HEALTHCHECK_INTERVAL"
    config_get timeout "$section" check_timeout "$DEFAULT_HEALTHCHECK_TIMEOUT"
    val_is_uint "$timeout" || timeout="$DEFAULT_HEALTHCHECK_TIMEOUT"
    config_get max_failed "$section" max_failed_times "$DEFAULT_HEALTHCHECK_MAX_FAILED_TIMES"
    val_is_uint "$max_failed" || max_failed="$DEFAULT_HEALTHCHECK_MAX_FAILED_TIMES"
    config_get lazy "$section" lazy 0
    config_get tolerance "$section" tolerance
    config_get selected "$section" default_selected
    config_get filter "$section" filter
    config_get exclude_filter "$section" exclude_filter
    config_get exclude_type "$section" exclude_type
    config_get enabled_list "$section" enabled_list
    config_get update_interval "$section" list_update_interval "$DEFAULT_RULESET_INTERVAL"
    val_is_uint "$update_interval" || update_interval="$DEFAULT_RULESET_INTERVAL"
    config_get size_limit "$section" size_limit 0
    val_is_uint "$size_limit" || size_limit=0
    config_get_bool use_for_update "$section" use_proxy_group_for_list_update 0
    config_get src_routes "$section" additional_srcip_route
    config_get domain_routes "$section" additional_domain_route
    config_get geosite_list "$section" enabled_geosite_list
    config_get destip_routes "$section" additional_destip_route
    config_get geoip_list "$section" enabled_geoip_list
    "$callback" "$name" "$proxies" "$providers" "$group_type" "$strategy" "$check_url" "$expected_status" "$interval" "$timeout" "$max_failed" "$lazy" "$tolerance" "$selected" "$filter" "$exclude_filter" "$exclude_type" "$enabled_list" "$update_interval" "$size_limit" "$use_for_update" "$src_routes" "$domain_routes" "$geosite_list" "$destip_routes" "$geoip_list"
}

config_proxy_provider_read() {
    local section="$1" callback="$2" reserved_marks="$3"
    local name enabled subscription routing_mark ip_version interval size_limit
    local filter exclude_filter exclude_type proxy dialer interface_name auth hwid hwid_custom user_agent private_key public_key
    local health_check expected_status check_url check_interval timeout lazy
    config_get name "$section" name
    config_get subscription "$section" subscription
    if [ -z "$name" ] || [ -z "$subscription" ]; then
        log warn "Skip proxy provider without a name or subscription"
        return
    fi
    config_get_bool enabled "$section" enabled 1
    [ "$enabled" -eq 1 ] || {
        log warn "Skip disabled proxy provider: $section"
        return
    }
    config_get routing_mark "$section" override_routing_mark
    routing_mark=$(val_parse_routing_mark "$routing_mark" "$reserved_marks")
    [ "$routing_mark" != -1 ] || {
        log warn "Skip proxy provider '$section' due to invalid routing mark"
        return
    }
    config_get ip_version "$section" override_ip_version dual
    ip_version=$(val_parse_ip_version "$ip_version")
    config_get interval "$section" update_interval "$DEFAULT_PROVIDERUPDATE_INTERVAL"
    val_is_uint "$interval" || interval="$DEFAULT_PROVIDERUPDATE_INTERVAL"
    config_get size_limit "$section" size_limit 0
    val_is_uint "$size_limit" || size_limit=0
    config_get filter "$section" filter
    config_get exclude_filter "$section" exclude_filter
    config_get exclude_type "$section" exclude_type
    config_get proxy "$section" proxy "$DEFAULT_PROXY"
    config_get dialer "$section" override_dialer_proxy
    config_get interface_name "$section" override_interface_name
    config_get auth "$section" header_authorization
    config_get hwid "$section" header_hwid
    config_get hwid_custom "$section" header_hwid_custom
    config_get user_agent "$section" header_user_agent
    config_get private_key "$section" age_private_key
    config_get public_key "$section" header_age_public_key
    config_get_bool health_check "$section" health_check 0
    config_get expected_status "$section" health_check_expected_status "$DEFAULT_HEALTHCHECK_RESULT"
    val_is_uint "$expected_status" || expected_status="$DEFAULT_HEALTHCHECK_RESULT"
    config_get check_url "$section" health_check_url "$DEFAULT_HEALTHCHECK_URL"
    config_get check_interval "$section" health_check_interval "$DEFAULT_HEALTHCHECK_INTERVAL"
    val_is_uint "$check_interval" || check_interval="$DEFAULT_HEALTHCHECK_INTERVAL"
    config_get timeout "$section" health_check_timeout "$DEFAULT_HEALTHCHECK_TIMEOUT"
    val_is_uint "$timeout" || timeout="$DEFAULT_HEALTHCHECK_TIMEOUT"
    config_get lazy "$section" health_check_lazy 0
    "$callback" "$name" "$subscription" "$routing_mark" "$ip_version" "$interval" "$size_limit" "$filter" "$exclude_filter" "$exclude_type" "$proxy" "$dialer" "$interface_name" "$auth" "$hwid" "$hwid_custom" "$user_agent" "$private_key" "$public_key" "$health_check" "$expected_status" "$check_url" "$check_interval" "$timeout" "$lazy"
}

# Reads and validates YAML settings, then atomically promotes the generated document.
core_generate_yaml() {
    local router_selected_ipaddr="$1"
    local validation_failed=0

    # ash locals are dynamically scoped. Synchronous YAML callbacks update this
    # build state without leaking it into the process-wide environment.
    local OUT_RULES="[]" OUT_RULESETS="{}" OUT_FAKE_IP_RULES="[]"
    local OUT_PROXY_GROUPS="[]" OUT_PROXIES="[]" OUT_PROXY_PROVIDERS=""
    local OUT_NAMES_RULESETS="" OUT_NAMES_SUFFIXES="" OUT_NAMES_GEOSITE=""
    local OUT_MIXED_RULES="" OUT_FINAL_RULES=""
    local _IPCIDR_RULESETS_BUFFER="" _STATIC_IPS_BUFFER="" _STATIC_SOURCE_IPS_BUFFER=""
    local _RULESETS_CONTENT="" _BLOCK_RULESETS_CONTENT=""
    local JC_CONFIG_LIST_VALUE=""
    # These values are consumed only by nested YAML builders.
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
    config_get ipv6_enabled settings ipv6_enabled 0
    config_get use_dashboard proxy use_dashboard 0
    config_get dashboard_repo proxy dashboard_repo "$DEFAULT_EXTERNAL_PANEL"
    dashboard_url=""
    if [ "$use_dashboard" = "1" ]; then
        dashboard_url=$(config_dashboard_url_read \
            "$dashboard_repo" \
            "$DEFAULT_DASHBOARD_METACUBEXD_URL" \
            "$DEFAULT_DASHBOARD_YACD_META_URL" \
            "$DEFAULT_DASHBOARD_ZASHBOARD_URL") || return 1
    fi
    config_get api_password proxy api_password
    config_get log_level proxy log_level
    config_get api_tls proxy api_tls 0
    config_get api_tls_cert proxy api_tls_cert "$DEFAULT_API_TLS_CERT_PATH"
    config_get api_tls_key proxy api_tls_key "$DEFAULT_API_TLS_KEY_PATH"
    config_get interface_name proxy interface_name
    config_get tproxy_port proxy tproxy_port
    config_get use_mixed_port proxy use_mixed_port 0
    config_get mixed_port proxy mixed_port "$DEFAULT_MIXED_PORT"
    config_get unified_delay proxy unified_delay 0
    config_get tcp_concurrent proxy tcp_concurrent 0
    config_get keep_alive_idle proxy keep_alive_idle "$DEFAULT_KEEP_ALIVE_IDLE"
    config_get keep_alive_interval proxy keep_alive_interval "$DEFAULT_KEEP_ALIVE_INTERVAL"
    config_get global_ua proxy global_ua
    config_get etag_support proxy etag_support 0
    config_get profile_store_selected proxy profile_store_selected 0
    config_get profile_store_fake_ip proxy profile_store_fake_ip 0
    config_get core_ntp_enabled proxy core_ntp_enabled 0
    config_get core_ntp_server proxy core_ntp_server
    config_get core_ntp_port proxy core_ntp_port "$DEFAULT_NTP_PORT"
    config_get core_ntp_interval proxy core_ntp_interval "$DEFAULT_CORE_NTP_INTERVAL"
    config_get core_ntp_write_system proxy core_ntp_write_system 0
    config_get dns_listen_port proxy dns_listen_port "$DEFAULT_DNS_LISTEN_PORT"
    config_get dns_cache_max_size proxy dns_cache_max_size "$DEFAULT_DNS_CACHE_MAX_SIZE"
    config_get use_system_hosts proxy use_system_hosts 0
    config_get fake_ip_range proxy fake_ip_range
    config_get fake_ip_range6 proxy fake_ip_range6
    config_get fake_ip_ttl proxy fake_ip_ttl "$DEFAULT_FAKE_IP_TTL"
    config_get sniffer_enable proxy sniffer_enable 0
    config_get sniffer_parse_pure_ip proxy sniffer_parse_pure_ip 0
    config_get sniffer_override_destination proxy sniffer_override_destination 0
    config_get fake_ip_exclude_domains proxy fake_ip_exclude_domains
    config_get fake_ip_exclude_rulesets proxy fake_ip_exclude_rulesets
    config_get fake_ip_exclude_geosites proxy fake_ip_exclude_geosites
    config_get geodata_mode proxy geodata_mode 0
    config_get geodata_autoupdate proxy geodata_autoupdate 0
    config_get geodata_autoupdate_interval proxy geodata_autoupdate_interval "$DEFAULT_GEODATA_UPDATE_INTERVAL"
    config_get geosite_url settings mihomo_geosite_url "$DEFAULT_GEOSITE_URL"
    config_get geoip_url settings mihomo_geoip_url "$DEFAULT_GEOIP_URL"

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

    config_get block_enabled block_rules enabled 1
    config_get block_enabled_list block_rules enabled_blocklist
    config_get block_proxy block_rules proxy "$DEFAULT_PROXY"
    config_get block_update_interval block_rules list_update_interval "$DEFAULT_RULESET_INTERVAL"
    config_get block_size_limit block_rules size_limit 0
    config_get block_geosite_list block_rules enabled_geosite_blocklist
    config_get block_domain_routes block_rules additional_domain_blockroute
    config_get block_destip_routes block_rules additional_destip_blockroute
    config_get block_geoip_list block_rules enabled_geoip_blocklist
    config_get mixed_exit_rule mixed_port_rules exit_rule
    config_get final_exit_rule final_rules exit_rule
    # Validate before applying any changes.
    config_validate_bool "$ipv6_enabled" "settings.ipv6_enabled" || validation_failed=1
    config_validate_bool "$use_dashboard" "proxy.use_dashboard" || validation_failed=1
    config_validate_bool "$api_tls" "proxy.api_tls" || validation_failed=1
    config_validate_bool "$use_mixed_port" "proxy.use_mixed_port" || validation_failed=1
    config_validate_bool "$unified_delay" "proxy.unified_delay" || validation_failed=1
    config_validate_bool "$tcp_concurrent" "proxy.tcp_concurrent" || validation_failed=1
    config_validate_bool "$etag_support" "proxy.etag_support" || validation_failed=1
    config_validate_bool "$profile_store_selected" "proxy.profile_store_selected" || validation_failed=1
    config_validate_bool "$profile_store_fake_ip" "proxy.profile_store_fake_ip" || validation_failed=1
    config_validate_bool "$core_ntp_enabled" "proxy.core_ntp_enabled" || validation_failed=1
    config_validate_bool "$core_ntp_write_system" "proxy.core_ntp_write_system" || validation_failed=1
    config_validate_bool "$use_system_hosts" "proxy.use_system_hosts" || validation_failed=1
    config_validate_bool "$sniffer_enable" "proxy.sniffer_enable" || validation_failed=1
    config_validate_bool "$sniffer_parse_pure_ip" "proxy.sniffer_parse_pure_ip" || validation_failed=1
    config_validate_bool "$sniffer_override_destination" "proxy.sniffer_override_destination" || validation_failed=1
    config_validate_bool "$geodata_mode" "proxy.geodata_mode" || validation_failed=1
    config_validate_bool "$geodata_autoupdate" "proxy.geodata_autoupdate" || validation_failed=1
    config_validate_bool "$block_enabled" "block_rules.enabled" || validation_failed=1
    config_validate_port "$tproxy_port" "proxy.tproxy_port" || validation_failed=1
    config_validate_port "$dns_listen_port" "proxy.dns_listen_port" || validation_failed=1
    [ "$use_mixed_port" != 1 ] || config_validate_port "$mixed_port" "proxy.mixed_port" || validation_failed=1
    [ "$core_ntp_enabled" != 1 ] || config_validate_port "$core_ntp_port" "proxy.core_ntp_port" || validation_failed=1
    config_validate_uint "$keep_alive_idle" "proxy.keep_alive_idle" || validation_failed=1
    config_validate_uint "$keep_alive_interval" "proxy.keep_alive_interval" || validation_failed=1
    config_validate_uint "$core_ntp_interval" "proxy.core_ntp_interval" || validation_failed=1
    config_validate_uint "$dns_cache_max_size" "proxy.dns_cache_max_size" || validation_failed=1
    config_validate_uint "$fake_ip_ttl" "proxy.fake_ip_ttl" || validation_failed=1
    config_validate_uint "$geodata_autoupdate_interval" "proxy.geodata_autoupdate_interval" || validation_failed=1
    config_validate_uint "$block_update_interval" "block_rules.list_update_interval" || validation_failed=1
    config_validate_uint "$block_size_limit" "block_rules.size_limit" || validation_failed=1
    if [ "$api_tls" = 1 ]; then
        config_validate_absolute_path "$api_tls_cert" "proxy.api_tls_cert" || validation_failed=1
        config_validate_absolute_path "$api_tls_key" "proxy.api_tls_key" || validation_failed=1
    fi
    if [ -n "$interface_name" ] && ! val_is_ifname "$interface_name"; then
        config_validation_error "proxy.interface_name contains an invalid interface name"
        validation_failed=1
    fi
    if [ "$use_dashboard" = 1 ] && [ -z "$dashboard_url" ]; then
        config_validation_error "the selected dashboard URL is required when dashboard is enabled"
        validation_failed=1
    fi
    if [ "$geodata_autoupdate" = 1 ]; then
        [ -n "$geosite_url" ] || {
            config_validation_error "settings.mihomo_geosite_url is required when geodata autoupdate is enabled"
            validation_failed=1
        }
        [ -n "$geoip_url" ] || {
            config_validation_error "settings.mihomo_geoip_url is required when geodata autoupdate is enabled"
            validation_failed=1
        }
    fi

    if [ "$validation_failed" -ne 0 ]; then
        return 1
    fi

    effective_interface_name="$interface_name"

    global_ua=$(resolve_user_agent "$global_ua")

    [ -n "$effective_interface_name" ] && effective_interface_name=$(str_trim "$effective_interface_name")
    if [ -n "$effective_interface_name" ] && ! val_is_ifname "$effective_interface_name"; then
        log warn "Global interface_name '$effective_interface_name' is invalid and will be ignored."
        effective_interface_name=""
    fi

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
        yaml_proxy_provider_append \
        "$NF_TABLE_FWMARK_FINAL $NF_TABLE_FWMARK_PROXY"
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
        yaml_proxy_append \
        "$NF_TABLE_FWMARK_FINAL $NF_TABLE_FWMARK_PROXY"
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
    local validation_failed=0
    local base_url

    # Read settings used by this scenario.
    config_get base_url settings mihomo_rulesets_files_download_url "$DEFAULT_MIHOMO_RULESETS_FILES_DOWNLOAD_URL"

    # Validate before applying any changes.
    [ -n "$base_url" ] || {
        config_validation_error "settings.mihomo_rulesets_files_download_url is required"
        validation_failed=1
    }

    if [ "$validation_failed" -ne 0 ]; then
        return 1
    fi

    mkdir -p "$CORE_WORKDIR_PATH" "$PROG_ETC_DIR"

    service_data_file_update \
        "$base_url" "$RULESETS_FILENAME" "$RULESETS_FILE" "$CORE_WORKDIR_PATH" \
        "ruleset list" || return "$?"

    service_data_file_update \
        "$base_url" "$RULESETS_BLOCKS_FILENAME" "$RULESETS_BLOCKS_FILE" "$CORE_WORKDIR_PATH" \
        "block ruleset list" || return "$?"
}

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
    local validation_failed=0
    local channel custom_url repository source_type

    local current_version latest_version version_url

    # Read settings used by this scenario.
    config_get source_type settings mihomo_core_source_type "$DEFAULT_MIHOMO_SOURCE_CORE"
    config_get custom_url settings mihomo_custom_core_url
    config_get channel settings mihomo_github_channel "$DEFAULT_MIHOMO_UPDATE_CHANNEL"
    config_get repository settings mihomo_github_repo "$DEFAULT_MIHOMO_GITHUB_REPO"

    # Validate before applying any changes.
    if ! val_is_choice "$source_type" github custom; then
        config_validation_error "settings.mihomo_core_source_type must be 'github' or 'custom'"
        validation_failed=1
    fi

    if [ "$source_type" = custom ]; then
        [ -n "$custom_url" ] || {
            config_validation_error "settings.mihomo_custom_core_url is required for custom core source"
            validation_failed=1
        }
    else
        [ -n "$channel" ] || {
            config_validation_error "settings.mihomo_github_channel is required for GitHub core source"
            validation_failed=1
        }
        [ -n "$repository" ] || {
            config_validation_error "settings.mihomo_github_repo is required for GitHub core source"
            validation_failed=1
        }
    fi

    if [ "$validation_failed" -ne 0 ]; then
        return 1
    fi

    if [ "$source_type" = custom ]; then
        log info "Checking for Mihomo updates from custom source..."
    else
        log info "Checking for Mihomo updates from configured repository (channel: $channel)..."
    fi

    version_url=$(core_update_source_resolve \
        "$source_type" "$custom_url" "$channel" "$repository") || {
        log error "Failed to resolve the core version source."
        return 1
    }
    [ -n "$version_url" ] || {
        log error "Release version metadata was not found."
        return 1
    }

    latest_version=$(core_update_latest_version_get "$version_url") || {
        log error "Failed to download core version metadata."
        return 1
    }
    [ -n "$latest_version" ] || {
        log error "Failed to retrieve the latest version information."
        return 1
    }

    current_version=$(core_info_mihomo "$CORE_PATH" "$NO_DATA_STRING")
    core_update_apply \
        "$current_version" "$latest_version" "$version_url" \
        "$NO_DATA_STRING" "$CORE_WORKDIR_PATH" "$CORE_PATH"
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
    cron_job_check "${PROG_PATH} service_data_update"
}

service_data_cron_add() {
    local schedule="$1"

    cron_job_add "$schedule" "${PROG_PATH} service_data_update" "$PROG_PATH service_data_update # Service Data Update" "Service data update"
}

service_data_cron_remove() {
    cron_job_remove "${PROG_PATH} service_data_update" "Service data update"
}

scheduled_work_cron_add() {
    local start_schedule="$1"
    local stop_schedule="$2"

    cron_job_add "$start_schedule" "${INITD_PATH} start # Scheduled Work" "pgrep -f ${CORE_PATH} >/dev/null || ${INITD_PATH} start # Scheduled Work" "Scheduled work start"
    cron_job_add "$stop_schedule" "${INITD_PATH} stop # Scheduled Work" "pgrep -f ${CORE_PATH} >/dev/null && ${INITD_PATH} stop # Scheduled Work" "Scheduled work stop"
}

scheduled_work_cron_remove() {
    cron_job_remove "${INITD_PATH} start # Scheduled Work" "Scheduled work start"
    cron_job_remove "${INITD_PATH} stop # Scheduled Work" "Scheduled work stop"
}

cron_update() {
    local validation_failed=0
    local autorestart_enabled autorestart_schedule scheduled_work_enabled scheduled_work_start_schedule
    local scheduled_work_stop_schedule service_data_autoupdate_enabled service_data_update_schedule
    # Read settings used by this scenario.
    config_get autorestart_enabled settings mihomo_autorestart 0
    config_get autorestart_schedule settings mihomo_cron_autorestart_string
    config_get service_data_autoupdate_enabled settings mihomo_service_data_autoupdate 0
    config_get service_data_update_schedule settings mihomo_cron_service_data_update_string
    config_get scheduled_work_enabled settings mihomo_scheduled_work 0
    config_get scheduled_work_start_schedule settings mihomo_cron_scheduled_work_start_string "$DEFAULT_SCHEDULED_WORK_START_CRON"
    config_get scheduled_work_stop_schedule settings mihomo_cron_scheduled_work_stop_string "$DEFAULT_SCHEDULED_WORK_STOP_CRON"

    # Validate before applying any changes.
    config_validate_bool "$autorestart_enabled" "settings.mihomo_autorestart" || validation_failed=1
    config_validate_bool "$service_data_autoupdate_enabled" "settings.mihomo_service_data_autoupdate" || validation_failed=1
    config_validate_bool "$scheduled_work_enabled" "settings.mihomo_scheduled_work" || validation_failed=1

    config_validate_enabled_cron \
        "$autorestart_enabled" \
        "$autorestart_schedule" \
        "mihomo_cron_autorestart_string" || validation_failed=1
    config_validate_enabled_cron \
        "$service_data_autoupdate_enabled" \
        "$service_data_update_schedule" \
        "mihomo_cron_service_data_update_string" || validation_failed=1
    config_validate_enabled_cron \
        "$scheduled_work_enabled" \
        "$scheduled_work_start_schedule" \
        "mihomo_cron_scheduled_work_start_string" || validation_failed=1
    config_validate_enabled_cron \
        "$scheduled_work_enabled" \
        "$scheduled_work_stop_schedule" \
        "mihomo_cron_scheduled_work_stop_string" || validation_failed=1

    if [ "$validation_failed" -ne 0 ]; then
        return 1
    fi

    if [ "$autorestart_enabled" -eq 1 ]; then
        core_autorestart_cron_add "$autorestart_schedule"
    else
        core_autorestart_cron_remove
    fi

    if [ "$service_data_autoupdate_enabled" -eq 1 ]; then
        service_data_cron_add "$service_data_update_schedule"
    else
        service_data_cron_remove
    fi

    if [ "$scheduled_work_enabled" -eq 1 ]; then
        scheduled_work_cron_add \
            "$scheduled_work_start_schedule" \
            "$scheduled_work_stop_schedule"
    else
        scheduled_work_cron_remove
    fi
}

run_diag_route() {
    local validation_failed=0
    local ipv6_enabled
    # Read settings used by this scenario.
    config_get ipv6_enabled settings ipv6_enabled 0

    # Validate before applying any changes.
    config_validate_bool "$ipv6_enabled" "settings.ipv6_enabled" || validation_failed=1

    if [ "$validation_failed" -ne 0 ]; then
        return 1
    fi

    diag_route "$NF_TABLE_FWMARK_FINAL" "$NF_ROUTE_TABLE" "$ipv6_enabled"
}

run_diag_proxy_resolver() {
    local validation_failed=0
    local dns_listen_port
    local target="$1"

    # Read settings used by this scenario.
    config_get dns_listen_port proxy dns_listen_port "$DEFAULT_DNS_LISTEN_PORT"

    # Validate before applying any changes.
    if ! val_is_port "$dns_listen_port"; then
        config_validation_error "proxy.dns_listen_port must be an integer from 1 to 65535"
        validation_failed=1
    fi

    if [ "$validation_failed" -ne 0 ]; then
        return 1
    fi

    diag_proxy_resolver "$target" "$dns_listen_port" "$NSLOOKUP_TIMEOUT"
}

diag_report() {
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
    echo "  Yandex ($DEFAULT_DIAG_IP_CHECK_PING_YANDEX):"
    diag_icmp "$DEFAULT_DIAG_IP_CHECK_PING_YANDEX" 2 2 | sed 's/^/    /'
    echo ""
    echo "  Google ($DEFAULT_DIAG_IP_CHECK_PING_GOOGLE):"
    diag_icmp "$DEFAULT_DIAG_IP_CHECK_PING_GOOGLE" 2 2 | sed 's/^/    /'
    echo ""
    echo "  GitHub ($DEFAULT_DIAG_DOMAIN_CHECK_PING_GITHUB):"
    diag_icmp "$DEFAULT_DIAG_DOMAIN_CHECK_PING_GITHUB" 2 2 | sed 's/^/    /'
    echo ""
    echo "  [ DNS Resolves ]"
    echo "  Proxy ($DEFAULT_DIAG_RESOLVE_URL_YANDEX):"
    run_diag_proxy_resolver "$DEFAULT_DIAG_RESOLVE_URL_YANDEX" | sed 's/^/    /'
    echo ""
    echo "  External ($DEFAULT_DIAG_RESOLVE_URL_YANDEX via $DEFAULT_DIAG_IP_CHECK_PING_YANDEX):"
    diag_external_resolver "$DEFAULT_DIAG_RESOLVE_URL_YANDEX" "$DEFAULT_DIAG_IP_CHECK_PING_YANDEX" "$NSLOOKUP_TIMEOUT" | sed 's/^/    /'
    echo ""
    echo "  External ($DEFAULT_DIAG_RESOLVE_URL_YANDEX via $DEFAULT_DIAG_IP_CHECK_PING_GOOGLE):"
    diag_external_resolver "$DEFAULT_DIAG_RESOLVE_URL_YANDEX" "$DEFAULT_DIAG_IP_CHECK_PING_GOOGLE" "$NSLOOKUP_TIMEOUT" | sed 's/^/    /'
    echo ""
    echo "  [ DPI Applications ]"
    print_dpi_status "Zapret" "$ZAPRETINITD_FILEPATH"
    print_dpi_status "ByeDPI" "$BYEDPI_FILEPATH"
    print_dpi_status "YoutubeUnblock" "$YOUTUBEUNBLOCK_FILEPATH"
    print_dpi_status "B4" "$B4_FILEPATH"
    echo ""
    echo "  [ NFT Tables ]"
    diag_nft "$NF_TABLE_NAME" | sed 's/^/    /'
    echo ""
    echo "  [ Routes ]"
    run_diag_route | sed 's/^/    /'
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
    diag_service_config "$CONFIG_PATH" | sed 's/^/    /'
    echo ""
    echo "  [ Mihomo Config ]"
    diag_mihomo_config "$OUTPUT_YAML_CONFIG_PATH" | sed 's/^/    /'
    echo ""
    echo "----------------------------------------------------------------"
    echo ""
}

diag_report_redacted() {
    local running_status autoload_status

    service "$PROGNAME" running && running_status="active" || running_status="inactive"
    service "$PROGNAME" enabled && autoload_status="enabled" || autoload_status="disabled"

    diag_redacted_check() {
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
    diag_redacted_check "ICMP check 1" \
        diag_icmp "$DEFAULT_DIAG_IP_CHECK_PING_YANDEX" 2 2
    diag_redacted_check "ICMP check 2" \
        diag_icmp "$DEFAULT_DIAG_IP_CHECK_PING_GOOGLE" 2 2
    diag_redacted_check "Proxy DNS resolve" \
        run_diag_proxy_resolver "$DEFAULT_DIAG_RESOLVE_URL_YANDEX"
    diag_redacted_check "External DNS resolve" \
        diag_external_resolver \
        "$DEFAULT_DIAG_RESOLVE_URL_YANDEX" \
        "$DEFAULT_DIAG_IP_CHECK_PING_GOOGLE" \
        "$NSLOOKUP_TIMEOUT"
    echo ""
    echo "  [ Runtime ]"
    diag_redacted_check "NFT state" diag_nft "$NF_TABLE_NAME"
    diag_redacted_check "Policy routes" run_diag_route
    echo ""
    echo "  Configuration, addresses, domains, identifiers and raw network"
    echo "  state are intentionally omitted from this report."
    echo ""
    echo "----------------------------------------------------------------"
    echo ""
}

case "$1" in
start | run | up | u)
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
    config_init "$PROGNAME"
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
core_update | cu)
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/http.sh \
        /usr/lib/justclash/runtime/core.sh \
        /usr/lib/justclash/runtime/core_update.sh
    config_init "$PROGNAME"
    core_update
    ;;
core_remove | cr)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/core.sh
    core_remove
    ;;

cron_update | cru)
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

service_data_update | sdu)
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/http.sh \
        /usr/lib/justclash/runtime/service_data.sh
    config_init "$PROGNAME"
    service_data_update
    ;;
logs | log | l)
    import /usr/lib/justclash/logging.sh
    case "$2" in
    *[!0-9]* | '')
        logs "$PROGNAME"
        ;;
    *)
        logs "$PROGNAME" "$2"
        ;;
    esac
    ;;
systemlogs)
    import /usr/lib/justclash/logging.sh
    case "$2" in
    *[!0-9]* | '')
        systemlogs "$PROGNAME"
        ;;
    *)
        systemlogs "$PROGNAME" "$2"
        ;;
    esac
    ;;
info_core | core_info_mihomo | version_core | vc | --vc)
    import /usr/lib/justclash/runtime/core.sh
    core_info_mihomo "$CORE_PATH" "$NO_DATA_STRING"
    ;;
info_package | version | v | -v | --version)
    echo "$JUSTCLASH_VERSION"
    ;;
diag_nft | dn)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
    diag_nft "$NF_TABLE_NAME"
    ;;
diag_route | dr)
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/diagnostics.sh
    config_init "$PROGNAME"
    run_diag_route
    ;;
diag_report | diag | dg)
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/core.sh \
        /usr/lib/justclash/runtime/diagnostics.sh
    config_init "$PROGNAME"
    diag_report
    ;;
diag_redacted | dgr)
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/core.sh \
        /usr/lib/justclash/runtime/diagnostics.sh
    config_init "$PROGNAME"
    diag_report_redacted
    ;;
diag_proxy_resolver | dpr)
    import \
        /lib/functions.sh \
        /lib/config/uci.sh \
        /usr/lib/justclash/logging.sh \
        /usr/lib/justclash/helpers.sh \
        /usr/lib/justclash/config.sh \
        /usr/lib/justclash/runtime/diagnostics.sh
    config_init "$PROGNAME"
    run_diag_proxy_resolver "$2"
    ;;
diag_external_resolver | der)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
    diag_external_resolver "$2" "$3" "$NSLOOKUP_TIMEOUT"
    ;;
diag_icmp | di)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
    diag_icmp "$2" "${3:-3}" 2
    ;;
diag_mihomo_config | dmc)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
    diag_mihomo_config "$OUTPUT_YAML_CONFIG_PATH"
    ;;
diag_mihomo_config_unsafe | dmcu)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
    diag_mihomo_config_unsafe "$OUTPUT_YAML_CONFIG_PATH"
    ;;
diag_service_config | dsc)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
    diag_service_config "$CONFIG_PATH"
    ;;
diag_service_config_unsafe | dscu)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/runtime/diagnostics.sh
    diag_service_config_unsafe "$CONFIG_PATH"
    ;;
config_reset | cfr | diag_service_config_reset | dscr)
    import /usr/lib/justclash/logging.sh /usr/lib/justclash/config.sh
    config_reset "$DEFAULT_CONFIG_PATH" "$CONFIG_PATH" "$CONFIG_BAK_PATH"
    ;;
show_hwid | hwid)
    import /usr/lib/justclash/helpers.sh
    sysinfo_hwid_generate
    echo ""
    ;;
help | '?' | command | h | -h | --help)
    import /usr/lib/justclash/help.sh
    help
    ;;
_luci_call)
    import /usr/lib/justclash/runtime/core.sh
    echo "$JUSTCLASH_VERSION,$(core_info_mihomo "$CORE_PATH" "$NO_DATA_STRING")"
    ;;
*)
    import /usr/lib/justclash/logging.sh
    clog info "Unknown command: $1"
    clog info "Type 'justclash.sh help' for a list of available commands."
    exit 1
    ;;
esac
