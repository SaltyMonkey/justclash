# Secure API and Dashboard Access

The Mihomo API can expose connection metadata, runtime controls, and proxy information. Protect it with all three layers:

1. bind it to the intended local network;
2. set a strong API password;
3. restrict access with the OpenWrt firewall.

TLS protects the browser connection but does not replace authentication or firewall policy.

## Recommended Local Setup

For a trusted LAN with LuCI over HTTP:

- bind the controller to the LAN network;
- set a strong `api_password`;
- keep `api_tls` disabled;
- block controller access from WAN and untrusted zones.

For LuCI over HTTPS, use API TLS or a reverse proxy. Browsers block an HTTPS LuCI page from opening insecure HTTP or WebSocket API connections.

## Controller Binding

`controller_bind_interface` is an OpenWrt network name. JustClash resolves its current address during configuration generation and binds the Mihomo controller to that address.

```sh
uci set justclash.proxy.controller_bind_interface='<TRUSTED_NETWORK>'
uci set justclash.proxy.api_password='<STRONG_API_PASSWORD>'
uci commit justclash
service justclash restart
```

> [!WARNING]
> If the configured network name is invalid or has no usable address, JustClash logs a warning and may generate an all-interface binding. Treat the firewall as mandatory protection, not a decorative second opinion.

Do not deliberately bind the controller to all interfaces unless firewall access has been verified from every zone. Do not expose the controller directly to WAN.

## LuCI Protocol and API Protocol

| LuCI page | Mihomo API | Browser result |
| --- | --- | --- |
| HTTP | HTTP/WS | Works without TLS. |
| HTTPS | HTTP/WS | Blocked as mixed content. |
| HTTPS | HTTPS/WSS | Works when the certificate is trusted. |
| HTTPS through reverse proxy | HTTPS through the same trusted proxy | Recommended for centrally managed certificates. |

## Enable Direct API TLS

LuCI: **Services -> JustClash -> Proxy**.

1. Enable **API TLS**.
2. Set an absolute certificate path.
3. Set an absolute private-key path.
4. Ensure the Mihomo process can read both files.
5. Save & Apply.

UCI template:

```sh
uci set justclash.proxy.api_tls='1'
uci set justclash.proxy.api_tls_cert='<ABSOLUTE_CERTIFICATE_PATH>'
uci set justclash.proxy.api_tls_key='<ABSOLUTE_PRIVATE_KEY_PATH>'
uci commit justclash
service justclash restart
```

The paths are validated as configuration inputs and then written to the generated Mihomo YAML. Do not rely on an automatic fallback to HTTP when a certificate is missing or unreadable; treat startup or controller failure as a configuration error.

## Self-Signed Certificates

Trust granted by a browser for the LuCI origin may not automatically cover a different API port. A background API request can fail without showing an interactive certificate warning.

Options:

- open the API HTTPS endpoint directly and approve the certificate for that origin;
- install the issuing local CA in the client trust store;
- use a certificate trusted for the hostname clients use;
- terminate TLS in a reverse proxy.

The certificate name must match the hostname used by the browser. A certificate trusted for one name does not become valid for another address merely because both lead to the same router.

## Reverse Proxy

A reverse proxy can terminate trusted TLS and forward local HTTP to LuCI and the Mihomo controller. In this design:

- clients connect only to trusted HTTPS endpoints;
- `api_tls` can remain disabled on the local backend;
- the backend controller should listen only where the proxy can reach it;
- the firewall should block direct access from other zones;
- WebSocket forwarding must be enabled.

Use DNS-based certificate validation when a trusted certificate is needed without exposing an HTTP validation port.

## Dashboard and CORS

JustClash generates permissive CORS settings so supported dashboards can communicate with the local controller. CORS is a browser policy, not an access-control system. A wildcard origin makes the API password and firewall restrictions more important, not less.

Use a unique API password and avoid entering it into untrusted hosted dashboards.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| LuCI is HTTPS and status pages show disconnected | Browser mixed-content errors and `api_tls`. |
| Direct API page shows a certificate warning | Certificate trust, hostname, and port. |
| Connection is refused | Controller bind network, generated configuration, service state, and firewall input. |
| Authentication fails | `api_password` and whether the client sent the expected API secret. |
| Works on LAN but not guest network | Firewall policy and controller bind network. This may be intentional. |
| API appears on an unintended network | Invalid bind network or an all-interface fallback; fix the setting and firewall immediately. |

Useful commands:

```sh
justclash.sh logs 100
justclash.sh diag_mihomo_config
service justclash status
```

Use the redacted diagnostic command. The unsafe variant can expose the API password, endpoints, and proxy credentials.
