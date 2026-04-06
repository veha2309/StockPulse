"use client";
import { useEffect, useState } from "react";
import LoginScreen    from "@/components/auth/LoginScreen";
import RegisterScreen from "@/components/auth/RegisterScreen";
import Dashboard      from "@/components/dashboard/Dashboard";
import type { Screen, UserData } from "@/lib/types";

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
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
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
