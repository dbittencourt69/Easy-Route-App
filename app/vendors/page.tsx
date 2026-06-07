"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";

type Vendor = {
  id: string;
  name: string;
  vendor_type: string | null;
  primary_contact: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type VendorLocation = {
  id: string;
  vendor_id: string;
  location_name: string | null;
  address_line1: string;
  city: string;
  state: string;
  zip: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type VendorPurchase = {
  id: string;
  vendor_visit_id: string | null;
  vendor_id: string | null;
  vendor_location_id: string | null;
  item_name: string;
  category: "chemical" | "part" | "equipment" | "tool" | "supplies" | "other" | null;
  quantity: number | null;
  unit: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  created_at: string;
};

type VendorForm = {
  name: string;
  vendorType: string;
  primaryContact: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
};

type LocationForm = {
  vendorId: string;
  locationName: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  notes: string;
};

type PurchaseForm = {
  vendorId: string;
  vendorLocationId: string;
  itemName: string;
  category: "chemical" | "part" | "equipment" | "tool" | "supplies" | "other";
  quantity: string;
  unit: string;
  unitCost: string;
  totalCost: string;
  notes: string;
};

const DEFAULT_VENDOR_FORM: VendorForm = {
  name: "",
  vendorType: "",
  primaryContact: "",
  phone: "",
  email: "",
  website: "",
  notes: "",
};

const DEFAULT_LOCATION_FORM: LocationForm = {
  vendorId: "",
  locationName: "",
  addressLine1: "",
  city: "",
  state: "FL",
  zip: "",
  phone: "",
  notes: "",
};

const DEFAULT_PURCHASE_FORM: PurchaseForm = {
  vendorId: "",
  vendorLocationId: "",
  itemName: "",
  category: "chemical",
  quantity: "1",
  unit: "",
  unitCost: "",
  totalCost: "",
  notes: "",
};

function clean(value: string) {
  return value.trim();
}

function numOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function money(value: number | null) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatAddress(loc: VendorLocation) {
  return `${loc.address_line1}, ${loc.city} ${loc.state} ${loc.zip ?? ""}`.trim();
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<VendorLocation[]>([]);
  const [purchases, setPurchases] = useState<VendorPurchase[]>([]);

  const [vendorForm, setVendorForm] = useState<VendorForm>(DEFAULT_VENDOR_FORM);
  const [locationForm, setLocationForm] = useState<LocationForm>(DEFAULT_LOCATION_FORM);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(DEFAULT_PURCHASE_FORM);

  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editingVendorForm, setEditingVendorForm] = useState<VendorForm>(DEFAULT_VENDOR_FORM);

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationForm, setEditingLocationForm] = useState<LocationForm>(DEFAULT_LOCATION_FORM);

  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const activeVendors = useMemo(() => {
    return showInactive ? vendors : vendors.filter((v) => v.is_active);
  }, [vendors, showInactive]);

  const vendorById = useMemo(() => {
    return new Map(vendors.map((v) => [v.id, v]));
  }, [vendors]);

  const locationsByVendor = useMemo(() => {
    const map = new Map<string, VendorLocation[]>();
    for (const loc of locations) {
      const list = map.get(loc.vendor_id) ?? [];
      list.push(loc);
      map.set(loc.vendor_id, list);
    }
    return map;
  }, [locations]);

  const activeLocationsForSelectedVendor = useMemo(() => {
    return locations.filter(
      (loc) => loc.vendor_id === purchaseForm.vendorId && loc.is_active
    );
  }, [locations, purchaseForm.vendorId]);

  const recentPurchases = useMemo(() => {
    return [...purchases].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [purchases]);

  function showNotice(type: "success" | "error" | "info", text: string) {
    setNotice({ type, text });
    if (type !== "error") window.setTimeout(() => setNotice(null), 3500);
  }

  async function loadAll() {
    setLoading(true);
    setNotice(null);

    try {
      const [vendorRes, locationRes, purchaseRes] = await Promise.all([
        supabase.from("vendors").select("*").order("name"),
        supabase.from("vendor_locations").select("*").order("city").order("address_line1"),
        supabase
          .from("vendor_purchases")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (vendorRes.error) throw new Error(vendorRes.error.message);
      if (locationRes.error) throw new Error(locationRes.error.message);
      if (purchaseRes.error) throw new Error(purchaseRes.error.message);

      setVendors((vendorRes.data ?? []) as Vendor[]);
      setLocations((locationRes.data ?? []) as VendorLocation[]);
      setPurchases((purchaseRes.data ?? []) as VendorPurchase[]);
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function vendorPayload(form: VendorForm) {
    return {
      name: clean(form.name),
      vendor_type: clean(form.vendorType) || null,
      primary_contact: clean(form.primaryContact) || null,
      phone: clean(form.phone) || null,
      email: clean(form.email) || null,
      website: clean(form.website) || null,
      notes: clean(form.notes) || null,
    };
  }

  function locationPayload(form: LocationForm) {
    return {
      vendor_id: form.vendorId,
      location_name: clean(form.locationName) || null,
      address_line1: clean(form.addressLine1),
      city: clean(form.city),
      state: clean(form.state) || "FL",
      zip: clean(form.zip) || null,
      phone: clean(form.phone) || null,
      notes: clean(form.notes) || null,
    };
  }

  async function createVendor() {
    if (!clean(vendorForm.name)) {
      showNotice("info", "Vendor name is required.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.from("vendors").insert(vendorPayload(vendorForm));
      if (error) throw new Error(error.message);

      setVendorForm(DEFAULT_VENDOR_FORM);
      await loadAll();
      showNotice("success", "Vendor created ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to create vendor");
    } finally {
      setBusy(false);
    }
  }

  function startEditVendor(vendor: Vendor) {
    setEditingVendorId(vendor.id);
    setEditingVendorForm({
      name: vendor.name ?? "",
      vendorType: vendor.vendor_type ?? "",
      primaryContact: vendor.primary_contact ?? "",
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      website: vendor.website ?? "",
      notes: vendor.notes ?? "",
    });
  }

  async function updateVendor(vendorId: string) {
    if (!clean(editingVendorForm.name)) {
      showNotice("info", "Vendor name is required.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase
        .from("vendors")
        .update(vendorPayload(editingVendorForm))
        .eq("id", vendorId);

      if (error) throw new Error(error.message);

      setEditingVendorId(null);
      setEditingVendorForm(DEFAULT_VENDOR_FORM);
      await loadAll();
      showNotice("success", "Vendor updated ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to update vendor");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVendorActive(vendor: Vendor) {
    const label = vendor.is_active ? "deactivate" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${label} ${vendor.name}?`)) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from("vendors")
        .update({ is_active: !vendor.is_active })
        .eq("id", vendor.id);

      if (error) throw new Error(error.message);

      await loadAll();
      showNotice("success", vendor.is_active ? "Vendor deactivated ✅" : "Vendor reactivated ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to update vendor status");
    } finally {
      setBusy(false);
    }
  }

  async function createLocation() {
    if (!locationForm.vendorId) {
      showNotice("info", "Select a vendor first.");
      return;
    }

    if (!clean(locationForm.addressLine1) || !clean(locationForm.city)) {
      showNotice("info", "Address and city are required.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase
        .from("vendor_locations")
        .insert(locationPayload(locationForm));

      if (error) throw new Error(error.message);

      setLocationForm(DEFAULT_LOCATION_FORM);
      await loadAll();
      showNotice("success", "Vendor location added ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to add location");
    } finally {
      setBusy(false);
    }
  }

  function startEditLocation(location: VendorLocation) {
    setEditingLocationId(location.id);
    setEditingLocationForm({
      vendorId: location.vendor_id,
      locationName: location.location_name ?? "",
      addressLine1: location.address_line1,
      city: location.city,
      state: location.state,
      zip: location.zip ?? "",
      phone: location.phone ?? "",
      notes: location.notes ?? "",
    });
  }

  async function updateLocation(locationId: string) {
    if (!editingLocationForm.vendorId) {
      showNotice("info", "Vendor is required.");
      return;
    }

    if (!clean(editingLocationForm.addressLine1) || !clean(editingLocationForm.city)) {
      showNotice("info", "Address and city are required.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase
        .from("vendor_locations")
        .update(locationPayload(editingLocationForm))
        .eq("id", locationId);

      if (error) throw new Error(error.message);

      setEditingLocationId(null);
      setEditingLocationForm(DEFAULT_LOCATION_FORM);
      await loadAll();
      showNotice("success", "Vendor location updated ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to update location");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLocationActive(location: VendorLocation) {
    const label = location.is_active ? "deactivate" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${label} this vendor location?`)) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from("vendor_locations")
        .update({ is_active: !location.is_active })
        .eq("id", location.id);

      if (error) throw new Error(error.message);

      await loadAll();
      showNotice("success", location.is_active ? "Location deactivated ✅" : "Location reactivated ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to update location status");
    } finally {
      setBusy(false);
    }
  }

  async function createPurchase() {
    if (!purchaseForm.vendorId) {
      showNotice("info", "Select a vendor.");
      return;
    }

    if (!clean(purchaseForm.itemName)) {
      showNotice("info", "Item name is required.");
      return;
    }

    const quantity = numOrNull(purchaseForm.quantity);
    const unitCost = numOrNull(purchaseForm.unitCost);
    const manualTotal = numOrNull(purchaseForm.totalCost);
    const totalCost =
      manualTotal !== null
        ? manualTotal
        : quantity !== null && unitCost !== null
        ? quantity * unitCost
        : null;

    setBusy(true);

    try {
      const { error } = await supabase.from("vendor_purchases").insert({
        vendor_id: purchaseForm.vendorId,
        vendor_location_id: purchaseForm.vendorLocationId || null,
        item_name: clean(purchaseForm.itemName),
        category: purchaseForm.category,
        quantity,
        unit: clean(purchaseForm.unit) || null,
        unit_cost: unitCost,
        total_cost: totalCost,
        notes: clean(purchaseForm.notes) || null,
      });

      if (error) throw new Error(error.message);

      setPurchaseForm((prev) => ({
        ...DEFAULT_PURCHASE_FORM,
        vendorId: prev.vendorId,
        vendorLocationId: prev.vendorLocationId,
      }));
      await loadAll();
      showNotice("success", "Purchase saved ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to save purchase");
    } finally {
      setBusy(false);
    }
  }

  function renderVendorForm(
    form: VendorForm,
    setForm: React.Dispatch<React.SetStateAction<VendorForm>>,
    submitLabel: string,
    onSubmit: () => void,
    onCancel?: () => void
  ) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="text-sm">Vendor Name *</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            disabled={busy}
            placeholder="SCP, Pinch A Penny, Leslie's..."
          />
        </div>

        <div>
          <label className="text-sm">Vendor Type</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.vendorType}
            onChange={(e) => setForm((p) => ({ ...p, vendorType: e.target.value }))}
            disabled={busy}
            placeholder="Pool supply, parts, equipment..."
          />
        </div>

        <div>
          <label className="text-sm">Primary Contact</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.primaryContact}
            onChange={(e) => setForm((p) => ({ ...p, primaryContact: e.target.value }))}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm">Phone</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm">Email</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm">Website</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.website}
            onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
            disabled={busy}
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-sm">Notes</label>
          <textarea
            className="mt-1 w-full rounded border p-2"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            disabled={busy}
            placeholder="Account number, discount info, hours, preferred branch..."
          />
        </div>

        <div className="md:col-span-3 flex gap-3">
          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? "Saving…" : submitLabel}
          </button>

          {onCancel ? (
            <button
              className="rounded border px-4 py-2 disabled:opacity-50"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderLocationForm(
    form: LocationForm,
    setForm: React.Dispatch<React.SetStateAction<LocationForm>>,
    submitLabel: string,
    onSubmit: () => void,
    onCancel?: () => void
  ) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="text-sm">Vendor *</label>
          <select
            className="mt-1 w-full rounded border p-2"
            value={form.vendorId}
            onChange={(e) => setForm((p) => ({ ...p, vendorId: e.target.value }))}
            disabled={busy}
          >
            <option value="">Select vendor...</option>
            {vendors
              .filter((v) => v.is_active || showInactive)
              .map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-sm">Location Name</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.locationName}
            onChange={(e) => setForm((p) => ({ ...p, locationName: e.target.value }))}
            disabled={busy}
            placeholder="Main branch, warehouse..."
          />
        </div>

        <div>
          <label className="text-sm">Phone</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm">Address *</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.addressLine1}
            onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))}
            disabled={busy}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-sm">City *</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm">State</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.state}
              onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm">ZIP</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.zip}
              onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
              disabled={busy}
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="text-sm">Location Notes</label>
          <textarea
            className="mt-1 w-full rounded border p-2"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            disabled={busy}
            placeholder="Hours, parking/loading info, contact, account instructions..."
          />
        </div>

        <div className="md:col-span-3 flex gap-3">
          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? "Saving…" : submitLabel}
          </button>

          {onCancel ? (
            <button
              className="rounded border px-4 py-2 disabled:opacity-50"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage vendors, branches, and purchase expenses.
          </p>
        </div>

        <div className="flex gap-4 text-sm">
          <Link className="underline" href="/">
            Home
          </Link>
          <Link className="underline" href="/routes">
            Routes
          </Link>
          <Link className="underline" href="/customers">
            Customers
          </Link>
          <Link className="underline" href="/locations">
            Locations
          </Link>
        </div>
      </div>

      {notice ? (
        <div
          className={[
            "mt-4 rounded border p-3 text-sm",
            notice.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "",
            notice.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "",
            notice.type === "info" ? "bg-blue-50 border-blue-200 text-blue-800" : "",
          ].join(" ")}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="mt-8 rounded border p-4">
        <h2 className="font-semibold">Add Vendor</h2>
        {renderVendorForm(vendorForm, setVendorForm, "Add Vendor", () => void createVendor())}
      </section>

      <section className="mt-8 rounded border p-4">
        <h2 className="font-semibold">Add Vendor Location</h2>
        {renderLocationForm(
          locationForm,
          setLocationForm,
          "Add Vendor Location",
          () => void createLocation()
        )}
      </section>

      <section className="mt-8 rounded border p-4">
        <h2 className="font-semibold">Quick Purchase Entry</h2>
        <p className="mt-1 text-sm text-gray-600">
          Use this for purchases not yet connected to a route/vendor stop.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div>
            <label className="text-sm">Vendor *</label>
            <select
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.vendorId}
              onChange={(e) =>
                setPurchaseForm((p) => ({
                  ...p,
                  vendorId: e.target.value,
                  vendorLocationId: "",
                }))
              }
              disabled={busy}
            >
              <option value="">Select vendor...</option>
              {vendors
                .filter((v) => v.is_active || showInactive)
                .map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Vendor Location</label>
            <select
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.vendorLocationId}
              onChange={(e) =>
                setPurchaseForm((p) => ({ ...p, vendorLocationId: e.target.value }))
              }
              disabled={busy || !purchaseForm.vendorId}
            >
              <option value="">Optional...</option>
              {activeLocationsForSelectedVendor.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_name || formatAddress(location)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm">Item Name *</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.itemName}
              onChange={(e) => setPurchaseForm((p) => ({ ...p, itemName: e.target.value }))}
              disabled={busy}
              placeholder="Liquid chlorine, pump seal..."
            />
          </div>

          <div>
            <label className="text-sm">Category</label>
            <select
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.category}
              onChange={(e) =>
                setPurchaseForm((p) => ({ ...p, category: e.target.value as PurchaseForm["category"] }))
              }
              disabled={busy}
            >
              <option value="chemical">Chemical</option>
              <option value="part">Part</option>
              <option value="equipment">Equipment</option>
              <option value="tool">Tool</option>
              <option value="supplies">Supplies</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm">Quantity</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.quantity}
              onChange={(e) => setPurchaseForm((p) => ({ ...p, quantity: e.target.value }))}
              disabled={busy}
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm">Unit</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.unit}
              onChange={(e) => setPurchaseForm((p) => ({ ...p, unit: e.target.value }))}
              disabled={busy}
              placeholder="gal, lbs, each..."
            />
          </div>

          <div>
            <label className="text-sm">Unit Cost</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.unitCost}
              onChange={(e) => setPurchaseForm((p) => ({ ...p, unitCost: e.target.value }))}
              disabled={busy}
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm">Total Cost</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.totalCost}
              onChange={(e) => setPurchaseForm((p) => ({ ...p, totalCost: e.target.value }))}
              disabled={busy}
              inputMode="decimal"
              placeholder="Auto if qty x unit cost"
            />
          </div>

          <div className="md:col-span-4">
            <label className="text-sm">Notes</label>
            <textarea
              className="mt-1 w-full rounded border p-2"
              value={purchaseForm.notes}
              onChange={(e) => setPurchaseForm((p) => ({ ...p, notes: e.target.value }))}
              disabled={busy}
              placeholder="Receipt info, job/customer related, reason for purchase..."
            />
          </div>

          <div className="md:col-span-4">
            <button
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              onClick={() => void createPurchase()}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save Purchase"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Vendor List</h2>

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
        ) : activeVendors.length === 0 ? (
          <p className="text-gray-600">No vendors yet.</p>
        ) : (
          <div className="space-y-4">
            {activeVendors.map((vendor) => {
              const vendorLocations = locationsByVendor.get(vendor.id) ?? [];
              const isEditing = editingVendorId === vendor.id;

              return (
                <div key={vendor.id} className={`rounded border p-4 ${!vendor.is_active ? "bg-gray-50 text-gray-500" : ""}`}>
                  {!isEditing ? (
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold">{vendor.name}</div>
                        <div className="mt-1 text-sm text-gray-600">
                          Type: {vendor.vendor_type || "-"} • Contact: {vendor.primary_contact || "-"}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          Phone: {vendor.phone || "-"} • Email: {vendor.email || "-"}
                        </div>
                        {vendor.website ? (
                          <div className="mt-1 text-sm text-gray-600">Website: {vendor.website}</div>
                        ) : null}
                        {vendor.notes ? (
                          <div className="mt-1 text-sm text-gray-600">Notes: {vendor.notes}</div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm">
                        <button className="underline" onClick={() => startEditVendor(vendor)} disabled={busy}>
                          Edit
                        </button>
                        <button
                          className={`underline ${vendor.is_active ? "text-red-600" : "text-green-700"}`}
                          onClick={() => void toggleVendorActive(vendor)}
                          disabled={busy}
                        >
                          {vendor.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-semibold">Edit Vendor</h3>
                      {renderVendorForm(
                        editingVendorForm,
                        setEditingVendorForm,
                        "Save Vendor",
                        () => void updateVendor(vendor.id),
                        () => {
                          setEditingVendorId(null);
                          setEditingVendorForm(DEFAULT_VENDOR_FORM);
                        }
                      )}
                    </div>
                  )}

                  <div className="mt-4 rounded border bg-white p-3">
                    <h3 className="font-semibold text-sm">Locations</h3>

                    {vendorLocations.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-600">No vendor locations yet.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {vendorLocations.map((location) => {
                          const isLocationEditing = editingLocationId === location.id;

                          return (
                            <div key={location.id} className={`rounded border p-3 ${!location.is_active ? "bg-gray-50 text-gray-500" : ""}`}>
                              {!isLocationEditing ? (
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="font-medium">
                                      {location.location_name || "Vendor Location"}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {formatAddress(location)}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      Phone: {location.phone || "-"}
                                    </div>
                                    {location.notes ? (
                                      <div className="text-sm text-gray-600">
                                        Notes: {location.notes}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap gap-3 text-sm">
                                    <button
                                      className="underline"
                                      onClick={() => startEditLocation(location)}
                                      disabled={busy}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className={`underline ${location.is_active ? "text-red-600" : "text-green-700"}`}
                                      onClick={() => void toggleLocationActive(location)}
                                      disabled={busy}
                                    >
                                      {location.is_active ? "Deactivate" : "Reactivate"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <h4 className="font-semibold text-sm">Edit Vendor Location</h4>
                                  {renderLocationForm(
                                    editingLocationForm,
                                    setEditingLocationForm,
                                    "Save Location",
                                    () => void updateLocation(location.id),
                                    () => {
                                      setEditingLocationId(null);
                                      setEditingLocationForm(DEFAULT_LOCATION_FORM);
                                    }
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-3">Recent Purchases</h2>

        {recentPurchases.length === 0 ? (
          <p className="text-gray-600">No purchases yet.</p>
        ) : (
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Vendor</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Qty</th>
                  <th className="p-3 text-left">Total</th>
                  <th className="p-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t">
                    <td className="p-3">
                      {new Date(purchase.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {purchase.vendor_id
                        ? vendorById.get(purchase.vendor_id)?.name ?? purchase.vendor_id
                        : "-"}
                    </td>
                    <td className="p-3 font-medium">{purchase.item_name}</td>
                    <td className="p-3">{purchase.category ?? "-"}</td>
                    <td className="p-3">
                      {purchase.quantity ?? "-"} {purchase.unit ?? ""}
                    </td>
                    <td className="p-3">{money(purchase.total_cost)}</td>
                    <td className="p-3">{purchase.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
