"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { useToast } from "@/components/toast/ToastProvider";

type Profile = {
  id: string;
  role: "admin" | "tech";
  full_name: string | null;
};

function cls(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  async function loadMe() {
    setLoadingMe(true);

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setEmail(null);
      setProfile(null);
      setLoadingMe(false);
      return;
    }

    const user = data?.user ?? null;
    setEmail(user?.email ?? null);

    if (!user?.id) {
      setProfile(null);
      setLoadingMe(false);
      return;
    }

    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("id,role,full_name")
      .eq("id", user.id)
      .single();

    if (pErr) {
      // If RLS blocks this, you’ll see it clearly.
      setProfile(null);
      setLoadingMe(false);
      return;
    }

    setProfile(p as Profile);
    setLoadingMe(false);
  }

  useEffect(() => {
    void loadMe();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadMe();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Logged out");
    router.push("/login");
  }

  const isAdmin = profile?.role === "admin";
  const isTech = profile?.role === "tech";

  const nav = [
    { href: "/", label: "Home" },
    { href: "/customers", label: "Customers" },
    { href: "/locations", label: "Locations" },
    { href: "/routes", label: "Routes" },
    { href: "/techs", label: "Techs", adminOnly: true },
  ].filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="font-semibold">Pool App</div>

            <nav className="flex items-center gap-3">
              {nav.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className={cls(
                    "text-sm underline",
                    pathname === i.href && "font-semibold"
                  )}
                >
                  {i.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600 text-right">
              {loadingMe ? (
                <div>Checking session…</div>
              ) : email ? (
                <>
                  <div>
                    <b>{profile?.full_name ?? email}</b>
                  </div>
                  <div>
                    Role:{" "}
                    <b>{isAdmin ? "Admin" : isTech ? "Tech" : "Unknown"}</b>
                  </div>
                </>
              ) : (
                <div>Not signed in</div>
              )}
            </div>

            {email ? (
              <button className="text-sm underline" onClick={logout}>
                Logout
              </button>
            ) : (
              <Link className="text-sm underline" href="/login">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
