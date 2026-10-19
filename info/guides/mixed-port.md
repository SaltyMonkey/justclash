# Mixed Port

[Documentation](../README.md)

The Mihomo mixed port is an explicit HTTP and SOCKS5 listener. It is independent from transparent TProxy interception: each client application must be configured to use the router and listener directly.

Enabling it also enables LAN access in the generated Mihomo configuration.

## Use It For

- applications with explicit proxy support;
- testing routing without changing interception rules;
- devices outside selected client interfaces;
- an inbound that must use a fixed outbound.

Do not expose the listener to WAN or untrusted zones.

## Enable the Listener

LuCI: **Services → JustClash → Setup: Proxy → Mixed proxy settings**.

1. Enable **Mihomo mixed port**.
2. Select an unused port.
3. Under **Mixed proxy bind**, select a network or leave it unspecified to listen on all available addresses.
4. Use the generated **Mixed port authentication** entry or replace it with your own credentials.
5. Save & Apply.

The bind setting is independent of **Controller bind**. A selected network uses
its first IPv4 address, falling back to IPv6. If neither is available, startup
fails while Mixed Port is enabled. Disabled Mixed Port does not require its
selected network to have an address. The default network is `lan`; `-` uses wildcard listening.
Changes to the resolved address are included in the YAML cache fingerprint.

```sh
uci set justclash.proxy.use_mixed_port='1'
uci set justclash.proxy.mixed_port='<PORT>'
uci set justclash.proxy.mixed_port_bind_interface='<NETWORK_OR_DASH>'
uci add_list justclash.proxy.proxy_authentication='<USERNAME>:<PASSWORD>'
uci commit justclash
service justclash restart
```

Credentials are stored in UCI and appear in unsafe diagnostics. Avoid shell history when entering real values.

> [!CAUTION]
> Do not remove every `proxy_authentication` entry while Mixed Port is enabled. Without an entry, every client that can reach the port through the firewall can use the proxy without credentials. Router-local loopback traffic is exempt from authentication by design.

## Authentication Format

Each `proxy_authentication` list entry represents one credential:

```text
<USERNAME>:<PASSWORD>
```

Rules enforced by LuCI:

- both parts are required;
- exactly one colon is allowed;
- whitespace and control characters are rejected;
- multiple entries may be added, one per client or trust group.

Installation and `config reset` create a `user:` credential with a random
32-character password. Normal package upgrades preserve existing credentials.
For custom credentials, use a password manager or another cryptographically
secure generator. Separate entries let you revoke one client independently.

`proxy_authentication` is unrelated to `api_password`: the former protects the HTTP/SOCKS listener, while the latter protects the Mihomo controller and dashboards.

Authentication does not encrypt the Mixed Port connection. Keep it on a trusted LAN or behind a separately secured tunnel, even when credentials are enabled.

## Client Configuration

Configure:

- the router address reachable from the client;
- the configured mixed port;
- HTTP or SOCKS5 mode;
- the matching credential.

Do not assume that successful transparent interception proves the mixed listener is reachable. They use different ports and firewall paths.

## Routing Policy

`mixed_port_rules.exit_rule` creates the first rule for explicit mixed-port traffic.

| Value | Behavior |
| --- | --- |
| `BY RULES` | Continue through block, group, outbound, and final rules |
| `DIRECT` | Send mixed-port traffic directly |
| Outbound/group name | Send mixed-port traffic to that outbound |

```sh
uci set justclash.mixed_port_rules.exit_rule='BY RULES'
uci commit justclash
service justclash restart
```

A fixed outbound is intentionally evaluated before normal routing and block rules. Use `BY RULES` when explicit clients should receive the same policy as transparently intercepted clients.

## Security Checklist

- Restrict the OpenWrt firewall input rule to trusted source zones or addresses.
- Do not forward the listener from WAN.
- Do not treat a non-default port as access control.
- Rotate credentials after accidental disclosure.

## Verification

1. Confirm the service is running.
2. Confirm the port is not used by another process.
3. Test HTTP and SOCKS5 separately with one trusted client.
4. Check the expected rule and outbound under **Connections**.
5. Confirm an unauthenticated request is rejected.

```sh
service justclash status
justclash.sh logs service 100
```

Logs can expose client or destination details. Use `check` for shared support data.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection refused | Listener enabled, port collision, service state, firewall input |
| Authentication fails | Exact credential format and client proxy type |
| Normal rules are ignored | `mixed_port_rules.exit_rule` is fixed instead of `BY RULES` |
| HTTP works but SOCKS does not | Client mode and SOCKS5 support |
| LAN works, guest does not | Firewall zone policy and listener reachability |

## Disable

```sh
uci set justclash.proxy.use_mixed_port='0'
uci commit justclash
service justclash restart
```
