# DNS and Fake-IP

[Documentation](../README.md)

Use **Services → JustClash → Setup: DNS** to configure Mihomo DNS. For the first
setup, keep the shipped upstreams and real-IP exceptions. DNS and interception
must agree: a client receiving a synthetic Fake-IP address needs a traffic path
through Mihomo.

## Set Up the DNS Path

Under **Setup: Service → Traffic rules**, **Change DNS settings at startup** lets
JustClash manage dnsmasq forwarding to the configured Mihomo DNS listener. This
switch is separate from **Create nftables**. Keep both enabled for the normal
transparent setup, and configure client DHCP to advertise the router as DNS.

The **DNS listen port** is the local Mihomo listener, not a remote upstream port.
It must be unused and must agree with dnsmasq forwarding. When JustClash manages
dnsmasq, its saved state is restored on a clean stop; see
[Configuration lifecycle](../concepts/configuration-lifecycle.md#dns-recovery).

Client **DNS mode** is a firewall policy. `BY RULES` leaves ordinary client DNS
under the routing policy, `DROP` blocks it, and `HIJACK` redirects eligible client
TCP/UDP DNS requests to the router. This does not intercept HTTPS-based DNS in a
browser. DoH blocking uses a known-endpoint address list, not detection of every
possible encrypted resolver.

## Choose Upstreams by Their Role

| LuCI field | UCI option | Purpose |
| --- | --- | --- |
| Default nameservers | `default_nameserver` | Bootstrap resolution of DNS upstream hostnames |
| Proxy nameservers | `proxy_server_nameserver` | Resolution of outbound server hostnames |
| Nameservers | `nameserver` | Normal upstream resolution when no specific policy applies |
| Direct nameservers | `direct_nameserver` | Optional upstreams for direct outbound resolution |

Bootstrap resolvers must be usable before hostname-based upstreams are resolved;
use a supported address-based configuration. Avoid a circular dependency between
resolving an outbound server and reaching DNS through that same outbound.

JustClash enables Mihomo's `respect-rules`. When Direct nameservers is populated,
it also enables `direct-nameserver-follow-policy`. Resolver choice and the path
used to contact that resolver are related but distinct settings. See
[Mihomo DNS documentation](https://wiki.metacubex.one/en/config/dns/) for the
upstream syntax supported by the installed core.

## Static Hosts and Nameserver Policies

**Hosts mapping** uses `<DOMAIN>/<IP>`: it supplies static address mappings in
Mihomo. Multiple rows for the same name produce a list of addresses. Adding a
resolver hostname here can supply its address, but does not add another DNS
server to any nameserver list. Stale mappings can prevent hostname resolution
from following an upstream address change.

**Use system hosts** additionally imports the router's system hosts. JustClash
always enables Mihomo's own configured hosts map.

**Nameserver policy** uses `<DOMAIN_MATCHER>/<UPSTREAM>`. It chooses where a
matching DNS name is resolved; it does not assign website traffic to an outbound.
The first slash separates the matcher from the upstream, so an upstream URL can
contain its own slashes. Repeated matchers collect upstreams without duplicates.

Keep a specific subdomain entry only when it needs different behavior from its
parent suffix. Review overlapping matchers before removing a rule. Never pin
ordinary application/CDN addresses just to shorten the DNS configuration.

## Understand the Fake-IP Rules

JustClash generates rule-based Fake-IP filtering in this order:

1. **Force real IP rules**, **Force real IP rulesets**, and **Force real IP geosites**.
2. Domain matches from enabled routing groups and individual outbounds.
3. A final real-IP fallback for unmatched names.

Consequently, real-IP exceptions take precedence over generated Fake-IP matches.
Enter plain domain suffixes in **Force real IP rules**; entries containing `*`
become wildcard matches. Ruleset and Geosite selectors refer to active routing
entries, not arbitrary sources that have never been enabled.

A real-IP exception changes the DNS answer, not the outbound rule itself. In
Partial Interception, the resulting connection may bypass Mihomo unless a manual
address/source rule or active text IP-CIDR list captures it. In Full Interception,
eligible real-address connections still enter the core. See
[routing mode behavior](../concepts/routing.md#behavior-comparison).

Change these exceptions only to solve a specific compatibility issue, and test
the resulting traffic path. Removing necessary local, router, or discovery
exceptions can also break devices. Keep Fake-IP pools away from networks used by
the router and its clients.

## Sniffer Exceptions Are Separate

**Setup: Proxy** contains sniffer settings. A sniffer exception controls protocol
inspection of an already intercepted connection. It neither forces a real DNS
answer nor creates a firewall bypass. Copying DNS exceptions into the sniffer
list is not automatically required.

## Bypassed Clients and Guest Networks

Clients excluded from interception must receive real addresses. Advertising the
managed Fake-IP DNS path to a completely bypassed client can make domain access
fail even while raw-address connectivity works. Configure that client's DHCP/DNS
scope separately; see [Traffic exclusions](traffic-exclusions.md) and
[Guest networks](guest-network.md).

## Verify DNS and Routing Together

1. Apply changes and check **Status** and **Service logs** for startup errors.
2. Use a permitted test name and compare its DNS answer with the intended
   Fake-IP or real-IP behavior.
3. Clear cached client answers, then open a new connection.
4. Confirm the resulting path under **Connections**. Traffic outside Mihomo will
   not appear there.

For local DNS tests, use `justclash.sh check dns-proxy <DOMAIN>` or
`justclash.sh check dns-external <DOMAIN> <RESOLVER>`. See the
[CLI reference](../reference/cli.md#local-diagnostics) for the distinction between
local diagnostics and the reduced report for sharing.
