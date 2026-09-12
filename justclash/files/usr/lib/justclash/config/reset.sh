#!/bin/ash
# shellcheck shell=dash

_CONFIG_API_PASSWORD_PLACEHOLDER="__JUSTCLASH_GENERATE_API_PASSWORD__"
_CONFIG_MIXED_PASSWORD_PLACEHOLDER="__JUSTCLASH_GENERATE_MIXED_PASSWORD__"

_config_generate_api_password() {
    local password=""

    if [ -r /proc/sys/kernel/random/uuid ]; then
        password="$(tr -d '-' </proc/sys/kernel/random/uuid 2>/dev/null)" || password=""
    fi

    if [ "${#password}" -lt 32 ] && [ -r /dev/urandom ]; then
        password="$(
            head -c 24 /dev/urandom 2>/dev/null |
                base64 2>/dev/null |
                tr -d '\r\n'
        )" || password=""
    fi

    [ "${#password}" -ge 32 ] || return 1

    printf '%s\n' "$password"
}

_config_generate_mixed_password() {
    local password=""

    [ -r /dev/urandom ] || return 1
    password="$(
        head -c 48 /dev/urandom 2>/dev/null |
            base64 2>/dev/null |
            tr -d '\r\n'
    )" || password=""

    [ "${#password}" -eq 64 ] || return 1
    printf '%s\n' "$password"
}

_config_write_credentials() {
    local source_path="$1"
    local output_path="$2"
    local api_password="$3"
    local mixed_password="$4"
    local option_count

    option_count="$(
        grep -Ec \
            '^[[:space:]]*option[[:space:]]+api_password([[:space:]]|$)' \
            "$source_path" 2>/dev/null
    )" || return 1

    [ "$option_count" -eq 1 ] || return 1

    sed -E \
        -e "s|^([[:space:]]*option[[:space:]]+api_password[[:space:]]+)'${_CONFIG_API_PASSWORD_PLACEHOLDER}'[[:space:]]*$|\1'${api_password}'|" \
        -e "s|^([[:space:]]*list[[:space:]]+proxy_authentication[[:space:]]+)'user:${_CONFIG_MIXED_PASSWORD_PLACEHOLDER}'[[:space:]]*$|\1'user:${mixed_password}'|" \
        "$source_path" >"$output_path" || return 1

    ! grep -Eq "${_CONFIG_API_PASSWORD_PLACEHOLDER}|${_CONFIG_MIXED_PASSWORD_PLACEHOLDER}" "$output_path"
}

config_credentials_ensure_file() {
    local config_path="$1"
    local api_password mixed_password tmp_config

    [ -f "$config_path" ] || return 1

    if ! grep -Eq "${_CONFIG_API_PASSWORD_PLACEHOLDER}|${_CONFIG_MIXED_PASSWORD_PLACEHOLDER}" "$config_path"; then
        return 0
    fi

    api_password="$(_config_generate_api_password)" || return 1
    mixed_password="$(_config_generate_mixed_password)" || return 1
    tmp_config="$(mktemp "${config_path}.password.XXXXXX")" || return 1

    if ! _config_write_credentials "$config_path" "$tmp_config" "$api_password" "$mixed_password" ||
        ! chmod 600 "$tmp_config" ||
        ! mv -f "$tmp_config" "$config_path"; then
        rm -f "$tmp_config"
        return 1
    fi
}

config_reset() {
    local default_config_path="$1"
    local config_path="$2"
    local backup_config_path="$3"
    local api_password mixed_password tmp_config backup_tmp=""

    if [ ! -f "$default_config_path" ]; then
        clog error "Default configuration file is missing. Reset is unavailable."
        return 1
    fi

    api_password="$(_config_generate_api_password)" || {
        clog error "Failed to generate a new API password."
        return 1
    }
    mixed_password="$(_config_generate_mixed_password)" || {
        clog error "Failed to generate a new Mixed Port password."
        return 1
    }

    tmp_config="$(mktemp "${config_path}.reset.XXXXXX")" || {
        clog error "Failed to create a temporary configuration file."
        return 1
    }

    if ! _config_write_credentials "$default_config_path" "$tmp_config" "$api_password" "$mixed_password" ||
        ! chmod 600 "$tmp_config"; then
        rm -f "$tmp_config"
        clog error "Failed to prepare the default configuration."
        return 1
    fi

    clog info "Resetting JustClash settings..."

    if [ -f "$config_path" ]; then
        backup_tmp="$(mktemp "${backup_config_path}.XXXXXX")" || {
            rm -f "$tmp_config"
            clog error "Failed to create a temporary backup file."
            return 1
        }

        if ! cp "$config_path" "$backup_tmp" ||
            ! chmod 600 "$backup_tmp" ||
            ! mv -f "$backup_tmp" "$backup_config_path"; then
            rm -f "$backup_tmp" "$tmp_config"
            clog error "Failed to back up the current configuration file."
            return 1
        fi

        clog info "Previous configuration file was saved to ${backup_config_path}"
    else
        clog error "Current configuration file was not found; nothing to back up."
    fi

    if ! mv -f "$tmp_config" "$config_path"; then
        rm -f "$tmp_config"
        clog error "Failed to activate the default configuration."
        return 1
    fi

    clog info "Default settings with new API and Mixed Port passwords will be applied on the next service restart."
    return 0
}
