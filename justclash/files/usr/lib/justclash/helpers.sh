#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------------------
# External justclash service helpers file
# --------------------------------------------------------

url_decode() {
    # shellcheck disable=SC3060
    local data="${1//+/ }"
    echo -n "$data" | sed 's/%/\\x/g' | xargs -0 printf '%b'
}

json_escape() {
    printf '%s' "$1" | \
    sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\n/\\n/g; s/\r/\\r/g'
}

md5_str() {
    md5sum | awk '{print $1}'
}

spaces_to_commas() {
    sed 's/[[:space:]]\+/, /g'
}

trim() {
    sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

list_to_json_array() {
    local input_list
    read -r input_list

    if [ -n "$input_list" ]; then
        printf '"%s"' "$(echo "$input_list" | sed -e 's/"/\\"/g' -e 's/[[:space:]]\+/","/g')"
    fi
}

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

get_hw_model() {
    cat /tmp/sysinfo/model
}

get_os_arch() {
    grep OPENWRT_ARCH /etc/os-release | cut -d'"' -f2
}

get_os_name() {
    grep NAME /etc/os-release | head -n 1 | cut -d'"' -f2
}

get_os_version_full() {
    grep OPENWRT_RELEASE /etc/os-release | cut -d'"' -f2
}

get_os_version() {
    grep OPENWRT_RELEASE /etc/os-release | awk '{print $2}'
}

hwid_generate() {
    local interface mac_addr board_data arch_data str hwid_str
    local no_mac_string="withoutmac"

    interface=$(ip route show default | awk '/dev/ {print $5; exit}')
    board_data=$(ubus call system board | jq -r '.board_name')
    arch_data=$(get_os_arch)

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