import { useState } from "react";
import { validate, todayStr } from "../validation.js";

const BLANK = { name: "", age: "", gender: "", ward: "", department: "", doctor: "", admission_date: "", status: "Admitted" };

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="err">{error}</small>}
    </label>
  );
}

export default function PatientForm({ options, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial ? { ...initial } : BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const select = (key, label, list) => (
    <Field label={label} error={errors[key]}>
      <select value={form[key]} onChange={set(key)} className={errors[key] ? "invalid" : ""}>
        <option value="">Select {label.toLowerCase()}</option>
        {list.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    const v = validate(form, options);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await onSubmit({ ...form, name: form.name.trim().replace(/\s+/g, " "), age: Number(form.age) });
    } catch (err) {
      setErrors(err.errors || {});
      setFormError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onCancel}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} noValidate>
        <h2>{initial ? "Edit patient" : "Add patient"}</h2>
        {formError && <div className="banner error">{formError}</div>}
        <div className="grid">
          <Field label="Name" error={errors.name}>
            <input value={form.name} onChange={set("name")} placeholder="Full name" className={errors.name ? "invalid" : ""} />
          </Field>
          <Field label="Age" error={errors.age}>
            <input type="number" min="0" max="120" value={form.age} onChange={set("age")} placeholder="0 - 120" className={errors.age ? "invalid" : ""} />
          </Field>
          {select("gender", "Gender", options.genders)}
          {select("ward", "Ward", options.wards)}
          {select("department", "Department", options.departments)}
          {select("doctor", "Doctor", options.doctors)}
          <Field label="Admission date" error={errors.admission_date}>
            <input type="date" max={todayStr()} value={form.admission_date} onChange={set("admission_date")} className={errors.admission_date ? "invalid" : ""} />
          </Field>
          {select("status", "Status", options.statuses)}
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Add patient"}</button>
        </div>
      </form>
    </div>
  );
}
