"""Patient Admission Management API (FastAPI + SQLAlchemy)."""
import os
from datetime import date, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import Column, Date, DateTime, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# ---------- Database ----------
DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./patients.db"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    ward = Column(String(50), nullable=False, index=True)
    department = Column(String(50), nullable=False, index=True)
    doctor = Column(String(80), nullable=False, index=True)
    admission_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="Admitted")

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "age": self.age, "gender": self.gender,
            "ward": self.ward, "department": self.department, "doctor": self.doctor,
            "admission_date": self.admission_date.isoformat(), "status": self.status,
        }


# Columns shared by both tables
FIELDS = ["name", "age", "gender", "ward", "department", "doctor", "admission_date", "status"]


class DeletedPatient(Base):
    """Archive of deleted patients. Keeps the original patient id, so ids are never reused.
    The `patients` table holds active patients only."""
    __tablename__ = "deleted_patients"
    id = Column(Integer, primary_key=True, autoincrement=False)  # original patient id
    name = Column(String(100), nullable=False, index=True)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    ward = Column(String(50), nullable=False, index=True)
    department = Column(String(50), nullable=False, index=True)
    doctor = Column(String(80), nullable=False, index=True)
    admission_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)
    deleted_at = Column(DateTime, nullable=False)

    def to_dict(self):
        d = {f: getattr(self, f) for f in FIELDS}
        d["id"] = self.id
        d["admission_date"] = self.admission_date.isoformat()
        d["deleted_at"] = self.deleted_at.strftime("%d %b %Y, %I:%M %p")
        return d


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Allowed values (single source of truth, served at /api/options) ----------
OPTIONS = {
    "genders": ["Male", "Female", "Other"],
    "wards": ["General Ward", "ICU", "Emergency", "Maternity Ward", "Pediatric Ward", "Surgical Ward"],
    "departments": ["Cardiology", "Neurology", "Orthopedics", "Pediatrics",
                    "General Medicine", "Gynecology", "Oncology"],
    "doctors": ["Dr. Anil Sharma", "Dr. Priya Nair", "Dr. Rahul Verma",
                "Dr. Sneha Reddy", "Dr. Imran Khan", "Dr. Kavita Rao"],
    "statuses": ["Admitted", "Discharged"],
}
LABELS = {"name": "Name", "age": "Age", "gender": "Gender", "ward": "Ward",
          "department": "Department", "doctor": "Doctor",
          "admission_date": "Admission date", "status": "Status"}
SELECT_FIELDS = {"gender": "genders", "ward": "wards", "department": "departments",
                 "doctor": "doctors", "status": "statuses"}


def today_ist() -> date:
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


# ---------- Validation ----------
class PatientIn(BaseModel):
    name: str
    age: int
    gender: str
    ward: str
    department: str
    doctor: str
    admission_date: date
    status: str = "Admitted"

    @field_validator("name", mode="before")
    @classmethod
    def v_name(cls, v):
        if not isinstance(v, str) or not v.strip():
            raise ValueError("Name is required")
        v = " ".join(v.split())
        if not all(part.isalpha() for part in v.split(" ")):
            raise ValueError("Name must contain letters only (no numbers or symbols)")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return v

    @field_validator("age", mode="before")
    @classmethod
    def v_age(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            raise ValueError("Age is required")
        if isinstance(v, bool):
            raise ValueError("Age must be a whole number")
        try:
            if isinstance(v, str):
                n = float(v.strip())
            elif isinstance(v, (int, float)):
                n = float(v)
            else:
                raise ValueError
            if n != int(n):
                raise ValueError
            n = int(n)
        except (ValueError, OverflowError):
            raise ValueError("Age must be a whole number")
        if n < 0 or n > 120:
            raise ValueError("Age must be between 0 and 120")
        return n

    @field_validator("gender", "ward", "department", "doctor", "status", mode="before")
    @classmethod
    def v_select(cls, v, info):
        label = LABELS[info.field_name]
        if v is None or (isinstance(v, str) and not v.strip()):
            raise ValueError(f"{label} is required")
        if v not in OPTIONS[SELECT_FIELDS[info.field_name]]:
            raise ValueError(f"{label} must be one of the available options")
        return v

    @field_validator("admission_date", mode="before")
    @classmethod
    def v_date(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            raise ValueError("Admission date is required")
        if isinstance(v, str):
            try:
                v = date.fromisoformat(v.strip())
            except ValueError:
                raise ValueError("Admission date must be a valid date (YYYY-MM-DD)")
        if isinstance(v, datetime):
            v = v.date()
        if not isinstance(v, date):
            raise ValueError("Admission date must be a valid date (YYYY-MM-DD)")
        if v > today_ist():
            raise ValueError("Admission date cannot be in the future")
        return v


# ---------- App ----------
app = FastAPI(title="Patient Admission API")
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    errors = {}
    for e in exc.errors():
        loc = [p for p in e["loc"] if p != "body"]
        field = str(loc[-1]) if loc else "body"
        if e["type"] == "missing":
            msg = f"{LABELS.get(field, field)} is required"
        elif e["type"] == "json_invalid":
            msg = "Request body is not valid JSON"
        else:
            msg = str(e["msg"]).removeprefix("Value error, ")
        errors.setdefault(field, msg)
    return JSONResponse(status_code=422, content={
        "message": "Validation failed: " + "; ".join(errors.values()), "errors": errors})


@app.exception_handler(HTTPException)
async def http_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail, "errors": {}})


def get_or_404(db: Session, patient_id: int) -> Patient:
    p = db.get(Patient, patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    return p


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/api/options")
def options():
    return OPTIONS


@app.get("/api/patients")
def list_patients(
    search: Optional[str] = None, ward: Optional[str] = None,
    department: Optional[str] = None, doctor: Optional[str] = None,
    status: Optional[str] = None, deleted: bool = False, db: Session = Depends(get_db),
):
    # deleted=false (default) -> `patients` table, deleted=true -> `deleted_patients` table
    M = DeletedPatient if deleted else Patient
    q = db.query(M)
    if search and search.strip():
        q = q.filter(M.name.ilike(f"%{search.strip()}%"))
    if ward:
        q = q.filter(M.ward == ward)
    if department:
        q = q.filter(M.department == department)
    if doctor:
        q = q.filter(M.doctor == doctor)
    if status:
        q = q.filter(M.status == status)
    if deleted:
        rows = q.order_by(M.deleted_at.desc(), M.id.desc()).all()
    else:
        rows = q.order_by(M.admission_date.desc(), M.id.desc()).all()
    return [p.to_dict() for p in rows]


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, patient_id).to_dict()


@app.post("/api/patients", status_code=201)
def create_patient(data: PatientIn, db: Session = Depends(get_db)):
    p = Patient(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p.to_dict()


@app.put("/api/patients/{patient_id}")
def update_patient(patient_id: int, data: PatientIn, db: Session = Depends(get_db)):
    p = get_or_404(db, patient_id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p.to_dict()


@app.patch("/api/patients/{patient_id}/discharge")
def discharge_patient(patient_id: int, db: Session = Depends(get_db)):
    p = get_or_404(db, patient_id)
    p.status = "Discharged"
    db.commit()
    db.refresh(p)
    return p.to_dict()


@app.delete("/api/patients/{patient_id}", status_code=204)
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    # Move the row to `deleted_patients` (same id), then remove it from `patients`.
    p = get_or_404(db, patient_id)
    db.add(DeletedPatient(
        id=p.id, **{f: getattr(p, f) for f in FIELDS},
        deleted_at=datetime.now(ZoneInfo("Asia/Kolkata")).replace(tzinfo=None),
    ))
    db.delete(p)
    db.commit()
    return Response(status_code=204)


@app.patch("/api/patients/{patient_id}/restore")
def restore_patient(patient_id: int, db: Session = Depends(get_db)):
    # Move the row back from `deleted_patients` to `patients` with its original id.
    d = db.get(DeletedPatient, patient_id)
    if not d:
        raise HTTPException(404, "Deleted patient not found")
    p = Patient(id=d.id, **{f: getattr(d, f) for f in FIELDS})
    db.add(p)
    db.delete(d)
    db.commit()
    db.refresh(p)
    return p.to_dict()