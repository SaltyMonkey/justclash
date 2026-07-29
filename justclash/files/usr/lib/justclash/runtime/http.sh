#!/bin/ash
# shellcheck shell=dash

HTTP_CONNECT_TIMEOUT=15
HTTP_MIN_SPEED_LIMIT_BYTES=5000
HTTP_MIN_SPEED_TIMEOUT=15

http_get() {
    local url="$1"

    curl --connect-timeout "$HTTP_CONNECT_TIMEOUT" \
        --speed-limit "$HTTP_MIN_SPEED_LIMIT_BYTES" \
        --speed-time "$HTTP_MIN_SPEED_TIMEOUT" \
        -sL "$url"
}

http_download() {
    local url="$1"
    local destination="$2"
    local fail_on_http_error="${3:-0}"

    if [ "$fail_on_http_error" = "1" ]; then
        curl --connect-timeout "$HTTP_CONNECT_TIMEOUT" \
            --speed-limit "$HTTP_MIN_SPEED_LIMIT_BYTES" \
            --speed-time "$HTTP_MIN_SPEED_TIMEOUT" \
            --progress-bar -L -f -o "$destination" "$url"
    else
        curl --connect-timeout "$HTTP_CONNECT_TIMEOUT" \
            --speed-limit "$HTTP_MIN_SPEED_LIMIT_BYTES" \
            --speed-time "$HTTP_MIN_SPEED_TIMEOUT" \
            --progress-bar -L -o "$destination" "$url"
    fi
}