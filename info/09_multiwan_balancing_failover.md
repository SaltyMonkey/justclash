# Multi-WAN and Failover Integration Guide

This guide describes how to configure The service natively to support multiple WAN interfaces, load balancing, and failover without running any external daemons (like `mwan3`).

---

## 1. Why Native Multi-WAN in the service is Superior

In standard OpenWrt environments, routing traffic across multiple physical interfaces (e.g., WAN1 and WAN2) requires kernel-level policy routing via `mwan3`. 

With JustClash, **an external Multi-WAN daemon is not necessary.** 

Mihomo (the core routing engine) supports user-space multi-WAN management. By intercepting traffic and handling it internally, JustClash can perform interface binding, active-standby failover, and load balancing natively. This avoids routing conflicts, complex iptables/nftables rules, and the processing overhead of system-level policy routing.

---

## 2. Configuring Native Multi-WAN in the service

To handle multiple WANs, you define outbound endpoints (either **direct WAN** or **secure tunnel** outbounds) bound to specific physical interfaces, and then group them in a load-balancing or failover outbound group.

### Step 1: Define Interface-Bound Endpoints

You must configure separate endpoints for each WAN interface.

#### Scenario A: Direct WAN Outbounds (Bypassing Tunnels)
If you want to load-balance or failover standard direct (non-tunneled) traffic between your WAN interfaces, define them as `direct` endpoints using the `direct://` URI scheme:

* **Via LuCI Web Interface**:
  Navigate to *Services -> JustClash -> Outbounds Tab*.
  * Add a new `direct` proxy for each WAN (e.g., `wan1_direct`, `wan2_direct`).
  * In the **Interface name** field for each proxy, select the corresponding physical interface (`wan`, `wan2`).

* **Via Console (UCI)**:
  ```bash
  # Define Direct Outbound on WAN1
  uci set justclash.wan1_direct=proxies
  uci set justclash.wan1_direct.enabled='1'
  uci set justclash.wan1_direct.name='wan1_direct'
  uci set justclash.wan1_direct.proxy_link_uri='direct://'
  uci set justclash.wan1_direct.interface_name='wan'

  # Define Direct Outbound on WAN2
  uci set justclash.wan2_direct=proxies
  uci set justclash.wan2_direct.enabled='1'
  uci set justclash.wan2_direct.name='wan2_direct'
  uci set justclash.wan2_direct.proxy_link_uri='direct://'
  uci set justclash.wan2_direct.interface_name='wan2'

  uci commit justclash
  ```

#### Scenario B: Secure Tunnel Outbounds (Encrypted Endpoints)
If you have a remote secure tunnel (e.g. custom transport protocols) and want to bind it to a specific WAN interface, set the interface name directly on the outbound configuration:

* **Via Console (UCI)**:
  ```bash
  # Configure endpoint 'my_endpoint' to connect exclusively via WAN2
  uci set justclash.my_endpoint.interface_name='wan2'
  uci commit justclash
  ```

---

### Step 2: Configure Load-Balancing or Failover Groups

Once your interface-bound outbounds are defined, group them in a `proxy_group` (outbound group) to specify the routing behavior.

#### Mode A: Load Balancing (`load-balance`)
Distributes connections across multiple active WAN interfaces.

* **Via Console (UCI)**:
  ```bash
  uci set justclash.balancer=proxy_group
  uci set justclash.balancer.enabled='1'
  uci set justclash.balancer.name='WAN_LoadBalancer'
  uci set justclash.balancer.group_type='load-balance'
  uci set justclash.balancer.strategy='consistent-hashing'
  uci add_list justclash.balancer.proxies='wan1_direct'
  uci add_list justclash.balancer.proxies='wan2_direct'
  uci commit justclash
  ```

#### Mode B: Active-Standby Failover (`fallback` or `url-test`)
Automatically switches to the backup interface if the primary WAN interface goes down or experiences high latency.

* **Via Console (UCI)**:
  ```bash
  uci set justclash.failover=proxy_group
  uci set justclash.failover.enabled='1'
  uci set justclash.failover.name='WAN_Failover'
  # 'fallback' switches based on priority; 'url-test' switches to the lowest latency
  uci set justclash.failover.group_type='fallback'
  uci set justclash.failover.health_check='1'
  uci set justclash.failover.health_check_url='http://www.gstatic.com/generate_204'
  uci set justclash.failover.health_check_interval='300'
  uci add_list justclash.failover.proxies='wan1_direct'
  uci add_list justclash.failover.proxies='wan2_direct'
  uci commit justclash
  ```

---

### Step 3: Multiplexing a Single Remote Endpoint (`endpoint_name/wanX`)

If you have a single remote server connection (e.g., `my_server`) and want to load balance or failover its traffic across multiple physical WAN interfaces, duplicate the outbound configuration block in the service and bind each instance to a different physical interface.

Using the `endpoint_name/wanX` naming format keeps this configuration clear:

1. **Configure the Endpoint Instances**:
   * **Via LuCI Web Interface**: In the *Outbounds Tab*, create two copies of your proxy endpoint. Name them `my_server/wan` and `my_server/wan2`, and bind their **Interface name** to `wan` and `wan2` respectively.
   * **Via Console (UCI)**:
     * **Instance 1 (`my_server/wan`)**:
       ```bash
       uci set justclash.endpoint_wan1=proxies
       uci set justclash.endpoint_wan1.enabled='1'
       uci set justclash.endpoint_wan1.name='my_server/wan'
       uci set justclash.endpoint_wan1.proxy_link_uri='tunnel://...'
       uci set justclash.endpoint_wan1.interface_name='wan'
       ```
     * **Instance 2 (`my_server/wan2`)**:
       ```bash
       uci set justclash.endpoint_wan2=proxies
       uci set justclash.endpoint_wan2.enabled='1'
       uci set justclash.endpoint_wan2.name='my_server/wan2'
       uci set justclash.endpoint_wan2.proxy_link_uri='tunnel://...'
       uci set justclash.endpoint_wan2.interface_name='wan2'
       ```

2. **Group them for Load Balancing or Failover**:
   * **Via LuCI Web Interface**: In the *Proxy Groups Tab*, create a new `fallback` or `load-balance` group and add both instances to it.
   * **Via Console (UCI)**:
     ```bash
     uci set justclash.group_wan=proxy_group
     uci set justclash.group_wan.enabled='1'
     uci set justclash.group_wan.name='Endpoint_MultiWAN'
     uci set justclash.group_wan.group_type='fallback'
     uci add_list justclash.group_wan.proxies='my_server/wan'
     uci add_list justclash.group_wan.proxies='my_server/wan2'
     uci commit justclash
     ```

---

## 3. Loop Prevention (Safety Mechanism)

To prevent traffic that was sent by the core engine to the physical WAN from looping back into the transparent interception rules, JustClash implements a built-in firewall bypass:

* **Core Engine Traffic (Firewall Mark Bypass)**:
  Mihomo is configured to automatically mark all of its own outbound packets with the firewall routing mark `255` (hex `0xff`). The nftables rules check for this mark and immediately allow it to bypass interception:
  ```nginx
  add rule inet justclash output mark 255 return
  ```
  This ensures that the core engine's own outgoing connections directly route to the WAN instead of looping back.

* **Helper Services (System User UID Exclusions)**:
  For other services running on the router (like DoH clients or other tunnel clients) that must connect directly to the WAN, you can run them under a dedicated system user and list that user name in the `nft_skuid_exclude_router` setting. The service generates an nftables rule to bypass interception for any packets generated by that user:
  ```nginx
  add rule inet justclash output meta skuid <user_id> return
  ```

