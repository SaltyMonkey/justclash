#!/bin/bash

PROGNAME="justclash"
ENCODING="UTF-8"
WIDTH=900
SRC_DIR="htdocs/luci-static/resources/view/${PROGNAME}"
OUT_POT="po/templates/${PROGNAME}.pot"
RU_PO="po/ru/${PROGNAME}.po"

make_pot() {
    echo "Analyze all JS files in project"
    mapfile -t FILES < <(find "$SRC_DIR" -type f -name "*.js")
    if [ ${#FILES[@]} -eq 0 ]; then
        echo "No JS files found in $SRC_DIR"
        exit 1
    fi

    mkdir -p "$(dirname "$OUT_POT")"

    echo "Generating POT template from JS files in $SRC_DIR"
    xgettext --language=JavaScript \
            --keyword=_ \
            --from-code="$ENCODING" \
            --output="$OUT_POT" \
            --width="$WIDTH" \
            --no-wrap \
            --package-name="$PROGNAME" \
            "${FILES[@]}"
    echo "POT template generated: $OUT_POT"
}

make_po() {
    local po_path="$1"
    if [ -f "${po_path}" ]; then
        echo "Updating $po_path"
        msgmerge --update --width="$WIDTH" "${po_path}" "$OUT_POT"
    else
        echo "Creating new $po_path using msginit"
        msginit --no-translator --locale="$LANG" --width="$WIDTH" --no-wrap --input="$OUT_POT" --output-file="${po_path}"
    fi
    echo "PO file generated: ${po_path}"
}

echo "Generating POT..."
make_pot

echo "Generating PO files..."
make_po "$RU_PO"
