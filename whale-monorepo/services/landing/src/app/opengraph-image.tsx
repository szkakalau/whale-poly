import { ImageResponse } from 'next/og';

// Use node runtime to keep static generation available during builds.
export const runtime = 'nodejs';
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
          background:
            'linear-gradient(135deg, rgba(2,6,23,1) 0%, rgba(10,6,24,1) 40%, rgba(6,182,212,0.08) 100%)',
          color: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, letterSpacing: 2, color: '#a1a1aa', fontWeight: 700 }}>
              SIGHT WHALE
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, marginTop: 18, lineHeight: 1.05 }}>
              Follow
              <span style={{ color: '#c4b5fd' }}> Whale Score</span>.
              <br />
              Frontrun the Market.
            </div>
            <div style={{ fontSize: 22, marginTop: 16, color: '#cbd5f5', lineHeight: 1.35 }}>
              Real-time Telegram alerts for high-conviction bets on Polymarket.
            </div>
          </div>

          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 28,
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              color: '#a5b4fc',
              boxShadow: '0 0 40px rgba(139,92,246,0.25)',
            }}
          >
            🐋
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, letterSpacing: 1.2, color: '#94a3b8', fontWeight: 700 }}>
            Whale Score™ · Telegram Delivery
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            Generated for web sharing
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

