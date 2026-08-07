include $(TOPDIR)/rules.mk

PKG_NAME:=justclash
PKG_VERSION:=0.90.13_rc3

PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

PKG_MAINTAINER:=SaltyMonkey <https://github.com/SaltyMonkey>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=net
	CATEGORY:=Network
	TITLE:=$(PKG_NAME)
	DEPENDS:=+nftables +coreutils-base64 +jq-full +curl +kmod-nft-tproxy +kmod-nf-tproxy +ca-bundle +zoneinfo-all +inotifywait +libinotifytools
	CONFLICTS:=banip mihomo podkop sing-box sing-box-tiny luci-app-passwall luci-app-passwall2 dns-failsafe-proxy netshift luci-app-netshift nikki luci-app-nikki luci-app-ssclash
	PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
	Transparent proxy solution for OpenWrt based on mihomo clash core.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/lib/justclash
	$(INSTALL_DATA) ./files/usr/lib/justclash/constants.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/helpers.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/config.sh $(1)/usr/lib/justclash/
	$(INSTALL_DIR) $(1)/usr/lib/justclash/config
	$(INSTALL_DATA) ./files/usr/lib/justclash/config/*.sh $(1)/usr/lib/justclash/config/
	$(INSTALL_DIR) $(1)/usr/lib/justclash/helpers
	$(INSTALL_DATA) ./files/usr/lib/justclash/helpers/*.sh $(1)/usr/lib/justclash/helpers/
	$(INSTALL_BIN) ./files/usr/lib/justclash/runtime.sh $(1)/usr/lib/justclash/
	$(INSTALL_DIR) $(1)/usr/lib/justclash/runtime
	$(INSTALL_DATA) ./files/usr/lib/justclash/runtime/*.sh $(1)/usr/lib/justclash/runtime/
	$(INSTALL_BIN) ./files/usr/lib/justclash/yaml.sh $(1)/usr/lib/justclash/
	$(INSTALL_DIR) $(1)/usr/lib/justclash/yaml
	$(INSTALL_DATA) ./files/usr/lib/justclash/yaml/*.sh $(1)/usr/lib/justclash/yaml/
	$(INSTALL_BIN) ./files/usr/lib/justclash/compat.sh $(1)/usr/lib/justclash/
	$(INSTALL_DIR) $(1)/usr/lib/justclash/compat
	$(INSTALL_DATA) ./files/usr/lib/justclash/compat/*.sh $(1)/usr/lib/justclash/compat/
	$(INSTALL_BIN) ./files/usr/lib/justclash/logging.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/user_agents.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/help.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/uri.sh $(1)/usr/lib/justclash/
	$(INSTALL_DIR) $(1)/usr/lib/justclash/uri
	$(INSTALL_DATA) ./files/usr/lib/justclash/uri/*.sh $(1)/usr/lib/justclash/uri/

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/justclash.sh $(1)/usr/bin/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/justclash $(1)/etc/config/

	$(INSTALL_DIR) $(1)/etc/justclash
	$(INSTALL_CONF) ./files/etc/justclash/default.config $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/rulesets.txt $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/block.rulesets.txt $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/user.rulesets.txt $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/user.block.rulesets.txt $(1)/etc/justclash/

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/justclash $(1)/etc/init.d/

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/99_jc-uci-migration $(1)/etc/uci-defaults/

	sed -i -e 's|__COMPILED_VERSION_VARIABLE__|$(PKG_VERSION)|g' $(1)/usr/lib/justclash/constants.sh

endef

define Package/justclash/conffiles
/etc/config/justclash
/etc/justclash/user.rulesets.txt
/etc/justclash/user.block.rulesets.txt
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	#[ -f "/usr/bin/mihomo" ] && rm -rf "/usr/bin/mihomo"
	[ -d "/tmp/justclash" ] && rm -rf "/tmp/justclash"
fi
exit 0
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	# randomize api password only when package default is still in use
	DEFAULT_API_PASSWORD='abcdefghijklmnopqrstuvwxyz1234567890'
	CURRENT_API_PASSWORD="$$(uci -q get justclash.proxy.api_password)"

	if [ "$${CURRENT_API_PASSWORD}" = "$${DEFAULT_API_PASSWORD}" ]; then
		RANDOM_API_PASSWORD="$$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-')"
		if [ -z "$${RANDOM_API_PASSWORD}" ]; then
			RANDOM_API_PASSWORD="$$(head -c 32 /dev/urandom 2>/dev/null | base64 2>/dev/null | tr -d '+/=\r\n' | cut -c1-32)"
		fi
		if [ -n "$${RANDOM_API_PASSWORD}" ]; then
			uci set justclash.proxy.api_password="$${RANDOM_API_PASSWORD}"
			uci commit justclash
		fi
	fi
	if ! . /usr/lib/justclash/config/reset.sh; then
		echo "Failed to load the JustClash config reset module." >&2
		exit 1
	fi
	if ! config_api_password_ensure_file /etc/config/justclash; then
		echo "Failed to initialize the active JustClash API password." >&2
		exit 1
	fi
	# randomize failover mac string if placeholder value detected
	RANDOM_MAC_REPLACEMENT="$$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' | cut -c1-30)"
	if [ -z "$${RANDOM_MAC_REPLACEMENT}" ]; then
		RANDOM_MAC_REPLACEMENT="$$(head -c 30 /dev/urandom 2>/dev/null | base64 2>/dev/null | tr -d '+/=\r\n' | cut -c1-30)"
	fi
	[ -n "$${RANDOM_MAC_REPLACEMENT}" ] && sed -i -e "s|__COMPILED_DEFAULT_MAC_VARIABLE__|$${RANDOM_MAC_REPLACEMENT}|g" /usr/lib/justclash/helpers.sh || true
fi
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
