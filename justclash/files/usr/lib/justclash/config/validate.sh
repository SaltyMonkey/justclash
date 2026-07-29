#!/bin/ash
# shellcheck shell=dash

config_validation_error() {
    log error "Invalid UCI configuration: $1"
    return 1
}

config_validate_bool() {
    local value="$1"
    local option="$2"

    case "$value" in
        0|1) return 0 ;;
        *)
            config_validation_error "$option must be 0 or 1"
            return 1
            ;;
    esac
}

config_validate_enabled_cron() {
    local enabled="$1"
    local schedule="$2"
    local option="$3"

    [ "$enabled" = "1" ] || return 0

    if [ -z "$schedule" ]; then
        config_validation_error "settings.$option is required when its task is enabled"
        return 1
    fi

    if ! validate_cron_expr "$schedule"; then
        config_validation_error "settings.$option must be a five-field cron expression"
        return 1
    fi

    return 0
}

config_validate_uint() {
    local value="$1"
    local option="$2"

    if ! is_uint "$value"; then
        config_validation_error "$option must be an unsigned integer"
        return 1
    fi

    return 0
}

config_validate_port() {
    local value="$1"
    local option="$2"

    if ! is_port "$value"; then
        config_validation_error "$option must be an integer from 1 to 65535"
        return 1
    fi

    return 0
}

config_validate_absolute_path() {
    local value="$1"
    local option="$2"

    case "$value" in
        /*) return 0 ;;
        *)
            config_validation_error "$option must be an absolute path"
            return 1
            ;;
    esac
}

config_validate_port_list() {
    local values="$1"
    local option="$2"
    local value

    for value in $values; do
        if ! is_port "$value"; then
            config_validation_error "$option must contain only ports from 1 to 65535"
            return 1
        fi
    done

    return 0
}

config_validate_interface_list() {
    local values="$1"
    local option="$2"
    local value

    if [ -z "$values" ]; then
        config_validation_error "$option must contain at least one interface"
        return 1
    fi

    for value in $values; do
        if ! is_ifname "$value"; then
            config_validation_error "$option contains an invalid interface name"
            return 1
        fi
    done

    return 0
}

config_validate_nft_mode() {
    local value="$1"
    local option="$2"

    if ! is_choice "$value" "BY RULES" DROP REJECT; then
        config_validation_error "$option must be 'BY RULES', 'DROP', or 'REJECT'"
        return 1
    fi

    return 0
}

config_validate_nft_ntp_mode() {
    local value="$1"
    local option="$2"

    if ! is_choice "$value" "BY RULES" DROP DIRECT; then
        config_validation_error "$option must be 'BY RULES', 'DROP', or 'DIRECT'"
        return 1
    fi

    return 0
}