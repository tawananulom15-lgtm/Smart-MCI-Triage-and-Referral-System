export type UserRole = "EMS" | "COMMAND" | "ER_HOSPITAL" | "FOUNDATION" | "ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hospitalId?: string;
  agencyName?: string;
  staffId?: string;
  phone?: string;
}

export interface UserAccount {
  id: string;
  staffId: string;
  name: string;
  role: UserRole;
  email?: string;
  password?: string;
  phone?: string;
  agencyName: string;
  hospitalId?: string;
  isActive: boolean;
  isOnDuty?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Incident {
  id: string;
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  status: "Active" | "Resolved";
  severity: "Minor" | "Moderate" | "Major" | "Severe";
  createdAt: string;
  type?: string;
}

export type TriageColor = "RED" | "YELLOW" | "GREEN" | "BLACK";

export type TransferStatus =
  | "Registered"
  | "Triage Complete"
  | "Waiting Transfer"
  | "Transporting"
  | "Arrived"
  | "ER Accepted"
  | "Admitted"
  | "Discharged";

export interface TreatmentItem {
  id: string;
  name: string;
  category: "Airway" | "Breathing" | "Circulation" | "Immobilization" | "Medication" | "Other";
  timestamp: string;
  operator?: string;
  notes?: string;
}

export interface Patient {
  patient_id: string;
  nfc_id: string;
  incident_id: string;
  name: string;
  gender: string;
  age: number | string;
  photoUrl?: string;
  current_triage: TriageColor;
  hospital_id?: string;
  transfer_status: TransferStatus;
  gps_lat: number;
  gps_lng: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  latest_triage_record?: TriageRecord;
  sieve_completed?: boolean;
  sort_completed?: boolean;
  // Destination in ER / Transfer
  destination?: string;
  destination_notes?: string;
  // Wristband removal status
  wristband_off?: boolean;
  wristband_off_at?: string;
  wristband_off_by?: string;
  wristband_off_reason?: string;
  // Treatments & Procedures performed
  treatments?: string[];
  treatment_details?: TreatmentItem[];
  treatment_notes?: string;
}

export interface SieveAssessment {
  alive: boolean; // Yes / No
  can_walk: boolean; // Yes / No
  respiration_present: boolean; // Yes / No
  rr: number; // Respiration Rate
  capillary_refill: number | string; // sec or ">2"
  is_pediatric?: boolean;
  jumpstart_rescue_breaths?: boolean;
  jumpstart_pulse?: boolean;
  jumpstart_avpu?: "appropriate" | "unresponsive";
}

export interface SortAssessment {
  gcs: number; // Glasgow Coma Scale (3-15)
  rr: number;
  pr: number; // Pulse Rate
  sbp: number; // Systolic Blood Pressure
  spo2: number; // SpO2 saturation
  major_bleeding: boolean;
  injury_type: string;
  pain_score: number;
}

export interface TriageRecord {
  patient_id: string;
  triage_type: "SIEVE" | "SORT" | "DOUBLE";
  sieve?: SieveAssessment;
  sort?: SortAssessment;
  treatments?: string[];
  treatment_notes?: string;
  triage_result: TriageColor;
  ai_risk_score: number;
  ai_recommendation: TriageColor;
  ai_reasoning: string;
  operator_name: string;
  timestamp: string;
}

export interface TransferRecord {
  id: string;
  patient_id: string;
  hospital_id: string;
  distance_km: number;
  eta_minutes: number;
  status: "Pending" | "Accepted" | "Transport" | "Arrived" | "Admitted";
  operator_name: string;
  timestamp: string;
}

export interface Hospital {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  max_er: number;
  current_er: number;
  max_icu: number;
  current_icu: number;
  max_or: number;
  current_or: number;
  status: "Ready" | "Full" | "Evaluating";
  contact_number: string;
}

export interface TimelineEntry {
  id: string;
  patient_id: string;
  status: TransferStatus | "Registered" | "Triage Assessment" | "Transfer Requested" | "Transfer Confirmed";
  operator: string;
  timestamp: string;
  notes?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "emergency" | "info" | "success" | "warning";
  timestamp: string;
  read: boolean;
}

export interface GPSLog {
  operator_id: string;
  operator_name: string;
  role: UserRole;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export function formatAgeRange(age: string | number | undefined | null): string {
  if (age === undefined || age === null || age === "") return "ไม่ระบุ";
  const str = String(age).trim();
  if (str.includes("ปี") || str.includes("-") || str.includes("+")) return str;
  const num = parseInt(str, 10);
  if (isNaN(num)) return str;
  if (num <= 2) return "0-2 ปี (ทารก)";
  if (num <= 10) return "1-10 ปี";
  if (num <= 20) return "11-20 ปี";
  if (num <= 30) return "21-30 ปี";
  if (num <= 40) return "31-40 ปี";
  if (num <= 50) return "41-50 ปี";
  if (num <= 60) return "51-60 ปี";
  if (num <= 70) return "61-70 ปี";
  if (num <= 80) return "71-80 ปี";
  return "81+ ปี";
}

export const COMMON_TREATMENT_PROCEDURES = [
  { id: "iv", label: "On IV Fluid (เปิดเส้นเลือดให้น้ำเกลือ)", category: "Circulation", badge: "IV" },
  { id: "et_tube", label: "On ET Tube (ใส่ท่อช่วยหายใจ)", category: "Airway", badge: "ET Tube" },
  { id: "o2_mask", label: "On Oxygen Mask / Cannula (ให้ออกซิเจน)", category: "Breathing", badge: "O2" },
  { id: "bvm", label: "On Bag-Valve-Mask (ช่วยหายใจด้วย Ambu Bag)", category: "Breathing", badge: "BVM" },
  { id: "tourniquet", label: "Tourniquet / กดห้ามเลือด (ขันชะเนาะ)", category: "Circulation", badge: "Tourniquet" },
  { id: "cpr", label: "CPR / Defibrillation (ปั๊มหัวใจ/กระตุกไฟฟ้า)", category: "Circulation", badge: "CPR" },
  { id: "splint", label: "Splinting (ดามกระดูกหัก/แผลกระดูก)", category: "Immobilization", badge: "Splint" },
  { id: "collar", label: "Hard Collar & Spinal Board (ดามคอ/หลัง)", category: "Immobilization", badge: "Collar/Board" },
  { id: "wound_dress", label: "Wound Dressing (ทำแผล/ปิดแผลกดแน่น)", category: "Immobilization", badge: "Dressing" },
  { id: "suction", label: "Suction & Clear Airway (ดูดเสมหะ/เปิดทางเดินหายใจ)", category: "Airway", badge: "Suction" },
  { id: "pain_med", label: "Pain Medication (ให้ยาระงับปวดฉุกเฉิน)", category: "Medication", badge: "Analgesic" },
  { id: "chest_decomp", label: "Needle Thoracostomy (เจาะระบายลมในปอด)", category: "Breathing", badge: "Needle Decomp" },
  { id: "foley", label: "On Foley Catheter (ใส่สายสวนปัสสาวะ)", category: "Other", badge: "Foley" },
];

export const ER_DESTINATION_OPTIONS = [
  { value: "ICU (หอผู้ป่วยวิกฤต)", label: "ICU (หอผู้ป่วยวิกฤต / Intensive Care Unit)", color: "rose" },
  { value: "OR (ห้องผ่าตัดฉุกเฉิน)", label: "OR (ห้องผ่าตัดฉุกเฉิน / Operating Room)", color: "indigo" },
  { value: "Trauma Ward (หอผู้ป่วยอุบัติเหตุ)", label: "Trauma Ward (หอผู้ป่วยอุบัติเหตุ)", color: "amber" },
  { value: "General Ward (หอผู้ป่วยในทั่วไป)", label: "General Ward (หอผู้ป่วยในทั่วไป)", color: "sky" },
  { value: "Observation (ห้องสังเกตอาการ)", label: "Observation (ห้องสังเกตอาการ ER)", color: "emerald" },
  { value: "Referral (ส่งต่อไป รพ. อื่น)", label: "Referral (ส่งต่อโรงพยาบาลระดับสูงกว่า)", color: "purple" },
  { value: "Discharge (จำหน่ายกลับบ้าน)", label: "Discharge (จำหน่ายกลับบ้าน / Home)", color: "teal" },
  { value: "Morgue (นิติเวช/ห้องดับจิต)", label: "Morgue (นิติเวช / ชันสูตรพลิกศพ)", color: "zinc" },
];

