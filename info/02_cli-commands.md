# Command-Line Reference

Use OpenWrt service commands for normal lifecycle management. Use `justclash.sh` for updates, diagnostics, and maintenance.

## Service Management

| Command | Purpose |
| --- | --- |
| `service justclash start` | Start the procd-managed service |
| `service justclash stop` | Stop Mihomo and remove managed routing state |
| `service justclash restart` | Perform a complete stop and start |
| `service justclash reload` | Reload the UCI configuration |
| `service justclash enable` | Enable startup at boot |
| `service justclash disable` | Disable startup at boot |
| `service justclash status` | Show procd state |

The equivalent init script is `/etc/init.d/justclash`.

## Syntax

```sh
justclash.sh <command> [arguments]
```

## Lifecycle and Version Commands

| Command | Aliases | Purpose |
| --- | --- | --- |
| `start` | `run`, `up`, `u` | Run startup orchestration manually; prefer the procd service command |
| `stop` | `down`, `d` | Stop and clean managed routing state |
| `info_core` | `core_info_mihomo`, `version_core`, `vc`, `--vc` | Print the installed Mihomo version |
| `info_package` | `version`, `v`, `-v`, `--version` | Print the JustClash package version |

## Updates and Scheduling

| Command | Alias | Purpose |
| --- | --- | --- |
| `core_update` | `cu` | Resolve the configured source and install a newer compatible Mihomo core |
| `core_remove` | `cr` | Remove the installed Mihomo binary |
| `service_data_update` | `sdu` | Refresh service ruleset catalogs |
| `cron_update` | `cru` | Rebuild scheduled jobs from UCI |

After changing cron fields directly through UCI, run:

```sh
justclash.sh cron_update
```

## Logs

JustClash writes each service and Mihomo message to both its private runtime log and the OpenWrt system log.

To read the private log:

```sh
justclash.sh logs [line_count]
```

Aliases: `log`, `l`. The default is 40 lines. The file is stored at `/tmp/justclash/justclash.log` with mode `0600` and is cleared when `/tmp` is recreated during a router reboot.

The LuCI **Service logs** page requests 400 recent lines through RPC. This does not change the CLI default.

To read JustClash entries still present in the OpenWrt system log:

```sh
justclash.sh systemlogs [line_count]
```

The default is 40 lines. Both logs can contain addresses, domains, interface names, or endpoints. Inspect them before sharing.

## Diagnostics

### Safe Summary for Sharing

```sh
justclash.sh diag_redacted
```

Alias: `dgr`.

This command reduces diagnostic results to statuses and redacts values that commonly identify network topology or credentials. It is the preferred command for support requests.

### Local Diagnostics

| Command | Alias | Arguments | Purpose |
| --- | --- | --- | --- |
| `diag_report` | `diag`, `dg` | None | Full local diagnostic report |
| `diag_nft` | `dn` | None | Inspect the JustClash nftables state |
| `diag_route` | `dr` | None | Inspect policy-routing rules and tables |
| `diag_icmp` | `di` | `<TARGET> [COUNT]` | Test ICMP connectivity |
| `diag_proxy_resolver` | `dpr` | `<DOMAIN>` | Test Mihomo DNS resolution |
| `diag_external_resolver` | `der` | `<DOMAIN> <RESOLVER>` | Test an explicitly selected resolver |
| `show_hwid` | `hwid` | None | Print the generated hardware identifier |

These commands may print local addresses, routes, domains, resolver information, or hardware identifiers. Do not paste their raw output into public issues.

### Configuration Diagnostics

| Command | Alias | Purpose |
| --- | --- | --- |
| `diag_mihomo_config` | `dmc` | Show generated Mihomo configuration with credential fields redacted |
| `diag_service_config` | `dsc` | Show UCI configuration with credential fields redacted |
| `diag_mihomo_config_unsafe` | `dmcu` | Show raw generated Mihomo configuration |
| `diag_service_config_unsafe` | `dscu` | Show raw UCI configuration |

> [!CAUTION]
> “Redacted” configuration commands hide known credential fields but can still reveal domains, endpoints, addresses, routing policy, and local topology. The unsafe commands additionally expose credentials and authorization data.

## Reset Configuration

| Command | Aliases | Purpose |
| --- | --- | --- |
| `config_reset` | `cfr`, `diag_service_config_reset`, `dscr` | Back up the active config and restore package defaults |

```sh
service justclash stop
justclash.sh config_reset
service justclash start
```

The backup can contain secrets. Keep it local and remove it only after the restored configuration has been verified.

## Help

```sh
justclash.sh help
```

Aliases: `?`, `command`, `h`, `-h`, `--help`.

## Exit Status

| Status | Meaning |
| --- | --- |
| `0` | Command completed or intentionally performed no work |
| Nonzero | Validation, prerequisites, an external tool, or application of a change failed |

Read local logs for the detailed cause:

```sh
justclash.sh logs 100
```

## Recovery Sequence

```sh
service justclash stop
justclash.sh diag_service_config
justclash.sh core_update
service justclash start
justclash.sh logs 100
```

If the output must leave the router, collect `diag_redacted` separately instead of sharing the full recovery transcript.
