export const metadata = {
  title: { absolute: 'Market Analysis — SightWhale' },
  description:
    'Analyze any Polymarket market with whale quality, behavior detection, VW divergence, and flow direction fusion predictions.',
  openGraph: {
    title: 'Market Analysis — SightWhale',
    description:
      'Analyze any Polymarket market with whale quality, behavior detection, VW divergence, and flow direction fusion predictions.',
    type: 'website',
    url: 'https://www.sightwhale.com/analyze',
  },
  alternates: {
    canonical: '/analyze',
  },
};

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
