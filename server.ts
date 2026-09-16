import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { 
  initialHospitals, 
  initialIncidents, 
  initialPatients, 
  initialTimeline, 
  initialNotifications,
  initialUserAccounts
} from "./src/data/mockData";
import { Patient, Incident, Hospital, TimelineEntry, Notification, UserAccount } from "./src/types";

// ==========================================
// CENTRAL REAL-TIME STATE REPOSITORY
// ==========================================
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "central_store.json");

interface CentralState {
  hospitals: Hospital[];
  incidents: Incident[];
  patients: Patient[];
  timeline: TimelineEntry[];
  notifications: Notification[];
  users: UserAccount[];
}

let centralState: CentralState = {
  hospitals: [...initialHospitals],
  incidents: [...initialIncidents],
  patients: [...initialPatients],
  timeline: [...initialTimeline],
  notifications: [...initialNotifications],
  users: [...initialUserAccounts]
};
let centralVersion = 1;

// Load persisted central data if available
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && (Array.isArray(parsed.patients) || Array.isArray(parsed.users))) {
      centralState = {
        hospitals: parsed.hospitals || initialHospitals,
        incidents: parsed.incidents || initialIncidents,
        patients: parsed.patients || initialPatients,
        timeline: parsed.timeline || initialTimeline,
        notifications: parsed.notifications || initialNotifications,
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : initialUserAccounts
      };
      console.log(`💾 Loaded central store from disk: ${centralState.patients.length} patients, ${centralState.incidents.length} incidents, ${centralState.users.length} staff accounts.`);
    }
  }
} catch (e) {
  console.warn("⚠️ Could not load central_store.json, using mock defaults:", e);
}

function persistCentralState() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(centralState, null, 2), "utf-8");
  } catch (err) {
    console.warn("⚠️ Could not persist central state to disk:", err);
  }
}

// Active connected SSE clients (all iPad, Mobile, Desktop tabs)
interface ConnectedClient {
  id: string;
  deviceId: string;
  res: express.Response;
}
const sseClients = new Map<string, ConnectedClient>();

function broadcastState(actionType?: string, sourceDeviceId?: string) {
  centralVersion++;
  const payload = JSON.stringify({
    type: "SYNC_STATE",
    state: centralState,
    version: centralVersion,
    actionType,
    sourceDeviceId,
    activeClients: sseClients.size,
    timestamp: new Date().toISOString()
  });

  sseClients.forEach((client, id) => {
    try {
      client.res.write(`data: ${payload}\n\n`);
      if ((client.res as any).flush) {
        (client.res as any).flush();
      }
    } catch (err) {
      console.warn(`[SSE Broadcast] Failed to send to ${client.id}:`, err);
      sseClients.delete(id);
    }
  });
}

// Keep-alive heartbeat interval to prevent proxy/cloud-run timeouts
setInterval(() => {
  if (sseClients.size > 0) {
    const pingPayload = JSON.stringify({
      type: "HEARTBEAT",
      version: centralVersion,
      activeClients: sseClients.size,
      timestamp: new Date().toISOString()
    });
    sseClients.forEach((client, id) => {
      try {
        client.res.write(`: ping\n\n`);
        client.res.write(`data: ${pingPayload}\n\n`);
        if ((client.res as any).flush) {
          (client.res as any).flush();
        }
      } catch (e) {
        sseClients.delete(id);
      }
    });
  }
}, 10000);

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
      console.warn("⚠️ GEMINI_API_KEY is not defined. Using high-fidelity local AI rule engine fallback.");
      throw new Error("GEMINI_API_KEY_MISSING");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// In-memory triage prediction cache to save API quota and speed up responses
const triageCache = new Map<string, any>();

// Robust retry wrapper for Gemini generateContent calls to handle transient/503 errors gracefully
async function generateContentWithRetry(client: GoogleGenAI, params: any, maxRetries = 2, initialDelayMs = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await client.models.generateContent(params);
    } catch (err: any) {
      attempt++;
      const errStr = String(err.message || "").toLowerCase();
      const statusCode = err.status || err.statusCode || 0;
      const isTransient = 
        statusCode === 503 || 
        statusCode === 429 || 
        errStr.includes("503") || 
        errStr.includes("429") || 
        errStr.includes("demand") || 
        errStr.includes("temporary") || 
        errStr.includes("unavailable") || 
        errStr.includes("rate limit");
      
      if (isTransient && attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`[Gemini Info] Retrying request (attempt ${attempt}/${maxRetries}) in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API 1: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // ==========================================
  // REAL-TIME SYNC API ENDPOINTS
  // ==========================================

  // 1. Fetch Current Central State & Version
  app.get("/api/sync/state", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({
      ...centralState,
      version: centralVersion,
      activeClients: sseClients.size
    });
  });

  // Lightweight version check for sub-second polling
  app.get("/api/sync/version", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      version: centralVersion,
      activeClients: sseClients.size
    });
  });

  // 2. Server-Sent Events (SSE) Real-time Stream
  app.get("/api/sync/stream", (req, res) => {
    const deviceId = (req.query.deviceId as string) || `dev-${Math.random().toString(36).substring(2, 9)}`;
    const clientId = `${deviceId}-${Date.now()}`;

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    if (res.flushHeaders) {
      res.flushHeaders();
    }
    // Send immediate comment to establish stream
    res.write(": connected\n\n");
    if ((res as any).flush) {
      (res as any).flush();
    }

    const client: ConnectedClient = { id: clientId, deviceId, res };
    sseClients.set(clientId, client);
    console.log(`📡 [SSE Device Connected] ${deviceId} (Total Active Devices: ${sseClients.size})`);

    // Immediate initial sync push
    res.write(`data: ${JSON.stringify({
      type: "INIT_STATE",
      state: centralState,
      version: centralVersion,
      activeClients: sseClients.size,
      timestamp: new Date().toISOString()
    })}\n\n`);
    if ((res as any).flush) {
      (res as any).flush();
    }

    req.on("close", () => {
      sseClients.delete(clientId);
      console.log(`🔌 [SSE Device Disconnected] ${deviceId} (Remaining Devices: ${sseClients.size})`);
    });
  });

  // 3. Central Real-time Mutation Dispatcher
  app.post("/api/sync/action", (req, res) => {
    const { type, payload, deviceId, timestamp } = req.body;
    if (!type) {
      return res.status(400).json({ error: "Action type is required" });
    }

    console.log(`⚡ [Realtime Action Received] ${type} from ${deviceId || "unknown"}`);

    try {
      switch (type) {
        case "ADD_PATIENT": {
          const { newPatient, newTimeline } = payload;
          if (newPatient) {
            const existsIndex = centralState.patients.findIndex(p => p.patient_id === newPatient.patient_id);
            if (existsIndex >= 0) {
              centralState.patients[existsIndex] = {
                ...centralState.patients[existsIndex],
                ...newPatient,
                updated_at: timestamp || new Date().toISOString()
              };
            } else {
              centralState.patients = [newPatient, ...centralState.patients];
            }
          }
          if (newTimeline) {
            centralState.timeline = [newTimeline, ...centralState.timeline];
          }
          break;
        }

        case "DELETE_PATIENT": {
          const { patientId } = payload;
          centralState.patients = centralState.patients.filter(p => p.patient_id !== patientId);
          centralState.timeline = centralState.timeline.filter(t => t.patient_id !== patientId);
          break;
        }

        case "UPDATE_TRIAGE": {
          const { patientId, triageResult, assessmentRecord, newTimeline } = payload;
          let found = false;
          centralState.patients = centralState.patients.map(p => {
            if (p.patient_id === patientId) {
              found = true;
              const isSieve = assessmentRecord?.triage_type === "SIEVE";
              const isSort = assessmentRecord?.triage_type === "SORT";
              const isDouble = assessmentRecord?.triage_type === "DOUBLE";
              const treatmentsFromRecord = Array.isArray(assessmentRecord?.treatments) ? assessmentRecord.treatments : [];
              const combinedTreatments = Array.from(new Set([...(p.treatments || []), ...treatmentsFromRecord]));
              return {
                ...p,
                current_triage: triageResult,
                transfer_status: "Triage Complete" as const,
                updated_at: timestamp || new Date().toISOString(),
                latest_triage_record: assessmentRecord || p.latest_triage_record,
                treatments: combinedTreatments,
                treatment_notes: assessmentRecord?.treatment_notes || p.treatment_notes,
                sieve_completed: isSieve || isDouble || !!p.sieve_completed,
                sort_completed: isSort || isDouble || !!p.sort_completed
              };
            }
            return p;
          });

          // If patient was not yet recorded, create baseline record so triage is never dropped
          if (!found) {
            const fallbackPatient: Patient = {
              patient_id: patientId,
              nfc_id: `NFC-${Math.floor(1000 + Math.random() * 9000)}`,
              name: `HN-${patientId.replace(/[^0-9]/g, '') || Math.floor(10000 + Math.random() * 90000)}`,
              incident_id: centralState.incidents[0]?.id || "incident-1",
              current_triage: triageResult,
              transfer_status: "Triage Complete",
              gender: "ไม่ระบุ",
              age: 30,
              gps_lat: 6.3845,
              gps_lng: 101.2612,
              treatments: Array.isArray(assessmentRecord?.treatments) ? assessmentRecord.treatments : [],
              treatment_notes: assessmentRecord?.treatment_notes || "",
              created_at: timestamp || new Date().toISOString(),
              updated_at: timestamp || new Date().toISOString(),
              latest_triage_record: assessmentRecord
            };
            centralState.patients = [fallbackPatient, ...centralState.patients];
          }

          if (newTimeline) {
            centralState.timeline = [newTimeline, ...centralState.timeline];
          }
          break;
        }

        case "REQUEST_TRANSFER": {
          const { patientId, hospitalId, newTimeline } = payload;
          centralState.patients = centralState.patients.map(p =>
            p.patient_id === patientId
              ? { ...p, hospital_id: hospitalId, transfer_status: "Waiting Transfer" as const, updated_at: timestamp || new Date().toISOString() }
              : p
          );
          if (newTimeline) {
            centralState.timeline = [newTimeline, ...centralState.timeline];
          }
          break;
        }

        case "UPDATE_TRANSFER_STATUS": {
          const { patientId, newStatus, newTimeline } = payload;
          const pt = centralState.patients.find(p => p.patient_id === patientId);
          if (pt && pt.hospital_id) {
            const hId = pt.hospital_id;
            if (newStatus === "ER Accepted") {
              centralState.hospitals = centralState.hospitals.map(h =>
                h.id === hId ? { ...h, current_er: Math.min(h.max_er, h.current_er + 1) } : h
              );
            } else if (newStatus === "Admitted") {
              centralState.hospitals = centralState.hospitals.map(h =>
                h.id === hId ? { ...h, current_er: Math.max(0, h.current_er - 1), current_icu: Math.min(h.max_icu, h.current_icu + 1) } : h
              );
            } else if (newStatus === "Discharged") {
              centralState.hospitals = centralState.hospitals.map(h =>
                h.id === hId ? { ...h, current_er: Math.max(0, h.current_er - 1), current_icu: Math.max(0, h.current_icu - 1) } : h
              );
            }
          }
          centralState.patients = centralState.patients.map(p =>
            p.patient_id === patientId
              ? { ...p, transfer_status: newStatus, updated_at: timestamp || new Date().toISOString() }
              : p
          );
          if (newTimeline) {
            centralState.timeline = [newTimeline, ...centralState.timeline];
          }
          break;
        }

        case "UPDATE_DESTINATION": {
          const { patientId, destination, notes, newTimeline } = payload;
          centralState.patients = centralState.patients.map(p =>
            p.patient_id === patientId
              ? { ...p, destination, destination_notes: notes || p.destination_notes, updated_at: timestamp || new Date().toISOString() }
              : p
          );
          if (newTimeline) {
            centralState.timeline = [newTimeline, ...centralState.timeline];
          }
          break;
        }

        case "TOGGLE_WRISTBAND_OFF": {
          const { patientId, offStatus, reason, offBy, offAt, newTimeline } = payload;
          centralState.patients = centralState.patients.map(p =>
            p.patient_id === patientId
              ? {
                  ...p,
                  wristband_off: offStatus,
                  wristband_off_reason: reason || p.wristband_off_reason,
                  wristband_off_by: offBy || p.wristband_off_by,
                  wristband_off_at: offAt || p.wristband_off_at,
                  updated_at: timestamp || new Date().toISOString()
                }
              : p
          );
          if (newTimeline) {
            centralState.timeline = [newTimeline, ...centralState.timeline];
          }
          break;
        }

        case "ADD_TREATMENTS": {
          const { patientId, treatments, notes, operator, newTimeline } = payload;
          centralState.patients = centralState.patients.map(p => {
            if (p.patient_id === patientId) {
              const currentTreatments = Array.isArray(p.treatments) ? p.treatments : [];
              const combined = Array.from(new Set([...currentTreatments, ...treatments]));
              return {
                ...p,
                treatments: combined,
                notes: notes ? (p.notes ? `${p.notes} | ${notes}` : notes) : p.notes,
                updated_at: timestamp || new Date().toISOString()
              };
            }
            return p;
          });
          if (newTimeline) {
            centralState.timeline = [newTimeline, ...centralState.timeline];
          }
          break;
        }

        case "ADD_USER": {
          const { newUser } = payload;
          if (newUser) {
            centralState.users = [newUser, ...centralState.users.filter(u => u.id !== newUser.id && u.staffId !== newUser.staffId)];
          }
          break;
        }

        case "UPDATE_USER": {
          const { id, updates } = payload;
          centralState.users = centralState.users.map(u =>
            (u.id === id || u.staffId === id) ? { ...u, ...updates } : u
          );
          break;
        }

        case "DELETE_USER": {
          const { id } = payload;
          centralState.users = centralState.users.filter(u => u.id !== id && u.staffId !== id);
          break;
        }

        case "CLEAR_PATIENT_DATA": {
          centralState.patients = [];
          centralState.timeline = [];
          break;
        }

        case "ADD_INCIDENT": {
          const { newIncident } = payload;
          if (newIncident) {
            centralState.incidents = [newIncident, ...centralState.incidents.filter(i => i.id !== newIncident.id)];
          }
          break;
        }

        case "UPDATE_INCIDENT": {
          const { id, updatedFields } = payload;
          centralState.incidents = centralState.incidents.map(inc =>
            inc.id === id ? { ...inc, ...updatedFields } : inc
          );
          break;
        }

        case "DELETE_INCIDENT": {
          const { id } = payload;
          centralState.incidents = centralState.incidents.filter(inc => inc.id !== id);
          break;
        }

        case "ALLOCATE_RESOURCE": {
          const { hospitalId, department, increment } = payload;
          centralState.hospitals = centralState.hospitals.map(h => {
            if (h.id !== hospitalId) return h;
            let current_er = h.current_er;
            let current_icu = h.current_icu;
            let current_or = h.current_or;
            if (department === "er") current_er = increment ? Math.min(h.max_er, current_er + 1) : Math.max(0, current_er - 1);
            else if (department === "icu") current_icu = increment ? Math.min(h.max_icu, current_icu + 1) : Math.max(0, current_icu - 1);
            else if (department === "or") current_or = increment ? Math.min(h.max_or, current_or + 1) : Math.max(0, current_or - 1);
            
            const occupancy = current_er / h.max_er;
            const status: "Ready" | "Evaluating" | "Full" = occupancy >= 0.95 ? "Full" : occupancy >= 0.75 ? "Evaluating" : "Ready";
            return { ...h, current_er, current_icu, current_or, status };
          });
          break;
        }

        case "ADJUST_CAPACITY": {
          const { hospitalId, field, value } = payload;
          centralState.hospitals = centralState.hospitals.map(h => {
            if (h.id !== hospitalId) return h;
            const updated = { ...h, [field]: value };
            const occupancy = updated.current_er / updated.max_er;
            updated.status = occupancy >= 0.95 ? "Full" : occupancy >= 0.75 ? "Evaluating" : "Ready";
            return updated;
          });
          break;
        }

        case "ADD_NOTIFICATION": {
          const { newNotification } = payload;
          if (newNotification) {
            centralState.notifications = [newNotification, ...centralState.notifications.slice(0, 49)];
          }
          break;
        }

        case "RESET_STATE": {
          centralState = {
            hospitals: [...initialHospitals],
            incidents: [...initialIncidents],
            patients: [...initialPatients],
            timeline: [...initialTimeline],
            notifications: [...initialNotifications],
            users: [...initialUserAccounts]
          };
          break;
        }

        default:
          console.warn(`[Realtime Sync] Unhandled action type: ${type}`);
      }

      // Persist to local JSON file
      persistCentralState();

      // Immediately broadcast to all connected devices!
      broadcastState(type, deviceId);

      return res.json({ success: true, version: centralVersion });
    } catch (err: any) {
      console.error("[Realtime Sync Action Error]:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Keep-alive heartbeat every 15 seconds
  setInterval(() => {
    if (sseClients.size > 0) {
      const ping = JSON.stringify({ type: "HEARTBEAT", activeClients: sseClients.size, timestamp: Date.now() });
      sseClients.forEach((client) => {
        try {
          client.res.write(`data: ${ping}\n\n`);
        } catch (e) {}
      });
    }
  }, 15000);

  // API 2: Smart Triage Engine (Decision Support for MOPH Triage guidelines)
  app.post("/api/triage-ai", async (req, res) => {
    const { triage_type, sieve, sort, age, gender, notes, is_pediatric } = req.body;

    console.log("🤖 Received AI Triage Request:", { triage_type, sieve, sort, is_pediatric });

    const cacheKey = JSON.stringify({ triage_type, sieve, sort, age, gender, notes, is_pediatric });
    if (triageCache.has(cacheKey)) {
      const cached = triageCache.get(cacheKey);
      console.log(`🎯 Serving triage prediction from memory cache! [${cached.recommended_color}]`);
      return res.json({
        ...cached,
        provider: `${cached.provider} (Cached)`
      });
    }

    // 1. Calculate a base logical clinical recommendation as secondary fallback/reference
    let baseColor: "RED" | "YELLOW" | "GREEN" | "BLACK" = "GREEN";
    let baseRiskScore = 15;
    let fallbackReason = "การวิเคราะห์เบื้องต้นด้วย Rule-based Engine:";

    // SIEVE / JumpSTART Rules Calculator
    const calculateSieve = () => {
      const isPed = is_pediatric === true || is_pediatric === "true" || sieve?.is_pediatric === true;
      const { alive, can_walk, respiration_present, rr, capillary_refill, rescue_breaths, pulse, avpu } = sieve || {};
      const isAlive = alive === true || alive === "true" || alive === "Yes" || alive === "YES" || alive === "yes";
      const walks = can_walk === true || can_walk === "true" || can_walk === "Yes" || can_walk === "YES" || can_walk === "yes";
      const breathes = respiration_present === true || respiration_present === "true" || respiration_present === "Yes" || respiration_present === "YES" || respiration_present === "yes";
      const respVal = Number(rr) || 0;
      const capRefillVal = capillary_refill === true || capillary_refill === "true" || capillary_refill === "delayed" || capillary_refill === "Yes" || capillary_refill === "YES" || capillary_refill === "yes";
      let color: "RED" | "YELLOW" | "GREEN" | "BLACK" = "GREEN";
      let reason = "";

      if (isPed) {
        // JumpSTART Pediatric Triage Rules
        if (walks) {
          color = "GREEN";
          reason = "เด็กเดินได้เอง (JumpSTART Green)";
        } else if (!isAlive || !breathes) {
          const hasRescueBreaths = rescue_breaths === true || rescue_breaths === "true" || rescue_breaths === "Yes" || rescue_breaths === "YES";
          if (hasRescueBreaths) {
            color = "RED";
            reason = "เด็กหยุดหายใจแต่พ้นวิกฤตหลังช่วยหายใจ 5 ครั้ง (JumpSTART Red)";
          } else {
            color = "BLACK";
            reason = "เด็กหยุดหายใจ ช่วยเหลือหายใจแล้วไม่กลับมา (JumpSTART Black)";
          }
        } else if (respVal < 15 || respVal > 45) {
          color = "RED";
          reason = `เด็กหายใจเร็ว/ช้าผิดปกติ (${respVal} bpm เกณฑ์เด็ก: 15-45) (JumpSTART Red)`;
        } else {
          const hasPulse = pulse === true || pulse === "true" || pulse === "Yes" || pulse === "YES" || pulse !== false;
          const isUnresponsive = avpu === "unresponsive" || avpu === "P" || avpu === "U";
          if (!hasPulse) {
            color = "RED";
            reason = "ตรวจไม่พบชีพจรสำหรับการคัดแยกเด็ก (JumpSTART Red)";
          } else if (isUnresponsive) {
            color = "RED";
            reason = "เด็กไม่ตอบสนองต่อสิ่งกระตุ้น (AVPU = P หรือ U) (JumpSTART Red)";
          } else {
            color = "YELLOW";
            reason = "เด็กมีสัญญาณชีพและตอบสนองดีแต่ช่วยเหลือตัวเองไม่ได้ (JumpSTART Yellow)";
          }
        }
      } else {
        // Standard Adult SIEVE Rules
        if (!isAlive || !breathes) {
          color = "BLACK";
          reason = "ไม่พบลมหายใจ/หัวใจหยุดทำงาน";
        } else if (walks) {
          color = "GREEN";
          reason = "เดินได้เอง";
        } else if (respVal > 30 || respVal < 10 || capRefillVal) {
          color = "RED";
          reason = `หายใจเร่งตัว (${respVal} bpm) หรือ Capillary Refill > 2 วินาที`;
        } else {
          color = "YELLOW";
          reason = "หายใจและชีพจรปกติแต่ช่วยเหลือตัวเองไม่ได้";
        }
      }
      return { color, reason };
    };

    // SORT Rules Calculator
    const calculateSort = () => {
      const { gcs, rr, pr, sbp, spo2, major_bleeding, pain_score } = sort || {};
      const gcsVal = Number(gcs) || 15;
      const rrVal = Number(rr) || 18;
      const prVal = Number(pr) || 80;
      const sbpVal = Number(sbp) || 120;
      const spo2Val = Number(spo2) || 98;
      const painVal = Number(pain_score) || 0;
      const hasBleeding = major_bleeding === true || major_bleeding === "true" || major_bleeding === "Yes" || major_bleeding === "YES" || major_bleeding === "yes";

      let color: "RED" | "YELLOW" | "GREEN" | "BLACK" = "GREEN";
      let points = 15;
      let reason = "";

      if (gcsVal <= 12) points += 40;
      if (rrVal >= 30 || rrVal < 10) points += 30;
      if (prVal >= 120 || prVal < 50) points += 25;
      if (sbpVal < 90) points += 30;
      if (spo2Val < 90) points += 35;
      if (hasBleeding) points += 35;

      if (gcsVal <= 8 || spo2Val < 85 || sbpVal < 80 || hasBleeding) {
        color = "RED";
        reason = "สัญญาณชีพวิกฤต (ตกเลือดรุนแรง, GCS ต่ำ หรือ SpO2 ต่ำมาก)";
      } else if (gcsVal <= 13 || spo2Val < 94 || sbpVal < 100 || painVal >= 7) {
        color = "YELLOW";
        reason = "สัญญาณชีพกึ่งวิกฤต (GCS เริ่มลด หรือ SpO2 เริ่มตก หรือปวดรุนแรง)";
      } else {
        color = "GREEN";
        reason = "สัญญาณชีพอยู่ในเกณฑ์คงที่ทั่วไป";
      }
      return { color, points, reason };
    };

    if (triage_type === "SIEVE") {
      const sieveRes = calculateSieve();
      baseColor = sieveRes.color;
      baseRiskScore = baseColor === "BLACK" ? 100 : baseColor === "RED" ? 85 : baseColor === "YELLOW" ? 50 : 15;
      fallbackReason += ` [SIEVE] -> ${sieveRes.reason} จัดอยู่ในกลุ่มสี ${sieveRes.color}`;
    } else if (triage_type === "SORT") {
      const sortRes = calculateSort();
      baseColor = sortRes.color;
      baseRiskScore = sortRes.points;
      fallbackReason += ` [SORT] -> ${sortRes.reason} จัดอยู่ในกลุ่มสี ${sortRes.color}`;
    } else {
      // DOUBLE Triage (Both SIEVE and SORT required!)
      const sieveRes = calculateSieve();
      const sortRes = calculateSort();
      
      const getPriority = (c: "RED" | "YELLOW" | "GREEN" | "BLACK") => {
        if (c === "RED") return 4;
        if (c === "YELLOW") return 3;
        if (c === "BLACK") return 2;
        return 1;
      };

      const pSieve = getPriority(sieveRes.color);
      const pSort = getPriority(sortRes.color);

      if (pSieve >= pSort) {
        baseColor = sieveRes.color;
        baseRiskScore = baseColor === "BLACK" ? 100 : baseColor === "RED" ? 85 : baseColor === "YELLOW" ? 50 : 15;
      } else {
        baseColor = sortRes.color;
        baseRiskScore = sortRes.points;
      }
      fallbackReason += ` [DOUBLE] -> คัดแยกขั้นต้น: ${sieveRes.reason} (${sieveRes.color}) และ สัญญาณชีพทุติยภูมิ: ${sortRes.reason} (${sortRes.color}) => สรุปเลือกสีที่มีความเร่งด่วนสูงสุดคือ ${baseColor}`;
    }

    try {
      const client = getGeminiClient();
      const prompt = `
คุณคือ AI แพทย์ที่ปรึกษาประจำศูนย์บัญชาการภัยพิบัติและอุบัติหมู่ (Smart Disaster Medical Command Center)
หน้าที่บทบาทคือวิเคราะห์ช่วยเหลือวิชาชีพแพทย์ พยาบาล ในการประเมินคัดกรองสัญญาณชีพอย่างเร่งด่วนตามแนวทางคัดกรองแบบประเมินผู้รับบาดเจ็บกระทรวงสาธารณสุขไทย (MOPH Triage Guidelines) และเกณฑ์เด็กสากล JumpSTART Pediatric Triage

เกณฑ์การวิเคราะห์:
- หากเป้าหมายเป็นผู้ป่วยเด็ก (อายุ < 8 ปี หรือน้ำหนัก < 45 กิโลกรัม) ให้วิเคราะห์ตามเกณฑ์ JumpSTART: หายใจไม่ได้กระตุ้นแล้วไม่ขึ้น = สีดำ (BLACK), หายใจ > 45 หรือ < 15 หรือมีปัญหาทางเดินหายใจ = สีแดง (RED), รู้สึกตัวดีแต่เดินไม่ได้ = สีเหลือง (YELLOW)
- หากเป้าหมายเป็นผู้ใหญ่ ให้วิเคราะห์ตามเกณฑ์ปฐมภูมิ SIEVE และทุติยภูมิ SORT ปกติ

วิเคราะห์สรุปความเสี่ยงสำหรับรายกรณีผู้บาดเจ็บ:
- วิธีการประเมิน: ${triage_type === "DOUBLE" ? "ดับเบิลคัดแยกซ้ำสองรอบ (Double Triage: SIEVE + SORT)" : triage_type}
- เป็นผู้ป่วยเด็ก (JumpSTART): ${is_pediatric === true || is_pediatric === "true" || (sieve && sieve.is_pediatric) ? "ใช่ (อายุน้อยกว่า 8 ปี หรือ < 45 กก.)" : "ไม่ใช่ (ผู้ใหญ่)"}
- อายุผู้ป่วยโดยสังเขป: ${age || "ไม่ระบุ"}
- เพศ: ${gender || "ไม่ระบุ"}
- อาการหรือบาดแผลเพิ่มเติมจากหน้างาน: ${notes || "ไม่มีข้อมูลส่งต่ออาการพิเศษ"}

ข้อมูลพยาธิสภาพทางการวัด:
- ข้อมูลปฐมภูมิ [SIEVE/JumpSTART]: ${JSON.stringify(sieve || "ไม่มีข้อมูลปฐมภูมิ")}
- ข้อมูลทุติยภูมิสัญญาณชีพ [SORT]: ${JSON.stringify(sort || "ไม่มีข้อมูลทุติยภูมิ")}

โปรดออกความเห็นสรุปการคัดแยกโดยยึดเกณฑ์กระทรวงสาธารณสุขไทย (หากวิเคราะห์ซ้ำสองวิธีแล้วพบสีไม่ตรงกัน ให้ตีสีที่มีความเร่งด่วนรุนแรงสูงสุดเพื่อรักษาชีวิต หรืออธิบายความเห็นความต่างนั้น)
โปรดสรุปผลในรูปแบบ JSON เท่านั้น โดยห้ามมีอักขระพิเศษ markdown นอกเหนือจาก JSON สเตทเมนต์
รูปแบบ JSON ที่ต้องส่งกลับมา:
{
  "recommended_color": "RED" | "YELLOW" | "GREEN" | "BLACK",
  "risk_score": number,
  "reasoning": "อธิบายภาษาไทยสรุปเหตุผลการรวมกันคัดกรองสองวิธีสั้นกระชับ 2 ประโยค เพื่อให้แพทย์สนามรับช่วงได้รวดเร็วที่สุด"
}
`;

      const response = await generateContentWithRetry(client, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "";
      console.log("Gemini response raw:", responseText);
      try {
        const result = JSON.parse(responseText.trim());
        const jsonResponse = {
          recommended_color: result.recommended_color || baseColor,
          risk_score: Number(result.risk_score) || baseRiskScore,
          reasoning: result.reasoning || fallbackReason,
          provider: "Gemini AI"
        };
        // Cache successful response
        triageCache.set(cacheKey, jsonResponse);
        return res.json(jsonResponse);
      } catch (parseErr) {
        console.error("Failed to parse Gemini JSON, fallback to smart logic", parseErr);
        return res.json({
          recommended_color: baseColor,
          risk_score: baseRiskScore,
          reasoning: fallbackReason + " (คำนวณผ่านระบบวิเคราะห์สำรองในตัวเครื่อง)",
          provider: "Local Rule Engine"
        });
      }

    } catch (apiErr: any) {
      console.log("[Offline Fallback Info] Gemini is unavailable (e.g. rate limit or offline). Active clinical rule-engine triggered.");
      return res.json({
        recommended_color: baseColor,
        risk_score: baseRiskScore,
        reasoning: fallbackReason + " (ประมวลผลผ่านระบบออฟไลน์ภายในแท็บเล็ตกู้ชีพ)",
        provider: "Offline Emergency Core"
      });
    }
  });

  // Serve static assets or use Vite dev server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Smart Command Center Backend Online at http://0.0.0.0:${PORT}`);
  });
}

startServer();
