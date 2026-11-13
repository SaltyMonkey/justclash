#!/bin/ash
# shellcheck shell=dash

yaml_document_write_access() {
    local use_dashboard="${1}"
    local dashboard_path="${2}"
    local dashboard_url="${3}"
    local interface_name="${4}"
    local ipv6_enabled="${5}"
    local api_tls="${6}"
    local router_selected_ipaddr="${7}"
    local controller_port="${8}"
    local api_password="${9}"
    local api_tls_cert="${10}"
    local api_tls_key="${11}"
    local log_level="${12}"
    local unified_delay="${13}"
    local tcp_concurrent="${14}"
    local routing_mark="${15}"
    local global_ua="${16}"
    local etag_support="${17}"
    local keep_alive_idle="${18}"
    local keep_alive_interval="${19}"
    local profile_store_selected="${20}"
    local profile_store_fake_ip="${21}"

    local controller_endpoint
    case "$router_selected_ipaddr" in
    *:*) controller_endpoint="[$router_selected_ipaddr]:$controller_port" ;;
    *) controller_endpoint="$router_selected_ipaddr:$controller_port" ;;
    esac

    echo "allow-lan: true"

    if [ "$use_dashboard" -eq 1 ]; then
        echo "external-ui: $(str_yaml_quote "$dashboard_path")"
        echo "external-ui-url: $(str_yaml_quote "$dashboard_url")"
    fi

    if [ -n "$interface_name" ]; then
        echo "interface-name: $(str_yaml_quote "$interface_name")"
    fi

    echo "mode: rule"
    printf 'ipv6: %s\n' "$(fmt_uci_bool_as_yaml "$ipv6_enabled")"

    if [ "$api_tls" -eq 1 ]; then
        echo ""
        echo "external-controller-tls: $(str_yaml_quote "$controller_endpoint")"
    else
        echo ""
        echo "external-controller: $(str_yaml_quote "$controller_endpoint")"
    fi

    echo "secret: $(str_yaml_quote "$api_password")"
    echo "external-controller-cors:"
    echo "  allow-origins:"
    echo "    - '*'"
    echo "  allow-private-network: true"
    if [ "$api_tls" -eq 1 ]; then
        echo "tls:"
        echo "  certificate: $(str_yaml_quote "$api_tls_cert")"
        echo "  private-key: $(str_yaml_quote "$api_tls_key")"
    fi
    echo "log-level: $(str_yaml_quote "$log_level")"
    echo "unified-delay: $(fmt_uci_bool_as_yaml "$unified_delay")"
    echo "tcp-concurrent: $(fmt_uci_bool_as_yaml "$tcp_concurrent")"
    echo "routing-mark: $routing_mark"
    echo "global-ua: $(str_yaml_quote "$global_ua")"
    echo "find-process-mode: off"
    echo "etag-support: $(fmt_uci_bool_as_yaml "$etag_support")"
    echo ""
    echo "keep-alive-idle: $keep_alive_idle"
    echo "keep-alive-interval: $keep_alive_interval"
    echo ""
    echo "profile:"
    echo "  store-selected: $(fmt_uci_bool_as_yaml "$profile_store_selected")"
    echo "  store-fake-ip: $(fmt_uci_bool_as_yaml "$profile_store_fake_ip")"
    echo ""
}

yaml_document_write_geodata() {
    local geodata_mode="$1"
    local geodata_autoupdate="$2"
    local geodata_autoupdate_interval="$3"
    local mihomo_geoip_url="$4"
    local mihomo_geosite_url="$5"

    if [ "$geodata_mode" -eq 1 ]; then
        echo "geodata-mode: true"
        echo "geodata-loader: memconservative"
        echo "geo-auto-update: $(fmt_uci_bool_as_yaml "$geodata_autoupdate")"
        echo "geo-autoupdate-interval: $geodata_autoupdate_interval"
        echo "geox-url:"
        echo "  geoip: $(str_yaml_quote "$mihomo_geoip_url")"
        echo "  geosite: $(str_yaml_quote "$mihomo_geosite_url")"
        echo "  mmdb: false"
        echo "  asn: false"
    fi
    echo ""
}

yaml_document_write_listeners() {
    local listeners="$1"
    printf 'listeners: %s\n' "$listeners"
}

yaml_document_write_services() {
    local hosts_content="$1"
    local core_ntp_enabled="$2"
    local core_ntp_write_system="$3"
    local core_ntp_server="$4"
    local core_ntp_port="$5"
    local core_ntp_interval="$6"
    local rule_providers="$7"

    printf '%s\n' "hosts: $hosts_content"
    echo ""
    echo "ntp:"
    echo "  enable: $(fmt_uci_bool_as_yaml "$core_ntp_enabled")"
    echo "  write-to-system: $(fmt_uci_bool_as_yaml "$core_ntp_write_system")"
    echo "  server: $(str_yaml_quote "$core_ntp_server")"
    echo "  port: $core_ntp_port"
    echo "  interval: $core_ntp_interval"
    echo ""
    printf '%s\n' "rule-providers: $rule_providers"
    echo ""
}

yaml_document_write_dns() {
    local dns_cache_max_size="$1"
    local dns_listen_port="$2"
    local ipv6_enabled="$3"
    local use_system_hosts="$4"
    local nameserver_policy="$5"
    local default_nameserver="$6"
    local nameserver="$7"
    local proxy_server_nameserver="$8"
    local direct_nameserver="$9"
    local fake_ip_range="${10}"
    local fake_ip_range6="${11}"
    local fake_ip_ttl="${12}"
    local fake_ip_filter_data="${13}"

    echo "dns:"
    echo "  enable: true"
    echo "  cache-algorithm: arc"
    echo "  cache-max-size: $dns_cache_max_size"
    echo "  listen: $(str_yaml_quote "127.0.0.1:$dns_listen_port")"
    echo "  prefer-h3: false"
    printf '  ipv6: %s\n' "$(fmt_uci_bool_as_yaml "$ipv6_enabled")"
    echo "  use-system-hosts: $(fmt_uci_bool_as_yaml "$use_system_hosts")"
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
    [ "$ipv6_enabled" -eq 1 ] && echo "  fake-ip-range6: $fake_ip_range6"
    echo "  fake-ip-filter-mode: rule"
    echo "  fake-ip-ttl: $fake_ip_ttl"
    printf '%s\n' "  fake-ip-filter: $fake_ip_filter_data"
    echo ""
}

yaml_document_write_sniffer() {
    local sniffer_enable="$1"
    local sniffer_parse_pure_ip="$2"
    local sniffer_override_destination="$3"
    local http_port="$4"
    local secondary_http_port_start="$5"
    local secondary_http_port_end="$6"
    local tls_port="$7"
    local secondary_tls_port="$8"
    local sniffer_exclude_domain="$9"
    local sniffer_force_domain="${10}"
    local sniffer_skip_src_address="${11}"
    local sniffer_skip_dst_address="${12}"

    echo "sniffer:"
    echo "  enable: $(fmt_uci_bool_as_yaml "$sniffer_enable")"
    echo "  parse-pure-ip: $(fmt_uci_bool_as_yaml "$sniffer_parse_pure_ip")"
    echo "  override-destination: $(fmt_uci_bool_as_yaml "$sniffer_override_destination")"
    echo "  sniff:"
    echo "    HTTP:"
    echo "      ports: [$http_port, $secondary_http_port_start-$secondary_http_port_end]"
    echo "    TLS:"
    echo "      ports: [$tls_port, $secondary_tls_port]"
    echo "    QUIC:"
    echo "      ports: [$tls_port, $secondary_tls_port]"
    printf '%s\n' "  skip-domain: $sniffer_exclude_domain"
    printf '%s\n' "  force-domain: $sniffer_force_domain"
    printf '%s\n' "  skip-src-address: $sniffer_skip_src_address"
    printf '%s\n' "  skip-dst-address: $sniffer_skip_dst_address"
    echo ""
}

yaml_document_write_payloads() {
    local proxies="$1"
    local proxy_groups="$2"
    local proxy_providers="$3"
    local rules="$4"

    printf '%s\n' "proxies: $proxies"
    echo ""
    printf '%s\n' "proxy-groups: $proxy_groups"
    echo ""
    printf '%s\n' "proxy-providers: $proxy_providers"
    echo ""
    printf '%s\n' "rules: $rules"
}
