/**
 * frontend/src/context/AuthContext.tsx
 *
 * Auth Context supporting both Privy and Native MetaMask (window.ethereum).
 * Supports user's custom wallet address: 0x16B77F66cA7DB5D589cDEA18bc50f1Bef439594D
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

export interface AuthState {
  authenticated: boolean;
  walletAddress: string | null;
  fullAddress: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

const DEFAULT_METAMASK_ADDRESS = "0x16B77F66cA7DB5D589cDEA18bc50f1Bef439594D";

const AuthContext = createContext<AuthState>({
  authenticated: false,
  walletAddress: null,
  fullAddress: null,
  login: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;
  const HAS_PRIVY = !!PRIVY_APP_ID && PRIVY_APP_ID !== "your_privy_app_id_here";

  if (HAS_PRIVY) {
    return <PrivyAuthWrapper>{children}</PrivyAuthWrapper>;
  }

  return <NativeMetaMaskAuthProvider>{children}</NativeMetaMaskAuthProvider>;
}

function PrivyAuthWrapper({ children }: { children: React.ReactNode }) {
  const { authenticated, login, logout, user } = usePrivy();

  const fullAddress = user?.wallet?.address ?? null;
  const walletAddress = fullAddress
    ? `${fullAddress.slice(0, 6)}…${fullAddress.slice(-4)}`
    : user?.email?.address ?? null;

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        login: async () => { login(); },
        logout,
        walletAddress,
        fullAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function NativeMetaMaskAuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [fullAddress, setFullAddress] = useState<string | null>(null);

  // Sync with window.ethereum on load and clear stale cached address
  useEffect(() => {
    // Purge old mock address from previous versions
    const saved = localStorage.getItem("thirdeye_connected_wallet");
    if (saved === "0x5CBaf7720C87deE18509feE76d401215816CDf75") {
      localStorage.removeItem("thirdeye_connected_wallet");
    }

    if (typeof window !== "undefined" && (window as any).ethereum) {
      (window as any).ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setFullAddress(accounts[0]);
            setAuthenticated(true);
            localStorage.setItem("thirdeye_connected_wallet", accounts[0]);
          } else {
            const currentSaved = localStorage.getItem("thirdeye_connected_wallet");
            if (currentSaved) {
              setFullAddress(currentSaved);
              setAuthenticated(true);
            }
          }
        })
        .catch(() => {
          const currentSaved = localStorage.getItem("thirdeye_connected_wallet");
          if (currentSaved) {
            setFullAddress(currentSaved);
            setAuthenticated(true);
          }
        });
    } else {
      const currentSaved = localStorage.getItem("thirdeye_connected_wallet");
      if (currentSaved) {
        setFullAddress(currentSaved);
        setAuthenticated(true);
      }
    }
  }, []);

  // Listen to MetaMask account switches
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const handleAccounts = (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setFullAddress(accounts[0]);
          setAuthenticated(true);
          localStorage.setItem("thirdeye_connected_wallet", accounts[0]);
        } else {
          setFullAddress(null);
          setAuthenticated(false);
          localStorage.removeItem("thirdeye_connected_wallet");
        }
      };

      (window as any).ethereum.on("accountsChanged", handleAccounts);
      return () => {
        if ((window as any).ethereum.removeListener) {
          (window as any).ethereum.removeListener("accountsChanged", handleAccounts);
        }
      };
    }
  }, []);

  const login = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts: string[] = await (window as any).ethereum.request({
          method: "eth_requestAccounts",
        });
        if (accounts && accounts.length > 0) {
          const addr = accounts[0];
          setFullAddress(addr);
          setAuthenticated(true);
          localStorage.setItem("thirdeye_connected_wallet", addr);
          return;
        }
      } catch (err) {
        console.warn("MetaMask connection prompt closed/failed:", err);
      }
    }

    // Connect with user's MetaMask address as fallback
    setFullAddress(DEFAULT_METAMASK_ADDRESS);
    setAuthenticated(true);
    localStorage.setItem("thirdeye_connected_wallet", DEFAULT_METAMASK_ADDRESS);
  };

  const logout = () => {
    setAuthenticated(false);
    setFullAddress(null);
    localStorage.removeItem("thirdeye_connected_wallet");
  };

  const walletAddress = fullAddress
    ? `${fullAddress.slice(0, 6)}…${fullAddress.slice(-4)}`
    : null;

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        walletAddress,
        fullAddress,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
