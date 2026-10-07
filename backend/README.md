# Pink Edge AI Backend

This folder contains the FastAPI inference backend copied from the working implementation in `new/`. It handles chest X-ray image validation, DICOM conversion, ResNet inference, Grad-CAM heatmap generation, and clinical health-report output.

## Features

- FastAPI REST API
- DICOM and image upload handling
- Local ResNet model inference
- DICOM and grayscale X-ray validation
- Grad-CAM heatmap artifact generation
- Clinical care suggestions and risk-level reporting
- CORS configuration for local frontend development

## Tech stack

- Python 3.11+
- FastAPI
- Uvicorn
- Pydantic
- Pillow
- NumPy
- PyDICOM
- SQLite

## Prerequisites

- Python 3.10+
- pip

## Setup

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
```

## Run locally

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

```text
http://127.0.0.1:8000
```

## Main endpoints

- `GET /health` — backend health check
- `POST /predict` — upload a chest X-ray or DICOM scan and receive inference output

The prediction response includes the predicted class (`Normal` or `Pneumonia`), confidence, risk level, summary, care suggestions, and a generated heatmap URL.

## Data and artifacts

The app stores:

- Generated heatmaps in `backend/static/`
- Model weights in `backend/app/models/best_model.pth`

## CORS

The backend accepts requests from common local frontend origins such as:

- `http://localhost:3000`
- `http://localhost:3001`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:3001`

You can override or extend allowed origins with the `CORS_ORIGINS` environment variable.

## Project structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── __main__.py
│   ├── assistant_service.py
│   ├── inference.py
│   ├── models/
│   │   └── best_model.pth
│   ├── main.py
│   └── schemas.py
├── Dockerfile
├── requirements.txt
├── README.md
└── ...
```

## Notes

- This backend is designed to work with the Next.js frontend in the `frontend/` folder.
- The frontend should use `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`.
- The model is intended for demo and medical research workflows and should be validated with domain experts before production use.
