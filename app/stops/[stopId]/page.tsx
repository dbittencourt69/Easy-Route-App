"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { useToast } from "@/components/toast/ToastProvider";

type ServiceItemType = "pool" | "spa" | "water_feature" | "fountain" | "waterfall";

type RouteStop = {
  id: string;
  route_day_id: string;
  location_id: string;
  stop_order: number;
  status: string;
  completed_at: string | null;
  work_order_id?: string | null;
};

type Location = {
  id: string;
  customer_id: string | null;
  address_line1: string;
  city: string;
  state: string;
  zip: string | null;
  gate_code: string | null;
  key_location: string | null;
  service_notes: string | null;
  automation_systems?: string[] | null;
};

type PoolRecord = {
  id: string;
  location_id: string;
  has_pool: boolean;
  has_spa: boolean;
  has_water_feature: boolean;
  has_fountain: boolean;
  has_waterfall: boolean | null;
};

type Visit = {
  id: string;
  route_stop_id: string;
  started_at: string | null;
  finished_at: string | null;
  minutes_on_site: number | null;
  general_notes: string | null;
  problems: string | null;
  status: string | null;
};

type Tech = { id: string; full_name: string | null };

type ChecklistItem = { id: string; name: string; name_es?: string | null; sort_order: number | null };
type ReadingType = { id: string; name: string; unit: string | null; sort_order: number | null };
type ChemicalProduct = { id: string; name: string; default_unit: string; sort_order: number | null };

type ItemNeeded = {
  id: string;
  visit_id: string;
  route_stop_id: string | null;
  location_id: string | null;
  item_type: "product" | "part" | "chemical" | "other";
  item_name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  status: "needed" | "ordered" | "completed" | "cancelled";
  created_at: string;
};

type WorkOrder = {
  id: string;
  customer_id: string | null;
  location_id: string | null;
  visit_id: string | null;
  route_stop_id: string | null;
  route_day_id?: string | null;
  assigned_tech_id?: string | null;
  work_order_type: "service_visit" | "repair" | "equipment_installation";
  title: string;
  description: string | null;
  notes: string | null;
  material_notes?: string | null;
  status: "open" | "scheduled" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
};

type NextStopPreview = { id: string; stop_order: number; status: string; address: string };

type WorkOrderForm = {
  work_order_type: WorkOrder["work_order_type"];
  title: string;
  description: string;
  assigned_tech_id: string;
  scheduled_date: string;
  material_notes: string;
  notes: string;
  priority: WorkOrder["priority"];
};

type ServiceItem = { key: ServiceItemType; label: string };
type ChecklistState = Record<ServiceItemType, Record<string, { done: boolean; note: string }>>;
type ReadingState = Record<ServiceItemType, Record<string, string>>;
type ChemicalState = Record<ServiceItemType, Record<string, { qty: string; unit: string }>>;
type ItemNotesState = Record<ServiceItemType, string>;

function looksLikeUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
}

function formatAddr(loc: Pick<Location, "address_line1" | "city" | "state" | "zip">) {
  return `${loc.address_line1}, ${loc.city} ${loc.state} ${loc.zip ?? ""}`.trim();
}

function parseNumberOrNull(value: string) {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function nowIso() {
  return new Date().toISOString();
}

function todayLocalYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyChecklistState(): ChecklistState {
  return { pool: {}, spa: {}, water_feature: {}, fountain: {}, waterfall: {} };
}
function emptyReadingState(): ReadingState {
  return { pool: {}, spa: {}, water_feature: {}, fountain: {}, waterfall: {} };
}
function emptyChemicalState(): ChemicalState {
  return { pool: {}, spa: {}, water_feature: {}, fountain: {}, waterfall: {} };
}
function emptyItemNotesState(): ItemNotesState {
  return { pool: "", spa: "", water_feature: "", fountain: "", waterfall: "" };
}

const DEFAULT_WORK_ORDER_FORM: WorkOrderForm = {
  work_order_type: "repair",
  title: "",
  description: "",
  assigned_tech_id: "",
  scheduled_date: todayLocalYYYYMMDD(),
  material_notes: "",
  notes: "",
  priority: "normal",
};

const SKIP_REASONS = [
  "No access",
  "Gate locked",
  "Dog / safety issue",
  "Weather",
  "Equipment issue",
  "Pool inaccessible",
  "Customer requested skip",
  "Other",
];

const SERVICE_ITEM_LABELS: Record<ServiceItemType, string> = {
  pool: "Pool",
  spa: "Spa",
  water_feature: "Water Feature",
  fountain: "Fountain",
  waterfall: "Waterfall",
};

export default function StopPage() {
  const params = useParams<{ stopId: string }>();
  const stopId = params?.stopId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const routeDayIdFromQuery = searchParams.get("routeDayId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editCompleted, setEditCompleted] = useState(false);
  const [stop, setStop] = useState<RouteStop | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [poolRecord, setPoolRecord] = useState<PoolRecord | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [routeDate, setRouteDate] = useState<string | null>(null);
  const [serviceSettingId, setServiceSettingId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("No access");
  const [techLang, setTechLang] = useState<"en" | "es">("en");
  const [techs, setTechs] = useState<Tech[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [readingTypes, setReadingTypes] = useState<ReadingType[]>([]);
  const [chemicalProducts, setChemicalProducts] = useState<ChemicalProduct[]>([]);
  const [minutesOnSite, setMinutesOnSite] = useState("");
  const [problems, setProblems] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [itemNotes, setItemNotes] = useState<ItemNotesState>(emptyItemNotesState);
  const [checklist, setChecklist] = useState<ChecklistState>(emptyChecklistState);
  const [readings, setReadings] = useState<ReadingState>(emptyReadingState);
  const [chems, setChems] = useState<ChemicalState>(emptyChemicalState);
  const [itemsNeeded, setItemsNeeded] = useState<ItemNeeded[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [nextStop, setNextStop] = useState<NextStopPreview | null>(null);
  const [isLastPending, setIsLastPending] = useState(false);
  const [workOrderForm, setWorkOrderForm] = useState<WorkOrderForm>(DEFAULT_WORK_ORDER_FORM);

  const backToRoutesHref = stop?.route_day_id
    ? `/routes?routeDayId=${stop.route_day_id}`
    : routeDayIdFromQuery
    ? `/routes?routeDayId=${routeDayIdFromQuery}`
    : "/routes";

  const serviceItems = useMemo<ServiceItem[]>(() => {
    const p = poolRecord;
    if (!p) return [{ key: "pool", label: "Pool" }];

    const result: ServiceItem[] = [];
    if (p.has_pool) result.push({ key: "pool", label: "Pool" });
    if (p.has_spa) result.push({ key: "spa", label: "Spa" });
    if (p.has_water_feature) result.push({ key: "water_feature", label: "Water Feature" });
    if (p.has_fountain) result.push({ key: "fountain", label: "Fountain" });
    if (p.has_waterfall) result.push({ key: "waterfall", label: "Waterfall" });
    return result.length ? result : [{ key: "pool", label: "Pool" }];
  }, [poolRecord]);

  const hasIntelliChem = useMemo(
    () => (location?.automation_systems ?? []).includes("intellichem"),
    [location?.automation_systems]
  );

  const canStart = !!visit && visit.status !== "completed" && !visit.started_at;
  const canFinish =
    !!visit &&
    visit.status !== "completed" &&
    !!visit.started_at &&
    stop?.status !== "completed" &&
    stop?.status !== "skipped";
  const canSkip = !!visit && !!stop && stop.status !== "completed" && stop.status !== "skipped";

  const isClosedStop = stop?.status === "completed" || stop?.status === "skipped";
  const fieldsDisabled = isClosedStop && !editCompleted;

  const checklistSorted = useMemo(
    () =>
      [...checklistItems].sort(
        (a, b) =>
          (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
          (techLang === "es" ? a.name_es || a.name : a.name).localeCompare(
            techLang === "es" ? b.name_es || b.name : b.name
          )
      ),
    [checklistItems, techLang]
  );

  const readingSorted = useMemo(
    () =>
      [...readingTypes].sort(
        (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name)
      ),
    [readingTypes]
  );

  const chemSorted = useMemo(
    () =>
      [...chemicalProducts].sort(
        (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name)
      ),
    [chemicalProducts]
  );

  const techNameById = useMemo(() => new Map(techs.map((t) => [t.id, t.full_name ?? t.id])), [techs]);

  async function loadTechLanguage() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("profiles").select("id,preferred_language").eq("id", uid).single();
      setTechLang((data as any)?.preferred_language === "es" ? "es" : "en");
    } catch {
      setTechLang("en");
    }
  }

  async function loadTechs() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,role,is_active")
      .eq("role", "tech")
      .eq("is_active", true)
      .order("full_name");
    if (error) {
      console.warn(error.message);
      setTechs([]);
      return;
    }
    setTechs((data ?? []) as Tech[]);
  }

  const getOrCreateVisit = useCallback(async (): Promise<Visit> => {
    const { data: existing, error: existingErr } = await supabase
      .from("service_visits")
      .select("*")
      .eq("route_stop_id", stopId)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing) return existing as Visit;

    const { data: created, error: createErr } = await supabase
      .from("service_visits")
      .insert({ route_stop_id: stopId })
      .select("*")
      .single();
    if (!createErr && created) return created as Visit;

    const { data: retry, error: retryErr } = await supabase
      .from("service_visits")
      .select("*")
      .eq("route_stop_id", stopId)
      .single();
    if (retryErr) throw new Error(createErr?.message ?? retryErr.message);
    return retry as Visit;
  }, [stopId]);

  async function loadNextPendingStopPreview(currentStop: RouteStop) {
    setNextStop(null);
    setIsLastPending(false);

    const { count } = await supabase
      .from("route_stops")
      .select("id", { count: "exact", head: true })
      .eq("route_day_id", currentStop.route_day_id)
      .eq("status", "pending")
      .neq("id", currentStop.id);

    if ((count ?? 0) === 0 && currentStop.status !== "completed") setIsLastPending(true);

    const { data: forward } = await supabase
      .from("route_stops")
      .select("id,stop_order,status,location_id")
      .eq("route_day_id", currentStop.route_day_id)
      .eq("status", "pending")
      .gt("stop_order", currentStop.stop_order)
      .order("stop_order")
      .limit(1)
      .maybeSingle();

    let next: any = forward;
    if (!next) {
      const { data: wrap } = await supabase
        .from("route_stops")
        .select("id,stop_order,status,location_id")
        .eq("route_day_id", currentStop.route_day_id)
        .eq("status", "pending")
        .neq("id", currentStop.id)
        .order("stop_order")
        .limit(1)
        .maybeSingle();
      next = wrap;
    }
    if (!next) return;

    const { data: loc } = await supabase
      .from("locations")
      .select("address_line1,city,state,zip")
      .eq("id", next.location_id)
      .single();

    setNextStop({
      id: next.id,
      stop_order: next.stop_order,
      status: next.status,
      address: loc ? formatAddr(loc as any) : String(next.location_id),
    });
  }

  async function loadItemsAndWorkOrders(visitId: string) {
    const [itemsRes, woRes] = await Promise.all([
      supabase.from("visit_items_needed").select("*").eq("visit_id", visitId).order("created_at", { ascending: false }),
      supabase.from("work_orders").select("*").eq("visit_id", visitId).order("created_at", { ascending: false }),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (woRes.error) throw new Error(woRes.error.message);
    setItemsNeeded((itemsRes.data ?? []) as ItemNeeded[]);
    setWorkOrders((woRes.data ?? []) as WorkOrder[]);
  }

  function initializeItemStates(
    serviceItemKeys: ServiceItemType[],
    checklistCatalog: ChecklistItem[],
    readingCatalog: ReadingType[],
    chemCatalog: ChemicalProduct[]
  ) {
    const nextChecklist = emptyChecklistState();
    const nextReadings = emptyReadingState();
    const nextChems = emptyChemicalState();
    const nextNotes = emptyItemNotesState();

    serviceItemKeys.forEach((itemKey) => {
      checklistCatalog.forEach((x) => {
        nextChecklist[itemKey][x.id] = { done: false, note: "" };
      });
      readingCatalog.forEach((x) => {
        nextReadings[itemKey][x.id] = "";
      });
      chemCatalog.forEach((x) => {
        nextChems[itemKey][x.id] = { qty: "", unit: x.default_unit ?? "" };
      });
      nextNotes[itemKey] = "";
    });

    return { nextChecklist, nextReadings, nextChems, nextNotes };
  }

  const loadAll = useCallback(async () => {
    if (!stopId || !looksLikeUuid(stopId)) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: stopData, error: stopErr } = await supabase
      .from("route_stops")
      .select("id,route_day_id,location_id,stop_order,status,completed_at,work_order_id")
      .eq("id", stopId)
      .single();
    if (stopErr) throw new Error(stopErr.message);
    const stopRow = stopData as RouteStop;
    setStop(stopRow);
    if (stopRow.status !== "completed" && stopRow.status !== "skipped") {
      setEditCompleted(false);
    }

    const { data: routeDayData, error: routeDayErr } = await supabase
      .from("route_days")
      .select("service_date")
      .eq("id", stopRow.route_day_id)
      .single();
    setRouteDate(routeDayErr ? null : (routeDayData as any)?.service_date ?? null);

    const { data: locData, error: locErr } = await supabase
      .from("locations")
      .select("id,customer_id,address_line1,city,state,zip,gate_code,key_location,service_notes,automation_systems")
      .eq("id", stopRow.location_id)
      .single();
    if (locErr) throw new Error(locErr.message);
    setLocation(locData as Location);

    const { data: poolData, error: poolErr } = await supabase
      .from("pools")
      .select("id,location_id,has_pool,has_spa,has_water_feature,has_fountain,has_waterfall")
      .eq("location_id", stopRow.location_id)
      .maybeSingle();
    if (poolErr) console.warn(poolErr.message);
    setPoolRecord((poolData as PoolRecord | null) ?? null);

    const effectivePool = (poolData as PoolRecord | null) ?? null;
    const serviceItemKeys: ServiceItemType[] = [];
    if (!effectivePool) serviceItemKeys.push("pool");
    else {
      if (effectivePool.has_pool) serviceItemKeys.push("pool");
      if (effectivePool.has_spa) serviceItemKeys.push("spa");
      if (effectivePool.has_water_feature) serviceItemKeys.push("water_feature");
      if (effectivePool.has_fountain) serviceItemKeys.push("fountain");
      if (effectivePool.has_waterfall) serviceItemKeys.push("waterfall");
      if (!serviceItemKeys.length) serviceItemKeys.push("pool");
    }

    const { data: settingData, error: settingErr } = await supabase
      .from("service_settings")
      .select("id")
      .eq("location_id", stopRow.location_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (settingErr) console.warn(settingErr.message);
    setServiceSettingId((settingData as any)?.id ?? null);

    const checklistAttempt = await supabase
      .from("checklist_items")
      .select("id,name,name_es,sort_order")
      .order("sort_order")
      .order("name");
    let checklistCatalog: ChecklistItem[] = [];
    if (checklistAttempt.error) {
      const fallback = await supabase.from("checklist_items").select("id,name,sort_order").order("sort_order").order("name");
      if (fallback.error) throw new Error(fallback.error.message);
      checklistCatalog = (fallback.data ?? []) as ChecklistItem[];
    } else checklistCatalog = (checklistAttempt.data ?? []) as ChecklistItem[];

    const [readingRes, chemRes] = await Promise.all([
      supabase.from("reading_types").select("id,name,unit,sort_order").order("sort_order").order("name"),
      supabase.from("chemical_products").select("id,name,default_unit,sort_order").order("sort_order").order("name"),
    ]);
    if (readingRes.error) throw new Error(readingRes.error.message);
    if (chemRes.error) throw new Error(chemRes.error.message);
    const readingCatalog = (readingRes.data ?? []) as ReadingType[];
    const chemCatalog = (chemRes.data ?? []) as ChemicalProduct[];
    setChecklistItems(checklistCatalog);
    setReadingTypes(readingCatalog);
    setChemicalProducts(chemCatalog);

    const visitRow = await getOrCreateVisit();
    setVisit(visitRow);
    setMinutesOnSite(visitRow.minutes_on_site !== null ? String(visitRow.minutes_on_site) : "");
    setProblems(visitRow.problems ?? "");
    setGeneralNotes(visitRow.general_notes ?? "");

    const [vcRes, vrRes, vchemRes] = await Promise.all([
      supabase.from("visit_checklist").select("service_item_type,checklist_item_id,done,note").eq("visit_id", visitRow.id),
      supabase.from("visit_readings").select("service_item_type,reading_type_id,value").eq("visit_id", visitRow.id),
      supabase.from("visit_chemicals").select("service_item_type,chemical_product_id,qty,unit").eq("visit_id", visitRow.id),
    ]);
    if (vcRes.error) throw new Error(vcRes.error.message);
    if (vrRes.error) throw new Error(vrRes.error.message);
    if (vchemRes.error) throw new Error(vchemRes.error.message);

    const { nextChecklist, nextReadings, nextChems, nextNotes } = initializeItemStates(
      serviceItemKeys,
      checklistCatalog,
      readingCatalog,
      chemCatalog
    );

    (vcRes.data ?? []).forEach((row: any) => {
      const itemKey = (row.service_item_type ?? "pool") as ServiceItemType;
      if (!nextChecklist[itemKey]) return;
      nextChecklist[itemKey][row.checklist_item_id] = { done: !!row.done, note: row.note ?? "" };
    });
    (vrRes.data ?? []).forEach((row: any) => {
      const itemKey = (row.service_item_type ?? "pool") as ServiceItemType;
      if (!nextReadings[itemKey]) return;
      nextReadings[itemKey][row.reading_type_id] = row.value === null || row.value === undefined ? "" : String(row.value);
    });
    (vchemRes.data ?? []).forEach((row: any) => {
      const itemKey = (row.service_item_type ?? "pool") as ServiceItemType;
      if (!nextChems[itemKey]) return;
      nextChems[itemKey][row.chemical_product_id] = {
        qty: row.qty === null || row.qty === undefined ? "" : String(row.qty),
        unit: row.unit ?? nextChems[itemKey][row.chemical_product_id]?.unit ?? "",
      };
    });

    setChecklist(nextChecklist);
    setReadings(nextReadings);
    setChems(nextChems);
    setItemNotes(nextNotes);
    await loadItemsAndWorkOrders(visitRow.id);
    await loadNextPendingStopPreview(stopRow);
    setLoading(false);
  }, [getOrCreateVisit, stopId]);

  async function startVisit() {
    try {
      const v = await getOrCreateVisit();
      if (v.status === "completed") return toast.info("This visit is completed.");
      if (v.started_at) return toast.info("Visit already started.");

      const { error: visitErr } = await supabase
        .from("service_visits")
        .update({ started_at: nowIso(), status: "in_progress" })
        .eq("id", v.id);
      if (visitErr) throw new Error(visitErr.message);

      if (stop?.id && stop.status === "pending") {
        const { error: stopErr } = await supabase.from("route_stops").update({ status: "in_progress" }).eq("id", stop.id);
        if (stopErr) throw new Error(stopErr.message);
      }

      await loadAll();
      toast.success("Started ✅");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start");
    }
  }

  async function saveAll(showSuccess = true): Promise<boolean> {
    try {
      const v = await getOrCreateVisit();
      setSaving(true);
      const mins = parseNumberOrNull(minutesOnSite);
      if (minutesOnSite.trim() !== "" && mins === null) {
        toast.error("Minutes must be a number.");
        return false;
      }
      const itemKeys = serviceItems.map((x) => x.key);
      const readingRows = itemKeys.flatMap((itemKey) =>
        Object.entries(readings[itemKey] ?? {}).map(([reading_type_id, value]) => ({
          visit_id: v.id,
          service_item_type: itemKey,
          reading_type_id,
          value: value.trim() === "" ? null : Number(value),
        }))
      );
      const chemRows = itemKeys.flatMap((itemKey) =>
        Object.entries(chems[itemKey] ?? {}).map(([chemical_product_id, value]) => ({
          visit_id: v.id,
          service_item_type: itemKey,
          chemical_product_id,
          qty: value.qty.trim() === "" ? null : Number(value.qty),
          unit: value.unit.trim() || null,
        }))
      );
      const checklistRows = itemKeys.flatMap((itemKey) =>
        Object.entries(checklist[itemKey] ?? {}).map(([checklist_item_id, value]) => ({
          visit_id: v.id,
          service_item_type: itemKey,
          checklist_item_id,
          done: !!value.done,
          note: value.note.trim() || null,
        }))
      );
      for (const r of readingRows) {
        if (r.value !== null && Number.isNaN(r.value)) {
          toast.error("One reading is not a number.");
          return false;
        }
      }
      for (const c of chemRows) {
        if (c.qty !== null && Number.isNaN(c.qty)) {
          toast.error("One chemical quantity is not a number.");
          return false;
        }
      }
      const itemNotesText = itemKeys
        .map((itemKey) => {
          const text = itemNotes[itemKey]?.trim();
          return text ? `${SERVICE_ITEM_LABELS[itemKey]}: ${text}` : null;
        })
        .filter(Boolean)
        .join(" | ");
      const combinedNotes = [generalNotes.trim(), itemNotesText].filter(Boolean).join("\n");

      const { error: visitErr } = await supabase
        .from("service_visits")
        .update({ minutes_on_site: mins, general_notes: combinedNotes || null, problems: problems.trim() || null })
        .eq("id", v.id);
      if (visitErr) throw new Error(visitErr.message);

      const { error: checkErr } = await supabase.from("visit_checklist").upsert(checklistRows, {
        onConflict: "visit_id,service_item_type,checklist_item_id",
      });
      if (checkErr) throw new Error(checkErr.message);

      const { error: readingErr } = await supabase.from("visit_readings").upsert(readingRows, {
        onConflict: "visit_id,service_item_type,reading_type_id",
      });
      if (readingErr) throw new Error(readingErr.message);

      const { error: chemErr } = await supabase.from("visit_chemicals").upsert(chemRows, {
        onConflict: "visit_id,service_item_type,chemical_product_id",
      });
      if (chemErr) throw new Error(chemErr.message);

      if (showSuccess) {
        await loadAll();
        toast.success("Saved ✅");
      }
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finishVisitAndCompleteStop(): Promise<boolean> {
    try {
      const saved = await saveAll(false);
      if (!saved) return false;
      const v = await getOrCreateVisit();
      if (v.status === "completed") {
        toast.info("Already completed.");
        return false;
      }
      if (!v.started_at) {
        toast.info("Please click Start before finishing this stop.");
        return false;
      }
      const now = nowIso();
      const manualMinutes = parseNumberOrNull(minutesOnSite);
      const minutes = manualMinutes !== null ? manualMinutes : Math.max(0, Math.round((new Date(now).getTime() - new Date(v.started_at).getTime()) / 60000));

      const { error: visitErr } = await supabase
        .from("service_visits")
        .update({ finished_at: now, minutes_on_site: minutes, status: "completed" })
        .eq("id", v.id);
      if (visitErr) throw new Error(visitErr.message);

      const { error: stopErr } = await supabase
        .from("route_stops")
        .update({ status: "completed", completed_at: now })
        .eq("id", stopId);
      if (stopErr) throw new Error(stopErr.message);

      if (stop?.route_day_id) {
        await supabase.rpc("auto_complete_route_day", { p_route_day_id: stop.route_day_id });
      }
      await loadAll();
      toast.success(`Completed ✅ (${minutes} min)`);
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to complete");
      return false;
    }
  }

  async function getNextPendingStopId(currentStop: RouteStop) {
    const { data: forward } = await supabase
      .from("route_stops")
      .select("id")
      .eq("route_day_id", currentStop.route_day_id)
      .eq("status", "pending")
      .gt("stop_order", currentStop.stop_order)
      .order("stop_order")
      .limit(1)
      .maybeSingle();
    if (forward?.id) return forward.id as string;
    const { data: wrap } = await supabase
      .from("route_stops")
      .select("id")
      .eq("route_day_id", currentStop.route_day_id)
      .eq("status", "pending")
      .neq("id", currentStop.id)
      .order("stop_order")
      .limit(1)
      .maybeSingle();
    return wrap?.id ? (wrap.id as string) : null;
  }

  async function goToNextPendingStop() {
    if (!stop) {
      router.push("/routes");
      return;
    }
    const nextId = await getNextPendingStopId(stop);
    if (nextId) router.push(`/stops/${nextId}?routeDayId=${stop.route_day_id}`);
    else router.push(`/routes?routeDayId=${stop.route_day_id}`);
  }

  async function finishCompleteAndNext() {
    const ok = await finishVisitAndCompleteStop();
    if (ok) await goToNextPendingStop();
  }

  async function skipVisitAndNext() {
    if (!stop || !location || !visit) return;
    if (!window.confirm(`Skip this visit?\n\nReason: ${skipReason}`)) return;
    try {
      const saved = await saveAll(false);
      if (!saved) return;
      if (serviceSettingId && routeDate) {
        const { error: exErr } = await supabase.from("service_exceptions").insert({
          service_setting_id: serviceSettingId,
          location_id: stop.location_id,
          exception_date: routeDate,
          action: "skip",
          reason: skipReason,
        });
        if (exErr) throw new Error(exErr.message);
      }
      const now = nowIso();
      const { error: stopErr } = await supabase
        .from("route_stops")
        .update({ status: "skipped", completed_at: now })
        .eq("id", stop.id);
      if (stopErr) throw new Error(stopErr.message);

      const { error: visitErr } = await supabase
        .from("service_visits")
        .update({ status: "skipped", finished_at: now, problems: [problems.trim(), `Skipped: ${skipReason}`].filter(Boolean).join(" | ") })
        .eq("id", visit.id);
      if (visitErr) throw new Error(visitErr.message);

      if (stop.route_day_id) {
        await supabase.rpc("auto_complete_route_day", { p_route_day_id: stop.route_day_id });
      }
      toast.success("Visit skipped ✅");
      await goToNextPendingStop();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to skip visit");
    }
  }

  async function addItemNeeded(itemType: ItemNeeded["item_type"]) {
    if (!visit || !stop || !location) return;
    const name = window.prompt(`Add ${itemType}:`);
    if (!name?.trim()) return;
    const qtyText = window.prompt("Quantity:", "1");
    if (qtyText === null) return;
    const unit = window.prompt("Unit:", itemType === "chemical" ? "gal/lbs/tablets" : "each");
    if (unit === null) return;
    const notes = window.prompt("Notes:", "");
    if (notes === null) return;
    const qty = parseNumberOrNull(qtyText);
    const { error } = await supabase.from("visit_items_needed").insert({
      visit_id: visit.id,
      route_stop_id: stop.id,
      location_id: location.id,
      item_type: itemType,
      item_name: name.trim(),
      quantity: qty,
      unit: unit.trim() || null,
      notes: notes.trim() || null,
      status: "needed",
    });
    if (error) return toast.error(error.message);
    toast.success("Item added ✅");
    await loadItemsAndWorkOrders(visit.id);
  }

  async function updateItemStatus(item: ItemNeeded, status: ItemNeeded["status"]) {
    if (!visit) return;
    const { error } = await supabase.from("visit_items_needed").update({ status }).eq("id", item.id);
    if (error) return toast.error(error.message);
    await loadItemsAndWorkOrders(visit.id);
  }

  async function deleteItem(item: ItemNeeded) {
    if (!visit) return;
    if (!window.confirm(`Delete item: ${item.item_name}?`)) return;
    const { error } = await supabase.from("visit_items_needed").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    await loadItemsAndWorkOrders(visit.id);
  }

  async function createScheduledWorkOrder() {
    if (!visit || !stop || !location) return;
    if (!workOrderForm.title.trim()) return toast.info("Work order title is required.");
    if (!workOrderForm.description.trim()) return toast.info("Description of work is required.");
    if (!workOrderForm.assigned_tech_id) return toast.info("Assign a technician.");
    if (!workOrderForm.scheduled_date) return toast.info("Scheduled date is required.");
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          customer_id: location.customer_id ?? null,
          location_id: location.id,
          visit_id: visit.id,
          route_stop_id: stop.id,
          work_order_type: workOrderForm.work_order_type,
          title: workOrderForm.title.trim(),
          description: workOrderForm.description.trim(),
          notes: workOrderForm.notes.trim() || null,
          material_notes: workOrderForm.material_notes.trim() || null,
          status: "open",
          priority: workOrderForm.priority,
          scheduled_date: workOrderForm.scheduled_date,
          assigned_tech_id: workOrderForm.assigned_tech_id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const workOrderId = (data as any).id as string;
      const { error: scheduleErr } = await supabase.rpc("schedule_work_order_route_stop", { p_work_order_id: workOrderId });
      if (scheduleErr) throw new Error(scheduleErr.message);
      setWorkOrderForm(DEFAULT_WORK_ORDER_FORM);
      toast.success("Work order scheduled and added to route ✅");
      await loadItemsAndWorkOrders(visit.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to schedule work order");
    } finally {
      setSaving(false);
    }
  }

  async function updateWorkOrderStatus(order: WorkOrder, status: WorkOrder["status"]) {
    if (!visit) return;
    const payload: Partial<WorkOrder> = { status };
    if (status === "completed") payload.completed_at = nowIso();
    const { error } = await supabase.from("work_orders").update(payload).eq("id", order.id);
    if (error) return toast.error(error.message);
    await loadItemsAndWorkOrders(visit.id);
  }

  async function deleteWorkOrder(order: WorkOrder) {
    if (!visit) return;
    if (!window.confirm(`Delete work order: ${order.title}?`)) return;
    const { error } = await supabase.from("work_orders").delete().eq("id", order.id);
    if (error) return toast.error(error.message);
    await loadItemsAndWorkOrders(visit.id);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadTechLanguage();
        await loadTechs();
        await loadAll();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load stop");
        setLoading(false);
      }
    })();
  }, [loadAll]);

  if (!stopId || !looksLikeUuid(stopId)) {
    return (
      <main className="p-8">
        <p className="text-red-600">Invalid stop id.</p>
        <Link className="underline" href="/routes">Back to Routes</Link>
      </main>
    );
  }

  if (loading) return <main className="p-8">Loading…</main>;

  return (
    <main className="p-8 pb-24">
      <div className="flex justify-between items-start gap-6">
        <div>
          <h1 className="text-2xl font-bold">Service Stop</h1>
          <p className="text-sm text-gray-600 mt-1">{location ? formatAddr(location) : ""}</p>
          <p className="text-xs text-gray-500 mt-2">Stop status: <b>{stop?.status}</b></p>
          <p className="text-xs text-gray-500 mt-1">
            Visit: <b>{visit?.status ?? "—"}</b>
            {visit?.started_at ? ` • started ${new Date(visit.started_at).toLocaleString()}` : ""}
            {visit?.finished_at ? ` • finished ${new Date(visit.finished_at).toLocaleString()}` : ""}
          </p>
          {hasIntelliChem ? <p className="text-xs text-blue-700 mt-1">IntelliChem detected — record IntelliChem pH and ORP readings.</p> : null}
          {location?.gate_code || location?.key_location ? (
            <p className="text-sm mt-2"><b>Access:</b> {location.gate_code ? `Gate: ${location.gate_code}` : ""}{location.gate_code && location.key_location ? " • " : ""}{location.key_location ? `Key: ${location.key_location}` : ""}</p>
          ) : null}
          {location?.service_notes ? <p className="text-sm mt-2"><b>Service notes:</b> {location.service_notes}</p> : null}
        </div>

        <div className="flex gap-4">
          <Link className="underline" href={backToRoutesHref}>Routes</Link>
          <Link className="underline" href="/locations">Locations</Link>
          <Link className="underline" href="/customers">Customers</Link>
          <Link className="underline" href="/reference/chemistry">Chemistry</Link>
        </div>
      </div>

      <section className="mt-6 border rounded p-4">
        <h2 className="font-semibold">Visit Summary</h2>
        <div className="flex flex-wrap gap-3 mt-3">
          <button className="rounded border px-4 py-2 disabled:opacity-50" onClick={() => void startVisit()} disabled={isClosedStop || !canStart}>Start</button>
          <button className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" onClick={() => void finishCompleteAndNext()} disabled={isClosedStop || !canFinish || (!nextStop && !isLastPending)}>Finish + Next</button>
          <button className="rounded border border-red-300 text-red-700 px-4 py-2 disabled:opacity-50" onClick={() => void skipVisitAndNext()} disabled={isClosedStop || !canSkip || saving}>Skip Visit</button>
          <button className="rounded border px-4 py-2 disabled:opacity-50" onClick={() => void goToNextPendingStop()} disabled={saving}>Next / Back to Routes</button>
        </div>

        {isClosedStop ? (
          <div className="mt-3 flex flex-wrap gap-3 rounded border bg-amber-50 border-amber-200 p-3">
            {!editCompleted ? (
              <>
                <div className="text-sm text-amber-900 w-full">
                  This stop is closed. Open edit mode to correct readings, chemicals, checklist, or notes.
                </div>
                <button
                  className="rounded border bg-white px-4 py-2"
                  onClick={() => setEditCompleted(true)}
                >
                  Edit Completed Stop
                </button>
              </>
            ) : (
              <>
                <div className="text-sm text-amber-900 w-full">
                  Editing corrections. This will not reopen the route stop.
                </div>
                <button
                  className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
                  onClick={async () => {
                    const ok = await saveAll(false);
                    if (ok) {
                      setEditCompleted(false);
                      toast.success("Corrections saved ✅");
                      await loadAll();
                    }
                  }}
                  disabled={saving}
                >
                  Save Corrections
                </button>
                <button
                  className="rounded border bg-white px-4 py-2 disabled:opacity-50"
                  onClick={() => {
                    setEditCompleted(false);
                    void loadAll();
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        ) : null}
        <div className="mt-3 max-w-md">
          <label className="text-sm">Skip Reason</label>
          <select className="mt-1 w-full border rounded p-2" value={skipReason} onChange={(e) => setSkipReason(e.target.value)}>
            {SKIP_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
        </div>
        <div className="mt-4 rounded border bg-gray-50 p-3">
          <div className="text-xs text-gray-600">Next pending stop</div>
          {nextStop ? <div className="mt-1 text-sm">#{nextStop.stop_order} — {nextStop.address}</div> : isLastPending ? <div className="mt-1 text-sm text-indigo-700">This is the last pending stop.</div> : <div className="mt-1 text-sm text-green-700">No pending stops left.</div>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="text-sm">Minutes on site</label>
            <input className="mt-1 w-full border rounded p-2" value={minutesOnSite} onChange={(e) => setMinutesOnSite(e.target.value)} inputMode="numeric" disabled={fieldsDisabled} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Problems</label>
            <input className="mt-1 w-full border rounded p-2" value={problems} onChange={(e) => setProblems(e.target.value)} placeholder="Leak, Algae, Low water..." disabled={fieldsDisabled} />
          </div>
        </div>
        <label className="text-sm mt-3 block">General Notes</label>
        <textarea className="mt-1 w-full border rounded p-2" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} disabled={fieldsDisabled} />
      </section>

      {serviceItems.map((serviceItem) => (
        <section key={serviceItem.key} className="mt-6 border rounded p-4">
          <h2 className="text-lg font-semibold">{serviceItem.label}</h2>
          <div className="mt-4 border rounded p-3">
            <h3 className="font-semibold">Readings — {serviceItem.label}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {readingSorted.map((r) => (
                <div key={r.id}>
                  <label className="text-sm">{r.name} {r.unit ? `(${r.unit})` : ""}</label>
                  <input className="mt-1 w-full border rounded p-2" value={readings[serviceItem.key]?.[r.id] ?? ""} onChange={(e) => setReadings((prev) => ({ ...prev, [serviceItem.key]: { ...(prev[serviceItem.key] ?? {}), [r.id]: e.target.value } }))} inputMode="decimal" disabled={fieldsDisabled} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 border rounded p-3">
            <h3 className="font-semibold">Chemicals Added — {serviceItem.label}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {chemSorted.map((c) => (
                <div key={c.id} className="border rounded p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input className="border rounded p-2" placeholder="Qty" value={chems[serviceItem.key]?.[c.id]?.qty ?? ""} onChange={(e) => setChems((prev) => ({ ...prev, [serviceItem.key]: { ...(prev[serviceItem.key] ?? {}), [c.id]: { ...(prev[serviceItem.key]?.[c.id] ?? { qty: "", unit: c.default_unit }), qty: e.target.value } } }))} inputMode="decimal" disabled={fieldsDisabled} />
                    <input className="border rounded p-2" placeholder="Unit" value={chems[serviceItem.key]?.[c.id]?.unit ?? c.default_unit} onChange={(e) => setChems((prev) => ({ ...prev, [serviceItem.key]: { ...(prev[serviceItem.key] ?? {}), [c.id]: { ...(prev[serviceItem.key]?.[c.id] ?? { qty: "", unit: c.default_unit }), unit: e.target.value } } }))} disabled={fieldsDisabled} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 border rounded p-3">
            <h3 className="font-semibold">Checklist — {serviceItem.label}</h3>
            <div className="mt-3 space-y-2">
              {checklistSorted.map((item) => (
                <div key={item.id} className="border rounded p-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!checklist[serviceItem.key]?.[item.id]?.done} onChange={(e) => setChecklist((prev) => ({ ...prev, [serviceItem.key]: { ...(prev[serviceItem.key] ?? {}), [item.id]: { ...(prev[serviceItem.key]?.[item.id] ?? { done: false, note: "" }), done: e.target.checked } } }))} disabled={fieldsDisabled} />
                    <span className="font-medium">{techLang === "es" ? item.name_es || item.name : item.name}</span>
                  </label>
                  <input className="mt-2 w-full border rounded p-2 text-sm" placeholder={`Optional note for ${serviceItem.label}`} value={checklist[serviceItem.key]?.[item.id]?.note ?? ""} onChange={(e) => setChecklist((prev) => ({ ...prev, [serviceItem.key]: { ...(prev[serviceItem.key] ?? {}), [item.id]: { ...(prev[serviceItem.key]?.[item.id] ?? { done: false, note: "" }), note: e.target.value } } }))} disabled={fieldsDisabled} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 border rounded p-3">
            <h3 className="font-semibold">Notes — {serviceItem.label}</h3>
            <textarea className="mt-2 w-full border rounded p-2" value={itemNotes[serviceItem.key] ?? ""} onChange={(e) => setItemNotes((prev) => ({ ...prev, [serviceItem.key]: e.target.value }))} placeholder={`Notes for ${serviceItem.label}`} disabled={fieldsDisabled} />
          </div>
        </section>
      ))}

      <section className="mt-6 border rounded p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Items Needed</h2>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border px-3 py-1 text-sm" onClick={() => void addItemNeeded("product")}>Add Product</button>
            <button className="rounded border px-3 py-1 text-sm" onClick={() => void addItemNeeded("part")}>Add Part</button>
            <button className="rounded border px-3 py-1 text-sm" onClick={() => void addItemNeeded("chemical")}>Add Chemical</button>
            <button className="rounded border px-3 py-1 text-sm" onClick={() => void addItemNeeded("other")}>Add Other</button>
          </div>
        </div>
        {itemsNeeded.length === 0 ? <p className="mt-3 text-sm text-gray-600">No items needed.</p> : (
          <ul className="mt-3 space-y-2">
            {itemsNeeded.map((item) => (
              <li key={item.id} className="border rounded p-3">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-medium">{item.item_type.toUpperCase()}: {item.item_name}</div>
                    <div className="text-xs text-gray-600">Qty: {item.quantity ?? "-"} {item.unit ?? ""} • Status: {item.status}</div>
                    {item.notes ? <div className="text-sm mt-1">{item.notes}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button className="underline" onClick={() => void updateItemStatus(item, "ordered")}>Ordered</button>
                    <button className="underline" onClick={() => void updateItemStatus(item, "completed")}>Done</button>
                    <button className="underline text-red-600" onClick={() => void deleteItem(item)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 border rounded p-4">
        <h2 className="font-semibold">Create Work Order</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div>
            <label className="text-sm">Type</label>
            <select className="mt-1 w-full border rounded p-2" value={workOrderForm.work_order_type} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, work_order_type: e.target.value as WorkOrderForm["work_order_type"] }))}>
              <option value="service_visit">Service Visit</option>
              <option value="repair">Repair</option>
              <option value="equipment_installation">Equipment Installation</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Scheduled Date</label>
            <input type="date" className="mt-1 w-full border rounded p-2" value={workOrderForm.scheduled_date} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, scheduled_date: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm">Assigned Tech</label>
            <select className="mt-1 w-full border rounded p-2" value={workOrderForm.assigned_tech_id} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, assigned_tech_id: e.target.value }))}>
              <option value="">Select tech…</option>
              {techs.map((tech) => <option key={tech.id} value={tech.id}>{tech.full_name ?? tech.id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm">Priority</label>
            <select className="mt-1 w-full border rounded p-2" value={workOrderForm.priority} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, priority: e.target.value as WorkOrderForm["priority"] }))}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Title</label>
            <input className="mt-1 w-full border rounded p-2" value={workOrderForm.title} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Example: Replace pump seal" />
          </div>
          <div className="md:col-span-3">
            <label className="text-sm">Description of Work</label>
            <textarea className="mt-1 w-full border rounded p-2" value={workOrderForm.description} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe what needs to be done..." />
          </div>
          <div className="md:col-span-3">
            <label className="text-sm">Materials / Parts Needed</label>
            <textarea className="mt-1 w-full border rounded p-2" value={workOrderForm.material_notes} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, material_notes: e.target.value }))} placeholder="Parts, products, chemicals, equipment needed..." />
          </div>
          <div className="md:col-span-3">
            <label className="text-sm">Internal Notes</label>
            <textarea className="mt-1 w-full border rounded p-2" value={workOrderForm.notes} onChange={(e) => setWorkOrderForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional notes..." />
          </div>
          <div className="md:col-span-3">
            <button className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" onClick={() => void createScheduledWorkOrder()} disabled={saving}>{saving ? "Scheduling…" : "Create + Add to Route"}</button>
          </div>
        </div>
      </section>

      <section className="mt-6 border rounded p-4">
        <h2 className="font-semibold">Work Orders</h2>
        {workOrders.length === 0 ? <p className="mt-3 text-sm text-gray-600">No work orders.</p> : (
          <ul className="mt-3 space-y-2">
            {workOrders.map((wo) => (
              <li key={wo.id} className="border rounded p-3">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-medium">{wo.work_order_type.replaceAll("_", " ").toUpperCase()}: {wo.title}</div>
                    <div className="text-xs text-gray-600">Status: {wo.status} • Priority: {wo.priority}{wo.scheduled_date ? ` • Scheduled: ${wo.scheduled_date}` : ""}{wo.assigned_tech_id ? ` • Tech: ${techNameById.get(wo.assigned_tech_id) ?? wo.assigned_tech_id}` : ""}</div>
                    {wo.description ? <div className="text-sm mt-1">{wo.description}</div> : null}
                    {wo.material_notes ? <div className="text-sm mt-1"><b>Materials:</b> {wo.material_notes}</div> : null}
                    {wo.route_day_id ? <div className="mt-2 text-xs"><Link className="underline" href={`/routes?routeDayId=${wo.route_day_id}`}>View scheduled route →</Link></div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button className="underline" onClick={() => void updateWorkOrderStatus(wo, "in_progress")}>Start</button>
                    <button className="underline" onClick={() => void updateWorkOrderStatus(wo, "completed")}>Complete</button>
                    <button className="underline text-red-600" onClick={() => void deleteWorkOrder(wo)}>Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 text-xs text-gray-500">Visit ID: {visit?.id ?? "—"}</div>
    </main>
  );
}
