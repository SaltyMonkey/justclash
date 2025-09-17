#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------------------
# External justclash service helpers file
# --------------------------------------------------------

safe_paths_add() {
    local new_value="$1"
    [ -z "$new_value" ] && return

    local original_value="$SAFE_PATHS"
    [ -z "$original_value" ] && original_value=""

    case ":$original_value:" in
        *":$new_value:"*)
            ;;
        *)
            if [ -z "$original_value" ]; then
                SAFE_PATHS="$new_value"
            else
                SAFE_PATHS="$original_value:$new_value"
            fi
            ;;
    esac

    export SAFE_PATHS
}

safe_paths_clear() {
    SAFE_PATHS=""
    export SAFE_PATHS
}

hwid_generate() {
    local interface mac_addr board_data arch_data str hwid_str
    local no_mac_string="withoutmac"

    interface=$(ip route show default | awk '/dev/ {print $5; exit}')
    board_data=$(ubus call system board | jq -r '.board_name')
    arch_data=$(cat /etc/openwrt_release 2>/dev/null | sed -n "s/^DISTRIB_ARCH='\(.*\)'$/\1/p")

    if [ -z "$interface" ]; then
        interface=$(ip link show up | awk -F: '/^[0-9]+:/ {print $2}' | sed 's/ //g' | grep -E '^(eth|lan|wan)' | head -n1)
    fi

    if [ -n "$interface" ]; then
        mac_addr=$(ip link show "$interface" | awk '/ether/ {print $2}' | tr -d ':') || echo "$no_mac_string"
    else
        mac_addr=$no_mac_string
    fi

    str=hwid_$mac_addr$board_data$arch_data

    hwid_str=$(echo "$str" | md5sum | awk '{print $1}' | tr 'A-F' 'a-f' | head -c 14)

    echo "$hwid_str"
}