import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  FileText, 
  BarChart3, 
  Cpu, 
  Settings as SettingsIcon,
  Clock,
  Github,
  Linkedin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import Overview from './pages/Overview';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';
import Models from './pages/Models';
import Settings from './pages/Settings';
import OnboardingPage from './pages/OnboardingPage';
import LoginModal from './components/LoginModal';
import SplashScreen, { CyberCubeLogo } from './components/SplashScreen';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Auth & Route States
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('soc_session_token'));
  const [time, setTime] = useState(new Date());
  const [liveToast, setLiveToast] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  // New States for Splash Screen and Sidebar
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Splash Screen Timer (Simulates initialization)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 2200); // 2.2 seconds loading animation
    return () => clearTimeout(timer);
  }, []);

  // Save the current active tab to session memory (skip for onboarding)
  useEffect(() => {
    if (location.pathname !== '/index.html' && location.pathname !== '/onboarding') {
      sessionStorage.setItem('soc_last_route', location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket Live Push Telemetry (Only connect if authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    const backendHost = 'ai-cyber-threat-backend-k0pz.onrender.com';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Inject the isolated tenant key into the WebSocket connection
    const tenantKey = sessionStorage.getItem('soc_tenant_key') || 'default';
    const wsUrl = `${wsProtocol}//${backendHost}/ws/threats?api_key=${tenantKey}`;

    let socket;
    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => setWsConnected(true);
      socket.onclose = () => setWsConnected(false);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pcap_analysis_completed') {
            setLiveToast(`PCAP Ingestion: ${data.threats_count} threats detected in ${data.filename}`);
            setTimeout(() => setLiveToast(null), 6000);
            window.dispatchEvent(new CustomEvent('soc-threat-created'));
          } else if (data.type === 'new_threat') {
            setLiveToast(`Live Threat Detected: [${data.threat?.attack_type}] from ${data.threat?.source_ip}`);
            setTimeout(() => setLiveToast(null), 6000);
            window.dispatchEvent(new CustomEvent('soc-threat-created'));
          }
        } catch (e) {
          console.error("WS Parse error:", e);
        }
      };
    } catch (err) {
      console.warn("WebSocket initialization fallback");
    }
    return () => { if (socket) socket.close(); };
  }, [isAuthenticated]);

  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Alerts', path: '/alerts', icon: ShieldAlert },
    { name: 'Logs', path: '/logs', icon: FileText },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Models (AI)', path: '/models', icon: Cpu },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const formatClock = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const handleLoginSuccess = (userData) => {
    setIsAuthenticated(true);
    if (userData.isNewUser) {
      navigate('/onboarding');
    } else {
      // Send them to their last visited dashboard page
      const lastRoute = sessionStorage.getItem('soc_last_route') || '/';
      navigate(lastRoute);
    }
  };

  // Show animated splash screen on refresh
  if (isAppLoading) {
    return <SplashScreen />;
  }

  // If on the onboarding page, render it cleanly without the Sidebar/Header layout wrapping it
  if (location.pathname === '/onboarding') {
    return (
      <>
        {!isAuthenticated && (
          <LoginModal isOpen={!isAuthenticated} onLoginSuccess={handleLoginSuccess} />
        )}
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100 font-sans relative">
      
      {/* Secure Gateway Overlay (Blocks dashboard access until logged in) */}
      {!isAuthenticated && (
        <LoginModal isOpen={!isAuthenticated} onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Collapsible Sidebar */}
      <aside className={`relative bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out z-20 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-14 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 shadow-lg transition-colors z-30"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Sidebar Header / Logo */}
        <div>
          <div className={`h-16 flex items-center ${isSidebarOpen ? 'px-6 gap-3' : 'justify-center'} border-b border-slate-800 bg-slate-950/40 overflow-hidden whitespace-nowrap transition-all duration-300`}>
            <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-600 flex items-center justify-center text-slate-100 shadow shadow-emerald-500/20">
              <CyberCubeLogo className="w-5 h-5 text-slate-100" />
            </div>
            <div className={`transition-opacity duration-300 ${!isSidebarOpen && 'opacity-0 hidden'}`}>
              <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">CyberCube</h1>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mt-0.5">SOC Monitor</p>
            </div>
          </div>
          
          {/* Nav Links */}
          <nav className="mt-6 px-3 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  title={!isSidebarOpen ? item.name : ""}
                  className={`flex items-center rounded-lg text-xs font-semibold tracking-wide transition-all group relative overflow-hidden ${
                    isSidebarOpen ? 'px-4 py-2.5 gap-3.5' : 'p-2.5 justify-center'
                  } ${
                    isActive 
                      ? 'bg-slate-800/80 text-emerald-400 border border-slate-700/50 shadow shadow-slate-950/50' 
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span className={`whitespace-nowrap transition-opacity duration-200 ${!isSidebarOpen && 'hidden'}`}>
                    {item.name}
                  </span>
                  {isActive && (
                    <span className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-emerald-500"></span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer (Contact Links) */}
        <div className={`p-4 border-t border-slate-800/80 bg-slate-950/20 flex flex-col gap-3 ${!isSidebarOpen && 'items-center'}`}>
          <div className={`text-[9px] uppercase font-bold text-slate-500 tracking-wider transition-opacity ${!isSidebarOpen && 'hidden'}`}>
            Network
          </div>
          
          <a href="https://github.com/NartanNaik" target="_blank" rel="noreferrer" title={!isSidebarOpen ? "GitHub" : ""} className="flex items-center gap-3 text-slate-400 hover:text-emerald-400 transition-colors group">
            <Github className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
            <span className={`text-xs font-semibold whitespace-nowrap ${!isSidebarOpen && 'hidden'}`}>Developer GitHub</span>
          </a>
          
          <a href="https://linkedin.com/in/nartan-naik-90499a359" target="_blank" rel="noreferrer" title={!isSidebarOpen ? "LinkedIn" : ""} className="flex items-center gap-3 text-slate-400 hover:text-emerald-400 transition-colors group">
            <Linkedin className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
            <span className={`text-xs font-semibold whitespace-nowrap ${!isSidebarOpen && 'hidden'}`}>Connect on LinkedIn</span>
          </a>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              SYSTEM MONITOR ACTIVE
            </span>
          </div>

          {liveToast && (
            <div className="absolute left-1/2 -translate-x-1/2 bg-rose-950/90 border border-rose-500/40 text-rose-200 px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg shadow-rose-950/50 flex items-center gap-2 animate-bounce">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>{liveToast}</span>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 bg-slate-950/40 border border-slate-800 px-4 py-2 rounded-lg">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="font-mono tracking-wider">{formatClock(time)}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">{time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/alerts" element={<Alerts showOnlyAttacks={true} />} />
            <Route path="/logs" element={<Alerts showOnlyAttacks={false} />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/models" element={<Models />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/index.html" element={<Navigate to={sessionStorage.getItem('soc_last_route') || '/'} replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;