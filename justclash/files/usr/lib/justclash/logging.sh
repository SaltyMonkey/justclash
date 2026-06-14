#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------
# External justclash logging part
# --------------------------------------------

PROGNAME="justclash"

clog() {
    local level="$1"
    local message="$2"
    local emoji="${3:-}"

    # shellcheck disable=SC2154
    [ "$JUSTCLASH_ENV" = "procd" ] && return

    local facility
    case "$level" in
        0|err|error)   facility="user.err"     ;;
        2|info)        facility="user.info"    ;;
        3|debug)       facility="user.debug"   ;;
        *)             facility="user.warning" ;;
    esac

    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')

    printf '[%s] [%s] %s\n' "$ts" "$facility" "${emoji:+$emoji }$message"
}

log() {
    local level="$1"
    local message="$2"
    local emoji="${3:-}"

    local facility lvl_num
    case "$level" in
        0|err|error)   lvl_num="0"; facility="user.err"     ;;
        2|info)        lvl_num="2"; facility="user.info"    ;;
        3|debug)       lvl_num="3"; facility="user.debug"   ;;
        *)             lvl_num="1"; facility="user.warning" ;;
    esac

    logger -p "$facility" -t "$PROGNAME" "$message"
    clog "$lvl_num" "$message" "$emoji"
}
