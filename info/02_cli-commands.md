# Command-Line Reference

Use OpenWrt service commands for normal lifecycle management. Use `justclash.sh` for updates, diagnostics, and maintenance tasks.

## Service Management

| Command | Purpose |
| --- | --- |
| `service justclash start` | Start the managed service. |
| `service justclash stop` | Stop Mihomo and remove JustClash routing state. |
| `service justclash restart` | Stop and start the service. |
| `service justclash reload` | Reload the service configuration. |
| `service justclash enable` | Enable startup at boot. |
| `service justclash disable` | Disable startup at boot. |
| `service justclash status` | Show the procd service status. |

The equivalent init script is `/etc/init.d/justclash`.

## JustClash Commands

Run commands as:

```sh
justclash.sh <command> [arguments]
```

### Lifecycle and Versions

| Command | Aliases | Purpose |
| --- | --- | --- |
| `start` | `run`, `up`, `u` | Run startup orchestration manually. Prefer `service justclash start` for normal use. |
| `stop` | `down`, `d` | Stop the service and clean up routing state. |
| `info_core` | `info_mihomo`, `version_core`, `vc`, `--vc` | Print the installed Mihomo version. |
| `info_package` | `version`, `v`, `-v`, `--version` | Print the JustClash package version. |

### Updates and Maintenance

| Command | Alias | Purpose |
| --- | --- | --- |
| `core_update` | `cu` | Resolve the configured update source and install a newer Mihomo core. |
| `core_remove` | `cr` | Remove the installed Mihomo binary. |
| `service_data_update` | `sdu` | Update the service ruleset catalogs. |
| `cron_update` | `cru` | Rebuild scheduled jobs from UCI settings. |
| `add_proxy <name> <uri>` | `ap` | Add a proxy URI from the command line. Treat the URI as a credential. |

### Logs

```sh
justclash.sh logs [line_count]
```

Aliases: `systemlogs`, `log`, `l`. The default is 40 lines.

### Diagnostics

| Command | Alias | Arguments | Purpose |
| --- | --- | --- | --- |
| `diag_report` | `diag`, `dg` | none | Print the combined diagnostic report. |
| `diag_nft` | `dn` | none | Check the JustClash nftables table. |
| `diag_route` | `dr` | none | Check policy-routing rules and tables. |
| `diag_icmp` | `di` | `<target> [count]` | Test ICMP connectivity. |
| `diag_proxy_resolver` | `dpr` | `<domain>` | Test Mihomo DNS resolution. |
| `diag_external_resolver` | `der` | `<domain> <resolver>` | Test an explicitly selected resolver. |
| `show_hwid` | `hwid` | none | Print the generated hardware identifier. |
| `diag_mihomo_config` | `dmc` | none | Print the generated Mihomo configuration with sensitive fields redacted. |
| `diag_service_config` | `dsc` | none | Print the UCI service configuration with sensitive fields redacted. |
| `diag_service_config_reset` | `dscr` | none | Back up the current configuration and restore package defaults. |

> [!WARNING]
> `diag_mihomo_config_unsafe` (`dmcu`) and `diag_service_config_unsafe` (`dscu`) print raw credentials, endpoints, and authorization data. Do not paste their output into tickets, chats, or public logs.

## Help and Exit Status

```sh
justclash.sh help
```

Aliases: `?`, `command`, `h`, `-h`, `--help`.

A zero exit status means the requested operation completed or was an intentional no-op. A nonzero status means validation, prerequisites, an external command, or application of a change failed. Read the system log for the specific cause:

```sh
justclash.sh logs 100
```

## Useful Recovery Sequence

```sh
service justclash stop
justclash.sh diag_service_config
justclash.sh core_update
service justclash start
justclash.sh logs 100
```

Use the unsafe configuration commands only when you are working locally and understand that their output contains secrets.
