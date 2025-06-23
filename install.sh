#!/bin/sh
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version signature (kind of similar)
# shellcheck shell=dash
CORE_LATEST_RELEASE_URL="https://api.github.com/repos/metacubex/mihomo/releases/latest"
CORE_LATEST_ALPHA_RELEASE_URL="https://api.github.com/repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha"
CORE_RELEASE_URL_PARTIAL="https://github.com/metacubex/mihomo/releases/download"
CORE_ALPHA_RELEASE_URL_PARTIAL="https://github.com/metacubex/mihomo/releases/download/Prerelease-Alpha"

URL_GITHUB="github.com"

URL_CHECK_PING="77.88.8.8"
URL_CHECK_PING_BACKUP="8.8.8.8"
MIN_SPACE=34768
NO_DATA_STRING="N/A"
CORE_BIN_NAME="mihomo"
CORE_PATH="/usr/bin/${CORE_BIN_NAME}"

TMP_DOWNLOAD_PATH="/tmp/justclash/downloads"

#Flags
FLAG_INSTALL_WITHOUT_MIHOMO_CORE=0
FLAG_DISABLE_DIAGNOSTIC=0

rm -rf "$TMP_DOWNLOAD_PATH"
mkdir -p "$TMP_DOWNLOAD_PATH"

is_bin_installed() {
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
    local timeout=2

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
    local ii_nft ii_logread ii_opkg ii_apk

    is_bin_installed nft
    ii_nft=$?
    is_bin_installed logread
    ii_logread=$?
    is_bin_installed opkg
    ii_opkg=$?
    is_bin_installed apk
    ii_apk=$?

    echo "  "
    print_bold_green "Checking toolchain..."

    printf " - apk command:  "
    if [ "$ii_apk" -eq 0 ]; then
        print_green "OK"
    else
        print_red "FAIL"
    fi

    printf " - opkg command:  "
    if [ "$ii_opkg" -eq 0 ]; then
        print_green "OK"
    else
        print_red "FAIL"
    fi

    printf " - nft command:  "
    if [ "$ii_nft" -eq 0 ]; then
        print_green "OK"
    else
        print_red "FAIL"
    fi

    printf " - logread: "
    if [ "$ii_logread" -eq 0 ]; then
        print_green "OK"
    else
        print_red "FAIL"
    fi

    if [ "$ii_nft" -ne 0 ] || [ "$ii_logread" -ne 0 ]; then
        print_red "One or more required basic tools (nft, logread) are not available."
        print_red "This may indicate unsupported, incorrect, or custom OpenWRT firmware."
        print_red "Please verify your firmware and/or install the necessary packages."
        exit 1
    fi

    if [ "$ii_apk" -eq 1 ] && [ "$ii_opkg" -eq 1 ]; then
        print_red "All package managers are missing."
        print_red "This may indicate unsupported, incorrect, or broken OpenWRT firmware."
        print_red "Please verify your firmware and/or install the necessary packages."
    fi
}

diagnostic_net() {
    echo "  "
    print_bold_green "Checking network connectivity via ICMP..."
    echo "Checking with ${URL_CHECK_PING}..."
    check_icmp "${URL_CHECK_PING}" 4
    ping_res=$?


    if [ "$ping_res" -eq 0 ]; then
       print_green "OK"
    else
       print_red "FAIL"
    fi

    echo "Checking with ${URL_CHECK_PING_BACKUP}..."
    check_icmp "${URL_CHECK_PING_BACKUP}" 4
    ping_res_backup=$?

    printf " - Result: "
    if [ "$ping_res_backup" -eq 0 ]; then
        print_green "OK"
    else
        print_red "FAIL"
    fi

    echo "  "
    print_bold_green  "Checking domain resolution ..."

    echo "Testing ${URL_GITHUB} using the default nameserver..."
    check_dns "${URL_GITHUB}"
    dns_default_res=$?
    if [ "$dns_default_res" -eq 0 ]; then
        print_green "OK"
    else
        print_red "FAIL"
    fi

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
                    yes|y|Y)
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
                yes|y|Y)
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

core_info() {
    if [ ! -x "$CORE_PATH" ]; then
        echo "${NO_DATA_STRING}"
    else
       "${CORE_PATH}" -v 2>/dev/null | head -n1 | awk '{ print $3 }'
    fi
}

detect_arch() {
    local arch_raw
    arch_raw=$(uname -m)

    case "$arch_raw" in
        x86_64) echo "amd64";;
        aarch64) echo "arm64" ;;
        armv5*) echo "armv5" ;;
        armv6*) echo "armv6" ;;
        armv7*) echo "armv7" ;;
        mips*) echo "mips" ;;
        #riscv64) echo "riscv64" ;;
        i[3-6]86) echo "i386" ;;
        *)
            print_red "Unknown or unsupported architecture: $arch_raw"
            exit 1
            ;;
    esac
}

get_latest_version() {
    local check_url="$1"
    local latest_url latest_ver
    latest_url=$(curl -sL -o /dev/null -w '%{url_effective}' "$check_url")
    latest_ver=$(curl -sL "$latest_url/version.txt" | tr -d '\r\n')
    echo "$latest_ver"
}

core_download() {
    local arch file_name base_url param_version download_url
    param_version="$2"
    download_url="$1"

    print_bold_green "Downloading Mihomo binary..."

    mkdir -p "$TMP_DOWNLOAD_PATH"

    file_name="mihomo-linux-${arch}-${param_version}.gz"
    base_url="${download_url}/${file_name}"

    echo "Downloading mihomo binary"
    curl -sL -o "${TMP_DOWNLOAD_PATH}/mihomo.gz" "$base_url" || {
        echo "Failed to download file."
        exit 1
    }

    echo "Extracting to $CORE_PATH"
    gunzip -c "${TMP_DOWNLOAD_PATH}/mihomo.gz" > "$CORE_PATH" || {
        echo "Failed to extract file."
        exit 1
    }

    chmod +x "$CORE_PATH"

    echo "Cleaning up temporary files"
    rm -f "${TMP_DOWNLOAD_PATH}/mihomo.gz"

    print_green "Mihomo installed at $CORE_PATH"
}

core_update() {
    local cur_ver latest_ver tmp mihomo_update_channel
    mihomo_update_channel="$1"
    local check_url download_url

    print_bold_green "Checking for Mihomo updates..."

    if [ "$mihomo_update_channel" = "alpha" ]; then
        check_url=$CORE_LATEST_ALPHA_RELEASE_URL
    else
        check_url=$CORE_LATEST_RELEASE_URL
    fi

    cur_ver=$(info_mihomo)
    tmp=$(get_latest_version "$check_url")
    latest_ver=$(echo "$tmp" | sed -n 1p)

    if [ "$mihomo_update_channel" = "alpha" ]; then
        download_url=$CORE_ALPHA_RELEASE_URL_PARTIAL
    else
        download_url=$CORE_RELEASE_URL_PARTIAL/$latest_ver
    fi

    if [ -z "$latest_ver" ]; then
       print_red "Error happened when trying to receive latest version data."
       print_red "It may be due to a GitHub API rate limit or the release may not exist. Please check manually."
       print_red "Failed to download core"
       exit 1
    fi

    if [ "$cur_ver" = "$NO_DATA_STRING" ] || [ -z "$cur_ver" ]; then
        echo "Mihomo is not installed. Installing version $latest_ver."
        core_download "$download_url" "$latest_ver" || return 1
        return 0
    fi

    echo "Current Mihomo version: $cur_ver"
    echo "Latest Mihomo version: $latest_ver"

    if [ "$cur_ver" != "$latest_ver" ]; then
        echo "Removing current mihomo binary..."
        core_remove
        echo "Updating Mihomo to version $latest_ver"
        core_download "$download_url" "$latest_ver" || return 1
    else
        print_green "Mihomo is already up-to-date."
    fi
}

core_remove() {
    if [ ! -x "$CORE_PATH" ]; then
        print_green "Mihomo is not installed."
        return 1
    else
        rm -f "$CORE_PATH"
        print_green "Mihomo is removed."
        return 0
    fi
}


pkg_is_installed() {
    local pkg
    local pkgcommand=""
    pkg="$1"

    if command -v apk >/dev/null 2>&1; then
        pkgcommand="apk info"
    else
        pkgcommand="opkg list-installed"
    fi

    if $pkgcommand | grep -qw "$pkg"; then
        return 0
    else
        return 1
    fi
}

pkg_remove() {
    local pkg
    local pkgcommand=""
    pkg="$1"

    if command -v apk >/dev/null 2>&1; then
        pkgcommand="apk remove "
    else
        pkgcommand="opkg remove --force-depends "
    fi

    $pkgcommand "$pkg"
}

justclash_download() {
    print_red "NOT IMPLEMENTED YET"
    exit 1;
}

install() {

    mkdir -p "${TMP_DOWNLOAD_PATH}"

    diagnostic_tools

    if [ "$FLAG_DISABLE_DIAGNOSTIC" -ne 1 ]; then
        diagnostic_net
        diagnostic_mem
        diagnostic_conflicts_interactive
    fi

    if [ "$FLAG_INSTALL_WITHOUT_MIHOMO_CORE" -ne 1 ]; then
        core_update "alpha"
    fi

    justclash_download
}

# TODO: Finish uninstall
uninstall() {
    local jc_is_installed lajc_is_installed
    echo "  "
    print_bold_green "Uninstalling everything..."

    pkg_is_installed justclash
    jc_is_installed="$?"
    if [ "$jc_is_installed" -eq 0 ]; then
        echo " - JustClash package was found. Removing..."
        pkg_remove justclash
    fi
    pkg_is_installed luci-app-justclash
    lajc_is_installed="$?"
    if [ "$lajc_is_installed" -eq 0 ]; then
        echo " - LuCI JustClash package was found. Removing..."
        pkg_remove luci-app-justclash
    fi

    if [ "$jc_is_installed" -ne 0 ] && [ "$lajc_is_installed" -ne 0 ]; then
        echo " - JustClash was not found. Was it already installed before?"
        echo " - Cleaning up known JustClash folders and files"
        rm -rf /usr/bin/justclash
        rm -rf /usr/bin/mihomo
        rm -rf /tmp/justclash/
        rm -rf /etc/init.d/justclash
    fi
}

# TODO: Finish install
justclash_install() {
    print_red "Not implemented yet"
}

run() {
    banner
    print_bold_yellow "JustClash Setup Menu"
    print_bold_yellow "1 - Install JustClash package"
    print_bold_yellow "2 - Uninstall JustClash package"
    print_bold_yellow "3 - Update/Download latest proxy core"
    print_bold_yellow "4 - Run network diagnostic"
    print_bold_yellow "5 - Exit"
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
                core_update "alpha"
                ;;
            5)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo "Invalid option. Please enter a number between 1 and 4."
                ;;
        esac
    done
}

run

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