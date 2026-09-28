import { useEffect, useState } from "react";
import { apiGetMe, getStoredUser, getToken, apiLogout, determineUserRole } from "@/lib/laravel";

export type Profile = {
  id: string;
  role: "lawyer" | "client" | "admin";
  full_name: string;
  phone: string | null;
  location: string | null;
  avatar_url: string | null;
  plan: "free" | "basic" | "pro" | "office" | null;
  is_disabled: boolean;
  disabled_reason: string | null;
};

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const token = getToken();
      if (!token) {
        if (active) {
          setProfile(null);
          setUserId(null);
          setLoading(false);
        }
        return;
      }

      const rawStoredUser = getStoredUser();
      const storedUser = rawStoredUser?.data?.user || rawStoredUser?.data || rawStoredUser?.user || rawStoredUser;
      if (storedUser && active) {
        const p: Profile = {
          id: String(storedUser.id),
          role: determineUserRole(storedUser),
          full_name: storedUser.name || storedUser.full_name || "المستخدم",
          phone: storedUser.phone || null,
          location: storedUser.governorate || storedUser.location || null,
          avatar_url: storedUser.avatar || null,
          plan: storedUser.plan || "pro",
          is_disabled: false,
          disabled_reason: null,
        };
        setProfile(p);
        setUserId(p.id);
      }

      try {
        const rawUser = await apiGetMe();
        const user = rawUser?.data?.user || rawUser?.data || rawUser?.user || rawUser;
        if (active && user) {
          const p: Profile = {
            id: String(user.id),
            role: determineUserRole(user),
            full_name: user.name || user.full_name || "المستخدم",
            phone: user.phone || null,
            location: user.governorate || user.location || null,
            avatar_url: user.avatar || null,
            plan: user.plan || "pro",
            is_disabled: false,
            disabled_reason: null,
          };
          setProfile(p);
          setUserId(p.id);
        }
      } catch {
        if (active) {
          // Token invalid
          apiLogout();
          setProfile(null);
          setUserId(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    return () => {
      active = false;
    };
  }, []);

  return {
    profile,
    userId,
    loading,
    isAuthed: !!userId,
    isLawyer: profile?.role === "lawyer",
    isClient: profile?.role === "client",
  };
}

