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
