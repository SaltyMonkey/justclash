#!/bin/ash
# shellcheck shell=dash

# Focused helper module loaded into the main ash process.

# Global constants for ash-native string operations
NL="$(printf '\n.')"; NL="${NL%.}"
CR="$(printf '\r')"
TAB="$(printf '\t')"
url_decode() {
    # shellcheck disable=SC3060
    local data="${1//+/ }"
    echo -n "$data" | sed 's/\\/\\\\/g; s/%/\\x/g' | xargs -0 printf '%b'
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

build_slash_map_from_values() {
    local values="$1"
    local delim="${2:-,}"
    local result=""
    local entry key val item old_ifs

    old_ifs="$IFS"
    IFS="$NL"
    for entry in $values; do
        key="${entry%%/*}"
        val="${entry#*/}"
        [ "$key" = "$entry" ] || [ -z "$key" ] || [ -z "$val" ] && continue
        item="$(yaml_quote "$key"; printf ': '; yaml_quote "$val")"
        [ -z "$result" ] && result="$item" || result="$result$delim$item"
    done
    IFS="$old_ifs"

    printf '%s' "$result"
}
build_custom_slash_map() {
    local section_name="$1"
    local list_name="$2"
    local delim="${3:-,}"
    local result=""

    # shellcheck disable=SC2329
    __append_slash_item() {
        local entry="$1"
        local key="${entry%%/*}"
        local val="${entry#*/}"

        [ "$key" = "$entry" ] || [ -z "$key" ] || [ -z "$val" ] && return

        local item
        item="$(yaml_quote "$key"; printf ': '; yaml_quote "$val")"
        [ -z "$result" ] && result="$item" || result="$result$delim$item"
    }

    config_list_foreach "$section_name" "$list_name" __append_slash_item
    printf '%s' "$result"
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
