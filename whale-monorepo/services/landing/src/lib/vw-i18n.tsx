'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// —— Types ——

export type Locale = 'en' | 'zh';

type TranslationDict = Record<string, string>;

// —— Dictionaries ——

const en: TranslationDict = {
  'page.title': 'Volume-Weighted Analysis',
  'page.subtitle': 'Market sentiment detection based on volume-weighted price',
  'sort.volume': 'By Volume',
  'sort.divergence': 'By Divergence',
  'sort.strength': 'By Signal',
  'loading': 'Loading...',
  'empty': 'No active market data, please try again later',
  'signal.bullish': 'Bullish',
  'signal.bearish': 'Bearish',
  'signal.neutral': 'Neutral',
  'card.volume': 'Vol',
  'card.strength': 'Strength',
  'card.price': 'Price',
  'card.divergence': 'Divergence',
  'card.uai': 'UAI',
  'drawer.title': 'VW Trend',
  'drawer.crossSignal': 'Cross Signal',
  'drawer.vwSignal': 'VW Signal',
  'drawer.whaleSignal': 'Whale Signal',
  'drawer.crossVerdict': 'Cross Signal',
  'drawer.confidence': 'Confidence',
  'drawer.confidenceHigh': 'High ✓',
  'drawer.confidenceMedium': 'Medium',
  'drawer.confidenceLow': 'Low ⚠️',
  'drawer.long': 'Long',
  'drawer.short': 'Short',
  'chart.noData': 'No trend data available',
  'chart.legendVw': 'VW Flow',
  'chart.legendPrice': 'Market Price',
  'chart.reference': 'Current Price',
};

const zh: TranslationDict = {
  'page.title': '量价分析',
  'page.subtitle': '基于成交量加权价格的市场情绪探测',
  'sort.volume': '按成交额',
  'sort.divergence': '按偏离度',
  'sort.strength': '按信号强度',
  'loading': '加载中...',
  'empty': '暂无活跃市场数据，请稍后再试',
  'signal.bullish': '偏多',
  'signal.bearish': '偏空',
  'signal.neutral': '中性',
  'card.volume': '总成交',
  'card.strength': '强度',
  'card.price': '价格',
  'card.divergence': '偏离',
  'card.uai': 'UAI',
  'drawer.title': '量价走势',
  'drawer.crossSignal': '交叉信号',
  'drawer.vwSignal': 'VW 信号',
  'drawer.whaleSignal': 'Whale 信号',
  'drawer.crossVerdict': '交叉判断',
  'drawer.confidence': '置信度',
  'drawer.confidenceHigh': '高 ✓',
  'drawer.confidenceMedium': '中',
  'drawer.confidenceLow': '低 ⚠️',
  'drawer.long': '做多',
  'drawer.short': '做空',
  'chart.noData': '暂无走势数据',
  'chart.legendVw': 'VW资金流向',
  'chart.legendPrice': '市场价格',
  'chart.reference': '当前价格',
};

const dicts: Record<Locale, TranslationDict> = { en, zh };

// —— Context ——

interface LocaleContextValue {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  t: (k) => k,
  setLocale: () => {},
});

const STORAGE_KEY = 'vw-locale';

function loadLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh' || stored === 'en') return stored;
  return 'en';
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    setLocaleState(loadLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => dicts[locale]?.[key] ?? dicts.en[key] ?? key,
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
