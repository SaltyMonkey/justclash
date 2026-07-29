# Startup and WAN Troubleshooting

Startup problems are usually timing problems: the service starts while WAN, DNS, system time, or firewall state is still changing. Configure the smallest delay that fixes the actual condition instead of enabling every workaround at once.

## Symptom Guide

| Symptom | First setting to try |
| --- | --- |
| Service works after a manual restart but not after boot | `wait_for_wan` |
| WAN is reported up, but DNS or routes are not ready | `delayed_boot` |
| TLS downloads fail immediately after boot | `ntpd_start` and WAN readiness |
| Startup is slow because warnings and compatibility checks run every time | Review, then optionally enable `skip_environment_checks` |

## Wait for WAN

Enable **Wait for WAN** when the uplink takes time to establish, especially with PPPoE or cellular modems.

LuCI: **Services -> JustClash -> Service -> Startup**.

```sh
uci set justclash.settings.wait_for_wan='1'
uci set justclash.settings.wait_for_wan_max='90'
uci commit justclash
```

`wait_for_wan_max` limits how long startup waits. Reaching the limit does not prove internet access is working; it only prevents startup from waiting forever.

## Delayed Startup

Use a fixed delay when the network interface exists but another OpenWrt service still needs time to settle.

```sh
uci set justclash.settings.delayed_boot='1'
uci set justclash.settings.delayed_boot_value='15'
uci commit justclash
```

Start with a short delay. A very large value hides ordering problems and makes every restart unnecessarily slow.

## System Time Synchronization

Routers without a persistent real-time clock may boot with an incorrect date. This can break TLS certificate validation, scheduled jobs, and useful timestamps.

When `ntpd_start` is enabled, JustClash runs a synchronous NTP update before continuing:

```sh
uci set justclash.settings.ntpd_start='1'
uci commit justclash
```

Disable it if the router already synchronizes time reliably before JustClash starts. When disabled, an empty NTP server list is ignored as a successful no-op.

Mihomo's internal NTP options are separate from system time synchronization. They affect the core configuration and do not replace correct system time for package downloads, cron, or system logs.

## Environment Checks

Startup checks detect common conflicts and apply compatibility fixes. They can warn about:

- DNS settings left by another service;
- external resolvers that bypass the intended DNS path;
- other DPI or proxy services;
- incompatible network sysctl state;
- missing commands or the Mihomo binary.

`skip_environment_checks` skips optional conflict checks and compatibility fixes. It does not skip required binary and tool checks.

```sh
uci set justclash.settings.skip_environment_checks='1'
uci commit justclash
```

Enable this only after the router starts reliably and you have recorded the working network configuration. Saving a few milliseconds is less exciting when the saved time is spent diagnosing a silent conflict later.

## Recommended Troubleshooting Order

1. Check service state and recent logs:

   ```sh
   service justclash status
   justclash.sh logs 100
   ```

2. Verify the core is installed:

   ```sh
   justclash.sh info_core
   ```

3. Confirm WAN and system time outside JustClash.
4. Enable `wait_for_wan`.
5. Add a small delayed startup only if WAN readiness is not enough.
6. Keep environment checks enabled until startup is stable.
7. Run the diagnostic report:

   ```sh
   justclash.sh diag_report
   ```

## Scheduled Restarts and Work Windows

Cron settings are stored in UCI but must be applied to the root crontab:

```sh
justclash.sh cron_update
```

Run this after changing autorestart, service-data update, or scheduled start/stop settings outside LuCI. Confirm the resulting schedule before relying on it for unattended operation.
