# JustClash Quick Start

This guide covers one supported path from installation to a working domain-routing rule. It intentionally uses one outbound and one proxy group; add providers, failover, and larger rulesets only after this path works.

## Before You Start

You need:

- a supported OpenWrt release with enough free storage;
- SSH access and a working WAN connection;
- one proxy URI or one JSON outbound definition;
- the package format used by the router: APK or IPK.

## 1. Install the Packages

### Online Installer

Interactive installation:

```sh
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh
```

Automatic installation with the latest JustClash release:

```sh
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh --automated
```

Install a specific JustClash release:

```sh
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh --automated --custom_version 0.90.13_rc1
```

Replace `0.90.13_rc1` with the required release version. Accepted formats are `X.Y.Z`, `X.Y.Z_rcN`, and the same values with a leading `v`.

Useful variants:

```sh
# Automatic installation with minimal normal output
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh --automated --silent

# Download or update only the Mihomo core
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh --update-core

# Skip the free-space check only when it is known to be unnecessary
wget -qO /tmp/justclash-install.sh 'https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh' && sh /tmp/justclash-install.sh --automated --skip-space-check
```

| Parameter | Short form | Effect |
| --- | --- | --- |
| `--automated` | `--auto`, `-y` | Installs without the translation prompt |
| `--silent` | `-s` | Hides normal stdout; errors remain visible |
| `--custom_version VERSION` | — | Selects a specific JustClash package release |
| `--update-core` | `-u` | Downloads or updates the stable Mihomo core without installing JustClash release packages |
| `--skip-space-check` | — | Skips the installer free-space check |

`--custom_version` pins the `justclash` and LuCI packages only. The installer still selects the current stable Mihomo core for the detected CPU architecture. It detects APK or OPKG automatically; interactive installation also asks which LuCI translation to install.

### Manual Installation from a Release

The `justclash` and `luci-app-justclash` packages have architecture `all`. Select `.apk` or `.ipk` for the router's OpenWrt package manager. Only the separately downloaded Mihomo core is CPU-specific.

Download `SHA256SUMS` from the same release and verify every selected package before installation. See [Update, Backup, Restore, and Removal](12_update_backup_remove.md#verify-manual-release-files) for the exact verification workflow.

```sh
# APK-based OpenWrt
apk add --allow-untrusted /tmp/justclash-*.apk /tmp/luci-app-justclash-*.apk

# OPKG-based OpenWrt
opkg install /tmp/justclash-*.ipk /tmp/luci-app-justclash-*.ipk
```

Install the core from **Services → JustClash → Status → Update Core**, or run:

```sh
justclash.sh core_update
```

## 2. Choose the Routing Mode

Open **Services → JustClash → Setup: Service → Traffic rules**.

| Mode | Choose it when | Important behavior |
| --- | --- | --- |
| Partial Interception (`partial`) | Only selected domains and text IP-CIDR rulesets should enter Mihomo | Unmatched real-address traffic bypasses the core |
| Full Interception (`full`) | Every selected connection must be evaluated by Mihomo | More predictable rules, with higher CPU and memory use |

Start with `partial` for a narrow policy. Use `full` when the default rule must apply to every selected connection. See [Choosing a Routing Mode](00_routing_architecture_and_design.md).

Keep **Set traffic rules at startup** enabled and select the client bridge under **Client traffic interfaces**.

## 3. Configure DNS

Transparent domain routing depends on DNS and traffic interception working together.

1. In **Setup: Service → Traffic rules**, keep **Change DNS settings at startup** enabled.
2. Open **Setup: Proxy → DNS settings**.
3. Configure at least one bootstrap resolver under **Default nameserver**. Use a resolver address that does not itself require domain resolution.
4. Configure the normal upstream under **Nameserver**.
5. Configure **Proxy-server nameserver** when proxy hostnames need a separate bootstrap path.
6. Keep Fake-IP enabled and leave the Fake-IP ranges at their package defaults for the first setup.
7. Save the page, but do not apply yet.

> [!WARNING]
> A client that receives Fake-IP answers must also have its traffic intercepted. Do not add a proxied domain to a Fake-IP exclusion in Partial Interception unless an active text IP-CIDR ruleset still captures its real addresses.

For DNS policy details and bypassed clients, see [Traffic Exclusions](04_service_traffic_exclusion.md) and [Guest Network Configuration](08_use_guest_network.md).

## 4. Add One Outbound

Open **Services → JustClash → Setup: Routing → Proxies**.

1. Add a proxy.
2. Enable it and set a unique name.
3. Select `uri` or `object`.
4. Enter the proxy URI or JSON object.
5. Save the row.

Saving the row updates the LuCI form only. It does not restart the service.

## 5. Create One Group

Under **Proxy groups**:

1. Add a group.
2. Select type `select`.
3. Add the outbound created above.
4. Set it as **Default selected** when required.
5. Save the row.

Using a group keeps routing rules stable when an outbound is later replaced.

## 6. Add One Rule

In the new group, add one test suffix under **Domain route**. Use a non-sensitive domain that you control or are permitted to test.

Keep **Default rule** set to `DIRECT` for this first narrow policy. In Partial Interception, the default rule still applies only to traffic that reached Mihomo.

## 7. Save and Apply

LuCI has three separate stages:

1. **Save** in a row editor stores that row in the page.
2. **Save** on the page stages UCI changes.
3. **Save & Apply** commits UCI and reloads the service.

After applying, open **Status** and confirm that both the service and Mihomo are running.

## 8. Verify

```sh
service justclash status
justclash.sh info_core
justclash.sh diag_redacted
justclash.sh logs 100
```

Then verify:

- the outbound and group appear under **Nodes**;
- a permitted test domain matches the new rule;
- the connection appears under **Connections**;
- unrelated traffic remains direct in Partial Interception;
- DNS works after renewing the client lease or clearing its cache.

Use `diag_redacted` when sharing a diagnostic result. Other diagnostics can contain local addresses, domains, routes, or hardware identifiers.

## Next Steps

- [UCI Configuration Reference](01_uci-structure.md)
- [Command-Line Reference](02_cli-commands.md)
- [User-Defined Rulesets](05_user_defined_rulesets.md)
- [Block Rules](06_block_rules.md)
- [Security Concerns](10_security_concerns.md)
- [Update, Backup, Restore, and Removal](12_update_backup_remove.md)
