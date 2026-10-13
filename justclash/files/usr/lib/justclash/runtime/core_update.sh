#!/bin/ash
# shellcheck shell=dash

get_latest_version_url() {
    local check_url="$1" channel="$2"

    local api_url jq_filter

    if [ "$channel" = "alpha" ]; then
        api_url="${check_url%/latest}"
        # shellcheck disable=SC2016
        jq_filter='[.[] | select(.tag_name == "Prerelease-Alpha")][0].assets[] | select(.name == "version.txt") | .browser_download_url'
    else
        api_url="$check_url"
        jq_filter='.assets[] | select(.name == "version.txt") | .browser_download_url'
    fi

    (
        set -o pipefail
        http_get_https "$api_url" | jq -er "$jq_filter"
    )
}

core_update_source_resolve() {
    local source_type="$1" custom_url="$2" channel="$3" repository="$4"

    local check_url

    if [ "$source_type" = custom ]; then
        case "$custom_url" in
        https://?*) ;;
        *)
            log error "Custom core updates require an HTTPS source."
            return 1
            ;;
        esac
        printf '%s/version.txt\n' "${custom_url%/}"
        return 0
    fi

    check_url="https://api.github.com/repos/${repository}/releases/latest"
    get_latest_version_url "$check_url" "$channel"
}

core_update_latest_version_get() {
    local version_url="$1"

    (
        set -o pipefail
        http_get_https "$version_url" | sed -n 1p | tr -d '\r\n'
    )
}

get_release_asset_digest() {
    local check_url="$1" channel="$2" asset_name="$3"
    local api_url jq_filter

    if [ "$channel" = alpha ]; then
        api_url="${check_url%/latest}"
        # shellcheck disable=SC2016
        jq_filter='[.[] | select(.tag_name == "Prerelease-Alpha")][0].assets[] | select(.name == $name) | .digest'
    else
        api_url="$check_url"
        # shellcheck disable=SC2016
        jq_filter='.assets[] | select(.name == $name) | .digest'
    fi

    (
        set -o pipefail
        http_get_https "$api_url" | jq -er --arg name "$asset_name" "$jq_filter"
    )
}

core_sha256_validate() {
    local digest="$1"
    [ "${#digest}" -eq 64 ] || return 1
    case "$digest" in
    *[!0-9a-fA-F]*) return 1 ;;
    esac
    return 0
}

core_update_expected_sha256_get() {
    local source_type="$1" version_url="$2" version="$3" arch="$4" channel="$5" repository="$6"
    local filename digest expected_sha256 check_url
    filename="mihomo-linux-${arch}-${version}.gz"

    if [ "$source_type" = custom ]; then
        # Select exactly one archive entry; the first line is not a lucky dip.
        expected_sha256=$(
            set -o pipefail
            http_get_https "${version_url%/*}/checksums.txt" | awk -v filename="$filename" '
                {
                    sub(/\r$/, "")
                    name = $2
                    sub(/^\*/, "", name)
                    sub(/^\.\//, "", name)
                    if (name == filename) {
                        count++
                        if (NF != 2) invalid = 1
                        digest = $1
                    }
                }
                END {
                    if (count != 1 || invalid) exit 1
                    print digest
                }
            '
        ) || return 1
    else
        check_url="https://api.github.com/repos/${repository}/releases/latest"
        digest=$(get_release_asset_digest "$check_url" "$channel" "$filename") || return 1
        case "$digest" in
        sha256:*) expected_sha256="${digest#sha256:}" ;;
        *) return 1 ;;
        esac
    fi

    core_sha256_validate "$expected_sha256" || return 1
    printf '%s' "$expected_sha256" | tr 'A-F' 'a-f'
}

# Applies a previously verified gzip archive; returns 5 for an I/O failure.
core_archive_apply() {
    local archive_path="$1" destination="$2"

    gunzip -c "$archive_path" >"$destination" || return 5
    chmod 755 "$destination" || return 5
    return 0
}

# Returns 0 on success, 5 for workspace I/O, 6 for download failure,
# and 7 for a failed SHA256 check or an archive that cannot be applied.
# Deferred removal failures retain core_binary_remove() statuses.
core_download() {
    local version_url="$1" version="$2"
    local core_workdir="$3" core_path="$4" arch="$5" expected_sha256="$6"

    local filename base_url download_url archive_path actual_sha256 rc

    core_sha256_validate "$expected_sha256" || {
        log error "A valid SHA256 digest is required for the Mihomo archive."
        return 7
    }
    expected_sha256=$(printf '%s' "$expected_sha256" | tr 'A-F' 'a-f')

    mkdir -p "$core_workdir" || return 5
    archive_path=$(mktemp "${core_workdir}/mihomo.XXXXXX") || return 5
    filename="mihomo-linux-${arch}-${version}.gz"
    base_url="${version_url%/*}"
    download_url="${base_url}/${filename}"

    log info "Downloading Mihomo binary"
    http_download_https "$download_url" "$archive_path" || {
        rm -f "$archive_path"
        log error "Failed to download the Mihomo archive."
        return 6
    }

    actual_sha256=$(sha256sum "$archive_path" 2>/dev/null) || {
        rm -f "$archive_path"
        log error "Failed to calculate the Mihomo archive SHA256 digest."
        return 7
    }
    if [ "${actual_sha256%% *}" != "$expected_sha256" ]; then
        rm -f "$archive_path"
        log error "SHA256 verification failed for the Mihomo archive."
        return 7
    fi

    # Downloads are .gz archives. An error page is not an alternative format.
    if ! gzip -t "$archive_path" 2>/dev/null; then
        rm -f "$archive_path"
        log error "Invalid Mihomo gzip archive."
        return 7
    fi

    if [ -x "$core_path" ]; then
        log info "Removing current Mihomo binary after archive verification..."
        core_binary_remove "$core_path"
        rc=$?
        if [ "$rc" -ne 0 ]; then
            rm -f "$archive_path"
            return "$rc"
        fi
    fi

    log info "Applying Mihomo binary to $core_path"
    if ! core_archive_apply "$archive_path" "$core_path"; then
        rm -f "$archive_path"
        log error "Failed to apply the Mihomo archive."
        return 7
    fi

    rm -f "$archive_path" || log error "Failed to clean up the temporary archive."
    log info "Mihomo installed at $core_path"
    return 0
}

# Propagates core_download() and core_binary_remove() operation statuses,
# and returns 1 for source/version metadata errors,
# 7 for unavailable checksum metadata, 8 for an unsupported architecture.
core_update_run() {
    local source_type="$1" custom_url="$2" channel="$3" repository="$4"
    local core_workdir="$5" core_path="$6" no_data_string="$7"
    local current_version latest_version version_url
    local arch os_arch rc expected_sha256

    if [ "$source_type" = custom ]; then
        log info "Checking for Mihomo updates from custom source..."
    else
        log info "Checking for Mihomo updates from configured repository (channel: $channel)..."
    fi

    version_url=$(core_update_source_resolve \
        "$source_type" "$custom_url" "$channel" "$repository") || {
        log error "Failed to resolve the core version source."
        return 1
    }
    [ -n "$version_url" ] || {
        log error "Release version metadata was not found."
        return 1
    }

    latest_version=$(core_update_latest_version_get "$version_url") || {
        log error "Failed to download core version metadata."
        return 1
    }
    [ -n "$latest_version" ] || {
        log error "Failed to retrieve the latest version information."
        return 1
    }

    current_version=$(core_info_mihomo "$core_path" "$no_data_string")

    if [ "$current_version" = "$no_data_string" ] || [ -z "$current_version" ]; then
        log warn "Mihomo is not installed. Installing version $latest_version."
    else
        log info "Current Mihomo version: $current_version"
        log info "Latest Mihomo version: $latest_version"
        if [ "$current_version" = "$latest_version" ]; then
            log info "Mihomo is already up-to-date."
            return 0
        fi
    fi

    os_arch=$(sysinfo_get_os_arch)
    arch=$(core_detect_arch "$os_arch") || {
        log error "Unsupported OpenWrt architecture: ${os_arch:-unknown}"
        return 8
    }

    expected_sha256=$(core_update_expected_sha256_get \
        "$source_type" "$version_url" "$latest_version" "$arch" "$channel" "$repository") || {
        log error "Failed to obtain a valid SHA256 digest for the Mihomo archive."
        return 7
    }

    core_download \
        "$version_url" "$latest_version" \
        "$core_workdir" "$core_path" "$arch" "$expected_sha256"
    rc=$?
    if [ "$rc" -ne 0 ]; then
        log error "Core update failed."
        return "$rc"
    fi

    return 0
}
