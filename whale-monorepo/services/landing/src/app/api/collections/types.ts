export type CollectionPayload = {
  name: string;
  description?: string;
  enabled?: boolean;
};

export type CollectionResponse = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  whale_count?: number;
};

export type CollectionDetailResponse = CollectionResponse & {
  whales: {
    wallet: string;
    created_at: string;
    updated_at: string;
  }[];
};

export type AddWhalePayload = {
  wallet: string;
};

export function validateCollectionPayload(input: unknown): CollectionPayload {
  if (typeof input !== 'object' || input === null) {
    throw new Error('invalid_body');
  }
  const data = input as Record<string, unknown>;
  const name = String(data.name ?? '').trim();
  if (!name) {
    throw new Error('name_required');
  }
  const descriptionRaw = data.description;
  const description =
    typeof descriptionRaw === 'string' ? descriptionRaw.trim() : '';
  const enabledRaw = data.enabled;
  const enabled =
    typeof enabledRaw === 'boolean' ? enabledRaw : undefined;
  return {
    name,
    description,
    enabled,
  };
}

export function validateAddWhalePayload(input: unknown): AddWhalePayload {
  if (typeof input !== 'object' || input === null) {
    throw new Error('invalid_body');
  }
  const data = input as Record<string, unknown>;
  const wallet = String(data.wallet ?? '').trim();
  if (!wallet) {
    throw new Error('wallet_required');
  }
  return { wallet };
}

