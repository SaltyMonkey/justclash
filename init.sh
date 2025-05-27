#!/bin/sh
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version signature (kind of similar)
# shellcheck shell=dash
JUSTCLASH_LATEST_RELEASE_URL="https://github.com/SaltyMonkeyjustclash-owrt/releases/latest"
JUSTCLASH_RELEASE_URL_PARTIAL="https://github.com/SaltyMonkey/justclash-owrt/releases/download"

CORE_LATEST_RELEASE_URL="https://github.com/metacubex/mihomo/releases/latest"
CORE_RELEASE_URL_PARTIAL="https://github.com/metacubex/mihomo/releases/download"

URL_GITHUB="github.com"

URL_CHECK_PING="77.88.8.8"
URL_CHECK_PING_BACKUP="8.8.8.8"
MIN_SPACE=32768
NO_DATA_STRING="N/A"
CORE_BIN_NAME="mihomo"
CORE_PATH="/usr/bin/mihomo/"

TMP_DOWNLOAD_PATH="/tmp/justclash/downloads"

#Flags
FLAG_INSTALL_WITHOUT_MIHOMO_CORE=0
FLAG_DISABLE_DIAGNOSTIC=0

rm -rf "$TMP_DOWNLOAD_PATH"
mkdir -p "$TMP_DOWNLOAD_PATH"

is_installed() {
    command -v "$1" >/dev/null 2>&1
}

print_bold_yellow() {
    local text="$1"
    printf '\033[1;33m%s\033[0m\n' "$text"
}

print_bold_green() {
    local text="$1"
    printf '\033[1;32m%s\033[0m\n' "$text"
}

print_green() {
    local text="$1"
    printf '\033[0;32m%s\033[0m\n' "$text"
}

print_red() {
    local text="$1"
    printf '\033[0;31m%s\033[0m\n' "$text"
}

clear_screen() {
    # clear
    printf '\033c'
}

check_dns() {
    local domain="${1}"
    local resolver="$2"
    local ip

    if [ -n "$resolver" ]; then
        ip=$(nslookup "$domain" "$resolver" 2>/dev/null | awk '/^Address: / {print $2}' | tail -n1)
    else
        ip=$(nslookup "$domain" 2>/dev/null | awk '/^Address: / {print $2}' | tail -n1)
    fi

    if [ -n "$ip" ]; then
        return 0
    else
        return 1
    fi
}

check_icmp() {
    local target="${1}"
    local count="${2}"
    local timeout=3

    if ping -c "$count" -W "$timeout" "$target" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

info_openwrt() {
   grep OPENWRT_RELEASE /etc/os-release | cut -d'"' -f2 || echo "${NO_DATA_STRING}"
}

info_device() {
    [ -f /tmp/sysinfo/model ] && cat /tmp/sysinfo/model || echo "${NO_DATA_STRING}"
}

banner() {
   local model openwrt
    model=$(info_device)
    openwrt=$(info_openwrt)
    print_bold_yellow "---------------------"
    print_bold_yellow "JustClash Init Script"
    print_bold_yellow "---------------------"
    print_bold_yellow "OpenWRT:      ${openwrt}"
    print_bold_yellow "Device model: ${model}"
    echo "   "
}

diagnostic_tools() {
    local ii_nft ii_logread ii_curl ii_opkg ii_apk

    is_installed nft
    ii_nft=$?
    is_installed logread
    ii_logread=$?
    is_installed curl
    ii_curl=$?
    is_installed opkg
    ii_opkg=$?
    is_installed apk
    ii_apk=$?

    echo "  "
    print_bold_green "Checking toolchain..."
    echo " - apk command:  $( [ "$ii_opkg" -eq 0 ] && print_green "OK" || print_red "FAIL" )"
    echo " - opkg command:  $( [ "$ii_opkg" -eq 0 ] && print_green "OK" || print_red "FAIL" )"
    echo " - nft command:  $( [ "$ii_nft" -eq 0 ] && print_green "OK" || print_red "FAIL" )"
    echo " - curl: $( [ "$ii_curl" -eq 0 ] && print_green "OK" || print_red "FAIL" )"
    echo " - logread: $( [ "$ii_logread" -eq 0 ] && print_green "OK" || print_red "FAIL" )"

    if [ "$ii_apk" -ne 0 ]; then
        print_red "It appears you're using an OpenWRT SNAPSHOT version with the new package manager."
        print_red "Please install a stable firmware version — JustClash has not been tested with snapshots using the new manager."
        exit 1
    fi

    if [ "$ii_opkg" -ne 0 ] || [ "$ii_nft" -ne 0 ] || [ "$ii_curl" -ne 0 ] || [ "$ii_logread" -ne 0 ]; then
        print_red "One or more required basic tools (nft, curl, logread) are not available."
        print_red "This may indicate unsupported, incorrect, or custom firmware."
        print_red "Please verify your firmware and/or install the necessary packages."
        exit 1
    fi
}
diagnostic_net() {
    echo "  "
    print_bold_green "Checking network connectivity via ICMP..."
    echo "Checking with ${URL_CHECK_PING}..."
    check_icmp "${URL_CHECK_PING}" 4
    ping_res=$?
    echo " - Result: $( [ "$ping_res" -eq 0 ] && print_green "OK" || print_red "FAIL" )"

    echo "Checking with ${URL_CHECK_PING_BACKUP}..."
    check_icmp "${URL_CHECK_PING_BACKUP}" 4
    ping_res_backup=$?
    echo " - Result: $( [ "$ping_res_backup" -eq 0 ] && print_green "OK" || print_red "FAIL" )"

    echo "  "
    print_bold_green  "Checking domain resolution ..."

    echo "Testing ${URL_GITHUB} using the default nameserver..."
    check_dns "${URL_GITHUB}"
    dns_default_res=$?
    echo " - Result: $( [ "$dns_default_res" -eq 0 ] && print_green "OK" || print_red "FAIL" )"

    if [ "$dns_default_res" -ne 0 ]; then
        print_red "DNS resolution failed using the default nameserver."
        print_red "Possible causes: DNS misconfiguration in OpenWrt, ISP issues, or the domain ${URL_GITHUB} is blocked."
        print_red "Please check your DNS settings and restart this script, or install JustClash manually."
        exit 1
    fi

     if [ "$ping_res" -ne 0 ] && [ "$ping_res_backup" -ne 0 ]; then
        print_red "Network connectivity check failed (ICMP unreachable for both primary and backup targets)."
        print_red "Possible causes: no internet access, ISP issues, or ICMP traffic is blocked."
        print_red "Please check your network connection and try restarting this script, or install JustClash manually."
        exit 1
    fi
}

diagnostic_mem() {
    local overlay_space
    echo "  "
    print_bold_green "Checking memory requiments... "
    overlay_space=$(df /overlay | awk 'NR==2 {print $4}')
    if [ "$overlay_space" -lt "$MIN_SPACE" ]; then
        print_red "Warning: Available disk space is below the required minimum of ${MIN_SPACE}."
        print_red "Installation cannot proceed due to insufficient space."
        exit 1
    fi
}

# TODO: Fix error handling with unsupported platform
detect_arch() {
    local arch_raw
    arch_raw=$(uname -m)

    case "$arch_raw" in
        x86_64) echo "amd64";;
        aarch64) echo "arm64" ;;
        armv5*) echo "armv5" ;;
        armv6*) echo "armv6" ;;
        armv7l) echo "armv7" ;;
        arm*) echo "armv6" ;;
        mips64) echo "mips64" ;;
        mips64el | mips64le) echo "mips64le" ;;
        loong64) echo "loong64-abi2" ;;
        riscv64) echo "riscv64" ;;
        ppc64le) echo "ppc64le" ;;
        s390x) echo "s390x" ;;
        *)
            print_red "Unknown architecture: $arch_raw"
            return 1
            ;;
    esac
}

diagnostic_conflicts_interactive() {
    echo "  "
    print_bold_green "Checking conflicted packages..."
    echo " - https-dns-proxy"
    if opkg list-installed | grep -q https-dns-proxy; then
        print_red "Detected conflict with package: https-dns-proxy."
        print_red "Do you want to remove it? yes/no"

        while true; do
                read -r -p '' inp
                case $inp in
                    yes|y|Y|yes)
                        opkg remove --force-depends luci-app-https-dns-proxy https-dns-proxy luci-i18n-https-dns-proxy*
                        break
                        ;;
                    *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    fi

    echo " - podkop"
    if opkg list-installed | grep -q podkop; then
        print_red "Conflict detected with package: podkop."
        print_red "JustClash and Podkop are both TPROXY software of the same type."
        print_red "You must use only one of them."
        print_red "Do you want to remove Podkop? yes/no"

        while true; do
                read -r -p '' inpp
                case $inpp in
                yes|y|Y|yes)
                    opkg remove --force-depends luci-app-podkop podkop luci-i18n-podkop*
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    fi
}

get_latest_version() {
    local latest_url latest_ver latest_tag
    latest_url=$(curl -sL -o /dev/null -w '%{url_effective}' "$CORE_LATEST_RELEASE_URL")
    latest_tag=$(echo "$latest_url" | awk -F'/tag/' '{print $2}')
    latest_ver=$(curl -sL -# "${CORE_RELEASE_URL_PARTIAL}/${latest_tag}/version.txt" | tr -d '\r\n')

    echo "${latest_tag}"
    echo "${latest_ver}"
}

core_download() {
    local arch version file_name base_url param_tag param_version
    param_tag="$2"
    param_version="$1"

    arch=$(detect_arch) || return 1

    echo "- Downloading to ${TMP_DOWNLOAD_PATH}/mihomo.gz"

    if [ -n "$param_version" ]; then
        file_name="mihomo-linux-${arch}-${param_version}.gz"
        base_url="${CORE_RELEASE_URL_PARTIAL}/${param_version}/${file_name}"
    else
        tmp=$(get_latest_version)
        version=$(echo "$tmp" | sed -n 2p)
        file_name="mihomo-linux-${arch}-${version}.gz"
        base_url="${CORE_RELEASE_URL_PARTIAL}/${version}/${file_name}"
    fi

    print_bold_green "${base_url}"
    curl -sL -# -o "$TMP_DOWNLOAD_PATH/mihomo.gz" "$base_url" || {
        print_red "Failed to download file."
    }

    echo " - Extracting to ${CORE_PATH}/${CORE_BIN_NAME}"
    gunzip -c "$TMP_DOWNLOAD_PATH/mihomo.gz" > "${CORE_PATH}/${CORE_BIN_NAME}" || {
        print_red "Failed to extract file."
    }

    chmod +x "${CORE_PATH}/${CORE_BIN_NAME}"

    echo " - Cleaning up temporary files"
    rm -f "$TMP_DOWNLOAD_PATH/mihomo.gz"

    print_green "--> Mihomo installed to ${CORE_PATH}/${CORE_BIN_NAME}"
}

core_info() {
    if [ ! -x "$CORE_PATH/${CORE_BIN_NAME}" ]; then
        echo "${NO_DATA_STRING}"
    else
       "${CORE_PATH}/${CORE_BIN_NAME}" -v 2>/dev/null | head -n1 | awk '{ print $3 }'
    fi
}

core_update() {
    local cur_ver latest_ver tmp latest_tag

    echo "  "
    print_bold_green "Checking mihomo proxy..."

    cur_ver=$(core_info)
    tmp=$(get_latest_version)
    latest_tag=$(echo "$tmp" | sed -n 1p)
    latest_ver=$(echo "$tmp" | sed -n 2p)

    if [ -z "$latest_tag" ] || [ -z "$latest_ver" ]; then
        print_red "Error happened when tried to receive latest version data"
        exit 1
    fi

    if [ "$cur_ver" = "$NO_DATA_STRING" ] || [ -z "$cur_ver" ]; then
        echo " - Mihomo is not installed. Installing version $latest_ver."
        core_download "${latest_ver}" "${latest_tag}" || return 1
        return 0
    fi

    echo " - Current Mihomo version: $cur_ver"
    echo " - Latest Mihomo version: $latest_ver"

    if [ "$cur_ver" != "$latest_ver" ]; then
        echo " - Updating Mihomo to version $latest_ver"
        core_download "${latest_ver}" "${latest_tag}" || return 1
    else
        print_bold_green "Mihomo is already up-to-date."
    fi
}

justclash_install() {
    print_red "Not implemented yet"
}

install() {

    mkdir -p "${TMP_DOWNLOAD_PATH}"
    mkdir -p "${CORE_PATH}"

    diagnostic_tools

    if [ "$FLAG_DISABLE_DIAGNOSTIC" -ne 1 ]; then
        diagnostic_net
        diagnostic_mem
        diagnostic_conflicts_interactive
    fi

    if [ "$FLAG_INSTALL_WITHOUT_MIHOMO_CORE" -ne 1 ]; then
        core_update
    fi
    # justclash_download
}

# TODO: Finish uninstall
uninstall() {
    print_red "Not implemented yet"
}

# TODO: Finish install
justclash_install() {
    print_red "Not implemented yet"
}

init() {
    banner
    print_bold_yellow "JustClash Setup Menu"
    print_bold_yellow "1 - Install JustClash script"
    print_bold_yellow "2 - Uninstall JustClash script"
    print_bold_yellow "3 - Update/Download latest Mihomo Clash core"
    print_bold_yellow "4 - Exit"
    while true; do
       read -p -r "Enter your choice [1-4]: " choice
       case "$choice" in
            1)
                echo "Installing JustClash..."
                install
                ;;
            2)
                echo "Uninstalling JustClash..."
                uninstall
                ;;
            3)
                echo "Updating Mihomo Clash core..."
                core_update
                ;;
            4)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo "Invalid option. Please enter a number between 1 and 4."
                ;;
        esac
    done
}

init

for arg in "$@"; do
    # shellcheck disable=SC2249
    case "$arg" in
        --disable_diagnostic)
            FLAG_DISABLE_DIAGNOSTIC=1
            ;;
        --install-without-mihomo-core)
            FLAG_INSTALL_WITHOUT_MIHOMO_CORE=1
            ;;
    esac
done