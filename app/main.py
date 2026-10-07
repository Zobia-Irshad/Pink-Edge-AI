import os
import io
import base64
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from .schemas import InferenceResponse, ReviewRequest
from .inference import run_inference
from .assistant_service import get_health_report
from .utils import is_valid_xray, dicom_to_image

app = FastAPI(title="CliniVision Inference Backend")

# ---------- CORS (Frontend Localhost Connection) ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/results/{case_id}/review")
async def review_result(case_id: str, review: ReviewRequest):
    if review.decision not in {"accepted", "modified", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review decision must be accepted, modified, or rejected.",
        )

    return {
        "case_id": case_id,
        "review": review.model_dump(),
        "provenance": {"human_review": review.decision},
    }

# Mount static files directory
STATIC_DIR = "static"
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.post("/predict", response_model=InferenceResponse)
async def predict(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="No file uploaded"
        )

    file_bytes = await file.read()
    filename = file.filename or "upload"
    is_dicom = file.content_type == "application/dicom" or filename.lower().endswith(".dcm")

    # ---- Validate that this actually looks like a chest X-ray ----
    try:
        if is_dicom:
            check_image = dicom_to_image(file_bytes).convert('RGB')
        else:
            check_image = Image.open(io.BytesIO(file_bytes)).convert('RGB')
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid or corrupted image file."
        )

    valid, reason = is_valid_xray(check_image)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    try:
        prediction, confidence, heatmap_base64 = run_inference(file_bytes, is_dicom=is_dicom)

        # Save heatmap to static directory
        heatmap_filename = f"{filename}_heatmap.png"
        heatmap_path = os.path.join(STATIC_DIR, heatmap_filename)
        with open(heatmap_path, "wb") as f:
            f.write(base64.b64decode(heatmap_base64))

        report = get_health_report(prediction, confidence)

        return InferenceResponse(
            prediction=prediction,
            confidence=confidence,
            heatmap_url=f"/static/{heatmap_filename}",
            **report
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")