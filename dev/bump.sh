#!/bin/bash
# Kept for habit: the cache tag is now a hash of the built files, so "bumping" is just building (see dev/build.sh).
exec "$(dirname "$0")/build.sh"
