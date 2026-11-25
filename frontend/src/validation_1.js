// Today's date (local) as YYYY-MM-DD
export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Returns an object of { field: message }. Empty object = valid.
export function validate(f, options) {
  const e = {};

  const name = (f.name || "").trim().replace(/\s+/g, " ");
  if (!name) e.name = "Name is required";
  else if (!/^\p{L}+(?: \p{L}+)*$/u.test(name)) e.name = "Name must contain letters only (no numbers or symbols)";
  else if (name.length > 100) e.name = "Name must be 100 characters or fewer";

  const ageStr = String(f.age ?? "").trim();
  if (ageStr === "") e.age = "Age is required";
  else {
    const n = Number(ageStr);
    if (!Number.isInteger(n)) e.age = "Age must be a whole number";
    else if (n < 0 || n > 120) e.age = "Age must be between 0 and 120";
  }

  const selects = [
    ["gender", "Gender", options.genders],
    ["ward", "Ward", options.wards],
    ["department", "Department", options.departments],
    ["doctor", "Doctor", options.doctors],
  ];
  for (const [key, label, list] of selects) {
    if (!f[key]) e[key] = `${label} is required`;
    else if (!list.includes(f[key])) e[key] = `${label} must be one of the available options`;
  }

  if (!f.admission_date) e.admission_date = "Admission date is required";
  else if (f.admission_date > todayStr()) e.admission_date = "Admission date cannot be in the future";

  return e;
}
