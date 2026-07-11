#!/usr/bin/env bash

set -Eeuo pipefail

app_root="${1:-}"
release_id="${2:-}"
keep_releases="${3:-5}"

if [[ ! "$app_root" =~ ^/var/www/[A-Za-z0-9._/-]+$ ]]; then
  echo "Invalid application root: $app_root" >&2
  exit 1
fi

if [[ ! "$release_id" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release id: $release_id" >&2
  exit 1
fi

if [[ ! "$keep_releases" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid release retention value: $keep_releases" >&2
  exit 1
fi

releases_dir="$app_root/releases"
release_dir="$releases_dir/$release_id"
next_link="$app_root/.current-$release_id"
current_link="$app_root/current"

if [[ ! -f "$release_dir/index.html" ]]; then
  echo "Release does not contain index.html: $release_dir" >&2
  exit 1
fi

ln -sfn "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"

old_releases="$({
  find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -nr \
    | tail -n "+$((keep_releases + 1))" \
    | cut -d' ' -f2-
} || true)"

while IFS= read -r old_release; do
  [[ -n "$old_release" ]] || continue
  case "$old_release" in
    "$releases_dir"/*) rm -rf -- "$old_release" ;;
    *)
      echo "Refusing to remove path outside releases: $old_release" >&2
      exit 1
      ;;
  esac
done <<< "$old_releases"

echo "Activated release $release_id"

