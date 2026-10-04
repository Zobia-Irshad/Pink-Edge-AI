from typing import Literal

from pydantic import BaseModel, Field


class CareSuggestions(BaseModel):
    rest: str
    diet: str
    hydration: str
    warning_signs: str
    follow_up: str


class DicomMetadata(BaseModel):
    patient_id: str | None = None
    study_id: str | None = None
    series_instance_uid: str | None = None
    modality: str | None = None
    study_date: str | None = None


class Provenance(BaseModel):
    model_name: str
    model_version: str
    inference_source: Literal["local", "external", "fallback"]
    timestamp: str
    human_review: Literal["pending", "accepted", "modified", "rejected"] = "pending"


class ReviewUpdate(BaseModel):
    decision: Literal["accepted", "modified", "rejected"]
    reviewer: str = "Clinical reviewer"
    note: str | None = None


class InferenceResponse(BaseModel):
    case_id: str
    modality: str
    source: Literal["REAL MODEL", "OFFLINE HEURISTIC", "SIMULATED"]
    review_required: bool
    timestamp: str
    sync_status: Literal["LOCAL_ONLY", "QUEUED"]
    prediction: str
    confidence: float = Field(ge=0, le=1)
    heatmap_url: str | None = None
    risk_level: Literal["Low", "Moderate", "High"]
    summary: str
    care_suggestions: CareSuggestions
    disclaimer: str
    model_version: str
    simulated: bool = False
    dicom_metadata: DicomMetadata | None = None
    provenance: Provenance
    review: ReviewUpdate | None = None
