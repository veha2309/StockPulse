"use client";
import { useEffect, useState } from "react";
import LoginScreen    from "@/components/auth/LoginScreen";
import RegisterScreen from "@/components/auth/RegisterScreen";
import Dashboard      from "@/components/dashboard/Dashboard";
import type { Screen, UserData } from "@/lib/types";

export default function App() {
  const [screen, setScreen]     = useState<Screen>("login");
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const email  = localStorage.getItem("session_email");
    if (!email) return;
    fetch(`/api/auth?email=${encodeURIComponent(email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const stored = JSON.parse(localStorage.getItem("session_user") ?? "null");
        if (!stored) return;
        setUserData({ ...stored, eTokens: data.eTokens, portfolio: data.portfolio, options: data.options ?? [] });
        setScreen("dashboard");
      });
  }, []);

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
