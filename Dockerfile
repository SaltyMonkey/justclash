FROM openwrt/sdk:x86-64-24.10.1

WORKDIR /builder

COPY ./justclash package/feeds/utilites/justclash
COPY ./luci-app-justclash package/feeds/luci/luci-app-justclash

RUN ./scripts/feeds update -a && \
    ./scripts/feeds install luci-base && \
    mkdir -p /builder/package/feeds/utilites/ && \
    mkdir -p /builder/package/feeds/luci/ && \
    make defconfig && \
    make package/justclash/compile V=s -j4 && \
    make package/luci-app-justclash/compile V=s -j4

RUN mkdir -p /output && \
    cp bin/packages/x86_64/utilites/justclash_*.ipk /output/ && \
    cp bin/packages/x86_64/luci/luci-app-justclash_*.ipk /output/