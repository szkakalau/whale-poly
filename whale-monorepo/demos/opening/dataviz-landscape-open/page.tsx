'use client';

import React from 'react';
import { DatavizLandscapeOpen } from './DatavizLandscapeOpen';

export default function DemoPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#080C14' }}>
      <DatavizLandscapeOpen
        onAnimationComplete={() => {
          console.log('[dataviz-landscape-open] animation complete — ready for handoff');
        }}
      />
    </div>
  );
}
