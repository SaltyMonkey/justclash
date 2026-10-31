# Multi-WAN and Failover

[Documentation](../README.md)

Use this guide when you want Mihomo to choose between two internet connections:
manually, by availability, by measured delay, or by spreading connections across
them. First make sure each WAN already works in OpenWrt. JustClash chooses an
outbound for traffic that reaches Mihomo; OpenWrt still supplies the devices,
routes, and internet connections.

For one interface-bound connection without failover, use the
[Quick Start outbound setup](../getting-started.md#3-add-an-outbound).

## What `direct://` Means

`direct://` creates a named Mihomo outbound of type `direct`. It connects to the
destination without requiring a remote proxy server. The useful part is that you
can give this entry its own outgoing device and select it in rules or groups.

For example, `Direct_WAN_A` can use your primary WAN and `Direct_WAN_B` your
backup. A group can then choose between those two paths. You can also bind a
direct outbound to an existing system VPN device; the VPN itself must already
be configured and working in OpenWrt.

See [What "Direct" Means](../concepts/routing.md#what-direct-means)
for the difference between these outbounds, built-in `DIRECT`, and traffic
outside Mihomo.

Use exactly `direct://` as the link. There is no server address, port, or login
to put in it. Configure its behavior with the separate fields below; query
parameters in this link are not parsed as outbound settings.

## Outbound Controls

For this setup, select the actual outgoing device under **Bind to interface**
and an address family that WAN can reach under **IP version (outbound)**.
The device may have a different name from the OpenWrt logical network. Leave
**Routing mark** and **Connect through** empty initially.

For a marked direct path handled by another local service, use the separate
[direct:// and fwmark guide](fwmark-handoff.md).

The [Outbound Field Reference](../reference/uci.md#proxies) describes the UCI
options and their values. Binding an interface or choosing an address family
does not create missing routes or add IPv6 connectivity.

## Direct WAN Outbounds

In **Services → JustClash → Setup: Routing → Proxies**, create two enabled
entries:

| Setting | First entry | Second entry |
| --- | --- | --- |
| Name | `Direct_WAN_A` | `Direct_WAN_B` |
| Mode | `uri` | `uri` |
| Link | `direct://` | `direct://` |
| Bind to interface | Primary WAN's device | Backup WAN's device |
| IP version | A family supported by that WAN | A family supported by that WAN |

Save both rows. The equivalent SSH commands are below. Replace the two device
placeholders with your actual outgoing devices before running them; keep
`dual` only if that resolution strategy is suitable for both paths.

```sh
uci set justclash.direct_wan_a=proxies
uci set justclash.direct_wan_a.enabled='1'
uci set justclash.direct_wan_a.name='Direct_WAN_A'
uci set justclash.direct_wan_a.mode='uri'
uci set justclash.direct_wan_a.proxy_link_uri='direct://'
uci set justclash.direct_wan_a.interface_name='<WAN_A_DEVICE>'
uci set justclash.direct_wan_a.ip_version='dual'

uci set justclash.direct_wan_b=proxies
uci set justclash.direct_wan_b.enabled='1'
uci set justclash.direct_wan_b.name='Direct_WAN_B'
uci set justclash.direct_wan_b.mode='uri'
uci set justclash.direct_wan_b.proxy_link_uri='direct://'
uci set justclash.direct_wan_b.interface_name='<WAN_B_DEVICE>'
uci set justclash.direct_wan_b.ip_version='dual'
uci commit justclash
```

## Build a Group

Add a group under **Proxy groups**, give it a name, and include both direct
outbounds under **Proxies**. Choose a
[group type](../reference/uci.md#group-types) for manual selection, automatic
failover, delay-based selection, or balancing. The examples below cover failover
and balancing.

### Ordered Failover

For primary/backup operation, use `fallback` and put `Direct_WAN_A` first.
When that path fails its availability checks, the group can use `Direct_WAN_B`.
Existing TCP sessions cannot move to another WAN; applications may need to
reconnect after the path changes.

```sh
uci set justclash.wan_failover=proxy_group
uci set justclash.wan_failover.enabled='1'
uci set justclash.wan_failover.name='WAN_Failover'
uci set justclash.wan_failover.group_type='fallback'
uci add_list justclash.wan_failover.proxies='Direct_WAN_A'
uci add_list justclash.wan_failover.proxies='Direct_WAN_B'
uci set justclash.wan_failover.check_interval='60'
uci set justclash.wan_failover.check_timeout='5000'
uci set justclash.wan_failover.lazy='0'
uci commit justclash
```

This example uses the schema's default check URL and expected status. In LuCI,
keep the supplied check URL/status initially, or choose a target you can reach
through both WANs. `lazy='0'` allows periodic checks even when the group is not
being used.

### Load Balancing

Use `load-balance` when you want multiple connections to use both WANs. For
example, create a group containing the same two direct outbounds and choose
`round-robin` as its strategy. Other supported strategies are
`consistent-hashing` and `sticky-sessions`.

A single connection still uses one WAN. This does not combine both links into
one faster download connection.

## Health Checks

A WAN can have a working link while its internet access is broken. Group checks
request a URL through each member, so use a target that represents the access
you need and is reachable through both paths.

| Group option | Meaning |
| --- | --- |
| `check_url`, `expected_status` | What to request and which HTTP status counts as success |
| `check_interval` | Seconds between checks |
| `check_timeout` | Timeout for one check, in milliseconds |
| `max_failed_times` | Group failure threshold |
| `lazy` | Whether periodic checks depend on the group being used |
| `tolerance` | Delay tolerance for `url-test`, in milliseconds |

Groups use the fields above. The `health_check_*` fields belong to subscription
providers and do not configure a group. A manually selected `select` group does
not require backend-generated health-check defaults; it still accepts explicit
check settings. LuCI currently supplies check presets in its group editor.

The shared URL presets include Google, Cloudflare, Microsoft, Apple, Mozilla,
Huawei, Xiaomi, Samsung, OPPO, Vivo, and Honor. The Microsoft preset uses HTTP;
the others use HTTPS. Choose a target and matching expected status for automatic
checks. The [Nodes Test URL selector](../troubleshooting/luci.md#what-the-current-ui-shows)
only changes manual tests on that page.

## Tunnel Outbounds

The same idea works with remote-server connections: bind a URI-defined outbound
to one outgoing device, duplicate it with a different name for the second WAN,
and put both in a group. The name identifies the path; changing it does not
change the remote server.

For nodes loaded from a subscription, use the provider's `override_interface_name`,
`override_ip_version`, and optional `override_routing_mark`. Separate provider
entries can apply different bindings to the same subscription.

## Interface Binding and Routing Marks

Start with interface binding. Add `routing_mark` only when you already have
Linux policy rules and routing tables that use that mark. JustClash accepts
decimal and hex marks, but reserves bits `0x4` and `0x80` for its own traffic
handling. Custom marks must leave both bits clear.
See [fwmark handoff](fwmark-handoff.md).

A device binding and a mark-based policy must lead to a usable route for the
same connection. If another PBR service uses conflicting marks or tables,
setting both fields will not resolve that conflict automatically.

## Apply the Group

Creating the group only makes it available for selection. To use it, assign
rulesets or manual rules to it, or select it under **Default rule → Send traffic
to**. For the failover example, the group name is `WAN_Failover`.

The group affects only traffic that reaches Mihomo. Check
[Choosing a Routing Mode](../concepts/routing.md) before using
it as the default path, especially with partial routing.

Choose **Save & Apply** in LuCI. After SSH edits, commit the configuration and
restart the service:

```sh
uci commit justclash
service justclash restart
```

## Verification

Open **Status** and confirm that the service is running. Use **Nodes** to select
or inspect the group, then open a new test connection and check its chain under
**Connections**. Live pages require the running Mihomo controller.

To check failover, make the primary WAN unavailable while keeping access to
the router, wait for the group checks, and establish a new connection. It should
use the backup. Restore the primary WAN and check recovery as well.

| Symptom | Check next |
| --- | --- |
| Both members use one WAN | The two device selections and usable routes through each device |
| Failover never switches | Check target, expected status, timing, and whether probes can reach it through each WAN |
| Group exists but receives no traffic | Whether a rule actually selects it |
| Some traffic bypasses the group | Whether partial routing captured that connection |
| Connections loop or disappear | Conflicting marks or external policy routing |
| Only one address family works | WAN capability and the outbound's `ip_version` |

If the new path fails, select `DIRECT` or a known working outbound for the
affected rules, apply the change, and confirm connectivity before removing
the new entries.
