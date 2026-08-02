# Security Concerns

JustClash crosses two separate security boundaries:

- the local Mihomo controller accepts commands and exposes connection metadata;
- remote providers receive download requests, headers, identifiers, and authorization data.

Controller passwords, TLS, firewall policy, and provider request headers solve different problems. A realistic-looking User-Agent is not authentication, TLS does not restrict who may connect, and a strong password does not make an exposed controller a good idea.

The Mihomo controller exposes connection metadata, runtime controls, and outbound information. Protect it with:

1. a narrow network binding;
2. a strong generated API password;
3. OpenWrt firewall restrictions;
4. TLS whenever the browser reaches LuCI over HTTPS.

TLS does not replace authentication or firewall policy.

## API Password After Installation

A fresh package installation does not intentionally keep the packaged placeholder or a known legacy default. The post-install script replaces it with a generated API password when the default is still present:

1. it first reads a kernel-generated UUID and removes the separators;
2. if that source is unavailable, it falls back to bytes from `/dev/urandom`;
3. it stores the result in `justclash.proxy.api_password` and commits the UCI configuration.

The generated value is at least 32 characters. An existing non-default password is preserved during a normal package upgrade. Running `config_reset` creates a new API password together with the restored default configuration.

This matters because the controller credential protects API actions such as inspecting connections, changing the selected node, closing connections, and modifying runtime state. A shared package default would make every installation predictable, which is very convenient for everyone except the router owner.

The generated password is not printed during installation. To use an external dashboard or another API client, set a password that the client can store securely under **Services → JustClash → Setup: Proxy → Controller/API settings**.

### Rotate the Password from SSH

Generate the value on the router instead of placing a literal password in shell history:

```sh
API_SECRET="$(tr -d '-' </proc/sys/kernel/random/uuid 2>/dev/null)"

if [ "${#API_SECRET}" -lt 32 ]; then
	echo 'Failed to obtain a sufficiently long random value' >&2
	unset API_SECRET
	exit 1
fi

uci set justclash.proxy.api_password="$API_SECRET"
uci commit justclash
unset API_SECRET
service justclash restart
```

Do not print the variable, paste the resulting secret into diagnostics, or include `/etc/config/justclash` in a public bug report. The configuration and its backups can contain the controller password and provider credentials.

Rotate the password after suspected disclosure, before exposing the controller to another trusted network, and after restoring a configuration whose handling history is uncertain. Every dashboard or API client using the old value must then be updated.

## Mixed Port Authentication

The Mihomo Mixed Port is a separate HTTP/SOCKS5 listener for explicitly configured clients. It does not use `api_password`; access is controlled by `proxy_authentication`.

When JustClash enables Mixed Port, the generated Mihomo configuration also enables LAN access. If the authentication list is empty, any client that can reach the listener through the OpenWrt firewall can use it without credentials. Loopback traffic is intentionally exempt from authentication so router-local clients can connect.

For every non-loopback use, require credentials, restrict firewall input to trusted clients, and never forward the listener from WAN. This authentication is access control, not transport encryption, so the listener still belongs only on a trusted LAN or behind a separately secured tunnel.

Mixed Port credentials are sensitive UCI data and are independent from the controller API password. The canonical entry format, client setup, routing behavior, and verification procedure are documented in [Mixed Port](07_mixed_port.md).

## Download User-Agents

JustClash can set a global User-Agent for downloads and a separate override for each proxy provider:

- **Setup: Proxy → Basic settings → User-Agent for downloads** controls `global_ua` for external downloads such as subscriptions and rule lists.
- **Setup: Routing → Proxy providers → Security → User agent header** controls `header_user_agent` for one provider. An empty provider value inherits the global behavior.

The fields accept a literal User-Agent or one of these special values:

| Value | Generated header | Use it when |
| --- | --- | --- |
| `__random__` | One entry selected from the bundled browser User-Agent list | An endpoint accepts ordinary browser clients but rejects an unfamiliar downloader identity |
| `__justclash__` | `JustClash/<installed-version>` | The server should identify requests from this package in its logs |
| `__mihomo__` | `Mihomo/<core-version>` | The provider expects or records a Mihomo client identity; this is the per-provider default |
| Literal text | The exact configured value | The provider documents a required User-Agent |

`__random__` is resolved while JustClash generates the Mihomo configuration. One browser identity is selected for that service start and is then written as a normal header value; it is not randomized for every request. Restarting or regenerating the configuration can select another entry.

### Why User-Agent Selection Exists

Some download endpoints use User-Agent checks for compatibility, traffic classification, support diagnostics, or crude client allowlists. Choosing the expected value can make an otherwise valid provider or ruleset download succeed.

It is not an anonymity feature and does not hide the router address, subscription URL, authorization header, hardware identifier, or request timing. `__random__` also does not grant access to a protected resource. Prefer `__justclash__`, `__mihomo__`, or a provider-documented literal when stable server-side logging and allowlists matter.

Do not place credentials in a User-Agent. LuCI rejects CR/LF characters to prevent additional HTTP headers from being injected through this field.

## Recommended Topologies

| LuCI | Mihomo API | Use |
| --- | --- | --- |
| HTTP on trusted LAN | HTTP/WS on trusted LAN | Simple local-only setup |
| HTTPS | Direct HTTPS/WSS with a trusted PEM certificate | Direct API TLS |
| HTTPS behind reverse proxy | HTTPS/WSS exposed by the same trusted proxy design | Centrally managed TLS |

An HTTPS LuCI page cannot open insecure HTTP or WebSocket controller connections because browsers block mixed content.

## Controller Binding

`controller_bind_interface` is an OpenWrt network name, not a device name. JustClash resolves its current address and uses it for the controller listener.

```sh
uci set justclash.proxy.controller_bind_interface='<TRUSTED_NETWORK>'
uci set justclash.proxy.api_password='<STRONG_API_PASSWORD>'
uci commit justclash
service justclash restart
```

> [!WARNING]
> An invalid network name or a network without a usable address can cause an all-interface controller binding. Treat firewall restrictions as mandatory.

Never expose the controller directly to WAN.

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

When the LuCI certificate is unsuitable, create a dedicated certificate whose subject name matches the hostname used by clients:

```sh
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
justclash.sh logs 100
justclash.sh diag_mihomo_config
```

Check:

- the controller binds only to the intended network;
- the certificate is trusted for the hostname;
- LuCI status, connections, and realtime logs work;
- WebSocket forwarding succeeds;
- WAN and guest zones cannot reach the controller.

The configuration diagnostic can still reveal endpoints and topology. Use `diag_redacted` for shared output.

## Rollback

```sh
uci set justclash.proxy.api_tls='0'
uci commit justclash
service justclash restart
```

Rollback to HTTP only on a trusted local network. Do not delete the original LuCI certificate or the new PEM files until both LuCI and JustClash have been verified.
