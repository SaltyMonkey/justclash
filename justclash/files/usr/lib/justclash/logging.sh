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

    # shellcheck disable=SC2154
    [ "$JUSTCLASH_ENV" = "procd" ] && return

    local color_start="" color_end="" level_label
    case "$level" in
        0|err|error) level_label="error"; [ -t 1 ] && color_start="\033[1;31m" color_end="\033[0m" ;; # Bold Red
        2|info)      level_label="info";  [ -t 1 ] && color_start="\033[1;32m" color_end="\033[0m" ;; # Bold Green
        3|debug)     level_label="debug"; [ -t 1 ] && color_start="\033[1;36m" color_end="\033[0m" ;; # Bold Cyan
        *)           level_label="warn";  [ -t 1 ] && color_start="\033[1;33m" color_end="\033[0m" ;; # Bold Yellow
    esac

    local ts ts_start="" ts_end=""
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    [ -t 1 ] && ts_start="\033[90m" ts_end="\033[0m" # Dimmed Gray

    printf '%b%s ::%b %b%s:%b %s\n' "$ts_start" "$ts" "$ts_end" "$color_start" "$level_label" "$color_end" "$message"
}

log() {
    local level="$1"
    local message="$2"

    local facility lvl_num
    case "$level" in
        0|err|error)   lvl_num="0"; facility="user.err"     ;;
        2|info)        lvl_num="2"; facility="user.info"    ;;
        3|debug)       lvl_num="3"; facility="user.debug"   ;;
        *)             lvl_num="1"; facility="user.warning" ;;
    esac

    logger -p "$facility" -t "$PROGNAME" "$message"
    clog "$lvl_num" "$message"
}
