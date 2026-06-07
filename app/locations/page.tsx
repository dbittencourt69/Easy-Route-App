"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type Customer = {
  id: string;
  name: string;
  company_name: string | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
};

type Tech = { id: string; full_name: string | null };

type PoolType = "residential" | "commercial";
type CommercialType = "condo" | "hotel" | "club";
type AutomationSystem =
  | "intellichem"
  | "intelliconnect"
  | "autopilot"
  | "intellicenter"
  | "aqualink"
  | "other";

type ServiceFrequency =
  | "weekly_1"
  | "weekly_2"
  | "weekly_3"
  | "weekly_4"
  | "weekdays"
  | "weekends"
  | "biweekly";

type ServiceType = "full" | "chemical_only";

type LocationRow = {
  id: string;
  customer_id: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  gate_code: string | null;
  key_location: string | null;
  service_notes: string | null;
  location_notes: string | null;
  pool_type: PoolType | null;
  commercial_type: CommercialType | null;
  automation_systems: AutomationSystem[] | null;
  automation_other: string | null;
};

type PoolRow = {
  id: string;
  location_id: string;
  gallons: number | null;
  surface_type: string | null;
  has_pool: boolean;
  has_spa: boolean;
  has_water_feature: boolean;
  has_fountain: boolean;
  has_waterfall?: boolean | null;
};

type LocationEquipment = {
  id: string;
  location_id: string;
  filter_model: string | null;
  pump_model: string | null;
  motor_speed: string | null;
  salt_system_model: string | null;
  heater_model: string | null;
  other_equipment: string | null;
};

type ServiceSettingRow = {
  id: string;
  customer_id: string;
  location_id: string;
  day_of_week: number | null;
  frequency: ServiceFrequency;
  service_type: ServiceType;
  default_tech_id: string | null;
  is_active: boolean;
  estimated_minutes_at_stop: number | null;
  start_date?: string | null;
};

type ServiceScheduleDayRow = {
  id: string;
  service_setting_id: string;
  day_of_week: number;
};

type FormState = {
  customerId: string;
  sameAsBilling: boolean;
  manualAddress: { address1: string; city: string; state: string; zip: string } | null;

  address1: string;
  city: string;
  state: string;
  zip: string;

  gateCode: string;
  keyLocation: string;
  serviceNotes: string;
  locationNotes: string;

  poolType: PoolType;
  commercialType: CommercialType | "";
  automationSystems: AutomationSystem[];
  automationOther: string;

  filterModel: string;
  pumpModel: string;
  motorSpeed: string;
  saltSystemModel: string;
  heaterModel: string;
  otherEquipment: string;

  gallons: string;
  surfaceType: string;
  hasPool: boolean;
  hasSpa: boolean;
  hasWaterFeature: boolean;
  hasFountain: boolean;
  hasWaterfall: boolean;

  frequency: ServiceFrequency;
  selectedServiceDays: number[];
  serviceType: ServiceType;
  defaultTechId: string;
  estimatedMinutesAtStop: string;
};

const DOW = [
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
  { v: 7, label: "Sun" },
];

const AUTOMATION_OPTIONS: { value: AutomationSystem; label: string }[] = [
  { value: "intellichem", label: "IntelliChem" },
  { value: "intelliconnect", label: "IntelliConnect" },
  { value: "autopilot", label: "Auto Pilot" },
  { value: "intellicenter", label: "IntelliCenter" },
  { value: "aqualink", label: "AquaLink" },
  { value: "other", label: "Other Automation System" },
];

const FREQ_REQ: Record<ServiceFrequency, number | "auto"> = {
  weekly_1: 1,
  weekly_2: 2,
  weekly_3: 3,
  weekly_4: 4,
  weekdays: "auto",
  weekends: "auto",
  biweekly: 1,
};

function DEFAULT_FORM(customerId = ""): FormState {
  return {
    customerId,
    sameAsBilling: false,
    manualAddress: null,

    address1: "",
    city: "",
    state: "FL",
    zip: "",

    gateCode: "",
    keyLocation: "",
    serviceNotes: "",
    locationNotes: "",

    poolType: "residential",
    commercialType: "",
    automationSystems: [],
    automationOther: "",

    filterModel: "",
    pumpModel: "",
    motorSpeed: "",
    saltSystemModel: "",
    heaterModel: "",
    otherEquipment: "",

    gallons: "",
    surfaceType: "",
    hasPool: true,
    hasSpa: false,
    hasWaterFeature: false,
    hasFountain: false,
    hasWaterfall: false,

    frequency: "weekly_1",
    selectedServiceDays: [],
    serviceType: "full",
    defaultTechId: "",
    estimatedMinutesAtStop: "30",
  };
}

function clean(value: string) {
  return value.trim();
}

function parseIntOrNull(value: string) {
  const t = clean(value);
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeDays(frequency: ServiceFrequency, selected: number[]) {
  if (frequency === "weekdays") return [1, 2, 3, 4, 5];
  if (frequency === "weekends") return [6, 7];

  const req = FREQ_REQ[frequency];
  const unique = [...new Set(selected)].sort((a, b) => a - b);
  return req === "auto" ? unique : unique.slice(0, req);
}

function frequencyLabel(frequency?: ServiceFrequency | null) {
  if (frequency === "weekly_1") return "1x/week";
  if (frequency === "weekly_2") return "2x/week";
  if (frequency === "weekly_3") return "3x/week";
  if (frequency === "weekly_4") return "4x/week";
  if (frequency === "weekdays") return "Weekdays";
  if (frequency === "weekends") return "Weekends";
  if (frequency === "biweekly") return "Biweekly";
  return "-";
}

function scheduleHint(frequency: ServiceFrequency) {
  if (frequency === "weekly_1") return "Select exactly 1 service day.";
  if (frequency === "weekly_2") return "Select exactly 2 service days.";
  if (frequency === "weekly_3") return "Select exactly 3 service days.";
  if (frequency === "weekly_4") return "Select exactly 4 service days.";
  if (frequency === "biweekly") return "Select 1 service day, every other week.";
  if (frequency === "weekdays") return "Auto-selected: Monday to Friday.";
  if (frequency === "weekends") return "Auto-selected: Saturday and Sunday.";
  return "";
}

function LocationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerFilterId = searchParams.get("customerId") ?? "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [settings, setSettings] = useState<ServiceSettingRow[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ServiceScheduleDayRow[]>([]);
  const [equipment, setEquipment] = useState<LocationEquipment[]>([]);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM(customerFilterId));
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM());
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editPoolId, setEditPoolId] = useState<string | null>(null);
  const [editEquipmentId, setEditEquipmentId] = useState<string | null>(null);
  const [editSettingId, setEditSettingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customerId) ?? null,
    [customers, form.customerId]
  );

  const customerNameById = useMemo(() => {
    return new Map(customers.map((c) => [c.id, c.company_name ? `${c.company_name} — ${c.name}` : c.name]));
  }, [customers]);

  const poolByLocation = useMemo(() => {
    const m = new Map<string, PoolRow>();
    pools.forEach((p) => m.set(p.location_id, p));
    return m;
  }, [pools]);

  const equipmentByLocation = useMemo(() => {
    const m = new Map<string, LocationEquipment>();
    equipment.forEach((e) => m.set(e.location_id, e));
    return m;
  }, [equipment]);

  const settingByLocation = useMemo(() => {
    const m = new Map<string, ServiceSettingRow>();
    settings.forEach((s) => {
      if (s.is_active) m.set(s.location_id, s);
    });
    return m;
  }, [settings]);

  const daysBySetting = useMemo(() => {
    const m = new Map<string, number[]>();
    scheduleDays.forEach((row) => {
      const existing = m.get(row.service_setting_id) ?? [];
      existing.push(row.day_of_week);
      m.set(row.service_setting_id, existing);
    });

    for (const [key, days] of m.entries()) {
      m.set(key, [...new Set(days)].sort((a, b) => a - b));
    }

    return m;
  }, [scheduleDays]);

  function showNotice(type: "success" | "error" | "info", text: string) {
    setNotice({ type, text });
    if (type !== "error") window.setTimeout(() => setNotice(null), 3500);
  }

  async function loadAll() {
    setLoading(true);
    setNotice(null);

    try {
      const [customerRes, techRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id,name,company_name,billing_address_line1,billing_city,billing_state,billing_zip")
          .order("name"),
        supabase.from("profiles").select("id,full_name").eq("role", "tech").eq("is_active", true).order("full_name"),
      ]);

      if (customerRes.error) throw new Error(customerRes.error.message);
      if (techRes.error) throw new Error(techRes.error.message);

      setCustomers((customerRes.data ?? []) as Customer[]);
      setTechs((techRes.data ?? []) as Tech[]);

      let locQuery = supabase
        .from("locations")
        .select("id,customer_id,address_line1,city,state,zip,gate_code,key_location,service_notes,location_notes,pool_type,commercial_type,automation_systems,automation_other")
        .order("city")
        .order("address_line1");

      if (customerFilterId) locQuery = locQuery.eq("customer_id", customerFilterId);

      const { data: locRows, error: locErr } = await locQuery;
      if (locErr) throw new Error(locErr.message);

      const locationRows = (locRows ?? []) as LocationRow[];
      setLocations(locationRows);

      const locIds = locationRows.map((x) => x.id);
      if (!locIds.length) {
        setPools([]);
        setEquipment([]);
        setSettings([]);
        setScheduleDays([]);
        setLoading(false);
        return;
      }

      const [poolRes, equipRes, settingRes] = await Promise.all([
        supabase
          .from("pools")
          .select("id,location_id,gallons,surface_type,has_pool,has_spa,has_water_feature,has_fountain,has_waterfall")
          .in("location_id", locIds),
        supabase
          .from("location_equipment")
          .select("id,location_id,filter_model,pump_model,motor_speed,salt_system_model,heater_model,other_equipment")
          .in("location_id", locIds),
        supabase
          .from("service_settings")
          .select("id,customer_id,location_id,day_of_week,frequency,service_type,default_tech_id,is_active,estimated_minutes_at_stop,start_date")
          .in("location_id", locIds),
      ]);

      if (poolRes.error) throw new Error(poolRes.error.message);
      if (equipRes.error) throw new Error(equipRes.error.message);
      if (settingRes.error) throw new Error(settingRes.error.message);

      setPools((poolRes.data ?? []) as PoolRow[]);
      setEquipment((equipRes.data ?? []) as LocationEquipment[]);
      setSettings((settingRes.data ?? []) as ServiceSettingRow[]);

      const settingIds = (settingRes.data ?? []).map((x: any) => x.id);
      if (!settingIds.length) {
        setScheduleDays([]);
      } else {
        const { data: dayRows, error: dayErr } = await supabase
          .from("service_schedule_days")
          .select("id,service_setting_id,day_of_week")
          .in("service_setting_id", settingIds);

        if (dayErr) throw new Error(dayErr.message);
        setScheduleDays((dayRows ?? []) as ServiceScheduleDayRow[]);
      }
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setForm(DEFAULT_FORM(customerFilterId));
  }, [customerFilterId]);

  useEffect(() => {
    void loadAll();
  }, [customerFilterId]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      selectedServiceDays: normalizeDays(prev.frequency, prev.selectedServiceDays),
    }));
  }, [form.frequency]);

  useEffect(() => {
    setEditForm((prev) => ({
      ...prev,
      selectedServiceDays: normalizeDays(prev.frequency, prev.selectedServiceDays),
    }));
  }, [editForm.frequency]);

  function toggleSameAsBilling(next: boolean) {
    setForm((prev) => {
      if (next) {
        return {
          ...prev,
          sameAsBilling: true,
          manualAddress: { address1: prev.address1, city: prev.city, state: prev.state, zip: prev.zip },
          address1: selectedCustomer?.billing_address_line1 ?? "",
          city: selectedCustomer?.billing_city ?? "",
          state: selectedCustomer?.billing_state ?? "FL",
          zip: selectedCustomer?.billing_zip ?? "",
        };
      }

      return {
        ...prev,
        sameAsBilling: false,
        address1: prev.manualAddress?.address1 ?? "",
        city: prev.manualAddress?.city ?? "",
        state: prev.manualAddress?.state ?? "FL",
        zip: prev.manualAddress?.zip ?? "",
        manualAddress: null,
      };
    });
  }

  function toggleDay(values: FormState, day: number) {
    if (values.frequency === "weekdays" || values.frequency === "weekends") {
      return normalizeDays(values.frequency, values.selectedServiceDays);
    }

    const req = FREQ_REQ[values.frequency];
    if (req === "auto") return values.selectedServiceDays;

    const exists = values.selectedServiceDays.includes(day);
    if (exists) return values.selectedServiceDays.filter((d) => d !== day).sort((a, b) => a - b);
    if (values.selectedServiceDays.length >= req) return values.selectedServiceDays;
    return [...values.selectedServiceDays, day].sort((a, b) => a - b);
  }

  function validate(values: FormState) {
    if (!values.customerId) return "Select a customer.";
    if (!clean(values.address1) || !clean(values.city) || !clean(values.state) || !clean(values.zip)) {
      return "Service address is required.";
    }
    if (values.poolType === "commercial" && !values.commercialType) {
      return "Select commercial type.";
    }
    if (values.automationSystems.includes("other") && !clean(values.automationOther)) {
      return "Specify the other automation system.";
    }

    const days = normalizeDays(values.frequency, values.selectedServiceDays);
    const req = FREQ_REQ[values.frequency];
    if (req !== "auto" && days.length !== req) {
      return `Please select exactly ${req} service day${req > 1 ? "s" : ""}.`;
    }

    const est = parseIntOrNull(values.estimatedMinutesAtStop);
    if (est !== null && (est < 0 || est > 480)) {
      return "Estimated minutes must be between 0 and 480.";
    }

    return null;
  }

  async function saveLocation(mode: "create" | "edit", locationId?: string) {
    const values = mode === "create" ? form : editForm;
    const validation = validate(values);
    if (validation) {
      showNotice("info", validation);
      return;
    }

    setBusy(true);

    try {
      const days = normalizeDays(values.frequency, values.selectedServiceDays);
      const primaryDay = days[0] ?? null;
      const est = parseIntOrNull(values.estimatedMinutesAtStop);

      let savedLocationId = locationId ?? "";

      const locationPayload = {
        customer_id: values.customerId,
        address_line1: clean(values.address1),
        city: clean(values.city),
        state: clean(values.state),
        zip: clean(values.zip),
        gate_code: clean(values.gateCode) || null,
        key_location: clean(values.keyLocation) || null,
        service_notes: clean(values.serviceNotes) || null,
        location_notes: clean(values.locationNotes) || null,
        pool_type: values.poolType,
        commercial_type: values.poolType === "commercial" ? values.commercialType || null : null,
        automation_systems: values.automationSystems,
        automation_other: values.automationSystems.includes("other") ? clean(values.automationOther) || null : null,
      };

      if (mode === "create") {
        const { data, error } = await supabase.from("locations").insert(locationPayload).select("id").single();
        if (error) throw new Error(error.message);
        savedLocationId = (data as any).id;
      } else {
        const { error } = await supabase.from("locations").update(locationPayload).eq("id", savedLocationId);
        if (error) throw new Error(error.message);
      }

      const poolPayload = {
        location_id: savedLocationId,
        gallons: clean(values.gallons) ? Number(values.gallons) : null,
        surface_type: clean(values.surfaceType) || null,
        has_pool: values.hasPool,
        has_spa: values.hasSpa,
        has_water_feature: values.hasWaterFeature,
        has_fountain: values.hasFountain,
        has_waterfall: values.hasWaterfall,
      };

      if (mode === "create") {
        const { error } = await supabase.from("pools").insert(poolPayload);
        if (error) throw new Error(error.message);
      } else if (editPoolId) {
        const { error } = await supabase.from("pools").update(poolPayload).eq("id", editPoolId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("pools").insert(poolPayload).select("id").single();
        if (error) throw new Error(error.message);
        setEditPoolId((data as any).id);
      }

      let serviceSettingId = mode === "edit" ? editSettingId : null;

      const settingPayload = {
        customer_id: values.customerId,
        location_id: savedLocationId,
        day_of_week: primaryDay,
        frequency: values.frequency,
        service_type: values.serviceType,
        default_tech_id: values.defaultTechId || null,
        is_active: true,
        estimated_minutes_at_stop: est,
      };

      if (serviceSettingId) {
        const { error } = await supabase.from("service_settings").update(settingPayload).eq("id", serviceSettingId);
        if (error) throw new Error(error.message);

        const { error: delErr } = await supabase.from("service_schedule_days").delete().eq("service_setting_id", serviceSettingId);
        if (delErr) throw new Error(delErr.message);
      } else {
        const { data, error } = await supabase
          .from("service_settings")
          .insert({ ...settingPayload, start_date: new Date().toISOString().slice(0, 10) })
          .select("id")
          .single();

        if (error) throw new Error(error.message);
        serviceSettingId = (data as any).id;
      }

      if (serviceSettingId && days.length) {
        const { error } = await supabase.from("service_schedule_days").insert(
          days.map((day) => ({ service_setting_id: serviceSettingId, day_of_week: day }))
        );
        if (error) throw new Error(`Service days save failed: ${error.message}`);
      }

      const anyEquipment =
        clean(values.filterModel) ||
        clean(values.pumpModel) ||
        clean(values.motorSpeed) ||
        clean(values.saltSystemModel) ||
        clean(values.heaterModel) ||
        clean(values.otherEquipment);

      const equipmentPayload = {
        location_id: savedLocationId,
        filter_model: clean(values.filterModel) || null,
        pump_model: clean(values.pumpModel) || null,
        motor_speed: clean(values.motorSpeed) || null,
        salt_system_model: clean(values.saltSystemModel) || null,
        heater_model: clean(values.heaterModel) || null,
        other_equipment: clean(values.otherEquipment) || null,
      };

      if (mode === "edit" && editEquipmentId) {
        const { error } = await supabase.from("location_equipment").update(equipmentPayload).eq("id", editEquipmentId);
        if (error) throw new Error(error.message);
      } else if (anyEquipment) {
        const { error } = await supabase.from("location_equipment").insert(equipmentPayload);
        if (error) throw new Error(error.message);
      }

      if (mode === "create") {
        setForm(DEFAULT_FORM(customerFilterId));
        showNotice("success", "Location created ✅");
      } else {
        cancelEdit();
        showNotice("success", "Location updated ✅");
      }

      await loadAll();
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to save location");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(location: LocationRow) {
    const p = poolByLocation.get(location.id);
    const eq = equipmentByLocation.get(location.id);
    const s = settingByLocation.get(location.id);
    const days = s ? daysBySetting.get(s.id) ?? [] : [];

    setEditingLocationId(location.id);
    setEditPoolId(p?.id ?? null);
    setEditEquipmentId(eq?.id ?? null);
    setEditSettingId(s?.id ?? null);

    setEditForm({
      customerId: location.customer_id,
      sameAsBilling: false,
      manualAddress: null,

      address1: location.address_line1,
      city: location.city,
      state: location.state,
      zip: location.zip,

      gateCode: location.gate_code ?? "",
      keyLocation: location.key_location ?? "",
      serviceNotes: location.service_notes ?? "",
      locationNotes: location.location_notes ?? "",

      poolType: location.pool_type ?? "residential",
      commercialType: location.commercial_type ?? "",
      automationSystems: location.automation_systems ?? [],
      automationOther: location.automation_other ?? "",

      filterModel: eq?.filter_model ?? "",
      pumpModel: eq?.pump_model ?? "",
      motorSpeed: eq?.motor_speed ?? "",
      saltSystemModel: eq?.salt_system_model ?? "",
      heaterModel: eq?.heater_model ?? "",
      otherEquipment: eq?.other_equipment ?? "",

      gallons: p?.gallons != null ? String(p.gallons) : "",
      surfaceType: p?.surface_type ?? "",
      hasPool: p?.has_pool ?? true,
      hasSpa: p?.has_spa ?? false,
      hasWaterFeature: p?.has_water_feature ?? false,
      hasFountain: p?.has_fountain ?? false,
      hasWaterfall: p?.has_waterfall ?? false,

      frequency: s?.frequency ?? "weekly_1",
      selectedServiceDays: days,
      serviceType: s?.service_type ?? "full",
      defaultTechId: s?.default_tech_id ?? "",
      estimatedMinutesAtStop: String(s?.estimated_minutes_at_stop ?? 30),
    });
  }

  function cancelEdit() {
    setEditingLocationId(null);
    setEditForm(DEFAULT_FORM());
    setEditPoolId(null);
    setEditEquipmentId(null);
    setEditSettingId(null);
  }

  async function deleteLocation(locationId: string) {
    if (!window.confirm("Delete this location and related schedule/pool/equipment data?")) return;

    setBusy(true);

    try {
      const setting = settingByLocation.get(locationId);
      if (setting?.id) {
        await supabase.from("service_schedule_days").delete().eq("service_setting_id", setting.id);
        await supabase.from("service_exceptions").delete().eq("service_setting_id", setting.id);
      }

      await supabase.from("route_stops").delete().eq("location_id", locationId);
      await supabase.from("service_settings").delete().eq("location_id", locationId);
      await supabase.from("pools").delete().eq("location_id", locationId);
      await supabase.from("location_equipment").delete().eq("location_id", locationId);

      const { error } = await supabase.from("locations").delete().eq("id", locationId);
      if (error) throw new Error(error.message);

      if (editingLocationId === locationId) cancelEdit();
      await loadAll();
      showNotice("success", "Location deleted ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to delete location");
    } finally {
      setBusy(false);
    }
  }

  function daysSummary(setting?: ServiceSettingRow) {
    if (!setting) return "-";
    const days = daysBySetting.get(setting.id) ?? [];
    if (!days.length && setting.day_of_week) {
      return DOW.find((d) => d.v === setting.day_of_week)?.label ?? "-";
    }
    return days.map((d) => DOW.find((x) => x.v === d)?.label ?? String(d)).join(", ");
  }

  function equipmentSummary(eq?: LocationEquipment) {
    if (!eq) return "-";
    const parts = [
      eq.filter_model ? `Filter: ${eq.filter_model}` : null,
      eq.pump_model ? `Pump: ${eq.pump_model}` : null,
      eq.salt_system_model ? `Salt: ${eq.salt_system_model}` : null,
      eq.heater_model ? `Heater: ${eq.heater_model}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" • ") : eq.other_equipment || "-";
  }

  function renderForm(values: FormState, setValues: React.Dispatch<React.SetStateAction<FormState>>, mode: "create" | "edit", onSubmit: () => void, onCancel?: () => void) {
    const autoDays = values.frequency === "weekdays" || values.frequency === "weekends";

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="text-sm">Customer *</label>
            <select
              className="mt-1 w-full border rounded p-2"
              value={values.customerId}
              onChange={(e) => setValues((prev) => ({ ...prev, customerId: e.target.value }))}
              disabled={busy}
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name ? `${c.company_name} — ${c.name}` : c.name}
                </option>
              ))}
            </select>

            {mode === "create" ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="sameAsBilling"
                  type="checkbox"
                  checked={values.sameAsBilling}
                  onChange={(e) => toggleSameAsBilling(e.target.checked)}
                  disabled={!values.customerId || busy}
                />
                <label htmlFor="sameAsBilling" className="text-sm">
                  Same as customer billing address
                </label>
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Change customer to move this location.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm">Default Tech</label>
            <select
              className="mt-1 w-full border rounded p-2"
              value={values.defaultTechId}
              onChange={(e) => setValues((prev) => ({ ...prev, defaultTechId: e.target.value }))}
              disabled={busy}
            >
              <option value="">(none)</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name ?? t.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Service Address *</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={values.address1}
              onChange={(e) => setValues((prev) => ({ ...prev, address1: e.target.value }))}
              disabled={busy || (mode === "create" && values.sameAsBilling)}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-sm">City *</label>
              <input className="mt-1 w-full border rounded p-2" value={values.city} onChange={(e) => setValues((prev) => ({ ...prev, city: e.target.value }))} disabled={busy || (mode === "create" && values.sameAsBilling)} />
            </div>
            <div>
              <label className="text-sm">State *</label>
              <input className="mt-1 w-full border rounded p-2" value={values.state} onChange={(e) => setValues((prev) => ({ ...prev, state: e.target.value }))} disabled={busy || (mode === "create" && values.sameAsBilling)} />
            </div>
            <div>
              <label className="text-sm">ZIP *</label>
              <input className="mt-1 w-full border rounded p-2" value={values.zip} onChange={(e) => setValues((prev) => ({ ...prev, zip: e.target.value }))} disabled={busy || (mode === "create" && values.sameAsBilling)} />
            </div>
          </div>

          <div>
            <label className="text-sm">Gate Code</label>
            <input className="mt-1 w-full border rounded p-2" value={values.gateCode} onChange={(e) => setValues((prev) => ({ ...prev, gateCode: e.target.value }))} disabled={busy} />
          </div>

          <div>
            <label className="text-sm">Key Location</label>
            <input className="mt-1 w-full border rounded p-2" value={values.keyLocation} onChange={(e) => setValues((prev) => ({ ...prev, keyLocation: e.target.value }))} disabled={busy} />
          </div>

          <div>
            <label className="text-sm">Location Notes</label>
            <textarea className="mt-1 w-full border rounded p-2" value={values.locationNotes} onChange={(e) => setValues((prev) => ({ ...prev, locationNotes: e.target.value }))} disabled={busy} />
          </div>

          <div>
            <label className="text-sm">Service Notes (Tech)</label>
            <textarea className="mt-1 w-full border rounded p-2" value={values.serviceNotes} onChange={(e) => setValues((prev) => ({ ...prev, serviceNotes: e.target.value }))} disabled={busy} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="border rounded p-3">
            <h3 className="font-semibold">Pool Info</h3>

            <label className="text-sm mt-3 block">Pool Type *</label>
            <select className="mt-1 w-full border rounded p-2" value={values.poolType} onChange={(e) => setValues((prev) => ({ ...prev, poolType: e.target.value as PoolType, commercialType: e.target.value === "commercial" ? prev.commercialType : "" }))} disabled={busy}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>

            {values.poolType === "commercial" ? (
              <>
                <label className="text-sm mt-3 block">Commercial Type *</label>
                <select className="mt-1 w-full border rounded p-2" value={values.commercialType} onChange={(e) => setValues((prev) => ({ ...prev, commercialType: e.target.value as CommercialType }))} disabled={busy}>
                  <option value="">Select…</option>
                  <option value="condo">Condo</option>
                  <option value="hotel">Hotel</option>
                  <option value="club">Club</option>
                </select>
              </>
            ) : null}

            <label className="text-sm mt-3 block">Gallons</label>
            <input className="mt-1 w-full border rounded p-2" value={values.gallons} onChange={(e) => setValues((prev) => ({ ...prev, gallons: e.target.value }))} inputMode="numeric" disabled={busy} />

            <label className="text-sm mt-3 block">Surface Type</label>
            <input className="mt-1 w-full border rounded p-2" value={values.surfaceType} onChange={(e) => setValues((prev) => ({ ...prev, surfaceType: e.target.value }))} disabled={busy} />

            <div className="mt-3 space-y-2">
              {[
                ["hasPool", "Pool"],
                ["hasSpa", "Spa"],
                ["hasWaterFeature", "Water Feature"],
                ["hasFountain", "Fountain"],
                ["hasWaterfall", "Waterfall"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean((values as any)[key])}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.checked } as FormState))}
                    disabled={busy}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="border rounded p-3">
            <h3 className="font-semibold">Automation</h3>

            <div className="mt-3 space-y-2">
              {AUTOMATION_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={values.automationSystems.includes(opt.value)}
                    onChange={() =>
                      setValues((prev) => {
                        const exists = prev.automationSystems.includes(opt.value);
                        const next = exists
                          ? prev.automationSystems.filter((x) => x !== opt.value)
                          : [...prev.automationSystems, opt.value];
                        return { ...prev, automationSystems: next, automationOther: next.includes("other") ? prev.automationOther : "" };
                      })
                    }
                    disabled={busy}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {values.automationSystems.includes("other") ? (
              <>
                <label className="text-sm mt-3 block">Other *</label>
                <input className="mt-1 w-full border rounded p-2" value={values.automationOther} onChange={(e) => setValues((prev) => ({ ...prev, automationOther: e.target.value }))} disabled={busy} />
              </>
            ) : null}
          </div>

          <div className="border rounded p-3">
            <h3 className="font-semibold">Equipment</h3>
            {[
              ["filterModel", "Filter model"],
              ["pumpModel", "Pump model"],
              ["motorSpeed", "Motor speed"],
              ["saltSystemModel", "Salt system model"],
              ["heaterModel", "Heater model"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-sm mt-3 block">{label}</label>
                <input className="mt-1 w-full border rounded p-2" value={(values as any)[key]} onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value } as FormState))} disabled={busy} />
              </div>
            ))}
            <label className="text-sm mt-3 block">Other</label>
            <textarea className="mt-1 w-full border rounded p-2" value={values.otherEquipment} onChange={(e) => setValues((prev) => ({ ...prev, otherEquipment: e.target.value }))} disabled={busy} />
          </div>

          <div className="border rounded p-3">
            <h3 className="font-semibold">Service Schedule</h3>

            <p className="mt-2 text-xs text-gray-600">
              Primary Day was removed. Route generation now uses the selected Service Days below.
            </p>

            <label className="text-sm mt-3 block">Frequency</label>
            <select
              className="mt-1 w-full border rounded p-2"
              value={values.frequency}
              onChange={(e) => setValues((prev) => ({ ...prev, frequency: e.target.value as ServiceFrequency }))}
              disabled={busy}
            >
              <option value="weekly_1">1 time a week</option>
              <option value="weekly_2">2 times a week</option>
              <option value="weekly_3">3 times a week</option>
              <option value="weekly_4">4 times a week</option>
              <option value="weekdays">Every weekday</option>
              <option value="weekends">Weekends</option>
              <option value="biweekly">Every other week</option>
            </select>

            <label className="text-sm mt-3 block">Service Days</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {DOW.map((d) => {
                const checked = values.selectedServiceDays.includes(d.v);
                return (
                  <label key={d.v} className={`flex items-center gap-2 rounded border p-2 text-sm ${checked ? "bg-blue-50 border-blue-300" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy || autoDays}
                      onChange={() =>
                        setValues((prev) => ({
                          ...prev,
                          selectedServiceDays: toggleDay(prev, d.v),
                        }))
                      }
                    />
                    {d.label}
                  </label>
                );
              })}
            </div>

            <p className="mt-1 text-xs text-gray-500">{scheduleHint(values.frequency)}</p>

            <label className="text-sm mt-3 block">Service Type</label>
            <select className="mt-1 w-full border rounded p-2" value={values.serviceType} onChange={(e) => setValues((prev) => ({ ...prev, serviceType: e.target.value as ServiceType }))} disabled={busy}>
              <option value="full">Full service</option>
              <option value="chemical_only">Chemicals only</option>
            </select>
          </div>

          <div className="border rounded p-3">
            <h3 className="font-semibold">ETA</h3>

            <label className="text-sm mt-3 block">Estimated minutes</label>
            <input className="mt-1 w-full border rounded p-2" value={values.estimatedMinutesAtStop} onChange={(e) => setValues((prev) => ({ ...prev, estimatedMinutesAtStop: e.target.value }))} inputMode="numeric" disabled={busy} />

            <div className="mt-4 flex gap-3">
              <button className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" onClick={onSubmit} disabled={busy}>
                {busy ? "Saving…" : mode === "create" ? "Add Location" : "Save"}
              </button>

              {onCancel ? (
                <button className="rounded border px-4 py-2 disabled:opacity-50" onClick={onCancel} disabled={busy}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Locations</h1>

        <div className="flex gap-4 text-sm">
          <Link className="underline" href="/">Home</Link>
          <Link className="underline" href="/customers">Customers</Link>
          <Link className="underline" href="/routes">Routes</Link>
          <Link className="underline" href="/techs">Techs</Link>
        </div>
      </div>

      {customerFilterId ? (
        <div className="mt-4 rounded border bg-blue-50 border-blue-200 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-blue-900">
              Managing locations for: <b>{customerNameById.get(customerFilterId) ?? customerFilterId}</b>
            </div>
            <button className="rounded border bg-white px-3 py-2 text-sm" onClick={() => router.push("/locations")} disabled={busy}>
              Show all locations
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className={`mt-4 rounded border p-3 text-sm ${
          notice.type === "success" ? "bg-green-50 border-green-200 text-green-800" :
          notice.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
          "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          {notice.text}
        </div>
      ) : null}

      <section className="mt-8 border rounded p-4">
        <h2 className="font-semibold">
          {customerFilterId ? "Add location for this customer" : "Add service location"}
        </h2>

        {renderForm(form, setForm, "create", () => void saveLocation("create"))}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-3">
          {customerFilterId ? "Customer Location List" : "Location List"}
        </h2>

        {loading ? (
          <p>Loading…</p>
        ) : locations.length === 0 ? (
          <p className="text-gray-600">No locations yet.</p>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => {
              const isEditing = editingLocationId === location.id;
              const pool = poolByLocation.get(location.id);
              const eq = equipmentByLocation.get(location.id);
              const setting = settingByLocation.get(location.id);

              const poolFlags = [
                pool?.has_pool ? "Pool" : null,
                pool?.has_spa ? "Spa" : null,
                pool?.has_water_feature ? "Water Feature" : null,
                pool?.has_fountain ? "Fountain" : null,
                pool?.has_waterfall ? "Waterfall" : null,
              ].filter(Boolean);

              return (
                <div key={location.id} className="border rounded p-4">
                  {!isEditing ? (
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {customerNameById.get(location.customer_id) ?? location.customer_id}
                        </div>

                        <div className="mt-1 text-sm text-gray-700">
                          {location.address_line1}, {location.city} {location.state} {location.zip}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Pool: {poolFlags.length ? poolFlags.join(", ") : "-"}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Schedule: {daysSummary(setting)} • {frequencyLabel(setting?.frequency)} • {setting?.service_type === "chemical_only" ? "Chemicals only" : "Full"}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Tech: {techs.find((t) => t.id === setting?.default_tech_id)?.full_name ?? "-"} • Est: {setting?.estimated_minutes_at_stop ?? 30} min
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Equipment: {equipmentSummary(eq)}
                        </div>

                        {location.service_notes ? (
                          <div className="mt-1 text-sm text-gray-600">
                            Service Notes: {location.service_notes}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="underline"
                          onClick={() => startEdit(location)}
                          disabled={busy}
                        >
                          Edit
                        </button>

                        {location.automation_systems?.includes("intellichem") ? (
                          <Link
                            className="underline text-blue-700"
                            href={`/locations/${location.id}/intellichem`}
                          >
                            IntelliChem
                          </Link>
                        ) : null}

                        <button
                          type="button"
                          className="underline text-red-600"
                          onClick={() => void deleteLocation(location.id)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-semibold">Edit Location</h3>
                      {renderForm(editForm, setEditForm, "edit", () => void saveLocation("edit", location.id), cancelEdit)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
export default function LocationsPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading locations…</main>}>
      <LocationsPageContent />
    </Suspense>
  );
}
