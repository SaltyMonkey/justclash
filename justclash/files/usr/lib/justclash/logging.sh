#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------
# External justclash service part
# --------------------------------------------

PROGNAME="justclash"

get_log_level() {
    case "$1" in
        0) echo "user.err"     ;;
        1) echo "user.warning" ;;
        2) echo "user.info"    ;;
        3) echo "user.debug"   ;;
        *) echo "user.err"     ;;
    esac
}

clog() {
    local level="$1"
    local message="$2"
    local emoji="${3:-}"

    [ "${PROCD_MODE:-0}" -eq 1 ] && return

    local ts facility
    ts=$(date '+%Y-%m-%d %H:%M:%S.%3N')
    facility=$(get_log_level "$level")

    printf '[%s] [%s] %s\n' "$ts" "$facility" "${emoji:+$emoji }$message"
}

log() {
    local level="$1"
    local message="$2"
    local emoji="${3:-}"

    local facility
    facility=$(get_log_level "$level")

    logger -p "$facility" -t "$PROGNAME" "$message"
    clog "$level" "$message" "$emoji"
}