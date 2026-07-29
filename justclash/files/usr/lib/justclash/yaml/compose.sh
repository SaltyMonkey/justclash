#!/bin/ash
# shellcheck shell=dash

yaml_json_format() {
    jq --indent "${1:-2}" .
}

yaml_nameserver_policy_build() {
    jq --indent 4 -n \
        --argjson custom_entries "$1" \
        --arg rulesets "$2" \
        --arg suffixes "$3" \
        --arg geosite "$4" \
        '
        $custom_entries |
        if $rulesets != "" then
            . + {($rulesets): "rcode://success"}
        else . end |
        if $geosite != "" then
            . + {($geosite): "rcode://success"}
        else . end |
        if $suffixes != "" then
            . + {($suffixes): "rcode://success"}
        else . end
        '
}

yaml_fake_ip_filter_build() {
    jq --indent 4 -n \
        --arg custom_real "$1" \
        --arg custom_rulesets "$2" \
        --arg custom_geosites "$3" \
        --arg proxy_groups "$4" \
        --arg proxies "$5" \
        '
        (
            ($custom_real | fromjson)
            + ($custom_rulesets | fromjson)
            + ($custom_geosites | fromjson)
            + ($proxy_groups | fromjson)
            + ($proxies | fromjson)
            + ["MATCH,real-ip"]
        ) | reduce .[] as $item ([]; if index($item) then . else . + [$item] end)
        '
}

yaml_rule_providers_merge() {
    jq -n \
        --argjson block "$1" \
        --argjson proxy_groups "$2" \
        --argjson proxies "$3" \
        'reduce [ $block, $proxy_groups, $proxies ][] as $item ({}; . * $item)'
}

yaml_rules_merge() {
    jq -n \
        --arg mixed "$1" \
        --arg block "$2" \
        --arg proxy_groups "$3" \
        --arg proxies "$4" \
        --arg final "$5" \
        '($mixed | fromjson) + ($block | fromjson) + ($proxy_groups | fromjson) + ($proxies | fromjson) + ($final | fromjson) | map(select(length > 0))'
}