from pydantic import BaseModel
from typing import Optional

class CareSuggestions(BaseModel):
    rest: str
    diet: str
    hydration: str
    warning_signs: str
    follow_up: str

class InferenceResponse(BaseModel):
    prediction: str
    confidence: float
    heatmap_url: str
    risk_level: str
    summary: str
    care_suggestions: CareSuggestions
    disclaimer: str = "This is an AI-assisted preliminary assessment and not a final medical diagnosis. Please consult a qualified doctor."

class ReviewRequest(BaseModel):
    decision: str
    reviewer: str
    note: Optional[str] = None
