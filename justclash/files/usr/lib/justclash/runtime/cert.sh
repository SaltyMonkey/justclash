#!/bin/ash
# shellcheck shell=dash
# Constants are loaded by the CLI before this module.
# shellcheck disable=SC2154

cert_prepare() (
    local api_tls_cert="$1" api_tls_key="$2" mode="$3"
    local san="" name cert_file key_file tls_tmpdir cert_public_key key_public_key
    local validity_days=3650

    command -v openssl >/dev/null 2>&1 || {
        log error "openssl-util is required for TLS commands." >&2
        exit 1
    }

    shift 3
    if [ "$mode" = "generate" ]; then
        for name in "$@"; do
            case "$name" in
            DNS:?* | IP:?*) san="${san:+$san,}$name" ;;
            *)
                log error "Expected SAN entries in DNS:name or IP:address form." >&2
                exit 2
                ;;
            esac
        done
    fi

    umask 077
    mkdir -p "$PROG_ETC_DIR" "$(dirname "$api_tls_cert")" "$(dirname "$api_tls_key")" || exit 1
    tls_tmpdir=$(mktemp -d "$PROG_ETC_DIR/.tls.XXXXXX") || exit 1
    trap 'rm -rf "$tls_tmpdir"' EXIT
    trap 'exit 1' HUP INT TERM

    case "$mode" in
    uhttpd)
        cert_file=$(uci -q get uhttpd.main.cert)
        key_file=$(uci -q get uhttpd.main.key)
        cert_file=${cert_file:-$DEFAULT_UHTTPD_CERT_PATH}
        key_file=${key_file:-$DEFAULT_UHTTPD_KEY_PATH}

        # PEM chains deserve to survive the copy; x509 only keeps the first cert.
        if grep -q '^-----BEGIN CERTIFICATE-----' "$cert_file"; then
            cp "$cert_file" "$tls_tmpdir/cert.pem" || exit 1
        elif ! openssl x509 -in "$cert_file" -outform PEM -out "$tls_tmpdir/cert.pem" 2>/dev/null; then
            log error "Failed to convert the uhttpd certificate to PEM." >&2
            exit 1
        fi
        openssl pkey -in "$key_file" -passin pass: -outform PEM -out "$tls_tmpdir/key.pem" 2>/dev/null || {
            log error "Failed to convert the uhttpd private key to PEM." >&2
            exit 1
        }
        ;;
    generate)
        openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -noenc -sha256 \
            -days "$validity_days" -subj '/CN=JustClash' \
            -keyout "$tls_tmpdir/key.pem" -out "$tls_tmpdir/cert.pem" \
            -addext 'basicConstraints=critical,CA:FALSE' \
            -addext 'extendedKeyUsage=serverAuth' -addext "subjectAltName=$san" 2>/dev/null || {
            log error "Failed to generate the controller TLS certificate." >&2
            exit 1
        }
        ;;
    esac

    cert_public_key=$(openssl x509 -in "$tls_tmpdir/cert.pem" -pubkey -noout 2>/dev/null) &&
        key_public_key=$(openssl pkey -in "$tls_tmpdir/key.pem" -pubout 2>/dev/null) &&
        [ -n "$cert_public_key" ] && [ "$cert_public_key" = "$key_public_key" ] || {
        log error "The TLS certificate and private key do not form a valid pair." >&2
        exit 1
    }

    chmod 644 "$tls_tmpdir/cert.pem" && chmod 600 "$tls_tmpdir/key.pem" &&
        mv -f "$tls_tmpdir/cert.pem" "$api_tls_cert" &&
        mv -f "$tls_tmpdir/key.pem" "$api_tls_key" || exit 1

    log info "Controller TLS files saved to $api_tls_cert and $api_tls_key."
)
