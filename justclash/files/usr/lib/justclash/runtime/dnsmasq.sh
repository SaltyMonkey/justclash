#!/bin/ash
# shellcheck shell=dash

DNSMASQ_UCI_SECTION="dhcp.@dnsmasq[0]"
DNSMASQ_UCI_PACKAGE="dhcp"
DNSMASQ_INITD_PATH="/etc/init.d/dnsmasq"
save_dnsmasq_config() {
    local key="$1"
    local backup_key="$2"
    local value

    value=$(uci get "$key" 2>/dev/null)
    if [ -z "$value" ]; then
        uci set "${backup_key}=unset"
    else
        uci set "${backup_key}=${value}"
    fi
}

# Returns 0 when applied, disabled, or already configured; nonzero on failure.
dnsmasq_update() {
    local apply_changes="$1"
    local dns_listen_port="$2"
    local backup_prefix="$3"
    local server current_servers

    if [ "$apply_changes" != "1" ]; then
        log info "Skip Dnsmasq changes because Dnsmasq rules application is disabled."
        return 0
    fi

    current_servers=$(uci -q get "${DNSMASQ_UCI_SECTION}.server" 2>/dev/null)
    for server in $current_servers; do
        if [ "$server" = "127.0.0.1#${dns_listen_port}" ]; then
            log warn "Dnsmasq already uses 127.0.0.1#${dns_listen_port}. Skip Dnsmasq changes."
            return 0
        fi
    done

    uci -q delete "${DNSMASQ_UCI_SECTION}.${backup_prefix}_server"
    for server in $current_servers; do
        [ -n "$server" ] && uci add_list "${DNSMASQ_UCI_SECTION}.${backup_prefix}_server=${server}"
    done

    save_dnsmasq_config \
        "${DNSMASQ_UCI_SECTION}.noresolv" \
        "${DNSMASQ_UCI_SECTION}.${backup_prefix}_noresolv"
    save_dnsmasq_config \
        "${DNSMASQ_UCI_SECTION}.cachesize" \
        "${DNSMASQ_UCI_SECTION}.${backup_prefix}_cachesize"

    uci -q delete "${DNSMASQ_UCI_SECTION}.server"
    uci add_list "${DNSMASQ_UCI_SECTION}.server=127.0.0.1#${dns_listen_port}"
    uci set "${DNSMASQ_UCI_SECTION}.cachesize=0"
    uci set "${DNSMASQ_UCI_SECTION}.noresolv=1"

    uci commit "$DNSMASQ_UCI_PACKAGE"
    log info "DNS configuration updated."
    "$DNSMASQ_INITD_PATH" restart >/dev/null 2>&1
    log info "Dnsmasq restarted to apply DNS changes."
    return 0
}

# Returns 0 when restored, disabled, or unchanged; nonzero on failure.
dnsmasq_restore() {
    local apply_changes="$1"
    local dns_listen_port="$2"
    local backup_prefix="$3"
    local bak_cachesize bak_noresolv
    local server current_servers backup_servers
    local has_local_server=0

    if [ "$apply_changes" != "1" ]; then
        log info "Skip Dnsmasq restore because Dnsmasq rules application is disabled."
        return 0
    fi

    bak_cachesize=$(uci -q get "${DNSMASQ_UCI_SECTION}.${backup_prefix}_cachesize")
    if [ "$bak_cachesize" = "unset" ]; then
        log warn "Dnsmasq restore: backup cachesize is unset"
        uci -q delete "${DNSMASQ_UCI_SECTION}.cachesize"
    elif [ -z "$bak_cachesize" ]; then
        log warn "Dnsmasq restore: backup cachesize is missing"
    else
        uci set "${DNSMASQ_UCI_SECTION}.cachesize=${bak_cachesize}"
    fi

    bak_noresolv=$(uci -q get "${DNSMASQ_UCI_SECTION}.${backup_prefix}_noresolv")
    if [ "$bak_noresolv" = "unset" ]; then
        log warn "Dnsmasq restore: backup noresolv is unset"
        uci -q delete "${DNSMASQ_UCI_SECTION}.noresolv"
    else
        uci set "${DNSMASQ_UCI_SECTION}.noresolv=${bak_noresolv}"
    fi

    current_servers=$(uci -q get "${DNSMASQ_UCI_SECTION}.server" 2>/dev/null)
    backup_servers=$(uci -q get "${DNSMASQ_UCI_SECTION}.${backup_prefix}_server" 2>/dev/null)
    for server in $current_servers; do
        if [ "$server" = "127.0.0.1#${dns_listen_port}" ]; then
            has_local_server=1
            break
        fi
    done

    if [ "$has_local_server" -eq 1 ]; then
        uci -q delete "${DNSMASQ_UCI_SECTION}.server"
        if [ -n "$backup_servers" ]; then
            for server in $backup_servers; do
                [ -n "$server" ] && uci add_list "${DNSMASQ_UCI_SECTION}.server=${server}"
            done
        else
            for server in $current_servers; do
                [ "$server" = "127.0.0.1#${dns_listen_port}" ] && continue
                [ -n "$server" ] && uci add_list "${DNSMASQ_UCI_SECTION}.server=${server}"
            done
        fi
        uci -q delete "${DNSMASQ_UCI_SECTION}.${backup_prefix}_server"
    fi

    uci commit "$DNSMASQ_UCI_PACKAGE"
    log info "DNS configuration restored."
    "$DNSMASQ_INITD_PATH" restart >/dev/null 2>&1
    log info "Dnsmasq restarted to apply DNS changes."
    return 0
}
