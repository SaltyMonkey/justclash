#!/bin/ash
# shellcheck shell=dash

HTTP_CONNECT_TIMEOUT=15
HTTP_MIN_SPEED_LIMIT_BYTES=5000
HTTP_MIN_SPEED_TIMEOUT=15

_http_curl() {
    curl --connect-timeout "$HTTP_CONNECT_TIMEOUT" \
        --speed-limit "$HTTP_MIN_SPEED_LIMIT_BYTES" \
        --speed-time "$HTTP_MIN_SPEED_TIMEOUT" \
        -L "$@"
}

http_get() {
    _http_curl -s -- "$1"
}

http_download() {
    local url="$1"
    local destination="$2"
    local fail_on_http_error="${3:-0}"

    if [ "$fail_on_http_error" = "1" ]; then
        set -- -f
    else
        set --
    fi

    _http_curl \
        "$@" \
        --progress-bar \
        -o "$destination" \
        -- "$url"
}
