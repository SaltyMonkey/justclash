include $(TOPDIR)/rules.mk

PKG_NAME:=justclash
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

PKG_MAINTAINER:=SaltyMonkey <https://github.com/SaltyMonkey>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=net
	CATEGORY:=Network
	TITLE:=$(PKG_NAME)
	DEPENDS:=+nftables +coreutils-base64 +jq +curl +kmod-nft-tproxy
	CONFLICTS:=banip mihomo nextdns sing-box podkop https-dns-proxy luci-app-passwall luci-app-passwall2 dns-failsafe-proxy
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
	$(INSTALL_BIN) ./files/usr/lib/justclash/compat_fixes.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/info.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/logging.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/migration.sh $(1)/usr/lib/justclash/
	$(INSTALL_BIN) ./files/usr/lib/justclash/uri_parsers.sh $(1)/usr/lib/justclash/

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/justclash $(1)/usr/bin/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/justclash $(1)/etc/config/

	$(INSTALL_DIR) $(1)/etc/justclash
	$(INSTALL_CONF) ./files/etc/justclash/default.config $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/rulesets.txt $(1)/etc/justclash/
	$(INSTALL_CONF) ./files/etc/justclash/block.rulesets.txt $(1)/etc/justclash/

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/justclash $(1)/etc/init.d/
endef

define Package/justclash/conffiles
/etc/config/justclash
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	/usr/bin/justclash stop
fi
exit 0
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

$(eval $(call BuildPackage,$(PKG_NAME)))