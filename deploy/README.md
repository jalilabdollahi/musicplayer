# Deploying HighFi Player

Target: `91.98.123.217`, served at `https://music.mydailyreport.xyz`.

The container binds to loopback only and host nginx fronts it, matching the
other apps on that box. Public TLS is terminated by Cloudflare; the firewall
accepts 80/443 from Cloudflare ranges only.

HTTPS is not optional here. The app is an installable PWA, and service workers
and the File System Access API both require a secure context, so over plain
HTTP the install prompt and offline support disappear.

## Update an existing deploy

```sh
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude .DS_Store \
  ./ 91.98.123.217:/opt/highfi-player/
ssh 91.98.123.217 'cd /opt/highfi-player && docker compose up -d --build'
```

## First-time setup

1. Cloudflare DNS: `music` A record -> `91.98.123.217`, proxied (orange cloud).
2. Copy `nginx-highfi-player.conf` to `/etc/nginx/sites-available/highfi-player`,
   symlink it into `sites-enabled`, then `nginx -t && systemctl reload nginx`.
3. Issue the origin certificate once DNS resolves:
   `certbot --nginx -d music.mydailyreport.xyz`
4. Set the Cloudflare SSL/TLS mode to Full (or Full (strict)).

## Notes

The library lives in the browser's IndexedDB, keyed to the origin. Nothing is
stored server-side, so there is no database, no volume and no backup to take -
and moving the app to a different origin starts from an empty library.
