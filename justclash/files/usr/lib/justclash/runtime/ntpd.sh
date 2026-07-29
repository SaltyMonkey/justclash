#!/bin/ash
# shellcheck shell=dash

NTPD_PATH="/usr/sbin/ntpd"

# Returns 0 when disabled or synchronized, 3 without servers, 6 when ntpd fails.
ntp_force_sync() {
    local enabled="$1"
    local servers="$2"

    local server

    [ "$enabled" = "1" ] || return 0

    if [ -z "$servers" ]; then
        log error "No NTP servers configured"
        return 3
    fi

    set -- -q
    for server in $servers; do
        set -- "$@" -p "$server"
    done

    "$NTPD_PATH" "$@" || return 6
    return 0
}
