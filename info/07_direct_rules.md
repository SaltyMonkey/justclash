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
> * If a specific device (like a Smart TV or console) is having issues with the proxy, it is much safer to bypass that specific device using its IP address. You can add the device's IP to the **Source IP** list in the Direct Rules section. This will route all traffic from that specific device directly, without breaking domain routing for the rest of your network.

---

## 1. How Direct Rules Work

When enabled, The service generates `RULE-SET`, `DOMAIN-SUFFIX`, and `IP-CIDR` rules targeting the `DIRECT` action. These rules are placed very high up in the routing table, ensuring they trigger before any of your standard proxy groups or default fallback routes.

Additionally, just like with Block Rules, any domain-based rules here are automatically excluded from the Fake-IP mechanism so they resolve using the router's real DNS.

## 2. Configuration

If you still need to use Direct Rules, you can configure them via the web interface or the console.

### Via LuCI Web Interface
Navigate to *Services -> JustClash -> Routing Tab -> Direct Rules*. 
* Enable the section.
* Select built-in or user-defined RuleSets from the dropdown menu (if really needed).
* Add specific domains or IPs to the **Additional Domains** and **Additional Destination IPs** lists.
* **(Recommended)** Add specific device IPs to the **Additional Source IPs** list to bypass the proxy for a whole device.

### Via Console (UCI)
```bash
# 1. Enable the direct rules section
uci set justclash.direct_rules=direct_rules
uci set justclash.direct_rules.enabled='1'

# 2. Add RuleSets from the catalog (using their identifiers)
uci add_list justclash.direct_rules.enabled_list='ru-hosts'
uci add_list justclash.direct_rules.enabled_list='category-gov-ru'

# 3. Add manual domain and IP overrides
uci add_list justclash.direct_rules.additional_domain_direct='gov.example.com'
uci add_list justclash.direct_rules.additional_destip_direct='198.51.100.200/32'

# 4. (Recommended) Bypass proxy for a specific device by its Source IP
uci add_list justclash.direct_rules.additional_srcip_direct='192.168.1.50/32'

uci commit justclash
service justclash restart
```

## 3. Summary

While powerful, **Direct Rules** are a common source of self-inflicted routing headaches. Use them sparingly, document what you bypassed, and always prefer host-based exclusions by Source IP when trying to fix a single problematic device.
