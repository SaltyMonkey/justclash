#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------------------
# External justclash service part with exposed info_ calls
# Use it to avoid additional uci config calls
# --------------------------------------------------------

PROGNAME="justclash"
NO_DATA_STRING="N/A"
INFO_CORE_BIN_NAME="mihomo"
INFO_CORE_PATH="/usr/bin/${INFO_CORE_BIN_NAME}"

info_device() {
   cat /tmp/sysinfo/model || echo "$NO_DATA_STRING"
}

info_openwrt() {
   grep OPENWRT_RELEASE /etc/os-release | cut -d'"' -f2 || echo "$NO_DATA_STRING"
}

info_openwrt_version() {
   grep OPENWRT_RELEASE /etc/os-release | awk '{print $2}'
}

info_mihomo() {
    if [ ! -x "$INFO_CORE_PATH" ]; then
        echo "$NO_DATA_STRING"
    else
        "$INFO_CORE_PATH" -v 2>/dev/null | head -n1 | awk '{ print $3 }'
    fi
}

info_package() {
    local version

    if command -v apk >/dev/null 2>&1; then
        version=$(apk info "$PROGNAME" 2>/dev/null | grep -oP 'justclash-\K.*')
    else
        version=$(opkg list-installed "$PROGNAME" 2>/dev/null | awk '{print $3}')
    fi

    echo "$version" || echo "$NO_DATA_STRING"
}

info_luci() {
    local version

    if command -v apk >/dev/null 2>&1; then
        version=$(apk info luci-app-"$PROGNAME" 2>/dev/null | grep -oP 'justclash-\K.*')
    else
        version=$(opkg list-installed luci-app-"$PROGNAME" 2>/dev/null | awk '{print $3}')
    fi

    echo "$version" || echo "$NO_DATA_STRING"
}

systemlogs() {
    local lines=${1:-40}
    logread -e "$PROGNAME" | tail -n "$lines"
    return 0
}

case "$1" in
    logs|systemlogs)
        case "$2" in
            *[!0-9]* | '')
                systemlogs
                ;;
            *)
                systemlogs "$2"
                ;;
        esac
        ;;
    info_device)
        info_device
        ;;
    info_openwrt)
        info_openwrt
        ;;
    info_openwrt_version)
        info_openwrt_version
        ;;
    info_core|info_mihomo)
        info_mihomo
        ;;
    info_package)
        info_package
        ;;
    info_luci)
        info_luci
        ;;
    help|?|command)
        help
        ;;
    *)
        clog 2 "Unknown command: $1"
        clog 2 "Type 'justclash_info help' for a list of available commands."
        exit 1
        ;;
esac