import { useEffect, useState } from "react";
import { api } from "./api.js";
import PatientForm from "./components/PatientForm.jsx";

const EMPTY = { search: "", ward: "", department: "", doctor: "", status: "" };

const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function App() {
  const [options, setOptions] = useState(null);
  const [patients, setPatients] = useState([]);
  const [filters, setFilters] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formFor, setFormFor] = useState(null); // null | "new" | patient
  const [toDelete, setToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [reload, setReload] = useState(0);

  const notify = (text, type = "ok") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.options().then(setOptions).catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      api.list(filters)
        .then((d) => { if (!cancelled) { setPatients(d); setLoadError(""); } })
        .catch((e) => !cancelled && setLoadError(e.message))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [filters, reload]);

  const refresh = () => setReload((n) => n + 1);
  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const hasFilters = Object.values(filters).some(Boolean);

  async function save(payload) {
    if (formFor && formFor !== "new") {
      await api.update(formFor.id, payload);
      notify("Patient updated");
    } else {
      await api.create(payload);
      notify("Patient added");
    }
    setFormFor(null);
    refresh();
  }

  async function discharge(p) {
    try { await api.discharge(p.id); notify(`${p.name} marked as discharged`); refresh(); }
    catch (e) { notify(e.message, "error"); }
  }

  async function confirmDelete() {
    try { await api.remove(toDelete.id); notify("Patient deleted"); refresh(); }
    catch (e) { notify(e.message, "error"); }
    setToDelete(null);
  }

  const filterSelect = (key, label, list) => (
    <select value={filters[key]} onChange={setF(key)} aria-label={label}>
      <option value="">All {label.toLowerCase()}s</option>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="container">
      <header className="top">
        <div>
          <h1>Patient Admissions</h1>
          <p className="muted">Manage admitted patients</p>
        </div>
        <button className="btn primary" disabled={!options} onClick={() => setFormFor("new")}>+ Add patient</button>
      </header>

      <section className="filters">
        <input className="search" type="search" placeholder="Search by patient name…" value={filters.search} onChange={setF("search")} />
        {options && (
          <>
            {filterSelect("ward", "Ward", options.wards)}
            {filterSelect("department", "Department", options.departments)}
            {filterSelect("doctor", "Doctor", options.doctors)}
            {filterSelect("status", "Status", options.statuses)}
          </>
        )}
        {hasFilters && <button className="btn" onClick={() => setFilters(EMPTY)}>Clear</button>}
      </section>

      {loadError && <div className="banner error">{loadError}</div>}
      <p className="muted count">{loading ? "Loading…" : `${patients.length} patient${patients.length === 1 ? "" : "s"}`}</p>

      {!loading && !loadError && patients.length === 0 ? (
        <div className="empty">{hasFilters ? "No patients match your filters." : "No patients yet. Click “Add patient” to get started."}</div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Age</th><th>Gender</th><th>Ward</th><th>Department</th><th>Doctor</th><th>Admitted</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id}>
                <td data-label="Name" className="name">{p.name}</td>
                <td data-label="Age">{p.age}</td>
                <td data-label="Gender">{p.gender}</td>
                <td data-label="Ward">{p.ward}</td>
                <td data-label="Department">{p.department}</td>
                <td data-label="Doctor">{p.doctor}</td>
                <td data-label="Admitted">{fmtDate(p.admission_date)}</td>
                <td data-label="Status"><span className={`badge ${p.status === "Admitted" ? "in" : "out"}`}>{p.status}</span></td>
                <td data-label="Actions" className="row-actions">
                  {p.status === "Admitted" && <button className="btn sm" onClick={() => discharge(p)}>Discharge</button>}
                  <button className="btn sm" onClick={() => setFormFor(p)}>Edit</button>
                  <button className="btn sm danger" onClick={() => setToDelete(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {formFor && options && (
        <PatientForm options={options} initial={formFor === "new" ? null : formFor} onSubmit={save} onCancel={() => setFormFor(null)} />
      )}

      {toDelete && (
        <div className="overlay" onMouseDown={() => setToDelete(null)}>
          <div className="modal small" onMouseDown={(e) => e.stopPropagation()}>
            <h2>Delete patient?</h2>
            <p>Are you sure you want to delete <strong>{toDelete.name}</strong>? This cannot be undone.</p>
            <div className="actions">
              <button className="btn" onClick={() => setToDelete(null)}>Cancel</button>
              <button className="btn danger solid" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}
    </div>
  );
}
