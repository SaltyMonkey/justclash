#!/bin/ash
# shellcheck shell=dash
# OUT_INBOUNDS and OUT_INBOUND_RULES belong to the caller's build context.
# shellcheck disable=SC2034

yaml_listeners_build() {
    local tproxy_port="$1" ipv6_enabled="$2" inbounds="${3:-}"
    local listeners

    listeners="{\"name\":\"tproxy-v4\",\"type\":\"tproxy\",\"port\":$tproxy_port,\"listen\":\"127.0.0.1\"}"
    if [ "$ipv6_enabled" = "1" ]; then
        listeners="$listeners,{\"name\":\"tproxy-v6\",\"type\":\"tproxy\",\"port\":$tproxy_port,\"listen\":\"::1\"}"
    fi
    listeners="$listeners${inbounds:+,$inbounds}"
    printf '[%s]\n' "$listeners"
}

yaml_inbound_append() {
    local listener_name="$1" port="$2" authentication="$3"
    local exit_rule="$4" inbound_type="$5"
    local entry username password users="" listener rule udp=""
    # NL is supplied by constants.sh, as in the other shell builders.
    # shellcheck disable=SC2154
    local IFS="$NL"

    port="${port#"${port%%[!0]*}"}"
    port="${port:-0}"

    for entry in $authentication; do
        [ -n "$entry" ] || continue
        username="${entry%%:*}"
        password="${entry#*:}"
        if [ "$username" = "$entry" ] || [ -z "$username" ] || [ -z "$password" ]; then
            log warn "Skip inbound '$listener_name': invalid authentication entry." >&2
            return
        fi
        entry=$(printf '{"username":"%s","password":"%s"}' \
            "$(str_json_escape "$username")" "$(str_json_escape "$password")")
        users="${users:+$users,}$entry"
    done
    if [ -z "$users" ]; then
        log warn "Skip inbound '$listener_name': authentication is empty." >&2
        return
    fi
    users="[$users]"
    inbound_type=$(str_json_escape "$inbound_type")
    [ "$inbound_type" = "http" ] || udp=',"udp":true'

    listener=$(printf '{"name":"%s","type":"%s","listen":"0.0.0.0","port":%s%s,"users":%s}' \
        "$(str_json_escape "$listener_name")" "$inbound_type" "$port" "$udp" "$users")

    OUT_INBOUNDS="${OUT_INBOUNDS:+$OUT_INBOUNDS,}$listener"
    if [ "$exit_rule" != "BY RULES" ]; then
        rule=$(str_json_escape "IN-NAME,$listener_name,$exit_rule")
        OUT_INBOUND_RULES="${OUT_INBOUND_RULES:+$OUT_INBOUND_RULES,}\"$rule\""
    fi
}
