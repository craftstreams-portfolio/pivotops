"use client";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
export function useTenant() {
  const [tenantId, setTenantId] = useState<string>("default");
  const [role, setRole] = useState<string>("employee");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single();
      if (profile) { setTenantId(profile.tenant_id ?? "default"); setRole(profile.role ?? "employee"); }
      setLoading(false);
    });
  }, []);
  return { tenantId, role, loading };
}