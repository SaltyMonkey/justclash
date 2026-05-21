include $(TOPDIR)/rules.mk

PKG_NAME:=justclash
PKG_VERSION:=0.15.0
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

PKG_MAINTAINER:=SaltyMonkey <https://github.com/SaltyMonkey>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=net
	CATEGORY:=Network
	TITLE:=$(PKG_NAME)
	DEPENDS:=+nftables +coreutils-base64 +jq-full +curl +kmod-nft-tproxy +kmod-nf-tproxy
	CONFLICTS:=banip mihomo podkop sing-box luci-app-passwall luci-app-passwall2 dns-failsafe-proxy
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
	$(INSTALL_BIN) ./files/usr/lib/justclash/helpers.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/compat.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/logging.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/uri.sh $(1)/usr/lib/justclash/

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
	$(INSTALL_BIN) ./files/etc/uci-defaults/99_jс-uci-migration $(1)/etc/uci-defaults/

	sed -i -e 's|__COMPILED_VERSION_VARIABLE__|$(PKG_VERSION)|g' $(1)/usr/bin/justclash.sh

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
	[ -f "/tmp/justclash" ] && rm -rf "/tmp/justclash"
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
		if [ -n "$${RANDOM_API_PASSWORD}" ]; then
			uci set justclash.proxy.api_password="$${RANDOM_API_PASSWORD}"
			uci commit justclash
			sed -i -e "s|$${DEFAULT_API_PASSWORD}|$${RANDOM_API_PASSWORD}|g" /etc/justclash/default.config || true
		fi
	fi
	# randomize failover mac string if placeholder value detected
	RANDOM_MAC_REPLACEMENT="$$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' | cut -c1-30)"
	[ -n "$${RANDOM_MAC_REPLACEMENT}" ] && sed -i -e "s|__COMPILED_DEFAULT_MAC_VARIABLE__|$${RANDOM_MAC_REPLACEMENT}|g" /usr/lib/justclash/helpers.sh || true
fi
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
