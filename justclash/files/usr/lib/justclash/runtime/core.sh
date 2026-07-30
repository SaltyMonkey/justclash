#!/bin/ash
# shellcheck shell=dash

# Returns 0 for a valid configuration, 2 when core validation rejects it.
core_validate_yaml() {
    local core_path="$1"
    local workdir_path="$2"
    local config_path="$3"
    local test_output app_exit_code

    test_output="$("$core_path" -t -d "$workdir_path" -f "$config_path" 2>&1)"
    app_exit_code=$?

    case "$test_output" in
    *[Tt]est\ failed* | *[Ee]rror*) app_exit_code=1 ;;
    esac

    if [ "$app_exit_code" -ne 0 ]; then
        log error "Generated YAML configuration is invalid."
        log error "$test_output"
        log error "Mihomo configuration validation failed."
        return 2
    fi

    return 0
}

info_mihomo() {
    local core_path="$1"
    local no_data_string="$2"
    local out

    if [ ! -x "$core_path" ]; then
        echo "$no_data_string"
    else
        out="$("$core_path" -v 2>/dev/null)"
        out="${out#* * }"
        echo "${out%% *}"
    fi
}

detect_arch() {
    local arch_raw="$1"

    case "$arch_raw" in
    aarch64_*) echo "arm64" ;;
    mips_*)
        [ "${arch_raw#*hardfloat}" != "$arch_raw" ] && echo "mips-hardfloat" || echo "mips-softfloat"
        ;;
    mipsel_*)
        [ "${arch_raw#*hardfloat}" != "$arch_raw" ] && echo "mipsle-hardfloat" || echo "mipsle-softfloat"
        ;;
    mips64_*) echo "mips64" ;;
    mips64el_*) echo "mips64le" ;;
    x86_64) echo "amd64" ;;
    i386_*) echo "386" ;;
    riscv64_*) echo "riscv64" ;;
    loongarch64_*) echo "loong64-abi2" ;;
    *_neon-vfp*) echo "armv7" ;;
    *_neon* | *_vfp*) echo "armv6" ;;
    arm_*) echo "armv5" ;;
    *) echo "amd64" ;;
    esac
}

# Returns 0 when removed, 3 when absent, 5 when the filesystem operation fails.
core_binary_remove() {
    local core_path="$1"

    if [ ! -x "$core_path" ]; then
        log error "Mihomo is not installed."
        return 3
    fi

    if rm -f "$core_path"; then
        log info "Mihomo is removed."
        return 0
    fi

    log error "Failed to remove Mihomo binary: $core_path"
    return 5
}
