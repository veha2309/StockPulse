"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Screen, UserData } from "@/lib/types";

// Dynamic imports for major screens to reduce initial TBT
const LoginScreen    = dynamic(() => import("@/components/auth/LoginScreen"),    { ssr: false });
const RegisterScreen = dynamic(() => import("@/components/auth/RegisterScreen"), { ssr: false });
const Dashboard      = dynamic(() => import("@/components/dashboard/Dashboard"), { ssr: false });


export default function App() {
  const [screen, setScreen]     = useState<Screen>("login");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize from localStorage on client side
    const cachedUser = localStorage.getItem("session_user");
    if (cachedUser) {
      try {
        const parsedUser: UserData = JSON.parse(cachedUser);
        setUserData(parsedUser);
        setScreen("dashboard");
      } catch (e) {
        localStorage.removeItem("session_user");
      }
    }
    setIsInitialized(true);

    // Background auth verification
    const email = localStorage.getItem("session_email");
    if (email) {
      fetch(`/api/auth?email=${encodeURIComponent(email)}`)
        .then((r) => {
          if (!r.ok) {
            // If it's a 404 (user not found), clear session
            if (r.status === 404) {
              localStorage.removeItem("session_email");
              localStorage.removeItem("session_user");
              setUserData(null);
              setScreen("login");
            }
            // For other errors (500, network issues), keep cached session
            return;
          }
          return r.json();
        })
        .then((data) => {
          if (data?.user) {
            // Auth succeeded, update with fresh data
            const freshUser: UserData = data.user;
            localStorage.setItem("session_user", JSON.stringify(freshUser));
            setUserData(freshUser);
            setScreen("dashboard");
          }
        })
        .catch(() => {
          // Network error - keep cached session, don't log out
          console.log("Auth check failed due to network error, keeping cached session");
        })
        .finally(() => {
          setIsChecking(false);
        });
    } else {
      setIsChecking(false);
    }
  }, []);

  // Show loading state until initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Initializing StockPulse</div>
        </div>
      </div>
    );
  }


  function handleAuth(user: UserData) {
    localStorage.setItem("session_email", user.email);
    localStorage.setItem("session_user", JSON.stringify(user));
    setUserData(user);
    setScreen("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("session_email");
    localStorage.removeItem("session_user");
    setScreen("login");
  }

  if (screen === "dashboard" && userData) return <Dashboard user={userData} onLogout={handleLogout} />;
  if (screen === "register")              return <RegisterScreen onRegister={handleAuth} onSwitch={() => setScreen("login")} />;
  return <LoginScreen onLogin={handleAuth} onSwitch={() => setScreen("register")} />;
}
