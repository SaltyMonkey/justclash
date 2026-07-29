#!/bin/ash
# shellcheck shell=dash

# Returns 0 on success, 5 for temporary-file I/O, 6 for download failure,
# and 7 when the downloaded file cannot be promoted.
service_data_file_update() {
    local base_url="$1" filename="$2" destination="$3" workdir="$4"
    local label="$5"
    local download_url tmp_path

    download_url="${base_url%/}/${filename}"
    tmp_path=$(mktemp "${workdir}/${filename}.XXXXXX") || return 5

    log info "Downloading $label"
    http_download \
        "$download_url" \
        "$tmp_path" \
        1 || {
        log error "Failed to download $label."
        rm -f "$tmp_path"
        return 6
    }

    if ! mv -f "$tmp_path" "$destination"; then
        log error "Failed to apply $label."
        rm -f "$tmp_path"
        return 7
    fi

    log info "$label updated."
    return 0
}
