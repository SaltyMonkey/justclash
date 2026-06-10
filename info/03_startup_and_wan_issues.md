# Managing Startup and Problematic WAN Connections

When OpenWrt boots, multiple services (network, firewall, dnsmasq) start simultaneously. If the service starts before the router has established an active Internet connection (WAN), it might fail to download rulesets, fail to resolve proxy domains, or incorrectly assume all proxies are dead.

This is especially common with:
* **PPPoE Connections**: They take several seconds to negotiate after the physical link is up.
* **Cellular/LTE Modems**: They require time to register with the cell tower.
* **Slow CPU Routers**: Heavy services starting simultaneously can cause race conditions.

The service provides built-in mechanisms to handle these scenarios gracefully.

---

## 1. Wait for WAN (Recommended for PPPoE/Modems)

This feature pauses the JustClash startup process until a **default network route** is detected in the system, ensuring the router actually has internet access before launching the core proxy engine.

* **Via LuCI**: Go to *Services -> JustClash -> Startup Tab*.
  * Enable **Pause the startup process until the router establishes an active Internet connection**.
  * Set a maximum wait time (e.g., `90` seconds). If the connection isn't established within this time, The service will proceed anyway to avoid hanging forever.
* **Via UCI**:
  ```bash
  uci set justclash.settings.wait_for_wan='1'
  uci set justclash.settings.wait_for_wan_max='90'
  uci commit justclash
  ```

---

## 2. Delayed Boot (For Minor WAN Glitches and Slow CPUs)

Even if the router reports the WAN connection as "up", there can be a brief window where traffic isn't actually routing correctly, or OpenWrt's native firewall and network scripts are still settling. You can force JustClash to simply wait a fixed number of seconds after boot before doing anything. 

This provides a reliable buffer that helps bypass minor network instability at startup, prevents CPU spikes on slower routers, and avoids race conditions in complex setups.

* **Via LuCI**: Go to *Services -> JustClash -> Startup Tab*.
  * Enable **Delay startup after boot**.
  * Enter a **Startup delay** in seconds (e.g., `10` to `20` seconds).
* **Via UCI**:
  ```bash
  uci set justclash.settings.delayed_boot='1'
  uci set justclash.settings.delayed_boot_value='15'
  uci commit justclash
  ```

---

## 3. Time Synchronization (NTP)

Routers often do not have hardware clocks (RTC) and boot with the year set to 1970 until time is synced. While Mihomo (the core engine) has its own built-in NTP client to validate TLS certificates independently, JustClash forces a synchronous system-wide NTP update (`ntpd -q`) before starting the core.

This guarantees that your router's overall system time is correct for logs and firewall rules right from the start. However, because this command runs **synchronously**, it will block the startup process until the time is successfully resolved.

If your network is slow to connect or you want to shave a few seconds off your boot time, you can disable this forced sync.

* **Via LuCI**: Go to *Services -> JustClash -> Startup Tab* and disable the NTP synchronization option.
* **Via UCI**:
  ```bash
  uci set justclash.settings.ntpd_start='0'
  uci commit justclash
  ```

## 4. Skip Environment Checks (For Fast Boot)

By default, The service performs several non-critical safety checks and compatibility fixes before starting:
* **Conflict Warnings**: Scans `/etc/config/dhcp` for conflicting leftover DNS patterns from other services, checks `/etc/resolv.conf` for hardcoded external DNS servers, and warns about conflicting installed packages.
* **Compatibility Fixes**: Adjusts `sysctl` parameters (e.g., disabling `bridge-nf-call-iptables`) to prevent iptables bridging issues.

If your configuration is stable and you want the absolute fastest startup time possible, you can disable these checks. **Warning:** This will skip fixing `sysctl` parameters and hide configuration warnings, which may make debugging difficult if network issues occur.

* **Via LuCI**: Go to *Services -> JustClash -> Startup Tab* and enable **Skip startup checks**.
* **Via UCI**:
  ```bash
  uci set justclash.settings.skip_environment_checks='1'
  uci commit justclash
  ```
