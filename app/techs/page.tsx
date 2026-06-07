"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type TechRole = "admin" | "tech";
type TechLanguage = "en" | "es";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: TechRole | null;
  tech_language: TechLanguage | null;
  preferred_language?: TechLanguage | null;
  is_active: boolean;
  created_at?: string | null;
};

export default function TechsPage() {
  const [techs, setTechs] = useState<ProfileRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState<TechLanguage>("en");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const visibleTechs = useMemo(() => {
    if (showInactive) return techs;
    return techs.filter((t) => t.is_active !== false);
  }, [techs, showInactive]);

  async function loadTechs() {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, tech_language, preferred_language, is_active, created_at")
      .in("role", ["admin", "tech"])
      .order("full_name", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setTechs([]);
    } else {
      setTechs((data ?? []) as ProfileRow[]);
    }

    setLoading(false);
  }

  async function createTech() {
    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail) {
      setErrorMsg("Email is required.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-tech", {
        body: {
          email: cleanEmail,
          full_name: cleanName || cleanEmail,
          role: "tech",
          tech_language: language,
        },
      });

      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);

      setEmail("");
      setFullName("");
      setLanguage("en");

      setSuccessMsg("Tech created ✅");
      await loadTechs();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to create tech.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTech(tech: ProfileRow) {
    setErrorMsg("");
    setSuccessMsg("");

    const fullNameInput = window.prompt("Full name:", tech.full_name ?? "");
    if (fullNameInput === null) return;

    const roleInput = window.prompt("Role: tech or admin", tech.role ?? "tech");
    if (roleInput !== "tech" && roleInput !== "admin") {
      setErrorMsg("Role must be tech or admin.");
      return;
    }

    const currentLang = tech.tech_language ?? tech.preferred_language ?? "en";
    const langInput = window.prompt("Language: en or es", currentLang);
    if (langInput !== "en" && langInput !== "es") {
      setErrorMsg("Language must be en or es.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullNameInput.trim() || null,
        role: roleInput,
        tech_language: langInput,
        preferred_language: langInput,
      })
      .eq("id", tech.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg("Tech updated ✅");
      await loadTechs();
    }

    setBusy(false);
  }

  async function deactivateTech(tech: ProfileRow) {
    setErrorMsg("");
    setSuccessMsg("");

    const ok = window.confirm(
      `Deactivate ${tech.full_name || "this tech"}?\n\nThey will be hidden from active lists, but route history will remain safe.`
    );
    if (!ok) return;

    setBusy(true);

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", tech.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg("Tech deactivated ✅");
      await loadTechs();
    }

    setBusy(false);
  }

  async function reactivateTech(tech: ProfileRow) {
    setErrorMsg("");
    setSuccessMsg("");

    setBusy(true);

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: true })
      .eq("id", tech.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg("Tech reactivated ✅");
      await loadTechs();
    }

    setBusy(false);
  }

  useEffect(() => {
    void loadTechs();
  }, []);

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Techs</h1>

        <div className="flex gap-4 text-sm">
          <a className="underline" href="/">Home</a>
          <a className="underline" href="/customers">Customers</a>
          <a className="underline" href="/locations">Locations</a>
          <a className="underline" href="/routes">Routes</a>
        </div>
      </div>

      <section className="mt-6 rounded border p-4">
        <h2 className="font-semibold">Create Tech</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="text-sm">Email</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tech@email.com"
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm">Full name</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tech name"
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm">Language</label>
            <select
              className="mt-1 w-full rounded border p-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value as TechLanguage)}
              disabled={busy}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              onClick={() => void createTech()}
              disabled={busy}
            >
              {busy ? "Saving…" : "Create Tech"}
            </button>
          </div>
        </div>
      </section>

      {errorMsg ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {successMsg}
        </div>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Tech List</h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : visibleTechs.length === 0 ? (
          <p className="text-gray-600">No techs found.</p>
        ) : (
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Language</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Created</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleTechs.map((tech) => {
                  const active = tech.is_active !== false;
                  const lang = tech.tech_language ?? tech.preferred_language ?? "-";

                  return (
                    <tr key={tech.id} className={`border-t ${!active ? "bg-gray-50 text-gray-500" : ""}`}>
                      <td className="p-3">
                        <div className="font-medium">{tech.full_name ?? "(no name)"}</div>
                        <div className="text-xs text-gray-500">{tech.id}</div>
                      </td>

                      <td className="p-3">{tech.role ?? "-"}</td>
                      <td className="p-3">{lang}</td>

                      <td className="p-3">
                        {active ? (
                          <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {tech.created_at ? new Date(tech.created_at).toLocaleDateString() : "-"}
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-3">
                          <button
                            className="underline disabled:opacity-50"
                            onClick={() => void updateTech(tech)}
                            disabled={busy}
                          >
                            Edit
                          </button>

                          {active ? (
                            <button
                              className="underline text-red-600 disabled:opacity-50"
                              onClick={() => void deactivateTech(tech)}
                              disabled={busy}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="underline text-green-700 disabled:opacity-50"
                              onClick={() => void reactivateTech(tech)}
                              disabled={busy}
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}