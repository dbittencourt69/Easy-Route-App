"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";

type CustomerType = "owner" | "tenant" | "property_management";

type Customer = {
  id: string;
  name: string;
  company_name: string | null;
  customer_type: CustomerType | null;
  primary_contact: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  additional_contact_info: string | null;
  notes: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  created_at?: string | null;
};

type LocationCount = {
  customer_id: string;
};

type FormState = {
  name: string;
  companyName: string;
  customerType: CustomerType;
  primaryContact: string;
  primaryEmail: string;
  primaryPhone: string;
  additionalContactInfo: string;
  notes: string;
  billingAddress1: string;
  billingAddress2: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  companyName: "",
  customerType: "owner",
  primaryContact: "",
  primaryEmail: "",
  primaryPhone: "",
  additionalContactInfo: "",
  notes: "",
  billingAddress1: "",
  billingAddress2: "",
  billingCity: "",
  billingState: "FL",
  billingZip: "",
};

function clean(value: string) {
  return value.trim();
}

function customerTypeLabel(type: CustomerType | null) {
  if (type === "owner") return "Owner";
  if (type === "tenant") return "Tenant";
  if (type === "property_management") return "Property Management";
  return "-";
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locationCounts, setLocationCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      const aName = a.company_name || a.name || "";
      const bName = b.company_name || b.name || "";
      return aName.localeCompare(bName);
    });
  }, [customers]);

  function showNotice(type: "success" | "error" | "info", text: string) {
    setNotice({ type, text });
    if (type !== "error") {
      window.setTimeout(() => setNotice(null), 3500);
    }
  }

  async function loadCustomers() {
    setLoading(true);
    setNotice(null);

    try {
      const { data, error } = await supabase
        .from("customers")
        .select(
          [
            "id",
            "name",
            "company_name",
            "customer_type",
            "primary_contact",
            "primary_email",
            "primary_phone",
            "additional_contact_info",
            "notes",
            "billing_address_line1",
            "billing_address_line2",
            "billing_city",
            "billing_state",
            "billing_zip",
            "created_at",
          ].join(",")
        )
        .order("name");

      if (error) throw new Error(error.message);
      setCustomers(((data ?? []) as unknown) as Customer[]);

      const { data: locs, error: locErr } = await supabase
        .from("locations")
        .select("customer_id");

      if (locErr) throw new Error(locErr.message);

      const counts: Record<string, number> = {};
      (((locs ?? []) as unknown) as LocationCount[]).forEach((row) => {
        counts[row.customer_id] = (counts[row.customer_id] ?? 0) + 1;
      });
      setLocationCounts(counts);
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  function validateForm(values: FormState) {
    if (!clean(values.name)) return "Customer name is required.";

    if (
      !["owner", "tenant", "property_management"].includes(values.customerType)
    ) {
      return "Invalid customer type.";
    }

    return null;
  }

  function formToPayload(values: FormState) {
    return {
      name: clean(values.name),
      company_name: clean(values.companyName) || null,
      customer_type: values.customerType,
      primary_contact: clean(values.primaryContact) || null,
      primary_email: clean(values.primaryEmail) || null,
      primary_phone: clean(values.primaryPhone) || null,
      additional_contact_info: clean(values.additionalContactInfo) || null,
      notes: clean(values.notes) || null,
      billing_address_line1: clean(values.billingAddress1) || null,
      billing_address_line2: clean(values.billingAddress2) || null,
      billing_city: clean(values.billingCity) || null,
      billing_state: clean(values.billingState) || null,
      billing_zip: clean(values.billingZip) || null,
    };
  }

  async function createCustomer() {
    const validation = validateForm(form);
    if (validation) {
      showNotice("info", validation);
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.from("customers").insert(formToPayload(form));
      if (error) throw new Error(error.message);

      setForm(DEFAULT_FORM);
      await loadCustomers();
      showNotice("success", "Customer created ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to create customer");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id);
    setEditForm({
      name: customer.name ?? "",
      companyName: customer.company_name ?? "",
      customerType: customer.customer_type ?? "owner",
      primaryContact: customer.primary_contact ?? "",
      primaryEmail: customer.primary_email ?? "",
      primaryPhone: customer.primary_phone ?? "",
      additionalContactInfo: customer.additional_contact_info ?? "",
      notes: customer.notes ?? "",
      billingAddress1: customer.billing_address_line1 ?? "",
      billingAddress2: customer.billing_address_line2 ?? "",
      billingCity: customer.billing_city ?? "",
      billingState: customer.billing_state ?? "FL",
      billingZip: customer.billing_zip ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(DEFAULT_FORM);
  }

  async function updateCustomer(customerId: string) {
    const validation = validateForm(editForm);
    if (validation) {
      showNotice("info", validation);
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase
        .from("customers")
        .update(formToPayload(editForm))
        .eq("id", customerId);

      if (error) throw new Error(error.message);

      cancelEdit();
      await loadCustomers();
      showNotice("success", "Customer updated ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to update customer");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    const count = locationCounts[customer.id] ?? 0;

    if (count > 0) {
      showNotice(
        "info",
        "This customer still has locations. Delete or move the locations first."
      );
      return;
    }

    const ok = window.confirm(`Delete customer "${customer.name}"?`);
    if (!ok) return;

    setBusy(true);

    try {
      const { error } = await supabase.from("customers").delete().eq("id", customer.id);
      if (error) throw new Error(error.message);

      await loadCustomers();
      showNotice("success", "Customer deleted ✅");
    } catch (e: any) {
      showNotice("error", e?.message ?? "Failed to delete customer");
    } finally {
      setBusy(false);
    }
  }

  function renderForm(
    values: FormState,
    setValues: React.Dispatch<React.SetStateAction<FormState>>,
    mode: "create" | "edit",
    onSubmit: () => void,
    onCancel?: () => void
  ) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div>
          <label className="text-sm">Customer Name *</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={values.name}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, name: e.target.value }))
            }
            disabled={busy}
            placeholder="John Smith"
          />
        </div>

        <div>
          <label className="text-sm">Company Name</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={values.companyName}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, companyName: e.target.value }))
            }
            disabled={busy}
            placeholder="ABC Property Management"
          />
        </div>

        <div>
          <label className="text-sm">Customer Type</label>
          <select
            className="mt-1 w-full border rounded p-2"
            value={values.customerType}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                customerType: e.target.value as CustomerType,
              }))
            }
            disabled={busy}
          >
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
            <option value="property_management">Property Management</option>
          </select>
        </div>

        <div>
          <label className="text-sm">Primary Contact</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={values.primaryContact}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                primaryContact: e.target.value,
              }))
            }
            disabled={busy}
            placeholder="Name of main contact"
          />
        </div>

        <div>
          <label className="text-sm">Primary Email</label>
          <input
            type="email"
            className="mt-1 w-full border rounded p-2"
            value={values.primaryEmail}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                primaryEmail: e.target.value,
              }))
            }
            disabled={busy}
            placeholder="contact@email.com"
          />
        </div>

        <div>
          <label className="text-sm">Primary Phone Number</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={values.primaryPhone}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                primaryPhone: e.target.value,
              }))
            }
            disabled={busy}
            placeholder="(555) 555-5555"
          />
        </div>

        <div className="md:col-span-3">
          <label className="text-sm">Additional Contact Info</label>
          <textarea
            className="mt-1 w-full border rounded p-2"
            value={values.additionalContactInfo}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                additionalContactInfo: e.target.value,
              }))
            }
            disabled={busy}
            placeholder="Secondary contacts, tenant info, manager phone, preferred communication, etc."
          />
        </div>

        <div>
          <label className="text-sm">Billing Address Line 1</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={values.billingAddress1}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                billingAddress1: e.target.value,
              }))
            }
            disabled={busy}
          />
        </div>

        <div>
          <label className="text-sm">Billing Address Line 2</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={values.billingAddress2}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                billingAddress2: e.target.value,
              }))
            }
            disabled={busy}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-sm">City</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={values.billingCity}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  billingCity: e.target.value,
                }))
              }
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm">State</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={values.billingState}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  billingState: e.target.value,
                }))
              }
              disabled={busy}
            />
          </div>

          <div>
            <label className="text-sm">ZIP</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={values.billingZip}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  billingZip: e.target.value,
                }))
              }
              disabled={busy}
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="text-sm">Notes</label>
          <textarea
            className="mt-1 w-full border rounded p-2"
            value={values.notes}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, notes: e.target.value }))
            }
            disabled={busy}
            placeholder="Billing preference, property manager instructions, tenant details, etc."
          />
        </div>

        <div className="md:col-span-3 flex gap-3">
          <button
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : mode === "create"
              ? "Add Customer"
              : "Save Customer"}
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>

        <div className="flex gap-4 text-sm">
          <Link className="underline" href="/">
            Home
          </Link>
          <Link className="underline" href="/locations">
            Locations
          </Link>
          <Link className="underline" href="/routes">
            Routes
          </Link>
          <Link className="underline" href="/techs">
            Techs
          </Link>
        </div>
      </div>

      {notice ? (
        <div
          className={[
            "mt-4 rounded border p-3 text-sm",
            notice.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "",
            notice.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "",
            notice.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "",
          ].join(" ")}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="mt-8 border rounded p-4">
        <h2 className="font-semibold">Add Customer</h2>
        {renderForm(form, setForm, "create", () => void createCustomer())}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-3">Customer List</h2>

        {loading ? (
          <p>Loading…</p>
        ) : sortedCustomers.length === 0 ? (
          <p className="text-gray-600">No customers yet.</p>
        ) : (
          <div className="space-y-4">
            {sortedCustomers.map((customer) => {
              const isEditing = editingId === customer.id;
              const count = locationCounts[customer.id] ?? 0;

              return (
                <div key={customer.id} className="border rounded p-4">
                  {!isEditing ? (
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {customer.company_name
                            ? `${customer.company_name} — `
                            : ""}
                          {customer.name}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Type: {customerTypeLabel(customer.customer_type)} •
                          Locations: {count}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Primary Contact: {customer.primary_contact || "-"}
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          Email: {customer.primary_email || "-"} • Phone:{" "}
                          {customer.primary_phone || "-"}
                        </div>

                        {customer.additional_contact_info ? (
                          <div className="mt-1 text-sm text-gray-600">
                            Additional Contact:{" "}
                            {customer.additional_contact_info}
                          </div>
                        ) : null}

                        <div className="mt-1 text-sm text-gray-600">
                          Billing:{" "}
                          {customer.billing_address_line1
                            ? `${customer.billing_address_line1}, ${
                                customer.billing_city ?? ""
                              } ${customer.billing_state ?? ""} ${
                                customer.billing_zip ?? ""
                              }`
                            : "-"}
                        </div>

                        {customer.notes ? (
                          <div className="mt-1 text-sm text-gray-600">
                            Notes: {customer.notes}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Link
                          className="underline"
                          href={`/locations?customerId=${customer.id}`}
                        >
                          Manage Locations
                        </Link>

                        <button
                          className="underline"
                          onClick={() => startEdit(customer)}
                          disabled={busy}
                        >
                          Edit
                        </button>

                        <button
                          className="underline text-red-600"
                          onClick={() => void deleteCustomer(customer)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-semibold">Edit Customer</h3>
                      {renderForm(
                        editForm,
                        setEditForm,
                        "edit",
                        () => void updateCustomer(customer.id),
                        cancelEdit
                      )}
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
