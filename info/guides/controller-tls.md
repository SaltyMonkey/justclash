# Controller TLS

[Documentation](../README.md)

Use this guide when HTTPS LuCI cannot connect to Mihomo, or when you need an
encrypted controller connection for trusted clients. It covers the controller
API, not the explicit Mixed Port listener.

First configure [controller binding and credentials](security.md#controller-binding).
You need a working JustClash setup, a hostname clients can reach, and a certificate
trusted by those clients. The package includes `openssl-util` for the TLS commands.

## Recommended Topologies

| LuCI | Mihomo API | Use |
| --- | --- | --- |
| HTTP on trusted LAN | HTTP/WS on trusted LAN | Simple local-only setup |
| HTTPS | Direct HTTPS/WSS with a trusted PEM certificate | Direct API TLS |
| HTTPS behind reverse proxy | HTTPS/WSS exposed by the same trusted proxy design | Centrally managed TLS |

An HTTPS LuCI page cannot open insecure HTTP or WebSocket controller connections because browsers block mixed content.

## Certificate Format Required by Mihomo

Mihomo uses Go TLS and expects a PEM-encoded certificate and PEM-encoded private key.

The default LuCI/uhttpd certificate files are not a safe drop-in assumption:

- some OpenWrt installations generate them in DER form;
- their certificate name may not match the hostname used by the browser;
- a self-signed issuer may not be trusted by clients;
- replacing them in place can break LuCI HTTPS.

Do not point Mihomo at the LuCI files until their encoding has been verified. Use the separate default files `/etc/justclash/api-cert.pem` and `/etc/justclash/api-key.pem`.

## Convert LuCI/uhttpd DER Files to Separate PEM Files

Installation and upgrades run this command when either destination file is missing or empty:

```sh
justclash.sh cert uhttpd
```

Copies the configured uhttpd certificate and key, converting DER to PEM. Source
files are preserved; repeat after renewing the uhttpd certificate.

## Generate a Dedicated PEM Certificate

```sh
justclash.sh cert generate 'DNS:<ROUTER_HOSTNAME>' 'IP:<ROUTER_ADDRESS>'
```

Replace the placeholders and omit unused SAN entries. Generates ECDSA P-256 valid
for 3650 days. Include each hostname or address clients use.

Both commands replace the configured `api_tls_cert` and `api_tls_key` files,
using the default paths when unset (key mode `600`). Examples below use defaults.
Enable TLS and restart the service separately.

## Validate the PEM Files

```sh
openssl x509 -in /etc/justclash/api-cert.pem -noout -subject -dates
openssl pkey -in /etc/justclash/api-key.pem -noout -check
```

Both commands must succeed. Do not print or copy private-key contents.

## Enable Direct API TLS

LuCI: **Services → JustClash → Setup: Proxy → Controller/API settings**.

```sh
uci set justclash.proxy.api_tls='1'
uci set justclash.proxy.api_tls_cert='/etc/justclash/api-cert.pem'
uci set justclash.proxy.api_tls_key='/etc/justclash/api-key.pem'
uci commit justclash
service justclash restart
```

JustClash validates that the configured paths are absolute. Mihomo still requires the files to exist, be readable, contain valid PEM data, and form a usable certificate/key pair.

## Browser Trust

The browser must accept the controller certificate for the hostname used by LuCI. In Chrome/Chromium, a certificate-error exception is scoped to the hostname and certificate rather than the port, so using the same certificate for LuCI and the controller can share an exception. Other browsers may handle exceptions differently; a temporary exception is not permanent trust.

Options:

- trust the issuing local CA on clients;
- use a certificate issued for the hostname clients use;
- explicitly trust the self-signed API origin;
- terminate trusted TLS in a reverse proxy.

The certificate hostname must match the browser hostname. Converting DER to PEM changes encoding only, not identity or trust.

### Self-Signed Certificates and Log Noise

Accepting a self-signed certificate through a browser exception can leave rejected
TLS attempts in the server log even when the live pages work. Chromium can
[continue a WebSocket request after allowing a certificate error](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/websockets/websocket_stream.cc)
by [restarting the request](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/url_request/url_request_http_job.cc).
The rejected attempt can therefore be logged before the successful retry. Browser
and version differences affect this behavior; it is not evidence that every
connection failed.

Status opens two independent WebSocket streams for traffic and memory.
Certificate handling during their initial connections can produce several
messages when opening the page while the live metrics subsequently work normally.

To keep this certificate-rejection noise from filling Service logs, JustClash
suppresses HTTP TLS handshake messages ending in
`remote error: tls: unknown certificate`. Other TLS errors remain logged, and
certificate validation still runs.

The filter also suppresses genuine rejections with that exact message; it cannot
tell whether a retry succeeded. If live data is unavailable, inspect the browser's
connection errors and check certificate trust and SANs even when Service logs are
quiet. A trusted certificate with matching SANs avoids reliance on browser
exceptions.

## Reverse Proxy

A reverse proxy can terminate TLS and forward local HTTP/WebSocket traffic to Mihomo.

Requirements:

- expose HTTPS and WSS on the controller port expected by the LuCI frontend;
- forward WebSocket upgrade headers;
- keep the backend controller reachable only from the proxy side;
- block direct controller access from untrusted zones;
- preserve the expected API paths;
- use a certificate trusted for the browser hostname.

The LuCI client builds direct controller URLs using the configured TLS mode and the fixed controller port. A reverse proxy on an unrelated path or port will not be discovered automatically.

### WebSocket Credential Logging

Browser WebSocket clients cannot set a normal Authorization header, so the controller credential is passed as a query parameter for direct WebSocket requests.

Configure the reverse proxy to avoid logging query strings or to redact that parameter. Protect access logs as sensitive data.

## CORS

JustClash generates permissive CORS settings for supported dashboards. CORS controls browser behavior; it is not authentication.

Do not enter the API password into an untrusted hosted dashboard. Keep firewall restrictions and a unique password even when TLS is enabled.

## Verification

```sh
service justclash status
justclash.sh logs service 100
justclash.sh config show mihomo
```

Check:

- the controller binds only to the intended network;
- the certificate is trusted for the hostname;
- LuCI status, connections, and realtime logs work;
- WebSocket forwarding succeeds;
- WAN and guest zones cannot reach the controller.

The configuration diagnostic can still reveal endpoints and topology. Use `check` for shared output.

## Rollback

```sh
uci set justclash.proxy.api_tls='0'
uci commit justclash
service justclash restart
```

Rollback to HTTP only on a trusted local network. Do not delete the original LuCI certificate or the new PEM files until both LuCI and JustClash have been verified.
