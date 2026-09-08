// ── Toggle this when switching between local dev and production ───────────────
const DEV = true; // set to false before deploying to production

const LOCAL_IP = '10.30.253.85'; // your machine's LAN IP (run `ipconfig` to update if it changes)

export const API_BASE_URL = DEV
  ? `http://${LOCAL_IP}/BagoMarketPlace/bago-market/server/api`
  : 'https://bago.market.quickycloud.com/server/api';

export const IMAGE_BASE_URL = DEV
  ? `http://${LOCAL_IP}/BagoMarketPlace/bago-market/server`
  : 'https://bago.market.quickycloud.com/server';
