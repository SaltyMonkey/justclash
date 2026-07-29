# JustClash Quick Start

This guide covers the shortest supported path from installation to a working routing policy. Use LuCI for the first setup; use UCI only when you need automation or recovery.

## Before You Start

You need:

- a supported OpenWrt build with enough free storage;
- SSH access to the router;
- a working WAN connection;
- at least one proxy URI or proxy-provider subscription;
- the package format used by your OpenWrt release (`apk` or `opkg`).

> [!IMPORTANT]
> A subscription URL, proxy URI, API password, and authorization header are credentials. Do not include them in screenshots, diagnostics, or support requests.

## Install JustClash

### Online Installer

Download the installer, inspect it if required by your security policy, and run it:

```sh
wget -O /tmp/justclash-install.sh \
  https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh
sh /tmp/justclash-install.sh
```

For non-interactive installation:

```sh
sh /tmp/justclash-install.sh --automated
```

### Release Packages

1. Download the `justclash` and `luci-app-justclash` packages matching your OpenWrt release and CPU architecture.
2. Upload them to `/tmp` on the router.
3. Install them with the package manager used by that release.

```sh
# APK-based OpenWrt
apk add --allow-untrusted /tmp/justclash-*.apk /tmp/luci-app-justclash-*.apk

# OPKG-based OpenWrt, when packages are provided for that release
opkg install /tmp/justclash-*.ipk /tmp/luci-app-justclash-*.ipk
```

Install the Mihomo core from **Services -> JustClash -> Status -> Update Core**, or run:

```sh
justclash.sh core_update
```

## Choose a Routing Mode

Open **Services -> JustClash -> Service**.

| Mode | Use it when | Important behavior |
| --- | --- | --- |
| `partial` | Only selected domains and IP lists should be intercepted | Unmatched traffic bypasses Mihomo. The final rule cannot proxy traffic that never reaches the core. |
| `full` | Mihomo should evaluate all selected client and router traffic | More predictable policy and observability, with higher CPU and memory use. |

Start with `partial` for selective routing. Use `full` when the final policy must apply to every connection. See [Choosing a Routing Mode](00_routing_architecture_and_design.md).

## Configure an Outbound

Open **Services -> JustClash -> Routing**.

### Proxy Provider

1. Add a row under **Proxy providers**.
2. Set a unique name.
3. Enter the subscription URL.
4. Enable health checks only if the provider supports them and the router has enough resources.
5. Save the row.

### Individual Proxy

1. Add a row under **Proxies**.
2. Set a unique name.
3. Select `uri` for a proxy URI or `object` for a JSON object.
4. Enter the connection data.
5. Save the row.

Saving a row only updates the current LuCI form. It does not restart the service.

## Create a Proxy Group

Still on **Routing**:

1. Add a **Proxy group**.
2. Choose a unique group name.
3. Choose a group type:
   - `select` for manual selection;
   - `url-test` for automatic latency-based selection;
   - `fallback` for ordered failover;
   - `load-balance` for distributing connections.
4. Add the provider or individual proxies created earlier.
5. Save the row.

A provider that is not referenced by a group or rule may be downloaded successfully but never used. This is a common configuration, although not usually the intended one.

## Define the Routing Policy

Configure these sections on **Routing**:

1. Add domain, IP, RuleSet, or Geodata matches to the appropriate proxy or group.
2. Enable **Block rules** only for lists or manual entries you actually need.
3. Set **Default rule**:
   - choose a proxy group to send unmatched traffic through that group;
   - choose `DIRECT` to proxy only explicitly matched traffic.

In `partial` mode, the default rule applies only after the firewall has intercepted a connection.

## Select Client Interfaces

Open **Service -> Traffic rules** and check **Client traffic interfaces**. Add every bridge or device whose client traffic should be intercepted. The main LAN bridge is commonly selected by default; guest and secondary networks are not automatically equivalent to it.

For a guest network, follow [Guest Network Configuration](08_use_guest_network.md) before adding the interface.

## Save and Apply

LuCI has three different save states:

1. **Save** inside a row editor updates that row in the page.
2. **Save** on the page stages UCI changes.
3. **Save & Apply** commits the configuration and runs the service changes.

After applying:

1. Open **Status** and verify that the service and Mihomo core are running.
2. Open **Nodes** and check provider/node availability.
3. Open **System logs** if startup failed.
4. Run a full diagnostic when the basic cause is not visible:

```sh
justclash.sh diag_report
```

## Common First-Run Problems

| Symptom | Check |
| --- | --- |
| Core is missing | Run `justclash.sh core_update`. |
| Provider exists but no traffic uses it | Add it to a proxy group and reference that group in rules or the default rule. |
| Unmatched traffic stays direct in `partial` mode | This is expected unless the traffic is intercepted by Fake-IP or an active IP-CIDR list. |
| A bypassed client cannot open domains | It may still receive Fake-IP answers. See [Traffic Exclusions](04_service_traffic_exclusion.md). |
| LuCI is HTTPS but status pages show the core as disconnected | Configure API TLS or a reverse proxy. See [Secure API Access](10_secure_access.md). |
| Startup fails after boot but works later | Configure WAN wait or delayed startup. See [Startup and WAN Issues](03_startup_and_wan_issues.md). |

## Further Reading

- [UCI Configuration Reference](01_uci-structure.md)
- [CLI Commands](02_cli-commands.md)
- [User-Defined RuleSets](05_user_defined_rulesets.md)
- [Block Rules](06_block_rules.md)
- [Mixed Port](07_mixed_port.md)
- [Multi-WAN and Failover](09_multiwan_balancing_failover.md)
- [Geodata and GeoIP](11_geodata_and_geoip.md)
