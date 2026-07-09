# Traffic Exclusions Reference

This document explains how to exclude specific network traffic from being intercepted and processed by the JustClash routing engine.

> [!NOTE]
> **Necessity of Exclusions: Full Route vs. Partial Route**
> * **In Full Interception Mode:** Traffic exclusions are **highly recommended** for heavy LAN clients (like game consoles, smart TVs, or local backup servers) and heavy protocols (P2P/BitTorrent ports) to prevent them from being forwarded to the userspace proxy, saving valuable router CPU and RAM.
> * **In Partial Interception Mode:** There is **no huge necessity** to configure manual client or port exclusions. Since the firewall only intercepts traffic matching your active rulesets (like blocked sites or specified IP CIDRs), all other heavy traffic (domestic streaming, torrents, direct IP downloads, and unmatched client devices) naturally and automatically bypasses the proxy at the kernel level, consuming zero proxy resources.

---

## 0. Default Bypassed Traffic (Private IPs)

By design, JustClash automatically bypasses all **Private IP traffic** (Local LAN to LAN traffic). This means any connections between devices on your local network (e.g., from `192.168.1.10` to `192.168.1.20`, or accessing your router's web interface at `192.168.1.1`) are never intercepted by the routing engine.
You only need to configure manual exclusions for traffic destined for the public internet (WAN).

---

## 1. Router Traffic Exclusion

This section covers how to bypass traffic originating from processes running directly on the router itself (e.g., DNS resolvers, SSH, tunnel clients, NTP).

### 1.1 Method A: By fwmark (SO_MARK) [Recommended]
By default, JustClash configures Mihomo to mark all its outbound connections with a specific routing mark (fwmark `255` / `0xFF`). The nftables firewall uses this mark to bypass the transparent redirection and send the traffic directly to the WAN gateway, preventing an infinite routing loop.

You can leverage this exact same mechanism to bypass any local daemon on the router. Simply configure the daemon to set `SO_MARK=255` (or fwmark `255`) on its outbound sockets.
Because the packets originate with the `255` mark, nftables will immediately accept them in the `output` chain and route them outside of JustClash.

*Note on Custom Outbound Marks (routing-mark):*
JustClash also supports configuring custom `fwmark` values on individual Mihomo outbound connections or providers. This allows you to tag the traffic of specific outbounds with custom marks (e.g., `0x800`) so that other router services like `mwan3` or policy-based routing (PBR) can intercept those specific outbound connections and route them to specific WAN interfaces. These custom marks automatically bypass the internal redirection loop just like the default `255` mark.

### 1.2 Method B: By User ID (`skuid`)
If the daemon you want to exclude does not support configuring `SO_MARK` or `fwmark`, you can bypass it based on the system user (UID) running the process. This is configured using the `nft_skuid_exclude_router` option.

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Service* (on the **Traffic rules** tab) -> Exclude Router Users (UID)* and enter the user name: `skipped_skuid`.
* **Via Console (UCI)**:
  ```bash
  uci add_list justclash.settings.nft_skuid_exclude_router='skipped_skuid'
  uci commit justclash
  service justclash restart
  ```

*Note on `skuid` Exclusions:*
In nftables, the `meta skuid` expression extracts the Socket User ID associated with the network packet. Forwarded LAN traffic does not have a local socket owner, so this rule is completely invalid for LAN clients and only works in the router's local `output` chain.

### 1.3 Method C: By Ports
The service allows you to bypass transparent routing for specific ports (both TCP and UDP, matching destination or source ports) originating from the router itself.

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Service* (on the **Traffic rules** tab) -> Router bypassed ports* and add the ports (e.g., `22`, `123`).
* **Via Console (UCI)**:
   ```bash
   uci add_list justclash.settings.nft_ports_exclude_router='22'
   uci commit justclash
   service justclash restart
   ```

---

## 2. LAN Client Traffic Exclusion

This section covers how to bypass traffic originating from specific devices on your local network (LAN) such as phones, TVs, or servers.

### 2.1 By MAC Address
You can bypass transparent routing for specific local devices based on their MAC address. This ensures the device is completely excluded from the redirection hook at Layer 2.

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Service* (on the **Traffic rules** tab) -> Client bypassed MAC addresses*.
* **Via Console (UCI)**:
  ```bash
  uci add_list justclash.settings.nft_mac_exclude='00:11:22:33:44:55'
  uci commit justclash
  ```

### 2.2 By IP Address
You can bypass traffic originating from specified client IP addresses or entire subnets.

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Service* (on the **Traffic rules** tab) -> Client bypassed IP addresses*.
* **Via Console (UCI)**:
  ```bash
  uci add_list justclash.settings.nft_ips_exclude='192.168.1.100'
  uci add_list justclash.settings.nft_ips_exclude='192.168.2.0/24'
  uci commit justclash
  ```

### 2.3 By Ports
Bypass traffic originating from LAN devices connected to the router on specific destination or source ports.

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Service* (on the **Traffic rules** tab) -> Client bypassed ports*.
* **Via Console (UCI)**:
  ```bash
  uci add_list justclash.settings.nft_ports_exclude='22'
  uci commit justclash
  ```

---

## 3. The DNS & Fake-IP Conflict Nuance (Bypass Issues)

When you exclude traffic from transparent redirection (either via **fwmark/User ID** on the router, or **MAC/IP address** on LAN clients), you create a routing bypass. However, if the bypassed entity still resolves hostnames using the router's default DNS server, a critical conflict occurs with **Fake-IP addresses**:

### The Core Problem
1. The firewall is configured to bypass/return the entity's direct traffic (Layer 3).
2. However, the bypassed entity still sends its DNS queries to the router's local resolver (e.g., `dnsmasq` -> Mihomo).
3. If the domain resolved matches any routing rules, Mihomo returns a **Fake-IP** (e.g., `198.18.x.x`).
4. The bypassed entity then tries to connect to `198.18.x.x` directly over the WAN gateway.
5. Since Fake-IPs are non-routable on the public internet, **the connection fails**.

To prevent this, you must ensure that bypassed entities resolve **Real IPs** instead of Fake-IPs.

> [!WARNING]
> **Crucial Warning: Fake-IP Exclusions Break Proxy Routing in Partial Interception Mode**
> * Under **Full Interception** mode, excluding a domain from Fake-IP (using `fake_ip_exclude_domains` / `real-ip` rules) still allows Mihomo to proxy the domain because all traffic to the resolved Real IP is still intercepted by TProxy.
> * Under **Partial Interception** mode, the firewall *only* redirects Fake-IPs and active IP-CIDR lists. If you exclude a domain from Fake-IP, the client receives a **Real IP** which bypasses firewall interception completely.
> * As a result, the connection goes directly via the WAN gateway, and Mihomo never sees it. Therefore, any routing rules configured in Mihomo to proxy that domain (e.g., `DOMAIN-SUFFIX,example.com,Proxy`) will be **completely ignored and bypassed**.
> * Consequently, **do not use Fake-IP exclusions** in Partial Interception mode for any domains that you intend to route through a proxy.

### Solutions for Router-Originated Traffic

#### Solution 1: Configure Real IP Issuance in the Service
Configure JustClash to resolve and return the Real IP instead of a Fake-IP for the specific domains queried by the bypassed processes. This can be achieved by adding the target domains, rulesets, or geosites to the exclusion lists.

##### Configuration Options:
* **`fake_ip_exclude_domains`**: Excludes specific domain suffixes (e.g., `dns.cloudflare.com` or `*.example.com`).
* **`fake_ip_exclude_rulesets`**: Excludes all domains contained within a specific active RULE-SET.
* **`fake_ip_exclude_geosites`**: Excludes all domains contained within a specific active GEOSITE.

* **Via LuCI Web Interface**:
  Go to *Services -> JustClash -> Proxies* and look for the **DNS settings** tab:
  * **Force real IP domains**: Add specific domain suffixes (e.g., `dns.cloudflare.com` or `*.example.com`).
  * **Force real IP rulesets**: Select from your active RULE-SETs (e.g., `(Set) telegram`).
  * **Force real IP geosites**: Select from your active GEOSITEs (e.g., `(Geo) youtube`).

* **Via Console (UCI)**:
  ```bash
  # Exclude Cloudflare DoH domain for an excluded secure DNS daemon
  uci add_list justclash.proxy.fake_ip_exclude_domains='dns.cloudflare.com'
uci add_list justclash.proxy.fake_ip_exclude_rulesets='telegram'
uci commit justclash
service justclash restart
```

##### How it Works Under the Hood:
JustClash translates these entries into the core engine configuration's `fake-ip-filter` array as `real-ip` matching rules, ensuring the DNS engine hands out the true WAN IP:
```yaml
dns:
  enhanced-mode: fake-ip
  fake-ip-filter-mode: rule
  fake-ip-filter:
    - DOMAIN-SUFFIX,dns.cloudflare.com,real-ip
    - RULE-SET,telegram,real-ip
    - MATCH,real-ip
```

#### Solution 2: Bootstrap DNS Bypass
For local daemons (like `https-dns-proxy`), you can configure the daemon to bypass the local `dnsmasq` server entirely by specifying bootstrap DNS IP addresses in the daemon's own configuration. At the same time, ensure the daemon runs under a specific user (so you can add that user to the `skuid` exclusion list):
```ini
# In /etc/config/https-dns-proxy:
config https-dns-proxy
    option procd_user 'https-dns-proxy'
    option bootstrap_dns '8.8.8.8,1.1.1.1'
```
Since the DNS queries are sent directly to public servers on port 53, they bypass the local routing engine via the `skuid` firewall rule (which you would set to `https-dns-proxy`), returning real IP addresses over the WAN.

### Solutions for LAN Client Devices (MAC/IP)

#### Solution 1: Configure Public DNS on the Client Device
Manually configure the network adapter settings on the bypassed client device itself to use a public DNS server (e.g., `1.1.1.1` or `8.8.8.8`).
Since the client's MAC/IP traffic is bypassed in the firewall, its DNS queries to `1.1.1.1` will traverse directly to the WAN gateway, resolving to Real IPs.

#### Solution 2: Assign Custom DNS via DHCP Tagging (OpenWRT dnsmasq)
Configure dnsmasq to distribute public DNS servers (DHCP Option 6) only to these specific bypassed devices based on their MAC address:

1. **Edit `/etc/config/dhcp`** to assign a tag (e.g., `bypass_dns`) to the client's MAC address and specify DNS servers for that tag:
   ```ini
   # Assign tag to a host by its MAC address
   config host
       option name 'bypassed_tv'
       option mac '00:11:22:33:44:55'
       option tag 'bypass_dns'

   # Define DHCP Option 6 (DNS servers) for that tag
   config tag 'bypass_dns'
       list dhcp_option '6,1.1.1.1,8.8.8.8'
   ```
2. **Apply changes** and restart the DHCP daemon:
   ```bash
   uci commit dhcp
   /etc/init.d/dnsmasq restart
   ```

#### Solution 3: Exclude Domains from Fake-IP
If the client only needs to access specific domains, add those domains to the `fake_ip_exclude_domains`, `fake_ip_exclude_rulesets`, or `fake_ip_exclude_geosites` lists under the `proxy` config section (as described in the Router section above).

#### Solution 4: Redirect DNS to a Custom Local Daemon
Instead of issuing a public DNS via DHCP Option 6, you can run a standalone secure DNS daemon (like `https-dns-proxy`) directly on the router on a separate port (e.g., `5053`).

> [!WARNING]
> You cannot simply change the global `dnsmasq` upstream to point to this daemon, as that would **break Fake-IP resolution for the entire network** (Mihomo would never see the queries). Furthermore, DHCP Option 6 does not support specifying ports.

Therefore, you must use a custom firewall rule to seamlessly redirect only the bypassed client's DNS queries to this custom port:

1. **Configure the Daemon (`https-dns-proxy`)** to listen on a custom port and ensure it runs under a specific user:
   ```ini
   config https-dns-proxy
       option listen_addr '192.168.1.1'
       option listen_port '5053'
       option procd_user 'https-dns-proxy'
       option bootstrap_dns '8.8.8.8,1.1.1.1'
   ```
2. **Add the daemon's user (`https-dns-proxy`)** to the router's `skuid` exclusions so it can fetch its upstream DNS over the WAN.
3. **Add a custom nftables NAT rule** (in `/etc/nftables.d/` or `/etc/firewall.user`) to selectively redirect port 53 traffic from the bypassed MAC/IP to the custom port:
   ```nginx
   # Redirect DNS queries from bypassed IP to the custom daemon
   add rule inet nat prerouting ip saddr 192.168.1.100 udp dport 53 redirect to :5053
   add rule inet nat prerouting ip saddr 192.168.1.100 tcp dport 53 redirect to :5053
   ```
This ensures the bypassed client gets Real IPs securely from the custom daemon, while the rest of the network continues to use Fake-IP via Mihomo.
