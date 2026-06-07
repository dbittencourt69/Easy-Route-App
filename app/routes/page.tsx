"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { useToast } from "@/components/toast/ToastProvider";

type Tech = {
  id: string;
  full_name: string | null;
};

type Customer = {
  id: string;
  name: string;
};

type LocationRow = {
  id: string;
  customer_id: string;
  address_line1: string;
  city: string;
  state: string;
};

type RouteDay = {
  id: string;
  service_date: string;
  tech_id: string;
  status: "draft" | "in_progress" | "completed" | string;
  completed_at?: string | null;
};

type RouteStop = {
  id: string;
  route_day_id: string;
  location_id: string;
  stop_order: number;
  status: "pending" | "in_progress" | "completed" | "skipped" | "rescheduled" | string;
};

type RouteDayStat = {
  route_day_id: string;
  total_stops: number;
  completed_stops: number;
};

type Profile = {
  id: string;
  role: "admin" | "tech";
  full_name: string | null;
};

type ServiceSettingLite = {
  location_id: string;
  estimated_minutes_at_stop: number | null;
};

type VisitLite = {
  route_stop_id: string;
  minutes_on_site: number | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type ActiveServiceSetting = {
  id: string;
  location_id: string;
  default_tech_id: string | null;
  is_active: boolean;
};

type FilterMode = "all" | "mine" | "today";

function todayLocalYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function isoWeekNumber(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThu.getTime()) / 604800000);
}

function weekParityLabel(dateStr: string) {
  const w = isoWeekNumber(dateStr);
  return w % 2 === 0 ? "Even week" : "Odd week";
}

function addMinutes(dt: Date, minutes: number) {
  return new Date(dt.getTime() + Math.max(0, Math.round(minutes)) * 60_000);
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function routeProgress(
  stats: RouteDayStat | undefined
): { total: number; completed: number; pct: number } {
  const total = stats?.total_stops ?? 0;
  const completed = stats?.completed_stops ?? 0;
  const pct = total > 0 ? clampPct((completed / total) * 100) : 0;
  return { total, completed, pct };
}

function RoutesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [me, setMe] = useState<Profile | null>(null);
  const isAdmin = me?.role === "admin";
  const isTech = me?.role === "tech";

  const [date, setDate] = useState("");
  const [techId, setTechId] = useState("");

  const [windowStart, setWindowStart] = useState(todayLocalYYYYMMDD());
  const [windowEnd, setWindowEnd] = useState("");
  const [windowTechId, setWindowTechId] = useState("");

  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const [techs, setTechs] = useState<Tech[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [routeDays, setRouteDays] = useState<RouteDay[]>([]);
  const [stats, setStats] = useState<Record<string, RouteDayStat>>({});
  const [selectedRouteDayId, setSelectedRouteDayId] = useState("");

  const [stops, setStops] = useState<RouteStop[]>([]);
  const [settingsByLocation, setSettingsByLocation] = useState<
    Record<string, ServiceSettingLite>
  >({});
  const [visitsByStop, setVisitsByStop] = useState<Record<string, VisitLite>>({});

  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const routeDayIdFromQuery = searchParams.get("routeDayId");

  const customerNameById = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const locationById = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const techNameById = useMemo(
    () => new Map(techs.map((t) => [t.id, t.full_name ?? t.id])),
    [techs]
  );

  const selectedRouteDay = useMemo(() => {
    if (!selectedRouteDayId) return null;
    return routeDays.find((r) => r.id === selectedRouteDayId) ?? null;
  }, [routeDays, selectedRouteDayId]);

  const selectedStats = useMemo(() => {
    if (!selectedRouteDayId) return null;
    return stats[selectedRouteDayId] ?? {
      route_day_id: selectedRouteDayId,
      total_stops: 0,
      completed_stops: 0,
    };
  }, [selectedRouteDayId, stats]);

  const selectedPendingCount = useMemo(() => {
    return stops.filter((s) => s.status === "pending").length;
  }, [stops]);

  const selectedInProgressStop = useMemo(() => {
    return (
      [...stops]
        .filter((s) => s.status === "in_progress")
        .sort((a, b) => a.stop_order - b.stop_order)[0] ?? null
    );
  }, [stops]);

  const selectedNextPendingStop = useMemo(() => {
    return (
      [...stops]
        .filter((s) => s.status === "pending")
        .sort((a, b) => a.stop_order - b.stop_order)[0] ?? null
    );
  }, [stops]);

  const stickyStatus = useMemo(() => {
    if (!selectedRouteDayId) return "No route selected";
    if (!selectedRouteDay) return "Route selected";
    return `Route ${selectedRouteDay.service_date}`;
  }, [selectedRouteDayId, selectedRouteDay]);

  const etaSummary = useMemo(() => {
    if (!selectedRouteDayId || stops.length === 0) return null;

    const DEFAULT_EST = 30;
    let completedMinutes = 0;
    let remainingMinutes = 0;

    for (const stop of stops) {
      const visit = visitsByStop[stop.id];
      const actual = visit?.minutes_on_site ?? null;
      const est =
        settingsByLocation[stop.location_id]?.estimated_minutes_at_stop ??
        DEFAULT_EST;

      if (stop.status === "completed") {
        completedMinutes += actual !== null ? actual : est;
      } else if (stop.status === "pending" || stop.status === "in_progress") {
        remainingMinutes += est;
      }
    }

    const totalMinutes = completedMinutes + remainingMinutes;
    const finish = addMinutes(new Date(), remainingMinutes);

    return {
      completedMinutes,
      remainingMinutes,
      totalMinutes,
      finishTimeLabel: fmtTime(finish),
    };
  }, [selectedRouteDayId, stops, settingsByLocation, visitsByStop]);

  const loadMe = useCallback(async () => {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw new Error(authErr.message);

    const uid = authData?.user?.id;
    if (!uid) {
      setMe(null);
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,role,full_name")
      .eq("id", uid)
      .single();

    if (error) throw new Error(error.message);

    const profile = data as Profile;
    setMe(profile);

    if (profile.role === "tech") {
      setFilterMode("today");
    } else {
      setFilterMode("all");
    }

    return profile;
  }, []);

  const loadBasics = useCallback(async () => {
    const [techRes, customerRes, locationRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name")
        .eq("role", "tech")
        .order("full_name"),

      supabase.from("customers").select("id,name").order("name"),

      supabase
        .from("locations")
        .select("id,customer_id,address_line1,city,state")
        .order("city")
        .order("address_line1"),
    ]);

    if (techRes.error) throw new Error(techRes.error.message);
    if (customerRes.error) throw new Error(customerRes.error.message);
    if (locationRes.error) throw new Error(locationRes.error.message);

    setTechs((techRes.data ?? []) as Tech[]);
    setCustomers((customerRes.data ?? []) as Customer[]);
    setLocations((locationRes.data ?? []) as LocationRow[]);
  }, []);

  const loadRouteDaysAndStats = useCallback(async () => {
    let query = supabase
      .from("route_days")
      .select("id,service_date,tech_id,status,completed_at");

    if (isTech && me?.id) {
      if (filterMode === "today") {
        query = query.eq("tech_id", me.id).eq("service_date", todayLocalYYYYMMDD());
      } else {
        query = query.eq("tech_id", me.id);
      }
    }

    const { data: dayRows, error: dayErr } = await query.order("service_date", {
      ascending: false,
    });

    if (dayErr) throw new Error(dayErr.message);

    const days = (dayRows ?? []) as RouteDay[];
    setRouteDays(days);

    const { data: statRows, error: statErr } = await supabase
      .from("route_day_stats")
      .select("route_day_id,total_stops,completed_stops");

    if (statErr) throw new Error(statErr.message);

    const nextStats: Record<string, RouteDayStat> = {};
    (statRows ?? []).forEach((row: any) => {
      nextStats[row.route_day_id] = row as RouteDayStat;
    });
    setStats(nextStats);

    return days;
  }, [filterMode, isTech, me?.id]);

  const loadStops = useCallback(async (routeDayId?: string) => {
    if (!routeDayId) {
      setStops([]);
      setSettingsByLocation({});
      setVisitsByStop({});
      return;
    }

    const { data: stopRows, error: stopErr } = await supabase
      .from("route_stops")
      .select("id,route_day_id,location_id,stop_order,status")
      .eq("route_day_id", routeDayId)
      .order("stop_order");

    if (stopErr) throw new Error(stopErr.message);

    const nextStops = (stopRows ?? []) as RouteStop[];
    setStops(nextStops);

    const stopIds = nextStops.map((s) => s.id);
    const locationIds = [...new Set(nextStops.map((s) => s.location_id))];

    if (locationIds.length === 0) {
      setSettingsByLocation({});
      setVisitsByStop({});
      return;
    }

    const [settingsRes, visitsRes] = await Promise.all([
      supabase
        .from("service_settings")
        .select("location_id,estimated_minutes_at_stop,is_active")
        .in("location_id", locationIds)
        .eq("is_active", true),

      stopIds.length
        ? supabase
            .from("service_visits")
            .select(
              "route_stop_id,minutes_on_site,status,started_at,finished_at"
            )
            .in("route_stop_id", stopIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (settingsRes.error) throw new Error(settingsRes.error.message);
    if (visitsRes.error) throw new Error(visitsRes.error.message);

    const settingsMap: Record<string, ServiceSettingLite> = {};
    (settingsRes.data ?? []).forEach((row: any) => {
      settingsMap[row.location_id] = {
        location_id: row.location_id,
        estimated_minutes_at_stop: row.estimated_minutes_at_stop ?? null,
      };
    });
    setSettingsByLocation(settingsMap);

    const visitMap: Record<string, VisitLite> = {};
    (visitsRes.data ?? []).forEach((row: any) => {
      visitMap[row.route_stop_id] = row as VisitLite;
    });
    setVisitsByStop(visitMap);
  }, []);

  const refreshAll = useCallback(
    async (routeDayId?: string) => {
      const days = await loadRouteDaysAndStats();

      let nextRouteDayId = routeDayId ?? selectedRouteDayId ?? "";

      if (nextRouteDayId && !days.some((d) => d.id === nextRouteDayId)) {
        nextRouteDayId = "";
        setSelectedRouteDayId("");
      }

      if (!nextRouteDayId && isTech && filterMode === "today" && days.length === 1) {
        nextRouteDayId = days[0].id;
        setSelectedRouteDayId(days[0].id);
      }

      if (nextRouteDayId) {
        await loadStops(nextRouteDayId);
      } else {
        await loadStops(undefined);
      }
    },
    [
      filterMode,
      isTech,
      loadRouteDaysAndStats,
      loadStops,
      selectedRouteDayId,
    ]
  );

  const ensureRouteDay = useCallback(
    async (serviceDate: string, assignedTechId: string) => {
      const { data: existing, error: existingErr } = await supabase
        .from("route_days")
        .select("id,service_date,tech_id,status,completed_at")
        .eq("service_date", serviceDate)
        .eq("tech_id", assignedTechId)
        .limit(1)
        .maybeSingle();

      if (existingErr) throw new Error(existingErr.message);

      if (existing?.id) {
        return existing as RouteDay;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("route_days")
        .insert({
          service_date: serviceDate,
          tech_id: assignedTechId,
          status: "draft",
        })
        .select("id,service_date,tech_id,status,completed_at")
        .single();

      if (insertErr) throw new Error(insertErr.message);

      return inserted as RouteDay;
    },
    []
  );

  const getActiveServiceSettingForLocation = useCallback(
    async (locationId: string) => {
      const { data, error } = await supabase
        .from("service_settings")
        .select("id,location_id,default_tech_id,is_active")
        .eq("location_id", locationId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data?.id) {
        throw new Error("No active service setting found for this location.");
      }

      return data as ActiveServiceSetting;
    },
    []
  );

  const viewStops = useCallback(
    async (routeDayId: string) => {
      setSelectedRouteDayId(routeDayId);
      router.replace(`/routes?routeDayId=${routeDayId}`);
      await loadStops(routeDayId);
    },
    [loadStops, router]
  );

  async function createRouteDay() {
    if (!date || !techId) {
      toast.info("Pick date and technician");
      return;
    }

    setBusy(true);

    try {
      const routeDay = await ensureRouteDay(date, techId);

      const { data, error } = await supabase.rpc("generate_route_stops", {
        p_route_day_id: routeDay.id,
      });

      if (error) throw new Error(error.message);

      setDate("");
      setTechId("");
      setSelectedRouteDayId(routeDay.id);

      await refreshAll(routeDay.id);

      const inserted = Number(data ?? 0);
      if (inserted > 0) {
        toast.success(`Route day created and stops generated ✅ Inserted: ${inserted}`);
      } else {
        toast.info("Route day created/synced — 0 inserted.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create route day");
    } finally {
      setBusy(false);
    }
  }

  async function generateRouteWindow() {
    if (!windowStart || !windowEnd) {
      toast.info("Pick start and end dates");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.rpc("generate_route_days_window", {
        p_start_date: windowStart,
        p_end_date: windowEnd,
        p_tech_id: windowTechId || null,
      });

      if (error) throw new Error(error.message);

      await refreshAll(selectedRouteDayId || undefined);

      const inserted = Number(data ?? 0);
      toast.success(`Route window generated ✅ Inserted stops: ${inserted}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate route window");
    } finally {
      setBusy(false);
    }
  }

  async function syncStops(routeDayId: string) {
    if (!isAdmin) {
      toast.info("Sync is admin-only.");
      return;
    }

    const routeDay = routeDays.find((r) => r.id === routeDayId);
    if (routeDay?.status === "completed") {
      toast.info("This route day is completed — syncing is disabled.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.rpc("generate_route_stops", {
        p_route_day_id: routeDayId,
      });

      if (error) throw new Error(error.message);

      setSelectedRouteDayId(routeDayId);
      await refreshAll(routeDayId);

      const inserted = Number(data ?? 0);
      if (inserted > 0) {
        toast.success(`Synced stops ✅ Inserted: ${inserted}`);
      } else {
        toast.info("Sync complete — 0 inserted (already synced).");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to sync stops");
    } finally {
      setBusy(false);
    }
  }

  async function goToNextStop() {
    if (!selectedRouteDayId) {
      toast.info("Select a route day first.");
      return;
    }

    const inProgress = selectedInProgressStop;
    if (inProgress?.id) {
      router.push(`/stops/${inProgress.id}?routeDayId=${selectedRouteDayId}`);
      return;
    }

    const nextPending = selectedNextPendingStop;
    if (nextPending?.id) {
      router.push(`/stops/${nextPending.id}?routeDayId=${selectedRouteDayId}`);
      return;
    }

    toast.info("No pending stops left for this route day.");
  }

  async function skipStop(stop: RouteStop) {
    if (!isAdmin) {
      toast.info("Skip is admin-only.");
      return;
    }

    if (!selectedRouteDay) {
      toast.info("Select a route day first.");
      return;
    }

    const reason = window.prompt(
      "Skip reason:",
      "Vacation / sick / customer request"
    );
    if (reason === null) return;

    setBusy(true);

    try {
      const setting = await getActiveServiceSettingForLocation(stop.location_id);

      const { error: exceptionErr } = await supabase
        .from("service_exceptions")
        .insert({
          service_setting_id: setting.id,
          location_id: stop.location_id,
          exception_date: selectedRouteDay.service_date,
          action: "skip",
          new_date: null,
          reason: reason.trim() || null,
          created_by: me?.id ?? null,
        });

      if (exceptionErr) throw new Error(exceptionErr.message);

      const { error: stopErr } = await supabase
        .from("route_stops")
        .update({ status: "skipped" })
        .eq("id", stop.id);

      if (stopErr) throw new Error(stopErr.message);

      toast.success("Stop skipped ✅");
      await refreshAll(selectedRouteDayId);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to skip stop");
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleStop(stop: RouteStop) {
    if (!isAdmin) {
      toast.info("Reschedule is admin-only.");
      return;
    }

    if (!selectedRouteDay) {
      toast.info("Select a route day first.");
      return;
    }

    const newDate = window.prompt(
      "New service date (YYYY-MM-DD):",
      selectedRouteDay.service_date
    );
    if (!newDate) return;

    const reason = window.prompt(
      "Reschedule reason:",
      "Vacation / sick / customer request"
    );
    if (reason === null) return;

    setBusy(true);

    try {
      const setting = await getActiveServiceSettingForLocation(stop.location_id);
      const targetTechId = setting.default_tech_id ?? selectedRouteDay.tech_id;

      const targetRouteDay = await ensureRouteDay(newDate, targetTechId);

      const { error: exceptionErr } = await supabase
        .from("service_exceptions")
        .insert({
          service_setting_id: setting.id,
          location_id: stop.location_id,
          exception_date: selectedRouteDay.service_date,
          action: "reschedule",
          new_date: newDate,
          reason: reason.trim() || null,
          created_by: me?.id ?? null,
        });

      if (exceptionErr) throw new Error(exceptionErr.message);

      const { error: stopErr } = await supabase
        .from("route_stops")
        .update({ status: "rescheduled" })
        .eq("id", stop.id);

      if (stopErr) throw new Error(stopErr.message);

      const { error: syncErr } = await supabase.rpc("generate_route_stops", {
        p_route_day_id: targetRouteDay.id,
      });

      if (syncErr) throw new Error(syncErr.message);

      toast.success(`Stop rescheduled to ${newDate} ✅`);
      await refreshAll(selectedRouteDayId);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reschedule stop");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setPageLoading(true);
        await loadMe();
        await loadBasics();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load routes page");
      } finally {
        setPageLoading(false);
      }
    })();
  }, [loadBasics, loadMe, toast]);

  useEffect(() => {
    if (!me) return;

    (async () => {
      try {
        setBusy(true);
        await refreshAll(selectedRouteDayId || undefined);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to refresh routes");
      } finally {
        setBusy(false);
      }
    })();
  }, [filterMode, me, refreshAll]);

  useEffect(() => {
    if (!routeDayIdFromQuery) return;

    setSelectedRouteDayId(routeDayIdFromQuery);

    (async () => {
      try {
        setBusy(true);
        await loadStops(routeDayIdFromQuery);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load selected route");
      } finally {
        setBusy(false);
      }
    })();
  }, [routeDayIdFromQuery, loadStops, toast]);

  useEffect(() => {
    const onFocus = async () => {
      if (!selectedRouteDayId) return;
      try {
        await refreshAll(selectedRouteDayId);
      } catch (e) {
        console.error(e);
      }
    };

    const onVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (!selectedRouteDayId) return;
      try {
        await refreshAll(selectedRouteDayId);
      } catch (e) {
        console.error(e);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshAll, selectedRouteDayId]);

  if (pageLoading) {
    return <main className="p-8">Loading…</main>;
  }

  return (
    <main className="p-8 pb-24">
      <div className="flex justify-between items-center">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold">Route Planner</h1>
          {isTech ? (
            <span className="text-xs text-gray-500">
              Signed in as: {me?.full_name ?? "Tech"}
            </span>
          ) : null}
        </div>

        <div className="flex gap-4">
          <Link className="underline" href="/">
            Home
          </Link>
          <Link className="underline" href="/techs">
            Techs
          </Link>
          <Link className="underline" href="/reference/chemistry">
            Chemistry
          </Link>
          <Link className="underline" href="/locations">
            Locations
          </Link>
          <Link className="underline" href="/customers">
            Customers
          </Link>
        </div>
      </div>

      {isTech ? (
        <section className="mt-6 border rounded p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-600">Filter</div>
              <div className="mt-2 flex gap-2">
                <button
                  className={[
                    "rounded border px-3 py-1 text-sm",
                    filterMode === "today"
                      ? "bg-black text-white border-black"
                      : "bg-white",
                  ].join(" ")}
                  onClick={() => setFilterMode("today")}
                  disabled={busy}
                >
                  My Today’s Route
                </button>

                <button
                  className={[
                    "rounded border px-3 py-1 text-sm",
                    filterMode === "mine"
                      ? "bg-black text-white border-black"
                      : "bg-white",
                  ].join(" ")}
                  onClick={() => setFilterMode("mine")}
                  disabled={busy}
                >
                  My Routes
                </button>
              </div>
            </div>

            <button
              className="underline text-sm disabled:opacity-50"
              onClick={() => refreshAll(selectedRouteDayId || undefined)}
              disabled={busy}
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-600">
            Today: <b>{todayLocalYYYYMMDD()}</b>
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <>
          <section className="mt-6 border rounded p-4">
            <h2 className="font-semibold">Create one route day</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div>
                <label className="text-sm">Date</label>
                <input
                  type="date"
                  className="mt-1 w-full border rounded p-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div>
                <label className="text-sm">Tech</label>
                <select
                  className="mt-1 w-full border rounded p-2"
                  value={techId}
                  onChange={(e) => setTechId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select…</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name ?? t.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  className="rounded bg-black text-white px-4 py-2 w-full disabled:opacity-50"
                  onClick={() => void createRouteDay()}
                  disabled={busy}
                >
                  {busy ? "Creating…" : "Create / Sync Route Day"}
                </button>
              </div>
            </div>
          </section>

          <section className="mt-4 border rounded p-4">
            <h2 className="font-semibold">Generate future routes</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div>
                <label className="text-sm">Start date</label>
                <input
                  type="date"
                  className="mt-1 w-full border rounded p-2"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div>
                <label className="text-sm">End date</label>
                <input
                  type="date"
                  className="mt-1 w-full border rounded p-2"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div>
                <label className="text-sm">Tech (optional)</label>
                <select
                  className="mt-1 w-full border rounded p-2"
                  value={windowTechId}
                  onChange={(e) => setWindowTechId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">All techs</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name ?? t.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  className="rounded bg-black text-white px-4 py-2 w-full disabled:opacity-50"
                  onClick={() => void generateRouteWindow()}
                  disabled={busy}
                >
                  {busy ? "Generating…" : "Generate Window"}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section className={isAdmin ? "mt-8" : "mt-6"}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold mb-3">Existing routes</h2>
          {!isTech ? (
            <button
              className="underline text-sm disabled:opacity-50"
              onClick={() => refreshAll(selectedRouteDayId || undefined)}
              disabled={busy}
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          ) : null}
        </div>

        {routeDays.length === 0 ? (
          <p className="text-gray-600">
            {isTech && filterMode === "today" ? "No route for today." : "No routes yet."}
          </p>
        ) : (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Week</th>
                  <th className="p-2 text-left">Tech</th>
                  <th className="p-2 text-left">Progress</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {routeDays.map((routeDay) => {
                  const st = stats[routeDay.id];
                  const progress = routeProgress(st);
                  const isCompleted = routeDay.status === "completed";
                  const isSelected = selectedRouteDayId === routeDay.id;

                  return (
                    <tr
                      key={routeDay.id}
                      className={`border-t ${isSelected ? "bg-blue-50" : ""}`}
                    >
                      <td className="p-2">{routeDay.service_date}</td>

                      <td className="p-2">
                        <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs">
                          {weekParityLabel(routeDay.service_date)}
                        </span>
                      </td>

                      <td className="p-2">
                        {techNameById.get(routeDay.tech_id) ?? routeDay.tech_id}
                      </td>

                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs">
                            {progress.completed} / {progress.total}
                          </span>
                          <div className="h-2 w-36 rounded bg-gray-200 overflow-hidden">
                            <div
                              className="h-2 bg-black"
                              style={{ width: `${progress.pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-2">
                        <span className="text-xs">{routeDay.status}</span>
                        {isCompleted && routeDay.completed_at ? (
                          <div className="text-[11px] text-gray-500">
                            Done: {new Date(routeDay.completed_at).toLocaleString()}
                          </div>
                        ) : null}
                      </td>

                      <td className="p-2">
                        <div className="flex gap-3 flex-wrap">
                          {isAdmin ? (
                            <button
                              className="underline disabled:opacity-40"
                              onClick={() => void syncStops(routeDay.id)}
                              disabled={busy || isCompleted}
                              title={
                                isCompleted
                                  ? "Completed route day — sync disabled"
                                  : "Generate / sync stops"
                              }
                            >
                              Sync stops
                            </button>
                          ) : null}

                          <button
                            className="underline disabled:opacity-40"
                            onClick={() => void viewStops(routeDay.id)}
                            disabled={busy}
                          >
                            View stops
                          </button>
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

      {selectedRouteDayId ? (
        <section className="mt-6 border rounded p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Stops (Route)</h3>

              {selectedRouteDay ? (
                <div className="mt-1 text-xs text-gray-600">
                  Date: <b>{selectedRouteDay.service_date}</b> • Tech:{" "}
                  <b>{techNameById.get(selectedRouteDay.tech_id) ?? selectedRouteDay.tech_id}</b>
                </div>
              ) : null}

              {selectedStats ? (
                <div className="mt-2">
                  <p className="text-xs text-gray-600">
                    Progress: {selectedStats.completed_stops} / {selectedStats.total_stops} completed
                  </p>

                  <div className="mt-2 h-2 w-64 rounded bg-gray-200 overflow-hidden">
                    <div
                      className="h-2 bg-black"
                      style={{
                        width:
                          selectedStats.total_stops > 0
                            ? `${clampPct(
                                (selectedStats.completed_stops /
                                  selectedStats.total_stops) *
                                  100
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {etaSummary ? (
                <div className="mt-3 text-sm">
                  <div className="text-xs text-gray-600">Estimated finish</div>
                  <div className="mt-1">
                    <span className="font-semibold">{etaSummary.finishTimeLabel}</span>{" "}
                    <span className="text-xs text-gray-600">
                      (Completed: {etaSummary.completedMinutes} min • Remaining:{" "}
                      {etaSummary.remainingMinutes} min • Total: {etaSummary.totalMinutes} min)
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 text-xs text-gray-600">
                In progress: <b>{selectedInProgressStop ? 1 : 0}</b> • Pending:{" "}
                <b>{selectedPendingCount}</b>
              </div>

              {selectedRouteDay?.status === "completed" ? (
                <p className="mt-2 text-xs text-green-700">
                  ✅ This route day is completed.
                </p>
              ) : null}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <button
                className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
                onClick={() => void goToNextStop()}
                disabled={busy || !selectedRouteDayId}
                title="Resume in-progress stop, otherwise open first pending"
              >
                Go to Next Stop
              </button>

              <button
                className="underline text-sm disabled:opacity-50"
                onClick={() => refreshAll(selectedRouteDayId)}
                disabled={busy}
              >
                {busy ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {stops.length === 0 ? (
            <p className="text-gray-600 mt-2">
              {isAdmin ? (
                <>
                  No stops loaded. Click <b>Sync stops</b> first, or click <b>View stops</b>.
                </>
              ) : (
                <>
                  No stops loaded yet. Ask admin to <b>Sync stops</b>, then refresh.
                </>
              )}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stops.map((stop) => {
                const loc = locationById.get(stop.location_id);
                const custName = loc
                  ? customerNameById.get(loc.customer_id) ?? loc.customer_id
                  : "";

                const DEFAULT_EST = 30;
                const est =
                  settingsByLocation[stop.location_id]?.estimated_minutes_at_stop ??
                  DEFAULT_EST;

                const visit = visitsByStop[stop.id];
                const actual = visit?.minutes_on_site ?? null;

                const minutesLabel =
                  stop.status === "completed"
                    ? `${actual !== null ? actual : est} min (actual)`
                    : `${est} min ${
                        stop.status === "pending" || stop.status === "in_progress"
                          ? "(est)"
                          : ""
                      }`;

                return (
                  <li key={stop.id} className="border rounded p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-600">
                          Stop #{stop.stop_order} •{" "}
                          <span className="font-medium">{custName}</span>
                        </div>

                        <div className="mt-1">
                          <Link
                            className="underline"
                            href={`/stops/${stop.id}?routeDayId=${selectedRouteDayId}`}
                          >
                            {loc
                              ? `${loc.address_line1}, ${loc.city} ${loc.state}`
                              : stop.location_id}
                          </Link>
                        </div>

                        <div className="mt-1 text-xs text-gray-600">
                          Status: <span className="font-medium">{stop.status}</span> • Time:{" "}
                          {minutesLabel}
                          {visit?.started_at
                            ? ` • started ${new Date(visit.started_at).toLocaleTimeString()}`
                            : ""}
                          {visit?.finished_at
                            ? ` • finished ${new Date(visit.finished_at).toLocaleTimeString()}`
                            : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          className="underline text-sm whitespace-nowrap"
                          href={`/stops/${stop.id}?routeDayId=${selectedRouteDayId}`}
                        >
                          Open →
                        </Link>

                        {isAdmin &&
                        selectedRouteDay?.status !== "completed" &&
                        stop.status !== "completed" ? (
                          <>
                            <button
                              className="underline text-sm whitespace-nowrap disabled:opacity-40"
                              onClick={() => void skipStop(stop)}
                              disabled={busy || stop.status === "skipped"}
                            >
                              Skip
                            </button>

                            <button
                              className="underline text-sm whitespace-nowrap disabled:opacity-40"
                              onClick={() => void rescheduleStop(stop)}
                              disabled={busy || stop.status === "rescheduled"}
                            >
                              Reschedule
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white">
        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-gray-500 truncate">{stickyStatus}</div>
              {etaSummary ? (
                <div className="text-[11px] text-gray-500">
                  ETA finish: {etaSummary.finishTimeLabel} • Remaining:{" "}
                  {etaSummary.remainingMinutes} min
                </div>
              ) : (
                <div className="text-[11px] text-gray-500">
                  Select a route to continue
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded border px-3 py-3 text-sm disabled:opacity-50"
                onClick={() => refreshAll(selectedRouteDayId || undefined)}
                disabled={busy}
              >
                Refresh
              </button>

              <button
                className="rounded bg-black text-white px-4 py-3 text-sm disabled:opacity-50"
                onClick={() => void goToNextStop()}
                disabled={busy || !selectedRouteDayId}
              >
                Go to Next Stop
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
export default function RoutesPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading routes…</main>}>
      <RoutesPageContent />
    </Suspense>
  );
}