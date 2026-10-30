#!/bin/ash
# shellcheck shell=dash

config_init() {
    local package="$1" mode="${2:-}"

    config_load "$package" || {
        log error "Configuration loading failed."
        return 1
    }
    config_validate "$mode" || {
        log error "Configuration validation failed."
        return 1
    }
}

config_hash_filtered() {
    local package="$1"
    local exclude_pattern="$2"

    uci show "$package" | grep -vE "$exclude_pattern" | str_md5
}

_config_emit_routing_mark() {
    local section="$1"
    local option_name="$2"
    local routing_mark

    config_get routing_mark "$section" "$option_name"
    [ -n "$routing_mark" ] || return 0

    printf '%d ' "$routing_mark"
}

config_routing_marks_read() {
    local section_type="$1"
    local option_name="$2"

    config_foreach _config_emit_routing_mark \
        "$section_type" "$option_name"
}
