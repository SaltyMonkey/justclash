# JustClash Documentation

Start with a working connection, then add the routing policy you need. The guides
use **outbound** for a connection path, **provider** for a subscription source,
and **group** for a selection of connections. LuCI field names are quoted as they
appear in the interface.

## First Setup

1. [Getting started](getting-started.md): install JustClash and route a test website.
2. [Outbounds, providers, and groups](guides/routing.md): add connections and choose which traffic uses them.
3. [Choosing a routing mode](concepts/routing.md): decide what should enter Mihomo.

## Configuration Guides

| I want to… | Read |
| --- | --- |
| Add a connection link, JSON outbound, subscription, or direct WAN path | [Configure routing](guides/routing.md) |
| Chain two outbounds using Connect through | [Connection chaining](guides/routing.md#chain-two-outbounds-with-connect-through) |
| Pass selected traffic to another local service using a mark | [direct:// and fwmark](guides/fwmark-handoff.md) |
| Configure DNS upstreams, static hosts, or real-IP exceptions | [DNS and Fake-IP](guides/dns.md) |
| Add my own domain or address list | [Custom rulesets](guides/rulesets.md) |
| Block domains or destination addresses | [Blocking](guides/blocking.md) |
| Use Geosite or GeoIP categories | [Geodata](guides/geodata.md) |
| Keep a client or router service outside interception | [Traffic exclusions](guides/traffic-exclusions.md) |
| Configure an explicit HTTP/SOCKS listener | [Mixed Port](guides/mixed-port.md) |
| Give a guest network routed or direct internet access | [Guest networks](guides/guest-network.md) |
| Select, balance, or fail over between WAN/VPN paths | [Multi-WAN and failover](guides/multiwan.md) |

## Operation and Security

| Task | Read |
| --- | --- |
| Protect controller access and handle credentials or download headers | [Security and access](guides/security.md) |
| Connect HTTPS LuCI to the controller | [Controller TLS](guides/controller-tls.md) |
| Update packages/core, back up, restore, or remove JustClash | [Maintenance](guides/maintenance.md) |
| Understand when changes take effect and YAML is regenerated | [Configuration lifecycle](concepts/configuration-lifecycle.md) |

## Troubleshooting

| Symptom | Start here |
| --- | --- |
| Startup fails, boot differs from a manual restart, or downloads fail | [Startup and WAN](troubleshooting/startup.md) |
| Nodes, Connections, Rules, or Realtime logs are empty or unavailable | [LuCI and controller access](troubleshooting/luci.md) |
| A website keeps using the normal connection | [Routing verification](guides/routing.md#verify-routing), then [DNS verification](guides/dns.md#verify-dns-and-routing-together) |
| A bypassed client loses domain connectivity | [DNS for bypassed clients](guides/dns.md#bypassed-clients-and-guest-networks) |

## Reference

- [UCI configuration](reference/uci.md): section types, settings, validation, and generated behavior.
- [Command line](reference/cli.md): service commands, resource updates, logs, and diagnostics.
- [ubus API](reference/ubus.md): methods, requests, responses, and access control.
- [Release notes](../RELEASENOTES.md): changes and compatibility notes by version.

Shell examples with `<PLACEHOLDERS>` need your own values. Keep credentials and
private network details local. For support, prefer `justclash.sh check` and review
its output before sharing; raw configurations and logs contain more information.
