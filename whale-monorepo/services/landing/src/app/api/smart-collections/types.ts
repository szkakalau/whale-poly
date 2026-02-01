export type SmartCollectionSummary = {
  id: string;
  name: string;
  description: string;
  rule_json: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  whale_count: number;
  subscribed: boolean;
};

export type SmartCollectionDetail = SmartCollectionSummary & {
  whales: {
    wallet: string;
    snapshot_date: string;
    created_at: string;
    updated_at: string;
  }[];
};

