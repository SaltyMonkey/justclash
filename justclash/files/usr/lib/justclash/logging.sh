#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash

# --------------------------------------------
# External justclash logging part
# --------------------------------------------

PROGNAME="justclash"

IS_TTY=false
[ -t 1 ] && IS_TTY=true

clog() {
    local level="$1"
    local message="$2"

    # shellcheck disable=SC2154
    [ "$JUSTCLASH_ENV" = "procd" ] && return

    local color_start="" color_end="" level_label
    case "$level" in
        0|err|error) level_label="error"; $IS_TTY && color_start="\033[1;31m" color_end="\033[0m" ;; # Bold Red
        2|info)      level_label="info";  $IS_TTY && color_start="\033[1;32m" color_end="\033[0m" ;; # Bold Green
        3|debug)     level_label="debug"; $IS_TTY && color_start="\033[1;36m" color_end="\033[0m" ;; # Bold Cyan
        *)           level_label="warn";  $IS_TTY && color_start="\033[1;33m" color_end="\033[0m" ;; # Bold Yellow
    esac

    local ts ts_start="" ts_end=""
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    $IS_TTY && ts_start="\033[90m" ts_end="\033[0m" # Dimmed Gray

    printf '%b%s%b %b%s:%b %s\n' "$ts_start" "$ts" "$ts_end" "$color_start" "$level_label" "$color_end" "$message"
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

log_piped() {
    local line level message lvl_num facility
    local color_start="" color_end="" ts_start="" ts_end=""

    while IFS= read -r line || [ -n "$line" ]; do
        [ -z "$line" ] && continue
        case "$line" in
            *msg=*)
                level="${line#*level=}"
                level="${level%% *}"
                message="${line#*msg=}"
                message="${message#\"}"
                message="${message%\"}"
                ;;
            *\[*\]*)
                level="${line%%\[*}"
                local rest="${line#*\[}"
                message="${rest#*\]}"
                message="${message# }"
                ;;
            *)
                level="info"
                case "$line" in
                    *[Ww]arn*)            level="warn" ;;
                    *[Ee]rror*|*[Ee]rro*) level="error" ;;
                esac
                message="$line"
                ;;
        esac

        message="mihomo: $message"

        case "$level" in
            INFO|info)         lvl_num="info";  facility="user.info";    $IS_TTY && { color_start="\033[1;32m"; color_end="\033[0m"; } ;;
            WARN|warning|warn) lvl_num="warn";  facility="user.warning"; $IS_TTY && { color_start="\033[1;33m"; color_end="\033[0m"; } ;;
            ERRO|error|erro)   lvl_num="error"; facility="user.err";     $IS_TTY && { color_start="\033[1;31m"; color_end="\033[0m"; } ;;
            DEBG|debug|debg)   lvl_num="debug"; facility="user.debug";   $IS_TTY && { color_start="\033[1;36m"; color_end="\033[0m"; } ;;
            *)                 lvl_num="info";  facility="user.info";    $IS_TTY && { color_start="\033[1;32m"; color_end="\033[0m"; } ;;
        esac

        if $IS_TTY; then
            local ts
            ts=$(date '+%Y-%m-%d %H:%M:%S')
            ts_start="\033[90m" ts_end="\033[0m"
            printf '%b%s%b %b%s:%b %s\n' "$ts_start" "$ts" "$ts_end" "$color_start" "$lvl_num" "$color_end" "$message"
        else
            logger -p "$facility" -t "$PROGNAME" "$message"
        fi
    done
}
