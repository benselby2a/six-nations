#!/bin/bash
# Bump the ?v= cache-busting tag on app.js and styles.css in index.html (run after changing either).
cd "$(dirname "$0")/.."
cur=$(grep -o 'app.js?v=[0-9-]*' index.html | head -1 | sed 's/.*v=//')
base=${cur%-*}; n=${cur##*-}
sed -i "s/${cur}/${base}-$((n+1))/g" index.html
echo "cache tag: ${base}-$((n+1))"
