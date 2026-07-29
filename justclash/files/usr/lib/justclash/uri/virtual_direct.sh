#!/bin/ash
# shellcheck shell=dash

# Synthetic direct:// URI parser used by the internal proxy configuration format.

parse_direct_url() {
    local name="$1" dialer_proxy="$2" interface_name="$3" routing_mark="$4" ip_version="$5"

    jq -nc \
        --arg name "$name" \
        --arg dialer_proxy "$dialer_proxy" \
        --arg interface_name "$interface_name" \
        --arg routing_mark "$routing_mark" \
        --arg ip_version "$ip_version" '
        {
            name: $name,
            type: "direct",
            udp: true,
            tfo: true
        }
        + (if $dialer_proxy != "" then {"dialer-proxy": $dialer_proxy} else {} end)
        + (if $interface_name != "" then {"interface-name": $interface_name} else {} end)
        + (if $routing_mark != "" then {"routing-mark": ($routing_mark | tonumber)} else {} end)
        + (if $ip_version != "" then {"ip-version": $ip_version} else {} end)
    '
}
