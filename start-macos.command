#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 start_local.py
else
  echo 'Python 3 was not found. Open SunbreakForge.html directly in your browser.'
fi
printf '\nPress Enter to close. '
read -r answer
