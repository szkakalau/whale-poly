export type TemplateData = {
  market: string;
  outcome?: string;
  amount: number;
  price?: number | string;
  side: string;
  score: number;
  trades_count?: number;
  time_ago?: string;
  context?: string[];
  alertId?: string;
  hideScore?: boolean;
};

export function renderAlertMessage(data: TemplateData) {
  const scoreLine = data.hideScore ? '' : `Whale Score: ${data.score} / 10`;
  const idLine = data.alertId ? `\nAlert ID: ${data.alertId}` : '';
  
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(data.amount);
  const priceLine = data.price ? `Avg Price: ${data.price}` : '';
  const tradesLine = data.trades_count ? `Trades: ${data.trades_count}` : '';
  const timeLine = data.time_ago ? `Time: ${data.time_ago}` : '';
  const outcomeLine = data.outcome ? `Outcome: ${data.outcome}` : '';
  
  const contextSection = data.context && data.context.length > 0
    ? `\n🧠 Context:\n${data.context.map(c => `• ${c}`).join('\n')}`
    : '';

  return `🐋 WHALE ALERT

Market: ${data.market}
${outcomeLine}
Action: ${data.side.toUpperCase()}

Size: ${formattedAmount}
${priceLine}
${tradesLine}
${timeLine}

${scoreLine}${idLine}
${contextSection}

This is NOT a prediction.
We track capital behavior only.`;
}
