# Routing Architecture and Design Choices ("Why It Works This Way")

When designing a transparent proxy solution for OpenWrt, there are dozens of ways to implement routing, DNS handling, and traffic interception. This document explains the core architectural decisions behind the service and why specific technical paths were chosen.

Understanding these fundamentals will clarify why certain features behave the way they do.

---

## 1. Architecture Philosophy: Full Route vs Partial Route

JustClash supports both **Full Route** (intercept all traffic) and **Partial Route** (intercept only matched lists/Fake-IP ranges) architectures on OpenWrt 25.x or newer, giving users the freedom to choose based on their hardware specs and routing preferences.

> [!IMPORTANT]
> Compatibility and correct operation are strictly guaranteed only on OpenWrt 25.x or newer. The older OpenWrt 24.x branch is no longer tested or supported.

### The "Partial Route" Approach (e.g., ipset/nftset setups)
In this setup, the proxy engine only intercepts traffic destined for a specific Fake-IP range (e.g., `198.18.x.x`).
1. `dnsmasq` resolves blocked domains to Fake-IPs.
2. The Linux firewall (`nftables`) redirects *only* traffic heading to `198.18.x.x` into the proxy.
3. Everything else (domestic traffic, local network) uses Real IPs and is routed natively by the Linux kernel.

*   **Pros:** Saves massive amounts of router CPU and RAM because only matched/intercepted traffic goes through the proxy process.
*   **Cons:** Non-DNS connections (raw IP connections) must be intercepted using IP lists (`nftables` sets) manually loaded into the firewall.

#### JustClash's Dynamic Partial Routing Implementation:
To solve the issue of loading raw IP lists without CPU bottlenecking, JustClash implements an **event-driven ruleset synchronizer**:
1. When the firewall starts, it creates empty `nftables` sets (e.g., `ruleset_custom_ipcidr`) and starts a background worker.
2. The worker uses `inotifywait` to monitor changes in the ruleset cache folder (supporting both RAM storage and persistent Flash storage with automatic symlink resolution).
3. Once Mihomo starts and downloads/writes a list (e.g. `custom-ipcidr.list`), the worker is instantly notified.
4. The worker streams the entries into the active `nftables` set in under 1ms via a fast `awk` -> `nft -f` stream.
5. Any subsequent background list updates downloaded by Mihomo are dynamically updated in the firewall in real time without service restarts.

> [!WARNING]
> **Crucial Nuance: The Behavior of 'Final Rule' (MATCH) under Partial Routing**
> * In **Full Routing** mode, 100% of traffic is sent to Mihomo, so setting the default `final_rule` (fallback MATCH) to `Proxy` will route all unmatched traffic through the proxy.
> * In **Partial Routing** mode, only intercepted traffic (Fake-IP domains and enabled IP-CIDR rulesets) reaches Mihomo. Any traffic that is **not** explicitly matched by the firewall rules (such as connections to raw IPs not in rulesets, or domains excluded via `fake-ip-filter`) will bypass Mihomo and go DIRECT at the kernel level.
> * Consequently, in Partial Routing, setting the `final_rule` to `Proxy` **will not proxy all unmatched traffic** (since the traffic never reaches Mihomo to begin with). If you need a fallback policy where all unmatched traffic goes to a proxy, you **must** use Full Routing mode.

> [!WARNING]
> **Crucial Nuance: GEOIP Rules are Ineffective for Raw IP Traffic under Partial Routing**
> * Because **Partial Routing** relies on the firewall to intercept traffic based on predefined lists, any direct connection established by applications using raw IP addresses (bypassing DNS) will **bypass Mihomo completely** if those IPs are not pre-declared in your active `ipcidr` rulesets.
> * Consequently, rules like `GEOIP,CN,DIRECT` or `GEOIP,RU,DIRECT` **cannot evaluate raw IP connections** in Partial Routing mode. They will only work for domain names resolved via the router's DNS (which return Fake-IPs).
> * Additionally, there is **no efficient or lightweight way to unpack binary GeoIP databases (like geoip.dat) in real-time** to populate `nftables` firewall sets on the fly. Doing so would also defeat the resource-saving purpose of Partial Routing due to the massive size of global IP databases. If you rely on absolute, bulletproof GEOIP-based routing (e.g., routing all Chinese or Russian IP subnets regardless of connection type), you **must** use Full Routing.

### The "Full Route" Approach
In Full Route mode, traffic from your selected network interfaces (e.g., `br-lan` or guest networks) is unconditionally intercepted by the firewall (via TProxy) and handed over to the Mihomo engine.

*   **Pros (Centralized Policy Engine):**
Mihomo becomes the single source of truth for your network.
* **Unified Routing:** Whether an application connects via a domain name or a direct hardcoded IP, Mihomo evaluates it all in one place using `DOMAIN` and `IP-CIDR` rules. No more maintaining massive `ipsets` in the Linux kernel.
* **Perfect Observability:** The Mihomo dashboard sees and logs every single connection from your selected networks.
* **Predictability:** Rules are evaluated top-to-bottom. If you want to bypass a domain, you configure its route to go through `DIRECT` in the Routing tab. If you want to block it, you add it to `Block Rules`. Everything happens in a single, unified configuration flow.

**The Trade-off:**
Routing network traffic through a userspace proxy engine inherently consumes more CPU/RAM than native kernel routing. To mitigate this, JustClash provides **Traffic Exclusions** to bypass heavy P2P/torrent ports or specific client devices (by MAC/IP address) at the firewall level, keeping them in the kernel and saving CPU.

---

## 2. Full DNS Replacement in Dnsmasq

**The Decision:** The service hijacks OpenWrt's native `dnsmasq` to forward 100% of DNS queries from selected networks into the Mihomo core.

**Why?**
* **Fake-IP Necessity:** For Fake-IP to work, the core *must* be the sole authority answering DNS queries. If `dnsmasq` resolved domains on its own, it would hand out real, poisoned IPs, breaking the transparent proxy flow.
* **Advanced Encrypted Upstreams:** Mihomo features a highly advanced, comprehensive DNS engine that natively supports modern encrypted protocols (DoH, DoT, DoQ). By taking over DNS, the core ensures all upstream resolutions are securely encrypted, preventing ISP eavesdropping and local DNS poisoning.
* **Global Sinkholing:** By controlling DNS globally, the core can apply its `nameserver-policy` and return `rcode://success` for blocked ads and trackers (acting as a DNS sinkhole) for every device on the network automatically.
* **Local Network Resolution:** The core is configured to still query `dnsmasq` for local `.lan` hostnames, ensuring your local network devices remain reachable by name.

---

## 3. TProxy instead of TUN

**The Decision:** Traffic interception is achieved using Linux **TProxy** (Transparent Proxy) via `nftables`/`iptables` rather than a virtual `TUN` interface.

**Why?**
* **Performance and Overhead:** TProxy works natively at the socket layer within the Linux kernel networking stack. It scales better and introduces significantly less CPU overhead on low-powered routers compared to encapsulating packets into a virtual TUN interface.
* **Original Metadata:** TProxy perfectly preserves the original source IP, destination IP, and port.
* **Clean Routing Tables:** TUN interfaces require complex manipulation of the main Linux routing table and often necessitate MSS clamping to prevent packet fragmentation. TProxy integrates smoothly with OpenWrt's native firewall without altering standard routes.

---

## 4. RuleSets as Default vs Geodata Mode

**The Decision:** The service uses Mihomo RuleSets (`.mrs` format) by default, while offering a toggleable **Geodata Mode** for users who prefer unified `.dat` databases.

**Why RuleSets by Default?**
* **Modularity:** RuleSets are atomic. You only load exactly what you need (e.g., just the rules for your specific proxy provider or a specific ad-block list).
* **Firewall Integration:** For Partial Interception, the system can parse plain text IP list files to populate firewall `nftables` sets. This is not possible with binary Geodata databases.

**Why offer Geodata Mode?**
* **Industry Standard Compatibility:** Much of the existing routing ecosystem and community guides rely on `geosite` and `geoip` tags. For users with sufficient RAM, enabling Geodata mode simplifies configuration as it removes the need to manually manage multiple RuleSet URLs.

> [!WARNING]
> **Interception Caveat under Geodata Mode**
> * **GEOIP Rules** in Geodata Mode are fully effective **only in Full Route mode**. Under Partial Route mode, raw IP connections bypass Mihomo completely and cannot be matched against GEOIP rules.
> * **GEOSITE Rules** work reliably in **both Full and Partial Route modes**, because domain queries resolved via DNS return Fake-IPs, forcing their traffic to be intercepted and evaluated by Mihomo's geosite matching engine.
