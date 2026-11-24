#!/bin/ash
# shellcheck shell=dash

yaml_json_format() {
    jq --indent "${1:-2}" .
}

yaml_slash_multimap_build() {
    printf '%s\n' "$1" |
        jq -Rn -r '
            def format_value:
                if type == "array" and length > 1 then
                    "[\n" + (map("        " + tojson) | join(",\n")) + "\n    ]"
                else
                    tojson
                end;

            reduce inputs as $entry ({};
                ($entry | index("/")) as $separator |
                if $separator == null or $separator == 0 or $separator == ($entry | length) - 1 then
                    .
                else
                    ($entry[0:$separator]) as $matcher |
                    ($entry[$separator + 1:]) as $value |
                    if ((.[$matcher] // []) | index($value)) == null then
                        .[$matcher] = ((.[$matcher] // []) + [$value])
                    else
                        .
                    end
                end
            )
            | if length == 0 then
                "{}"
              else
                "{\n" + (to_entries
                    | map("    \(.key | tojson): \(.value | format_value)")
                    | join(",\n")) + "\n}"
              end
        '
}

yaml_nameserver_policy_build() {
    # The first policy with a given matcher takes precedence.
    printf '[%s,%s,%s,%s]\n' "$1" "$2" "$3" "$4" |
        jq -r '
            def format_value:
                if type == "array" and length > 1 then
                    "[\n" + (map("        " + tojson) | join(",\n")) + "\n    ]"
                else
                    tojson
                end;

            reduce (.[] | to_entries[]) as $entry ({};
                .[$entry.key] //= $entry.value
            )
            | if length == 0 then
                "{}"
              else
                "{\n" + (to_entries
                    | map("    \(.key | tojson): \(.value | format_value)")
                    | join(",\n")) + "\n}"
              end
        '
}

yaml_fake_ip_filter_build() {
    printf '[%s,%s,%s,%s]\n' "$1" "$2" "$3" "$4" |
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
    printf '[%s,%s,%s,%s,%s]\n' "$1" "$2" "$3" "$4" "$5" |
        jq 'add | map(select(length > 0)) + ["MATCH,DIRECT"]'
}
