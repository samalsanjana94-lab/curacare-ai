import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionState = {
  loading: boolean;
  user: User | null;
  session: Session | null;
};

/** Lightweight session reader for UI affordances. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    user: null,
    session: null,
  });

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ loading: false, user: session?.user ?? null, session });
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ loading: false, user: data.session?.user ?? null, session: data.session });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
}
