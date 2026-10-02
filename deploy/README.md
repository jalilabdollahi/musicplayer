# Deploying HighFi Player

Target: `91.98.123.217`, served at **http://91.98.123.217:3012**.

The container publishes port 3012 on all interfaces and is reached directly by
IP, with `ufw allow 3012/tcp`. No reverse proxy is involved on this path.

## Update an existing deploy

```sh
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude .DS_Store \
  ./ 91.98.123.217:/opt/highfi-player/
ssh 91.98.123.217 'cd /opt/highfi-player && docker compose up -d --build'
```

## What plain HTTP costs

A page served over http:// from an IP is not a secure context, which disables:

- service workers, so no offline support and no PWA install prompt
- the File System Access API, so no "link a folder" picker

Importing still works: the file picker and drag-and-drop are not gated on a
secure context. Audio files are read in the browser and kept in IndexedDB on
the listener's own machine - nothing is uploaded, and the server stores
nothing. There is no database, no volume and no backup to take.

The library is keyed to the origin, so `http://91.98.123.217:3012` and any
other hostname each start from an empty library.

## Optional: hostname with HTTPS

`deploy/nginx-highfi-player.conf` still exists and remains enabled on the host
for `music.mydailyreport.xyz`, proxying to the same container. That path has a
Let's Encrypt certificate and restores PWA install and the folder picker. It
can be removed with:

```sh
rm /etc/nginx/sites-enabled/highfi-player && nginx -t && systemctl reload nginx
certbot delete --cert-name music.mydailyreport.xyz
```
