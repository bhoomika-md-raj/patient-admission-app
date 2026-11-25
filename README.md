# Patient Admission Management App

Web app for hospital staff to manage admitted patients — add, list, filter, search, edit, delete (with confirmation) and discharge.

**Live app:** https://patient-admission-app-nu.vercel.app/

**API:** https://patient-admission-app-g26v.onrender.com/api/patients (docs at `/docs`)

Docs: https://patient-admission-app-g26v.onrender.com/docs

Deleted:  https://patient-admission-app-g26v.onrender.com/api/patients?deleted=true

**Source code:** https://github.com/bhoomika-md-raj/patient-admission-app/tree/main

## Tech stack
| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite (plain CSS, responsive) |
| Backend | Python 3 + FastAPI + SQLAlchemy + Pydantic |
| Database | PostgreSQL in production (Neon/Supabase/Render), SQLite locally — both persist across restarts |

## Features
Add · List · Filter by Ward / Department / Doctor (+ Status) · Search by name · Edit · Delete with confirmation · Mark Discharged · Responsive (mobile / tablet / desktop)

Design decision: deleting a patient is a soft delete. The record moves to a "Deleted" tab and can be restored, and patient IDs are never reused, as in real hospital systems where records must be retained for audit.

## Validation (frontend **and** backend)
- Name: required, letters (and spaces) only
- Age: required, whole number 0–120
- Gender, Ward, Department, Doctor: required, must be from the list
- Admission date: required, not in the future
- Backend returns HTTP 422 with `{ "message": "...", "errors": { "field": "message" } }`

## Run locally
### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Uses SQLite (`patients.db`) unless `DATABASE_URL` is set. Swagger UI: http://localhost:8000/docs

### Frontend
```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm install
npm run dev               # http://localhost:5173
```

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/options` | Dropdown values |
| GET | `/api/patients?search=&ward=&department=&doctor=&status=` | List / filter / search |
| POST | `/api/patients` | Create |
| PUT | `/api/patients/{id}` | Update |
| PATCH | `/api/patients/{id}/discharge` | Mark discharged |
| DELETE | `/api/patients/{id}` | Delete |

## Environment variables
- Backend: `DATABASE_URL` (Postgres URL), `CORS_ORIGINS` (comma-separated frontend URLs)
- Frontend: `VITE_API_URL`

No secrets are committed; `.env` files are git-ignored.

## Screenshots

### Desktop
![Desktop](screenshots/Desktop/desktop.png)
![Desktop date](screenshots/Desktop/desktop-date.png)

### Mobile
| List | Edit | Validation |
|---|---|---|
| <img src="screenshots/Mobile/mobile.jpeg" width="250"> | <img src="screenshots/Mobile/mobile-edit.jpeg" width="250"> | <img src="screenshots/Form%20validation/mobile-validation.jpeg" width="250"> |

### Form validation and delete confirmation
![Desktop validation](screenshots/Form%20validation/desktop-validation.png)
![Delete confirmation](screenshots/Form%20validation/desktop-delete-confirmation.png)
