#!/bin/ash
# shellcheck shell=dash
# Application constants and shared helpers are provided by runtime.sh caller.
# shellcheck disable=SC2154

: "${JUSTCLASH_CONSTANTS_LOADED:?constants.sh must be loaded before runtime/nftables.sh}"

nft_build_skuid_exclusions() {
    local skuid_values="$1"
    local skuid_raw skuid_value skuid_resolved skuid_list=""

    for skuid_raw in $skuid_values; do
        skuid_value=$(str_trim "$skuid_raw")
        [ -n "$skuid_value" ] || continue

        val_is_uint "$skuid_value" && skuid_resolved="$skuid_value" || skuid_resolved=$(id -u "$skuid_value" 2>/dev/null)

        if [ -n "$skuid_resolved" ] && val_is_uint "$skuid_resolved"; then
            skuid_list="${skuid_list:+$skuid_list }$skuid_resolved"
        else
            log warn "Skip router socket owner exclusion due to unresolved user/UID: $skuid_value"
        fi
    done

    printf '%s' "$skuid_list"
}

nft_ruleset_file_populate() {
    local name="$1" file_path="$2" safe_name="${3:-}" ipv6_enabled="${4:-0}"
    [ -n "$safe_name" ] || safe_name=$(val_sanitize_nft_name "$name")

    # Fast check: ensure the file contains at least one IP/CIDR line before touching nftables
    grep -qE '^[[:space:]]*[0-9a-fA-F:]' "$file_path" 2>/dev/null || return 1

    # Stream awk output directly into nftables without intermediate RAM variable buffering
    local err_msg
    if err_msg=$(awk -v table="$NF_TABLE_NAME" -v set4="ruleset_${safe_name}" -v set6="ruleset6_${safe_name}" -v ipv6="$ipv6_enabled" '
        !/^[[:space:]]*(#|\/\/|$)/ && /^[[:space:]]*[0-9a-fA-F:]/ {
            line = $0
            gsub(/[[:space:]]+/, "", line)
            if (line == "") next
            if (index(line, ".")) {
                v4[n4++] = line
            } else if (ipv6 == 1 && index(line, ":")) {
                v6[n6++] = line
            }
        }
        END {
            print "flush set inet " table " " set4
            if (n4 > 0) {
                print "add element inet " table " " set4 " {"
                for (i = 0; i < n4; i++) print "  " v4[i] ","
                print "}"
            }
            if (ipv6 == 1) {
                print "flush set inet " table " " set6
                if (n6 > 0) {
                    print "add element inet " table " " set6 " {"
                    for (i = 0; i < n6; i++) print "  " v6[i] ","
                    print "}"
                }
            }
        }
    ' "$file_path" 2>/dev/null | nft -f - 2>&1); then
        log info "Partial Routing: Populated ruleset_${safe_name} from $(basename "$file_path")"
        return 0
    else
        err_msg=$(echo "$err_msg" | tr '\n\r' '  ' | cut -c1-150)
        log error "Partial Routing: Failed to populate ruleset_${safe_name} from $(basename "$file_path"): $err_msg"
        return 1
    fi
}

nft_async_worker_stop() {
    local pid_path="$1"
    if [ -f "$pid_path" ]; then
        local pid child_pid
        pid=$(cat "$pid_path" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            for child_pid in $(pgrep -P "$pid" 2>/dev/null); do
                kill "$child_pid" 2>/dev/null
            done
            kill "$pid" 2>/dev/null
            log info "Partial routing worker stopped"
        else
            log info "Partial routing worker is not running"
        fi
        rm -f "$pid_path"
    fi
}

nft_sets_watch_start() {
    local routing_mode="$1"
    local nft_apply_changes="${2:-0}"
    local nft_apply_changes_router="${3:-0}"
    local ipv6_enabled="${4:-0}"
    local active_ipcidr_path="$5"
    local workdir_rules_path="$6"
    local pid_path="$7"

    [ "$routing_mode" = "partial" ] || return 0
    if [ "$nft_apply_changes" = "0" ] && [ "$nft_apply_changes_router" = "0" ]; then
        return 0
    fi
    [ -s "$active_ipcidr_path" ] || return 0

    log info "Starting async population of nftables sets from rulesets"

    # Ensure the directory exists so Mihomo can write to it
    mkdir -p "$workdir_rules_path"

    (
        local name rpath file_path safe_name changed_path watch_targets real_rules_path real_rpath changed_name
        real_rules_path=$(readlink -f "$workdir_rules_path" 2>/dev/null || realpath "$workdir_rules_path" 2>/dev/null || echo "$workdir_rules_path")
        watch_targets="$real_rules_path"
        while read -r line; do
            [ -z "$line" ] && continue
            rpath="${line##*|}"
            if [ "${rpath#/}" != "$rpath" ] && [ -e "$rpath" ]; then
                real_rpath=$(readlink -f "$rpath" 2>/dev/null || realpath "$rpath" 2>/dev/null || echo "$rpath")
                watch_targets="$watch_targets $real_rpath"
            fi
        done <"$active_ipcidr_path"

        # shellcheck disable=SC2086
        inotifywait -m -q -e close_write,moved_to --format "%w%f" $watch_targets 2>/dev/null | while read -r changed_path; do
            [ -z "$changed_path" ] && continue
            [ ! -f "$active_ipcidr_path" ] && continue
            changed_name="${changed_path##*/}"
            changed_name="${changed_name%.list}"
            grep -q -F "$changed_name" "$active_ipcidr_path" 2>/dev/null || continue
            log info "Partial Routing: Update event triggered for ${changed_path##*/}, updating nftables ruleset"

            while read -r line; do
                [ -z "$line" ] && continue
                name="${line%%|*}"
                rpath="${line##*|}"

                [ "${rpath#/}" != "$rpath" ] && file_path="$rpath" || file_path="${workdir_rules_path}/${name}.list"

                if [ "${file_path##*/}" = "${changed_path##*/}" ] && [ -f "$file_path" ]; then
                    safe_name=$(val_sanitize_nft_name "$name")
                    nft_ruleset_file_populate "$name" "$file_path" "$safe_name" "$ipv6_enabled"
                    break
                fi
            done <"$active_ipcidr_path"
        done
    ) &
    echo "$!" >"$pid_path"
}

# Returns 0 when applied or disabled, 7 when the nft transaction fails.
nft_table_full_apply() {
    local nft_apply_changes="$1"
    local nft_apply_changes_router="$2"
    local tproxy_port="$3"
    local fake_ip_range="$4"
    local fake_ip_range6="$5"
    local tproxy_input_interfaces="$6"
    local nft_quic_mode="$7"
    local nft_dot_mode="$8"
    local nft_dot_quic_mode="$9"
    local nft_ntp_mode="${10}"
    local nft_ntp_mode_router="${11}"
    local nft_doh_mode="${12}"
    local skuid_values="${13}"
    local proxy_routing_marks="${14}"
    local provider_routing_marks="${15}"
    local nft_ports_exclude="${16}"
    local nft_ports_exclude_router="${17}"
    local nft_mac_exclude="${18}"
    local nft_ips_exclude="${19}"
    local ipv6_enabled="${20}"
    local nft_dns_udp_mode="${21}"
    local iface skuid_list skuid_resolved

    if [ "$nft_apply_changes" = "0" ] && [ "$nft_apply_changes_router" = "0" ]; then
        log warn "Firewall rules generation is disabled for both LAN and router"
        return 0
    fi

    nft delete table inet "$NF_TABLE_NAME" 2>/dev/null

    {
        echo "add table inet $NF_TABLE_NAME"
        echo "add set inet $NF_TABLE_NAME private_ips { type ipv4_addr; flags interval; }"
        echo "add element inet $NF_TABLE_NAME private_ips { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.88.99.0/24, 192.168.0.0/16, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4 }"

        if [ "$nft_apply_changes" = "1" ]; then
            echo "add chain inet $NF_TABLE_NAME prerouting { type filter hook prerouting priority mangle; policy accept; }"
            echo "add chain inet $NF_TABLE_NAME filter_input { type filter hook input priority filter; policy accept; }"
            echo "add chain inet $NF_TABLE_NAME filter_forward { type filter hook forward priority filter; policy accept; }"
            if [ "$nft_dns_udp_mode" = "HIJACK" ]; then
                echo "add chain inet $NF_TABLE_NAME dns_hijack { type nat hook prerouting priority -151; policy accept; }"
            fi

            echo "add set inet $NF_TABLE_NAME fake_ips { type ipv4_addr; flags interval; }"
            echo "add element inet $NF_TABLE_NAME fake_ips { $fake_ip_range }"
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add set inet $NF_TABLE_NAME fake_ip6s { type ipv6_addr; flags interval; }"
                echo "add element inet $NF_TABLE_NAME fake_ip6s { $fake_ip_range6 }"
            fi
            echo "add set inet $NF_TABLE_NAME inbound_interfaces { type ifname; }"
            for iface in $tproxy_input_interfaces; do
                echo "add element inet $NF_TABLE_NAME inbound_interfaces { \"$iface\" }"
            done
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add set inet $NF_TABLE_NAME private_ip6s { type ipv6_addr; flags interval; }"
                echo "add element inet $NF_TABLE_NAME private_ip6s { ::1/128, fc00::/7, fe80::/10, ff00::/8 }"
            fi
            echo "add set inet $NF_TABLE_NAME doh_ips { type ipv4_addr; flags interval; }"
            echo "add element inet $NF_TABLE_NAME doh_ips { $DEFAULT_DOH_IPS4 }"
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add set inet $NF_TABLE_NAME doh_ip6s { type ipv6_addr; flags interval; }"
                echo "add element inet $NF_TABLE_NAME doh_ip6s { $DEFAULT_DOH_IPS6 }"
            fi
            if [ "$nft_dns_udp_mode" = "HIJACK" ]; then
                echo "add rule inet $NF_TABLE_NAME dns_hijack iifname != @inbound_interfaces return comment \"Bypass DNS from non-intercepted interfaces\""
                if [ -n "$nft_mac_exclude" ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack ether saddr { $(echo "$nft_mac_exclude" | str_spaces_to_commas) } return comment \"Bypass DNS from excluded MACs\""
                fi
                if [ -n "$nft_ips_exclude" ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack ip saddr { $(echo "$nft_ips_exclude" | str_spaces_to_commas) } return comment \"Bypass DNS from excluded client IPs\""
                fi
                if [ -n "$nft_ports_exclude" ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded DNS destination ports\""
                    echo "add rule inet $NF_TABLE_NAME dns_hijack meta l4proto { tcp, udp } th sport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded DNS source ports\""
                fi
                echo "add rule inet $NF_TABLE_NAME dns_hijack fib daddr type local return comment \"Bypass router DNS destinations\""
                echo "add rule inet $NF_TABLE_NAME dns_hijack ip daddr @private_ips return comment \"Bypass private/LAN DNS destinations\""
                echo "add rule inet $NF_TABLE_NAME dns_hijack meta nfproto ipv4 meta l4proto udp udp dport $DEFAULT_DNS_PORT redirect to :$DEFAULT_DNS_PORT comment \"Hijack external UDP DNS to router\""
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack ip6 daddr @private_ip6s return comment \"Bypass private/LAN IPv6 DNS destinations\""
                    echo "add rule inet $NF_TABLE_NAME dns_hijack meta nfproto ipv6 meta l4proto udp udp dport $DEFAULT_DNS_PORT redirect to :$DEFAULT_DNS_PORT comment \"Hijack external UDP DNS IPv6 to router\""
                fi
            fi
            if [ "$ipv6_enabled" -eq 0 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta nfproto ipv6 return comment \"Bypass IPv6 traffic\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting iifname \"lo\" meta nfproto ipv4 meta mark $NF_TABLE_FWMARK_FINAL meta l4proto { tcp, udp } tproxy ip to 127.0.0.1:$tproxy_port accept comment \"Accept marked router IPv4 traffic\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting iifname \"lo\" meta nfproto ipv6 meta mark $NF_TABLE_FWMARK_FINAL meta l4proto { tcp, udp } tproxy ip6 to [::1]:$tproxy_port accept comment \"Accept marked router IPv6 traffic\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting iifname != @inbound_interfaces return comment \"Bypass non-intercepted interfaces\""
            echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto != { tcp, udp } return comment \"Bypass non-TCP/UDP traffic\""
            echo "add rule inet $NF_TABLE_NAME prerouting fib daddr type local return comment \"Bypass router-local traffic\""
            echo "add rule inet $NF_TABLE_NAME prerouting ip daddr @private_ips return comment \"Bypass private/LAN IP ranges\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @private_ip6s return comment \"Bypass private/LAN IPv6 ranges\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting udp sport { 546, 547 } udp dport { 546, 547 } return comment \"Bypass DHCPv6 traffic\""

            if [ -n "$nft_mac_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ether saddr { $(echo "$nft_mac_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded MACs\""
            fi

            if [ -n "$nft_ips_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip saddr { $(echo "$nft_ips_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded client IPs\""
            fi

            if [ -n "$nft_ports_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded destination ports\""
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto { tcp, udp } th sport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded source ports\""
            fi

            if [ "$nft_dns_udp_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport $DEFAULT_DNS_PORT drop comment \"Drop external UDP DNS traffic\""
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
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @doh_ip6s meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT drop comment \"Drop DNS-over-HTTPS IPv6 traffic\""
                fi
            elif [ "$nft_doh_mode" = "REJECT" ]; then
                echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces ip daddr @doh_ips meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS traffic\""
                echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces ip daddr @doh_ips meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS traffic\""
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces ip6 daddr @doh_ip6s meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS IPv6 traffic\""
                    echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces ip6 daddr @doh_ip6s meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS IPv6 traffic\""
                fi
            fi

            if [ "$nft_ntp_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_NTP_PORT } drop comment \"Drop NTP traffic\""
            elif [ "$nft_ntp_mode" = "DIRECT" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_NTP_PORT } return comment \"Bypass NTP traffic\""
            fi

            echo "add rule inet $NF_TABLE_NAME prerouting meta nfproto ipv4 meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip to 127.0.0.1:$tproxy_port comment \"Intercept IPv4 to TProxy\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @fake_ip6s meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip6 to [::1]:$tproxy_port accept comment \"Intercept Fake-IP6 to TProxy\""
                echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr 2000::/3 meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip6 to [::1]:$tproxy_port accept comment \"Intercept Global IPv6 to TProxy\""
            fi
        fi

        if [ "$nft_apply_changes_router" = "1" ]; then
            echo "add chain inet $NF_TABLE_NAME output { type route hook output priority mangle; policy accept; }"
            if [ "$ipv6_enabled" -eq 0 ]; then
                echo "add rule inet $NF_TABLE_NAME output meta nfproto ipv6 return comment \"Bypass IPv6 traffic\""
            fi
            echo "add rule inet $NF_TABLE_NAME output mark $NF_TABLE_FWMARK_PROXY return comment \"Bypass Core (Mihomo) traffic\""
            if [ -n "$proxy_routing_marks" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta mark { $(echo "$proxy_routing_marks" | str_spaces_to_commas) } return comment \"Proxy routing_mark bypass\""
            fi
            if [ -n "$provider_routing_marks" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta mark { $(echo "$provider_routing_marks" | str_spaces_to_commas) } return comment \"Provider override_routing_mark bypass\""
            fi

            echo "add rule inet $NF_TABLE_NAME output meta l4proto != { tcp, udp } return comment \"Bypass non-TCP/UDP traffic\""
            echo "add rule inet $NF_TABLE_NAME output ip daddr @private_ips return comment \"Bypass private/LAN IP ranges\""
            echo "add rule inet $NF_TABLE_NAME output udp sport { 67, 68 } udp dport { 67, 68 } return comment \"Bypass DHCP traffic\""
            echo "add rule inet $NF_TABLE_NAME output udp sport { 546, 547 } udp dport { 546, 547 } return comment \"Bypass DHCPv6 traffic\""

            if [ -n "$nft_ports_exclude_router" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude_router" | str_spaces_to_commas) } return comment \"Bypass excluded router destination ports\""
                echo "add rule inet $NF_TABLE_NAME output meta l4proto { tcp, udp } th sport { $(echo "$nft_ports_exclude_router" | str_spaces_to_commas) } return comment \"Bypass excluded router source ports\""
            fi

            if [ -n "$skuid_values" ]; then
                skuid_list=$(nft_build_skuid_exclusions "$skuid_values")
                for skuid_resolved in $skuid_list; do
                    echo "add rule inet $NF_TABLE_NAME output meta skuid $skuid_resolved return comment \"Bypass excluded user (skuid)\""
                done
            fi

            if [ "$nft_ntp_mode_router" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto udp udp dport { $DEFAULT_NTP_PORT } drop comment \"Drop NTP traffic\""
            elif [ "$nft_ntp_mode_router" = "DIRECT" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto udp udp dport { $DEFAULT_NTP_PORT } return comment \"Bypass NTP traffic\""
            fi

            echo "add rule inet $NF_TABLE_NAME output meta nfproto ipv4 meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router IPv4 traffic for interception\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME output ip6 daddr @fake_ip6s meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router Fake-IP6 for interception\""
                echo "add rule inet $NF_TABLE_NAME output ip6 daddr 2000::/3 meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router Global IPv6 for interception\""
            fi
        fi
    } | nft -f -
    # shellcheck disable=SC2181
    if [ $? -ne 0 ]; then
        log error "Failed to apply Full NFTables rules. Transaction rolled back."
        return 7
    fi

    return 0
}

# Returns 0 when applied or disabled, 7 when the nft transaction fails.
nft_table_partial_apply() {
    local nft_apply_changes="$1"
    local nft_apply_changes_router="$2"
    local tproxy_port="$3"
    local fake_ip_range="$4"
    local fake_ip_range6="$5"
    local tproxy_input_interfaces="$6"
    local nft_quic_mode="$7"
    local nft_dot_mode="$8"
    local nft_dot_quic_mode="$9"
    local nft_ntp_mode="${10}"
    local nft_ntp_mode_router="${11}"
    local nft_doh_mode="${12}"
    local skuid_values="${13}"
    local proxy_routing_marks="${14}"
    local provider_routing_marks="${15}"
    local nft_ports_exclude="${16}"
    local nft_ports_exclude_router="${17}"
    local nft_mac_exclude="${18}"
    local nft_ips_exclude="${19}"
    local ipv6_enabled="${20}"
    local active_ipcidr_path="${21}"
    local active_static_ips_path="${22}"
    local active_static_source_ips_path="${23}"
    local workdir_rules_path="${24}"
    local nft_dns_udp_mode="${25}"
    local iface skuid_list skuid_resolved

    if [ "$nft_apply_changes" = "0" ] && [ "$nft_apply_changes_router" = "0" ]; then
        log warn "Firewall rules generation is disabled for both LAN and router"
        return 0
    fi

    local ipcidr_safe_names="" ipcidr_cold_start_list=""
    if [ -s "$active_ipcidr_path" ]; then
        local rname rpath rsafe rfile
        while read -r line; do
            [ -z "$line" ] && continue
            rname="${line%%|*}"
            rpath="${line##*|}"
            rsafe=$(val_sanitize_nft_name "$rname")
            [ "${rpath#/}" != "$rpath" ] && rfile="$rpath" || rfile="${workdir_rules_path}/${rname}.list"
            ipcidr_safe_names="${ipcidr_safe_names:+$ipcidr_safe_names }$rsafe"
            if [ -s "$rfile" ]; then
                ipcidr_cold_start_list="${ipcidr_cold_start_list:+$ipcidr_cold_start_list }$rname|$rfile|$rsafe"
            fi
        done <"$active_ipcidr_path"
    fi

    nft delete table inet "$NF_TABLE_NAME" 2>/dev/null

    {
        echo "add table inet $NF_TABLE_NAME"
        echo "add set inet $NF_TABLE_NAME private_ips { type ipv4_addr; flags interval; }"
        echo "add element inet $NF_TABLE_NAME private_ips { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.88.99.0/24, 192.168.0.0/16, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4 }"

        echo "add set inet $NF_TABLE_NAME fake_ips { type ipv4_addr; flags interval; }"
        echo "add element inet $NF_TABLE_NAME fake_ips { $fake_ip_range }"
        if [ "$ipv6_enabled" -eq 1 ]; then
            echo "add set inet $NF_TABLE_NAME fake_ip6s { type ipv6_addr; flags interval; }"
            echo "add element inet $NF_TABLE_NAME fake_ip6s { $fake_ip_range6 }"
        fi
        echo "add set inet $NF_TABLE_NAME inbound_interfaces { type ifname; }"
        for iface in $tproxy_input_interfaces; do
            echo "add element inet $NF_TABLE_NAME inbound_interfaces { \"$iface\" }"
        done
        echo "add set inet $NF_TABLE_NAME ruleset_static_ips { type ipv4_addr; flags interval; }"
        echo "add set inet $NF_TABLE_NAME ruleset_source_ips { type ipv4_addr; flags interval; }"
        if [ "$ipv6_enabled" -eq 1 ]; then
            echo "add set inet $NF_TABLE_NAME ruleset6_static_ips { type ipv6_addr; flags interval; }"
            echo "add set inet $NF_TABLE_NAME ruleset6_source_ips { type ipv6_addr; flags interval; }"
        fi
        # Create ipcidr sets (populated after the main transaction via nft_ruleset_file_populate)
        for safe_rname in $ipcidr_safe_names; do
            echo "add set inet $NF_TABLE_NAME ruleset_${safe_rname} { type ipv4_addr; flags interval; }"
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add set inet $NF_TABLE_NAME ruleset6_${safe_rname} { type ipv6_addr; flags interval; }"
            fi
        done

        if [ "$nft_apply_changes" = "1" ]; then
            echo "add chain inet $NF_TABLE_NAME prerouting { type filter hook prerouting priority mangle; policy accept; }"
            echo "add chain inet $NF_TABLE_NAME filter_input { type filter hook input priority filter; policy accept; }"
            echo "add chain inet $NF_TABLE_NAME filter_forward { type filter hook forward priority filter; policy accept; }"
            if [ "$nft_dns_udp_mode" = "HIJACK" ]; then
                echo "add chain inet $NF_TABLE_NAME dns_hijack { type nat hook prerouting priority -151; policy accept; }"
            fi

            echo "add set inet $NF_TABLE_NAME doh_ips { type ipv4_addr; flags interval; }"
            echo "add element inet $NF_TABLE_NAME doh_ips { $DEFAULT_DOH_IPS4 }"
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add set inet $NF_TABLE_NAME doh_ip6s { type ipv6_addr; flags interval; }"
                echo "add element inet $NF_TABLE_NAME doh_ip6s { $DEFAULT_DOH_IPS6 }"
                echo "add set inet $NF_TABLE_NAME private_ip6s { type ipv6_addr; flags interval; }"
                echo "add element inet $NF_TABLE_NAME private_ip6s { ::1/128, fc00::/7, fe80::/10, ff00::/8 }"
            fi
            if [ "$nft_dns_udp_mode" = "HIJACK" ]; then
                echo "add rule inet $NF_TABLE_NAME dns_hijack iifname != @inbound_interfaces return comment \"Bypass DNS from non-intercepted interfaces\""
                if [ -n "$nft_mac_exclude" ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack ether saddr { $(echo "$nft_mac_exclude" | str_spaces_to_commas) } return comment \"Bypass DNS from excluded MACs\""
                fi
                if [ -n "$nft_ips_exclude" ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack ip saddr { $(echo "$nft_ips_exclude" | str_spaces_to_commas) } return comment \"Bypass DNS from excluded client IPs\""
                fi
                if [ -n "$nft_ports_exclude" ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded DNS destination ports\""
                    echo "add rule inet $NF_TABLE_NAME dns_hijack meta l4proto { tcp, udp } th sport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded DNS source ports\""
                fi
                echo "add rule inet $NF_TABLE_NAME dns_hijack fib daddr type local return comment \"Bypass router DNS destinations\""
                echo "add rule inet $NF_TABLE_NAME dns_hijack ip daddr @private_ips return comment \"Bypass private/LAN DNS destinations\""
                echo "add rule inet $NF_TABLE_NAME dns_hijack meta nfproto ipv4 meta l4proto udp udp dport $DEFAULT_DNS_PORT redirect to :$DEFAULT_DNS_PORT comment \"Hijack external UDP DNS to router\""
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME dns_hijack ip6 daddr @private_ip6s return comment \"Bypass private/LAN IPv6 DNS destinations\""
                    echo "add rule inet $NF_TABLE_NAME dns_hijack meta nfproto ipv6 meta l4proto udp udp dport $DEFAULT_DNS_PORT redirect to :$DEFAULT_DNS_PORT comment \"Hijack external UDP DNS IPv6 to router\""
                fi
            fi
            if [ "$ipv6_enabled" -eq 0 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta nfproto ipv6 return comment \"Bypass IPv6 traffic\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting iifname \"lo\" meta nfproto ipv4 meta mark $NF_TABLE_FWMARK_FINAL meta l4proto { tcp, udp } tproxy ip to 127.0.0.1:$tproxy_port accept comment \"Accept marked router IPv4 traffic\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting iifname \"lo\" meta nfproto ipv6 meta mark $NF_TABLE_FWMARK_FINAL meta l4proto { tcp, udp } tproxy ip6 to [::1]:$tproxy_port accept comment \"Accept marked router IPv6 traffic\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting iifname != @inbound_interfaces return comment \"Bypass non-intercepted interfaces\""
            echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto != { tcp, udp } return comment \"Bypass non-TCP/UDP traffic\""
            echo "add rule inet $NF_TABLE_NAME prerouting fib daddr type local return comment \"Bypass router-local traffic\""
            echo "add rule inet $NF_TABLE_NAME prerouting ip daddr @private_ips return comment \"Bypass private/LAN IP ranges\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @private_ip6s return comment \"Bypass private/LAN IPv6 ranges\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting udp sport { 546, 547 } udp dport { 546, 547 } return comment \"Bypass DHCPv6 traffic\""

            if [ -n "$nft_mac_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ether saddr { $(echo "$nft_mac_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded MACs\""
            fi

            if [ -n "$nft_ips_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip saddr { $(echo "$nft_ips_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded client IPs\""
            fi

            if [ -n "$nft_ports_exclude" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded destination ports\""
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto { tcp, udp } th sport { $(echo "$nft_ports_exclude" | str_spaces_to_commas) } return comment \"Bypass excluded source ports\""
            fi

            if [ "$nft_dns_udp_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport $DEFAULT_DNS_PORT drop comment \"Drop external UDP DNS traffic\""
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
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @doh_ip6s meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT drop comment \"Drop DNS-over-HTTPS IPv6 traffic\""
                fi
            elif [ "$nft_doh_mode" = "REJECT" ]; then
                echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces ip daddr @doh_ips meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS traffic\""
                echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces ip daddr @doh_ips meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS traffic\""
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME filter_input iifname @inbound_interfaces ip6 daddr @doh_ip6s meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS IPv6 traffic\""
                    echo "add rule inet $NF_TABLE_NAME filter_forward iifname @inbound_interfaces ip6 daddr @doh_ip6s meta l4proto { tcp, udp } th dport $DEFAULT_TLS_PORT reject comment \"Reject DNS-over-HTTPS IPv6 traffic\""
                fi
            fi

            if [ "$nft_ntp_mode" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_NTP_PORT } drop comment \"Drop NTP traffic\""
            elif [ "$nft_ntp_mode" = "DIRECT" ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting meta l4proto udp udp dport { $DEFAULT_NTP_PORT } return comment \"Bypass NTP traffic\""
            fi

            echo "add rule inet $NF_TABLE_NAME prerouting ip saddr @ruleset_source_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip to 127.0.0.1:$tproxy_port accept comment \"Intercept configured source IPs to TProxy\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip6 saddr @ruleset6_source_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip6 to [::1]:$tproxy_port accept comment \"Intercept configured source IPv6s to TProxy\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting ip daddr @fake_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip to 127.0.0.1:$tproxy_port accept comment \"Intercept Fake-IP to TProxy\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @fake_ip6s meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip6 to [::1]:$tproxy_port accept comment \"Intercept Fake-IP6 to TProxy\""
            fi
            echo "add rule inet $NF_TABLE_NAME prerouting ip daddr @ruleset_static_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip to 127.0.0.1:$tproxy_port accept comment \"Intercept Static IPs to TProxy\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @ruleset6_static_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip6 to [::1]:$tproxy_port accept comment \"Intercept Static IPv6s to TProxy\""
            fi
            for safe_rname in $ipcidr_safe_names; do
                echo "add rule inet $NF_TABLE_NAME prerouting ip daddr @ruleset_${safe_rname} meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip to 127.0.0.1:$tproxy_port accept comment \"Intercept ${safe_rname} to TProxy\""
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME prerouting ip6 daddr @ruleset6_${safe_rname} meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL tproxy ip6 to [::1]:$tproxy_port accept comment \"Intercept ${safe_rname} IPv6 to TProxy\""
                fi
            done
        fi

        if [ "$nft_apply_changes_router" = "1" ]; then
            echo "add chain inet $NF_TABLE_NAME output { type route hook output priority mangle; policy accept; }"
            if [ "$ipv6_enabled" -eq 0 ]; then
                echo "add rule inet $NF_TABLE_NAME output meta nfproto ipv6 return comment \"Bypass IPv6 traffic\""
            fi
            echo "add rule inet $NF_TABLE_NAME output mark $NF_TABLE_FWMARK_PROXY return comment \"Bypass Core (Mihomo) traffic\""
            if [ -n "$proxy_routing_marks" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta mark { $(echo "$proxy_routing_marks" | str_spaces_to_commas) } return comment \"Proxy routing_mark bypass\""
            fi
            if [ -n "$provider_routing_marks" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta mark { $(echo "$provider_routing_marks" | str_spaces_to_commas) } return comment \"Provider override_routing_mark bypass\""
            fi

            echo "add rule inet $NF_TABLE_NAME output meta l4proto != { tcp, udp } return comment \"Bypass non-TCP/UDP traffic\""
            echo "add rule inet $NF_TABLE_NAME output ip daddr @private_ips return comment \"Bypass private/LAN IP ranges\""
            echo "add rule inet $NF_TABLE_NAME output udp sport { 67, 68 } udp dport { 67, 68 } return comment \"Bypass DHCP traffic\""
            echo "add rule inet $NF_TABLE_NAME output udp sport { 546, 547 } udp dport { 546, 547 } return comment \"Bypass DHCPv6 traffic\""

            if [ -n "$nft_ports_exclude_router" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto { tcp, udp } th dport { $(echo "$nft_ports_exclude_router" | str_spaces_to_commas) } return comment \"Bypass excluded router destination ports\""
                echo "add rule inet $NF_TABLE_NAME output meta l4proto { tcp, udp } th sport { $(echo "$nft_ports_exclude_router" | str_spaces_to_commas) } return comment \"Bypass excluded router source ports\""
            fi

            if [ -n "$skuid_values" ]; then
                skuid_list=$(nft_build_skuid_exclusions "$skuid_values")
                for skuid_resolved in $skuid_list; do
                    echo "add rule inet $NF_TABLE_NAME output meta skuid $skuid_resolved return comment \"Bypass excluded user (skuid)\""
                done
            fi

            if [ "$nft_ntp_mode_router" = "DROP" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto udp udp dport { $DEFAULT_NTP_PORT } drop comment \"Drop NTP traffic\""
            elif [ "$nft_ntp_mode_router" = "DIRECT" ]; then
                echo "add rule inet $NF_TABLE_NAME output meta l4proto udp udp dport { $DEFAULT_NTP_PORT } return comment \"Bypass NTP traffic\""
            fi

            echo "add rule inet $NF_TABLE_NAME output ip daddr @fake_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router Fake-IP for interception\""
            echo "add rule inet $NF_TABLE_NAME output ip daddr @ruleset_static_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router Static IPs for interception\""
            if [ "$ipv6_enabled" -eq 1 ]; then
                echo "add rule inet $NF_TABLE_NAME output ip6 daddr @ruleset6_static_ips meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router Static IPv6s for interception\""
            fi
            for safe_rname in $ipcidr_safe_names; do
                echo "add rule inet $NF_TABLE_NAME output ip daddr @ruleset_${safe_rname} meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router ${safe_rname} for interception\""
                if [ "$ipv6_enabled" -eq 1 ]; then
                    echo "add rule inet $NF_TABLE_NAME output ip6 daddr @ruleset6_${safe_rname} meta l4proto { tcp, udp } meta mark set $NF_TABLE_FWMARK_FINAL comment \"Mark router ${safe_rname} IPv6 for interception\""
                fi
            done
        fi
    } | nft -f -
    # shellcheck disable=SC2181
    if [ $? -ne 0 ]; then
        log error "Failed to apply Partial NFTables rules. Transaction rolled back."
        return 7
    fi

    # Populate sets from cached files (cold start).
    # Sets were just created above; nft_ruleset_file_populate uses flush+add so it's safe to call now.
    [ -s "$active_static_ips_path" ] && nft_ruleset_file_populate "static_ips" "$active_static_ips_path" "static_ips" "$ipv6_enabled"
    [ -s "$active_static_source_ips_path" ] && nft_ruleset_file_populate "source_ips" "$active_static_source_ips_path" "source_ips" "$ipv6_enabled"

    if [ -n "$ipcidr_cold_start_list" ]; then
        local item cs_name cs_file cs_safe
        for item in $ipcidr_cold_start_list; do
            cs_name="${item%%|*}"
            cs_safe="${item##*|}"
            cs_file="${item#*|}"
            cs_file="${cs_file%|*}"
            nft_ruleset_file_populate "$cs_name" "$cs_file" "$cs_safe" "$ipv6_enabled"
        done
    fi

    return 0
}

# Idempotent cleanup: returns 0 even when the table is already absent.
nft_table_remove() {
    local table_name="$1"

    nft flush table inet "$table_name" 2>/dev/null || true
    nft delete table inet "$table_name" 2>/dev/null || true
}
