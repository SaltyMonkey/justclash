# JustClash Quick Start & Easy Setup Guide

Welcome to JustClash! This guide covers the basic configuration steps via the LuCI web interface to get your transparent routing engine up and running correctly.

> [!IMPORTANT]
> **Saving Changes in LuCI**:
> 1. When editing grid items (such as Proxies, Providers, or Groups), clicking **Save** inside the pop-up modal only saves that row to the temporary local page state.
> 2. Clicking **Save** at the bottom of the main page writes the changes to the LuCI staging cache (adding them to the queue of unsaved changes in `/tmp/.uci`). They are not yet written to flash, and the daemon is not restarted.
> 3. To commit your changes to the persistent configuration database on flash (`/etc/config/`) and apply them to the running service, you must click **Save & Apply** at the bottom of the page (or apply them from the "Unsaved Changes" menu).

---

## 0. Installation

You can install JustClash on your OpenWrt router using one of the following methods:

### Option A: Online Installer (Recommended)
Run the following script via SSH to automatically resolve dependencies, download packages, and install JustClash:
```bash
sh <(wget -O - https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh)
```
*For automated, non-interactive installation (skips menus and translation downloads), append `--automated`:*
```bash
sh <(wget -O - https://raw.githubusercontent.com/saltymonkey/justclash/refs/heads/main/service.sh) --automated
```

### Option B: Manual Prebuilt Installation
1. Download the package files (`justclash` and `luci-app-justclash`) from the GitHub Releases page.
2. Upload the files to your router's `/tmp/` directory (e.g., using SCP/SFTP).
3. Run the installation command depending on your OpenWrt version:
   * **OpenWrt 25 (APK-based):**
     ```bash
     apk add --allow-untrusted /tmp/justclash-*.apk /tmp/luci-app-justclash-*.apk
     ```
   * **OpenWrt 24 (OPKG-based):**
     ```bash
     opkg install /tmp/justclash-*.ipk /tmp/luci-app-justclash-*.ipk
     ```
4. **Install the Mihomo Core**:
   * *If the router has internet access:* You can fetch the core automatically by clicking the **Update Core** button on the **Status** page in LuCI, or by running `justclash.sh core_update` in the console.
   * *If the router is offline:* Manually download the `mihomo` binary for your CPU architecture, upload it to `/usr/bin/mihomo` on the router, and make it executable:
     ```bash
     chmod +x /usr/bin/mihomo
     ```


---

## 1. Understanding the LuCI Interface Structure

Unlike generic alternative routing dashboard apps, JustClash separates configuration settings from real-time diagnostics. Understanding where to go is essential:

### Configuration Views (Where settings are edited and saved)
* **[Service](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/service.js)**: Main service settings. The **Traffic rules** tab handles transparent redirection, exclusions (by MAC, IP, or Port), and protocols like QUIC, DoT, DoH, and NTP.
* **[Proxy](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/proxy.js)**: Global core settings (API TLS, mixed port, log level). The **DNS settings** tab allows customizing DNS upstreams and managing Fake-IP settings.
* **[RuleSets](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/rulesets.js)**: Predefined and user-defined rule files (in `.mrs` format). You define lists here (e.g., ads, search engines) so they can be associated with routing categories.
* **[Routing](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/routing.js)**: **The single control panel for outbound routing configuration**. All outbounds (individual nodes, subscriptions), proxy groups (load-balancing, speed test groups), direct rules, block rules, and the default fallback rule are managed here.

### Real-Time Diagnostic Views (No settings are saved here)
* **[Nodes](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/nodes.js)**: Real-time latency checking, provider updating, and switching the active outbound node for manual `select` groups.
* **[Rules](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/rules.js)**: Live view of the routing rules matching engine currently active in the core.
* **[Connections](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/connections.js)**: Monitor active network connections, source IPs, destinations, speeds, and rules matched.
* **[Realtime logs](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/realtime_logs.js)**: Live log streaming from the Mihomo core routing process (shows connections, rule matching, and core activity).
* **[System logs](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/system_logs.js)**: Wrapper script logs from the router's system log daemon (`syslog`/`logread`), showing service start/stop, DNS hijacking, and firewall settings.

---

## 2. Step-by-Step Configuration Flow

Follow these steps to configure your outbound routing:

### Step 1: Add your Outbound Connections or Proxy Providers
All outbound connection endpoints must be added on the **[Routing](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/routing.js)** page.
* **Option A: Adding a Subscription (Proxy Provider)**
  1. Under **Proxy provider**, click **Add**.
  2. Enter a **Name** (e.g., `my_subscription`) and your HTTP/HTTPS **Subscription URL**.
  3. Customize the **Update interval** and **Health check** options as needed.
  4. Click **Save** in the modal.
* **Option B: Adding a Single Node (Proxy List)**
  1. Under **Proxies list**, click **Add**.
  2. Enter a **Name** (e.g., `my_node`).
  3. Select **Mode** (`uri` or `object`). Paste the node's connection URI or JSON configuration object.
  4. Click **Save** in the modal.
  * **Tip (MultiWAN / Direct Outbounds)**: If you have multiple WAN interfaces and want to load-balance or failover direct (non-tunneled) traffic, you can define them as direct endpoints by setting **Link** to `direct://` and selecting the corresponding physical interface under **Bind to interface**. (See [MultiWAN Balancing and Failover](10_multiwan_balancing_failover.md) for full instructions).

### Step 2: Set Up Proxy Groups
You must group your nodes in a **Proxy Group** to control how the traffic is routed or balanced.
1. Under **Proxy groups**, click **Add**.
2. Set a **Name** (e.g., `Proxy_Auto`) and choose a **Group type** (e.g., `url-test` for automatic low-latency selection, `select` for manual node switching, or `load-balance`).
3. Under **Providers**, type/select the subscription name you created in Step 1. If you added single nodes, select them under **Proxies**.
4. *(Optional)* Scroll down to the **Lists** or **Manual rules** tabs to bind rulesets (e.g., `google`, `youtube`, `netflix`) or custom domains directly to this group.
5. Click **Save** in the modal.

### Step 3: Configure Direct and Block Rules
Define what traffic should bypass alternative routing or be blocked globally:
* **Direct Rules (Bypasses)**: Under **Direct rules**, check **Enabled**. Select rulesets to bypass (e.g., local/domestic domains/IPs under **Use with rules**) or add manual domain suffixes/CIDRs under the **Manual rules** tab. *(See [Direct Rules Reference](07_direct_rules.md) for more details).*
* **Block Rules (Ad-blocking)**: Under **Block rules**, check **Enabled**. Select ad-blocking lists (like `adblock` or `trackers`) under **Use with rules** to prevent matched requests from connecting. *(See [Block Rules Reference](06_block_rules.md) for more details).*

### Step 4: Configure the Fallback (Default) Rule
Under **Default rule**:
1. Choose the **Send traffic to** action.
2. If you want all un-matched traffic to go through your Proxy Group, select your group name (e.g., `Proxy_Auto`).
3. If you want only matching rules to use alternate routing and the rest to be direct, select `DIRECT`.

### Step 5: Save & Apply to Start the Service
Once everything is configured:
1. Navigate back to **Services -> JustClash -> Status**.
2. Verify the service is enabled (or click **Enable**).
3. Click the **Save & Apply** button at the bottom.
4. You can monitor the startup logs on the **[System logs](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/system_logs.js)** tab or check active latency/node states on the **[Nodes](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/nodes.js)** page.

---

## 3. Exclusions (Bypassing Torrents & Heavy Traffic)

To save router CPU and network bandwidth, heavy traffic (like BitTorrent) or specific devices can bypass alternative routing entirely at the firewall level.

**Default Exclusions:**
* All **Private IP traffic** (Local LAN to LAN traffic, and accessing the router's own IP/LuCI interface) is automatically bypassed.
* The standard BitTorrent port `6881` is bypassed by default.

To configure custom client exclusions:
1. Navigate to **Services -> JustClash -> [Service](../luci-app-justclash/htdocs/luci-static/resources/view/justclash/service.js)** and select the **Traffic rules** tab.
2. Go to the **Client bypassed MAC addresses**, **Client bypassed IP addresses**, or **Client bypassed ports** options.
3. Enter the corresponding parameters of the devices or ports you want to bypass (e.g., smart TV MAC address or torrent port range).
4. Click **Save & Apply**.

> [!NOTE]
> For a detailed guide on how exclusions interact with the firewall, see the [Traffic Exclusions Reference](04_service_traffic_exclusion.md).

---

## 4. DNS Settings & Bypassed Clients (Fake-IP Nuance)

JustClash utilizes Mihomo's internal DNS engine with **Fake-IP** capabilities to resolve hostnames.
* Default DNS settings are already fully optimized and secure (resolving via encrypted DoH/DoT upstreams).
* **Important Nuance:** If you exclude a device from transparent redirection (via its MAC or IP in the Service tab), but it still queries the router for DNS, it will receive **Fake-IP addresses** (e.g., `198.18.x.x`). Since its actual traffic bypasses the alternative routing, the device won't know how to route these fake IPs, breaking its connection.
* **Solution:** Any device bypassed via MAC/IP *must* be configured to use a public DNS resolver (like `8.8.8.8` or `1.1.1.1`) directly. You can configure this manually on the device, or on the router using DHCP options (e.g., DHCP Option 6) for specific MAC addresses.

---

## 5. Further Reading & References

### Core Architecture & Rules Configuration
* [Routing Architecture and Design Choices](00_routing_architecture_and_design.md) - Learn how JustClash's Full Route architecture handles transparent redirection and DNS hijacking.
* [Direct Rules Reference](07_direct_rules.md) - A detailed guide on managing global bypass lists and custom direct domain suffixes.
* [Block Rules Reference](06_block_rules.md) - How block/reject lists and manual ad-blocking rules are processed.
* [Mixed Port Rules Reference](08_mixed_port.md) - Configuring specific exit rules for the Mihomo mixed port.
* [Managing User-Defined RuleSets](05_user_defined_rulesets.md) - How to add, format, and load custom MRS ruleset files via LuCI or CLI.
* [Geodata and GeoIP Configuration](12_geodata_and_geoip.md) - Using `geosite.dat`/`geoip.dat` databases instead of modular rulesets.

### Traffic Redirection & Network Integration
* [Traffic Exclusions Reference](04_service_traffic_exclusion.md) - A comprehensive guide on bypassing LAN clients (MAC/IP), router-originated processes, and configuring custom DNS daemons.
* [Guest Network Redirection](09_use_guest_network.md) - Intercepting and routing client traffic from guest or secondary network interfaces.
* [MultiWAN Balancing and Failover](10_multiwan_balancing_failover.md) - How to configure JustClash to work concurrently with MultiWAN (`mwan3`) gateways.

### CLI, Scripting & Configuration
* [UCI Configuration Structure Reference](01_uci-structure.md) - A complete reference for all UCI settings under `/etc/config/justclash`.
* [CLI Commands Reference](02_cli-commands.md) - Control commands for the `justclash` wrapper utility (starting, stopping, fetching logs, and manual updates).

### Security & Troubleshooting
* [Startup and WAN Issues Troubleshooting](03_startup_and_wan_issues.md) - Troubleshooting delayed boots, time synchronization (NTP) issues, and environmental checks.
* [Securing LuCI and API Access](11_secure_access.md) - Securing the external controller API port, API authorization passwords, and configuring API TLS certificates.
