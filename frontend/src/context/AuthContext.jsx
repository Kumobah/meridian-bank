import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Step 1: password check. Does NOT log the user in - returns an otp_token
  // and masked phone number so the caller can move to the OTP screen.
  const requestLogin = async (username, password) => {
    return api.post("/api/auth/login", { username, password });
  };

  // Step 2: OTP check. On success the backend sets auth cookies for real.
  const verifyOtp = async (otpToken, code) => {
    const data = await api.post("/api/auth/verify-otp", { otp_token: otpToken, code });
    setUser(data.user);
    return data.user;
  };

  const resendOtp = async (otpToken) => {
    return api.post("/api/auth/resend-otp", { otp_token: otpToken });
  };

  // Registration skips the OTP step by design (instant account opening) -
  // the backend logs the user in directly and sets cookies immediately.
  const register = async (payload) => {
    const data = await api.post("/api/auth/register", payload);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout", {});
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, requestLogin, verifyOtp, resendOtp, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
