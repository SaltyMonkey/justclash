# Multi-WAN and Failover

JustClash can bind individual outbounds to specific interfaces and combine them in Mihomo proxy groups. This supports direct-WAN selection, tunnel failover, latency selection, and connection balancing.

It does not replace every function of `mwan3` or system policy routing. Mihomo controls traffic that reaches its outbounds; OpenWrt still controls interface availability, addresses, routes, and traffic that bypasses JustClash.

## Prerequisites

Before configuring groups:

- every WAN must work independently in OpenWrt;
- the selected interface name must exist when Mihomo starts;
- each WAN must have a usable route for the destination;
- health-check destinations must be reachable through every tested outbound;
- partial-mode traffic must first be intercepted before Mihomo can select a WAN.

## Bind an Outbound to an Interface

### Direct WAN Outbound

Create one `direct://` proxy for each WAN.

```sh
uci set justclash.direct_wan_a=proxies
uci set justclash.direct_wan_a.enabled='1'
uci set justclash.direct_wan_a.name='Direct_WAN_A'
uci set justclash.direct_wan_a.mode='uri'
uci set justclash.direct_wan_a.proxy_link_uri='direct://'
uci set justclash.direct_wan_a.interface_name='<WAN_A_INTERFACE>'

uci set justclash.direct_wan_b=proxies
uci set justclash.direct_wan_b.enabled='1'
uci set justclash.direct_wan_b.name='Direct_WAN_B'
uci set justclash.direct_wan_b.mode='uri'
uci set justclash.direct_wan_b.proxy_link_uri='direct://'
uci set justclash.direct_wan_b.interface_name='<WAN_B_INTERFACE>'

uci commit justclash
```

In LuCI, create the same entries under **Routing -> Proxies** and select **Bind to interface**.

### Tunnel Outbound

To send a proxy connection through a specific WAN, set `interface_name` on that proxy or use the provider override field. Duplicate a tunnel outbound when the same remote service must be available through multiple WANs.

Use distinct names such as `Tunnel_A/WAN_A` and `Tunnel_A/WAN_B`. The names are operational labels; they do not change the remote endpoint.

## Build a Group

### Manual Selection

Use `select` when an operator should choose the active WAN from the dashboard.

### Ordered Failover

Use `fallback` when the first healthy outbound should be preferred and later entries are backups.

```sh
uci set justclash.wan_failover=proxy_group
uci set justclash.wan_failover.enabled='1'
uci set justclash.wan_failover.name='WAN_Failover'
uci set justclash.wan_failover.group_type='fallback'
uci add_list justclash.wan_failover.proxies='Direct_WAN_A'
uci add_list justclash.wan_failover.proxies='Direct_WAN_B'
uci set justclash.wan_failover.check_url='<HEALTH_CHECK_URL>'
uci set justclash.wan_failover.expected_status='<EXPECTED_STATUS>'
uci set justclash.wan_failover.check_interval='300'
uci commit justclash
```

### Latency Selection

Use `url-test` to select the healthy outbound with the best measured response. Configure `tolerance` to avoid switching for insignificant differences.

### Load Balancing

Use `load-balance` to distribute connections. Choose the strategy in LuCI. Balancing is connection-based; it does not combine WAN bandwidth for a single TCP connection.

```sh
uci set justclash.wan_balance=proxy_group
uci set justclash.wan_balance.enabled='1'
uci set justclash.wan_balance.name='WAN_Balance'
uci set justclash.wan_balance.group_type='load-balance'
uci set justclash.wan_balance.strategy='consistent-hashing'
uci add_list justclash.wan_balance.proxies='Direct_WAN_A'
uci add_list justclash.wan_balance.proxies='Direct_WAN_B'
uci commit justclash
```

## Health-Check Fields

Proxy groups use:

- `check_url`
- `expected_status`
- `check_interval`
- `check_timeout`
- `max_failed_times`
- `lazy`
- `tolerance` where supported

Proxy providers use a different set of names beginning with `health_check_`. Do not copy provider field names into a group section; UCI will happily store them while Mihomo remains entirely unimpressed.

## Route a Policy Through the Group

Creating the group does not send traffic to it. Select the group as:

- the target of a domain, RuleSet, Geosite, IP, or GEOIP policy;
- the default rule;
- the mixed-port override, when appropriate.

Remember that a default proxy group cannot capture unmatched traffic in partial mode unless the firewall already intercepted that traffic.

## Coexistence with System Policy Routing

Use `routing_mark` or provider `override_routing_mark` when an external routing system must select the WAN after Mihomo creates an outbound connection. Ensure those marks are recognized by the external rules and excluded from JustClash loop interception.

Avoid configuring both interface binding and conflicting mark-based routing for the same outbound unless the precedence is understood and tested.

## Loop Prevention

Mihomo outbound traffic is marked so JustClash nftables rules bypass it. Router services that create their own WAN connections may need a socket-owner or port exclusion. See [Traffic Exclusions](04_service_traffic_exclusion.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Both outbounds use the same WAN | Interface names, OpenWrt routes, and whether the outbound actually has `interface_name`. |
| Failover never switches | Health-check URL, expected status, interval, and reachability through each WAN. |
| Group exists but traffic ignores it | Routing rules or the default rule do not reference the group. |
| Raw-address traffic bypasses the group | Partial routing did not intercept it. |
| Connections loop or disappear | Conflicting routing marks or external PBR rules. |

Verify with **Nodes**, **Connections**, and:

```sh
justclash.sh diag_route
justclash.sh logs 100
```
