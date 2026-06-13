#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------------------
# External justclash service helpers file
# --------------------------------------------------------

JUSTCLASH_CACHE_OS_ARCH=""
JUSTCLASH_CACHE_OS_NAME=""
JUSTCLASH_CACHE_OS_VERSION=""
JUSTCLASH_CACHE_OS_VERSION_FULL=""
JUSTCLASH_CACHE_HW_MODEL=""
JUSTCLASH_CACHE_HWID=""

# Global constants for ash-native string operations
NL="$(printf '\n.')"; NL="${NL%.}"
CR="$(printf '\r')"
TAB="$(printf '\t')"

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

url_decode() {
    # shellcheck disable=SC3060
    local data="${1//+/ }"
    echo -n "$data" | sed 's/\\/\\\\/g; s/%/\\x/g' | xargs -0 printf '%b'
}

parse_routing_mark() {
    local val="$1"
    local reserved_marks="$2"
    [ -z "$val" ] && return 0

    case "$val" in
        0[xX]*[!0-9a-fA-F]*) echo "-1"; return 0 ;;
        0[xX]) echo "-1"; return 0 ;;
        0[xX]*) ;;
        *[!0-9]*) echo "-1"; return 0 ;;
        *) ;;
    esac

    local dec_val
    dec_val=$(printf "%d" "$val" 2>/dev/null)
    if [ "$dec_val" = "0" ] && [ "$val" != "0" ] && [ "$val" != "0x0" ] && [ "$val" != "0X0" ]; then
        echo "-1"
        return 0
    fi

    local res_mark dec_res_mark
    for res_mark in $reserved_marks; do
        dec_res_mark=$(printf "%d" "$res_mark" 2>/dev/null)
        if [ "$dec_val" = "$dec_res_mark" ]; then
            echo "-1"
            return 0
        fi
    done

    echo "$dec_val"
}

json_escape() {
    local val="$1"
    # shellcheck disable=SC3060
    val="${val//\\/\\\\}"
    # shellcheck disable=SC3060
    val="${val//\"/\\\"}"
    # shellcheck disable=SC3060
    val="${val//$TAB/\\t}"
    # shellcheck disable=SC3060
    val="${val//$NL/\\n}"
    # shellcheck disable=SC3060
    val="${val//$CR/\\r}"
    printf '%s' "$val"
}

yaml_quote() {
    local val="$1"
    # shellcheck disable=SC3060
    val="${val//\\/\\\\}"
    # shellcheck disable=SC3060
    val="${val//\"/\\\"}"
    # shellcheck disable=SC3060
    val="${val//$TAB/}"
    # shellcheck disable=SC3060
    val="${val//$NL/}"
    # shellcheck disable=SC3060
    val="${val//$CR/}"
    printf '"%s"' "$val"
}

format_uci_bool_as_yaml() {
    case "$1" in
        1|yes|on|true) echo "true" ;;
        *) echo "false" ;;
    esac
}

format_uci_list_as_json_array() {
    local section_name="$1"
    local list_name="$2"
    local add_custom="$3"
    local indent="${4:-}"
    local result=""

    # shellcheck disable=SC2329
    __append_json_array_element() {
        local val="$1"
        [ -n "$val" ] || return 0

        # shellcheck disable=SC3060
        val="${val//\"/\\\"}"
        [ -n "$add_custom" ] && val="${val}${add_custom}"

        if [ -n "$result" ]; then
            result="${result},\n${indent}\"$val\""
        else
            result="${indent}\"$val\""
        fi
    }

    config_list_foreach "$section_name" "$list_name" __append_json_array_element

    [ -z "$result" ] && echo "[]" || printf '[\n%b\n]' "$result"
}

md5_str() {
    local res
    res=$(md5sum)
    printf '%s' "${res%% *}"
}

spaces_to_commas() {
    LC_ALL=C sed 's/[[:space:]]\+/, /g'
}

trim() {
    local value="$1"

    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    printf '%s' "$value"
}

list_to_json_array() {
    local input_list
    read -r input_list

    # TODO: Try to replace this with an in-memory implementation to avoid calling sed unnecessarily
    if [ -n "$input_list" ]; then
        printf '"%s"' "$(echo "$input_list" | sed -e 's/"/\\"/g' -e 's/[[:space:]]\+/","/g')"
    fi
}

validate_cron_expr() {
    local expr="$1"
    local field

    # Split the expression into cron fields and reject extra tokens.
    # shellcheck disable=SC2086
    set -- $expr
    [ "$#" -eq 5 ] || return 1

    for field in "$@"; do
        case "$field" in
            ''|*[!0-9*/,-]*)
                return 1
                ;;
            *) ;;
        esac
    done

    return 0
}

is_uint() {
    case "$1" in
        ''|*[!0-9]*) return 1 ;;
        *) return 0 ;;
    esac
}

is_port() {
    is_uint "$1" && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

is_ifname() {
    case "$1" in
        ''|*[!A-Za-z0-9_.:-]*) return 1 ;;
        *) return 0 ;;
    esac
}

is_choice() {
    local value="$1"
    shift
    local item

    for item in "$@"; do
        [ "$value" = "$item" ] && return 0
    done

    return 1
}

safe_paths_add() {
    [ -n "$1" ] || return

    case ":$SAFE_PATHS:" in
        *":$1:"*) ;;
        *)
            SAFE_PATHS="${SAFE_PATHS:+$SAFE_PATHS:}$1"
            export SAFE_PATHS
            ;;
    esac
}

safe_paths_clear() {
    SAFE_PATHS=""
    export SAFE_PATHS
}

get_hw_model() {
    [ -n "$JUSTCLASH_CACHE_HW_MODEL" ] || JUSTCLASH_CACHE_HW_MODEL=$(cat /tmp/sysinfo/model 2>/dev/null)
    printf '%s' "$JUSTCLASH_CACHE_HW_MODEL"
}

get_os_arch() {
    printf '%s' "$JUSTCLASH_CACHE_OS_ARCH"
}

get_os_name() {
    printf '%s' "$JUSTCLASH_CACHE_OS_NAME"
}

get_os_version_full() {
    printf '%s' "$JUSTCLASH_CACHE_OS_VERSION_FULL"
}

get_os_version() {
    printf '%s' "$JUSTCLASH_CACHE_OS_VERSION"
}

hwid_generate() {
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
    arch_data=$(get_os_arch)

    hwid_str=$(printf "hwid_%s%s%s" "$mac_addr" "$board_data" "$arch_data" | md5sum | cut -c1-14)

    JUSTCLASH_CACHE_HWID="$hwid_str"
    printf '%s' "$JUSTCLASH_CACHE_HWID"
}
