import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const revalidate = 86400; // 24h — brand image rarely changes
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: '#FAFAF9',
          color: '#171717',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 14, letterSpacing: 3, color: '#8A8A8A', fontWeight: 600, textTransform: 'uppercase' }}>
              SightWhale.com
            </div>
            <div style={{ fontSize: 52, fontWeight: 700, marginTop: 20, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
              Follow the top 1%
              <br />
              of Polymarket whales.
            </div>
            <div style={{ fontSize: 22, marginTop: 18, color: '#525252', lineHeight: 1.4 }}>
              Real-time Telegram alerts for high-conviction bets
              <br />
              on Elections, Sports, and Crypto.
            </div>
          </div>

          {/* Whale icon */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 12,
              background: 'rgba(13, 92, 63, 0.06)',
              border: '1px solid rgba(13, 92, 63, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 64,
            }}
          >
            🐋
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, letterSpacing: 1, color: '#8A8A8A', fontWeight: 600 }}>
            Whale Score™ · Real-time Polymarket Signals
          </div>
          <div style={{ fontSize: 14, color: '#8A8A8A' }}>
            sightwhale.com
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
