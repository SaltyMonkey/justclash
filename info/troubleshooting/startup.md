# Startup and WAN Troubleshooting

[Documentation](../README.md)

Start with the first error in Service logs. Failures can come from configuration,
a missing core, occupied ports, WAN readiness, DNS, time, or storage. Boot-only
failures often require a startup-order adjustment; enable one adjustment at a
time and verify what it fixes.

## Symptom Matrix

| Symptom | First check | Likely adjustment |
| --- | --- | --- |
| Works after manual restart, fails after boot | Default route availability | `wait_for_wan` |
| WAN is up but DNS/routes are still changing | Neighboring OpenWrt services | Small `delayed_boot` |
| TLS downloads fail immediately after boot | System clock | `ntpd_start` |
| Startup warns about another DNS/proxy service | Conflict log | Fix the conflict before skipping checks |
| Port validation fails | Active listeners | Change the conflicting listener |
| Core is missing | Installed core version | Run `resources core update` |

## LuCI Live Pages Are Unavailable

Check the service state on **Status** and startup failures in **Service logs**.
If the service is running but live data is unavailable, follow
[LuCI Pages and Core Availability](luci.md#when-a-live-page-is-unavailable)
to distinguish API credentials, TLS, and connection problems.

## Configuration Validation Fails

A schema failure identifies the section type and option in Service logs. Check
that value in [UCI reference](../reference/uci.md), including disabled sections.
Missing values with declared defaults are filled in memory; invalid supplied
values are not replaced. Later Mihomo validation can also reject unresolved
outbound references or an incompatible generated setting.

Review the first specific error before the generic failure message. Do not reset
the entire configuration merely because startup stopped; first correct the
reported field or restore a known backup.

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

Start with the smallest useful value. WAN waiting and delayed startup are read
by the init script's boot path; normal manual restarts do not replay these boot
delays. Saving the setting and restarting now verifies ordinary startup, but its
boot-specific effect must be checked at the next planned reboot.

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

Startup checks required tools and the core, configured port collisions, and
occupied listeners. It also warns about known service/DNS conflicts and runs
compatibility adjustments. A warning does not necessarily abort startup; a
failed required check does.

The current implementation does not read a `skip_environment_checks` setting.
Do not add it to bypass a port or configuration error. Resolve the reported
condition instead.

## Recommended Diagnostic Order

1. Check procd and recent logs:

   ```sh
   service justclash status
   justclash.sh logs service 100
   ```

2. Confirm the core exists:

   ```sh
   justclash.sh version core
   ```

3. Verify WAN, DNS, and system time outside JustClash.
4. For boot-only failures, enable `wait_for_wan`.
5. For remaining boot-order problems, add a short delay only if WAN readiness is insufficient.
6. Resolve reported conflicts and retest normal startup.
7. Run the privacy-reduced report:

   ```sh
   justclash.sh check
   ```

Use `check full --unsafe`, `check routes`, and raw logs locally; they can reveal network details.

## Scheduled Jobs

After changing restart, data-update, or start/stop schedules through UCI, run
[`schedule sync`](../reference/cli.md#resources-and-scheduling) to rebuild the
root crontab.

Confirm the resulting behavior before depending on it remotely. Check the accepted expression format in LuCI before relying on a schedule.

## Roll Back Startup Workarounds

```sh
uci set justclash.settings.wait_for_wan='0'
uci set justclash.settings.delayed_boot='0'
uci commit justclash
service justclash restart
```

Keep `ntpd_start` enabled unless another OpenWrt service reliably synchronizes time before JustClash starts.
