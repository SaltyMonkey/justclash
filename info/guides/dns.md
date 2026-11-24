# DNS and Fake-IP

[Documentation](../README.md)

Use **Services → JustClash → Setup: DNS** to configure Mihomo DNS. For the first
setup, keep the shipped upstreams and real-IP exceptions. DNS and interception
must agree: a client receiving a synthetic Fake-IP address needs a traffic path
through Mihomo.

## Set Up the DNS Path

Under **Setup: Service → Traffic rules**, **Change DNS settings at startup** lets
JustClash set the local Mihomo DNS listener as the first dnsmasq instance's
default upstream. This switch is separate from **Create nftables**. Keep both
enabled for the normal transparent setup, and configure client DHCP to advertise
the router as DNS.

The **DNS listen port** is the local Mihomo listener, not a remote upstream port.
It must be unused and must agree with dnsmasq forwarding. When JustClash manages
dnsmasq, its saved state is restored on a clean stop; see
[Configuration lifecycle](../concepts/configuration-lifecycle.md#dns-recovery).

Existing dnsmasq `server` rules for specific zones, local-only zones, and
unqualified names stay active. General DNS servers and catch-all forwarding
rules are replaced by the Mihomo upstream. This keeps local or VPN DNS zones
working without taking over the entire DNS setup manually. Those zone rules
are handled by dnsmasq before Mihomo DNS and its Fake-IP rules.

With **Create nftables** enabled, **Client DNS traffic** controls TCP and UDP
queries to port 53 on **Client traffic interfaces**. **By rules** follows normal
routing. **Drop** blocks eligible external DNS queries. **Hijack** redirects those
queries to the router's DNS service on port 53. Router-local and private/LAN
destinations and clients bypassed by IP or MAC skip these two actions. Port
exclusions can exempt a query from **Drop**. The DNS redirects use separate rules.

Use [the separate DNS redirect](traffic-exclusions.md#fake-ip-and-bypassed-clients)
for IP/MAC exclusions or for networks outside **Client traffic interfaces**.
DoH blocking uses a list of known endpoint addresses.

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

**Respect routing rules** is off by default under **Setup: DNS → Basic**.
Turn it on to make Mihomo use your routing rules to reach upstream DNS servers.
Set **Proxy nameservers** so Mihomo can resolve proxy server hostnames before
connecting to them.

If you configure **Direct nameservers**, DNS lookups for direct connections
also follow **Nameserver policy**. For supported upstream formats, see the
[Mihomo DNS documentation](https://wiki.metacubex.one/en/config/dns/).

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

Both fields use multiline editors with 12 visible rows. Enter one complete
mapping or policy per line. Empty lines and surrounding whitespace are removed,
and exact duplicates are dropped on save. DNS URLs retain their case, commas,
and query parameters. Existing UCI lists are preserved.

Keep a specific subdomain entry only when it needs different behavior from its
parent suffix. Review overlapping matchers before removing a rule. Never pin
ordinary application/CDN addresses just to shorten the DNS configuration.

## Understand the Fake-IP Rules

JustClash generates rule-based Fake-IP filtering in this order:

1. **Force real IP rules**, **Force real IP rulesets**, and **Force real IP geosites**.
2. Domain matches from enabled routing groups and individual outbounds.
3. A final real-IP fallback for unmatched names.

Consequently, real-IP exceptions take precedence over generated Fake-IP matches.
Enter one domain suffix or wildcard per line in **Force real IP rules** and one
category per line in **Force real IP geosites**. The **Force real IP rulesets**
selector lists active routing rulesets.

A real-IP exception changes the DNS answer. The resulting connection goes
through Mihomo if a manual address or source rule or an active text IP-CIDR
list captures it. See [Partial Interception](../concepts/routing.md#partial-interception).

Change these exceptions only to solve a specific compatibility issue, and test
the resulting traffic path. Removing necessary local, router, or discovery
exceptions can also break devices. Keep Fake-IP pools away from networks used by
the router and its clients.

## Sniffer Exceptions Are Separate

**Setup: Proxy** contains sniffer settings. A sniffer exception controls protocol
inspection of an already intercepted connection. It neither forces a real DNS
answer nor creates a firewall bypass. Copying DNS exceptions into the sniffer
list is not automatically required.

**Excluded from sniffer domains** uses a multiline editor with 12 visible rows.
Enter one matcher per line. Each matcher is validated; saved entries use lowercase
and duplicates are removed. Entries are stored as a UCI list.

## Bypassed Clients and Guest Networks

Give clients outside interception a resolver that returns real addresses. Use the
[Bypassed DNS redirect port](traffic-exclusions.md#fake-ip-and-bypassed-clients)
to send their queries to a separate resolver on the router. You can also
advertise the resolver through DHCP or IPv6 Router Advertisements. See the
[guest network recipes](guest-network.md#choose-a-design).

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
