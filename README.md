# Pink Edge AI Frontend

This folder contains the Next.js web application for the Pink Edge AI clinical imaging dashboard. The frontend lets clinicians upload medical scans, review AI-assisted findings, inspect provenance data, and send manual review decisions back to the backend API.

## Features

- Upload PNG, JPG, JPEG, and DICOM image files
- Select a modality: Mammography, Tuberculosis, or Fetal Ultrasound
- View AI predictions, confidence, risk level, and summary output
- Review local cache/history and saved case results
- Show heatmap overlays and inference provenance metadata
- Offline-friendly workflow with local caching and simulated sync behavior
- Patient dashboard, report view, and AI assistant UI

## Tech stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide React icons

## Prerequisites

- Node.js 18 or newer
- npm
- A running backend API on `http://127.0.0.1:8000` or a custom API URL

## Setup

```bash
cd frontend
npm install
```

Create a local environment file if needed:

```bash
cp .env.local.example .env.local
```

Example `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production build

```bash
npm run build
npm run start
```

## Project structure

```text
frontend/
├── src/
│   ├── app/
│   └── ...
├── .env.local.example
├── package.json
├── tsconfig.json
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
└── README.md
```

## API connection

The frontend calls the backend endpoints such as:

- `POST /predict`
- `POST /results/{case_id}/review`
- `GET /health`
- `GET /ready`

If the backend is running on a different host or port, update `NEXT_PUBLIC_API_URL` in your `.env.local` file.

## Notes

- This app is designed for a demo/clinical workflow and includes simulated fallback behavior when external inference is unavailable.
- Use it with the FastAPI backend in the `backend/` folder for the full workflow.
