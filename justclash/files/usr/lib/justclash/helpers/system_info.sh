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
    JUSTCLASH_CACHE_OS_VERSION="${PRETTY_NAME:-$OPENWRT_RELEASE}"
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

sysinfo_hwid_generate() {
    local interface mac_addr board_data arch_data hwid_str
    local no_mac_string="__COMPILED_DEFAULT_MAC_VARIABLE__"
    local interface_dump device_status

    if [ -n "$JUSTCLASH_CACHE_HWID" ]; then
        printf '%s' "$JUSTCLASH_CACHE_HWID"
        return 0
    fi

    # Cache ubus network calls locally
    interface_dump=$(ubus call network.interface dump)
    device_status=$(ubus call network.device status)

    # Find default route interface using jq first()
    interface=$(printf '%s\n' "$interface_dump" | jq -r 'first(.interface[] | select(.route[]?.target == "0.0.0.0") | .l3_device)')

    # Fallback: find first up physical interface using jq first()
    if [ -z "$interface" ] || [ "$interface" = "null" ]; then
        interface=$(printf '%s\n' "$device_status" | jq -r 'first(to_entries[] | select(.value.up == true and .key != "lo" and (.key | startswith("br-") | not)) | .key)')
    fi

    # Extract MAC address directly from the cached device status JSON
    if [ -n "$interface" ] && [ "$interface" != "null" ]; then
        mac_addr=$(printf '%s\n' "$device_status" | jq -r --arg dev "$interface" '.[$dev].macaddr // empty' | tr -d ':')
    fi

    { [ -z "$mac_addr" ] || [ "$mac_addr" = "null" ]; } && mac_addr="$no_mac_string"

    board_data=$(ubus call system board | jq -r '.board_name')
    arch_data=$(sysinfo_get_os_arch)

    hwid_str=$(printf "hwid_%s%s%s" "$mac_addr" "$board_data" "$arch_data" | md5sum | cut -c1-14)

    JUSTCLASH_CACHE_HWID="$hwid_str"
    printf '%s' "$JUSTCLASH_CACHE_HWID"
}
