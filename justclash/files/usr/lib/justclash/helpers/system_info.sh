#!/bin/ash
# shellcheck shell=dash

# Focused helper module loaded into the main ash process.

JUSTCLASH_CACHE_OS_ARCH=""
JUSTCLASH_CACHE_OS_NAME=""
JUSTCLASH_CACHE_OS_VERSION=""
JUSTCLASH_CACHE_OS_VERSION_FULL=""
JUSTCLASH_CACHE_HW_MODEL=""
JUSTCLASH_CACHE_HWID=""

if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    # shellcheck disable=SC2154
    JUSTCLASH_CACHE_OS_ARCH="$OPENWRT_ARCH"
    # shellcheck disable=SC2154
    JUSTCLASH_CACHE_OS_NAME="$NAME"
    # shellcheck disable=SC2154
    JUSTCLASH_CACHE_OS_VERSION="$VERSION_ID"
    # shellcheck disable=SC2154
    JUSTCLASH_CACHE_OS_VERSION_FULL="$OPENWRT_RELEASE"
fi

sysinfo_get_hw_model() {
    [ -n "$JUSTCLASH_CACHE_HW_MODEL" ] || JUSTCLASH_CACHE_HW_MODEL=$(cat /tmp/sysinfo/model 2>/dev/null)
    printf '%s' "$JUSTCLASH_CACHE_HW_MODEL"
}

sysinfo_get_os_arch() {
    printf '%s' "$JUSTCLASH_CACHE_OS_ARCH"
}

sysinfo_get_os_name() {
    printf '%s' "$JUSTCLASH_CACHE_OS_NAME"
}

sysinfo_get_os_version_full() {
    printf '%s' "$JUSTCLASH_CACHE_OS_VERSION_FULL"
}

sysinfo_get_os_version() {
    printf '%s' "$JUSTCLASH_CACHE_OS_VERSION"
}

_sysinfo_hwid_normalize_mac() {
    local mac_addr

    mac_addr=$(printf '%s' "$1" | tr -d ':') || return 1
    [ "${#mac_addr}" -eq 12 ] || return 1
    case "$mac_addr" in
        *[!0-9A-Fa-f]* | 000000000000 | ?[13579bBdDfF]*) return 1 ;;
    esac

    printf '%s' "$mac_addr" | tr 'A-F' 'a-f'
}

_sysinfo_hwid_get_interface_mac() {
    local interface_dump device_status candidate_macs mac_addr

    interface_dump=$(ubus call network.interface dump) || interface_dump='{"interface":[]}'
    device_status=$(ubus call network.device status) || return 1
    candidate_macs=$(printf '%s' "$device_status" | jq -r --argjson interfaces "$interface_dump" '
        . as $devices |
        ([
            $interfaces.interface[]? |
            select(.up == true and any(.route[]?; (.target == "0.0.0.0" or .target == "::") and .mask == 0)) |
            .l3_device
        ] + [
            to_entries[] |
            select(.value.up == true and .key != "lo" and (.key | startswith("br-") | not)) |
            .key
        ]) |
        .[] as $dev |
        $devices[$dev].macaddr // empty
    ') || return 1

    printf '%s\n' "$candidate_macs" | (
        while IFS= read -r mac_addr; do
            if mac_addr=$(_sysinfo_hwid_normalize_mac "$mac_addr"); then
                printf '%s' "$mac_addr"
                exit 0
            fi
        done
        exit 1
    )
}

sysinfo_hwid_generate() {
    local mac_addr board_data arch_data hwid_str

    if [ -n "$JUSTCLASH_CACHE_HWID" ]; then
        printf '%s' "$JUSTCLASH_CACHE_HWID"
        return 0
    fi

    mac_addr="$(
        # shellcheck disable=SC1091
        . /lib/functions/system.sh || exit 1
        get_mac_label
    )" || mac_addr=""

    mac_addr=$(_sysinfo_hwid_normalize_mac "$mac_addr") || mac_addr=""

    if [ -z "$mac_addr" ]; then
        mac_addr=$(_sysinfo_hwid_get_interface_mac) || return 1
    fi

    board_data=$(ubus call system board | jq -r '.board_name')
    arch_data=$(sysinfo_get_os_arch)

    hwid_str=$(printf "hwid_%s%s%s" "$mac_addr" "$board_data" "$arch_data" | sha256sum | cut -d ' ' -f1)

    JUSTCLASH_CACHE_HWID="$hwid_str"
    printf '%s' "$JUSTCLASH_CACHE_HWID"
}
