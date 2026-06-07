"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type PhControlType = "acid" | "co2" | "other";

type SettingRow = {
  id: string;
  location_id: string;
  ph_setpoint: number | null;
  ph_dose_method: string | null;
  ph_dose_value: number | null;
  ph_dose_unit: string | null;
  ph_limit_value: number | null;
  ph_limit_unit: string | null;
  ph_clear_limit: string | null;
  ph_mix_time_minutes: number | null;
  ph_notes: string | null;
  orp_setpoint: number | null;
  orp_dose_method: string | null;
  orp_dose_value: number | null;
  orp_dose_unit: string | null;
  orp_limit_value: number | null;
  orp_limit_unit: string | null;
  orp_clear_limit: string | null;
  orp_notes: string | null;
  tank_acid_capacity: number | null;
  tank_sanitizer_capacity: number | null;
  tank_unit: string | null;
  ph_control_type: PhControlType | null;
  co2_tank_capacity: number | null;
  co2_tank_unit: string | null;
  co2_notes: string | null;
  has_uv_system: boolean;
  uv_cylinder_count: number | null;
  uv_notes: string | null;
  general_notes: string | null;
};

type LocationRow = {
  id: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string | null;
};

type FormState = {
  phSetpoint: string;
  phDoseMethod: string;
  phDoseValue: string;
  phDoseUnit: string;
  phLimitValue: string;
  phLimitUnit: string;
  phClearLimit: string;
  phMixTimeMinutes: string;
  phNotes: string;
  orpSetpoint: string;
  orpDoseMethod: string;
  orpDoseValue: string;
  orpDoseUnit: string;
  orpLimitValue: string;
  orpLimitUnit: string;
  orpClearLimit: string;
  orpNotes: string;
  phControlType: PhControlType;
  acidTankCapacity: string;
  tankUnit: string;
  co2TankCapacity: string;
  co2TankUnit: string;
  co2Notes: string;
  tankSanitizerCapacity: string;
  hasUvSystem: boolean;
  uvCylinderCount: string;
  uvNotes: string;
  generalNotes: string;
};

const DEFAULT_FORM: FormState = {
  phSetpoint: "7.5",
  phDoseMethod: "time",
  phDoseValue: "",
  phDoseUnit: "",
  phLimitValue: "",
  phLimitUnit: "",
  phClearLimit: "24 hours",
  phMixTimeMinutes: "",
  phNotes: "",
  orpSetpoint: "700",
  orpDoseMethod: "time",
  orpDoseValue: "",
  orpDoseUnit: "",
  orpLimitValue: "",
  orpLimitUnit: "",
  orpClearLimit: "24 hours",
  orpNotes: "",
  phControlType: "co2",
  acidTankCapacity: "",
  tankUnit: "gallons",
  co2TankCapacity: "",
  co2TankUnit: "tanks",
  co2Notes: "",
  tankSanitizerCapacity: "",
  hasUvSystem: false,
  uvCylinderCount: "2",
  uvNotes: "",
  generalNotes: "",
};

function n(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function s(value: string) {
  return value.trim() || null;
}

function formatAddress(location: LocationRow | null) {
  if (!location) return "";
  return `${location.address_line1}, ${location.city} ${location.state} ${location.zip ?? ""}`.trim();
}

export default function IntelliChemSettingsPage() {
  const params = useParams<{ locationId: string }>();
  const locationId = params.locationId;

  const [location, setLocation] = useState<LocationRow | null>(null);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  function showNotice(type: "success" | "error" | "info", text: string) {
    setNotice({ type, text });
    if (type !== "error") window.setTimeout(() => setNotice(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const { data: locData, error: locErr } = await supabase
        .from("locations")
        .select("id,address_line1,city,state,zip")
        .eq("id", locationId)
        .single();
      if (locErr) throw new Error(locErr.message);
      setLocation(locData as LocationRow);

      const { data, error } = await supabase
        .from("location_intellichem_settings")
        .select("*")
        .eq("location_id", locationId)
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (!data) {
        setSettingId(null);
        setForm(DEFAULT_FORM);
      } else {
        const row = data as SettingRow;
        setSettingId(row.id);
        setForm({
          phSetpoint: row.ph_setpoint != null ? String(row.ph_setpoint) : "",
          phDoseMethod: row.ph_dose_method ?? "time",
          phDoseValue: row.ph_dose_value != null ? String(row.ph_dose_value) : "",
          phDoseUnit: row.ph_dose_unit ?? "",
          phLimitValue: row.ph_limit_value != null ? String(row.ph_limit_value) : "",
          phLimitUnit: row.ph_limit_unit ?? "",
          phClearLimit: row.ph_clear_limit ?? "",
          phMixTimeMinutes: row.ph_mix_time_minutes != null ? String(row.ph_mix_time_minutes) : "",
          phNotes: row.ph_notes ?? "",
          orpSetpoint: row.orp_setpoint != null ? String(row.orp_setpoint) : "",
          orpDoseMethod: row.orp_dose_method ?? "time",
          orpDoseValue: row.orp_dose_value != null ? String(row.orp_dose_value) : "",
          orpDoseUnit: row.orp_dose_unit ?? "",
          orpLimitValue: row.orp_limit_value != null ? String(row.orp_limit_value) : "",
          orpLimitUnit: row.orp_limit_unit ?? "",
          orpClearLimit: row.orp_clear_limit ?? "",
          orpNotes: row.orp_notes ?? "",
          phControlType: row.ph_control_type ?? "co2",
          acidTankCapacity: row.tank_acid_capacity != null ? String(row.tank_acid_capacity) : "",
          tankUnit: row.tank_unit ?? "gallons",
          co2TankCapacity: row.co2_tank_capacity != null ? String(row.co2_tank_capacity) : "",
          co2TankUnit: row.co2_tank_unit ?? "tanks",
          co2Notes: row.co2_notes ?? "",
          tankSanitizerCapacity: row.tank_sanitizer_capacity != null ? String(row.tank_sanitizer_capacity) : "",
          hasUvSystem: !!row.has_uv_system,
          uvCylinderCount: row.uv_cylinder_count != null ? String(row.uv_cylinder_count) : "",
          uvNotes: row.uv_notes ?? "",
          generalNotes: row.general_notes ?? "",
        });
      }
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to load automation settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const payload = {
        location_id: locationId,
        ph_setpoint: n(form.phSetpoint),
        ph_dose_method: s(form.phDoseMethod),
        ph_dose_value: n(form.phDoseValue),
        ph_dose_unit: s(form.phDoseUnit),
        ph_limit_value: n(form.phLimitValue),
        ph_limit_unit: s(form.phLimitUnit),
        ph_clear_limit: s(form.phClearLimit),
        ph_mix_time_minutes: n(form.phMixTimeMinutes),
        ph_notes: s(form.phNotes),
        orp_setpoint: n(form.orpSetpoint),
        orp_dose_method: s(form.orpDoseMethod),
        orp_dose_value: n(form.orpDoseValue),
        orp_dose_unit: s(form.orpDoseUnit),
        orp_limit_value: n(form.orpLimitValue),
        orp_limit_unit: s(form.orpLimitUnit),
        orp_clear_limit: s(form.orpClearLimit),
        orp_notes: s(form.orpNotes),
        ph_control_type: form.phControlType,
        tank_acid_capacity: form.phControlType === "acid" ? n(form.acidTankCapacity) : null,
        tank_unit: s(form.tankUnit),
        co2_tank_capacity: form.phControlType === "co2" ? n(form.co2TankCapacity) : null,
        co2_tank_unit: form.phControlType === "co2" ? s(form.co2TankUnit) : null,
        co2_notes: form.phControlType === "co2" ? s(form.co2Notes) : null,
        tank_sanitizer_capacity: n(form.tankSanitizerCapacity),
        has_uv_system: form.hasUvSystem,
        uv_cylinder_count: form.hasUvSystem ? n(form.uvCylinderCount) : null,
        uv_notes: form.hasUvSystem ? s(form.uvNotes) : null,
        general_notes: s(form.generalNotes),
      };

      if (settingId) {
        const { error } = await supabase
          .from("location_intellichem_settings")
          .update(payload)
          .eq("id", settingId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("location_intellichem_settings")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        setSettingId((data as any).id);
      }

      showNotice("success", "Automation settings saved ✅");
      await load();
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [locationId]);

  if (loading) return <main className="p-8">Loading…</main>;

  return (
    <main className="p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">IntelliChem / CO2 / UV Settings</h1>
          <p className="mt-1 text-sm text-gray-600">{formatAddress(location)}</p>
        </div>

        <div className="flex gap-4 text-sm">
          <Link className="underline" href="/locations">Locations</Link>
          <Link className="underline" href="/routes">Routes</Link>
          <Link className="underline" href="/reference/chemistry">Chemistry</Link>
        </div>
      </div>

      {notice ? (
        <div className={`mt-4 rounded border p-3 text-sm ${notice.type === "success" ? "bg-green-50 border-green-200 text-green-800" : notice.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
          {notice.text}
        </div>
      ) : null}

      <section className="mt-6 rounded border bg-blue-50 border-blue-200 p-4 text-sm text-blue-900">
        Store the automation setup for this location. These are equipment configuration values, separate from daily readings.
      </section>

      <section className="mt-6 rounded border p-4">
        <h2 className="font-semibold">pH Control Method</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <SelectField
            label="pH Control Type"
            value={form.phControlType}
            onChange={(v) => setForm((p) => ({ ...p, phControlType: v as PhControlType }))}
            options={[["acid", "Acid"], ["co2", "CO2"], ["other", "Other"]]}
          />

          {form.phControlType === "acid" ? (
            <>
              <Field label="Acid Tank Capacity" value={form.acidTankCapacity} onChange={(v) => setForm((p) => ({ ...p, acidTankCapacity: v }))} placeholder="Example: 15" />
              <Field label="Acid Tank Unit" value={form.tankUnit} onChange={(v) => setForm((p) => ({ ...p, tankUnit: v }))} placeholder="gallons" />
            </>
          ) : null}

          {form.phControlType === "co2" ? (
            <>
              <Field label="CO2 Tank Capacity" value={form.co2TankCapacity} onChange={(v) => setForm((p) => ({ ...p, co2TankCapacity: v }))} placeholder="Example: 2" />
              <Field label="CO2 Tank Unit" value={form.co2TankUnit} onChange={(v) => setForm((p) => ({ ...p, co2TankUnit: v }))} placeholder="tanks, lbs" />
              <TextAreaField className="md:col-span-3" label="CO2 Notes" value={form.co2Notes} onChange={(v) => setForm((p) => ({ ...p, co2Notes: v }))} placeholder="Example: Customer uses CO2 tanks to control pH. Check tank pressure/level during service." />
            </>
          ) : null}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded border p-4">
          <h2 className="font-semibold">pH Automation Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <Field label="pH Setpoint" value={form.phSetpoint} onChange={(v) => setForm((p) => ({ ...p, phSetpoint: v }))} placeholder="7.5" />
            <SelectField label="Dose Method" value={form.phDoseMethod} onChange={(v) => setForm((p) => ({ ...p, phDoseMethod: v }))} options={[["time", "Time"], ["volume", "Volume"], ["setpoint", "To Setpoint"]]} />
            <Field label="Dose Value" value={form.phDoseValue} onChange={(v) => setForm((p) => ({ ...p, phDoseValue: v }))} placeholder="Example: 12" />
            <Field label="Dose Unit" value={form.phDoseUnit} onChange={(v) => setForm((p) => ({ ...p, phDoseUnit: v }))} placeholder="oz, ml, min" />
            <Field label="Limit Value" value={form.phLimitValue} onChange={(v) => setForm((p) => ({ ...p, phLimitValue: v }))} placeholder="Example: 450" />
            <Field label="Limit Unit" value={form.phLimitUnit} onChange={(v) => setForm((p) => ({ ...p, phLimitUnit: v }))} placeholder="oz, ml, min" />
            <Field label="Clear Limit" value={form.phClearLimit} onChange={(v) => setForm((p) => ({ ...p, phClearLimit: v }))} placeholder="24 hours" />
            <Field label="Mix Time Minutes" value={form.phMixTimeMinutes} onChange={(v) => setForm((p) => ({ ...p, phMixTimeMinutes: v }))} placeholder="Example: 30" />
            <TextAreaField className="md:col-span-2" label="pH Notes" value={form.phNotes} onChange={(v) => setForm((p) => ({ ...p, phNotes: v }))} placeholder="pH feed notes, calibration reminders, special setup..." />
          </div>
        </div>

        <div className="rounded border p-4">
          <h2 className="font-semibold">ORP / Sanitizer Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <Field label="ORP Setpoint" value={form.orpSetpoint} onChange={(v) => setForm((p) => ({ ...p, orpSetpoint: v }))} placeholder="700" />
            <SelectField label="Dose Method" value={form.orpDoseMethod} onChange={(v) => setForm((p) => ({ ...p, orpDoseMethod: v }))} options={[["time", "Time"], ["volume", "Volume"], ["setpoint", "To Setpoint"]]} />
            <Field label="Dose Value" value={form.orpDoseValue} onChange={(v) => setForm((p) => ({ ...p, orpDoseValue: v }))} placeholder="Example: 12" />
            <Field label="Dose Unit" value={form.orpDoseUnit} onChange={(v) => setForm((p) => ({ ...p, orpDoseUnit: v }))} placeholder="oz, ml, min" />
            <Field label="Limit Value" value={form.orpLimitValue} onChange={(v) => setForm((p) => ({ ...p, orpLimitValue: v }))} placeholder="Example: 450" />
            <Field label="Limit Unit" value={form.orpLimitUnit} onChange={(v) => setForm((p) => ({ ...p, orpLimitUnit: v }))} placeholder="oz, ml, min" />
            <Field label="Clear Limit" value={form.orpClearLimit} onChange={(v) => setForm((p) => ({ ...p, orpClearLimit: v }))} placeholder="24 hours" />
            <Field label="Sanitizer Tank Capacity" value={form.tankSanitizerCapacity} onChange={(v) => setForm((p) => ({ ...p, tankSanitizerCapacity: v }))} placeholder="Example: 15" />
            <TextAreaField className="md:col-span-2" label="ORP Notes" value={form.orpNotes} onChange={(v) => setForm((p) => ({ ...p, orpNotes: v }))} placeholder="Dose time, sanitizer pump notes, special setup..." />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded border p-4">
        <h2 className="font-semibold">UV System</h2>
        <div className="mt-4 flex items-center gap-2">
          <input id="hasUvSystem" type="checkbox" checked={form.hasUvSystem} onChange={(e) => setForm((p) => ({ ...p, hasUvSystem: e.target.checked }))} />
          <label htmlFor="hasUvSystem" className="text-sm">This location has UV system / UV cylinders</label>
        </div>

        {form.hasUvSystem ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <Field label="UV Cylinder Count" value={form.uvCylinderCount} onChange={(v) => setForm((p) => ({ ...p, uvCylinderCount: v }))} placeholder="Example: 2" />
            <TextAreaField className="md:col-span-3" label="UV Notes" value={form.uvNotes} onChange={(v) => setForm((p) => ({ ...p, uvNotes: v }))} placeholder="Example: Customer uses 2 UV cylinders to help control bacteria. Verify lamp/cylinder status during service." />
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded border p-4">
        <h2 className="font-semibold">General Automation Notes</h2>
        <TextAreaField label="General Notes" value={form.generalNotes} onChange={(v) => setForm((p) => ({ ...p, generalNotes: v }))} placeholder="Probe age, calibration notes, flow delay, special customer/equipment instructions..." />
      </section>

      <section className="mt-6 rounded border bg-gray-50 p-4">
        <h2 className="font-semibold">Technician Reference</h2>
        <div className="mt-3 overflow-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr><th className="p-3 text-left">Setting</th><th className="p-3 text-left">Expected / Normal</th><th className="p-3 text-left">Notes</th></tr>
            </thead>
            <tbody>
              <tr className="border-t"><td className="p-3 font-medium">pH Setpoint</td><td className="p-3">Usually 7.2–7.6</td><td className="p-3">CO2 or acid system should move pH toward this target.</td></tr>
              <tr className="border-t"><td className="p-3 font-medium">CO2 pH Control</td><td className="p-3">Site-specific</td><td className="p-3">Check tank level/pressure and feed operation if pH remains high.</td></tr>
              <tr className="border-t"><td className="p-3 font-medium">ORP Setpoint</td><td className="p-3">Usually 650–800 mV</td><td className="p-3">Low ORP may indicate low sanitizer, dirty probe, high CYA, or organic load.</td></tr>
              <tr className="border-t"><td className="p-3 font-medium">UV Cylinders</td><td className="p-3">Verify operating status</td><td className="p-3">UV assists bacteria control but does not replace required sanitizer residual.</td></tr>
              <tr className="border-t"><td className="p-3 font-medium">Dose Limit</td><td className="p-3">Site-specific safety cap</td><td className="p-3">Prevents overfeeding pH control or sanitizer.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 flex gap-3">
        <button className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" onClick={() => void saveSettings()} disabled={saving}>
          {saving ? "Saving…" : "Save Automation Settings"}
        </button>
        <Link className="rounded border px-4 py-2" href="/locations">Back to Locations</Link>
      </div>
    </main>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={props.className}>
      <label className="text-sm">{props.label}</label>
      <input className="mt-1 w-full border rounded p-2" value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder} />
    </div>
  );
}

function TextAreaField(props: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={props.className}>
      <label className="text-sm">{props.label}</label>
      <textarea className="mt-1 w-full border rounded p-2" value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder} />
    </div>
  );
}

function SelectField(props: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="text-sm">{props.label}</label>
      <select className="mt-1 w-full border rounded p-2" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
  );
}
