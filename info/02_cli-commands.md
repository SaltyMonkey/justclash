# JustClash Command-Line Interface (CLI) Reference

This document provides a comprehensive reference for interacting with JustClash via the command-line interface.

---

## 1. System Service Management (`service justclash`)

OpenWrt supports managing system services using both the `service` utility wrapper and direct init script execution `/etc/init.d/justclash`. Using `service` is the recommended method.

| Command | Alternative | Description |
| :--- | :--- | :--- |
| `service justclash start` | `/etc/init.d/justclash start` | Starts the JustClash service process in the background under `procd`. |
| `service justclash stop` | `/etc/init.d/justclash stop` | Stops the running service and cleans up routing rules and firewall tables. |
| `service justclash restart` | `/etc/init.d/justclash restart` | Performs a full service restart (equivalent to `stop` followed by `start`). |
| `service justclash reload` | `/etc/init.d/justclash reload` | Instantly reloads rule compilations and configurations. |
| `service justclash enable` | `/etc/init.d/justclash enable` | Registers JustClash to start automatically at system boot time. |
| `service justclash disable` | `/etc/init.d/justclash disable` | Prevents JustClash from starting automatically at system boot time. |
| `service justclash status` | `/etc/init.d/justclash status` | Queries `procd` to check if the service instance is currently active. |

---

## 2. Standalone Control Script (`justclash.sh`)

The core control script `/usr/bin/justclash.sh` handles setup, routing, auto-updates, and diagnostics. It supports long-form commands and convenient short aliases.

### Service Management
| Command | Short Aliases | Description |
| :--- | :--- | :--- |
| `start` | `run`, `up`, `u` | Start/setup the service manually. |
| `stop` | `down`, `d` | Stop/clean up the service manually. |
| `info_core` | `info_mihomo`, `version_core`, `vc`, `--vc` | Output the current version of the installed Mihomo core. |
| `info_package`| `version`, `v`, `-v`, `--version` | Output the current JustClash version. |

### Core & Service Updates
| Command | Short Aliases | Description |
| :--- | :--- | :--- |
| `core_update` | `cu` | Checks and updates the Mihomo binary to the latest version. |
| `core_remove` | `cr` | Uninstalls and removes the currently installed Mihomo binary. |
| `cron_update` | `cru` | Updates all scheduled tasks from UCI settings. |
| `core_autorestart_cron_check` | `cacc` | Check if auto-restart cron schedule is active. |
| `core_autorestart_cron_add` | `caca` | Adds a cron schedule to periodically restart Mihomo. |
| `core_autorestart_cron_remove` | `cacr` | Removes the scheduled cron auto-restart task. |
| `service_data_cron_check` | `sdcc` | Check if rules/databases auto-update cron schedule is active. |
| `service_data_cron_add` | `sdca` | Adds a cron schedule to periodically update rules/databases. |
| `service_data_cron_remove` | `sdcr` | Removes the scheduled cron rules/databases update task. |
| `service_data_update` | `sdu` | Updates JustClash rules/static files from the repository. |

### Logs
| Command | Short Aliases | Arguments | Description |
| :--- | :--- | :--- | :--- |
| `logs` | `systemlogs`, `log`, `l` | `[lines]` | Show the last `N` lines of system logs (default: 40). |

### Diagnostics
| Command | Short Aliases | Arguments | Description |
| :--- | :--- | :--- | :--- |
| `diag_report` | `diag`, `dg` | *None* | Runs a full system diagnostic report (NFT, routes, resolves). |
| `show_hwid` | `hwid` | *None* | Outputs the generated Hardware ID (HWID) of the device. |
| `diag_nft` | `dn` | *None* | Verifies if the NFTables rules are properly loaded. |
| `diag_route` | `dr` | *None* | Outputs routing tables status. |
| `diag_icmp` | `di` | `[target] [count]` | Runs a latency/connectivity test using ICMP. |
| `diag_proxy_resolver` | `dpr` | `[domain]` | Tests resolving the given domain through the Mihomo internal resolver. |
| `diag_external_resolver` | `der` | `[domain] [dns]` | Tests resolving the domain through the default external resolver. |
| `diag_mihomo_config` | `dmc` | *None* | Prints the generated Mihomo configuration (**redacted**). |
| `diag_mihomo_config_unsafe` | `dmcu`| *None* | Prints the generated Mihomo configuration (**raw/unmasked**). |
| `diag_service_config` | `dsc` | *None* | Prints the UCI service config (**redacted**). |
| `diag_service_config_unsafe` | `dscu`| *None* | Prints the UCI service config (**raw/unmasked**). |
| `diag_service_config_reset` | `dscr` | *None* | Resets the JustClash configuration to default settings. |

### Help
| Command | Short Aliases | Description |
| :--- | :--- | :--- |
| `help` | `\?`, `command`, `h`, `-h`, `--help` | Show the help reference summary. |
