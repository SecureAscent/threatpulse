import React, { useState, useEffect } from "react";

const statusOptions = ["Active", "Inactive", "Retired"];
const inputCls =
  "w-full px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

export default function ProductAssetForm({ initialData, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({
    name: "",
    vendor: "",
    current_version: "",
    status: "Active",
    end_of_life_date: "",
    owner: "",
    notes: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        vendor: initialData.vendor || "",
        current_version: initialData.current_version || "",
        status: initialData.status || "Active",
        end_of_life_date: initialData.end_of_life_date || "",
        owner: initialData.owner || "",
        notes: initialData.notes || "",
      });
    }
  }, [initialData]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form, end_of_life_date: form.end_of_life_date || undefined };
    if (!payload.name.trim()) return;
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Product Name *</label>
          <input
            value={form.name}
            onChange={set("name")}
            className={inputCls}
            placeholder="e.g. Exchange Server"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Vendor</label>
          <input value={form.vendor} onChange={set("vendor")} className={inputCls} placeholder="Microsoft" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Active Version</label>
          <input
            value={form.current_version}
            onChange={set("current_version")}
            className={inputCls}
            placeholder="2019 CU12"
          />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={set("status")} className={inputCls}>
            {statusOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>End of Life Date</label>
          <input type="date" value={form.end_of_life_date} onChange={set("end_of_life_date")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Owner</label>
          <input value={form.owner} onChange={set("owner")} className={inputCls} placeholder="Team / contact" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={form.notes}
          onChange={set("notes")}
          rows={2}
          className={inputCls}
          placeholder="Deployment context, constraints…"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-input text-sm hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Saving…" : initialData ? "Save Changes" : "Add Asset"}
        </button>
      </div>
    </form>
  );
}