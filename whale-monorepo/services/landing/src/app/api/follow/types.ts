export type FollowPayload = {
  wallet: string;
  alert_entry: boolean;
  alert_exit: boolean;
  alert_add: boolean;
  min_size: number;
  min_score: number;
};

export function validateFollowPayload(input: unknown): FollowPayload {
  if (typeof input !== 'object' || input === null) {
    throw new Error('invalid_body');
  }
  const data = input as Record<string, unknown>;
  const wallet = String(data.wallet ?? '').trim();
  if (!wallet) {
    throw new Error('wallet_required');
  }
  const alert_entry = Boolean(data.alert_entry);
  const alert_exit = Boolean(data.alert_exit);
  const alert_add = Boolean(data.alert_add);
  const min_size_raw = Number(data.min_size ?? 0);
  const min_score_raw = Number(data.min_score ?? 0);
  if (!Number.isFinite(min_size_raw) || min_size_raw < 0) {
    throw new Error('min_size_invalid');
  }
  if (!Number.isFinite(min_score_raw) || min_score_raw < 0) {
    throw new Error('min_score_invalid');
  }
  if (!alert_entry && !alert_exit && !alert_add) {
    throw new Error('at_least_one_action');
  }
  return {
    wallet,
    alert_entry,
    alert_exit,
    alert_add,
    min_size: min_size_raw,
    min_score: min_score_raw,
  };
}

