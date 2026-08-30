#!/bin/ash
# shellcheck shell=dash
# shellcheck disable=SC2154

config_init() {
    local package="$1"

    config_load "$package"
}

config_hash_filtered() {
    local package="$1"
    local exclude_pattern="$2"

    uci show "$package" | grep -vE "$exclude_pattern" | str_md5
}

config_dashboard_url_read() {
    local dashboard_repo="$1"
    local metacubexd_default="$2"
    local yacd_meta_default="$3"
    local zashboard_default="$4"
    local dashboard_url

    case "$dashboard_repo" in
    yacd-meta) config_get dashboard_url settings mihomo_dashboard_yacd_meta_url "$yacd_meta_default" ;;
    zashboard) config_get dashboard_url settings mihomo_dashboard_zashboard_url "$zashboard_default" ;;
    *) config_get dashboard_url settings mihomo_dashboard_metacubexd_url "$metacubexd_default" ;;
    esac

    printf '%s' "$dashboard_url"
}

_config_emit_routing_mark() {
    local section="$1"
    local option_name="$2"
    local reserved_marks="$3"
    local routing_mark

    config_get routing_mark "$section" "$option_name"
    routing_mark=$(val_parse_routing_mark "$routing_mark" "$reserved_marks")
    [ -n "$routing_mark" ] || return 0

    printf '%s ' "$routing_mark"
}

config_routing_marks_read() {
    local reserved_marks="$1"
    local section_type="$2"
    local option_name="$3"

    config_foreach _config_emit_routing_mark \
        "$section_type" "$option_name" "$reserved_marks"
}
