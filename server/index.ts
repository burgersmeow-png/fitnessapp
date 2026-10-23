// The app's small helper server. It holds the secrets the app must not carry:
// the Claude API key (meal photos) and the Strava client secret (sign-in).
//
//   npm run server
//
// Then set EXPO_PUBLIC_SERVER_URL in .env.local to this server's address
// (e.g. http://192.168.1.20:8787 for a PC on the same Wi-Fi as the phone).
import { createServer } from 'node:http';
import { foodConfigured, handleEstimate } from './food-ai';
import { send } from './http';
import { handleStrava, stravaConfigured } from './strava';

const PORT = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'POST' && req.url === '/estimate') return handleEstimate(req, res);
  if (await handleStrava(req, res)) return;
  send(res, 404, { error: 'Not found' });
}).listen(PORT, () => {
  console.log(`LiftLab server on http://localhost:${PORT}`);
  console.log(`  Meal photos: ${foodConfigured() ? 'on' : 'off (set ANTHROPIC_API_KEY)'}`);
  console.log(`  Strava:      ${stravaConfigured() ? 'on' : 'off (set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET)'}`);
});
