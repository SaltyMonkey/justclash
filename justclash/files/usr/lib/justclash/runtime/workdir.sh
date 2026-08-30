#!/bin/ash
# shellcheck shell=dash

workdir_cache_fingerprint() {
    local uci_hash="$1"
    local controller_bind_address="$2"
    local file_path file_hash
    local fingerprint
    shift 2

    fingerprint=$(printf 'generator=%s|uci=%s|controller=%s' \
        "$JUSTCLASH_VERSION" \
        "$uci_hash" \
        "$controller_bind_address") || return 1

    for file_path in "$@"; do
        if [ -f "$file_path" ]; then
            file_hash=$(str_md5 <"$file_path") || return 1
            fingerprint="${fingerprint}|file-present=${file_path}:${file_hash}"
        else
            fingerprint="${fingerprint}|file-missing=${file_path}"
        fi
    done

    printf '%s\n' "$fingerprint" | str_md5
}

# Returns 0 when ready, 5 when the workdir cannot be recreated.
workdir_ensure() {
    local workdir_path="$1"
    local owner current_uid

    if [ -L "$workdir_path" ] || [ ! -d "$workdir_path" ]; then
        [ -e "$workdir_path" ] || [ -L "$workdir_path" ] && log warn "Removing invalid path at $workdir_path"
        rm -rf "$workdir_path" || return 5
        # shellcheck disable=SC2174
        mkdir -m 700 -p "$workdir_path" || return 5
        return 0
    fi

    # shellcheck disable=SC2012
    owner=$(ls -ldn "$workdir_path" 2>/dev/null | awk '{print $3}')
    current_uid=$(id -u)
    if [ -n "$owner" ] && [ "$owner" != "$current_uid" ]; then
        log warn "Removing insecure directory at $workdir_path owned by UID $owner"
        rm -rf "$workdir_path" || return 5
        # shellcheck disable=SC2174
        mkdir -m 700 -p "$workdir_path" || return 5
    fi

    return 0
}

# Predicate: returns 0 for a reusable cache, 1 when regeneration is required.
workdir_cache_check() {
    local current_hash="$1"
    local hash_path="$2"
    local output_config_path="$3"
    local active_ipcidr_path="$4"
    local active_static_ips_path="$5"
    local active_static_source_ips_path="$6"
    local saved_hash

    saved_hash=$(cat "$hash_path" 2>/dev/null)

    if [ ! -f "$output_config_path" ] ||
        [ ! -f "$active_ipcidr_path" ] ||
        [ ! -f "$active_static_ips_path" ] ||
        [ ! -f "$active_static_source_ips_path" ]; then
        return 1
    fi

    if [ "$current_hash" != "$saved_hash" ]; then
        log info "Existing $output_config_path is outdated and will be regenerated."
        return 1
    fi

    log info "Existing $output_config_path is up to date and will be reused."
    return 0
}

# Returns 0 when committed, 5 when any filesystem operation fails.
workdir_cache_commit() {
    local current_hash="$1"
    local hash_path="$2"
    local hash_tmp_path

    hash_tmp_path=$(mktemp "${hash_path}.XXXXXX") || return 5
    if ! printf '%s\n' "$current_hash" >"$hash_tmp_path"; then
        rm -f "$hash_tmp_path"
        return 5
    fi

    chmod 600 "$hash_tmp_path" || {
        rm -f "$hash_tmp_path"
        return 5
    }

    mv -f "$hash_tmp_path" "$hash_path" || {
        rm -f "$hash_tmp_path"
        return 5
    }

    return 0
}

# Returns 0 when applied or unchanged, 5 when a filesystem operation fails.
workdir_persistent_rules_apply() {
    local enabled="$1"
    local workdir_rules_path="$2"
    local persistent_rules_path="$3"

    if [ "$enabled" -eq 1 ] && [ ! -L "$workdir_rules_path" ]; then
        log info "Creating symlink $persistent_rules_path -> $workdir_rules_path"
        rm -rf "$workdir_rules_path" || return 5
        mkdir -p "$persistent_rules_path" || return 5
        ln -sf "$persistent_rules_path" "$workdir_rules_path" || return 5
    elif [ "$enabled" -eq 0 ] && [ -L "$workdir_rules_path" ]; then
        log info "Removing old symlink $persistent_rules_path -> $workdir_rules_path"
        rm -rf "$persistent_rules_path" || return 5
        rm -rf "$workdir_rules_path" || return 5
    fi

    return 0
}

# Returns 0 when applied or unchanged, 5 when a filesystem operation fails.
workdir_persistent_cache_apply() {
    local enabled="$1"
    local workdir_cache_path="$2"
    local persistent_cache_path="$3"

    if [ "$enabled" -eq 1 ] && [ ! -L "$workdir_cache_path" ]; then
        log info "Creating symlink $persistent_cache_path -> $workdir_cache_path"
        rm -f "$workdir_cache_path" || return 5
        mkdir -p "${persistent_cache_path%/*}" || return 5
        ln -sf "$persistent_cache_path" "$workdir_cache_path" || return 5
    elif [ "$enabled" -eq 0 ] && [ -L "$workdir_cache_path" ]; then
        log info "Removing old symlink $persistent_cache_path -> $workdir_cache_path"
        rm -f "$persistent_cache_path" || return 5
        rm -f "$workdir_cache_path" || return 5
    fi

    return 0
}
