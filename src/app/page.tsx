"use client";

import { ChangeEvent, useState } from "react";
import { Activity, ArrowRight, Bot, CalendarDays, Camera, Cpu, Database, Download, FileBarChart, FileImage, Github, Grid2X2, HeartPulse, Mail, Pencil, Plus, ScanLine, Search, Settings, ShieldCheck, UploadCloud, Users, WifiOff, Zap, UserCheck, FileText, Layers3, CheckCircle2, X, ChevronRight, FileDown, Phone, ExternalLink, Paperclip, Send, Mic, MessageCircle, Save } from "lucide-react";

type Page = "Dashboard" | "Scans" | "Patients" | "Reports" | "AI Assistant" | "Settings";
type Result = { case_id: string; modality: string; source: string; review_required: boolean; timestamp: string; sync_status: string; model_version: string; prediction: string; confidence: number; risk_level: string; summary: string; disclaimer: string; simulated: boolean; heatmap_url?: string };
type ResultReview = { decision: "accepted" | "modified" | "rejected"; reviewer: string; note?: string };
type ResultProvenance = { model_name: string; model_version: string; inference_source: "local" | "external" | "fallback"; timestamp: string; human_review: "pending" | "accepted" | "modified" | "rejected" };
type DicomMetadata = { patient_id?: string; study_id?: string; series_instance_uid?: string; modality?: string; study_date?: string };
type ResultWithAudit = Result & { provenance: ResultProvenance; dicom_metadata?: DicomMetadata; review?: ResultReview | null };
type HistoryItem = ResultWithAudit & { id: string; filename: string; timestamp: string };
type Patient = { id: string; name: string; age: string; gender: string; dob: string; finding: string; confidence: number; report: "Signed Off" | "Draft"; contact: string; email: string };
type AssistantMessage = { id: string; role: "user" | "assistant"; text: string; time: string; attachment?: string };
type ClinicalProfile = { fullName: string; role: string; email: string; license: string; clinic: string; avatarUrl?: string };

const navigation: { label: Page; icon: typeof Grid2X2 }[] = [
  { label: "Dashboard", icon: Grid2X2 }, { label: "Scans", icon: Activity }, { label: "Patients", icon: Users },
  { label: "Reports", icon: FileBarChart }, { label: "AI Assistant", icon: Bot }, { label: "Settings", icon: Settings }
];

const models = [
  ["Mammography", "Mass_Detection.pt", "RsGoksel/Breast-Tumor-Mass-Detection", "Apache-2.0", "Detection and preliminary triage only; not breast-cancer diagnosis or BI-RADS prediction."],
  ["Tuberculosis", "tuberculosis-vit-model", "sukhmani1303/tuberculosis-vit-model", "Apache-2.0", "Vision Transformer for offline chest X-ray TB classification."],
  ["Fetal Ultrasound", "fetal-brain-plane-cnn", "shr3m/fetal-brain-plane-cnn", "Model checkpoint", "Four fetal brain-plane types; not general maternal health assessment."]
];

const features = [
  ["Offline inference", "Internet-off local model execution"], ["Input adapter", "JPG, PNG and DICOM uploads"], ["Standard result", "Case ID, modality, model/version, finding, confidence, source, review flag and timestamp"], ["Provenance", "REAL MODEL, OFFLINE HEURISTIC or SIMULATED"], ["Uncertainty", "Human review required at low confidence"], ["Triage rules", "Rules give referral suggestions separately"], ["PDF reports", "Structured report generation"], ["Traceability", "SQLite audit trail with review and sync status"], ["Privacy", "Local anonymization mechanisms"], ["Heuristic fallback", "Clearly labelled, never presented as clinical probability"], ["Sync queue", "GSM/cloud handoff is simulated"]
];

const demoFlow = ["Turn internet off", "Upload test image", "Run local model", "View model, finding, confidence and source", "Human-review prompt if confidence is low", "Generate PDF", "Save to local cache", "Reconnect and show the simulated sync queue"];
const starterPatients: Patient[] = [
  { id: "RAD-2026-9102", name: "Aamina Bibi", age: "54", gender: "Female", dob: "1972-05-12", finding: "Pneumonia Focus", confidence: .94, report: "Signed Off", contact: "+92 300 0000000", email: "aamina@example.com" },
  { id: "RAD-2026-9101", name: "Muhammad Ali", age: "31", gender: "Male", dob: "1995-02-19", finding: "Bone Fracture", confidence: .98, report: "Draft", contact: "+92 301 0000000", email: "muhammad@example.com" },
  { id: "RAD-2026-9100", name: "Zainab Khan", age: "28", gender: "Female", dob: "1998-03-03", finding: "No acute abnormality detected", confidence: .99, report: "Signed Off", contact: "+92 302 0000000", email: "zainab@example.com" }
];
const defaultClinicalProfile: ClinicalProfile = { fullName: "Dr. Umer", role: "Head Radiologist", email: "umer@radiai.com", license: "CA-MED-849201", clinic: "St. Jude Medical Center" };

export default function Home() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResultWithAudit | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [offlineMode, setOfflineMode] = useState(true);
  const [selectedModel, setSelectedModel] = useState("Tuberculosis");
  const [cachedAt, setCachedAt] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>(starterPatients);
  const [patientModal, setPatientModal] = useState(false);
  const [patientStep, setPatientStep] = useState<1 | 2>(1);
  const [patientForm, setPatientForm] = useState({ name: "", age: "", gender: "Male", dob: "", id: `RAD-${new Date().getFullYear()}-8003`, contact: "", email: "", finding: "Pending review" });
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile>(() => {
    if (typeof window === "undefined") return defaultClinicalProfile;
    try {
      const raw = localStorage.getItem("pink-edge-settings-profile");
      if (!raw) return defaultClinicalProfile;
      const parsed = JSON.parse(raw) as Partial<ClinicalProfile>;
      return {
        fullName: parsed.fullName || defaultClinicalProfile.fullName,
        role: parsed.role || defaultClinicalProfile.role,
        email: parsed.email || defaultClinicalProfile.email,
        license: parsed.license || defaultClinicalProfile.license,
        clinic: parsed.clinic || defaultClinicalProfile.clinic,
        avatarUrl: parsed.avatarUrl
      };
    } catch {
      return defaultClinicalProfile;
    }
  });
  const [profileSavedAt, setProfileSavedAt] = useState("");
  const [profileNotice, setProfileNotice] = useState("");

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null); setResult(null); setError("");
  }
  async function analyzeScan() {
    if (!file) return;
    setAnalyzing(true); setError("");
    try {
      const body = new FormData(); body.append("file", file); body.append("modality", selectedModel);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/predict`, { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail ?? "The scan could not be analyzed.");
      const next = payload as ResultWithAudit; setResult(next);
      setHistory(items => [{ ...next, id: crypto.randomUUID(), filename: file.name, timestamp: new Date().toLocaleString() }, ...items]);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The scan could not be analyzed."); }
    finally { setAnalyzing(false); }
  }
  function saveToLocalCache() {
    if (!result || !file) return;
    const savedAt = new Date().toLocaleString();
    localStorage.setItem("pink-edge-ai-cache", JSON.stringify({ result, filename: file.name, model: selectedModel, savedAt }));
    setCachedAt(savedAt);
  }
  async function reviewResult(decision: ResultReview["decision"], note = "") {
    if (!result) return;
    try {
      const response = await fetch(`${apiOrigin}/results/${result.case_id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewer: clinicalProfile.fullName || "Clinical reviewer", note: note || undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "The review could not be saved.");
      const reviewed = payload as ResultWithAudit;
      setResult(reviewed);
      setHistory(items => items.map(item => item.case_id === reviewed.case_id ? { ...item, ...reviewed } : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The review could not be saved.");
    }
  }
  function printReport(item: ResultWithAudit) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("Allow pop-ups to generate the PDF report.");
      return;
    }
    printWindow.document.write(`<html><head><title>Pink Edge AI Report ${item.case_id}</title><style>body{font-family:Arial;padding:32px;color:#152235}h1{color:#075b86}section{border:1px solid #ccd6df;padding:16px;margin:14px 0}small{color:#5c6d7c}</style></head><body><h1>Pink Edge AI — Clinical Imaging Report</h1><p><b>Case ID:</b> ${item.case_id}<br><b>Modality:</b> ${item.modality}<br><b>Generated:</b> ${item.timestamp}</p><section><h2>AI Assessment</h2><p><b>Finding:</b> ${item.prediction}<br><b>Confidence:</b> ${(item.confidence * 100).toFixed(1)}%<br><b>Source:</b> ${item.source}</p></section><section><h2>Result Provenance</h2><p><b>Model:</b> ${item.provenance.model_name}<br><b>Version:</b> ${item.provenance.model_version}<br><b>Inference:</b> ${item.provenance.inference_source}<br><b>Human review:</b> ${item.provenance.human_review}</p></section><section><h2>Final Reviewed Status</h2><p>${item.review?.decision || "Pending human review"}${item.review?.note ? ` — ${item.review.note}` : ""}</p></section><p><small>${item.disclaimer}</small></p></body></html>`);
    printWindow.document.close();
    printWindow.print();
  }
  function updateProfile(field: keyof ClinicalProfile, value: string) {
    setClinicalProfile(current => ({ ...current, [field]: value }));
  }
  function discardProfileChanges() {
    setClinicalProfile(defaultClinicalProfile);
    setProfileSavedAt("");
    setProfileNotice("Changes discarded.");
  }
  function saveProfileSettings() {
    if (!clinicalProfile.fullName.trim() || !clinicalProfile.role.trim()) {
      setProfileNotice("Full Name and Title / Role are required.");
      return;
    }
    localStorage.setItem("pink-edge-settings-profile", JSON.stringify(clinicalProfile));
    setProfileSavedAt(new Date().toLocaleString());
    setProfileNotice("Profile & clinic details saved.");
  }
  function updateProfileAvatar(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setProfileNotice("Please select a valid image file.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setProfileNotice("Profile photo must be smaller than 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setClinicalProfile(current => ({ ...current, avatarUrl: reader.result as string }));
        setProfileNotice("Profile photo updated. Save Configuration to apply.");
      }
    };
    reader.readAsDataURL(selected);
  }
  function downloadReport(item: ResultWithAudit, name = file?.name || "scan") {
    const content = ["PINK EDGE AI — PRELIMINARY REPORT", `Case ID: ${item.case_id}`, `Modality: ${item.modality}`, `Finding: ${item.prediction}`, `Confidence: ${(item.confidence * 100).toFixed(1)}%`, `Source: ${item.source}`, `Review required: ${item.review_required ? "Yes" : "No"}`, `Sync status: ${item.sync_status}`, `Risk: ${item.risk_level}`, `Timestamp: ${item.timestamp}`, `Summary: ${item.summary}`, "", "RESULT PROVENANCE", `Model name: ${item.provenance.model_name}`, `Model version: ${item.provenance.model_version}`, `Inference source: ${item.provenance.inference_source}`, `Human review: ${item.provenance.human_review}`, "", "FINAL REVIEWED STATUS", item.review?.decision || "pending", item.review?.note || "", "", item.dicom_metadata ? `DICOM PatientID: ${item.dicom_metadata.patient_id || ""}\nDICOM StudyID: ${item.dicom_metadata.study_id || ""}\nDICOM Series UID: ${item.dicom_metadata.series_instance_uid || ""}\nDICOM Modality: ${item.dicom_metadata.modality || ""}\nDICOM StudyDate: ${item.dicom_metadata.study_date || ""}` : "", "", item.disclaimer].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/plain" })); link.download = `${name.replace(/\.[^.]+$/, "")}-report.txt`; link.click(); URL.revokeObjectURL(link.href);
  }
  function savePatient() {
    if (!patientForm.name.trim() || !patientForm.age.trim() || !patientForm.id.trim()) return;
    const patient: Patient = { ...patientForm, confidence: 0, report: "Draft" };
    setPatients(items => [patient, ...items.filter(item => item.id !== patient.id)]);
    setPatientModal(false);
    setPatientStep(1);
  }
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const titles: Record<Page, string> = { Dashboard: "Clinical overview", Scans: "Scan workspace", Patients: "Patient directory", Reports: "Clinical reports", "AI Assistant": "Clinical assistant", Settings: "Workspace settings" };

  return <main className="app-grid">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><HeartPulse size={24} /></div><div><div className="brand-name">Pink Edge AI</div><div className="eyebrow">Clinical intelligence</div></div></div><nav className="nav" aria-label="Primary navigation">{navigation.map(({ label, icon: Icon }) => <button className={page === label ? "active" : ""} key={label} onClick={() => setPage(label)}><Icon size={19} /><span>{label}</span></button>)}</nav><div className="status-card"><div className="eyebrow">System status</div><p><span className="dot" />All systems operational</p></div></aside>
    <section className="content"><header className="topbar"><div><div className="eyebrow">Workspace / {page}</div><strong>{titles[page]}</strong></div><div className="secure"><span className="eyebrow">SECURE SESSION</span><ShieldCheck size={18} color="var(--green)" /></div></header>
      {page === "Dashboard" && <Dashboard file={file} result={result} error={error} analyzing={analyzing} offlineMode={offlineMode} setOfflineMode={setOfflineMode} selectedModel={selectedModel} setSelectedModel={setSelectedModel} cachedAt={cachedAt} selectFile={selectFile} analyzeScan={analyzeScan} saveToLocalCache={saveToLocalCache} />}
      {page === "Scans" && <section className="section workspace-section"><div className="pill"><span className="dot" />ANALYSIS WORKSPACE</div><h1 className="workspace-heading">Review and analyze scans.</h1><div className="workflow-controls"><label className="model-select"><span className="eyebrow">LOCAL MODEL</span><select value={selectedModel} onChange={event => setSelectedModel(event.target.value)}><option>Mammography</option><option>Tuberculosis</option><option>Fetal Ultrasound</option></select></label><button className={offlineMode ? "offline-toggle active" : "offline-toggle"} onClick={() => setOfflineMode(value => !value)}><WifiOff size={15} /> Internet {offlineMode ? "off" : "on"}</button></div><UploadPanel file={file} selectFile={selectFile} selectedModel={selectedModel} /><div className="button-row"><button className="primary-button" disabled={!file || analyzing} onClick={analyzeScan}>{analyzing ? "Running local model..." : "Run local model"} <Cpu size={16} /></button>{result && <button className="secondary-button" onClick={saveToLocalCache} disabled={!result}>Save to local cache <Database size={16} /></button>}{error && <p className="error-text">{error}</p>}{cachedAt && <span className="cache-confirmation">Saved locally · {cachedAt}</span>}</div>{result && <ResultCard result={result} heatmapUrl={result.heatmap_url ? `${apiOrigin}${result.heatmap_url}` : undefined} onDownload={() => downloadReport(result)} onReview={reviewResult} onPrint={() => printReport(result)} />}</section>}
      {page === "Reports" && <ReportWorkspace history={history} onDownload={item => downloadReport(item, item.filename)} onOpenScans={() => setPage("Scans")} />}
      {page === "Patients" && <PatientDirectory patients={patients} search={patientSearch} setSearch={setPatientSearch} onAdd={() => { setPatientStep(1); setPatientModal(true); }} onEdit={patient => { setPatientForm(patient); setPatientStep(1); setPatientModal(true); }} onDownload={patient => downloadPatient(patient)} />}
      {page === "AI Assistant" && <AssistantWorkspace onOpenScans={() => setPage("Scans")} />}
      {page === "Settings" && <SettingsProfileSection profile={clinicalProfile} onChange={updateProfile} onAvatarChange={updateProfileAvatar} onDiscard={discardProfileChanges} onSave={saveProfileSettings} savedAt={profileSavedAt} notice={profileNotice} />}
    </section>
    {patientModal && <PatientModal step={patientStep} setStep={setPatientStep} form={patientForm} setForm={setPatientForm} onClose={() => setPatientModal(false)} onSave={savePatient} />}
  </main>;

  function downloadPatient(patient: Patient) {
    const content = ["PINK EDGE AI — PATIENT RECORD", `Patient: ${patient.name}`, `MRN / Patient ID: ${patient.id}`, `Age / Gender: ${patient.age} / ${patient.gender}`, `Date of birth: ${patient.dob}`, `Finding: ${patient.finding}`, `Confidence: ${(patient.confidence * 100).toFixed(1)}%`, `Report: ${patient.report}`, "", "For research and demonstration purposes only. Not for clinical decision-making."].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/plain" })); link.download = `${patient.id}-patient-report.txt`; link.click(); URL.revokeObjectURL(link.href);
  }
}

function PatientDirectory({ patients, search, setSearch, onAdd, onEdit, onDownload }: { patients: Patient[]; search: string; setSearch: (value: string) => void; onAdd: () => void; onEdit: (patient: Patient) => void; onDownload: (patient: Patient) => void }) {
  const filtered = patients.filter(patient => `${patient.name} ${patient.id} ${patient.finding}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="section workspace-section patients-page">
    <div className="patient-heading"><div><div className="pill"><Users size={14} /> PATIENT MANAGEMENT</div><h1 className="workspace-heading">Patient Directory</h1><p className="patient-subtitle">Manage patient demographics, diagnostic reports, and clinical imaging records.</p></div><div className="patient-tools"><div className="card search-card"><Search size={17} color="var(--muted)" /><input aria-label="Search patients" placeholder="Search patients..." value={search} onChange={event => setSearch(event.target.value)} /></div><button className="primary-button" onClick={onAdd}><Plus size={16} /> Add Patient Detail</button></div></div>
    <div className="patient-stats"><div className="patient-stat active"><Users size={17} color="var(--cyan)" /><span>Total patients</span><strong>{patients.length}</strong><small>All registered patient records</small><em>ALL PATIENTS</em></div><div className="patient-stat"><FileText size={17} color="var(--muted)" /><span>Linked reports</span><strong>{patients.length}</strong><small>Patients with attached reports</small></div><div className="patient-stat critical"><Zap size={17} color="var(--cyan)" /><span>Critical reports</span><strong>{patients.filter(patient => patient.report === "Draft").length}</strong><small>Requires physician review</small></div></div>
    <div className="patient-table card"><div className="patient-table-header"><div><h2>Registered Patients</h2><span>Patient records and linked diagnostic intelligence.</span></div><em>{filtered.length} RECORDS</em></div><div className="patient-table-scroll"><table><thead><tr><th>Patient</th><th>Age / Gender</th><th>Date of birth</th><th>Diagnostic finding</th><th>Confidence</th><th>Report</th><th>Actions</th></tr></thead><tbody>{filtered.map(patient => <tr key={patient.id}><td><strong>{patient.name}</strong><small>{patient.id}</small></td><td>{patient.age} / {patient.gender}</td><td>{patient.dob}</td><td><b>{patient.finding}</b></td><td><div className="patient-confidence"><span>{(patient.confidence * 100).toFixed(0)}%</span><i><b style={{ width: `${patient.confidence * 100}%` }} /></i></div></td><td><span className={`report-badge ${patient.report === "Draft" ? "draft" : ""}`}><span />{patient.report}</span></td><td><div className="patient-actions"><button onClick={() => onEdit(patient)} title="Edit patient"><Pencil size={13} /> Edit</button><button onClick={() => onDownload(patient)} title="Download report"><FileDown size={13} /> PDF</button><button onClick={() => onEdit(patient)} title="Open patient">Open <ChevronRight size={13} /></button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <Empty icon={Users} title="No matching patients" text="Try a different name, patient ID, or finding." />}</div></div>
  </section>;
}

function AssistantWorkspace({ onOpenScans }: { onOpenScans: () => void }) {
  const [sessions, setSessions] = useState(["PT-8892 MRI Analysis", "Aamina Bibi Report", "Bone Fracture Consult", "Thoracic Screening"]);
  const [activeSession, setActiveSession] = useState("Thoracic Screening");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { id: "welcome", role: "assistant", text: "I can help explain preliminary model findings, confidence, report fields, and next workflow steps. Share a question or attach a doctor's audio note for review.", time: "03:00 PM" }
  ]);
  const [query, setQuery] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);

  function assistantReply(question: string) {
    const normalized = question.toLowerCase();
    if (normalized.includes("confidence")) return "Confidence is a model score, not clinical certainty. Low-confidence results should be reviewed by a qualified clinician alongside the source image and patient context.";
    if (normalized.includes("report") || normalized.includes("pdf")) return "You can open Reports after a scan is analyzed. The report includes the case ID, model provenance, finding, confidence, review status, sync status, and disclaimer.";
    if (normalized.includes("tb") || normalized.includes("tuberculosis")) return "The tuberculosis model provides preliminary chest X-ray classification support. It does not replace clinical assessment, laboratory testing, or specialist review.";
    if (normalized.includes("audio") || normalized.includes("doctor")) return "The audio note is attached to this local assistant session. Audio transcription is not enabled in this prototype, so please verify the note manually before using it in a report.";
    return "I can help with confidence interpretation, model provenance, report structure, offline workflow, or human-review steps. Ask one of those questions and I will provide bounded workflow guidance.";
  }

  function sendMessage(text = query, attachment?: string) {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const visibleText = trimmed || "Doctor audio note attached for review.";
    setMessages(current => [...current, { id: crypto.randomUUID(), role: "user", text: visibleText, time: now, attachment }, { id: crypto.randomUUID(), role: "assistant", text: attachment ? assistantReply("audio doctor note") : assistantReply(trimmed), time: now }]);
    setQuery("");
    setAudioFile(null);
  }

  function attachAudio(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setAudioFile(selected);
  }

  function startSession() {
    const name = `New clinical query ${sessions.length + 1}`;
    setSessions(current => [name, ...current]);
    setActiveSession(name);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", text: "New offline assistant session started. What would you like to review?", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
  }

  return <section className="section workspace-section assistant-page">
    <div className="assistant-shell">
      <aside className="assistant-sessions card"><div className="assistant-sessions-heading"><div><h2>Sessions</h2><span>{sessions.length} ACTIVE CONTEXTS</span></div><button aria-label="Start new session" onClick={startSession}><Plus size={16} /></button></div><div className="session-list">{sessions.map(session => <button key={session} className={activeSession === session ? "session-item active" : "session-item"} onClick={() => setActiveSession(session)}><strong>{session}</strong><small>{session === activeSession ? "Today, 03:00 PM" : "Previous session"} <CheckCircle2 size={12} /></small></button>)}</div><div className="assistant-session-note"><span className="dot" />Local context only<br /><small>Session history is held in this browser.</small></div></aside>
      <div className="assistant-chat card"><header className="assistant-chat-header"><div><div className="assistant-title"><Bot size={18} color="var(--cyan)" /><strong>Pink Edge AI Assistant</strong></div><span><span className="dot" />Offline workflow guidance · bounded prototype</span></div><span className="context-chip">CONTEXT: {activeSession.split(" ")[0]}</span></header><div className="assistant-messages"><div className="assistant-start">SESSION INITIATED · {new Date().toLocaleDateString()}</div>{messages.map(message => <div key={message.id} className={`chat-message ${message.role}`}><div className="chat-avatar">{message.role === "assistant" ? <Bot size={14} /> : "DR"}</div><div className="chat-bubble"><div className="chat-bubble-label">{message.role === "assistant" ? "Pink Edge AI" : "Doctor"} <small>{message.time}</small></div><p>{message.text}</p>{message.attachment && <span className="audio-attachment"><Mic size={13} />{message.attachment}</span>}</div></div>)}</div><div className="assistant-quick"><span>Suggested queries</span><button onClick={() => sendMessage("How should I interpret the confidence?")}>Explain confidence</button><button onClick={() => sendMessage("How do I prepare the report?")}>Report fields</button><button onClick={onOpenScans}>Open scan workspace</button></div><div className="assistant-compose">{audioFile && <div className="audio-pending"><Mic size={13} />{audioFile.name}<button onClick={() => setAudioFile(null)} aria-label="Remove audio"><X size={12} /></button></div>}<div className="compose-row"><label className="icon-button" title="Attach doctor audio"><Paperclip size={18} /><input type="file" accept="audio/*" onChange={attachAudio} /></label><input aria-label="Message assistant" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") sendMessage(); }} placeholder="Ask about a finding, confidence, or report..." /><label className="icon-button" title="Attach audio note"><Mic size={17} /><input type="file" accept="audio/*" onChange={attachAudio} /></label><button className="send-button" aria-label="Send message" onClick={() => sendMessage()}><Send size={16} /></button></div></div><footer className="assistant-disclaimer">Pink Edge AI can make mistakes. Verify findings with standard diagnostic protocol and qualified clinical review.</footer></div>
    </div>
  </section>;
}

function ReportWorkspace({ history, onDownload, onOpenScans }: { history: HistoryItem[]; onDownload: (item: HistoryItem) => void; onOpenScans: () => void }) {
  const [selectedId, setSelectedId] = useState(history[0]?.id ?? "");
  const [decision, setDecision] = useState<"pending" | "agree" | "override">("pending");
  const [overrideReason, setOverrideReason] = useState("");
  const selected = history.find(item => item.id === selectedId) ?? history[0];

  if (!selected) {
    return <section className="section workspace-section reports-page">
      <div className="report-page-heading"><div><div className="pill"><FileBarChart size={14} /> REPORT WORKSPACE</div><h1 className="workspace-heading">Clinical Report Workspace</h1><p className="patient-subtitle">Real reports appear here after a scan has been analyzed.</p></div></div>
      <div className="card report-empty"><FileBarChart size={40} color="var(--cyan)" /><h2>No reports yet</h2><p>Analyze a JPG, PNG, or DICOM scan to create a traceable report with the model result, confidence, provenance, review state, and timestamp.</p><button className="primary-button" onClick={onOpenScans}>Open Scan Workspace <ArrowRight size={16} /></button></div>
    </section>;
  }

  const confidence = `${(selected.confidence * 100).toFixed(1)}%`;
  const reportStatus = decision === "agree" ? "Approved" : decision === "override" ? "LHV override" : selected.review_required ? "Human review required" : "Pending";
  const recommendation = selected.risk_level === "Low" ? "Monitor — Low Risk" : selected.risk_level === "Moderate" ? "Refer — Moderate Risk" : "Refer — High Risk";
  return <section className="section workspace-section reports-page">
    <div className="report-page-heading"><div><div className="pill"><FileBarChart size={14} /> REPORT WORKSPACE</div><h1 className="workspace-heading">Clinical Report Workspace</h1><p className="patient-subtitle">Traceable preliminary findings from the local imaging workflow.</p></div><div className="report-search"><Search size={16} color="var(--muted)" /><input aria-label="Search patient or report" placeholder="Search patient name or MRN..." /><button className="secondary-button">All analyses</button></div></div>
    <div className="report-identity card"><div><span className="report-status-label"><span />{selected.source}</span><h2>{selected.prediction}</h2><small>{selected.modality} · {selected.case_id}</small></div><div className="report-identity-grid"><span>MODEL VERSION<b>{selected.model_version}</b></span><span>CONFIDENCE<b>{confidence}</b></span><span>REVIEW STATUS<b>{reportStatus}</b></span><span>SYNC STATUS<b>{selected.sync_status}</b></span></div><button className="secondary-button" onClick={() => onDownload(selected)}><Download size={14} /> Export Report</button></div>
    <div className="report-tabs"><button className="active">Report Workspace</button><button>Audit Trail</button><span>{new Date(selected.timestamp).toLocaleString()}</span></div>
    <div className="report-layout"><div className="report-main">
      <article className="card report-section-card"><div className="report-section-title"><FileText size={16} color="var(--cyan)" /><div><h3>Clinical Summary</h3><span>Generated from the submitted scan and model response.</span></div></div><p>{selected.summary}</p></article>
      <article className="card report-section-card"><div className="report-section-title"><Activity size={16} color="var(--cyan)" /><div><h3>AI Findings &amp; Confidence</h3><span>Preliminary model output for clinician review.</span></div><span className="report-source-chip">{selected.source}</span></div><div className="report-metrics"><div><span>CONFIDENCE SCORE</span><strong>{confidence}</strong></div><div><span>MODEL FINDING</span><strong>{selected.prediction}</strong></div><div><span>REVIEW STATE</span><strong>{selected.review_required ? "REQUIRED" : "PENDING"}</strong></div></div>{selected.heatmap_url ? <img className="report-heatmap" src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}${selected.heatmap_url}`} alt="Generated model heatmap" /> : <div className="report-artifact-placeholder">No explainability artifact was returned for this report.</div>}<div className="report-finding"><span>FINDING</span><p>{selected.summary}</p></div></article>
      <article className="card report-section-card override-card"><div className="report-section-title"><UserCheck size={16} color="var(--cyan)" /><div><h3>AI Confidence + Human Override</h3><span>Record the LHV decision for this preliminary recommendation.</span></div></div><div className="recommendation-box"><div><span className="override-label">AI RECOMMENDATION</span><strong>{recommendation}</strong><small>Confidence: {confidence}</small></div><span className="recommendation-dot">AI</span></div><div className="lhv-decision"><span className="override-label">LHV DECISION</span><div><button className={decision === "agree" ? "decision-button selected" : "decision-button"} onClick={() => { setDecision("agree"); setOverrideReason(""); }}>Agree</button><button className={decision === "override" ? "decision-button override selected" : "decision-button override"} onClick={() => setDecision("override")}>Override</button></div></div>{decision === "override" && <div className="override-reasons"><strong>Reason for override</strong>{["Patient history", "Image quality", "Clinical symptoms", "Other"].map(reason => <label key={reason}><input type="radio" name={`override-${selected.id}`} checked={overrideReason === reason} onChange={() => setOverrideReason(reason)} /> <span />{reason}</label>)}</div>}{decision !== "pending" && <p className="decision-confirmation">{decision === "agree" ? "LHV decision recorded: Approved." : overrideReason ? `LHV decision recorded: override due to ${overrideReason.toLowerCase()}.` : "Select an override reason to complete the decision."}</p>}<p className="muted-report">This report contains preliminary AI-assisted screening support. A qualified clinician must review the source image and context before any care decision.</p></article>
      <article className={decision === "agree" ? "card report-final-card approved" : "card report-final-card"}><div className="report-section-title"><ShieldCheck size={16} color={decision === "agree" ? "var(--green)" : "var(--red)"} /><div><h3>{decision === "agree" ? "Approved by LHV" : "Review Required"}</h3><span>{decision === "agree" ? "The LHV agreed with the AI recommendation." : "Final interpretation is not provided by this prototype."}</span></div><span className={decision === "agree" ? "approved-chip" : "critical-chip"}>{decision === "agree" ? "APPROVED" : "PRELIMINARY"}</span></div><p>{selected.disclaimer}</p></article>
    </div><aside className="report-side"><div className="eyebrow">CLINICAL ACTIONS</div><button onClick={() => onDownload(selected)}><Download size={15} /> Export Report <ChevronRight size={14} /></button><button onClick={() => onDownload(selected)}><FileText size={15} /> Save Report <ChevronRight size={14} /></button><button onClick={onOpenScans}><ScanLine size={15} /> New Scan <ChevronRight size={14} /></button><div className="card report-side-card"><h3>Case details</h3><p><span>Case ID</span><b>{selected.case_id}</b></p><p><span>Modality</span><b>{selected.modality}</b></p><p><span>Timestamp</span><b>{new Date(selected.timestamp).toLocaleString()}</b></p><p><span>Source</span><b>{selected.source}</b></p></div><div className="card report-side-card"><h3>Report history</h3>{history.map(item => <button className={item.id === selected.id ? "history-item active" : "history-item"} key={item.id} onClick={() => setSelectedId(item.id)}><span>{item.prediction}</span><small>{item.case_id}</small></button>)}</div></aside></div>
  </section>;
}

function PatientModal({ step, setStep, form, setForm, onClose, onSave }: { step: 1 | 2; setStep: (step: 1 | 2) => void; form: { name: string; age: string; gender: string; dob: string; id: string; contact: string; email: string; finding: string }; setForm: (form: { name: string; age: string; gender: string; dob: string; id: string; contact: string; email: string; finding: string }) => void; onClose: () => void; onSave: () => void }) {
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add Patient Detail">
    <div className="patient-modal"><header><div className="modal-title"><span><Users size={19} /></span><div><h2>Add Patient Detail</h2><small>Patient demographics and linked diagnostic report</small></div></div><button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
      <div className="modal-tabs"><button className={step === 1 ? "active" : ""} onClick={() => setStep(1)}>01 Patient Details</button><button className={step === 2 ? "active" : ""} onClick={() => setStep(2)}>02 Diagnostic Report</button></div>
      {step === 1 ? <div className="modal-body"><div className="form-section-title"><Users size={16} color="var(--cyan)" /><div><strong>Patient Demographics</strong><small>Core identity and contact information.</small></div></div><div className="patient-form-grid"><label>Patient name *<input value={form.name} onChange={event => update("name", event.target.value)} placeholder="Enter patient name" /></label><label>Age *<input value={form.age} onChange={event => update("age", event.target.value)} placeholder="Age" inputMode="numeric" /></label><label>Sex / Gender<select value={form.gender} onChange={event => update("gender", event.target.value)}><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option></select></label><label>MRN / Patient ID *<input value={form.id} onChange={event => update("id", event.target.value)} /></label><label>Date of birth<input value={form.dob} onChange={event => update("dob", event.target.value)} placeholder="dd/mm/yyyy" /><CalendarDays size={14} /></label><label>Contact number<input value={form.contact} onChange={event => update("contact", event.target.value)} placeholder="+92..." /></label><label>Email address<input value={form.email} onChange={event => update("email", event.target.value)} placeholder="patient@example.com" /><Mail size={14} /></label></div><div className="protected-note"><ShieldCheck size={17} color="var(--cyan)" /><div><strong>Protected Patient Record</strong><span>Patient information should only be accessed by authorized clinical personnel.</span></div></div></div> : <div className="modal-body"><div className="form-section-title"><FileText size={16} color="var(--cyan)" /><div><strong>Diagnostic Report</strong><small>Link a preliminary finding to this patient record.</small></div></div><label className="report-field">Diagnostic finding<textarea value={form.finding} onChange={event => update("finding", event.target.value)} placeholder="Enter finding or select after scan analysis" rows={4} /></label><div className="report-link-card"><ScanLine size={18} color="var(--cyan)" /><div><strong>Attach a scan report later</strong><span>Run an analysis from the Scans workspace and link its report using this patient ID.</span></div></div></div>}
      <footer><button className="secondary-button" onClick={onClose}>Cancel</button><div><button className="secondary-button" onClick={() => step === 1 ? setStep(2) : setStep(1)}>{step === 1 ? <>Continue to Report <ChevronRight size={15} /></> : <>Back to Details</>}</button><button className="primary-button" onClick={step === 1 ? onSave : onSave}><CheckCircle2 size={15} /> Save Patient &amp; Report</button></div></footer>
    </div>
  </div>;
}

function SettingsProfileSection({ profile, onChange, onAvatarChange, onDiscard, onSave, savedAt, notice }: { profile: ClinicalProfile; onChange: (field: keyof ClinicalProfile, value: string) => void; onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void; onDiscard: () => void; onSave: () => void; savedAt: string; notice: string }) {
  const initials = profile.fullName.split(" ").map(part => part.trim()[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "DR";
  const configItems = [
    ["Clinical Profile", "Provider identity and affiliation", true],
    ["Account Security", "Authentication and access", false],
    ["AI Preferences", "Diagnostic model configuration", false],
    ["Integration (PACS)", "Hospital system connectivity", false],
    ["Display & Alerts", "Notifications and interface", false]
  ] as const;

  return <section className="section workspace-section settings-page">
    <div className="settings-header card">
      <div><div className="pill"><span className="dot" />SYSTEM ONLINE</div><h1>Pink Edge AI Settings</h1><p>Manage your clinical profile, offline AI preferences, and local workspace configuration.</p></div>
      <div className="settings-actions"><button className="secondary-button" onClick={onDiscard}>Discard Changes</button><button className="primary-button" onClick={onSave}><Save size={15} /> Save Configuration</button></div>
    </div>
    <div className="settings-layout">
    <div className="settings-main">
        <article className="card clinical-profile-card" style={window.innerWidth < 900 ? { width: "100%" } : {}}>
          <div className="clinical-profile-head"><div><h2>Clinical Profile</h2><span>Identity and professional information displayed across the clinical platform.</span></div>{savedAt && <em>Saved locally · {savedAt}</em>}</div>
          <div className="clinical-profile-body">
            <label className="profile-photo" title="Upload profile photo"><div>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="Clinical profile" /> : initials}<span className="profile-camera"><Camera size={14} /></span></div><span>PROFILE PHOTO</span><small>JPG, PNG · Max 5 MB</small><input type="file" accept="image/png,image/jpeg" onChange={onAvatarChange} hidden /></label>
            <div className="profile-form-grid">
              <label><span>FULL NAME</span><input value={profile.fullName} onChange={event => onChange("fullName", event.target.value)} /></label>
              <label><span>TITLE / ROLE</span><input value={profile.role} onChange={event => onChange("role", event.target.value)} /></label>
              <label><span>EMAIL ADDRESS</span><input type="email" value={profile.email} onChange={event => onChange("email", event.target.value)} /></label>
              <label><span>MEDICAL LICENSE NO.</span><input value={profile.license} onChange={event => onChange("license", event.target.value)} /></label>
              <label className="full"><span>PRIMARY AFFILIATION / CLINIC</span><input value={profile.clinic} onChange={event => onChange("clinic", event.target.value)} /></label>
            </div>
          </div>
          <div className="profile-preview"><div className="preview-left"><span>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}</span><div><strong>{profile.fullName}</strong><small>{profile.role}</small></div></div><b><span className="dot" />PROFILE READY</b></div>
        </article>
        {notice && <p className="settings-notice">{notice}</p>}
      </div>
    </div>
  </section>;
}

function Dashboard({ file, result, error, analyzing, offlineMode, setOfflineMode, selectedModel, setSelectedModel, cachedAt, selectFile, analyzeScan, saveToLocalCache }: { file: File | null; result: ResultWithAudit | null; error: string; analyzing: boolean; offlineMode: boolean; setOfflineMode: (value: boolean) => void; selectedModel: string; setSelectedModel: (value: string) => void; cachedAt: string; selectFile: (event: ChangeEvent<HTMLInputElement>) => void; analyzeScan: () => void; saveToLocalCache: () => void }) {
  return <><section className="hero"><div><div className="pill"><span className="dot" />ALIBABA CLOUD AI HACKATHON 2026</div><h1><span>Pink Edge AI.</span><br />Triage support<br />built for the edge.</h1><p className="hero-copy">Offline-first AI screening and triage support for medical imaging. Many clinics have limited connectivity and specialist access, so Pink Edge AI runs models locally with the internet turned off.</p><p className="hero-note"><ShieldCheck size={15} /> Preliminary AI triage support, not a diagnostic device.</p><div className="button-row"><button className="primary-button" onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" })}>Start a workflow <ArrowRight size={16} /></button><button className="secondary-button" onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}>Explore platform</button></div></div><div className="analysis-card"><div className="analysis-status"><div className="eyebrow">Local analysis status</div><div className="progress" /><div className="analysis-meta"><span>Internet dependency: <b>{offlineMode ? "None" : "Available"}</b></span><span className="green-text">{offlineMode ? "OFFLINE READY" : "ONLINE"}</span></div></div><div className="model-details"><div className="model-details-heading"><div><div className="eyebrow">Active pathway</div><strong>{selectedModel}</strong></div><span className="model-live"><span className="dot" />LOCAL MODEL</span></div><div className="model-details-grid"><div><Cpu size={16} color="var(--cyan)" /><span>Model</span><b>{selectedModel}</b></div><div><Database size={16} color="var(--cyan)" /><span>Input</span><b>Image / DICOM</b></div><div><ScanLine size={16} color="var(--cyan)" /><span>Result</span><b>Standard contract</b></div><div><Zap size={16} color="var(--cyan)" /><span>Inference</span><b>Local edge hardware</b></div></div><p className="model-note">Every result includes model version, confidence, provenance and a human-review flag.</p></div></div></section><section className="section" id="workflow"><h2 className="section-title">Start a clinical workflow</h2><div className="workflow-controls"><label className="model-select"><span className="eyebrow">SELECT MODEL / MODALITY</span><select value={selectedModel} onChange={event => setSelectedModel(event.target.value)}><option>Mammography</option><option>Tuberculosis</option><option>Fetal Ultrasound</option></select></label><button className={offlineMode ? "offline-toggle active" : "offline-toggle"} onClick={() => setOfflineMode(!offlineMode)}><WifiOff size={15} /> Turn internet {offlineMode ? "off" : "on"}</button></div><div className="cards"><UploadPanel file={file} selectFile={selectFile} selectedModel={selectedModel} /><div className="card"><FileImage size={25} color="var(--cyan)" /><div className="eyebrow">Supported modalities</div><strong>3 pathways</strong><span>Mammography · TB · Fetal ultrasound</span></div><div className="card"><WifiOff size={25} color="var(--green)" /><div className="eyebrow">Connectivity</div><strong>{offlineMode ? "Internet off" : "Internet on"}</strong><span>{offlineMode ? "Ready for local inference" : "Switch off for offline demo"}</span></div></div><div className="button-row"><button className="primary-button" disabled={!file || analyzing} onClick={analyzeScan}>{analyzing ? "Running local model..." : "Run local model"} <Cpu size={16} /></button>{result && <button className="secondary-button" onClick={saveToLocalCache}>Save to local cache <Database size={16} /></button>}{error && <p className="error-text">{error}</p>}{cachedAt && <span className="cache-confirmation">Saved locally · {cachedAt}</span>}</div>{result && <ResultCard result={result} onDownload={() => undefined} />}</section><PlatformInfo /></>;
}

function PlatformInfo() { return <section className="section platform-info" id="about"><div className="eyebrow">PINK EDGE AI / PLATFORM</div><h2 className="info-heading">One local workspace for transparent screening support.</h2><div className="info-grid"><div className="card"><Layers3 size={22} color="var(--cyan)" /><h3>Supported modalities and models</h3>{models.map(model => <div className="model-row" key={model[0]}><strong>{model[0]}</strong><span>{model[1]}</span><small>{model[2]}</small><small>{model[3]}</small><em>{model[4]}</em></div>)}</div><div className="card"><UserCheck size={22} color="var(--green)" /><h3>Key features</h3><div className="feature-list">{features.map(([title, text]) => <div key={title}><CheckCircle2 size={13} color="var(--cyan)" /><strong>{title}</strong><span>{text}</span></div>)}</div></div></div><div className="architecture-title"><div className="eyebrow">ARCHITECTURE</div><span>Simple, inspectable flow from image input to optional sync.</span></div><div className="architecture-strip"><FileText size={20} color="var(--cyan)" /><span>Image input</span><ArrowRight size={15} /><span>Input adapter</span><ArrowRight size={15} /><span>Model adapter<br /><small>Mammo / TB / Fetal US</small></span><ArrowRight size={15} /><span>Standard result</span><ArrowRight size={15} /><span>Triage & uncertainty rules</span><ArrowRight size={15} /><span>PDF + SQLite cache</span><ArrowRight size={15} /><span>Optional sync queue</span></div><div className="demo-flow card"><div className="eyebrow">DEMO FLOW / INTERNET-OFF</div>{demoFlow.map((step, index) => <div key={step}><b>{String(index + 1).padStart(2, "0")}</b><span>{step}</span></div>)}</div><div className="limitations card"><strong>Honest status:</strong> RK3588/NPU is a target deployment platform and is not yet benchmarked on real hardware. GSM/cloud sync is simulated. This is a research/hackathon prototype, not a diagnostic tool, and it is not clinically validated. We use local anonymization and privacy mechanisms and make no HIPAA/GDPR compliance claims.</div><footer className="project-footer"><span>Pink Edge AI team · Alibaba Cloud AI Hackathon 2026</span><a href="#" aria-label="GitHub link placeholder"><Github size={15} /> GitHub</a><span>For research and demonstration purposes only. Not for clinical decision-making.</span></footer></section>; }

function UploadPanel({ file, selectFile, selectedModel }: { file: File | null; selectFile: (event: ChangeEvent<HTMLInputElement>) => void; selectedModel: string }) { return <label className="card upload"><UploadCloud size={25} color="var(--cyan)" /><strong>{file?.name || "Choose a scan"}</strong><span className="eyebrow">PNG, JPG, JPEG or DICOM</span><small className="upload-model">Selected pathway: {selectedModel}</small><input type="file" accept=".png,.jpg,.jpeg,.dcm,.dicom" onChange={selectFile} hidden /></label>; }
function Empty({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) { return <div className="card empty-state"><Icon size={32} color="var(--cyan)" /><strong>{title}</strong><span>{text}</span></div>; }
function ResultCard({ result, heatmapUrl, onDownload, onReview, onPrint }: { result: ResultWithAudit; heatmapUrl?: string; onDownload: () => void; onReview?: (decision: ResultReview["decision"], note?: string) => Promise<void>; onPrint?: () => void }) {
  const [note, setNote] = useState("");
  const reviewed = result.review?.decision ?? result.provenance.human_review;
  return <article className="card result-card"><div className="result-copy"><div className="eyebrow">Preliminary result · {result.source}</div><h2>{result.prediction}</h2><strong>{(result.confidence * 100).toFixed(1)}% confidence · {result.risk_level} risk</strong><p>{result.summary}</p><div className="result-metadata"><span>Case <b>{result.case_id}</b></span><span>Modality <b>{result.modality}</b></span><span>Sync <b>{result.sync_status}</b></span><span className={result.review_required ? "review-required" : "green-text"}>{result.review_required ? "Human review required" : "Review flag clear"}</span></div><section className="result-audit"><div className="eyebrow">Result provenance</div><p><b>{result.provenance.model_name}</b> · {result.provenance.model_version}</p><p>Inference: <b>{result.provenance.inference_source}</b> · Review: <b>{reviewed}</b></p>{result.dicom_metadata && <p>DICOM: {result.dicom_metadata.modality || result.modality} · Study {result.dicom_metadata.study_id || "not provided"} · Date {result.dicom_metadata.study_date || "not provided"}</p>}<div className="button-row"><button className="secondary-button" disabled={!onReview} onClick={() => onReview?.("accepted")}>Accept</button><button className="secondary-button" disabled={!onReview} onClick={() => onReview?.("rejected", note)}>Reject</button><input value={note} onChange={event => setNote(event.target.value)} placeholder="Reviewer note (optional)" aria-label="Reviewer note" /></div></section><div className="button-row"><button className="secondary-button" onClick={onDownload}><Download size={16} /> Export report</button>{onPrint && <button className="secondary-button" onClick={onPrint}><FileDown size={16} /> Print / PDF</button>}</div><p className="disclaimer">{result.disclaimer}</p></div>{heatmapUrl && <img className="heatmap" src={heatmapUrl} alt="Model explainability heatmap" />}</article>; }
