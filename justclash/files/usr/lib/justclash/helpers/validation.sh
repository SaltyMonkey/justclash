#!/bin/ash
# shellcheck shell=dash

# Focused helper module loaded into the main ash process.

parse_routing_mark() {
    local val="$1"
    local reserved_marks="$2"
    [ -z "$val" ] && return 0

    case "$val" in
    0[xX]*[!0-9a-fA-F]*)
        echo "-1"
        return 0
        ;;
    0[xX])
        echo "-1"
        return 0
        ;;
    0[xX]*) ;;
    *[!0-9]*)
        echo "-1"
        return 0
        ;;
    *) ;;
    esac

    local dec_val
    dec_val=$(printf "%d" "$val" 2>/dev/null)
    if [ "$dec_val" = "0" ] && [ "$val" != "0" ] && [ "$val" != "0x0" ] && [ "$val" != "0X0" ]; then
        echo "-1"
        return 0
    fi

    local res_mark dec_res_mark
    for res_mark in $reserved_marks; do
        dec_res_mark=$(printf "%d" "$res_mark" 2>/dev/null)
        if [ "$dec_val" = "$dec_res_mark" ]; then
            echo "-1"
            return 0
        fi
    done

    echo "$dec_val"
}

parse_ip_version() {
    case "$1" in
    dual | ipv4 | ipv6 | ipv4-prefer | ipv6-prefer) printf '%s' "$1" ;;
    *) printf 'dual' ;;
    esac
}

validate_cron_expr() {
    local expr="$1"
    local field

    # Split the expression into cron fields and reject extra tokens.
    # shellcheck disable=SC2086
    set -- $expr
    [ "$#" -eq 5 ] || return 1

    for field in "$@"; do
        case "$field" in
        '' | *[!0-9*/,-]*)
            return 1
            ;;
        *) ;;
        esac
    done

    return 0
}

is_uint() {
    case "$1" in
    '' | *[!0-9]*) return 1 ;;
    *) return 0 ;;
    esac
}

is_port() {
    is_uint "$1" && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

is_ifname() {
    case "$1" in
    '' | *[!A-Za-z0-9_.:-]*) return 1 ;;
    *) return 0 ;;
    esac
}

sanitize_nft_name() {
    printf '%s\n' "$1" |
        LC_ALL=C awk '{
            gsub(/[-.]/, "_")
            gsub(/[^a-zA-Z0-9_]/, "")
            value = value $0
        }
        END {
            print substr(value, 1, 31)
        }'
}

is_choice() {
    local value="$1"
    shift
    local item

    for item in "$@"; do
        [ "$value" = "$item" ] && return 0
    done

    return 1
}
