# Mixed Port

The mixed port is an explicit HTTP and SOCKS proxy listener provided by Mihomo. It is separate from transparent interception: a browser, application, or device must be configured to connect to the router and this port directly.

## When to Use It

Use the mixed port for:

- applications that support an explicit proxy;
- testing a routing policy without changing firewall interception;
- devices outside the intercepted interface list;
- a dedicated inbound that should use a fixed outbound.

Do not expose it to untrusted networks. Authentication helps, but firewall restrictions and a strong password are still required.

## Enable the Listener

LuCI: **Services -> JustClash -> Proxy**.

1. Enable **Use mixed port**.
2. Choose an unused port.
3. Add authentication entries when clients other than the router will connect.
4. Save & Apply.

UCI template:

```sh
uci set justclash.proxy.use_mixed_port='1'
uci set justclash.proxy.mixed_port='<PORT>'
uci add_list justclash.proxy.proxy_authentication='<USERNAME>:<STRONG_PASSWORD>'
uci commit justclash
service justclash restart
```

The credential is stored in UCI and appears in unsafe diagnostics. Treat it as a secret.

## Configure a Client

Use the router address reachable from the client and the configured port.

```sh
export http_proxy='http://<USERNAME>:<PASSWORD>@<ROUTER_ADDRESS>:<PORT>'
export https_proxy="$http_proxy"
```

For SOCKS-capable applications, select SOCKS5 and use the same listener address and credentials.

Do not put real credentials in shell history on shared systems. Prefer a protected environment file or the application's credential store.

## Choose Mixed-Port Routing Behavior

The `mixed_port_rules.exit_rule` setting controls the first routing decision for this inbound.

| Value | Behavior |
| --- | --- |
| `BY RULES` | Evaluate the normal routing rule chain. |
| `DIRECT` | Send all mixed-port traffic directly before later rules are evaluated. |
| Proxy or group name | Send all mixed-port traffic to that outbound before later rules are evaluated. |

Default policy:

```ini
config mixed_port_rules 'mixed_port_rules'
    option exit_rule 'BY RULES'
```

Force a specific outbound:

```sh
uci set justclash.mixed_port_rules.exit_rule='<OUTBOUND_NAME>'
uci commit justclash
service justclash restart
```

A fixed outbound override is intentionally high priority. It bypasses later domain, RuleSet, Geodata, block, and final rules for this inbound. Use `BY RULES` when mixed-port clients should receive the same policy as transparently intercepted clients.

## Security Checklist

- Set a non-default port only for organization, not as the primary security control.
- Configure authentication.
- Restrict access with the OpenWrt firewall to trusted source zones or addresses.
- Do not forward the mixed port from WAN.
- Rotate credentials after exposing them in a command, screenshot, or unsafe diagnostic.
- Test HTTP and SOCKS separately if both client modes are used.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection refused | `use_mixed_port`, port collision checks, service logs, and firewall input rules. |
| Authentication fails | Exact `username:password` value and client proxy type. |
| Traffic ignores normal rules | `mixed_port_rules.exit_rule` may be a fixed outbound instead of `BY RULES`. |
| Transparent clients work but explicit clients do not | The mixed listener and transparent TProxy listener are different ports and paths. |

```sh
justclash.sh logs 100
service justclash status
```
