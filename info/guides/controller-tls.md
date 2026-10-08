# Controller TLS

[Documentation](../README.md)

Use this guide when HTTPS LuCI cannot connect to Mihomo, or when you need an
encrypted controller connection for trusted clients. It covers the controller
API, not the explicit Mixed Port listener.

First configure [controller binding and credentials](security.md#controller-binding).
You need a working JustClash setup, a hostname clients can reach, and a certificate
trusted by those clients. OpenSSL is needed only for the certificate commands.

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

Do not point Mihomo at the LuCI files until their encoding has been verified. Prefer separate files under `/etc/justclash/tls/`.

## Check the Existing LuCI Certificate

```sh
if grep -q '^-----BEGIN CERTIFICATE-----' /etc/uhttpd.crt; then
	echo 'Certificate is PEM'
else
	echo 'Certificate is not PEM'
fi

if grep -q '^-----BEGIN .*PRIVATE KEY-----' /etc/uhttpd.key; then
	echo 'Private key is PEM'
else
	echo 'Private key is not PEM'
fi
```

PEM files begin with markers similar to:

```text
-----BEGIN CERTIFICATE-----
-----BEGIN PRIVATE KEY-----
```

The private-key marker may also identify an RSA or EC private key. This check reports only the encoding and does not print certificate or private-key contents. A `not PEM` result means that conversion is required.

## Convert LuCI/uhttpd DER Files to Separate PEM Files

Install the OpenSSL command-line utility when `openssl` is not already available. Use the package manager for the current OpenWrt release.

Create a protected destination:

```sh
mkdir -p /etc/justclash/tls
chmod 700 /etc/justclash/tls
```

Convert the certificate:

```sh
openssl x509 \
  -inform DER \
  -in /etc/uhttpd.crt \
  -outform PEM \
  -out /etc/justclash/tls/api.crt
```

Convert the private key:

```sh
openssl pkey \
  -inform DER \
  -in /etc/uhttpd.key \
  -outform PEM \
  -out /etc/justclash/tls/api.key
```

Protect the result:

```sh
chmod 644 /etc/justclash/tls/api.crt
chmod 600 /etc/justclash/tls/api.key
```

> [!IMPORTANT]
> Never overwrite `/etc/uhttpd.crt` or `/etc/uhttpd.key` during conversion. LuCI/uhttpd may still require the original files and format.

If the original files are already PEM, copy them to the separate directory instead of running DER conversion:

```sh
cp /etc/uhttpd.crt /etc/justclash/tls/api.crt
cp /etc/uhttpd.key /etc/justclash/tls/api.key
chmod 644 /etc/justclash/tls/api.crt
chmod 600 /etc/justclash/tls/api.key
```

## Generate a Dedicated PEM Certificate

Conversion preserves the existing certificate name and trust properties. It does not make a mismatched or untrusted certificate valid.

When the LuCI certificate is unsuitable, create a dedicated certificate whose subject alternative name matches the hostname used by clients:

```sh
mkdir -p /etc/justclash/tls
chmod 700 /etc/justclash/tls
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout /etc/justclash/tls/api.key \
  -out /etc/justclash/tls/api.crt \
  -days <VALIDITY_DAYS> \
  -subj '/CN=<ROUTER_HOSTNAME>' \
  -addext 'subjectAltName=DNS:<ROUTER_HOSTNAME>'

chmod 644 /etc/justclash/tls/api.crt
chmod 600 /etc/justclash/tls/api.key
```

For managed environments, use a certificate issued by the local trusted CA and include the required subject alternative names. Modern browsers validate SANs; a CN alone may be insufficient.

## Validate the PEM Files

```sh
openssl x509 -in /etc/justclash/tls/api.crt -noout -subject -dates
openssl pkey -in /etc/justclash/tls/api.key -noout -check
```

Both commands must succeed. Do not print or copy private-key contents.

## Enable Direct API TLS

LuCI: **Services → JustClash → Setup: Proxy → Controller/API settings**.

```sh
uci set justclash.proxy.api_tls='1'
uci set justclash.proxy.api_tls_cert='/etc/justclash/tls/api.crt'
uci set justclash.proxy.api_tls_key='/etc/justclash/tls/api.key'
uci commit justclash
service justclash restart
```

JustClash validates that the configured paths are absolute. Mihomo still requires the files to exist, be readable, contain valid PEM data, and form a usable certificate/key pair.

## Browser Trust

A self-signed certificate must be trusted for the API origin separately when the browser treats it as a different port/origin from LuCI.

Options:

- trust the issuing local CA on clients;
- use a certificate issued for the hostname clients use;
- explicitly trust the self-signed API origin;
- terminate trusted TLS in a reverse proxy.

The certificate hostname must match the browser hostname. Converting DER to PEM changes encoding only, not identity or trust.

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
