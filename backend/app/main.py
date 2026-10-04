import io
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw, UnidentifiedImageError
import numpy as np
import pydicom

from .schemas import CareSuggestions, DicomMetadata, InferenceResponse, Provenance, ReviewUpdate

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
DATABASE = ROOT / "pink_edge_api.db"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

app = FastAPI(title="Pink Edge AI API", version="1.0.0")
configured_origins = os.getenv("CORS_ORIGINS")
origins = (
    [item.strip() for item in configured_origins.split(",") if item.strip()]
    if configured_origins
    else ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=None if configured_origins else r"https?://(localhost|127(?:\.\d+){3})(?::\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=ARTIFACTS), name="static")

DISCLAIMER = "This is an AI-assisted preliminary assessment and not a final medical diagnosis. Please consult a qualified doctor."


def init_db() -> None:
    with sqlite3.connect(DATABASE) as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS inference_results (
                case_id TEXT PRIMARY KEY,
                result_json TEXT NOT NULL,
                provenance_json TEXT NOT NULL,
                dicom_metadata_json TEXT,
                review_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )"""
        )


@app.on_event("startup")
def startup() -> None:
    init_db()


def persist_result(result: InferenceResponse) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DATABASE) as connection:
        connection.execute(
            """INSERT OR REPLACE INTO inference_results
            (case_id, result_json, provenance_json, dicom_metadata_json, review_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM inference_results WHERE case_id = ?), ?), ?)""",
            (
                result.case_id,
                result.model_dump_json(),
                result.provenance.model_dump_json(),
                result.dicom_metadata.model_dump_json() if result.dicom_metadata else None,
                result.review.model_dump_json() if result.review else None,
                result.case_id,
                now,
                now,
            ),
        )


def update_persisted_review(case_id: str, review: ReviewUpdate) -> InferenceResponse:
    with sqlite3.connect(DATABASE) as connection:
        row = connection.execute(
            "SELECT result_json FROM inference_results WHERE case_id = ?", (case_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Result was not found in the local cache.")
        payload = json.loads(row[0])
        payload["review"] = review.model_dump()
        payload["provenance"]["human_review"] = review.decision
        updated = InferenceResponse.model_validate(payload)
        connection.execute(
            "UPDATE inference_results SET result_json = ?, provenance_json = ?, review_json = ?, updated_at = ? WHERE case_id = ?",
            (
                updated.model_dump_json(),
                updated.provenance.model_dump_json(),
                review.model_dump_json(),
                datetime.now(timezone.utc).isoformat(),
                case_id,
            ),
        )
    return updated


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/results/{case_id}/review", response_model=InferenceResponse)
def review_result(case_id: str, review: ReviewUpdate) -> InferenceResponse:
    return update_persisted_review(case_id, review)


def create_heatmap(image: Image.Image) -> str:
    artifact_id = uuid4().hex
    heatmap = image.copy().convert("RGBA")
    overlay = Image.new("RGBA", heatmap.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width, height = heatmap.size
    center = (width // 2, height // 2)
    radius = max(20, min(width, height) // 5)
    draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), fill=(255, 61, 96, 82), outline=(255, 130, 145, 220), width=max(2, radius // 18))
    output = Image.alpha_composite(heatmap, overlay).convert("RGB")
    output.save(ARTIFACTS / f"{artifact_id}.png", format="PNG", optimize=True)
    return f"/static/{artifact_id}.png"


@app.post("/predict", response_model=InferenceResponse)
async def predict(file: UploadFile = File(...), modality: str = Form("Tuberculosis")) -> InferenceResponse:
    if modality not in {"Mammography", "Tuberculosis", "Fetal Ultrasound"}:
        raise HTTPException(status_code=400, detail="Select Mammography, Tuberculosis, or Fetal Ultrasound.")
    if not file.filename or Path(file.filename).suffix.lower() not in {".png", ".jpg", ".jpeg", ".dcm", ".dicom"}:
        raise HTTPException(status_code=400, detail="Upload a PNG, JPG, JPEG, or DICOM scan.")
    payload = await file.read()
    if len(payload) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The scan exceeds the 15 MB upload limit.")
    dicom_metadata: DicomMetadata | None = None
    try:
        suffix = Path(file.filename).suffix.lower()
        if suffix in {".dcm", ".dicom"}:
            dataset = pydicom.dcmread(io.BytesIO(payload), force=False)
            dicom_metadata = DicomMetadata(
                patient_id=str(getattr(dataset, "PatientID", "") or "") or None,
                study_id=str(getattr(dataset, "StudyID", "") or "") or None,
                series_instance_uid=str(getattr(dataset, "SeriesInstanceUID", "") or "") or None,
                modality=str(getattr(dataset, "Modality", "") or "") or None,
                study_date=str(getattr(dataset, "StudyDate", "") or "") or None,
            )
            pixels = dataset.pixel_array.astype(np.float32)
            low, high = float(pixels.min()), float(pixels.max())
            scale = 255 / (high - low) if high > low else 1
            image = Image.fromarray(((pixels - low) * scale).clip(0, 255).astype(np.uint8)).convert("RGB")
        else:
            image = Image.open(io.BytesIO(payload)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, AttributeError, pydicom.errors.InvalidDicomError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable PNG, JPG, JPEG, or DICOM scan.") from exc
    if image.width < 64 or image.height < 64:
        raise HTTPException(status_code=400, detail="The scan is too small for analysis.")

    prediction = "Pneumonia"
    confidence = 0.94
    simulated = True
    inference_source = "fallback"
    external_status = "External inference blocked: image pixel anonymization cannot be verified."
    try:
        import offline_cv

        local_result = offline_cv.predict("tb", image) if modality == "Tuberculosis" else None
        if local_result:
            prediction = str(local_result.get("verdict") or local_result.get("prediction") or prediction)
            confidence_value = float(local_result.get("confidence", 94))
            confidence = confidence_value / 100 if confidence_value > 1 else confidence_value
            simulated = False
            inference_source = "local"
    except (ImportError, OSError, RuntimeError, ValueError):
        inference_source = "fallback"

    risk = "High" if confidence >= 0.85 and prediction.lower() not in {"normal", "negative"} else "Low"
    if risk == "Low":
        summary = f"Based on the analysis, the model shows {confidence:.1%} confidence for a low-risk finding."
    else:
        summary = f"Based on the analysis, the model shows {confidence:.1%} confidence for {prediction}."
    source = "OFFLINE HEURISTIC" if inference_source == "local" else "SIMULATED"
    if inference_source == "fallback":
        summary = f"{summary} {external_status}"
    model_versions = {
        "Mammography": "Mass_Detection.pt-local-v1",
        "Tuberculosis": "tuberculosis-vit-model-local-v1",
        "Fetal Ultrasound": "fetal-brain-plane-cnn-local-v1",
    }
    response = InferenceResponse(
        case_id=f"PE-{uuid4().hex[:8].upper()}",
        modality=modality,
        source=source,
        review_required=confidence < 0.85,
        timestamp=datetime.now(timezone.utc).isoformat(),
        sync_status="LOCAL_ONLY",
        prediction=prediction,
        confidence=confidence,
        heatmap_url=create_heatmap(image),
        risk_level=risk,
        summary=summary,
        care_suggestions=CareSuggestions(
            rest="Get plenty of rest.",
            diet="Eat a balanced diet.",
            hydration="Stay hydrated.",
            warning_signs="If you experience difficulty breathing, seek immediate care.",
            follow_up="Consult a doctor within 24 hours.",
        ),
        disclaimer=DISCLAIMER,
        model_version=model_versions[modality],
        simulated=simulated,
        dicom_metadata=dicom_metadata,
        provenance=Provenance(
            model_name=model_versions[modality].rsplit("-local-v1", 1)[0],
            model_version=model_versions[modality],
            inference_source=inference_source,
            timestamp=datetime.now(timezone.utc).isoformat(),
            human_review="pending",
        ),
    )
    persist_result(response)
    return response
