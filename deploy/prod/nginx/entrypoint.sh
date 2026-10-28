#!/bin/sh
set -eu

mkdir -p \
  /tmp/proxy_temp \
  /tmp/client_temp \
  /tmp/fastcgi_temp \
  /tmp/uwsgi_temp \
  /tmp/scgi_temp

exec nginx -g 'daemon off;'
