import React from "react";
import { useCommandStore } from "./hooks/useCommandStore";
import { UserRole } from "./types";
import CommandDashboard from "./components/CommandDashboard";
import EMSStation from "./components/EMSStation";
import ERCoordinator from "./components/ERCoordinator";
import FoundationFleet from "./components/FoundationFleet";
import AdminPanel from "./components/AdminPanel";
import PatientDetailsModal from "./components/PatientDetailsModal";
import GoogleSheetsModal from "./components/GoogleSheetsModal";
import LoginPortal from "./components/LoginPortal";
import AccountManagementModal from "./components/AccountManagementModal";
import { 
  Shield, 
  Activity, 
  Wifi, 
  WifiOff, 
  Radio, 
  SlidersHorizontal,
  Building2,
  Ambulance,
  HeartCrack,
  FolderLock,
  Clock,
  Tablet,
  Copy,
  Check,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  RotateCcw,
  Sparkles,
  ChevronRight,
  LayoutDashboard,
  UserCheck,
  Users
} from "lucide-react";

export default function App() {
  const { 
    patients, 
    activeRole, 
    setRole, 
    offlineMode, 
    toggleOfflineMode,
    currentUser,
    notifications,
    googleSheetsConfig,
    isLoggedIn,
    logout,
    realtimeConnected,
    activeRealtimeClients,
    resetCentralState,
    users
  } = useCommandStore();

  const [currentDateTime, setCurrentDateTime] = React.useState<Date>(new Error().name ? new Date() : new Date());
  const [showIpadModal, setShowIpadModal] = React.useState(false);
  const [showSheetsModal, setShowSheetsModal] = React.useState(false);
  const [showAccountModal, setShowAccountModal] = React.useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    // If user is logged in, activeRole is strictly locked to their duty role
    if (isLoggedIn && currentUser?.role) {
      if (activeRole !== currentUser.role) {
        setRole(currentUser.role);
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    const nfcParam = params.get("nfc_id") || params.get("nfc") || params.get("tag");
    
    if (roleParam) {
      const upperRole = roleParam.toUpperCase();
      if (["COMMAND", "EMS", "ER_HOSPITAL", "FOUNDATION", "ADMIN"].includes(upperRole)) {
        setRole(upperRole as any);
      }
    } else if (nfcParam) {
      // If NFC tag is scanned, default to EMS triage station!
      setRole("EMS");
    }
  }, [setRole, isLoggedIn, currentUser?.role, activeRole]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Statistics summaries mapped dynamically for the dashboard footer
  const totalRegistered = patients.length;
  const totalWaitingCount = patients.filter(
    p => p.transfer_status === "Waiting Transfer" || p.transfer_status === "Triage Complete"
  ).length;
  const inTransitCount = patients.filter(p => p.transfer_status === "Transporting").length;

  // Track emergency alarms matching Red triage status
  const redAlertCount = patients.filter(p => p.current_triage === "RED" && p.transfer_status !== "Discharged").length;

  // Active view renderer helper
  const renderRoleWorkspace = () => {
    switch (activeRole) {
      case "COMMAND":
        return <CommandDashboard />;
      case "EMS":
        return <EMSStation />;
      case "ER_HOSPITAL":
        return <ERCoordinator />;
      case "FOUNDATION":
        return <FoundationFleet />;
      case "ADMIN":
        return <AdminPanel />;
      default:
        return <CommandDashboard />;
    }
  };

  // Human-readable labels matching role identifiers
  const roleMetadata: Record<UserRole, { label: string; sub: string; color: string; bg: string; icon: any }> = {
    COMMAND: { 
      label: "Commander", 
      sub: "ผู้บัญชาระดับภาค", 
      color: "text-blue-600 border-blue-200", 
      bg: "bg-blue-50",
      icon: LayoutDashboard
    },
    EMS: { 
      label: "EMS Triage", 
      sub: "พยาบาลสนามคัดกรอง", 
      color: "text-emerald-600 border-emerald-200", 
      bg: "bg-emerald-50",
      icon: Activity
    },
    ER_HOSPITAL: { 
      label: "ER Hospital", 
      sub: "พยาบาลรับบอร์ด ER", 
      color: "text-red-600 border-red-200", 
      bg: "bg-red-50",
      icon: Building2
    },
    FOUNDATION: { 
      label: "Rescue Fleet", 
      sub: "พลขับฝ่ายกู้ชีพมูลนิธิ", 
      color: "text-amber-600 border-amber-200", 
      bg: "bg-amber-50",
      icon: Ambulance
    },
    ADMIN: { 
      label: "Sys Admin", 
      sub: "ผู้ดูแลฐานเซิร์ฟเวอร์", 
      color: "text-purple-600 border-purple-200", 
      bg: "bg-purple-50",
      icon: SlidersHorizontal
    }
  };

  if (!isLoggedIn) {
    return <LoginPortal />;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 ems-grid-bg text-slate-800 font-sans selection:bg-indigo-500 selection:text-white relative w-full pb-20 md:pb-0" id="elegant-dark-app-root">
      
      {/* Top Header Navigation */}
      <nav className="min-h-[3.5rem] px-4 md:px-6 py-2 md:py-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-md z-30 sticky top-0 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-2.5">
            <div className="relative flex items-center justify-center p-2 bg-sky-50 border border-sky-100 rounded-xl shadow-xs shrink-0">
              <svg viewBox="0 0 100 100" className="w-6 h-6 text-sky-600 select-none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="#ffffff" strokeWidth="1" strokeLinejoin="round">
                  <rect x="42" y="10" width="16" height="80" rx="3" transform="rotate(0 50 50)" fill="currentColor" stroke="none" />
                  <rect x="42" y="10" width="16" height="80" rx="3" transform="rotate(60 50 50)" fill="currentColor" stroke="none" />
                  <rect x="42" y="10" width="16" height="80" rx="3" transform="rotate(120 50 50)" fill="currentColor" stroke="none" />
                </g>
                <line x1="50" y1="18" x2="50" y2="82" stroke="#f0f9ff" strokeWidth="6.5" strokeLinecap="round" />
                <line x1="50" y1="18" x2="50" y2="82" stroke="#0284c7" strokeWidth="3.2" strokeLinecap="round" />
                <path 
                  d="M50,75 C41,70 41,65 50,60 C59,55 59,50 50,45 C41,40 41,35 50,30 C59,25 59,22 50,18" 
                  fill="none" 
                  stroke="#ffffff" 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <path 
                  d="M50,75 C41,70 41,65 50,60 C59,55 59,50 50,45 C41,40 41,35 50,30 C59,25 59,22 50,18" 
                  fill="none" 
                  stroke="#0284c7" 
                  strokeWidth="1.8" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <circle cx="50" cy="18" r="3" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
              </svg>
            </div>
            
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black tracking-wide uppercase text-slate-900 font-display">
                  <span className="text-sky-600 font-extrabold">EMS</span> Smart Triage
                </h1>
                <span className="hidden xs:inline-block text-[9px] bg-slate-100 text-slate-600 border border-slate-200 font-mono px-1.5 py-0.2 rounded font-semibold">
                  MCI Live
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                ระบบกู้ชีพและบัญชาการเหตุการณ์
              </p>
            </div>
          </div>

          {/* Desktop Toolbar (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-2.5 text-xs">
            
            {/* Realtime Central Hub Status Indicator */}
            <div 
              className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg transition font-medium h-8 ${
                realtimeConnected && !offlineMode
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-800" 
                  : "bg-amber-50/80 border-amber-200 text-amber-800"
              }`}
              title="สถานะระบบกลาง Real-time Synchronization"
            >
              <span className="relative flex h-2 w-2">
                {realtimeConnected && !offlineMode && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${realtimeConnected && !offlineMode ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </span>
              <span className="text-[11px] font-bold">
                {offlineMode ? "ออฟไลน์" : `เชื่อมต่อสด (${activeRealtimeClients})`}
              </span>
            </div>

            {/* Offline/Online toggle */}
            <button 
              onClick={toggleOfflineMode}
              className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg transition font-medium h-8 cursor-pointer ${
                offlineMode 
                  ? "bg-amber-50 border-amber-300 text-amber-800" 
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
              title={offlineMode ? "คลิกเพื่อกลับสู่โหมดออนไลน์" : "คลิกเพื่อทำงานโหมดออฟไลน์"}
            >
              {offlineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px]">ออฟไลน์</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px]">ออนไลน์</span>
                </>
              )}
            </button>

            {/* Google Sheets Sync Indicator */}
            <button
              onClick={() => setShowSheetsModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg transition font-medium h-8 cursor-pointer ${
                googleSheetsConfig?.spreadsheetId
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span className="text-[11px]">Google Sheets</span>
            </button>

            {/* User Accounts Management Quick Button (Admin role only) */}
            {currentUser?.role === "ADMIN" && (
              <button
                onClick={() => setShowAccountModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 rounded-lg transition font-medium h-8 cursor-pointer shadow-2xs"
                title="จัดการบัญชีผู้ใช้งานแต่ละตำแหน่ง (เฉพาะ Admin)"
                id="topbar-account-manage-btn"
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[11px] font-semibold">บัญชีผู้ใช้ ({users.length})</span>
              </button>
            )}

            {/* iPad & Mobile Client Guide Button */}
            <button 
              onClick={() => setShowIpadModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg transition font-medium h-8 cursor-pointer"
              title="เปิดบน iPad / มือถือ"
            >
              <Tablet className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px]">QR มือถือ</span>
            </button>

            {/* Authenticated Duty Badge (Locked to user's assigned role) */}
            <div className="flex items-center pl-1">
              <div 
                className={`flex items-center gap-1.5 px-3 py-1 bg-white border rounded-lg text-xs font-bold leading-relaxed shadow-xs h-8 ${roleMetadata[currentUser?.role || activeRole]?.color || "border-slate-200 text-slate-800"}`}
                title={`ปฏิบัติการในฐานะ ${roleMetadata[currentUser?.role || activeRole]?.label} (ระบบจำกัดสิทธิ์เฉพาะหน้าที่ ไม่อนุญาตให้สลับหน้าอื่น)`}
                id="role-locked-badge"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px] text-slate-500 font-medium">หน้าที่:</span>
                <span className="text-xs font-black text-slate-900">{roleMetadata[currentUser?.role || activeRole]?.label}</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold font-mono">
                  เฉพาะหน้าที่
                </span>
              </div>
            </div>

            {/* User Profile & Logout to Switch Role */}
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 h-8" id="profile-logout-header">
              <span className="text-[11px] font-semibold text-slate-700 max-w-[120px] truncate" title={currentUser.name}>
                {currentUser.name}
              </span>
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                title="ออกจากระบบเพื่อเข้าสู่หน้าที่อื่น"
                id="header-logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            </div>

            {/* Live Clock */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1 rounded-lg h-8 font-mono text-[11px] font-bold text-slate-700">
              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
              <span>{currentDateTime.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
            </div>

          </div>

          {/* Mobile Right Controls */}
          <div className="flex md:hidden items-center gap-2">
            <div 
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${
                realtimeConnected && !offlineMode
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {realtimeConnected && !offlineMode && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${realtimeConnected && !offlineMode ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </span>
              <span>{offlineMode ? "ออฟไลน์" : "สด"}</span>
            </div>

            <button
              onClick={() => setShowMobileDrawer(true)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

        </div>
      </nav>

      {/* Main Content Dashboard Layout */}
      <main className="flex-1 p-3 sm:p-5 relative max-w-7xl mx-auto w-full transition-all duration-300">
        
        {/* Clean, Minimal Header Summary Banner */}
        <div className="mb-3 sm:mb-5 flex items-center justify-between bg-white border border-slate-200/90 rounded-xl p-3 sm:p-3.5 gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl border ${roleMetadata[activeRole].bg} ${roleMetadata[activeRole].color}`}>
              {React.createElement(roleMetadata[activeRole].icon, { className: "w-4 h-4" })}
            </div>
            <div className="truncate">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {activeRole === "COMMAND" && "ศูนย์สั่งการกู้ชีพ (Command Center)"}
                {activeRole === "EMS" && "จุดคัดแยกผู้ป่วยสนาม (EMS Triage)"}
                {activeRole === "FOUNDATION" && "ระบบรถนำส่งกู้ชีพ (Rescue Fleet)"}
                {activeRole === "ER_HOSPITAL" && "ระบบบริหารเตียงฉุกเฉิน (ER Beds)"}
                {activeRole === "ADMIN" && "เครื่องมือดูแลระบบ (Admin)"}
              </h2>
              <p className="text-[10.5px] text-slate-500 truncate">
                {roleMetadata[activeRole].sub}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {redAlertCount > 0 && (
              <div className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span className="text-[11px] font-bold font-mono">สีแดง: {redAlertCount}</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>MCI Online</span>
            </div>
          </div>
        </div>

        {/* Dynamic Workspace based on Active Role */}
        <div className="relative">
          {renderRoleWorkspace()}
        </div>

      </main>

      {/* Desktop Footer (Hidden on Mobile) */}
      <footer className="hidden md:flex bg-white border-t border-slate-200 py-3 px-6 text-xs text-slate-500 justify-between items-center z-20">
        <div className="flex items-center space-x-4">
          <span className="font-mono text-slate-700 font-bold">MCI SYSTEM ENGINE v3.5</span>
          <span className="text-slate-300">|</span>
          <span>ผู้ป่วยทั้งหมด: <strong className="text-slate-900 font-bold">{totalRegistered}</strong></span>
          <span>รอส่งต่อ: <strong className="text-amber-600 font-bold">{totalWaitingCount}</strong></span>
          <span>อยู่ระหว่างนำส่ง: <strong className="text-indigo-600 font-bold">{inTransitCount}</strong></span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span>NFC GATEWAY ACTIVE</span>
          </div>
          
          {redAlertCount > 0 ? (
            <div className="px-3 py-1 bg-red-50 text-red-700 rounded-md text-[10px] font-black border border-red-200 flex items-center gap-1 animate-pulse">
              <span>RED ALERT: {redAlertCount}</span>
            </div>
          ) : (
            <div className="px-3 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold border border-slate-200">
              SOS NORMAL
            </div>
          )}
        </div>
      </footer>

      {/* Mobile Bottom Dock Navigation Bar (Sticky Thumb Navigation) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-2 py-1.5 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] flex justify-between items-center gap-1.5 safe-area-pb"
        aria-label="แถบเมนูนำทางด่วนบนมือถือ"
      >
        {/* 1. Dedicated Assigned Role (Duty Locked) */}
        <div
          className={`flex items-center gap-2 py-1.5 px-3 rounded-xl ${roleMetadata[currentUser?.role || activeRole]?.bg || "bg-indigo-50"} border ${roleMetadata[currentUser?.role || activeRole]?.color || "border-indigo-200"} flex-1 min-w-0`}
        >
          {React.createElement(roleMetadata[currentUser?.role || activeRole]?.icon || Activity, { className: "w-5 h-5 shrink-0" })}
          <div className="text-left truncate">
            <div className="text-xs font-black leading-tight text-slate-900 truncate">
              {roleMetadata[currentUser?.role || activeRole]?.label}
            </div>
            <div className="text-[9px] text-emerald-700 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>ล็อกเฉพาะหน้าที่นี้</span>
            </div>
          </div>
        </div>

        {/* 2. Urgent Patient / Triage Counter */}
        <div className="flex items-center gap-1 shrink-0">
          {redAlertCount > 0 ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[10px] font-black animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>แดง: {redAlertCount}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold">
              <span>ผู้ป่วย: {totalRegistered}</span>
            </div>
          )}
        </div>

        {/* 3. Logout to Switch Duty Button */}
        <button
          onClick={() => logout()}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
          title="ออกจากระบบเพื่อสลับหน้าที่"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[11px]">ออกระบบ</span>
        </button>

        {/* 4. Mobile More Drawer Button */}
        <button
          onClick={() => setShowMobileDrawer(true)}
          className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
            showMobileDrawer
              ? "text-indigo-700 bg-indigo-50 border-indigo-200"
              : "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100"
          }`}
          aria-label="เมนูระบบ"
        >
          <Menu className="w-5 h-5" />
        </button>
      </nav>

      {/* Mobile Slide-Up Quick Action Drawer */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full sm:max-w-md bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl text-left max-h-[85vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Handle Bar */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto sm:hidden mb-2"></div>

            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {currentUser.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    หน้าที่ที่ได้รับมอบหมาย: {roleMetadata[currentUser?.role || activeRole]?.label}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowMobileDrawer(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Role Lock Security Information Card (Cannot Switch Roles) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>ระบบล็อกความปลอดภัยเฉพาะหน้าที่ (Role-Locked)</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                ท่านกำลังเข้าใช้งานในตำแหน่ง <strong>{roleMetadata[currentUser?.role || activeRole]?.label} ({roleMetadata[currentUser?.role || activeRole]?.sub})</strong> ระบบจำกัดการเข้าถึงเฉพาะหน้าจอนี้เท่านั้น ไม่สามารถเปิดหน้าของหน่วยงานอื่นได้ เพื่อป้องกันความผิดพลาดในการปฏิบัติการ
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 font-medium">ต้องการปฏิบัติหน้าที่อื่น?</span>
                <button
                  onClick={() => {
                    setShowMobileDrawer(false);
                    logout();
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบเพื่อสลับหน้าที่</span>
                </button>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                เครื่องมือและสถานะเครือข่าย:
              </span>

              {/* Online/Offline Toggle Button */}
              <button
                onClick={() => toggleOfflineMode()}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                  offlineMode
                    ? "bg-amber-50 border-amber-300 text-amber-900"
                    : "bg-emerald-50 border-emerald-300 text-emerald-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {offlineMode ? <WifiOff className="w-5 h-5 text-amber-600" /> : <Wifi className="w-5 h-5 text-emerald-600" />}
                  <div>
                    <span className="text-xs font-bold block">
                      {offlineMode ? "โหมดออฟไลน์ (ทำงานไร้เน็ต)" : "สถานะออนไลน์ (ระบบกลาง Real-time)"}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {offlineMode ? "บันทึกในแคชเครื่องอัตโนมัติ" : `เชื่อมต่อเซิร์ฟเวอร์กลางสด (${activeRealtimeClients} เครื่อง)`}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold underline">สลับ</span>
              </button>

              {/* User Accounts Management Trigger (Admin role only) */}
              {currentUser?.role === "ADMIN" && (
                <button
                  onClick={() => {
                    setShowMobileDrawer(false);
                    setShowAccountModal(true);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200 rounded-xl text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">จัดการบัญชีผู้ใช้งาน ({users.length} บัญชี)</span>
                      <span className="text-[10px] text-slate-500 block">เพิ่ม/แก้ไขผู้ใช้ประจำตำแหน่ง ซิงค์สถานะเวร</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-500" />
                </button>
              )}

              {/* Google Sheets Sync Trigger */}
              <button
                onClick={() => {
                  setShowMobileDrawer(false);
                  setShowSheetsModal(true);
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">ซิงค์ Google Sheets</span>
                    <span className="text-[10px] text-slate-500 block">
                      {googleSheetsConfig?.spreadsheetId ? "เชื่อมต่อสเปรดชีตแล้ว" : "ยังไม่ได้ผูกสเปรดชีต"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* iPad / Tablet QR Code Guide */}
              <button
                onClick={() => {
                  setShowMobileDrawer(false);
                  setShowIpadModal(true);
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Tablet className="w-5 h-5 text-indigo-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">QR Code เปิดบน iPad / มือถืออื่น</span>
                    <span className="text-[10px] text-slate-500 block">สแกนเชื่อมต่ออุปกรณ์อื่นๆ ร่วมภารกิจ</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Reset Central State Action */}
              <button
                onClick={async () => {
                  if (window.confirm("ต้องการรีเซ็ตฐานข้อมูลเริ่มต้นของระบบกลางทั้งหมดหรือไม่?")) {
                    await resetCentralState();
                    setShowMobileDrawer(false);
                  }
                }}
                className="w-full flex items-center justify-between p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-xl text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  <div>
                    <span className="text-xs font-bold block">รีเซ็ตข้อมูลเริ่มต้น (Master Reset)</span>
                    <span className="text-[10px] text-rose-600/80 block">ล้างและตั้งค่าฐานข้อมูลระบบกลางใหม่</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-400" />
              </button>
            </div>

            {/* Logout button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setShowMobileDrawer(false);
                  logout();
                }}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ (Logout)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* iPad & Tablet client-connection dynamic instructions guide modal */}
      {showIpadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl text-left overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Tablet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                  คู่มือเปิดใช้งานแอปพลิเคชันบน iPad / มือถือ
                </h3>
              </div>
              <button 
                onClick={() => setShowIpadModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Dynamic URL Copy Area */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                  ที่อยู่ลิงก์ประจำห้องทดสอบ (Dynamic Preview URL):
                </span>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={window.location.href}
                    className="flex-1 bg-white text-indigo-700 font-mono text-xs p-2 rounded border border-slate-300 focus:outline-none"
                  />
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอก</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* QR Code and Step by Step Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-4 flex flex-col items-center bg-white p-2.5 rounded-xl border border-slate-200 max-w-[150px] mx-auto shadow-md shrink-0">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href)}`} 
                    alt="iPad Connection QR Code"
                    className="w-28 h-28 pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[9px] text-slate-700 font-bold font-mono mt-1 text-center leading-none">
                    สแกนด้วยกล้องมือถือ/iPad
                  </span>
                </div>

                <div className="sm:col-span-8 space-y-2.5 text-xs">
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                      1
                    </span>
                    <p className="text-slate-600 leading-snug">
                      เปิดกล้องบน <strong>มือถือ / iPad</strong> สแกน QR Code นี้เพื่อเปิดใช้งานระบบเรียลไทม์ได้ทันที
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                      2
                    </span>
                    <p className="text-slate-600 leading-snug">
                      ข้อมูลที่บันทึกจากมือถือจะซิงค์ขึ้นสู่หน้าจอศูนย์บัญชาการแบบ Real-time ทันที
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                      3
                    </span>
                    <p className="text-slate-600 leading-snug">
                      สามารถกด <strong>Add to Home Screen</strong> ในเบราว์เซอร์เพื่อใช้งานแบบเต็มหน้าจอแอป
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowIpadModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
      <PatientDetailsModal />
      <GoogleSheetsModal isOpen={showSheetsModal} onClose={() => setShowSheetsModal(false)} />
      <AccountManagementModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
    </div>
  );
}
