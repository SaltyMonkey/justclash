#!/bin/sh
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version signature (kind of similar)
# shellcheck shell=dash
CORE_RELEASE_URL_PARTIAL="https://github.com/metacubex/mihomo/releases/latest/download"
CORE_RELEASE_URL_PARTIAL_NO_TAG="https://github.com/metacubex/mihomo/releases/download"
CORE_ALPHA_RELEASE_URL_PARTIAL="https://github.com/metacubex/mihomo/releases/download/Prerelease-Alpha"
JUSTCLASH_RELEASE_URL_API="https://api.github.com/repos/SaltyMonkey/justclash-owrt/releases/latest"

URL_GITHUB="github.com"
URL_CHECK_PING="77.88.8.8"
URL_CHECK_PING_BACKUP="8.8.8.8"
MIN_SPACE=34768
NO_DATA_STRING="N/A"
CORE_BIN_NAME="mihomo"
CORE_PATH="/usr/bin/${CORE_BIN_NAME}"
TMP_DOWNLOAD_PATH="/tmp/justclash/downloads"

rm -rf "$TMP_DOWNLOAD_PATH"
mkdir -p "$TMP_DOWNLOAD_PATH"

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
        echo "${ip}"
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

info_mihomo() {
    if [ ! -x "$CORE_PATH" ]; then
        echo "$NO_DATA_STRING"
    else
        "$CORE_PATH" -v 2>/dev/null | head -n1 | awk '{ print $3 }'
    fi
}

is_bin_installed() {
    command -v "$1" >/dev/null 2>&1
}

banner() {
    local model openwrt
    model=$(info_device)
    openwrt=$(info_openwrt)
    print_bold_yellow "-----------------------------"
    print_bold_yellow "    JustClash Init Script"
    print_bold_yellow "-----------------------------"
    print_bold_yellow "System:      ${openwrt}"
    print_bold_yellow "Device model: ${model}"
    print_bold_yellow "-----------------------------"
    echo "   "
}

pkg_is_installed() {
    local pkg="$1"

    if [ -z "$pkg" ]; then
        echo "Usage: pkg_is_installed <package_name>"
        return 1
    fi

    if is_bin_installed apk; then
        apk info | grep -qw "$pkg"
    else
        opkg list-installed | grep -qw "$pkg"
    fi
}

pkg_remove() {
    local pkg="$1"

    if [ -z "$pkg" ]; then
        echo "Usage: pkg_remove <package_name>"
        return 1
    fi

    if is_bin_installed apk; then
        apk del "$pkg"
    else
        opkg remove --force-depends "$pkg"
    fi
}

pkg_install() {
    local pkg_file
    pkg_file="$1"

    if [ -z "$pkg_file" ]; then
        echo "Usage: pkg_install <package_file.ipk/apk>"
        return 1
    fi

    if is_bin_installed apk; then
        apk add --allow-untrusted "$pkg_file"
    else
        opkg install --force-reinstall "$pkg_file"
    fi
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
        exit 1
    fi
}

diagnostic_net() {
    echo "  "
    print_bold_green "Checking network connectivity via ICMP..."
    echo "Checking with ${URL_CHECK_PING}..."
    check_icmp "${URL_CHECK_PING}" 4
    ping_res=$?

    printf " - Result: "
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

    printf " - Result: "
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
        printf " - Result: "
        print_red "FAIL"
        print_red "Warning: Available disk space is below the required minimum of ${MIN_SPACE}."
        print_red "Installation cannot proceed due to insufficient space."
        exit 1
    else
        printf " - Result: "
        print_green "OK"
    fi
}

diagnostic_conflicts_interactive() {
    echo "  "
    print_bold_green "Checking conflicted packages..."

    printf " - https-dns-proxy "
    if pkg_is_installed https-dns-proxy; then
        print_red "DETECTED!"
        print_red "Detected conflict with package: https-dns-proxy."
        print_red "Do you want to remove it? yes/no"

        while true; do
                read -r inp
                case $inp in
                    yes|y|Y)
                        pkg_remove luci-app-https-dns-proxy
                        pkg_remove https-dns-proxy
                        pkg_remove luci-i18n-https-dns-proxy*
                        break
                        ;;
                    *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    printf " - podkop "
    if pkg_is_installed podkop; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: podkop."
        print_red "JustClash and Podkop are both TPROXY software of the same type."
        print_red "You should use only one of them."
        print_red "Do you want to remove Podkop? yes/no"

        while true; do
                read -r inpp
                case $inpp in
                yes|y|Y)
                    pkg_remove luci-app-podkop
                    pkg_remove podkop
                    pkg_remove luci-i18n-podkop*
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    printf " - luci-app-ssclash "
    if pkg_is_installed luci-app-ssclash; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: luci-app-ssclash ."
        print_red "JustClash and luci-app-ssclash are both TPROXY software of the same type."
        print_red "You should use only one of them."
        print_red "Do you want to remove luci-app-ssclash? yes/no"

        while true; do
                read -r inpp
                case $inpp in
                yes|y|Y)
                    pkg_remove luci-app-ssclash
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    printf " - mihomo "
    if pkg_is_installed mihomo; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: mihomo."
        print_red "JustClash already managing mihomo binary."
        print_red "You should use only one of them."
        print_red "Do you want to remove mihomo? yes/no"

        while true; do
                read -r inpp
                case $inpp in
                yes|y|Y)
                    pkg_remove mihomo
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    printf " - sing-box "
    if pkg_is_installed sing-box; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: sing-box."
        print_red "JustClash and sing-box are both TPROXY software of the same type."
        print_red "You should use only one of them."
        print_red "Do you want to remove sing-box? yes/no"

        while true; do
                read -r inpp
                case $inpp in
                yes|y|Y)
                    pkg_remove sing-box
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    printf " - passwall "
    if pkg_is_installed luci-app-passwall; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: luci-app-passwall."
        print_red "JustClash and luci-app-passwall are both proxy software of the same type."
        print_red "You should use only one of them."
        print_red "Do you want to remove luci-app-passwall? yes/no"

        while true; do
                read -r inpp
                case $inpp in
                yes|y|Y)
                    pkg_remove luci-app-passwall
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    printf " - passwall2 "
    if pkg_is_installed luci-app-passwall2; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: luci-app-passwall2."
        print_red "JustClash and luci-app-passwall are both proxy software of the same type."
        print_red "You should use only one of them."
        print_red "Do you want to remove luci-app-passwall2? yes/no"

        while true; do
                read -r inpp
                case $inpp in
                yes|y|Y)
                    pkg_remove luci-app-passwall2
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    printf " - banip "
    if pkg_is_installed banip; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: banip."
        print_red "JustClash and luci-app-passwall are both proxy software of the same type."
        print_red "You should use only one of them."
        print_red "Do you want to remove banip? yes/no"

        while true; do
                read -r inpp
                case $inpp in
                yes|y|Y)
                    pkg_remove banip
                    pkg_remove luci-app-banip
                    break
                    ;;
                *)
                    echo "Exit"
                    exit 1
                    ;;
                esac
        done
    else
        print_green "NOT FOUND"
    fi

    echo " "
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
    local latest_ver
    latest_ver=$(wget -qO- "$check_url/version.txt" | tr -d '\r\n')
    echo "$latest_ver"
}

core_download() {
    local arch version file_name base_url param_version download_url
    param_version="$2"
    download_url="$1"

    if [ -z "$1" ] || [ -z "$2" ]; then
        print_red "Usage: core_download <download_url> <version>"
        return 1
    fi

    arch=$(detect_arch)
    mkdir -p "$TMP_DOWNLOAD_PATH"

    file_name="mihomo-linux-${arch}-${param_version}.gz"
    base_url="${download_url}/${file_name}"

    echo " - Downloading mihomo binary"
    wget -qO "$TMP_DOWNLOAD_PATH/mihomo.gz" "$base_url" || {
        print_red "Failed to download file."
        exit 1
    }

    echo " - Extracting to $CORE_PATH"
    gunzip -c "$TMP_DOWNLOAD_PATH/mihomo.gz" > "$CORE_PATH" || {
        print_red "Failed to extract file."
        exit 1
    }

    echo " - Mihomo installed at $CORE_PATH"

    if ! chmod +x "$CORE_PATH"; then
        print_red "Failed to set executable permissions: $CORE_PATH"
    fi

    echo " - Cleaning up temporary files" "🧹"
    if ! rm -f "$TMP_DOWNLOAD_PATH/mihomo.gz"; then
        print_red "Failed to clean up temporary file: $TMP_DOWNLOAD_PATH/mihomo.gz"
    fi
}

core_update() {
    local channel="$1"
    local cur_ver latest_ver tmp
    local check_url download_url

    rm -rf "$TMP_DOWNLOAD_PATH"

    print_bold_green "Checking for Mihomo updates..."

    if [ "$channel" = "alpha" ]; then
        check_url=$CORE_ALPHA_RELEASE_URL_PARTIAL
    else
        check_url=$CORE_RELEASE_URL_PARTIAL
    fi

    cur_ver=$(info_mihomo)
    if [ -z "$cur_ver" ]; then
        print_red "Update process can't be finished."
        exit 1
    fi

    tmp=$(get_latest_version "$check_url")
    if [ $? -eq 1 ]; then
        print_red "Update process can't be finished."
        exit 1
    fi

    #TODO: Fix incorrect output handle (github isnt returning empty body)
    latest_ver=$(echo "$tmp" | sed -n 1p)

    if [ "$channel" = "alpha" ]; then
        download_url=$CORE_ALPHA_RELEASE_URL_PARTIAL
    else
        download_url=$CORE_RELEASE_URL_PARTIAL_NO_TAG/$latest_ver
    fi

    if [ -z "$latest_ver" ]; then
       print_red "Error happened when trying to receive latest version data."
       print_red "It may be due to a GitHub API rate limit or the release may not exist. Please check manually."
       print_red "Failed to download core"
       return 1
    fi

    if [ "$cur_ver" = "$NO_DATA_STRING" ] || [ -z "$cur_ver" ]; then
        echo " - Mihomo is not installed. Installing version $latest_ver."
        core_download "$download_url" "$latest_ver"
        if [ $? -eq 1 ]; then
            print_red "Update process can't be finished."
            return 1
        fi
        return 0
    fi

    echo " - Current Mihomo version: $cur_ver"
    echo " - Latest Mihomo version: $latest_ver"

    if [ "$cur_ver" != "$latest_ver" ]; then
        echo " - Removing current mihomo binary..."
        core_remove
        if [ $? -eq 1 ]; then
            print_red "Update process can't be finished."
            return 1
        fi
        echo " - Updating Mihomo to version $latest_ver"
        core_download "$download_url" "$latest_ver"
        if [ $? -eq 1 ]; then
            print_red "Update process can't be finished."
            return 1
        fi
    else
        echo " - Mihomo is already up-to-date."
    fi

    return 0
}

core_remove() {
    if [ ! -x "$CORE_PATH" ]; then
        print_red "Mihomo is already not installed."
        return 1
    else
        if rm -f "$CORE_PATH"; then
            echo " - Mihomo is removed."
            return 0
        else
            print_red "Failed to remove Mihomo binary: $CORE_PATH"
            return 1
        fi
    fi
}

justclash_install() {
    echo "  "
    print_bold_green "Installing JustClash packages..."
    opkg update
    local apk_file
    local ipk_file
    if is_bin_installed apk; then
        for apk_file in "$TMP_DOWNLOAD_PATH"/*.apk; do
            if [ -f "$apk_file" ]; then
                echo " - Installing $apk_file"
                pkg_install "$apk_file" || {
                    print_red "Failed to install $apk_file"
                    exit 1
                }
            fi
        done
        echo " - All new .apk packages installed."
    else
        for ipk_file in "$TMP_DOWNLOAD_PATH"/*.ipk; do
            if [ -f "$ipk_file" ]; then
                echo " - Installing $ipk_file"
                pkg_install "$ipk_file" || {
                    print_red "Failed to install $ipk_file"
                    exit 1
                }
            fi
        done
        echo " - All new .ipk packages installed."
    fi
}

justclash_uninstall() {
    local jc_is_installed lajc_is_installed laijc_is_installed
    echo "  "
    print_bold_green "Checking installed JustClash packages..."

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

    pkg_is_installed luci-i18n-justclash*
    laijc_is_installed="$?"
    if [ "$laijc_is_installed" -eq 0 ]; then
        echo " - LuCI i18n JustClash package was found. Removing..."
        pkg_remove luci-i18n-justclash*
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

justclash_download() {
    local install_ru="$1"
    if [ -z "$JUSTCLASH_RELEASE_URL_API" ] || [ -z "$TMP_DOWNLOAD_PATH" ]; then
        print_red "Usage: justclash_download_ipk requires JUSTCLASH_RELEASE_URL_API and TMP_DOWNLOAD_PATH to be set"
        return 1
    fi

    print_bold_green "Downloading justClash packages..."
    mkdir -p "$TMP_DOWNLOAD_PATH"
    local urls
    local file

    if is_bin_installed apk; then
        echo " - Fetching .apk links from latest JustClash release" "🔍"
        urls=$(wget -qO- "$JUSTCLASH_RELEASE_URL_API" | grep -o 'https://[^"[:space:]]*\.apk')
        if [ -z "$urls" ]; then
            print_red "No .apk files found in the latest release."
            return 1
        fi
        echo " - Found the following .apk files: ${urls}"
    else
        echo " - Fetching .ipk links from latest JustClash release" "🔍"
        urls=$(wget -qO- "$JUSTCLASH_RELEASE_URL_API" | grep -o 'https://[^"[:space:]]*\.ipk')
        if [ -z "$urls" ]; then
            print_red "No .ipk files found in the latest release."
            return 1
        fi
        echo " - Found the following .ipk files:"
        echo "${urls}"
    fi

    local file
    for file in $urls; do
        echo " - Downloading $file"
        #if [ "$install_ru" -eq 1 ] && echo "$file" | grep -q "i18n"; then
        #    echo " - Skipped $file"
        #    continue
        #fi
        wget "$file" -qO "$TMP_DOWNLOAD_PATH/$(basename "$file")" || {
            print_red "Failed to download $file"
            continue
        }
    done

    echo " - All files saved to $TMP_DOWNLOAD_PATH"
}

user_select_lang_install_mode_interactive() {
    print_bold_green "RU translation installation mode..."
    while true; do
            printf "Do you want to install RU translation? y/n: "
            read -r inp
            # shellcheck disable=SC2249
            case $inp in
                yes|y|Y)
                    return 0
                    ;;
                n|N|no)
                    return 1
                    ;;
            esac
    done
}

localuse_interactive() {
    print_bold_green "DNSMasq localuse flag setup..."
    echo "0 - router will resolve domains with WAN DNS servers. (Recommended)"
    echo "1 - router will resolve domains with itself. (Default)"
    echo "Router will be rebooted if setting will be applied"
    while true; do
            printf "Do you want to set dnsmasq localuse mode to '0'? y/n: "
            read -r inp
            # shellcheck disable=SC2249
            case $inp in
                yes|y|Y)
                    uci set dhcp.@dnsmasq[0].localuse='0'
                    uci commit dhcp
                    reboot
                    exit 0
                    ;;
                n|N|no)
                    echo "Skipped."
                    exit 0
                    ;;
            esac
    done
}

install_service() {
    mkdir -p "$TMP_DOWNLOAD_PATH"
    diagnostic_tools
    diagnostic_net
    diagnostic_mem
    diagnostic_conflicts_interactive
    core_update "alpha"
    #user_select_lang_install_mode_interactive
    #if [ $? -ne 1 ]; then
        justclash_download 1
    #else
    #    justclash_download 0
    #fi
    if [ $? -ne 1 ]; then
        justclash_install
    fi
    localuse_interactive
}

uninstall_service() {
    justclash_uninstall
    core_remove
}

diagnostic() {
    diagnostic_tools
    diagnostic_net
    diagnostic_mem
    diagnostic_conflicts_interactive
}

run() {
    clear_screen
    banner
    print_bold_yellow "JustClash Setup Menu"
    print_bold_yellow "1 - Install JustClash package"
    print_bold_yellow "2 - Uninstall JustClash package"
    print_bold_yellow "3 - Update/Download latest proxy core"
    print_bold_yellow "4 - Run diagnostic"
    print_bold_yellow "5 - Exit"
    while true; do
        printf "Enter your choice [1-6]: "
        read -r choice
       case "$choice" in
            1)
                echo "Installing JustClash..."
                install_service
                ;;
            2)
                echo "Uninstalling JustClash..."
                uninstall_service
                ;;
            3)
                echo "Updating Mihomo Clash core..."
                core_update "alpha"
                ;;
            4)
                echo "Starting diagnostic..."
                diagnostic
                ;;
            5)
                echo "Starting DNSMasq localuse flag setup..."
                diagnostic
                ;;
            6)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo "Invalid option. Please enter a number between 1 and 6."
                ;;
        esac
    done
}

run
