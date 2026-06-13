#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

set -f # Disable path expansion (globbing) globally to safely iterate over user-defined lists containing *

# --------------------------------------------
# Main justclash service part
# Directly using uci config calls every load
# Avoid adding simple commands for perfomance
# --------------------------------------------

PROGNAME="justclash"

# Simple self contained function for file import
# Will write logs at fail and call exit
import() {
    local file="$1"

    # shellcheck disable=SC1090
    if ! . "$file" 2>/dev/null; then
        printf '[%s] [user.err] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "File $file can't be loaded!"
        logger -p "user.err" -t "$PROGNAME" "File $file can't be loaded!"
        exit 1
    fi
}

CURL_CONNECT_TIMEOUT=15
CURL_MIN_SPEED_LIMIT_BYTES=5000
CURL_MIN_SPEED_TIMEOUT=15
NSLOOKUP_TIMEOUT=5

JUSTCLASH_VERSION="__COMPILED_VERSION_VARIABLE__"

import /lib/functions/network.sh
import /lib/functions.sh
import /lib/config/uci.sh
import /usr/lib/justclash/logging.sh
import /usr/lib/justclash/compat.sh
import /usr/lib/justclash/uri.sh
import /usr/lib/justclash/helpers.sh

config_load "$PROGNAME"

NO_DATA_STRING="N/A"
CORE_BIN_NAME="mihomo"

# Path to Mihomo core
CORE_PATH="/usr/bin/${CORE_BIN_NAME}"
INITD_PATH="/etc/init.d/${PROGNAME}"
PROG_PATH="/usr/bin/${PROGNAME}.sh"
# workdir path (in RAM)
CORE_WORKDIR_PATH="/tmp/${PROGNAME}"
# Mihomo using directory 'rules' by default in workdir
# if nothing selected in path fields for rules
CORE_WORKDIR_RULES_PATH="${CORE_WORKDIR_PATH}/rules"
CORE_WORKDIR_CACHE_DB_PATH="${CORE_WORKDIR_PATH}/cache.db"
CORE_WORKDIR_UCI_HASH_PATH="${CORE_WORKDIR_PATH}/uci.hash"
OUTPUT_YAML_CONFIG_PATH="${CORE_WORKDIR_PATH}/config.yaml"

PROG_ETC_DIR="/etc/${PROGNAME}"
RULESETS_BLOCKS_FILENAME="block.rulesets.txt"
RULESETS_FILENAME="rulesets.txt"
USER_RULESETS_FILENAME="user.rulesets.txt"
USER_RULESETS_BLOCKS_FILENAME="user.block.rulesets.txt"
SYMLINKDIR_RULESETS="${PROG_ETC_DIR}/rules"
SYMLINK_CACHE_DB_PATH="${PROG_ETC_DIR}/cache.db"
RULESETS_BLOCKS_FILE="${PROG_ETC_DIR}/${RULESETS_BLOCKS_FILENAME}"
RULESETS_FILE="${PROG_ETC_DIR}/${RULESETS_FILENAME}"
USER_RULESETS_FILE="${PROG_ETC_DIR}/${USER_RULESETS_FILENAME}"
USER_RULESETS_BLOCKS_FILE="${PROG_ETC_DIR}/${USER_RULESETS_BLOCKS_FILENAME}"

DASHBOARD_PATH="${PROG_ETC_DIR}/dashboard"

ETC_CONFIG_DIR="/etc/config"
DEFAULT_CONFIG_PATH="${PROG_ETC_DIR}/default.config"
CONFIG_PATH="${ETC_CONFIG_DIR}/${PROGNAME}"
CONFIG_BAK_PATH="${ETC_CONFIG_DIR}/${PROGNAME}.bak"

# List of NTP server IP addresses:
DEFAULT_NTP_IPS="194.190.168.1 89.109.251.22 89.109.251.23 216.239.35.4 216.239.35.8"
DEFAULT_DOH_IPS="223.5.5.5, 223.6.6.6, 8.8.8.8, 8.8.4.4, 1.1.1.1, 1.0.0.1, 9.9.9.9, 149.112.112.112, 94.140.14.14, 94.140.15.15, 208.67.222.222, 208.67.220.220, 76.76.2.0, 76.76.10.0, 77.88.8.8, 77.88.8.1"
DEFAULT_DASHBOARD_ZASHBOARD_URL="https://github.com/Zephyruso/zashboard/releases/latest/download/dist-no-fonts.zip"
DEFAULT_DASHBOARD_METACUBEXD_URL="https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip"
DEFAULT_DASHBOARD_YACD_META_URL="https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip"
DEFAULT_MIHOMO_SOURCE_CORE="github"
DEFAULT_MIHOMO_UPDATE_CHANNEL="stable"
DEFAULT_MIHOMO_GITHUB_REPO="MetaCubeX/mihomo"
DEFAULT_MIHOMO_RULESETS_FILES_DOWNLOAD_URL="https://cdn.jsdelivr.net/gh/saltymonkey/mrs-parsed-data"
DEFAULT_EXTERNAL_PANEL="metacubexd"
DEFAULT_RULESET_PROXY_DIRECT_SECTION="DIRECT"
DEFAULT_PROXY="DIRECT"
DEFAULT_HEALTHCHECK_INTERVAL=360
DEFAULT_PROVIDERUPDATE_INTERVAL=7200
DEFAULT_HEALTHCHECK_TIMEOUT=5000
DEFAULT_RULESET_INTERVAL="86400"
DEFAULT_HEALTHCHECK_URL="http://www.gstatic.com/generate_204"
DEFAULT_HEALTHCHECK_RESULT=204
DEFAULT_HEALTHCHECK_MAX_FAILED_TIMES=5
DEFAULT_EXTERNAL_CONTROLLER_PORT=9090
DEFAULT_INPUT_INTERFACE="br-lan"

DEFAULT_TLS_PORT=443
DEFAULT_SECONDARY_TLS_PORT=8443
DEFAULT_HTTP_PORT=80
DEFAULT_SECONDARY_HTTP_PORT_RANGE=8080
DEFAULT_SECONDARY_HTTP_PORT_RANGE_END=8880
DEFAULT_SOCKS_PORT=1080
DEFAULT_DOT_PORT=853
DEFAULT_SECONDARY_DOQ_PORT_SECOND=784
DEFAULT_SECONDARY_DOQ_PORT_THIRD=8853
DEFAULT_NTP_PORT=123

DEFAULT_CORE_RESTART_RETRIES=3
DEFAULT_PBR_PRIORITY=169

DEFAULT_DIAG_RESOLVE_URL_YANDEX="ya.ru"
DEFAULT_DIAG_IP_CHECK_PING_YANDEX="77.88.8.8"
DEFAULT_DIAG_IP_CHECK_PING_GOOGLE="8.8.8.8"
DEFAULT_DIAG_DOMAIN_CHECK_PING_GITHUB="github.com"

# Global buffer variables used by handle_*_section functions to return values
# to core_generate_yaml, avoiding filesystem I/O (mktemp/cat/rm) and eval.
OUT_RULES=""           # Generated routing rules array (JSON)
OUT_RULESETS=""        # Generated rule-providers object (JSON)
OUT_FAKE_IP_RULES=""   # Generated fake-ip filtering rules array (JSON)
OUT_PROXY_GROUPS=""    # Generated proxy groups array (JSON)
OUT_PROXIES=""         # Generated proxies array (JSON)
OUT_NAMES_RULESETS=""  # Generated block ruleset names list (plain text)
OUT_NAMES_SUFFIXES=""  # Generated block suffix names list (plain text)
OUT_TEMPLATE=""        # Helper buffer used by templating functions (JSON)
OUT_PROXY_PROVIDERS="" # Generated proxy providers object (JSON)
OUT_MIXED_RULES=""     # Generated mixed-port rules array (JSON)
OUT_FINAL_RULES=""     # Generated final rules array (JSON)
OUT_BUNDLE_IP_RULES="" # Stores IP-based routing rules from build_builtin_rules_bundle (placed before domain rules to optimize DNS)
OUT_BUNDLE_RULES=""    # Stores domain and other routing rules from build_builtin_rules_bundle to construct clash rules
OUT_BUNDLE_RULESETS="" # Stores rule-provider templates from build_builtin_rules_bundle to define rule-providers in configuration
OUT_BUNDLE_NAMES=""    # Stores active ruleset names from build_builtin_rules_bundle, used to build blocklist name lists
OUT_BUNDLE_FAKEIPRULES="" # Stores rules mapping domains to fake-ip from build_builtin_rules_bundle for correct DNS routing

# Global in-memory caches storing the contents of ruleset/blocklist databases.
# Loaded once at the start of core_generate_yaml to prevent multiple slow file reads.
_RULESETS_CONTENT=""        # Cache of rulesets.txt content
_BLOCK_RULESETS_CONTENT=""  # Cache of block.rulesets.txt content

NF_TABLE_NAME="${PROGNAME}_tproxy"
NF_TABLE_FWMARK_FINAL=3
NF_TABLE_FWMARK_PROXY=255
NF_ROUTE_TABLE=100

WARN_PATTERNS_DHCP_CONFIG="podkop_server podkop_noresolv podkop_cachesize doh_backup_noresolv doh_backup_server doh_server"
DHCP_CONFIG_FILEPATH="/etc/config/dhcp"
RESOLVCONF_FILEPATH="/etc/resolv.conf"
ZAPRETINITD_FILEPATH="/etc/init.d/zapret"
BYEDPI_FILEPATH="/etc/init.d/byedpi"
YOUTUBEUNBLOCK_FILEPATH="/etc/init.d/youtubeUnblock"
REQUIRED_TOOLS="jq nft curl md5sum ntpd"

panic() {
    log error "$1" '💥'
    stop
    exit 1
}

is_pattern_in_file() {
    local file="$1"

    if [ ! -r "$file" ]; then
        log warn "File $file can't be opened!"
        return 1
    fi
    shift
    local found_patterns=""
    for pattern in "$@"; do
        if grep -qE "$pattern" "$file"; then
            found_patterns="${found_patterns:+$found_patterns }$pattern"
        fi
    done
    if [ -n "$found_patterns" ]; then
        echo "$found_patterns"
        return 0
    else
        return 1
    fi
}

ntp_force_sync() {
    local ntpd_start
    config_get_bool ntpd_start settings ntpd_start
    if [ -z "$DEFAULT_NTP_IPS" ]; then
        log error "No NTP servers configured" "⚠️"
        return 1
    fi

    if [ "$ntpd_start" -eq 1 ]; then
        NTP_ARGS=""
        for ip in $DEFAULT_NTP_IPS; do
            NTP_ARGS="$NTP_ARGS -p $ip"
        done
        # shellcheck disable=SC2086
        /usr/sbin/ntpd -q $NTP_ARGS
    fi
}

core_validate_yaml() {
    local test_output app_exit_code
    test_output="$("$CORE_PATH" -t -f "$OUTPUT_YAML_CONFIG_PATH" 2>&1)"
    app_exit_code=$?
    case "$test_output" in
        *[Tt]est\ failed* | *[Ee]rror*) app_exit_code=1 ;;
    esac
    if [ "$app_exit_code" -ne 0 ]; then
        log error "Generated YAML configuration is invalid." "❌"
        log error "$test_output" "❌"
        log error "Mihomo configuration validation failed." "❌"
        return 1
    fi
    return 0
}

start() {
    local skip_environment_checks core_exit_code mihomo_mem_limit

    log info "Initializing JustClash service..." "₍^. .^₎⟆"

    if [ -n "$JUSTCLASH_WAIT_WAN_MAX" ] && [ "$JUSTCLASH_WAIT_WAN_MAX" -gt 0 ]; then
        log info "Waiting for WAN (max ${JUSTCLASH_WAIT_WAN_MAX}s)..." "⏳"
        local waited=0
        while [ "$waited" -lt "$JUSTCLASH_WAIT_WAN_MAX" ]; do
            if ip route show default 2>/dev/null | grep -q default; then
                break
            fi
            sleep 2
            waited=$((waited + 2))
        done
    fi

    if [ -n "$JUSTCLASH_BOOT_DELAY" ] && [ "$JUSTCLASH_BOOT_DELAY" -gt 0 ]; then
        log info "Delaying start by ${JUSTCLASH_BOOT_DELAY}s..." "⏳"
        sleep "$JUSTCLASH_BOOT_DELAY"
    fi

    check_requirement || return 1

    config_get mihomo_mem_limit settings mihomo_mem_limit "0"
    config_get_bool skip_environment_checks settings skip_environment_checks 0

    if [ "$skip_environment_checks" -eq 0 ]; then

        log info "Checking for non-critical conflicts" "⏳"
        check_for_conflicts_warn

        log info "Fixing known compatibility problems" "🐞"
        compat_fixes
    fi

    log info "Synchronizing system time" "🕒"
    ntp_force_sync

    log info "Updating SAFE_PATHS environment variable" "📦"
    safe_paths_add "$DASHBOARD_PATH"

    log info "Preparing Mihomo working directory" "📦"
    core_prepare_workdir
    if [ $? -eq 1 ]; then
        log info "Generating YAML configuration..." "🐱"
        core_generate_yaml
    fi

    log info "Validating YAML configuration..." "🐱"
    core_validate_yaml || return 1

    log info "Configuring tproxy routing and creating NFTables table" "🔑"
    nf_table_add

    log info "Modifying dnsmasq configuration" "🔑"
    dnsmasq_update

    log info "Updating scheduled tasks" "🕒"
    cron_update

    log info "Starting Mihomo core" "🐱"
    start_core "$mihomo_mem_limit"
    core_exit_code=$?

    log warn "Mihomo core exited; restoring networking changes." "🔑"
    dnsmasq_restore
    nf_table_remove

    return "$core_exit_code"
}

stop() {
    log info "Stopping JustClash service..." "⏳"

    log info "Removing tproxy routing and NFTables table" "🔑"
    nf_table_remove

    log info "Restoring default dnsmasq configuration" "🔑"
    dnsmasq_restore

    log info "Stopping core process" "🐱"
    stop_core
}

# WARNING: TRY TO NOT USE FUNC MANUALLY - MUST CLEAR ROUTES AND DNSMASQ
start_core() {
    local mihomo_mem_limit="$1"
    local attempt=0
    local exit_code=0
    log info "Starting core with up to $DEFAULT_CORE_RESTART_RETRIES retries" "🐱"

    # shellcheck disable=SC2154
    if [ "$JUSTCLASH_ENV" = "procd" ]; then
        while [ "$attempt" -lt "$DEFAULT_CORE_RESTART_RETRIES" ]; do
            (
                set -o pipefail
                if [ -n "$mihomo_mem_limit" ] && [ "$mihomo_mem_limit" != "0" ]; then
                    # shellcheck disable=SC2030
                    export GOMEMLIMIT="${mihomo_mem_limit}MiB"
                fi
                "$CORE_PATH" -d "$CORE_WORKDIR_PATH" 2>&1 | sed 's/time="[^"]*"/mihomo/' | logger -t "${PROGNAME}"
            )
            exit_code=$?
            if [ "$exit_code" -eq 0 ] || [ "$exit_code" -eq 130 ] || [ "$exit_code" -eq 143 ] || [ "$exit_code" -eq 137 ]; then
                log info "Procd mode: Mihomo stopped gracefully" "🐱"
                break
            fi

            log warn "Procd mode: Mihomo exited with code $exit_code" "❌"
            attempt=$((attempt + 1))
            log error "Procd mode: Mihomo crashed, attempt $attempt of $DEFAULT_CORE_RESTART_RETRIES" "❌"

            if [ "$attempt" -ge "$DEFAULT_CORE_RESTART_RETRIES" ]; then
                log error "Procd mode: failed to restart Mihomo after $DEFAULT_CORE_RESTART_RETRIES attempts; exiting" "❌"
                return "$exit_code"
            fi

            sleep 2
        done
    else
        (
            if [ -n "$mihomo_mem_limit" ] && [ "$mihomo_mem_limit" != "0" ]; then
                # shellcheck disable=SC2030
                # shellcheck disable=SC2031
                export GOMEMLIMIT="${mihomo_mem_limit}MiB"
            fi
            "$CORE_PATH" -d "$CORE_WORKDIR_PATH" 2>&1
        )
        exit_code=$?
        if [ "$exit_code" -eq 0 ] || [ "$exit_code" -eq 130 ] || [ "$exit_code" -eq 143 ] || [ "$exit_code" -eq 137 ]; then
            log info "Manual mode: Mihomo stopped gracefully" "🐱"
        else
            log warn "Manual mode: Mihomo exited with code $exit_code" "❌"
            log error "Manual mode: Mihomo crashed; exiting" "❌"
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
        log info "Core process stopped" "🐱"
    else
        log info "Core process is not running" "🐱"
    fi
}

cleanup_fwmark() {
    local hex_mark
    hex_mark=$(printf "0x%x" "$NF_TABLE_FWMARK_FINAL")
    while ip rule show | grep -qF "fwmark ${hex_mark} lookup ${NF_ROUTE_TABLE}"; do
        ip rule del fwmark "$NF_TABLE_FWMARK_FINAL" table "$NF_ROUTE_TABLE" 2>/dev/null || true
    done
}

build_nft_skuid_exclusions() {
    local skuid_values="$1"
    local skuid_raw skuid_value skuid_resolved skuid_list=""

    for skuid_raw in $skuid_values; do
        skuid_value=$(trim "$skuid_raw")
        [ -n "$skuid_value" ] || continue

        if is_uint "$skuid_value"; then
            skuid_resolved="$skuid_value"
        else
            skuid_resolved=$(id -u "$skuid_value" 2>/dev/null)
        fi

        if [ -n "$skuid_resolved" ] && is_uint "$skuid_resolved"; then
            skuid_list="${skuid_list:+$skuid_list }$skuid_resolved"
        else
            log warn "Skipping router socket owner exclusion with unresolved user/UID: $skuid_value" "⚠️"
        fi
    done

    printf '%s' "$skuid_list"
}

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
                *[*]* ) rt="DOMAIN-WILDCARD" ;;
            esac
        fi

        generated_rule="$rt,$entry,$action"
        rules="${rules:+$rules,}\"$(json_escape "$generated_rule")\""
    done

    printf '[%s]' "${rules:-}"
}

get_routing_mark() {
    local section="$1"
    local option_name="$2"
    local routing_mark

    config_get routing_mark "$section" "$option_name"
    routing_mark=$(parse_routing_mark "$routing_mark" "$NF_TABLE_FWMARK_FINAL $NF_TABLE_FWMARK_PROXY")
    [ -n "$routing_mark" ] || return 0

    if [ "$routing_mark" = "-1" ]; then
        echo "-1"
        return 0
    fi

    printf '%s ' "$routing_mark"
}

nf_table_add() {
    local nft_apply_changes nft_apply_changes_router
    local tproxy_port fake_ip_range tproxy_input_interfaces
    local nft_quic_mode nft_dot_mode nft_dot_quic_mode nft_ntp_mode nft_ntp_mode_router nft_doh_mode
    local pbr_priority iface skuid_values skuid_list skuid_resolved proxy_routing_marks provider_routing_marks
    local nft_ports_exclude nft_ports_exclude_router nft_mac_exclude nft_ips_exclude

    config_get nft_apply_changes settings nft_apply_changes 0
    config_get nft_apply_changes_router settings nft_apply_changes_router 0
    [ "$nft_apply_changes" = "0" ] && [ "$nft_apply_changes_router" = "0" ] && return 0

    config_get tproxy_port proxy tproxy_port
    [ -n "$tproxy_port" ] || panic "tproxy_port is not set"
    is_port "$tproxy_port" || panic "tproxy_port is invalid: $tproxy_port"

    config_get pbr_priority settings pbr_priority "$DEFAULT_PBR_PRIORITY"
    is_uint "$pbr_priority" || panic "pbr_priority is invalid: $pbr_priority"

    proxy_routing_marks=$(trim "$(config_foreach get_routing_mark proxies routing_mark)")
    case "$proxy_routing_marks" in
        *-1*) panic "Invalid routing_mark detected in proxies configuration" ;;
    esac

    provider_routing_marks=$(trim "$(config_foreach get_routing_mark proxy_provider override_routing_mark)")
    case "$provider_routing_marks" in
        *-1*) panic "Invalid override_routing_mark detected in proxy providers configuration" ;;
    esac

    config_get fake_ip_range proxy fake_ip_range
    config_get tproxy_input_interfaces settings tproxy_input_interfaces "$DEFAULT_INPUT_INTERFACE"
    config_get nft_quic_mode settings nft_quic_mode
    config_get nft_dot_mode settings nft_dot_mode
    config_get nft_dot_quic_mode settings nft_dot_quic_mode
    config_get nft_doh_mode settings nft_doh_mode
    config_get nft_ntp_mode settings nft_ntp_mode
    config_get nft_ntp_mode_router settings nft_ntp_mode_router
    config_get nft_ports_exclude settings nft_ports_exclude
    config_get nft_ports_exclude_router settings nft_ports_exclude_router
    config_get nft_mac_exclude settings nft_mac_exclude
    config_get nft_ips_exclude settings nft_ips_exclude
    config_get skuid_values settings nft_skuid_exclude_router

    if [ "$nft_apply_changes" = "1" ]; then
        [ -n "$fake_ip_range" ] || panic "fake_ip_range is not set"
        [ -n "$tproxy_input_interfaces" ] || panic "tproxy_input_interfaces is not set"

        for iface in $tproxy_input_interfaces; do
            is_ifname "$iface" || panic "tproxy_input_interfaces contains invalid interface name: $iface"
        done
    fi

    local table_exists=0
    if nft list table inet "$NF_TABLE_NAME" >/dev/null 2>&1; then
        table_exists=1
    fi

    {
        if [ "$table_exists" -eq 1 ]; then
            echo "delete table inet $NF_TABLE_NAME"
        fi

        echo "add table inet $NF_TABLE_NAME"
        echo "add set inet $NF_TABLE_NAME private_ips { type ipv4_addr; flags interval; }"
        echo "add element inet $NF_TABLE_NAME private_ips { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.88.99.0/24, 192.168.0.0/16, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4 }"

        if [ "$nft_apply_changes" = "1" ]; then
            echo "add chain inet $NF_TABLE_NAME prerouting { type filter hook prerouting priority mangle; policy accept; }"
            echo "add chain inet $NF_TABLE_NAME filter_input { type filter hook input priority filter; policy accept; }"
            echo "add chain inet $NF_TABLE_NAME filter_forward { type filter hook forward priority filter; policy accept; }"

            echo "add set inet $NF_TABLE_NAME fake_ips { type ipv4_addr; flags interval; }"
            echo "add element inet $NF_TABLE_NAME fake_ips { $fake_ip_range }"
            echo "add set inet $NF_TABLE_NAME inbound_interfaces { type ifname; }"
            for iface in $tproxy_input_interfaces; do
                echo "add element inet $NF_TABLE_NAME inbound_interfaces { \"$iface\" }"
            done
            echo "add set inet $NF_TABLE_NAME doh_ips { type ipv4_addr; flags interval; }"
            echo "add element inet $NF_TABLE_NAME doh_ips { $DEFAULT_DOH_IPS }"
            echo "add rule inet $NF_TABLE_NAME prerouting meta nfproto ipv6 return comment \"Bypass IPv6 traffic\""
            echo "add rule inet $NF_TABLE_NAME prerouting iifname \"lo\" meta mark $NF_TABLE_FWMARK_FINAL meta l4proto { tcp, udp } tproxy ip to 127.0.0.1:$tproxy_port accept comment \"Accept marked router traffic\""
            echo "add rule inet $NF_TABLE_NAME prerouting iifname != @inbound_interfaces return comment \"Bypass non-intercepted interfaces\""
            echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto != { tcp, udp } return comment \"Bypass non-TCP/UDP traffic\""
            echo "add rule inet $NF_TABLE_NAME prerouting ip daddr @private_ips return comment \"Bypass private/LAN IP ranges\""

            if [ -n "$nft_mac_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ether saddr { $(echo "$nft_mac_exclude" | spaces_to_commas) } return comment \"Bypass excluded MACs\""
            fi

            if [ -n "$nft_ips_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip saddr { $(echo "$nft_ips_exclude" | spaces_to_commas) } return comment \"Bypass excluded client IPs\""
            fi

            if [ -n "$nft_ports_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude" | spaces_to_commas) } return comment \"Bypass excluded ports\""
            fi

            if [ "$nft_quic_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_TLS_PORT, $DEFAULT_SECONDARY_TLS_PORT } drop comment \"Drop QUIC traffic\""
            elif [ "$nft_quic_mode" = "REJECT" ]; then
                echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces meta l4proto udp udp dport { $DEFAULT_TLS_PORT, $DEFAULT_SECONDARY_TLS_PORT } reject comment \"Reject QUIC traffic\""
                echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces meta l4proto udp udp dport { $DEFAULT_TLS_PORT, $DEFAULT_SECONDARY_TLS_PORT } reject comment \"Reject QUIC traffic\""
            fi

            if [ "$nft_dot_quic_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_DOT_PORT, $DEFAULT_SECONDARY_DOQ_PORT_SECOND, $DEFAULT_SECONDARY_DOQ_PORT_THIRD } drop comment \"Drop DNS-over-QUIC traffic\""
            elif [ "$nft_dot_quic_mode" = "REJECT" ]; then
                echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces meta l4proto udp udp dport { $DEFAULT_DOT_PORT, $DEFAULT_SECONDARY_DOQ_PORT_SECOND, $DEFAULT_SECONDARY_DOQ_PORT_THIRD } reject comment \"Reject DNS-over-QUIC traffic\""
                echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces meta l4proto udp udp dport { $DEFAULT_DOT_PORT, $DEFAULT_SECONDARY_DOQ_PORT_SECOND, $DEFAULT_SECONDARY_DOQ_PORT_THIRD } reject comment \"Reject DNS-over-QUIC traffic\""
            fi

            if [ "$nft_dot_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto tcp tcp dport { $DEFAULT_DOT_PORT } drop comment \"Drop DNS-over-TLS traffic\""
            elif [ "$nft_dot_mode" = "REJECT" ]; then
                echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces meta l4proto tcp tcp dport { $DEFAULT_DOT_PORT } reject comment \"Reject DNS-over-TLS traffic\""
                echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces meta l4proto tcp tcp dport { $DEFAULT_DOT_PORT } reject comment \"Reject DNS-over-TLS traffic\""
            fi

            if [ "$nft_doh_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip daddr @doh_ips meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT drop comment \"Drop DNS-over-HTTPS traffic\""
            elif [ "$nft_doh_mode" = "REJECT" ]; then
                echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces ip daddr @doh_ips meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS traffic\""
                echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces ip daddr @doh_ips meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS traffic\""
            fi

            if [ "$nft_ntp_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_NTP_PORT } drop comment \"Drop NTP traffic\""
            elif [ "$nft_ntp_mode" = "DIRECT" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_NTP_PORT } return comment \"Bypass NTP traffic\""
            fi

            echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip to 127.0.0.1:$tproxy_port comment \"Intercept to TProxy\""
        fi

        if [ "$nft_apply_changes_router" = "1" ]; then
            echo "add chain inet $NF_TABLE_NAME output { type route hook output priority mangle; policy accept; }"
            echo "add rule inet $NF_TABLE_NAME output meta nfproto ipv6 return comment \"Bypass IPv6 traffic\""
            echo "add rule inet $NF_TABLE_NAME output mark $NF_TABLE_FWMARK_PROXY return comment \"Bypass Core (Mihomo) traffic\""
            if [ -n "$proxy_routing_marks" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta mark { $(echo "$proxy_routing_marks" | spaces_to_commas) } return comment \"Proxy routing_mark bypass\""
            fi
            if [ -n "$provider_routing_marks" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta mark { $(echo "$provider_routing_marks" | spaces_to_commas) } return comment \"Provider override_routing_mark bypass\""
            fi

            echo "add rule inet $NF_TABLE_NAME output meta l4proto != { tcp, udp } return comment \"Bypass non-TCP/UDP traffic\""
            echo "add rule inet $NF_TABLE_NAME output ip daddr @private_ips return comment \"Bypass private/LAN IP ranges\""
            echo "add rule inet $NF_TABLE_NAME output udp sport { 67, 68 } udp dport { 67, 68 } return comment \"Bypass DHCP traffic\""

            if [ -n "$nft_ports_exclude_router" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude_router" | spaces_to_commas) } return comment \"Bypass excluded router ports\""
            fi

            if [ -n "$skuid_values" ]; then
                skuid_list=$(build_nft_skuid_exclusions "$skuid_values")
                for skuid_resolved in $skuid_list; do
                    echo "add rule inet $NF_TABLE_NAME output meta skuid $skuid_resolved return comment \"Bypass excluded user (skuid)\""
                done
            fi

            if [ "$nft_ntp_mode_router" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto udp udp dport { $DEFAULT_NTP_PORT } drop comment \"Drop NTP traffic\""
            elif [ "$nft_ntp_mode_router" = "DIRECT" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto udp udp dport { $DEFAULT_NTP_PORT } return comment \"Bypass NTP traffic\""
            fi

            echo "add rule inet $NF_TABLE_NAME output meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router traffic for interception\""
        fi
    } | nft -f -

    cleanup_fwmark

    # PBR
    ip rule add fwmark "$NF_TABLE_FWMARK_FINAL" table "$NF_ROUTE_TABLE" priority "$pbr_priority"

    if ! ip route show table "$NF_ROUTE_TABLE" 2>/dev/null | grep -Eq "local (default|0\.0\.0\.0/0) dev lo"; then
        ip route add local 0.0.0.0/0 dev lo table "$NF_ROUTE_TABLE"
    fi

    log warn "Tproxy: port=$tproxy_port, fwmark=$NF_TABLE_FWMARK_FINAL fwmark_proxy=$NF_TABLE_FWMARK_PROXY table=$NF_ROUTE_TABLE priority=$pbr_priority" "🛠️"
}

nf_table_remove() {
    cleanup_fwmark
    nft flush table inet "$NF_TABLE_NAME" 2>/dev/null || true
    nft delete table inet "$NF_TABLE_NAME" 2>/dev/null || true
    ip route flush table "$NF_ROUTE_TABLE" 2>/dev/null || true

    log info "Tproxy rules and routing were removed" "🛠️"
}

# Thx Podkop, feels so annoyed already by shell scripting
save_dnsmasq_config() {
    local key="$1"
    local backup_key="$2"
    local value
    value=$(uci get "$key" 2>/dev/null)

    if [ -z "$value" ]; then
        uci set "$backup_key"="unset"
    else
        uci set "$backup_key"="$value"
    fi
}

dnsmasq_update() {
    local dns_listen_port dnsmasq_apply_changes
    local server current_servers
    config_get_bool dnsmasq_apply_changes settings dnsmasq_apply_changes

    if [ "$dnsmasq_apply_changes" -eq 1 ]; then
        config_get dns_listen_port proxy dns_listen_port

        current_servers=$(uci -q get dhcp.@dnsmasq[0].server 2>/dev/null)
        for server in $current_servers; do
            if [ "$server" = "127.0.0.1#${dns_listen_port}" ]; then
                log warn "dnsmasq already uses 127.0.0.1#${dns_listen_port}; skipping dnsmasq changes."
                return 1
            fi
        done

        uci -q delete dhcp.@dnsmasq[0]."${PROGNAME}"_server
        for server in $current_servers; do
            [ -n "$server" ] && uci add_list dhcp.@dnsmasq[0]."${PROGNAME}"_server="$server"
        done

        save_dnsmasq_config "dhcp.@dnsmasq[0].noresolv" "dhcp.@dnsmasq[0].${PROGNAME}_noresolv"
        save_dnsmasq_config "dhcp.@dnsmasq[0].cachesize" "dhcp.@dnsmasq[0].${PROGNAME}_cachesize"

        uci -q delete dhcp.@dnsmasq[0].server
        uci add_list dhcp.@dnsmasq[0].server="127.0.0.1#${dns_listen_port}"
        uci set dhcp.@dnsmasq[0].cachesize="0"
        uci set dhcp.@dnsmasq[0].noresolv="1"

        uci commit dhcp
        log info "DNS configuration updated." "🌐"
        /etc/init.d/dnsmasq restart > /dev/null 2>&1
        log info "dnsmasq restarted to apply DNS changes." "🔄"
    else
        log info "Skipping dnsmasq changes because dnsmasq_apply_changes is disabled." "🛠️"
    fi

}

dnsmasq_restore() {
    local dns_listen_port dnsmasq_apply_changes
    local bak_cachesize bak_noresolv
    local server current_servers backup_servers
    local has_local_server=0
    config_get_bool dnsmasq_apply_changes settings dnsmasq_apply_changes

    if [ "$dnsmasq_apply_changes" -eq 1 ]; then
        config_get dns_listen_port proxy dns_listen_port
        bak_cachesize=$(uci -q get dhcp.@dnsmasq[0]."${PROGNAME}"_cachesize)
        if [ "$bak_cachesize" = "unset" ]; then
            log warn "dnsmasq restore: backup cachesize is unset"
            uci -q delete dhcp.@dnsmasq[0].cachesize
        elif [ -z "$bak_cachesize" ]; then
            log warn "dnsmasq restore: backup cachesize is missing"
        else
            uci set dhcp.@dnsmasq[0].cachesize="$bak_cachesize"
        fi

        bak_noresolv=$(uci -q get dhcp.@dnsmasq[0]."${PROGNAME}"_noresolv)
        if [ "$bak_noresolv" = "unset" ]; then
            log warn "dnsmasq restore: backup noresolv is unset"
            uci -q delete dhcp.@dnsmasq[0].noresolv
        else
            uci set dhcp.@dnsmasq[0].noresolv="$bak_noresolv"
        fi

        current_servers=$(uci -q get dhcp.@dnsmasq[0].server 2>/dev/null)
        backup_servers=$(uci -q get dhcp.@dnsmasq[0]."${PROGNAME}"_server 2>/dev/null)
        for server in $current_servers; do
            if [ "$server" = "127.0.0.1#${dns_listen_port}" ]; then
                has_local_server=1
                break
            fi
        done

        if [ "$has_local_server" -eq 1 ]; then
            uci -q delete dhcp.@dnsmasq[0].server
            if [ -n "$backup_servers" ]; then
                for server in $backup_servers; do
                    [ -n "$server" ] && uci add_list dhcp.@dnsmasq[0].server="$server"
                done
            else
                for server in $current_servers; do
                    [ "$server" = "127.0.0.1#${dns_listen_port}" ] && continue
                    [ -n "$server" ] && uci add_list dhcp.@dnsmasq[0].server="$server"
                done
            fi
            uci -q delete dhcp.@dnsmasq[0]."${PROGNAME}"_server
        fi

        uci commit dhcp
        log info "DNS configuration restored." "🌐"
        /etc/init.d/dnsmasq restart > /dev/null 2>&1
        log info "dnsmasq restarted to apply DNS changes." "🔄"
    else
        log info "Skipping dnsmasq restore because dnsmasq_apply_changes is disabled." "🛠️"
    fi
}

check_requirement() {
    local cmd ret

    ret=0

    if [ ! -x "$CORE_PATH" ]; then
        log error "Requirement is missing: mihomo binary is not installed." "❌"
        ret=1
    fi

    for cmd in $REQUIRED_TOOLS; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            log error "Requirement is missing: $cmd is not installed." "❌"
            ret=1
        fi
    done

    return "$ret"
}

check_for_conflicts_warn() {
    local resolvconf_res
    local found_patterns pattern
    local service_path

    # For $WARN_PATTERNS_DHCP_CONFIG only. We don't need "" to make shell split string.
    # shellcheck disable=SC2086
    found_patterns=$(is_pattern_in_file "$DHCP_CONFIG_FILEPATH" $WARN_PATTERNS_DHCP_CONFIG)
    if [ -n "$found_patterns" ]; then
        for pattern in $found_patterns; do
            log warn "Warning: pattern '$pattern' found in /etc/config/dhcp." "⚠️"
            log warn "This may be a leftover from another DNS/proxy service." "⚠️"
            log warn "JustClash will continue startup; review DHCP settings if DNS behaves strangely." "⚠️"
        done
    fi

    awk '$1 == "nameserver" && $2 != "127.0.0.1" && $2 != "0.0.0.0" { found=1 } END { exit !found }' "$RESOLVCONF_FILEPATH"
    resolvconf_res=$?

    if [ "$resolvconf_res" -eq 0 ]; then
        log warn "Warning: External DNS servers are listed in /etc/resolv.conf" "⚠️"
        log warn "This may bypass local DNS rules and cause unexpected query results." "⚠️"
        log warn "If you intend to use a local DNS service, these entries should be removed." "⚠️"
    fi

    for service_path in "$ZAPRETINITD_FILEPATH" "$BYEDPI_FILEPATH" "$YOUTUBEUNBLOCK_FILEPATH"; do
        if [ -f "$service_path" ]; then
            log warn "Warning: Service detected by path $service_path:" "⚠️"
            log warn "This service can cause unexpected results if configured incorrectly." "⚠️"
        fi
    done
}

info_mihomo() {
    local out
    if [ ! -x "$CORE_PATH" ]; then
        echo "$NO_DATA_STRING"
    else
        out="$("$CORE_PATH" -v 2>/dev/null)"
        out="${out#* * }"
        echo "${out%% *}"
    fi
}

systemlogs() {
    local lines=${1:-40}
    logread -e "$PROGNAME" -l "$lines"
    return 0
}

# Searches active ruleset list in memory (uses global _RULESETS_CONTENT cache)
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
        $1 !~ /^#/ && ($2 in need) {
            print $0
        }
    '
}

build_hwid_header_fragment() {
    local hwid device_os version_os device_model
    hwid=$(hwid_generate)
    device_os=$(get_os_name)
    version_os=$(get_os_version)
    device_model=$(get_hw_model)
    template_hwid_header "$hwid" "$device_os" "$version_os" "$device_model"
}

build_manual_rules_array() {
    local route_entries="$1"
    local rule_prefix="$2"
    local target_name="$3"
    local extra_suffix="$4"
    local route_entry generated_rule rules_fragment=""

    for route_entry in $route_entries; do
        [ -n "$route_entry" ] || continue

        if [ -n "$extra_suffix" ]; then
            generated_rule="$rule_prefix,$route_entry,$target_name,$extra_suffix"
        else
            generated_rule="$rule_prefix,$route_entry,$target_name"
        fi

        rules_fragment="${rules_fragment:+$rules_fragment,}\"$generated_rule\""
    done

    printf '%s' "$rules_fragment"
}

# Builds built-in rules bundle (uses global _RULESETS_CONTENT cache via lookup)
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
            *"|$ruleset_name|"*) log warn "Skipping duplicated ruleset: $ruleset_name"; continue ;;
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
                ruleset_auth=$(trim "${ruleset_url#*|}")
                ruleset_url="${ruleset_url%%|*}"
            ;;
        esac

        generated_rule="RULE-SET,$ruleset_name,$target_name"
        case "$ruleset_url" in
            http://*|https://*)
                local auth_fragment=""
                if [ -n "$ruleset_auth" ]; then
                    template_auth_header "$ruleset_auth"
                    auth_fragment="$OUT_TEMPLATE"
                fi
                template_ruleset_http "$ruleset_url" "$ruleset_behavior" "$ruleset_format" "$download_proxy" "$list_update_interval" "$size_limit" "$auth_fragment"
                rulesets_fragment="${rulesets_fragment}\"$(json_escape "$ruleset_name")\":$OUT_TEMPLATE,"
            ;;
            *)
                local safe_path
                safe_path=$(readlink -f "$(dirname "$ruleset_url")" 2>/dev/null || realpath "$(dirname "$ruleset_url")" 2>/dev/null)
                [ -n "$safe_path" ] && safe_paths_add "$safe_path"
                template_ruleset_file "$ruleset_url" "$ruleset_behavior" "$ruleset_format"
                rulesets_fragment="${rulesets_fragment}\"$(json_escape "$ruleset_name")\":$OUT_TEMPLATE,"
            ;;
        esac
        added_rulesets="$added_rulesets$ruleset_name|"

        case "$rule_mode" in
            all)
                # IP-based rulesets emitted separately so callers place them before domain rules.
                if [ "$ruleset_behavior" = "ipcidr" ]; then
                    ip_rules_fragment="${ip_rules_fragment:+$ip_rules_fragment,}\"$generated_rule\""
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
            fake_ip_rules_fragment="${fake_ip_rules_fragment:+$fake_ip_rules_fragment,}\"RULE-SET,$ruleset_name,fake-ip\""
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

# Helper to build proxy group JSON fragment in memory without subshell forks
template_proxy_group() {
    local name="$1" type="$2" url="$3" status="$4" interval="$5" timeout="$6" max_failed="$7" lazy="$8"
    local tolerance="$9" strategy="${10}" proxies="${11}" providers="${12}" filter="${13}" exclude_filter="${14}" exclude_type="${15}"
    local out

    out="\"name\":\"$(json_escape "$name")\""
    out="$out,\"type\":\"$(json_escape "$type")\""
    out="$out,\"url\":\"$(json_escape "$url")\""
    out="$out,\"expected-status\":$status"
    out="$out,\"interval\":$interval"
    out="$out,\"timeout\":$timeout"
    out="$out,\"max-failed-times\":$max_failed"
    out="$out,\"lazy\":$lazy"

    if [ "$type" = "url-test" ] && [ -n "$tolerance" ]; then
        out="$out,\"tolerance\":\"$(json_escape "$tolerance")\""
    elif [ "$type" = "load-balance" ] && [ -n "$strategy" ]; then
        out="$out,\"strategy\":\"$(json_escape "$strategy")\""
    fi

    [ -n "$proxies" ] && out="$out,\"proxies\":[$proxies]"
    [ -n "$providers" ] && out="$out,\"use\":[$providers]"
    [ -n "$filter" ] && out="$out,\"filter\":\"$(json_escape "$filter")\""
    [ -n "$exclude_filter" ] && out="$out,\"exclude-filter\":\"$(json_escape "$exclude_filter")\""
    [ -n "$exclude_type" ] && out="$out,\"exclude-type\":\"$(json_escape "$exclude_type")\""

    OUT_TEMPLATE="{$out}"
}

# Helper to build proxy provider JSON fragment in memory without subshell forks
template_proxy_provider() {
    local url="$1" interval="$2" size_limit="$3" proxy="$4" filter="$5" exclude_filter="$6" exclude_type="$7"
    local override_dialer="$8" override_ifname="$9" override_fwmark="${10}" hwid_header="${11}"
    local hc_enabled="${12}" hc_url="${13}" hc_status="${14}" hc_interval="${15}" hc_timeout="${16}" hc_lazy="${17}"
    local out override_json hc_json

    out="\"type\":\"http\",\"url\":\"$(json_escape "$url")\",\"interval\":$interval,\"size-limit\":$size_limit,\"proxy\":\"$proxy\""
    [ -n "$filter" ] && out="$out,\"filter\":\"$(json_escape "$filter")\""
    [ -n "$exclude_filter" ] && out="$out,\"exclude-filter\":\"$(json_escape "$exclude_filter")\""
    [ -n "$exclude_type" ] && out="$out,\"exclude-type\":\"$(json_escape "$exclude_type")\""

    # Override object
    override_json="\"udp\":true"
    [ -n "$override_dialer" ] && override_json="$override_json,\"dialer-proxy\":\"$(json_escape "$override_dialer")\""
    [ -n "$override_ifname" ] && override_json="$override_json,\"interface-name\":\"$(json_escape "$override_ifname")\""
    [ -n "$override_fwmark" ] && override_json="$override_json,\"routing-mark\":$override_fwmark"
    out="$out,\"override\":{$override_json}"

    # Optional HWID headers
    [ -n "$hwid_header" ] && out="$out,$hwid_header"

    # Health check object
    if [ "$hc_enabled" -eq 1 ]; then
        hc_json="\"enable\":true,\"lazy\":$hc_lazy,\"url\":\"$(json_escape "$hc_url")\",\"expected-status\":$hc_status,\"interval\":$hc_interval,\"timeout\":$hc_timeout"
        out="$out,\"health-check\":{$hc_json}"
    fi

    OUT_TEMPLATE="{$out}"
}

# Helper to build x-hwid and other device headers JSON fragment in memory without subshell forks
template_hwid_header() {
    local hwid="$1" device_os="$2" version_os="$3" device_model="$4"
    local out

    out="\"x-hwid\":\"$(json_escape "$hwid")\""
    out="$out,\"x-device-os\":\"$(json_escape "$device_os")\""
    out="$out,\"x-ver-os\":\"$(json_escape "$version_os")\""
    out="$out,\"x-device-model\":\"$(json_escape "$device_model")\""

    OUT_TEMPLATE="\"header\":{$out}"
}

# Helper to build Authorization header JSON fragment in memory without subshell forks
template_auth_header() {
    local auth="$1"
    OUT_TEMPLATE="\"header\":{\"Authorization\":[\"$(json_escape "$auth")\"]}"
}

# Helper to build HTTP ruleset JSON fragment in memory without subshell forks
template_ruleset_http() {
    local url="$1" behavior="$2" format="$3" proxy="$4" interval="$5" size_limit="$6" auth_fragment="$7"
    local out

    out="\"type\":\"http\",\"url\":\"$(json_escape "$url")\",\"behavior\":\"$(json_escape "$behavior")\",\"format\":\"$(json_escape "$format")\",\"proxy\":\"$(json_escape "$proxy")\",\"interval\":$interval,\"size-limit\":$size_limit"
    [ -n "$auth_fragment" ] && out="$out,$auth_fragment"

    OUT_TEMPLATE="{$out}"
}

# Helper to build file-based ruleset JSON fragment in memory without subshell forks
template_ruleset_file() {
    local path="$1" behavior="$2" format="$3"
    local out

    out="\"type\":\"file\",\"path\":\"$(json_escape "$path")\",\"behavior\":\"$(json_escape "$behavior")\",\"format\":\"$(json_escape "$format")\""

    OUT_TEMPLATE="{$out}"
}

# Parses proxies; outputs to global buffer: OUT_RULES, OUT_RULESETS, OUT_PROXIES, OUT_FAKE_IP_RULES
handle_proxy_section() {
    local proxies=""
    local rules_array=""
    local selected_rulesets=""
    local fake_ip_rules=""

    # shellcheck disable=SC2317
    __parse_single_proxy() {
        local section="$1"
        local name enabled proxy_link_uri dialer_proxy interface_name routing_mark
        local list_update_interval size_limit mode proxy_link_object use_proxy_for_list_update
        # Source lists loaded from UCI for generated rules.
        local route_entries route_entry rules_fragment ip_rules_fragment rulesets_fragment fake_ip_fragment bundle
        local proxy_obj=""
        # Scratch vars for parsing one custom source at a time.
        local download_proxy generated_rule

        config_get name "$section" name
        [ -z "$name" ] && { log warn "Skipping proxy without name: $section" "⚠️"; return; }

        config_get_bool enabled "$section" enabled 1
        [ "$enabled" -ne 1 ] && { log warn "Skipping disabled proxy: $section" "⚠️"; return; }

        config_get routing_mark "$section" routing_mark
        routing_mark=$(parse_routing_mark "$routing_mark" "$NF_TABLE_FWMARK_FINAL $NF_TABLE_FWMARK_PROXY")
        if [ "$routing_mark" = "-1" ]; then
            log warn "Skipping proxy '$section' due to invalid routing_mark" "⚠️"
            return 0
        fi

        config_get proxy_link_uri "$section" proxy_link_uri
        config_get dialer_proxy "$section" dialer_proxy
        config_get interface_name "$section" interface_name
        config_get list_update_interval "$section" list_update_interval "$DEFAULT_RULESET_INTERVAL"
        config_get size_limit "$section" size_limit 0
        config_get mode "$section" mode "uri"
        config_get proxy_link_object "$section" proxy_link_object
        config_get_bool use_proxy_for_list_update "$section" use_proxy_for_list_update 0

        if [ "$mode" = "object" ]; then
            [ -z "$proxy_link_object" ] && { log warn "Skipping empty proxy '$name'" "⚠️" ; return; }

            proxy_obj=$(printf '%s' "$proxy_link_object" | jq -c --arg name "$name" '. + {name: $name}')

            [ -z "$proxy_obj" ] && { log warn "Failed to process object for '$name'" "⚠️"; return; }
        else
            [ -z "$proxy_link_uri" ] && { log warn  "Skipping empty '$name'" "⚠️"; return; }
            proxy_link_uri=$(trim "$proxy_link_uri")

            [ -n "$dialer_proxy" ] && dialer_proxy=$(trim "$dialer_proxy")
            [ -n "$interface_name" ] && interface_name=$(trim "$interface_name")

            case "$proxy_link_uri" in
                direct://*) proxy_obj=$(parse_direct_url "$name" "$interface_name" "$routing_mark") ;;
                ss://*)     proxy_obj=$(parse_ss_url "$proxy_link_uri" "$DEFAULT_SOCKS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                socks5://*) proxy_obj=$(parse_simple_proxy_url "$proxy_link_uri" "$DEFAULT_SOCKS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                socks://*)  proxy_obj=$(parse_simple_proxy_url "$proxy_link_uri" "$DEFAULT_SOCKS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                trojan://*) proxy_obj=$(parse_trojan_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                trojan-go://*) proxy_obj=$(parse_trojan_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                hy2://*) proxy_obj=$(parse_hysteria2_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                hysteria2://*) proxy_obj=$(parse_hysteria2_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                vless://*)  proxy_obj=$(parse_vless_url "$proxy_link_uri" "$DEFAULT_TLS_PORT" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                mierus://*) proxy_obj=$(parse_mieru_url "$proxy_link_uri" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                sudoku://*) proxy_obj=$(parse_sudoku_url "$proxy_link_uri" "$dialer_proxy" "$name" "$interface_name" "$routing_mark") ;;
                *) log warn "Unknown proxy link type: $proxy_link_uri" "⚠️"; return ;;
            esac

            [ -z "$proxy_obj" ] && { log warn "Failed to parse proxy link: $proxy_link_uri" "⚠️"; return; }
        fi

        proxies="${proxies:+$proxies,}$proxy_obj"
        [ "$use_proxy_for_list_update" -eq 1 ] && download_proxy="$name" || download_proxy=$DEFAULT_PROXY

        config_get route_entries "$section" additional_srcip_route
        rules_fragment=$(build_manual_rules_array "$route_entries" "SRC-IP-CIDR" "$name" "no-resolve")
        [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

        config_get route_entries "$section" additional_destip_route
        rules_fragment=$(build_manual_rules_array "$route_entries" "IP-CIDR" "$name" "")
        [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

        config_get enabled_list "$section" enabled_list
        if [ -n "$enabled_list" ]; then
            build_builtin_rules_bundle "$enabled_list" "$name" "$download_proxy" "$list_update_interval" "$size_limit"
            [ -n "$OUT_BUNDLE_IP_RULES" ] && rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_IP_RULES"
            [ -n "$OUT_BUNDLE_RULES" ] && rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_RULES"
            [ -n "$OUT_BUNDLE_RULESETS" ] && selected_rulesets="${selected_rulesets:+$selected_rulesets,}$OUT_BUNDLE_RULESETS"
            [ -n "$OUT_BUNDLE_FAKEIPRULES" ] && fake_ip_rules="${fake_ip_rules:+$fake_ip_rules,}$OUT_BUNDLE_FAKEIPRULES"
        fi

        config_get route_entries "$section" additional_domain_route
        for route_entry in $route_entries; do
            [ -n "$route_entry" ] && {
                generated_rule="DOMAIN-SUFFIX,$route_entry,$name"
                rules_array="${rules_array:+$rules_array,}\"$generated_rule\""
                fake_ip_rules="${fake_ip_rules:+$fake_ip_rules,}\"DOMAIN-SUFFIX,$route_entry,fake-ip\""
            }
        done

    }

    config_foreach __parse_single_proxy proxies

    OUT_RULES="[${rules_array:-}]"
    OUT_RULESETS="{${selected_rulesets:-}}"
    OUT_PROXIES="[${proxies:-}]"
    OUT_FAKE_IP_RULES="[${fake_ip_rules:-}]"
}

# Parses proxy groups; outputs to global buffer: OUT_RULES, OUT_RULESETS, OUT_PROXY_GROUPS, OUT_FAKE_IP_RULES
handle_proxy_group_section() {
    local proxy_groups=""
    local rules_array=""
    local selected_rulesets=""
    local fake_ip_rules=""

    # shellcheck disable=SC2317  # Called via config_foreach
    __parse_proxy_group() {
        local section="$1"
        local name enabled
        local proxies_list providers_list group_type strategy check_url interval check_timeout max_failed_times tolerance lazy
        local filter exclude_filter exclude_type expected_status
        # Source lists loaded from UCI for generated rules.
        local enabled_list list_update_interval size_limit use_proxy_group_for_list_update route_entries route_entry
        local rules_fragment ip_rules_fragment rulesets_fragment fake_ip_fragment bundle
        # Scratch vars for group JSON assembly and per-entry index parsing.
        local escaped_proxies escaped_providers group_json
        local download_proxy generated_rule

        config_get name "$section" name
        [ -z "$name" ] && { log warn "Skipping proxy group without a name: $section" "⚠️"; return; }

        config_get_bool enabled "$section" enabled 1
        [ "$enabled" -ne 1 ] && { log warn "Skipping disabled proxy group: $section" "⚠️"; return; }

        config_get proxies_list "$section" proxies
        config_get providers_list "$section" providers
        [ -z "$proxies_list" ] && [ -z "$providers_list" ] && { log warn "Skipping empty proxy group: $name" "⚠️"; return; }

        config_get group_type "$section" group_type
        config_get strategy "$section" strategy
        config_get check_url "$section" check_url "$DEFAULT_HEALTHCHECK_URL"
        config_get expected_status "$section" expected_status "$DEFAULT_HEALTHCHECK_RESULT"
        config_get interval "$section" interval "$DEFAULT_HEALTHCHECK_INTERVAL"
        config_get check_timeout "$section" check_timeout "$DEFAULT_HEALTHCHECK_TIMEOUT"
        config_get max_failed_times "$section" max_failed_times "$DEFAULT_HEALTHCHECK_MAX_FAILED_TIMES"
        config_get lazy "$section" lazy 0
        config_get tolerance "$section" tolerance
        config_get filter "$section" filter
        config_get exclude_filter "$section" exclude_filter
        config_get exclude_type "$section" exclude_type
        config_get enabled_list "$section" enabled_list
        config_get list_update_interval "$section" list_update_interval "$DEFAULT_RULESET_INTERVAL"
        config_get size_limit "$section" size_limit 0
        config_get_bool use_proxy_group_for_list_update "$section" use_proxy_group_for_list_update 0

        [ -n "$proxies_list" ] && escaped_proxies=$(trim "$proxies_list" | list_to_json_array)
        [ -n "$providers_list" ] && escaped_providers=$(trim "$providers_list" | list_to_json_array)

        template_proxy_group \
            "$name" "$group_type" "$check_url" "$expected_status" "$interval" "$check_timeout" "$max_failed_times" "$(format_uci_bool_as_yaml "$lazy")" \
            "$tolerance" "$strategy" "$escaped_proxies" "$escaped_providers" "$filter" "$exclude_filter" "$exclude_type"
        group_json="$OUT_TEMPLATE"

        proxy_groups="${proxy_groups:+$proxy_groups,}$group_json"
        [ "$use_proxy_group_for_list_update" -eq 1 ] && download_proxy="$name" || download_proxy=$DEFAULT_PROXY

        config_get route_entries "$section" additional_srcip_route
        rules_fragment=$(build_manual_rules_array "$route_entries" "SRC-IP-CIDR" "$name" "no-resolve")
        [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

        config_get route_entries "$section" additional_destip_route
        rules_fragment=$(build_manual_rules_array "$route_entries" "IP-CIDR" "$name" "")
        [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

        if [ -n "$enabled_list" ]; then
            build_builtin_rules_bundle "$enabled_list" "$name" "$download_proxy" "$list_update_interval" "$size_limit"
            [ -n "$OUT_BUNDLE_IP_RULES" ] && rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_IP_RULES"
            [ -n "$OUT_BUNDLE_RULES" ] && rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_RULES"
            [ -n "$OUT_BUNDLE_RULESETS" ] && selected_rulesets="${selected_rulesets:+$selected_rulesets,}$OUT_BUNDLE_RULESETS"
            [ -n "$OUT_BUNDLE_FAKEIPRULES" ] && fake_ip_rules="${fake_ip_rules:+$fake_ip_rules,}$OUT_BUNDLE_FAKEIPRULES"
        fi

        config_get route_entries "$section" additional_domain_route
        for route_entry in $route_entries; do
            [ -n "$route_entry" ] && {
                generated_rule="DOMAIN-SUFFIX,$route_entry,$name"
                rules_array="${rules_array:+$rules_array,}\"$generated_rule\""
                fake_ip_rules="${fake_ip_rules:+$fake_ip_rules,}\"DOMAIN-SUFFIX,$route_entry,fake-ip\""
            }
        done

    }

    config_foreach __parse_proxy_group proxy_group

    OUT_RULES="[${rules_array:-}]"
    OUT_RULESETS="{${selected_rulesets:-}}"
    OUT_PROXY_GROUPS="[${proxy_groups:-}]"
    OUT_FAKE_IP_RULES="[${fake_ip_rules:-}]"
}

handle_proxy_provider_section() {
    local result=""

    # shellcheck disable=SC2317
    # shellcheck disable=SC2329
    __handle_proxy_provider() {
        local section="$1"
        local name enabled url override_dialer_proxy override_interface_name override_routing_mark subscription_hwid_support interval size_limit proxy filter exclude_filter exclude_type
        local health_check hc_expected_status hc_url hc_interval hc_timeout hc_lazy
        local provider_json hwid_header

        config_get name "$section" name
        config_get url "$section" subscription
        { [ -z "$name" ] || [ -z "$url" ]; } && {
        log warn "Skipping proxy provider without a name or subscription" "⚠️"
            return
        }

        config_get_bool enabled "$section" enabled 1
        [ "$enabled" -ne 1 ] && { log warn "Skipping disabled proxy provider: $section" "⚠️"; return; }

        config_get override_routing_mark "$section" override_routing_mark
        override_routing_mark=$(parse_routing_mark "$override_routing_mark" "$NF_TABLE_FWMARK_FINAL $NF_TABLE_FWMARK_PROXY")

        if [ "$override_routing_mark" = "-1" ]; then
            log warn "Skipping proxy provider '$section' due to invalid routing_mark" "⚠️"
            return 0
        fi

        config_get interval "$section" update_interval "$DEFAULT_PROVIDERUPDATE_INTERVAL"
        config_get size_limit "$section" size_limit 0
        config_get filter "$section" filter
        config_get exclude_filter "$section" exclude_filter
        config_get exclude_type "$section" exclude_type
        config_get proxy "$section" proxy "$DEFAULT_PROXY"
        config_get override_dialer_proxy "$section" override_dialer_proxy
        config_get override_interface_name "$section" override_interface_name

        hwid_header=""
        config_get_bool subscription_hwid_support "$section" subscription_hwid_support 0
        if [ "$subscription_hwid_support" -eq 1 ]; then
            build_hwid_header_fragment
            hwid_header="$OUT_TEMPLATE"
        fi

        config_get_bool health_check "$section" health_check 0
        hc_expected_status="$DEFAULT_HEALTHCHECK_RESULT" hc_url="$DEFAULT_HEALTHCHECK_URL" hc_interval="$DEFAULT_HEALTHCHECK_INTERVAL" hc_timeout="$DEFAULT_HEALTHCHECK_TIMEOUT" hc_lazy="false"
        if [ "$health_check" -eq 1 ]; then
            config_get hc_expected_status "$section" health_check_expected_status "$DEFAULT_HEALTHCHECK_RESULT"
            config_get hc_url "$section" health_check_url "$DEFAULT_HEALTHCHECK_URL"
            config_get hc_interval "$section" health_check_interval "$DEFAULT_HEALTHCHECK_INTERVAL"
            config_get hc_timeout "$section" health_check_timeout "$DEFAULT_HEALTHCHECK_TIMEOUT"
            config_get hc_lazy "$section" health_check_lazy 0
            hc_lazy=$(format_uci_bool_as_yaml "$hc_lazy")
        fi

        template_proxy_provider \
            "$url" "$interval" "$size_limit" "$proxy" "$filter" "$exclude_filter" "$exclude_type" \
            "$override_dialer_proxy" "$override_interface_name" "$override_routing_mark" "$hwid_header" \
            "$health_check" "$hc_url" "$hc_expected_status" "$hc_interval" "$hc_timeout" "$hc_lazy"
        provider_json="$OUT_TEMPLATE"

        result="$result\"$(json_escape "$name")\":$provider_json,"
    }

    config_foreach __handle_proxy_provider proxy_provider

    OUT_PROXY_PROVIDERS="{${result%,}}"
}

# Parses block rules; outputs to global buffer: OUT_RULES, OUT_RULESETS, OUT_NAMES_RULESETS, OUT_NAMES_SUFFIXES
handle_block_rule_section() {
    local rules_array=""
    local selected_rulesets=""
    local list_rulesets_names=""
    local list_suffix_names=""

    local enabled
    config_get_bool enabled block_rules enabled 1
    if [ "$enabled" -ne 1 ]; then
        log warn "Skipping disabled proxy group: block_rules" "⚠️"
        OUT_RULES="[]"
        OUT_RULESETS="{}"
        OUT_NAMES_RULESETS=""
        OUT_NAMES_SUFFIXES=""
        return
    fi

    # Selected blocklists and generated manual block routes.
    local enabled_blocklist download_proxy list_update_interval size_limit rules_fragment rulesets_fragment names_fragment bundle
    # Scratch vars for generated manual block routes.
    local generated_rule
    local additional_domain_blockroute additional_destip_blockroute
    local route_entry
    config_get enabled_blocklist block_rules enabled_blocklist
    config_get download_proxy block_rules proxy "$DEFAULT_PROXY"
    config_get list_update_interval block_rules list_update_interval "$DEFAULT_RULESET_INTERVAL"
    config_get size_limit block_rules size_limit 0
    config_get additional_destip_blockroute block_rules additional_destip_blockroute
    for route_entry in $additional_destip_blockroute; do
        [ -n "$route_entry" ] && {
            generated_rule="IP-CIDR,$route_entry,REJECT"
            rules_array="${rules_array:+$rules_array,}\"$generated_rule\""
        }
    done

    if [ -n "$enabled_blocklist" ]; then
        build_builtin_rules_bundle "$enabled_blocklist" "REJECT" "$download_proxy" "$list_update_interval" "$size_limit" "non-domain-only"
        [ -n "$OUT_BUNDLE_RULES" ] && rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_RULES"
        [ -n "$OUT_BUNDLE_RULESETS" ] && selected_rulesets="${selected_rulesets:+$selected_rulesets,}$OUT_BUNDLE_RULESETS"
        [ -n "$OUT_BUNDLE_NAMES" ] && list_rulesets_names=$(printf '%s' "$OUT_BUNDLE_NAMES" | sed 's/"//g; s/,rule-set:/,/g')
    fi

    config_get additional_domain_blockroute block_rules additional_domain_blockroute
    for route_entry in $additional_domain_blockroute; do
        [ -n "$route_entry" ] && {
            list_suffix_names="${list_suffix_names:+$list_suffix_names,}+.$route_entry"
        }
    done

    OUT_RULES="[${rules_array:-}]"
    OUT_RULESETS="{${selected_rulesets:-}}"
    OUT_NAMES_RULESETS="$list_rulesets_names"
    OUT_NAMES_SUFFIXES="$list_suffix_names"
}

# Parses direct rules; outputs to global buffer: OUT_RULES, OUT_RULESETS, OUT_FAKE_IP_RULES
handle_direct_rule_section() {
    local rules_array=""
    local selected_rulesets=""

    local fake_ip_rules=""
    local download_proxy additional_domain_direct
    local additional_srcip_direct additional_destip_direct
    # Source lists loaded from UCI for generated DIRECT rules.
    local list_update_interval size_limit enabled_list
    local rules_fragment ip_rules_fragment rulesets_fragment fake_ip_fragment bundle
    # Scratch vars for generated manual routes.
    local generated_rule route_entry

    local enabled
    config_get_bool enabled direct_rules enabled 1
    if [ "$enabled" -ne 1 ]; then
        log warn "Skipping disabled proxy group: direct_rules" "⚠️"
        OUT_RULES="[]"
        OUT_RULESETS="{}"
        OUT_FAKE_IP_RULES="[]"
        return
    fi

    config_get list_update_interval direct_rules list_update_interval "$DEFAULT_RULESET_INTERVAL"
    config_get size_limit direct_rules size_limit 0
    config_get enabled_list direct_rules enabled_list
    config_get download_proxy direct_rules proxy "$DEFAULT_PROXY"

    config_get additional_srcip_direct direct_rules additional_srcip_direct
    rules_fragment=$(build_manual_rules_array "$additional_srcip_direct" "SRC-IP-CIDR" "DIRECT" "no-resolve")
    [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

    config_get additional_destip_direct direct_rules additional_destip_direct
    rules_fragment=$(build_manual_rules_array "$additional_destip_direct" "IP-CIDR" "DIRECT" "")
    [ -n "$rules_fragment" ] && rules_array="${rules_array:+$rules_array,}$rules_fragment"

    if [ -n "$enabled_list" ]; then
        build_builtin_rules_bundle "$enabled_list" "$DEFAULT_RULESET_PROXY_DIRECT_SECTION" "$download_proxy" "$list_update_interval" "$size_limit"
        [ -n "$OUT_BUNDLE_IP_RULES" ] && rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_IP_RULES"
        [ -n "$OUT_BUNDLE_RULES" ] && rules_array="${rules_array:+$rules_array,}$OUT_BUNDLE_RULES"
        [ -n "$OUT_BUNDLE_RULESETS" ] && selected_rulesets="${selected_rulesets:+$selected_rulesets,}$OUT_BUNDLE_RULESETS"
        [ -n "$OUT_BUNDLE_FAKEIPRULES" ] && fake_ip_rules="${fake_ip_rules:+$fake_ip_rules,}$OUT_BUNDLE_FAKEIPRULES"
    fi

    config_get additional_domain_direct direct_rules additional_domain_direct
    for route_entry in $additional_domain_direct; do
        [ -n "$route_entry" ] && {
            generated_rule="DOMAIN-SUFFIX,$route_entry,DIRECT"
            rules_array="${rules_array:+$rules_array,}\"$generated_rule\""
            fake_ip_rules="${fake_ip_rules:+$fake_ip_rules,}\"DOMAIN-SUFFIX,$route_entry,fake-ip\""
        }
    done

    OUT_RULES="[${rules_array:-}]"
    OUT_RULESETS="{${selected_rulesets:-}}"
    OUT_FAKE_IP_RULES="[${fake_ip_rules:-}]"
}

handle_mixed_port_rules_section() {
    local exit_rule
    local rules rule_str
    config_get exit_rule mixed_port_rules exit_rule

    if [ "$exit_rule" = "BY RULES" ]; then
        rules="[]"
    else
        rule_str=$(printf 'IN-TYPE,SOCKS/HTTP,%s' "${exit_rule:-$DEFAULT_PROXY}")
        rules="[\"${rule_str:-}\"]"
    fi

    OUT_MIXED_RULES="$rules"
}

handle_final_rule_section() {
    local exit_rule rule_str rules
    config_get exit_rule final_rules exit_rule

    rule_str=$(printf 'MATCH,%s' "${exit_rule:-$DEFAULT_PROXY}")

    rules="[\"${rule_str:-}\"]"

    OUT_FINAL_RULES="$rules"
}

get_dashboard_url() {
    local dashboard_repo="$1"
    local url

    case "$dashboard_repo" in
        metacubexd)
            config_get url settings mihomo_dashboard_metacubexd_url "$DEFAULT_DASHBOARD_METACUBEXD_URL"
            printf '%s\n' "$url"
            ;;
        yacd-meta)
            config_get url settings mihomo_dashboard_yacd_meta_url "$DEFAULT_DASHBOARD_YACD_META_URL"
            printf '%s\n' "$url"
            ;;
        zashboard)
            config_get url settings mihomo_dashboard_zashboard_url "$DEFAULT_DASHBOARD_ZASHBOARD_URL"
            printf '%s\n' "$url"
            ;;
        *)
            config_get url settings mihomo_dashboard_metacubexd_url "$DEFAULT_DASHBOARD_METACUBEXD_URL"
            printf '%s\n' "$url"
            ;;
    esac
}

build_hosts_section() {
    echo "hosts:"
    echo "  'cloudflare-dns.com': [1.1.1.1, 1.0.0.1]"
    echo "  'one.one.one.one': [1.1.1.1, 1.0.0.1]"
    echo "  'dns.google': [8.8.8.8, 8.8.4.4]"
    echo "  'common.dot.dns.yandex.net': [77.88.8.8, 77.88.8.1]"
    echo "  'safe.dot.dns.yandex.net': [77.88.8.88, 77.88.8.2]"
    echo "  'family.dot.dns.yandex.net': [77.88.8.7, 77.88.8.3]"
}

# Main config generator; fills global caches (_*_CONTENT) and reads from global buffer (OUT_*)
core_generate_yaml() {
    local router_selected_ipaddr
    local controller_bind_interface use_dashboard use_dashboard_raw dashboard_repo dashboard_url api_password log_level interface_name tproxy_port unified_delay
    local use_mixed_port mixed_port proxy_authentication
    local tcp_concurrent
    local keep_alive_idle keep_alive_interval profile_store_selected profile_store_fake_ip
    local core_ntp_enabled core_ntp_interval core_ntp_server core_ntp_port core_ntp_write_system
    local dns_listen_port use_system_hosts fake_ip_range fake_ip_ttl dns_cache_max_size
    local etag_support global_ua
    local default_nameserver direct_nameserver proxy_server_nameserver nameserver fake_ip_filter_data
    local fake_ip_include_domain_values fake_ip_exclude_domain_values
    local fake_ip_include_ruleset_values fake_ip_exclude_ruleset_values
    local nameserver_policy_custom
    local rules_proxies rules_proxygroups rules_block rule_final rule_mixed rules_direct
    local proxies proxy_groups rule_providers proxy_providers
    local names_rulesets_block_policy names_suffixes_block_policy
    local fake_ip_rules_direct fake_ip_rules_proxy_groups fake_ip_rules_proxies
    local custom_fake_ip_rules custom_real_ip_rules custom_fake_ip_rulesets custom_real_ip_rulesets
    local rulesets_direct rulesets_block rulesets_proxygroup rulesets_proxies

    # !!! _RULESETS_CONTENT and _BLOCK_RULESETS_CONTENT are module-level globals set before handle_* calls
    local sniffer_enable sniffer_parse_pure_ip sniffer_override_destination sniffer_exclude_domain sniffer_skip_src_address sniffer_skip_dst_address sniffer_force_domain
    local nameserver_policy

    config_get controller_bind_interface proxy controller_bind_interface
    config_get use_dashboard_raw proxy use_dashboard
    if [ -n "$use_dashboard_raw" ]; then
        config_get_bool use_dashboard proxy use_dashboard
    else
        config_get_bool use_dashboard proxy use_zashboard 0
    fi
    config_get dashboard_repo proxy dashboard_repo "$DEFAULT_EXTERNAL_PANEL"
    config_get api_password proxy api_password
    config_get log_level proxy log_level
    config_get interface_name proxy interface_name
    config_get tproxy_port proxy tproxy_port
    config_get use_mixed_port proxy use_mixed_port
    config_get mixed_port proxy mixed_port
    config_get_bool unified_delay proxy unified_delay
    config_get_bool tcp_concurrent proxy tcp_concurrent
    config_get keep_alive_idle proxy keep_alive_idle
    config_get keep_alive_interval proxy keep_alive_interval
    config_get global_ua proxy global_ua
    config_get_bool etag_support proxy etag_support
    config_get_bool profile_store_selected proxy profile_store_selected
    config_get_bool profile_store_fake_ip proxy profile_store_fake_ip
    config_get_bool core_ntp_enabled proxy core_ntp_enabled
    config_get core_ntp_server proxy core_ntp_server
    config_get core_ntp_port proxy core_ntp_port
    config_get core_ntp_interval proxy core_ntp_interval
    config_get_bool core_ntp_write_system proxy core_ntp_write_system
    config_get dns_listen_port proxy dns_listen_port
    config_get dns_cache_max_size proxy dns_cache_max_size
    config_get_bool use_system_hosts proxy use_system_hosts
    config_get fake_ip_range proxy fake_ip_range
    config_get fake_ip_ttl proxy fake_ip_ttl
    config_get_bool sniffer_enable proxy sniffer_enable
    config_get_bool sniffer_parse_pure_ip proxy sniffer_parse_pure_ip
    config_get_bool sniffer_override_destination proxy sniffer_override_destination 0
    config_get fake_ip_include_domain_values proxy fake_ip_include_domains
    config_get fake_ip_exclude_domain_values proxy fake_ip_exclude_domains
    config_get fake_ip_include_ruleset_values proxy fake_ip_include_rulesets
    config_get fake_ip_exclude_ruleset_values proxy fake_ip_exclude_rulesets

    if [ -n "$controller_bind_interface" ]; then
        if ! is_ifname "$controller_bind_interface"; then
            router_selected_ipaddr="0.0.0.0"
            log warn "Controller bind interface '$controller_bind_interface' is invalid; API controller will listen on all interfaces." "⚠️"
        elif ! network_get_ipaddr router_selected_ipaddr "$controller_bind_interface" || [ -z "$router_selected_ipaddr" ]; then
            router_selected_ipaddr="0.0.0.0"
            log warn "Controller bind network '$controller_bind_interface' has no IPv4 address; API controller will listen on all interfaces." "⚠️"
        fi
    else
        router_selected_ipaddr="0.0.0.0"
    fi

    [ -n "$interface_name" ] && interface_name=$(trim "$interface_name")
    if [ -n "$interface_name" ] && ! is_ifname "$interface_name"; then
        log warn "Global interface_name '$interface_name' is invalid and will be ignored." "⚠️"
        interface_name=""
    fi

    dashboard_url=$(get_dashboard_url "$dashboard_repo")
    default_nameserver=$(format_uci_list_as_json_array proxy default_nameserver "#disable-ipv6=true&disable-qtype-65=true" "    ")
    direct_nameserver=$(format_uci_list_as_json_array proxy direct_nameserver "#disable-ipv6=true&disable-qtype-65=true" "    ")
    proxy_server_nameserver=$(format_uci_list_as_json_array proxy proxy_server_nameserver "#disable-ipv6=true&disable-qtype-65=true" "    ")
    nameserver=$(format_uci_list_as_json_array proxy nameserver "#disable-ipv6=true&disable-qtype-65=true" "    ")
    nameserver_policy_custom=$(format_uci_list_as_json_array proxy nameserver_policy "" "    ")
    sniffer_force_domain=$(format_uci_list_as_json_array proxy sniffer_force_domain "" "    ")
    sniffer_exclude_domain=$(format_uci_list_as_json_array proxy sniffer_exclude_domain "" "    ")
    sniffer_skip_src_address=$(format_uci_list_as_json_array proxy sniffer_skip_src_address "" "    ")
    sniffer_skip_dst_address=$(format_uci_list_as_json_array proxy sniffer_skip_dst_address "" "    ")
    proxy_authentication=$(format_uci_list_as_json_array proxy proxy_authentication "" "    ")

    # MIXED PORT RULES section
    handle_mixed_port_rules_section
    rule_mixed="$OUT_MIXED_RULES"

    # FINAL RULE section
    handle_final_rule_section
    rule_final="$OUT_FINAL_RULES"

    # PROXY PROVIDERS section
    handle_proxy_provider_section
    proxy_providers=$(printf '%s\n' "$OUT_PROXY_PROVIDERS" | jq .)

    # optimization: load ruleset files once into globals to avoid re-reading and argument-copying per proxy/group
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

    # DIRECT section
    handle_direct_rule_section
    rules_direct="$OUT_RULES"
    rulesets_direct="$OUT_RULESETS"
    fake_ip_rules_direct="$OUT_FAKE_IP_RULES"

    # BLOCK section
    # Optimization: Temporarily swap the global rulesets database to use blocklist rulesets database.
    # This allows downstream functions (like build_builtin_rules_bundle) to transparently use block ruleset definitions.
    local _saved_rulesets_content="$_RULESETS_CONTENT"
    _RULESETS_CONTENT="$_BLOCK_RULESETS_CONTENT"
    handle_block_rule_section
    _RULESETS_CONTENT="$_saved_rulesets_content"
    rules_block="$OUT_RULES"
    rulesets_block="$OUT_RULESETS"
    names_rulesets_block_policy="$OUT_NAMES_RULESETS"
    names_suffixes_block_policy="$OUT_NAMES_SUFFIXES"

    # PROXY GROUP section
    handle_proxy_group_section
    rules_proxygroups="$OUT_RULES"
    rulesets_proxygroup="$OUT_RULESETS"
    proxy_groups="$OUT_PROXY_GROUPS"
    fake_ip_rules_proxy_groups="$OUT_FAKE_IP_RULES"

    # PROXY section
    handle_proxy_section
    rules_proxies="$OUT_RULES"
    rulesets_proxies="$OUT_RULESETS"
    proxies="$OUT_PROXIES"
    fake_ip_rules_proxies="$OUT_FAKE_IP_RULES"

    nameserver_policy=$(jq --indent 4 -n \
        --arg custom_entries "$nameserver_policy_custom" \
        --arg rulesets "$names_rulesets_block_policy" \
        --arg suffixes "$names_suffixes_block_policy" \
        '
        {} |
        if $custom_entries != "[]" then
            . + (
                reduce ($custom_entries | fromjson)[] as $item ({};
                    ($item | split("/")) as $parts |
                    if ($parts | length) < 2 then
                        .
                    else
                        . + { ($parts[0]): ($parts[1:] | join("/")) }
                    end
                )
            )
        else . end |
        if $rulesets != "" then
            . + {($rulesets): "rcode://success"}
        else . end |
        if $suffixes != "" then
            . + {($suffixes): "rcode://success"}
        else . end
        ')

    custom_real_ip_rules=$(build_fake_ip_rule_array "$fake_ip_exclude_domain_values" "DOMAIN-SUFFIX" "real-ip")
    custom_fake_ip_rules=$(build_fake_ip_rule_array "$fake_ip_include_domain_values" "DOMAIN-SUFFIX" "fake-ip")
    custom_real_ip_rulesets=$(build_fake_ip_rule_array "$fake_ip_exclude_ruleset_values" "RULE-SET" "real-ip")
    custom_fake_ip_rulesets=$(build_fake_ip_rule_array "$fake_ip_include_ruleset_values" "RULE-SET" "fake-ip")

    fake_ip_filter_data=$(jq --indent 4 -n \
        --arg custom_fake "$custom_fake_ip_rules" \
        --arg custom_real "$custom_real_ip_rules" \
        --arg custom_fake_rulesets "$custom_fake_ip_rulesets" \
        --arg custom_real_rulesets "$custom_real_ip_rulesets" \
        --arg direct "$fake_ip_rules_direct" \
        --arg proxy_groups "$fake_ip_rules_proxy_groups" \
        --arg proxies "$fake_ip_rules_proxies" \
        '
        (
            ($custom_real | fromjson)
            + ($custom_real_rulesets | fromjson)
            + ($custom_fake | fromjson)
            + ($custom_fake_rulesets | fromjson)
            + ($direct | fromjson)
            + ($proxy_groups | fromjson)
            + ($proxies | fromjson)
            + ["MATCH,real-ip"]
        ) | reduce .[] as $item ([]; if index($item) then . else . + [$item] end)
        '
    )

    proxies=$(echo "$proxies" | jq .)

    proxy_groups=$(printf '%s' "$proxy_groups" | jq --indent 4 .)

    rule_providers=$(
        jq -n \
        --argjson rulesets_direct "$rulesets_direct" \
        --argjson rulesets_block "$rulesets_block" \
        --argjson rulesets_proxygroup "$rulesets_proxygroup" \
        --argjson rulesets_proxies "$rulesets_proxies" \
        'reduce [ $rulesets_direct, $rulesets_block, $rulesets_proxygroup, $rulesets_proxies ][] as $item ({}; . * $item)'
    )

    rules=$(jq -n \
        --arg rule_mixed "$rule_mixed" \
        --arg direct "$rules_direct" \
        --arg block "$rules_block" \
        --arg proxygroups "$rules_proxygroups" \
        --arg proxies "$rules_proxies" \
        --arg final "$rule_final" \
        '($rule_mixed | fromjson) + ($direct | fromjson) + ($block | fromjson) + ($proxygroups | fromjson) + ($proxies | fromjson) + ($final | fromjson) | map(select(length > 0))'
    )

    : > "$OUTPUT_YAML_CONFIG_PATH"
    chmod 600 "$OUTPUT_YAML_CONFIG_PATH"

    {
        # Support for mixed port
        # Make sure call for this function handled after 'core_prepare_workdir' since file must be removed
        if [ "$use_mixed_port" -eq 1 ]; then
            echo "allow-lan: true"
            echo "mixed-port: $mixed_port"
            printf '%s\n' "authentication: $proxy_authentication"
            echo ""
        fi

        if [ "$use_dashboard" -eq 1 ]; then
            echo "external-ui: $(yaml_quote "$DASHBOARD_PATH")"
            echo "external-ui-url: $(yaml_quote "$dashboard_url")"
        fi

        if [ -n "$interface_name" ]; then
            echo "interface-name: $(yaml_quote "$interface_name")"
        fi

        echo "mode: rule"
        echo "ipv6: false"
        echo "external-controller: $(yaml_quote "$router_selected_ipaddr:$DEFAULT_EXTERNAL_CONTROLLER_PORT")"
        echo "secret: $(yaml_quote "$api_password")"
        echo "log-level: $(yaml_quote "$log_level")"
        echo "tproxy-port: $tproxy_port"
        echo "unified-delay: $(format_uci_bool_as_yaml "$unified_delay")"
        echo "tcp-concurrent: $(format_uci_bool_as_yaml "$tcp_concurrent")"
        echo "routing-mark: $NF_TABLE_FWMARK_PROXY"
        echo "global-ua: $(yaml_quote "$global_ua")"
        echo "find-process-mode: off"
        echo "geodata-mode: false"
        echo "etag-support: $(format_uci_bool_as_yaml "$etag_support")"
        echo ""
        echo "keep-alive-idle: $keep_alive_idle"
        echo "keep-alive-interval: $keep_alive_interval"
        echo ""
        echo "profile:"
        echo "  store-selected: $(format_uci_bool_as_yaml "$profile_store_selected")"
        echo "  store-fake-ip: $(format_uci_bool_as_yaml "$profile_store_fake_ip")"
        echo ""
        build_hosts_section
        echo ""
        echo "ntp:"
        echo "  enable: $(format_uci_bool_as_yaml "$core_ntp_enabled")"
        echo "  write-to-system: $(format_uci_bool_as_yaml "$core_ntp_write_system")"
        echo "  server: $(yaml_quote "$core_ntp_server")"
        echo "  port: $core_ntp_port"
        echo "  interval: $core_ntp_interval"
        echo ""
        printf '%s\n' "rule-providers: $rule_providers"
        echo ""
        echo "dns:"
        echo "  enable: true"
        echo "  cache-algorithm: arc"
        echo "  cache-max-size: $dns_cache_max_size"
        echo "  listen: $(yaml_quote "127.0.0.1:$dns_listen_port")"
        echo "  prefer-h3: false"
        echo "  ipv6: false"
        echo "  use-system-hosts: $(format_uci_bool_as_yaml "$use_system_hosts")"
        echo "  use-hosts: true"
        printf '%s\n' "  nameserver-policy: $nameserver_policy"
        printf '%s\n' "  default-nameserver: $default_nameserver"
        printf '%s\n' "  nameserver: $nameserver"
        printf '%s\n' "  proxy-server-nameserver: $proxy_server_nameserver"
        if [ "$direct_nameserver" != "[]" ] && [ -n "$direct_nameserver" ]; then
            printf '%s\n' "  direct-nameserver: $direct_nameserver"
            echo "  direct-nameserver-follow-policy: true"
        fi
        echo "  respect-rules: true"
        echo "  enhanced-mode: fake-ip"
        echo "  fake-ip-range: $fake_ip_range"
        echo "  fake-ip-filter-mode: rule"
        echo "  fake-ip-ttl: $fake_ip_ttl"
        printf '%s\n' "  fake-ip-filter: $fake_ip_filter_data"
        echo ""
        echo "sniffer:"
        echo "  enable: $(format_uci_bool_as_yaml "$sniffer_enable")"
        echo "  parse-pure-ip: $(format_uci_bool_as_yaml "$sniffer_parse_pure_ip")"
        echo "  override-destination: $(format_uci_bool_as_yaml "$sniffer_override_destination")"
        echo "  sniff:"
        echo "    HTTP:"
        echo "      ports: [$DEFAULT_HTTP_PORT, $DEFAULT_SECONDARY_HTTP_PORT_RANGE-$DEFAULT_SECONDARY_HTTP_PORT_RANGE_END]"
        echo "    TLS:"
        echo "      ports: [$DEFAULT_TLS_PORT, $DEFAULT_SECONDARY_TLS_PORT]"
        echo "    QUIC:"
        echo "      ports: [$DEFAULT_TLS_PORT, $DEFAULT_SECONDARY_TLS_PORT]"
        printf '%s\n' "  skip-domain: $sniffer_exclude_domain"
        printf '%s\n' "  force-domain: $sniffer_force_domain"
        printf '%s\n' "  skip-src-address: $sniffer_skip_src_address"
        printf '%s\n' "  skip-dst-address: $sniffer_skip_dst_address"
        echo ""
        printf '%s\n' "proxies: $proxies"
        printf '%s\n' "proxy-groups: $proxy_groups"
        printf '%s\n' "proxy-providers: $proxy_providers"
        printf '%s\n' "rules: $rules"
    } > "$OUTPUT_YAML_CONFIG_PATH"

    # Clean up global buffers and caches to free memory on low-RAM routers
    unset _RULESETS_CONTENT _BLOCK_RULESETS_CONTENT \
          OUT_RULES OUT_RULESETS OUT_FAKE_IP_RULES OUT_PROXY_GROUPS OUT_PROXIES \
          OUT_NAMES_RULESETS OUT_NAMES_SUFFIXES OUT_TEMPLATE OUT_PROXY_PROVIDERS \
          OUT_MIXED_RULES OUT_FINAL_RULES OUT_BUNDLE_IP_RULES OUT_BUNDLE_RULES \
          OUT_BUNDLE_RULESETS OUT_BUNDLE_NAMES OUT_BUNDLE_FAKEIPRULES

    return 0;
}

service_data_update() {
    local mihomo_rulesets_files_download_url
    config_get mihomo_rulesets_files_download_url settings mihomo_rulesets_files_download_url "$DEFAULT_MIHOMO_RULESETS_FILES_DOWNLOAD_URL"

    local complete_url
    local tmp_rulesets_file tmp_block_rulesets_file

    mkdir -p "$CORE_WORKDIR_PATH"
    mkdir -p "$PROG_ETC_DIR"

    log info "Downloading ruleset list" "📥"
    tmp_rulesets_file=$(mktemp "${CORE_WORKDIR_PATH}/${RULESETS_FILENAME}.XXXXXX")
    complete_url=${mihomo_rulesets_files_download_url}/${RULESETS_FILENAME}
    curl --connect-timeout "$CURL_CONNECT_TIMEOUT" --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" --speed-time "$CURL_MIN_SPEED_TIMEOUT" --progress-bar -L -f -o "$tmp_rulesets_file" "$complete_url" || {
        log error "Failed to download the ruleset list." "❌"
        rm -f "$tmp_rulesets_file"
        return 1
    }
    mv -f "$tmp_rulesets_file" "$RULESETS_FILE"
    log info "Ruleset list updated." "✅"

    log info "Downloading block ruleset list" "📥"
    tmp_block_rulesets_file=$(mktemp "${CORE_WORKDIR_PATH}/${RULESETS_BLOCKS_FILENAME}.XXXXXX")
    complete_url=${mihomo_rulesets_files_download_url}/${RULESETS_BLOCKS_FILENAME}
    curl --connect-timeout "$CURL_CONNECT_TIMEOUT" --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" --speed-time "$CURL_MIN_SPEED_TIMEOUT" --progress-bar -L -f -o "$tmp_block_rulesets_file" "$complete_url" || {
        log error "Failed to download the block ruleset list." "❌"
        rm -f "$tmp_block_rulesets_file"
        return 1
    }
    mv -f "$tmp_block_rulesets_file" "$RULESETS_BLOCKS_FILE"
    log info "Block ruleset list updated." "✅"

    return 0
}

core_prepare_workdir() {
    local res=1
    local current_hash=""
    local saved_hash=""
    local mihomo_persistent_ext_rules mihomo_persistent_cache

    config_get mihomo_persistent_ext_rules settings mihomo_persistent_ext_rules 0
    config_get mihomo_persistent_cache settings mihomo_persistent_cache 0

    log info "Preparing workdir $CORE_WORKDIR_PATH" "📁"

    if [ -L "$CORE_WORKDIR_PATH" ] || [ ! -d "$CORE_WORKDIR_PATH" ]; then
        [ -e "$CORE_WORKDIR_PATH" ] || [ -L "$CORE_WORKDIR_PATH" ] && log warn "Removing invalid path at $CORE_WORKDIR_PATH" "⚠️"
        rm -rf "$CORE_WORKDIR_PATH"
        # shellcheck disable=SC2174
        mkdir -m 700 -p "$CORE_WORKDIR_PATH"
    else
        local owner current_uid
        # shellcheck disable=SC2012
        owner=$(ls -ldn "$CORE_WORKDIR_PATH" 2>/dev/null | awk '{print $3}')
        current_uid=$(id -u)
        if [ -n "$owner" ] && [ "$owner" != "$current_uid" ]; then
            log warn "Removing insecure directory at $CORE_WORKDIR_PATH owned by UID $owner" "⚠️"
            rm -rf "$CORE_WORKDIR_PATH"
            # shellcheck disable=SC2174
            mkdir -m 700 -p "$CORE_WORKDIR_PATH"
        fi
    fi

    if [ -d "$CORE_WORKDIR_PATH" ]; then
        current_hash=$(uci show "$PROGNAME" | grep -vE "^${PROGNAME}\.settings." | md5_str)
        saved_hash=$(cat "$CORE_WORKDIR_UCI_HASH_PATH" 2>/dev/null)

        if [ ! -f "$OUTPUT_YAML_CONFIG_PATH" ]; then
            echo "$current_hash" > "$CORE_WORKDIR_UCI_HASH_PATH"
        elif [ "$current_hash" != "$saved_hash" ]; then
            log info "Existing $OUTPUT_YAML_CONFIG_PATH is outdated and will be regenerated." "🐱"
            rm -f "$OUTPUT_YAML_CONFIG_PATH"
            echo "$current_hash" > "$CORE_WORKDIR_UCI_HASH_PATH"
        else
            log info "Existing $OUTPUT_YAML_CONFIG_PATH is up to date and will be reused." "🐱"
            res=0
        fi
    fi

    if [ "$mihomo_persistent_ext_rules" -eq 1 ] && [ ! -L "$CORE_WORKDIR_RULES_PATH" ]; then
        log info "Creating symlink $SYMLINKDIR_RULESETS -> $CORE_WORKDIR_RULES_PATH" "📁"
        rm -rf "$CORE_WORKDIR_RULES_PATH"
        mkdir -p "$PROG_ETC_DIR"
        [ ! -d "$SYMLINKDIR_RULESETS" ] &&  mkdir -p "$SYMLINKDIR_RULESETS"
        ln -sf "$SYMLINKDIR_RULESETS" "$CORE_WORKDIR_RULES_PATH"
    elif  [ "$mihomo_persistent_ext_rules" -eq 0 ] && [ -L "$CORE_WORKDIR_RULES_PATH" ]; then
        log info "Removing old symlink $SYMLINKDIR_RULESETS -> $CORE_WORKDIR_RULES_PATH" "📁"
        rm -rf "$SYMLINKDIR_RULESETS"
        rm -rf "$CORE_WORKDIR_RULES_PATH"
    fi

    if [ "$mihomo_persistent_cache" -eq 1 ] && [ ! -L "$CORE_WORKDIR_CACHE_DB_PATH" ]; then
        log info "Creating symlink $SYMLINK_CACHE_DB_PATH -> $CORE_WORKDIR_CACHE_DB_PATH"
        rm -f "$CORE_WORKDIR_CACHE_DB_PATH"
        mkdir -p "$PROG_ETC_DIR"
        ln -sf "$SYMLINK_CACHE_DB_PATH" "$CORE_WORKDIR_CACHE_DB_PATH"
    elif [ "$mihomo_persistent_cache" -eq 0 ] && [ -L "$CORE_WORKDIR_CACHE_DB_PATH" ]; then
        log info "Removing old symlink $SYMLINK_CACHE_DB_PATH -> $CORE_WORKDIR_CACHE_DB_PATH"
        rm -f "$SYMLINK_CACHE_DB_PATH"
        rm -f "$CORE_WORKDIR_CACHE_DB_PATH"
    fi

    return "$res"
}

detect_arch() {
    local arch_raw
    arch_raw=$(get_os_arch)

    case "$arch_raw" in
        aarch64_*) echo "arm64" ;;
        mips_*)
            if [ "${arch_raw#*hardfloat}" != "$arch_raw" ]; then
                echo "mips-hardfloat"
            else
                echo "mips-softfloat"
            fi
            ;;
        mipsel_*)
            if [ "${arch_raw#*hardfloat}" != "$arch_raw" ]; then
                echo "mipsle-hardfloat"
            else
                echo "mipsle-softfloat"
            fi
            ;;
        mips64_*) echo "mips64" ;;
        mips64el_*) echo "mips64le" ;;
        x86_64) echo "amd64" ;;
        i386_*) echo "386" ;;
        riscv64_*) echo "riscv64" ;;
        loongarch64_*) echo "loong64-abi2" ;;
        *_neon-vfp*) echo "armv7" ;;
        *_neon* | *_vfp*) echo "armv6" ;;
        arm_*) echo "armv5" ;;
        *) echo "amd64" ;;
    esac
}

get_latest_version_url() {
    local check_url="$1" channel="${2}"
    local api_url jq_filter

    if [ "$channel" = "alpha" ]; then
        api_url="${check_url%/latest}"
        # shellcheck disable=SC2016
        jq_filter='[.[] | select(.tag_name == "Prerelease-Alpha")][0].assets[] | select(.name == "version.txt") | .browser_download_url'
    else
        api_url="$check_url"
        jq_filter='.assets[] | select(.name == "version.txt") | .browser_download_url'
    fi

    (
        set -o pipefail
        curl --connect-timeout "$CURL_CONNECT_TIMEOUT" \
            --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" \
            --speed-time "$CURL_MIN_SPEED_TIMEOUT" \
            -sL "$api_url" | jq -r "$jq_filter"
    )
}

core_update() {
    local cur_ver latest_ver version_txt_url
    local check_url channel arch source_type
    local custom_url

    config_get source_type settings mihomo_core_source_type "${DEFAULT_MIHOMO_SOURCE_CORE}"
    cur_ver=$(info_mihomo)
    arch=$(detect_arch)

    if [ "$source_type" = "custom" ]; then
        config_get custom_url settings mihomo_custom_core_url
        if [ -z "$custom_url" ]; then
            log error "Custom core base URL is not set in configuration." "❌"
            return 1
        fi

        # Ensure URL doesn't have a trailing slash
        custom_url="${custom_url%/}"
        version_txt_url="${custom_url}/version.txt"
        log info "Checking for Mihomo updates from custom source..." "🔄"
    else
        local github_repo
        config_get channel settings mihomo_github_channel "$DEFAULT_MIHOMO_UPDATE_CHANNEL"
        config_get github_repo settings mihomo_github_repo "$DEFAULT_MIHOMO_GITHUB_REPO"

        channel=${1:-$channel}

        check_url="https://api.github.com/repos/${github_repo}/releases/latest"
        log info "Checking for Mihomo updates (channel: $channel) from GitHub repository: $github_repo..." "🔄"
        version_txt_url=$(get_latest_version_url "$check_url" "$channel") || {
            log error "Failed to get the version.txt URL from the GitHub API." "❌"
            return 1
        }
    fi

    if [ -z "$version_txt_url" ]; then
        log error "Release asset version.txt was not found."
        return 1
    fi

    latest_ver=$(
        set -o pipefail
        curl --connect-timeout "$CURL_CONNECT_TIMEOUT" \
        --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" \
        --speed-time "$CURL_MIN_SPEED_TIMEOUT" \
        -sL "$version_txt_url" | sed -n 1p | tr -d '\r\n'
    ) || {
        log error "Failed to download version.txt." "❌"
        return 1
    }

    if [ -z "$latest_ver" ]; then
        log error "Failed to retrieve the latest version information."
        return 1
    fi

    if [ "$cur_ver" = "$NO_DATA_STRING" ] || [ -z "$cur_ver" ]; then
        log warn "Mihomo is not installed. Installing version $latest_ver." "⚠️"
        core_download "$version_txt_url" "$latest_ver"
        if [ $? -eq 1 ]; then
            log error "Core update failed." "❌"
            return 1
        fi
        return 0
    fi

    log info "Current Mihomo version: $cur_ver"
    log info "Latest Mihomo version: $latest_ver"

    if [ "$cur_ver" != "$latest_ver" ]; then
        log info "Removing current mihomo binary..." "⚠️"
        core_remove
        if [ $? -eq 1 ]; then
            log error "Core update failed." "❌"
            return 1
        fi

        log info "Updating Mihomo to version $latest_ver" "⬆️"
        core_download "$version_txt_url" "$latest_ver"
        if [ $? -eq 1 ]; then
            log error "Core update failed." "❌"
            return 1
        fi
    else
        log info "Mihomo is already up-to-date." "✅"
    fi

    return 0
}

core_download() {
    local arch file_name base_url param_version version_txt_url download_url
    version_txt_url="$1"
    param_version="$2"
    local tmp_archive_path

    arch=$(detect_arch)
    mkdir -p "$CORE_WORKDIR_PATH"
    tmp_archive_path=$(mktemp "${CORE_WORKDIR_PATH}/mihomo.XXXXXX")

    file_name="mihomo-linux-${arch}-${param_version}.gz"
    base_url="${version_txt_url%/*}"
    download_url="${base_url}/${file_name}"

    log info "Downloading mihomo binary from $download_url" "📥"
    curl --connect-timeout "$CURL_CONNECT_TIMEOUT" \
        --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" \
        --speed-time "$CURL_MIN_SPEED_TIMEOUT" \
        --progress-bar -L -o "$tmp_archive_path" "$download_url" || {
        rm -f "$tmp_archive_path"
        log error "Failed to download the Mihomo archive." "❌"
        return 1
    }

    log info "Extracting to $CORE_PATH" "⬇️"
    if gzip -t "$tmp_archive_path" 2>/dev/null; then
        gunzip -c "$tmp_archive_path" > "$CORE_PATH" || {
            rm -f "$tmp_archive_path"
            log error "Failed to extract the Mihomo archive." "❌"
            return 1
        }
    else
        cp "$tmp_archive_path" "$CORE_PATH" || {
            rm -f "$tmp_archive_path"
            log error "Failed to copy the Mihomo binary." "❌"
            return 1
        }
    fi

    log info "Mihomo installed at $CORE_PATH" "🚀"

    if ! chmod +x "$CORE_PATH"; then
        log error "Failed to set executable permissions: $CORE_PATH" "❌"
    fi

    log info "Cleaning up temporary files" "🧹"
    if ! rm -f "$tmp_archive_path"; then
        log error "Failed to clean up temporary file: $tmp_archive_path" "❌"
    fi
}

core_remove() {
    if [ ! -x "$CORE_PATH" ]; then
        log error "Mihomo is not installed." "❌"
        return 1
    else
        if rm -f "$CORE_PATH"; then
            log info "Mihomo is removed." "✅"
            return 0
        else
            log error "Failed to remove Mihomo binary: $CORE_PATH" "❌"
            return 1
        fi
    fi
}

cron_make_if_missing() {
    if [ ! -f "/etc/crontabs/root" ]; then
        touch "/etc/crontabs/root"
    fi
}

cron_job_check() {
    cron_make_if_missing
    grep -qF "$1" /etc/crontabs/root
}

cron_job_add() {
    cron_make_if_missing
    local schedule="$1"
    local pattern="$2"
    local cmd="$3"
    local name="$4"

    if [ -z "$schedule" ]; then
        log error "$name cron schedule string is empty! Cron job not added." "❌"
        return 1
    fi

    if ! validate_cron_expr "$schedule"; then
        log error "$name cron schedule string is invalid: $schedule! Cron job not added." "❌"
        return 1
    fi

    local expected_entry="${schedule} ${cmd}"
    if grep -qF "$expected_entry" /etc/crontabs/root; then
        return 0
    fi

    # Remove any existing entry matching the pattern (regardless of schedule)
    sed -i "\|${pattern}|d" /etc/crontabs/root

    # Append new entry
    echo "$expected_entry" >> /etc/crontabs/root
    if /etc/init.d/cron enabled; then
        /etc/init.d/cron restart
        log info "$name cron job added and cron service restarted" "✅"
    else
        log info "$name cron job added (cron service not enabled)" "ℹ️"
    fi
}

cron_job_remove() {
    cron_make_if_missing
    local pattern="$1"
    local name="$2"
    if cron_job_check "$pattern"; then
        sed -i "\|${pattern}|d" /etc/crontabs/root
        if /etc/init.d/cron enabled; then
            /etc/init.d/cron restart
            log info "$name cron job removed and cron service restarted" "✅"
        else
            log info "$name cron job removed (cron service not enabled)" "ℹ️"
        fi
    fi
}

core_autorestart_cron_check() {
    cron_job_check "${INITD_PATH} reload"
}

core_autorestart_cron_add() {
    local schedule
    config_get schedule settings mihomo_cron_autorestart_string
    cron_job_add "$schedule" "${INITD_PATH} reload" "pgrep -f ${CORE_PATH} >/dev/null && ${INITD_PATH} reload" "Core autorestart"
}

core_autorestart_cron_remove() {
    cron_job_remove "${INITD_PATH} reload" "Core autorestart"
}

service_data_cron_check() {
    cron_job_check "${PROG_PATH} service_data_update"
}

service_data_cron_add() {
    local schedule
    config_get schedule settings mihomo_cron_service_data_update_string
    cron_job_add "$schedule" "${PROG_PATH} service_data_update" "pgrep -f ${CORE_PATH} >/dev/null && $PROG_PATH service_data_update" "Service data update"
}

service_data_cron_remove() {
    cron_job_remove "${PROG_PATH} service_data_update" "Service data update"
}

cron_update() {
    local mihomo_autorestart mihomo_service_data_autoupdate

    config_get_bool mihomo_autorestart settings mihomo_autorestart 0
    config_get_bool mihomo_service_data_autoupdate settings mihomo_service_data_autoupdate 0

    if [ "$mihomo_autorestart" -eq 1 ]; then
        core_autorestart_cron_add
    else
        core_autorestart_cron_remove
    fi

    if [ "$mihomo_service_data_autoupdate" -eq 1 ]; then
        service_data_cron_add
    else
        service_data_cron_remove
    fi
}

diag_nft() {
    clog info "Verifying existence of NFTables table '$NF_TABLE_NAME'..."
    if ! nft list table inet "$NF_TABLE_NAME" >/dev/null 2>&1; then
        clog error "Table '$NF_TABLE_NAME' not found. Please create the required NFTables table." "❌"
        return 1
    fi

    clog info "Displaying current NFTables configuration:"
    nft list table inet "$NF_TABLE_NAME"

    clog info "NFTables check completed successfully."

    return 0
}

diag_route() {
    local pbr_priority

    config_get pbr_priority settings pbr_priority "$DEFAULT_PBR_PRIORITY"

    clog info "Verifying existence of route rule..."
    local hex_mark
    hex_mark=$(printf "0x%x" "$NF_TABLE_FWMARK_FINAL")
    if ! ip rule list | awk -v priority="${pbr_priority}:" -v mark="$hex_mark" -v table="$NF_ROUTE_TABLE" \
        '$1 == priority && $0 ~ ("fwmark " mark) && $0 ~ ("lookup " table "([[:space:]]|$)") { found=1 } END { exit !found }'; then
        clog error "Required route rule is missing: ip rule add fwmark $NF_TABLE_FWMARK_FINAL table $NF_ROUTE_TABLE priority $pbr_priority" "❌"
    fi
    ip rule list

    if ! ip route show table "$NF_ROUTE_TABLE" 2>/dev/null | grep -Eq "local (default|0\.0\.0\.0/0) dev lo"; then
         clog error "Route table $NF_ROUTE_TABLE is incorrect!" "❌"
    fi
    ip route show table "$NF_ROUTE_TABLE" 2>/dev/null
}

diag_proxy_resolver() {
    local target="$1"
    local dns_listen_port
    local ip_output exit_code ips

    if [ -z "$1" ]; then
        log warn "Usage: diag_proxy_resolver <domain>"
        return 1
    fi
    config_get dns_listen_port proxy dns_listen_port

    clog info "Testing Fake IP DNS resolution..."

    ip_output=$(nslookup -timeout="$NSLOOKUP_TIMEOUT" "$target" 127.0.0.1:"$dns_listen_port" 2>/dev/null)
    exit_code=$?

    ips=$(echo "$ip_output" | awk '/^Address: / {print $2}')

    if [ "$exit_code" -ne 0 ] || [ -z "$ips" ]; then
        clog error "Fake IP DNS query failed" "❌"
        return 1
    else
        echo "$ips"
        clog info "Fake IP DNS query successful" "✅"
        return 0
    fi
}

diag_external_resolver() {
    if [ -z "$1" ] || [ -z "$2" ]; then
        log warn "Usage: diag_external_resolver <domain> <dns resolver>"
        return 1
    fi
    local target="$1"
    local resolver="$2"
    local ip_output exit_code ips

    clog info "Testing DNS resolution..."

    ip_output=$(nslookup -timeout="$NSLOOKUP_TIMEOUT" "$target" "$resolver" 2>/dev/null)
    exit_code=$?

    ips=$(echo "$ip_output" | awk '/^Address: / {print $2}')

    if [ "$exit_code" -ne 0 ] || [ -z "$ips" ]; then
        clog error "External DNS query failed" "❌"
        return 1
    else
        clog info "External DNS query successful" "✅"
        return 0
    fi
}

diag_icmp() {
    local target="${1}"
    local count="${2}"
    local timeout=2
    local ping_output exit_code

    if [ -z "$target" ] || [ -z "$count" ]; then
        clog warn "Usage: diag_icmp <target> <count>"
        return 1
    fi

    ping_output=$(ping -c "$count" -W "$timeout" "$target" 2>&1)
    exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
        clog info "Ping to ${target} is successful" "✅"
        clog info "$ping_output"
    else
        clog error "Ping to ${target} failed" "❌"
        clog error "$ping_output"
    fi
}

diag_mihomo_config() {
    if [ -f "$OUTPUT_YAML_CONFIG_PATH" ]; then
        sed -E 's/^([[:space:]]*"?(secret|password|obfs-password|tls-password|uuid|public-key|short-id|private-key|certificate|preshared-key|username|server|servername|token|auth|authentication)"?:).*/\1 "***REDACTED***"/gI' "$OUTPUT_YAML_CONFIG_PATH"
    else
        clog error "Config file not found." "❌"
    fi
}

diag_mihomo_config_unsafe() {
    if [ -f "$OUTPUT_YAML_CONFIG_PATH" ]; then
        cat "$OUTPUT_YAML_CONFIG_PATH"
    else
        clog error "Config file not found." "❌"
    fi
}

diag_service_config() {
    if [ -f "$CONFIG_PATH" ]; then
        sed -E "s/^([[:space:]]*(option|list)[[:space:]]+(password|obfs_password|tls_password|key|private_key|preshared_key|api_password|username|uuid|public_key|short_id|certificate|server|servername|token|auth|authentication|subscription|proxy_link_uri|proxy_link_object)[[:space:]]+).*/\1'***REDACTED***'/gI" "$CONFIG_PATH"
    else
        clog error "Service config file not found." "❌"
    fi
}

diag_service_config_unsafe() {
    if [ -f "$CONFIG_PATH" ]; then
        cat "$CONFIG_PATH"
    else
        clog error "Service config file not found." "❌"
    fi
}

diag_report() {
    local running autoload hw_model os_ver
    service "$PROGNAME" running && running="✅" || running="❌"
    service "$PROGNAME" enabled && autoload="✅" || autoload="❌"

    echo ""
    echo "₍^. .^₎⟆ $PROGNAME diagnostic:"
    echo ""
    echo "❯❯❯❯ Basic:"
    hw_model=$(get_hw_model)
    echo "Device:  ${hw_model:-$NO_DATA_STRING}"
    os_ver=$(get_os_version)
    echo "OpenWRT: ${os_ver:-$NO_DATA_STRING}"
    echo "Service: $JUSTCLASH_VERSION"
    printf "Mihomo:  "
    info_mihomo
    echo ""
    echo "❯❯❯❯ Status:"
    echo "Active:  $running"
    echo "Load:  $autoload"
    echo ""
    echo "❯❯❯❯ NFT Tables:"
    diag_nft
    echo ""
    echo "❯❯❯❯ Routes:"
    diag_route
    echo ""
    echo "❯❯❯❯ ICMP $DEFAULT_DIAG_IP_CHECK_PING_YANDEX :"
    diag_icmp "$DEFAULT_DIAG_IP_CHECK_PING_YANDEX" 2
    echo ""
    echo "❯❯❯❯ ICMP $DEFAULT_DIAG_IP_CHECK_PING_GOOGLE :"
    diag_icmp "$DEFAULT_DIAG_IP_CHECK_PING_GOOGLE" 2
    echo ""
    echo "❯❯❯❯ ICMP $DEFAULT_DIAG_DOMAIN_CHECK_PING_GITHUB :"
    diag_icmp "$DEFAULT_DIAG_DOMAIN_CHECK_PING_GITHUB" 2
    echo ""
    echo "❯❯❯❯ DNS resolve $DEFAULT_DIAG_RESOLVE_URL_YANDEX with proxy:"
    diag_proxy_resolver "$DEFAULT_DIAG_RESOLVE_URL_YANDEX"
    echo ""
    echo "❯❯❯❯ DNS resolve $DEFAULT_DIAG_RESOLVE_URL_YANDEX with $DEFAULT_DIAG_IP_CHECK_PING_YANDEX:"
    diag_external_resolver "$DEFAULT_DIAG_RESOLVE_URL_YANDEX" "$DEFAULT_DIAG_IP_CHECK_PING_YANDEX"
    echo ""
    echo "❯❯❯❯ DNS resolve $DEFAULT_DIAG_RESOLVE_URL_YANDEX with $DEFAULT_DIAG_IP_CHECK_PING_GOOGLE:"
    diag_external_resolver "$DEFAULT_DIAG_RESOLVE_URL_YANDEX" "$DEFAULT_DIAG_IP_CHECK_PING_GOOGLE"
    echo ""
    echo "❯❯❯❯ Zapret:"
    if [ -f "$ZAPRETINITD_FILEPATH" ]; then echo "⚠️ Zapret installed."; else echo "✅ No zapret installed."; fi
    echo ""
    echo "❯❯❯❯ ByeDPI:"
    if [ -f "$BYEDPI_FILEPATH" ]; then echo "⚠️ ByeDPI installed."; else echo "✅ No ByeDPI installed."; fi
    echo ""
    echo "❯❯❯❯ YoutubeUnblock:"
    if [ -f "$YOUTUBEUNBLOCK_FILEPATH" ]; then echo "⚠️ YoutubeUnblock installed."; else echo "✅ No YoutubeUnblock installed."; fi
    echo ""
    echo "❯❯❯❯ /etc/resolv.conf:"
    cat /etc/resolv.conf
    echo ""
    echo "❯❯❯❯ Network config:"
    uci show network | sed -E "s/(\.(password|key|private_key|preshared_key|secret|passphrase))=('.*'|[^ ]*)/\1='***REDACTED***'/gI"
    echo ""
    echo "❯❯❯❯ DHCP config:"
    uci show dhcp
    echo ""
    echo "❯❯❯❯ Service config:"
    diag_service_config
    echo ""
    echo "❯❯❯❯ Mihomo config:"
    diag_mihomo_config
    echo ""
}

diag_service_config_reset() {
    if [ ! -f "$DEFAULT_CONFIG_PATH" ]; then
        clog error "Default configuration file is missing. Restore is unavailable."
        return 1
    fi

    clog info "Restoring JustClash settings..."

    rm -f "$CONFIG_BAK_PATH"

    if [ ! -f "$CONFIG_PATH" ]; then
        clog error "Current configuration file was not found; nothing to back up."
    else
        if ! mv "$CONFIG_PATH" "$CONFIG_BAK_PATH"; then
            clog error "Failed to back up the current configuration file."
            return 1
        else
            clog info "Previous configuration file was saved to ${CONFIG_BAK_PATH}"
        fi
    fi

    if ! cp "$DEFAULT_CONFIG_PATH" "$CONFIG_PATH"; then
        clog error "Failed to restore the default configuration."
        return 1
    fi

    clog info "Default settings will be applied on the next service restart."
    return 0
}

help() {
    echo "Usage: justclash.sh <command> [args]"
    echo ""
    echo "Service Management:"
    echo "  start|run               Start the service"
    echo "  stop                    Stop the service"
    echo "  info_core|version_core  Show Mihomo core version"
    echo "  info_package|version    Show service version"
    echo "  service_data_update     Update service files from repository"
    echo ""
    echo "Mihomo management Commands:"
    echo "  core_update                     Check current version and update Mihomo if a newer version is available"
    echo "  core_remove                     Remove the currently installed Mihomo binary"
    echo ""
    echo "  cron_update                     Update all scheduled tasks from UCI settings"
    echo ""
    echo "  core_autorestart_cron_check     Check if a scheduled Mihomo auto-restart task exists"
    echo "  core_autorestart_cron_add       Add a scheduled task to automatically restart Mihomo periodically"
    echo "  core_autorestart_cron_remove    Remove the scheduled Mihomo auto-restart task"
    echo ""
    echo "  service_data_cron_check         Check if a scheduled service data update task exists"
    echo "  service_data_cron_add           Add a scheduled task to automatically update rules/databases"
    echo "  service_data_cron_remove        Remove the scheduled service data update task"
    echo ""
    echo "Diagnostics:"
    echo "  show_hwid                   Show Hardware ID (HWID)"
    echo "  diag_report                 Run diagnostic"
    echo "  diag_nft                    Run nftables diagnostic"
    echo "  diag_route                  Run route tables diagnostic"
    echo "  diag_icmp                   Run internet check with ICMP"
    echo "  diag_proxy_resolver         Run Internal DNS diagnostic"
    echo "  diag_external_resolver      Run Default DNS diagnostic"
    echo "  diag_mihomo_config          Show generated mihomo config (redacted)"
    echo "  diag_mihomo_config_unsafe   Show raw generated mihomo config (includes passwords)"
    echo "  diag_service_config         Show service config (redacted)"
    echo "  diag_service_config_unsafe  Show raw service config (includes passwords)"
    echo "  diag_service_config_reset   Reset service configuration to default"
    echo ""
    echo "Logs:"
    echo "  logs|systemlogs [N]     Show last N lines of system logs (default 40)"
    echo ""
    echo "Help:"
    echo "  help|?|command          Show this help message"
    echo ""
}

case "$1" in
    start|run|up|u)
        [ "$JUSTCLASH_ENV" != "procd" ] && trap stop INT TERM HUP
        start
        ;;
    stop|down|d)
        stop
        ;;
    core_update|cu)
        core_update
        ;;
    core_remove|cr)
        core_remove
        ;;
    core_autorestart_cron_check|cacc)
        core_autorestart_cron_check
        ;;
    core_autorestart_cron_add|caca)
        core_autorestart_cron_add
        ;;
    core_autorestart_cron_remove|cacr)
        core_autorestart_cron_remove
        ;;
    cron_update|cru)
        cron_update
        ;;
    service_data_cron_check|sdcc)
        service_data_cron_check
        ;;
    service_data_cron_add|sdca)
        service_data_cron_add
        ;;
    service_data_cron_remove|sdcr)
        service_data_cron_remove
        ;;
    service_data_update|sdu)
        service_data_update
        ;;
    logs|systemlogs|log|l)
        case "$2" in
            *[!0-9]* | '')
                systemlogs
                ;;
            *)
                systemlogs "$2"
                ;;
        esac
        ;;
    info_core|info_mihomo|version_core|vc|--vc)
        info_mihomo
        ;;
    info_package|version|v|-v|--version)
        echo "$JUSTCLASH_VERSION"
        ;;
    diag_nft|dn)
        diag_nft
        ;;
    diag_route|dr)
        diag_route
        ;;
    diag_report|diag|dg)
        diag_report
        ;;
    diag_proxy_resolver|dpr)
        diag_proxy_resolver "$2"
        ;;
    diag_external_resolver|der)
        diag_external_resolver "$2" "$3"
        ;;
    diag_icmp|di)
        diag_icmp "$2" "${3:-3}"
        ;;
    diag_mihomo_config|dmc)
        diag_mihomo_config
        ;;
    diag_mihomo_config_unsafe|dmcu)
        diag_mihomo_config_unsafe
        ;;
    diag_service_config|dsc)
        diag_service_config
        ;;
    diag_service_config_unsafe|dscu)
        diag_service_config_unsafe
        ;;
    diag_service_config_reset|dscr)
        diag_service_config_reset
        ;;
    show_hwid|hwid)
        hwid_generate
        echo ""
        ;;
    help|'?'|command|h|-h|--help)
        help
        ;;
    _luci_call)
        echo "$JUSTCLASH_VERSION,$(info_mihomo)"
        ;;
    *)
        clog info "Unknown command: $1"
        clog info "Type 'justclash.sh help' for a list of available commands."
        exit 1
        ;;
esac
