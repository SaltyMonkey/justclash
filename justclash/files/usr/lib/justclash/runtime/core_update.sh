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
        http_get "$api_url" | jq -r "$jq_filter"
    )
}

core_update_source_resolve() {
    local source_type="$1" custom_url="$2" channel="$3" repository="$4"

    local check_url

    if [ "$source_type" = custom ]; then
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
        http_get "$version_url" | sed -n 1p | tr -d '\r\n'
    )
}

core_archive_download() {
    local download_url="$1" archive_path="$2"

    http_download "$download_url" "$archive_path" 0
}

# Returns 0 when installed, 5 when the destination cannot be written.
core_archive_apply() {
    local archive_path="$1" destination="$2"

    if gzip -t "$archive_path" 2>/dev/null; then
        gunzip -c "$archive_path" >"$destination" || return 5
    else
        cp "$archive_path" "$destination" || return 5
    fi

    chmod +x "$destination" || return 5
    return 0
}

# Returns 0 on success, 5 for workspace I/O, 6 for download failure,
# and 7 when the downloaded archive cannot be applied.
core_download() {
    local version_url="$1" version="$2"
    local core_workdir="$3" core_path="$4" arch="$5"

    local filename base_url download_url archive_path

    mkdir -p "$core_workdir" || return 5
    archive_path=$(mktemp "${core_workdir}/mihomo.XXXXXX") || return 5
    filename="mihomo-linux-${arch}-${version}.gz"
    base_url="${version_url%/*}"
    download_url="${base_url}/${filename}"

    log info "Downloading Mihomo binary"
    core_archive_download "$download_url" "$archive_path" || {
        rm -f "$archive_path"
        log error "Failed to download the Mihomo archive."
        return 6
    }

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
# and returns 8 for an unsupported OpenWrt architecture.
core_update_apply() {
    local current_version="$1" latest_version="$2" version_url="$3"
    local no_data_string="$4" core_workdir="$5" core_path="$6"
    local arch install_required=0 os_arch rc

    if [ "$current_version" = "$no_data_string" ] || [ -z "$current_version" ]; then
        log warn "Mihomo is not installed. Installing version $latest_version."
        install_required=1
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

    if [ "$install_required" -eq 0 ]; then
        log info "Removing current mihomo binary..."
        core_binary_remove "$core_path"
        rc=$?
        if [ "$rc" -ne 0 ]; then
            log error "Core update failed."
            return "$rc"
        fi

        log info "Updating Mihomo to version $latest_version"
    fi

    core_download \
        "$version_url" "$latest_version" \
        "$core_workdir" "$core_path" "$arch"
    rc=$?
    if [ "$rc" -ne 0 ]; then
        log error "Core update failed."
        return "$rc"
    fi

    return 0
}
