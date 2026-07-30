#!/bin/ash
# shellcheck shell=dash

# Focused helper module loaded into the main ash process.

format_uci_bool_as_yaml() {
    case "$1" in
    1 | yes | on | true) echo "true" ;;
    *) echo "false" ;;
    esac
}

# NL is provided by helpers/strings.sh through helpers.sh.
# shellcheck disable=SC2154
format_values_as_json_array() {
    local values="$1"
    local add_custom="$2"
    local indent="${3:-}"
    local result=""
    local val old_ifs

    old_ifs="$IFS"
    IFS="$NL"
    for val in $values; do
        [ -n "$val" ] || continue
        val=$(json_escape "$val")
        [ -n "$add_custom" ] && val="${val}${add_custom}"
        if [ -n "$result" ]; then
            result="${result},\n${indent}\"$val\""
        else
            result="${indent}\"$val\""
        fi
    done
    IFS="$old_ifs"

    [ -z "$result" ] && echo "[]" || printf '[\n%b\n]' "$result"
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

list_to_json_array() {
    local input_list
    read -r input_list

    # TODO: Try to replace this with an in-memory implementation to avoid calling sed unnecessarily
    if [ -n "$input_list" ]; then
        printf '"%s"' "$(echo "$input_list" | sed -e 's/"/\\"/g' -e 's/[[:space:]]\+/","/g')"
    fi
}
