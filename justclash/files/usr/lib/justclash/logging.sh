#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------
# External justclash logging part
# --------------------------------------------

PROGNAME="justclash"

normalize_log_level() {
    case "$1" in
        0|err|error) echo "0" ;;
        1|warn|warning) echo "1" ;;
        2|info) echo "2" ;;
        3|debug) echo "3" ;;
        *) echo "1" ;;
    esac
}

get_log_level() {
    case "$(normalize_log_level "$1")" in
        0) echo "user.err"     ;;
        1) echo "user.warning" ;;
        2) echo "user.info"    ;;
        3) echo "user.debug"   ;;
        *) echo "user.warning" ;;
    esac
}

clog() {
    local normalized_level
    local message="$2"
    local emoji="${3:-}"

    normalized_level=$(normalize_log_level "$1")

    # shellcheck disable=SC2154
    [ "$JUSTCLASH_ENV" = "procd" ] && return

    local ts facility
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    facility=$(get_log_level "$normalized_level")

    printf '[%s] [%s] %s\n' "$ts" "$facility" "${emoji:+$emoji }$message"
}

log() {
    local normalized_level
    local message="$2"
    local emoji="${3:-}"

    normalized_level=$(normalize_log_level "$1")

    local facility
    facility=$(get_log_level "$normalized_level")

    logger -p "$facility" -t "$PROGNAME" "$message"
    clog "$normalized_level" "$message" "$emoji"
}
