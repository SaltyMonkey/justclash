#!/bin/ash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash
# shellcheck disable=SC2154

# --------------------------------------------
# External justclash logging part
# --------------------------------------------

IS_TTY=false
[ -t 1 ] && IS_TTY=true
_LOG_FILE_READY=false

_log_file_init() {
    local owner current_uid

    [ -L "$CORE_WORKDIR_PATH" ] && return 1

    if [ ! -d "$CORE_WORKDIR_PATH" ]; then
        # shellcheck disable=SC2174
        mkdir -m 700 -p "$CORE_WORKDIR_PATH" 2>/dev/null || return 1
    fi

    # Do not feed potentially sensitive logs into a directory prepared by another user.
    # shellcheck disable=SC2012
    owner=$(ls -ldn "$CORE_WORKDIR_PATH" 2>/dev/null | awk '{print $3}')
    current_uid=$(id -u)
    [ -n "$owner" ] && [ "$owner" != "$current_uid" ] && return 1
    [ -L "$CORE_LOG_FILE_PATH" ] && return 1

    chmod 700 "$CORE_WORKDIR_PATH" 2>/dev/null || return 1
    (umask 077 && : >>"$CORE_LOG_FILE_PATH") 2>/dev/null || return 1
    chmod 600 "$CORE_LOG_FILE_PATH" 2>/dev/null || return 1
    _LOG_FILE_READY=true
}

_log_file_write() {
    local level="$1"
    local message="$2"
    local ts

    $_LOG_FILE_READY || _log_file_init || return 0
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    (umask 077 && printf '%s %s: %s\n' "$ts" "$level" "$message" >>"$CORE_LOG_FILE_PATH") 2>/dev/null || true
}

clog() {
    local level="$1"
    local message="$2"

    # shellcheck disable=SC2154
    [ "$ENV_JUSTCLASH_RUN_CONTEXT" = "procd" ] && return

    local color_start="" color_end="" level_label
    case "$level" in
    0 | err | error)
        level_label="error"
        $IS_TTY && color_start="\033[1;31m" color_end="\033[0m"
        ;; # Bold Red
    2 | info)
        level_label="info"
        $IS_TTY && color_start="\033[1;32m" color_end="\033[0m"
        ;; # Bold Green
    3 | debug)
        level_label="debug"
        $IS_TTY && color_start="\033[1;36m" color_end="\033[0m"
        ;; # Bold Cyan
    *)
        level_label="warn"
        $IS_TTY && color_start="\033[1;33m" color_end="\033[0m"
        ;; # Bold Yellow
    esac

    local ts ts_start="" ts_end=""
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    $IS_TTY && ts_start="\033[90m" ts_end="\033[0m" # Dimmed Gray

    printf '%b%s%b %b%s:%b %s\n' "$ts_start" "$ts" "$ts_end" "$color_start" "$level_label" "$color_end" "$message"
}

log() {
    local level="$1"
    local message="$2"

    local facility level_label
    case "$level" in
    0 | err | error)
        level_label="error"
        facility="user.err"
        ;;
    2 | info)
        level_label="info"
        facility="user.info"
        ;;
    3 | debug)
        level_label="debug"
        facility="user.debug"
        ;;
    *)
        level_label="warning"
        facility="user.warning"
        ;;
    esac

    logger -p "$facility" -t "$PROGNAME" "$message"
    _log_file_write "$level_label" "$message"
    clog "$level_label" "$message"
}

log_piped() {
    local line level message level_label facility
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
            *[Ww]arn*) level="warn" ;;
            *[Ee]rror* | *[Ee]rro*) level="error" ;;
            esac
            message="$line"
            ;;
        esac

        message="mihomo: $message"

        case "$level" in
        INFO | info)
            level_label="info"
            facility="user.info"
            $IS_TTY && {
                color_start="\033[1;32m"
                color_end="\033[0m"
            }
            ;;
        WARN | warning | warn)
            level_label="warning"
            facility="user.warning"
            $IS_TTY && {
                color_start="\033[1;33m"
                color_end="\033[0m"
            }
            ;;
        ERRO | error | erro)
            level_label="error"
            facility="user.err"
            $IS_TTY && {
                color_start="\033[1;31m"
                color_end="\033[0m"
            }
            ;;
        DEBG | debug | debg)
            level_label="debug"
            facility="user.debug"
            $IS_TTY && {
                color_start="\033[1;36m"
                color_end="\033[0m"
            }
            ;;
        *)
            level_label="info"
            facility="user.info"
            $IS_TTY && {
                color_start="\033[1;32m"
                color_end="\033[0m"
            }
            ;;
        esac

        logger -p "$facility" -t "$PROGNAME" "$message"
        _log_file_write "$level_label" "$message"

        if $IS_TTY; then
            local ts
            ts=$(date '+%Y-%m-%d %H:%M:%S')
            ts_start="\033[90m" ts_end="\033[0m"
            printf '%b%s%b %b%s:%b %s\n' "$ts_start" "$ts" "$ts_end" "$color_start" "$level_label" "$color_end" "$message"
        fi
    done
}

logs() {
    local lines="${2:-40}"

    [ -f "$CORE_LOG_FILE_PATH" ] || return 0
    tail -n "$lines" "$CORE_LOG_FILE_PATH"
}

systemlogs() {
    local program_name="$1"
    local lines="${2:-40}"

    logread -e "$program_name" | tail -n "$lines"
}
