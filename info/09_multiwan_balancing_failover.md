# Multi-WAN and Failover

JustClash can bind Mihomo outbounds to OpenWrt devices and combine them in proxy groups. This supports manual WAN selection, ordered failover, latency selection, and connection balancing.

It does not replace netifd, system routing, or every function of `mwan3`. Mihomo controls only traffic that reached a configured outbound.

## Prerequisites

- Each WAN works independently in OpenWrt.
- The selected device exists when Mihomo starts.
- The kernel has a usable route for every outbound destination.
- Health-check targets are reachable through every tested path.
- Partial Interception captures the traffic before Mihomo selects a WAN.

## Outbound Controls

| Field | Scope | Purpose |
| --- | --- | --- |
| `interface_name` | Individual proxy | Bind that outbound to a device |
| `ip_version` | Individual proxy | Restrict/prefer the outbound address family |
| `routing_mark` | Individual proxy | Mark sockets for external policy routing |
| `override_interface_name` | Provider nodes | Apply device binding to loaded nodes |
| `override_ip_version` | Provider nodes | Apply address-family policy |
| `override_routing_mark` | Provider nodes | Apply a routing mark |

## Direct WAN Outbounds

Create one synthetic `direct://` outbound per WAN.

```sh
uci set justclash.direct_wan_a=proxies
uci set justclash.direct_wan_a.enabled='1'
uci set justclash.direct_wan_a.name='Direct_WAN_A'
uci set justclash.direct_wan_a.mode='uri'
uci set justclash.direct_wan_a.proxy_link_uri='direct://'
uci set justclash.direct_wan_a.interface_name='<WAN_A_DEVICE>'
uci set justclash.direct_wan_a.ip_version='<IP_VERSION>'

uci set justclash.direct_wan_b=proxies
uci set justclash.direct_wan_b.enabled='1'
uci set justclash.direct_wan_b.name='Direct_WAN_B'
uci set justclash.direct_wan_b.mode='uri'
uci set justclash.direct_wan_b.proxy_link_uri='direct://'
uci set justclash.direct_wan_b.interface_name='<WAN_B_DEVICE>'
uci set justclash.direct_wan_b.ip_version='<IP_VERSION>'

uci commit justclash
```

In LuCI, create the same entries under **Services → JustClash → Setup: Routing → Proxies**.

## Tunnel Outbounds

Set `interface_name` on an individual tunnel outbound when its remote connection must leave through one WAN.

For provider-loaded nodes, use the override fields. Duplicate an outbound/provider when the same remote service must be available through multiple WANs with different bindings.

Use distinct operational names. Names do not change the remote endpoint.

## Build a Group

| Group type | Use |
| --- | --- |
| `select` | Manual operator choice |
| `fallback` | First healthy member, ordered backups |
| `url-test` | Lowest measured delay within tolerance |
| `load-balance` | Distribute new connections |

Load balancing is connection-based. It does not combine bandwidth for one TCP connection.

### Ordered Failover

```sh
uci set justclash.wan_failover=proxy_group
uci set justclash.wan_failover.enabled='1'
uci set justclash.wan_failover.name='WAN_Failover'
uci set justclash.wan_failover.group_type='fallback'
uci add_list justclash.wan_failover.proxies='Direct_WAN_A'
uci add_list justclash.wan_failover.proxies='Direct_WAN_B'
uci set justclash.wan_failover.check_url='<HEALTH_CHECK_URL>'
uci set justclash.wan_failover.expected_status='<EXPECTED_STATUS>'
uci set justclash.wan_failover.check_interval='<SECONDS>'
uci commit justclash
```

### Load Balancing

```sh
uci set justclash.wan_balance=proxy_group
uci set justclash.wan_balance.enabled='1'
uci set justclash.wan_balance.name='WAN_Balance'
uci set justclash.wan_balance.group_type='load-balance'
uci set justclash.wan_balance.strategy='<SUPPORTED_STRATEGY>'
uci add_list justclash.wan_balance.proxies='Direct_WAN_A'
uci add_list justclash.wan_balance.proxies='Direct_WAN_B'
uci commit justclash
```

## Health Checks

Proxy groups use:

- `check_url`;
- `expected_status`;
- `check_interval`;
- `check_timeout`;
- `max_failed_times`;
- `lazy`;
- `tolerance` where supported.

Provider health fields begin with `health_check_`. UCI will store provider fields in a group without complaint; the generated group simply will not use them.

## Interface Binding and Routing Marks

The effective path is determined by several layers:

1. Mihomo applies the outbound or provider `interface_name`.
2. Mihomo applies `routing_mark` when configured.
3. Linux policy-routing rules process that mark.
4. The selected routing table resolves the final next hop.

Avoid combining a device binding with a conflicting mark-based policy unless the precedence has been tested. Document mark ownership so JustClash and external PBR systems do not reuse the same values.

## Apply the Group

Creating a group does not route traffic to it. Select it as:

- a domain/ruleset/Geosite target;
- an address/GeoIP target;
- the final rule;
- a mixed-port fixed outbound.

A final proxy group cannot capture unmatched raw-address traffic in Partial Interception.

## Verification

Use **Nodes** to observe health state and **Connections** to verify the selected chain.

```sh
justclash.sh diag_route
justclash.sh logs 100
```

| Symptom | Check |
| --- | --- |
| Both members use one WAN | Device names, routes, and generated `interface-name` |
| Failover never switches | Health target, expected status, interval, and per-WAN reachability |
| Group exists but is unused | No rule references it |
| Raw-address traffic bypasses it | Partial Interception did not capture the connection |
| Connections loop/disappear | Conflicting marks or external PBR |
| One address family fails | `ip_version`, provider override, and WAN capability |

Diagnostics can reveal routes and interfaces. Use `diag_redacted` for shared output.

## Rollback

Switch the affected policy to `DIRECT` or a known working outbound, disable the new group, restart the service, and confirm native WAN routing before removing the sections.
