'use client';

import { useState, useEffect } from 'react';

type Plan = 'FREE' | 'PRO' | 'ELITE';

interface AuthUser {
  id: string;
  email: string;
  telegramId: string | null;
  plan: Plan;
  planExpireAt: Date | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me/plan')
      .then((r) => r.json())
      .then((data: { plan: Plan; planExpireAt: string | null }) => {
        setPlan(data.plan);
        setUser({
          id: '',
          email: '',
          telegramId: null,
          plan: data.plan,
          planExpireAt: data.planExpireAt ? new Date(data.planExpireAt) : null,
        });
      })
      .catch(() => {
        setPlan('FREE');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, plan, loading };
}
