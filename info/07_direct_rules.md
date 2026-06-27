# Direct Rules (Domain/IP Bypass)

The service allows you to force specific domains, IP addresses, or entire RuleSets to bypass the proxy entirely by routing them directly to your ISP (the `DIRECT` target). 

This is managed via the **Direct Rules** configuration section.

> ⚠️ **IMPORTANT WARNING: NOT RECOMMENDED**
> 
> We strongly recommend **against** using Direct Rules unless absolutely necessary. 
> 
> **Why?** When you add a domain to Direct Rules, it globally overrides your proxy settings for all devices on the network. Fast forward a few months, you might forget you added it here. When you later try to route that domain through a proxy, it will stubbornly refuse to work, and you will spend hours trying to figure out why your proxy group isn't catching it. 
> 
> **Better Alternatives:**
> * If a specific device (like a Smart TV or console) is having issues with the proxy, it is highly recommended to bypass that specific device completely at the firewall level using its MAC address (`nft_mac_exclude`) or IP address (`nft_ips_exclude`) in the main settings. This completely removes the device's traffic from the proxy engine (saving CPU) and avoids domain routing conflicts entirely.

---

## 1. How Direct Rules Work

When enabled, The service generates `RULE-SET`, `DOMAIN-SUFFIX`, and `IP-CIDR` rules targeting the `DIRECT` action. These rules are placed very high up in the routing table, ensuring they trigger before any of your standard proxy groups or default fallback routes.



## 2. Configuration

If you still need to use Direct Rules, you can configure them via the web interface or the console.

### Via LuCI Web Interface
Navigate to *Services -> JustClash -> Routing Tab -> Direct Rules*. 
* Enable the section.

* Select built-in or user-defined RuleSets from the dropdown menu (if really needed).
* Add specific domains or IPs to the **Additional Domains** and **Additional Destination IPs** lists.
* Add specific device IPs to the **Additional Source IPs** list if you want to bypass the proxy for a whole device but still have Mihomo evaluate its traffic (for a complete bypass that saves router CPU, use the main settings **Client bypassed MAC/IP addresses** instead).

### Via Console (UCI)
```bash
# 1. Enable the direct rules section and configure Fake-IP behavior
uci set justclash.direct_rules=direct_rules
uci set justclash.direct_rules.enabled='1'


# 2. Add RuleSets from the catalog (using their identifiers)
uci add_list justclash.direct_rules.enabled_list='ru-hosts'
uci add_list justclash.direct_rules.enabled_list='category-gov-ru'

# 3. Add manual domain and IP overrides
uci add_list justclash.direct_rules.additional_domain_direct='gov.example.com'
uci add_list justclash.direct_rules.additional_destip_direct='198.51.100.200/32'

# 4. Bypass proxy for a specific device by its Source IP (if you want Mihomo processing,
# otherwise use main settings 'nft_ips_exclude' / 'nft_mac_exclude' for a firewall-level bypass)
uci add_list justclash.direct_rules.additional_srcip_direct='192.168.1.50/32'

uci commit justclash
service justclash restart
```

## 3. Summary

While powerful, **Direct Rules** are a common source of self-inflicted routing headaches. Use them sparingly, document what you bypassed, and always prefer firewall-level host-based exclusions (MAC or IP) in the main settings when trying to completely bypass a problematic device.
