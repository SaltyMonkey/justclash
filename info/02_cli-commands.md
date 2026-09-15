# Command-Line Reference

Use OpenWrt service commands for normal lifecycle management. Use `justclash.sh` for updates, diagnostics, and maintenance.

For programmatic calls from LuCI or another local RPC client, see the [ubus API Reference](13_ubus-api.md).

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
| `start` | `run`, `up` | Run startup orchestration manually; prefer the procd service command |
| `stop` | `down`, `d` | Stop and clean managed routing state |
| `version core` | — | Print the installed Mihomo version |
| `version package` | — | Print the JustClash package version |

## Resources and Scheduling

| Command | Purpose |
| --- | --- |
| `resources core update` | Resolve the configured source and install a newer compatible Mihomo core |
| `resources core remove [-y|-Y|--yes]` | Remove the installed Mihomo binary after confirmation |
| `resources data update` | Refresh built-in service data and ruleset catalogs |
| `schedule sync` | Rebuild scheduled jobs from UCI |

`resources core remove` and `config reset` prompt on a terminal. Non-interactive callers must pass `-y`, `-Y`, or `--yes` explicitly.

After changing cron fields directly through UCI, run:

```sh
justclash.sh schedule sync
```

## Logs

JustClash sends service and Mihomo messages to the OpenWrt system log. It no longer writes a separate runtime log file.

To read recent JustClash entries:

```sh
justclash.sh logs service [line_count]
```

The default is 40 lines. `logs service` and `logs system` read the same system-log entries; `logs service` remains available for existing scripts.

The LuCI **Service logs** page requests 400 recent lines through RPC. This does not change the CLI default.

The equivalent command is:

```sh
justclash.sh logs system [line_count]
```

System-log entries can contain addresses, domains, interface names, or endpoints. Inspect them before sharing.

## Diagnostics

### Safe Summary for Sharing

```sh
justclash.sh check
```

This command reduces diagnostic results to statuses and redacts values that commonly identify network topology or credentials. It is the preferred command for support requests.

### Local Diagnostics

| Command | Purpose |
| --- | --- |
| `check full --unsafe` | Print the full local diagnostic report |
| `check nft` | Inspect the JustClash nftables state |
| `check routes` | Inspect policy-routing rules and tables |
| `check ping <TARGET> [COUNT]` | Test ICMP connectivity |
| `check dns-proxy <DOMAIN>` | Test Mihomo DNS resolution |
| `check dns-external <DOMAIN> <RESOLVER>` | Test an explicitly selected resolver |
| `check hwid` | Print the generated hardware identifier |

These commands may print local addresses, routes, domains, resolver information, or hardware identifiers. Do not paste their raw output into public issues.

### Configuration Diagnostics

| Command | Purpose |
| --- | --- |
| `config show mihomo` | Show generated Mihomo configuration with credential fields redacted |
| `config show service` | Show UCI configuration with credential fields redacted |
| `config show mihomo --unsafe` | Show raw generated Mihomo configuration |
| `config show service --unsafe` | Show raw UCI configuration |

> [!CAUTION]
> “Redacted” configuration commands hide known credential fields but can still reveal domains, endpoints, addresses, routing policy, and local topology. The unsafe commands additionally expose credentials and authorization data.

## Reset Configuration

| Command | Purpose |
| --- | --- |
| `config reset [-y|-Y|--yes]` | Back up the active config and restore package defaults |

```sh
service justclash stop
justclash.sh config reset --yes
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
justclash.sh logs service 100
```

## Recovery Sequence

```sh
service justclash stop
justclash.sh config show service
justclash.sh resources core update
service justclash start
justclash.sh logs service 100
```

If the output must leave the router, collect `check` separately instead of sharing the full recovery transcript.
