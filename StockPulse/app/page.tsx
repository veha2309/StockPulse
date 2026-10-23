"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Screen, UserData } from "@/lib/types";
import LoginScreen from "@/components/auth/LoginScreen";
import RegisterScreen from "@/components/auth/RegisterScreen";
const Dashboard = dynamic(() => import("@/components/dashboard/Dashboard"), {
  ssr: false,
});

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const verify = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      if (res.status === 401) {
        setUserData(null);
        setScreen("login");
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.user)
        throw new Error(data.error || "Unable to verify your session");
      setUserData(data.user);
      setScreen("dashboard");
    } catch {
      setError(
        "Unable to verify your session. Check your connection and try again.",
      );
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    // Legacy local data is never proof of authentication.
    localStorage.removeItem("session_email");
    localStorage.removeItem("session_user");
    void verify();
  }, [verify]);
  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { method: "DELETE" });
      if (!res.ok) throw new Error("Sign-out failed");
      setUserData(null);
      setScreen("login");
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  }, []);
  function handleAuth(user: UserData) {
    setUserData(user);
    setScreen("dashboard");
    setError("");
  }
  if (checking)
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        Checking your session…
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center space-y-4">
          <p role="alert">{error}</p>
          <button className="btn-primary" onClick={() => void verify()}>
            Try again
          </button>
        </div>
      </div>
    );
  if (screen === "dashboard" && userData)
    return <Dashboard user={userData} onLogout={handleLogout} />;
  if (screen === "register")
    return (
      <RegisterScreen
        onRegister={handleAuth}
        onSwitch={() => setScreen("login")}
      />
    );
  return (
    <LoginScreen onLogin={handleAuth} onSwitch={() => setScreen("register")} />
  );
}
