#!/bin/ash
# shellcheck shell=dash

yaml_json_format() {
    jq --indent "${1:-2}" .
}

yaml_slash_multimap_build() {
    printf '%s\n' "$1" |
        jq --indent 4 -Rn '
            reduce inputs as $entry ({};
                ($entry | index("/")) as $separator |
                if $separator == null or $separator == 0 or $separator == ($entry | length) - 1 then
                    .
                else
                    ($entry[0:$separator]) as $matcher |
                    ($entry[$separator + 1:]) as $nameserver |
                    if ((.[$matcher] // []) | index($nameserver)) == null then
                        .[$matcher] = ((.[$matcher] // []) + [$nameserver])
                    else
                        .
                    end
                end
            )
        '
}

yaml_nameserver_policy_build() {
    printf '[%s,%s,%s,%s]\n' "$1" "$2" "$3" "$4" |
        jq --indent 4 'add'
}

yaml_fake_ip_filter_build() {
    printf '[%s,%s,%s,%s,%s]\n' "$1" "$2" "$3" "$4" "$5" |
        jq --indent 4 \
        '
        (add + ["MATCH,real-ip"]) | reduce .[] as $item (
            {seen: {}, items: []};
            if (.seen | has($item)) then
                .
            else
                .seen[$item] = true
                | .items += [$item]
            end
        ) | .items
        '
}

yaml_rule_providers_merge() {
    printf '[%s,%s,%s]\n' "$1" "$2" "$3" |
        jq 'reduce .[] as $item ({}; . * $item)'
}

yaml_rules_merge() {
    printf '[%s,%s,%s,%s,%s,%s]\n' "$1" "$2" "$3" "$4" "$5" "$6" |
        jq 'add | map(select(length > 0))'
}
