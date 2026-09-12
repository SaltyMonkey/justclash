#!/bin/ash
# shellcheck shell=dash

DNSMASQ_UCI_SECTION="dhcp.@dnsmasq[0]"
DNSMASQ_UCI_PACKAGE="dhcp"
DNSMASQ_INITD_PATH="/etc/init.d/dnsmasq"

_dnsmasq_delete_option() {
    uci -q get "$1" >/dev/null 2>&1 || return 0
    uci -q delete "$1"
}

_dnsmasq_write_option() (
    local key="$1" value="$2" option="$3" server
    if [ "$option" != "server" ] && [ -n "$value" ]; then
        uci set "${key}=${value}"
        return "$?"
    fi

    # DNS server entries contain no whitespace. Reject quoted UCI lists rather
    # than turning this helper into another shell parser.
    case "$value" in
    *\'*)
        log error "Unsupported Dnsmasq list format; settings left unchanged."
        return 1
        ;;
    esac
    _dnsmasq_delete_option "$key" || return 1
    if [ -z "$value" ]; then
        uci add_list "${key}="
        return "$?"
    fi
    set -f
    for server in $value; do
        uci add_list "${key}=${server}" || return 1
    done
)

_dnsmasq_merge_servers() (
    local servers="$1 $2" upstream="$3" server merged=""
    case "$servers" in
    *\'*)
        log error "Unsupported Dnsmasq list format; backup preserved." >&2
        return 1
        ;;
    esac
    set -f
    for server in $servers; do
        [ "$server" = "$upstream" ] && continue
        case " $merged " in
        *" $server "*) continue ;;
        esac
        merged="${merged:+${merged} }${server}"
    done
    printf '%s' "$merged"
)

dnsmasq_update() {
    local apply_changes="$1" dns_listen_port="$2" prefix="$3"
    local section="$DNSMASQ_UCI_SECTION" option value
    local upstream="127.0.0.1#${dns_listen_port}"

    dnsmasq_restore "$prefix" || return 1
    [ "$apply_changes" = "1" ] || return 0
    [ "$(uci -q get "$section")" = "dnsmasq" ] || return 1

    value=$(uci -q get "${section}.server") || value=""
    case " $value " in
    *" $upstream "*)
        log error "Dnsmasq already uses this upstream without an active JustClash backup."
        return 1
        ;;
    esac

    for option in server noresolv cachesize; do
        if value=$(uci -q get "${section}.${option}"); then
            _dnsmasq_write_option "${section}.${prefix}_${option}" "$value" "$option" || return 1
            uci set "${section}.${prefix}_${option}_present=1" || return 1
        else
            _dnsmasq_delete_option "${section}.${prefix}_${option}" || return 1
            uci set "${section}.${prefix}_${option}_present=0" || return 1
        fi
    done
    uci set "${section}.${prefix}_applied_server=${upstream}" || return 1
    # This flag means cleanup may be needed, including after a failed apply.
    uci set "${section}.${prefix}_applied=1" || return 1
    uci commit "$DNSMASQ_UCI_PACKAGE" || return 1

    _dnsmasq_write_option "${section}.server" "$upstream" server || return 1
    uci set "${section}.cachesize=0" || return 1
    uci set "${section}.noresolv=1" || return 1
    uci commit "$DNSMASQ_UCI_PACKAGE" || return 1
    "$DNSMASQ_INITD_PATH" restart >/dev/null 2>&1 || return 1
    log info "Dnsmasq configuration updated."
}

# Restore what was applied, not what the next configuration happens to request.
dnsmasq_restore() {
    local prefix="$1" sections section applied upstream field
    local option present original current current_present expected
    local merged_servers=""
    sections=$(uci -q -X show "$DNSMASQ_UCI_PACKAGE") || return 1
    sections=$(printf '%s\n' "$sections" | sed -n 's/^\(dhcp\.[A-Za-z0-9_]*\)=dnsmasq$/\1/p')

    for section in $sections; do
        applied=$(uci -q get "${section}.${prefix}_applied") || applied=""
        case "$applied" in
        0) continue ;;
        1) ;;
        *)
            for field in state applied_server server noresolv cachesize server_present noresolv_present cachesize_present; do
                if uci -q get "${section}.${prefix}_${field}" >/dev/null 2>&1; then
                    log error "Legacy or incomplete Dnsmasq backup needs manual recovery; backup preserved."
                    return 1
                fi
            done
            [ -z "$applied" ] || return 1
            continue
            ;;
        esac

        upstream=$(uci -q get "${section}.${prefix}_applied_server") || return 1
        [ -n "$upstream" ] || return 1

        # Check all three options before changing any of them.
        for option in server noresolv cachesize; do
            present=$(uci -q get "${section}.${prefix}_${option}_present") || return 1
            original=""
            case "$present" in
            0) ;;
            1) original=$(uci -q get "${section}.${prefix}_${option}") || return 1 ;;
            *) return 1 ;;
            esac
            current_present=1
            current=$(uci -q get "${section}.${option}") || current_present=0
            if [ "$option" = "server" ]; then
                # An added DNS server is not a reason to hold cleanup hostage.
                merged_servers=$(_dnsmasq_merge_servers "$original" "$current" "$upstream") || return 1
                continue
            fi
            if [ "$current_present" = "$present" ] && [ "$current" = "$original" ]; then
                continue
            fi
            case "$option" in
            noresolv) expected=1 ;;
            cachesize) expected=0 ;;
            esac
            if [ "$current_present" != "1" ] || [ "$current" != "$expected" ]; then
                log error "Dnsmasq settings changed outside JustClash; backup preserved."
                return 1
            fi
        done

        for option in server noresolv cachesize; do
            present=$(uci -q get "${section}.${prefix}_${option}_present") || return 1
            if [ "$option" = "server" ]; then
                if [ -n "$merged_servers" ] || [ "$present" = "1" ]; then
                    _dnsmasq_write_option "${section}.server" "$merged_servers" server || return 1
                else
                    _dnsmasq_delete_option "${section}.server" || return 1
                fi
                continue
            fi
            if [ "$present" = "1" ]; then
                original=$(uci -q get "${section}.${prefix}_${option}") || return 1
                _dnsmasq_write_option "${section}.${option}" "$original" "$option" || return 1
            else
                _dnsmasq_delete_option "${section}.${option}" || return 1
            fi
        done
        uci commit "$DNSMASQ_UCI_PACKAGE" || return 1
        "$DNSMASQ_INITD_PATH" restart >/dev/null 2>&1 || return 1

        # Keep the snapshot; the next apply overwrites it. No backup of backups.
        uci set "${section}.${prefix}_applied=0" || return 1
        uci commit "$DNSMASQ_UCI_PACKAGE" || return 1
        log info "Dnsmasq configuration restored."
    done
    return 0
}
