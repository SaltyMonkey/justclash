# Guest Network Configuration with JustClash

This guide describes four different scenarios for integrating a guest network (e.g., interface `br-guest` / firewall zone `guest`) with the JustClash routing engine.

---

## Scenario 1: Guest Network with Interception (Default Interception)

Use this scenario if you want your guest network clients to use the configured outbound gateways and routing rules of JustClash (exactly like the main `br-lan` network).

### Configuration Steps:
1. **Add Interface to Interception List**:
   Add the guest interface name to the network interception list.
   * **Via Console (UCI)**:
     ```bash
     uci add_list justclash.settings.tproxy_input_interfaces='br-guest'
     uci commit justclash
     service justclash restart
     ```
   * **Via LuCI Web Interface**:  
     Navigate to *Settings -> Interceptor Interfaces* and select your guest interface.
2. **Address Resolution**:  
   No resolution modifications are required. Guest network clients will automatically query the router's global resolution instance, which forwards queries to the local routing engine resolver and returns mapped addresses.

---

## Scenario 2: Guest Network without Interception (Direct Outbound)

Use this scenario if you want guest clients to bypass the routing engine completely and connect to the internet directly via your default gateway (WAN).

### Configuration Steps:
1. **Exclude Interface from Interceptor**:  
   Ensure that your guest interface name is **NOT** listed in the `tproxy_input_interfaces` array in `/etc/config/justclash`.
2. **Configure Client Resolution Options (Direct IP Resolution)**:  
   Since JustClash routes resolution queries globally by default, guest devices will receive mapped addresses for managed domains. Because their data packets are not intercepted, they won't be able to connect to these addresses. To solve this, configure the guest client distribution server to distribute public resolver servers directly to guest clients:
   * **Via Console (UCI)**:
     ```bash
     # Replace 'guest' with the client settings section name of your guest interface
     uci add_list dhcp.guest.dhcp_option='6,1.1.1.1,8.8.8.8'
     uci commit dhcp
     /etc/init.d/dnsmasq restart
     /etc/init.d/odhpcd restart
     ```
   * **Via LuCI Web Interface**:  
     Navigate to *Network -> Interfaces -> [Guest Interface] -> DHCP Server -> Advanced Settings -> DHCP-Options* and add:  
     `6,1.1.1.1,8.8.8.8`

---

## Scenario 3: Guest Network with Custom Filtered Resolution (e.g., Content Filtering)

Useful for guest networks or restricted devices where you want web filtering, ad blocking, or malware protection powered by public filtered resolution, while keeping all traffic bypassed.

### Configuration Steps:
1. **Exclude Interface from Interceptor**:  
   Ensure the guest interface is **NOT** included in the `tproxy_input_interfaces` list.
2. **Configure Client Distribution Options**:  
   Configure the client distribution server to distribute filtered resolution IP addresses directly to clients. For example, using family-safe public resolution servers:
   * **Via LuCI Web Interface**:  
     Navigate to *Network -> Interfaces -> [Guest Interface] -> DHCP Server -> Advanced Settings -> DHCP-Options* and add:  
     `6,77.88.8.7,77.88.8.3`
   * **Via Console (UCI)**:
     ```bash
     uci add_list dhcp.guest.dhcp_option='6,77.88.8.7,77.88.8.3'
     uci commit dhcp
     /etc/init.d/dnsmasq restart
     /etc/init.d/odhpcd restart
     ```

> [!NOTE]  
> You can configure **any** public or private resolution servers of your choice (such as popular family-safe public resolvers). The actual parental controls, content filtering, and ad-blocking capabilities depend entirely on the features provided by the external DNS resolver service you choose.

---

## Scenario 4: Guest Network with Encrypted Resolution and User Exclusions

An advanced scenario: you want guests to use encrypted address resolution running locally on your router via a dedicated resolution helper (e.g., listening on port `5053`), while their network traffic goes directly to the internet (bypassing the interceptor), and the resolution queries made by the helper bypass the routing engine.

### Configuration Steps:

1. **Create a Dedicated System User and Group**:
   To prevent conflicts or security overlaps with other processes (which might run as generic low-privilege users), create a dedicated system user and group (e.g., `skipped_skuid` / `skipped_skgid` with UID/GID `65530`) specifically for this resolver:
   ```bash
   grep -q '^skipped_skgid:' /etc/group || echo "skipped_skgid:x:65530:" >> /etc/group
   grep -q '^skipped_skuid:' /etc/passwd || echo "skipped_skuid:x:65530:65530:skipped_skuid:/var:/bin/false" >> /etc/passwd
   ```

2. **Configure the Local Resolution Helper**:
   Install the package on OpenWrt (using your preferred local resolution client, e.g. `https-dns-proxy` or similar):
   ```bash
   opkg update && opkg install https-dns-proxy
   ```
   **Critical Configuration**: By default, local resolver clients are configured to hijack your router's resolution system-wide. They do this by updating local resolver configurations and adding firewall rules to force all client port 53 traffic to themselves. This will conflict with JustClash's routing.
   
   You must disable all default global interception options and automated modifications in the helper's configuration file. 
   
   Ensure that:
   * Automatic local configurations updates are disabled.
   * Forced redirection rules are disabled on all firewall interfaces.
   * No canary domain overrides are active.

   Then, configure a dedicated, non-hijacked instance running on port `5053` under your custom user and group:
   ```ini
   config https-dns-proxy 'config'
       option dnsmasq_config_update '0'
       option force_dns '0'
       option canary_domains_icloud '0'
       option canary_domains_mozilla '0'

   config https-dns-proxy
       option listen_addr '127.0.0.1'
       option listen_port '5053'
       option resolver_url 'https://1.1.1.1/dns-query'
       option user 'skipped_skuid'      # Execute daemon under this custom user
       option group 'skipped_skgid'    # Execute daemon under this custom group
   ```
   Restart the helper service to apply the configuration.

3. **Exclude the Custom User from Interception**:
   Since the resolver helper connects to the internet to resolve queries, its outgoing traffic could be intercepted by the routing engine. To prevent this, add your custom system user `skipped_skuid` to the exclusions list:
   * **Via Console (UCI)**:
     ```bash
     uci add_list justclash.settings.nft_skuid_exclude_router='skipped_skuid'
     uci commit justclash
     service justclash restart
     ```
   * **Via LuCI Web Interface**:  
     Navigate to *Settings -> Exclude Router Users (UID)* and enter the user name: `skipped_skuid`.

4. **Redirect Guest Queries to Port 5053**:
   To prevent guest devices from hitting the router's default resolution port 53 (where global interception runs), configure a port redirection rule from the guest zone to the local port `5053`.
   
   Add the following block to `/etc/config/firewall`:
   ```ini
   config redirect
       option name 'Redirect Guest Address Queries'
       option src 'guest'
       option proto 'tcp udp'
       option src_dport '53'
       option dest_port '5053'
       option target 'DNAT'
       option dest_ip '127.0.0.1'
   ```
   Apply the firewall configuration changes:
   ```bash
   /etc/init.d/firewall restart
   ```
   *(With this setup, all address resolution queries from guest devices are encrypted and resolved via the local helper service, bypassing the interceptor, while all guest network data packets route directly to WAN).*
