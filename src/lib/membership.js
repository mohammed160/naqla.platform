import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { DEFAULT_PLAN } from './tracks';

/** The plan that is on sale (falls back to a local default until the migration is applied). */
export function usePlan() {
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase
      .from('plans')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setPlan(data);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { plan, loading };
}

/** Membership of the signed-in user. `hasAccess` is true for an active, unexpired membership. */
export function useMembership(userId) {
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId && supabase));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId || !supabase) {
      setMembership(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    supabase
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setMembership(error ? null : data);
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId, tick]);

  const hasAccess = Boolean(
    membership?.active && (!membership.expires_at || new Date(membership.expires_at) > new Date()),
  );
  return { membership, hasAccess, loading, refresh: () => setTick((value) => value + 1) };
}

export function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('ar-EG')} ج.م`;
}
