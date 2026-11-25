const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...opts });
  } catch {
    throw { message: "Cannot reach the server. Please try again.", errors: {} };
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { message: data.message || "Something went wrong", errors: data.errors || {} };
  return data;
}

export const api = {
  options: () => req("/api/options"),
  list: (filters) => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    return req("/api/patients?" + p.toString());
  },
  create: (body) => req("/api/patients", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => req(`/api/patients/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => req(`/api/patients/${id}`, { method: "DELETE" }),
  discharge: (id) => req(`/api/patients/${id}/discharge`, { method: "PATCH" }),
};
