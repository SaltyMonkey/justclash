#!/bin/ash
# shellcheck shell=dash
# Ash isn't supported properly in spellcheck static analyzer
# Using debian based version (kind of similar)
# shellcheck shell=dash
# shellcheck disable=SC3060

# --------------------------------------------
# External justclash parsers/generators part
# --------------------------------------------

uri_is_truthy() {
    case "$1" in
    1 | true | TRUE | True | yes | YES | on | ON) return 0 ;;
    *) return 1 ;;
    esac
}

# Return host and raw port in URI_HOST/URI_PORT; protocols normalize ports themselves.
uri_parse_hostport() {
    local authority="$1" default_port="$2" host suffix port=""
    URI_HOST=""
    URI_PORT=""
    authority="${authority%%\?*}"
    authority="${authority%%#*}"
    authority="${authority%%/*}"

    case "$authority" in
    \[*\]*)
        host="${authority#\[}"
        host="${host%%\]*}"
        suffix="${authority#*\]}"
        case "$suffix" in
        '') ;;
        :*) port="${suffix#:}" ;;
        *) return 1 ;;
        esac
        ;;
    *\[* | *\]*) return 1 ;;
    *:*:*)
        # Guessing where an unbracketed IPv6 address ends is not parsing.
        return 1
        ;;
    *:*)
        host="${authority%:*}"
        port="${authority##*:}"
        ;;
    *) host="$authority" ;;
    esac

    [ -n "$host" ] || return 1
    URI_HOST=$(str_url_decode "$host") || return 1
    [ -n "$URI_HOST" ] || return 1
    URI_PORT="${port:-$default_port}"
    return 0
}

uri_json_array_from_csv() {
    local value="$1"

    if [ -z "$value" ]; then
        echo '[]'
        return 0
    fi

    printf '%s' "$value" | jq -Rc '
        split(",")
        | map(gsub("^\\s+|\\s+$"; ""))
        | map(select(length > 0))
    '
}
