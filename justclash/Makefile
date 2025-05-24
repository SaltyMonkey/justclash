include $(TOPDIR)/rules.mk

PKG_NAME:=justclash
PKG_VERSION:=0.0.1
PKG_RELEASE:=1

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

PKG_MAINTAINER:=SaltyMonkey <https://github.com/SaltyMonkey>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=Mihomo core wrapper and manager
  DEPENDS:=+nftables +curl +kmod-nft-tproxy
  CONFLICTS:=https-dns-proxy
  PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
  Transparent proxy based on mihomo for OpenWRT
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/justclash $(1)/usr/bin/

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/justclash $(1)/etc/config/justclash

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/justclash $(1)/etc/init.d/
endef

define Package/podkop/conffiles
/etc/config/podkop
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	INITD_PATH="/etc/init.d/justclash"
	${INITD_PATH} disable
	${INITD_PATH} stop
fi
exit 0
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
# check if we are on real system
if [ -z "$${IPKG_INSTROOT}" ]; then
	[ -f "/usr/bin/mihomo" ] && rm -rf "/usr/bin/mihomo"
	[ -f "/tmp/justclash" ] && rm -rf "/tmp/justclash"

fi
exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
