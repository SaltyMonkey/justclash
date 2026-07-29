#!/bin/ash
# shellcheck shell=dash

is_pattern_in_file() {
    local file="$1"

    if [ ! -r "$file" ]; then
        log warn "Failed to open file $file"
        return 1
    fi
    shift
    local found_patterns=""
    for pattern in "$@"; do
        if grep -qE "$pattern" "$file"; then
            found_patterns="${found_patterns:+$found_patterns }$pattern"
        fi
    done
    if [ -n "$found_patterns" ]; then
        echo "$found_patterns"
        return 0
    else
        return 1
    fi
}
