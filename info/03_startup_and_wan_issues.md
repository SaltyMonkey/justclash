# Startup and WAN Troubleshooting

Startup failures are usually ordering problems: WAN, DNS, system time, storage, or firewall state is not ready when JustClash starts. Enable one workaround at a time and verify which condition it fixes.

## Symptom Matrix

| Symptom | First check | Likely adjustment |
| --- | --- | --- |
| Works after manual restart, fails after boot | Default route availability | `wait_for_wan` |
| WAN is up but DNS/routes are still changing | Neighboring OpenWrt services | Small `delayed_boot` |
| TLS downloads fail immediately after boot | System clock | `ntpd_start` |
| Startup warns about another DNS/proxy service | Conflict log | Fix the conflict before skipping checks |
| Port validation fails | Active listeners | Change the conflicting listener |
| Core is missing | Installed core version | Run `core_update` |

## Wait for WAN

LuCI: **Services → JustClash → Setup: Service → Startup**.

```sh
uci set justclash.settings.wait_for_wan='1'
uci set justclash.settings.wait_for_wan_max='<SECONDS>'
uci commit justclash
service justclash restart
```

`wait_for_wan_max` limits the wait for an active default route. Reaching that state does not prove DNS, system time, or every upstream is ready.

Use this first for PPPoE, cellular, or other uplinks that appear late during boot.

## Delayed Startup

Use a fixed delay only when the interface and default route exist but another required service still needs time.

```sh
uci set justclash.settings.delayed_boot='1'
uci set justclash.settings.delayed_boot_value='<SECONDS>'
uci commit justclash
service justclash restart
```

Start with the smallest available value. A large delay can hide the dependency while making every real restart slower.

## System Time

Routers without a persistent real-time clock may boot with an invalid date. This breaks certificate validation, secure downloads, cron, and useful log timestamps.

```sh
uci set justclash.settings.ntpd_start='1'
uci commit justclash
service justclash restart
```

When enabled, JustClash runs BusyBox `ntpd` once in query/synchronize mode before continuing. It does not keep a second long-running NTP daemon.

Mihomo internal NTP settings are separate. They affect the generated core configuration and do not replace correct system time for package downloads or OpenWrt services.

## Environment Checks

The optional preflight checks warn about:

- conflicting DNS settings;
- known proxy or DPI services;
- compatibility state that JustClash can repair;
- ports already used by another process.

Required tool, core, path, and value validation still runs when optional checks are skipped.

```sh
uci set justclash.settings.skip_environment_checks='1'
uci commit justclash
service justclash restart
```

Enable this only after recording a stable working configuration. Hiding a warning is not the same as resolving it, although both are equally quiet.

## Recommended Diagnostic Order

1. Check procd and recent logs:

   ```sh
   service justclash status
   justclash.sh logs 100
   ```

2. Confirm the core exists:

   ```sh
   justclash.sh info_core
   ```

3. Verify WAN, DNS, and system time outside JustClash.
4. Enable `wait_for_wan`.
5. Add a short delay only if WAN readiness is insufficient.
6. Keep environment checks enabled until startup is stable.
7. Run the privacy-reduced report:

   ```sh
   justclash.sh diag_redacted
   ```

Use `diag_report`, `diag_route`, and raw logs locally; they can reveal network details.

## Scheduled Jobs

After changing schedules through UCI, rebuild the root crontab:

```sh
justclash.sh cron_update
```

This applies:

- scheduled restarts;
- service-data updates;
- scheduled start/stop windows.

Confirm the resulting behavior before depending on it remotely. A typo in a cron expression is wonderfully reliable at doing the wrong thing unattended.

## Roll Back Startup Workarounds

```sh
uci set justclash.settings.wait_for_wan='0'
uci set justclash.settings.delayed_boot='0'
uci set justclash.settings.skip_environment_checks='0'
uci commit justclash
service justclash restart
```

Keep `ntpd_start` enabled unless another OpenWrt service reliably synchronizes time before JustClash starts.
