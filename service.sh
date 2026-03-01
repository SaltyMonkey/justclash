#!/bin/sh
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version signature (kind of similar)
# shellcheck shell=dash
CORE_RELEASE_CHECK_URL="https://api.github.com/repos/MetaCubeX/mihomo/releases/latest"
JUSTCLASH_RELEASE_URL_API="https://api.github.com/repos/SaltyMonkey/justclash/releases/latest"

CURL_CONNECT_TIMEOUT=15
CURL_MIN_SPEED_LIMIT_BYTES=5000
CURL_MIN_SPEEED_TIMEOUT=15

CHECK_SPACE=1

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

get_os_arch() {
    grep OPENWRT_ARCH /etc/os-release | cut -d'"' -f2 || echo "${NO_DATA_STRING}"
}

get_os_version() {
    grep OPENWRT_RELEASE /etc/os-release | awk '{print $2}'
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
    openwrt=$(get_os_version)
    print_bold_yellow "-----------------------------"
    print_bold_yellow "    JustClash Setup Script"
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

pkg_list_update() {
    if is_bin_installed apk; then
        apk update
    else
        opkg update
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
        print_red "This may indicate unsupported, incorrect, or custom OpenWrt firmware."
        print_red "Please verify your firmware and/or install the necessary packages."
        exit 1
    fi

    if [ "$ii_apk" -eq 1 ] && [ "$ii_opkg" -eq 1 ]; then
        print_red "All package managers are missing."
        print_red "This may indicate unsupported, incorrect, or broken OpenWrt firmware."
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
    print_bold_green  "Checking domain resolution..."

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
    local is_just_check=0
    [ -n "${1}" ] && is_just_check=1
    echo "  "
    print_bold_green "Checking memory requirements..."
    overlay_space=$(df /overlay | awk 'NR==2 {print $4}')
    if [ "$overlay_space" -lt "$MIN_SPACE" ]; then
        printf " - Result: "
        print_red "FAIL"
        print_red "Available disk space is below the required minimum of ${MIN_SPACE}."
        print_red "Installation cannot proceed due to insufficient space."
        [ "$is_just_check" -eq 0 ] && exit 1
    else
        printf " - Result: "
        print_green "OK"
    fi
}

diagnostic_conflict() {
    local pkg_name="$1"

    printf " - %s " "$pkg_name"
    if pkg_is_installed "$pkg_name"; then
        print_red "DETECTED!"
        print_red "Conflict detected with package: $pkg_name."
        print_red "You should remove it before installing JustClash."
        print_red "Do you want to remove $pkg_name? yes/no"

        while true; do
            read -r inp
            inp=$(echo "$inp" | tr '[:upper:]' '[:lower:]')
            case $inp in
                yes|y)
                    pkg_remove "$pkg_name"
                    break
                    ;;
                *)
                    echo "Exiting."
                    exit 1
                    ;;
            esac
        done
    else
        print_green "NOT FOUND"
    fi
    printf "\n"
}

diagnostic_conflicts_interactive() {
    echo "  "
    print_bold_green "Checking conflicting packages..."

    diagnostic_conflict "https-dns-proxy"
    diagnostic_conflict "podkop"
    diagnostic_conflict "luci-app-ssclash"
    diagnostic_conflict "mihomo"
    diagnostic_conflict "sing-box"
    diagnostic_conflict "luci-app-passwall"
    diagnostic_conflict "luci-app-passwall2"
    diagnostic_conflict "banip"

    echo " "
}

detect_arch() {
    local arch_raw
    arch_raw=$(get_os_arch)

    case "$arch_raw" in
        aarch64_*) echo "arm64" ;;
        mips_*)
            if [ "${arch_raw#*hardfloat}" != "$arch_raw" ]; then
                echo "mips-hardfloat"
            else
                echo "mips-softfloat"
            fi
            ;;
        mipsel_*)
            if [ "${arch_raw#*hardfloat}" != "$arch_raw" ]; then
                echo "mipsle-hardfloat"
            else
                echo "mipsle-softfloat"
            fi
            ;;
        mips64_*) echo "mips64" ;;
        mips64el_*) echo "mips64le" ;;
        x86_64) echo "amd64-v3" ;;
        i386_*) echo "386" ;;
        riscv64_*) echo "riscv64" ;;
        loongarch64_*) echo "loong64-abi2" ;;
        *_neon-vfp*) echo "armv7" ;;
        *_neon* | *_vfp*) echo "armv6" ;;
        arm_*) echo "armv5" ;;
        *) echo "amd64-v3" ;;
    esac
}

get_latest_version_url() {
    local check_url="$1" channel="${2:-stable}"
    local api_url jq_filter

    if [ "$channel" = "alpha" ]; then
        api_url="${check_url%/latest}"
        jq_filter='[.[] | select(.tag_name == "Prerelease-Alpha")][0].assets[] | select(.name == "version.txt") | .browser_download_url'
    else
        api_url="$check_url"
        jq_filter='.assets[] | select(.name == "version.txt") | .browser_download_url'
    fi

    curl --connect-timeout "$CURL_CONNECT_TIMEOUT" \
        --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" \
        --speed-time "$CURL_MIN_SPEEED_TIMEOUT" \
        -sL "$api_url" | jq -r "$jq_filter"
}

core_update() {
    local cur_ver latest_ver version_txt_url
    local check_url channel
    channel=${1}
    check_url="$CORE_RELEASE_CHECK_URL"

    cur_ver=$(info_mihomo)

    echo " - Checking for Mihomo updates (channel: $channel)..."

    version_txt_url=$(get_latest_version_url "$check_url" "$channel") || {
        print_red "Failed to get the version.txt URL from the GitHub API."
        return 1
    }

    if [ -z "$version_txt_url" ]; then
        print_red "Release asset version.txt was not found."
        print_red "This may be caused by a GitHub API rate limit or a missing release. Please check manually."
        return 1
    fi

    latest_ver=$(curl --connect-timeout "$CURL_CONNECT_TIMEOUT" \
        --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" \
        --speed-time "$CURL_MIN_SPEEED_TIMEOUT" \
        -sL "$version_txt_url" | tr -d '\r\n' | sed -n 1p) || {
        print_red "Failed to download version.txt."
        return 1
    }

    if [ -z "$latest_ver" ]; then
       print_red "Failed to retrieve the latest version information."
       print_red "This may be caused by a GitHub API rate limit or a missing release. Please check manually."
       return 1
    fi

    if [ "$cur_ver" = "$NO_DATA_STRING" ] || [ -z "$cur_ver" ]; then
        echo " - Mihomo is not installed. Installing version $latest_ver ($channel)."
        core_download "$version_txt_url" "$latest_ver"
        if [ $? -eq 1 ]; then
            print_red "Core update failed."
            return 1
        fi
        return 0
    fi

    echo " - Current Mihomo version: $cur_ver"
    echo " - Latest Mihomo version ($channel): $latest_ver"

    if [ "$cur_ver" != "$latest_ver" ]; then
        echo " - Removing current mihomo binary..."
        core_remove
        if [ $? -eq 1 ]; then
            print_red "Core update failed."
            return 1
        fi

        echo " - Updating Mihomo to version $latest_ver ($channel)"
        core_download "$version_txt_url" "$latest_ver"
        if [ $? -eq 1 ]; then
            print_red "Core update failed."
            return 1
        fi
    else
        echo " - Mihomo is already up-to-date."
    fi

    return 0
}

core_download() {
    local arch file_name base_url param_version version_txt_url download_url
    version_txt_url="$1"
    param_version="$2"

    arch=$(detect_arch)
    mkdir -p "$TMP_DOWNLOAD_PATH"

    file_name="mihomo-linux-${arch}-${param_version}.gz"

    base_url="${version_txt_url%/*}"
    download_url="${base_url}/${file_name}"

    echo  "- Downloading mihomo binary"
    curl --connect-timeout "$CURL_CONNECT_TIMEOUT" \
        --speed-limit "$CURL_MIN_SPEED_LIMIT_BYTES" \
        --speed-time "$CURL_MIN_SPEEED_TIMEOUT" \
        --progress-bar -L -o "${TMP_DOWNLOAD_PATH}/mihomo.gz" "$download_url" || {
        print_red "Failed to download the Mihomo archive."
        return 1
    }

    echo " - Extracting to $CORE_PATH" "⬇️"
    gunzip -c "${TMP_DOWNLOAD_PATH}/mihomo.gz" > "$CORE_PATH" || {
        print_red "Failed to extract the Mihomo archive."
        return 1
    }

    echo " - Mihomo installed at $CORE_PATH"

    if ! chmod +x "$CORE_PATH"; then
        print_red "Failed to set executable permissions: $CORE_PATH"
    fi

    echo " - Cleaning up temporary files"
    if ! rm -f "${TMP_DOWNLOAD_PATH}/mihomo.gz"; then
        print_red "Failed to clean up temporary file: ${TMP_DOWNLOAD_PATH}/mihomo.gz"
    fi
}

core_remove() {
    if [ ! -x "$CORE_PATH" ]; then
        print_red "Mihomo is not installed."
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

packages_install() {
    local apk_file
    local ipk_file

    echo "  "
    print_bold_green "Installing JustClash packages..."
    pkg_list_update

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

    pkg_is_installed luci-i18n-justclash-ru
    laijc_is_installed="$?"
    if [ "$laijc_is_installed" -eq 0 ]; then
        echo " - LuCI i18n JustClash package was found. Removing..."
        pkg_remove luci-i18n-justclash-ru
    fi

    if [ "$jc_is_installed" -ne 0 ] && [ "$lajc_is_installed" -ne 0 ]; then
        echo " - JustClash package was not found."
        echo " - Cleaning up known JustClash files and directories."
        rm -rf /usr/bin/justclash
        rm -rf /usr/bin/mihomo
        rm -rf /tmp/justclash/
        rm -rf /etc/init.d/justclash
    fi
}

packages_download() {
    local install_ru="$1"
    if [ -z "$JUSTCLASH_RELEASE_URL_API" ] || [ -z "$TMP_DOWNLOAD_PATH" ]; then
        print_red "Usage: packages_download requires JUSTCLASH_RELEASE_URL_API and TMP_DOWNLOAD_PATH to be set."
        return 1
    fi

    print_bold_green "Downloading JustClash packages..."
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
        if [ "$install_ru" -ne 1 ] && echo "$file" | grep -q "luci-i18n-justclash-ru"; then
            echo " - Skipping $file"
            continue
        fi
        wget "$file" -qO "$TMP_DOWNLOAD_PATH/$(basename "$file")" || {
            print_red "Failed to download $file"
            continue
        }
    done

    echo " - All files saved to $TMP_DOWNLOAD_PATH"
}

install_translation_interactive() {
    print_bold_green "Russian translation installation mode..."
    while true; do
            printf "Do you want to install RU translation? y/n: "
            read -r inp
            inp=$(echo "$inp" | tr '[:upper:]' '[:lower:]')
            # shellcheck disable=SC2249
            case $inp in
                yes|y)
                    return 0
                    ;;
                n|no)
                    return 1
                    ;;
            esac
    done
}

install_jq() {
    echo "  "
    print_bold_green "Installing helper jq package..."

    pkg_list_update
    pkg_install jq
}

install_service() {
    local install_ru=0
    mkdir -p "$TMP_DOWNLOAD_PATH"

    diagnostic_tools
    diagnostic_net
    if [ "$CHECK_SPACE" -eq 1 ]; then
        diagnostic_mem
    fi
    diagnostic_conflicts_interactive
    core_update "alpha"
    install_translation_interactive
    [ $? -eq 0 ] && install_ru=1
    packages_download "$install_ru"
    if [ $? -ne 1 ]; then
        packages_install
    fi
}

uninstall_service() {
    justclash_uninstall
    core_remove
}

diagnostic() {
    diagnostic_tools
    diagnostic_net
    diagnostic_mem 1
    diagnostic_conflicts_interactive
}

run() {
    clear_screen
    banner
    print_bold_yellow "JustClash Setup Menu"
    print_bold_yellow "1 - Install JustClash package"
    print_bold_yellow "2 - Uninstall JustClash package"
    print_bold_yellow "3 - Update or download the latest Mihomo core"
    print_bold_yellow "4 - Remove the Mihomo core if installed"
    print_bold_yellow "5 - Run diagnostics"
    #print_bold_yellow "6 - Config DNSMasq local use flag"
    print_bold_yellow "6 - Exit"
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
                echo "Updating the Mihomo core..."
                core_update "alpha"
                ;;
            4)
                echo "Removing the Mihomo core..."
                core_remove
                ;;
            5)
                echo "Starting diagnostics..."
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

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-space-check)
            CHECK_SPACE=0
            shift
            ;;
        *)
            echo "Unknown option: $1"
            ;;
    esac
done

install_jq
run
