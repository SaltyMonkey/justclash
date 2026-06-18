# Routing Architecture and Design Choices ("Why It Works This Way")

When designing a transparent proxy solution for OpenWrt, there are dozens of ways to implement routing, DNS handling, and traffic interception. This document explains the core architectural decisions behind the service and why specific technical paths were chosen.

Understanding these fundamentals will clarify why certain features behave the way they do.

---

## 1. Architecture Philosophy: Full Route vs Partial Route

When building transparent proxies on OpenWrt, there are two dominant architectural approaches: **Partial Route** and **Full Route**. JustClash explicitly uses the **Full Route** architecture.

### The "Partial Route" Approach (e.g., legacy ipset/nftset setups)
In this setup, the proxy engine only intercepts traffic destined for a specific Fake-IP range (e.g., `198.18.x.x`).
1. `dnsmasq` resolves blocked domains to Fake-IPs.
2. The Linux firewall (`nftables`) redirects *only* traffic heading to `198.18.x.x` into the proxy.
3. Everything else (domestic traffic, local network) uses Real IPs and is routed natively by the Linux kernel.

**The Pros:** It saves router CPU and RAM because 90% of your traffic never touches the proxy engine.
**The Cons (Spaghetti Logic):** It is a nightmare to manage traffic that doesn't use DNS (like Telegram connecting via raw IPs). To proxy raw IPs, you must maintain massive lists of IPs (`ipsets`/`nftsets`) directly in the router's firewall. Your routing logic becomes split: domains are managed via Fake-IPs, but raw IPs are managed via firewall rules.

### The JustClash Approach (Full Route)
In JustClash, traffic from your selected network interfaces (e.g., `br-lan` or guest networks) is unconditionally intercepted by the firewall (via TProxy) and handed over to the Mihomo engine.

**The Pros (Centralized Policy Engine):**
Mihomo becomes the single source of truth for your network.
* **Unified Routing:** Whether an application connects via a domain name or a direct hardcoded IP, Mihomo evaluates it all in one place using `DOMAIN` and `IP-CIDR` rules. No more maintaining massive `ipsets` in the Linux kernel.
* **Perfect Observability:** The Mihomo dashboard sees and logs every single connection from your selected networks.
* **Predictability:** Rules are evaluated top-to-bottom. If you want to bypass a domain, you add it to `Direct Rules`. If you want to block it, you add it to `Block Rules`. Everything happens in one place.

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
* **Memory Efficiency:** GeoData files (`geosite.dat`, `geoip.dat`) are massive, monolithic databases containing the entire world's IP and domain mappings. Loading them can consume a significant amount of RAM, which can cause Out-Of-Memory crashes on many older OpenWrt routers with 128MB or 256MB of memory.
* **Modularity:** RuleSets are atomic. You only load exactly what you need (e.g., just the rules for your specific proxy provider or a specific ad-block list).

**Why offer Geodata Mode?**
* **Industry Standard Compatibility:** Much of the existing routing ecosystem and community guides rely on `geosite` and `geoip` tags. For users with sufficient RAM (512MB+), enabling Geodata mode simplifies configuration as it removes the need to manually manage multiple RuleSet URLs.
