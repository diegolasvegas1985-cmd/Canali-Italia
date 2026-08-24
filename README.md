# Canali Italia — Stremio Addon

Addon personale che legge la playlist M3U dal repository GitHub e la espone a Stremio come catalogo TV.

## Deploy su Render

- Build Command: `npm install`
- Start Command: `npm start`
- Piano: Free

Il `render.yaml` è già configurato con la playlist:
`https://raw.githubusercontent.com/diegolasvegas1985-cmd/Canali-Italia/main/italy.m3u`

Dopo il deploy, il manifest sarà:
`https://TUO-SERVIZIO.onrender.com/manifest.json`

Installando questo manifest in Stremio comparirà il catalogo **Canali Italia**.

## Aggiornamento lista

L'addon rilegge la M3U ogni 5 minuti. Se aggiorni `italy.m3u` su GitHub, i canali vengono aggiornati automaticamente dopo la scadenza della cache.

## Nota

L'addon non fa da proxy video: restituisce a Stremio gli URL presenti nella M3U.
