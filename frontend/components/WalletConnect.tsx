"use client";

import { useState, useEffect, useCallback } from "react";
import { showConnect } from "@stacks/connect";

export interface WalletUser {
  address: string;
  rawUserData: Record<string, unknown>;
}

interface WalletConnectProps {
  onConnect: (user: WalletUser) => void;
  onDisconnect: () => void;
}

const STORAGE_KEY = "acn_wallet_user";

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [user, setUser] = useState<WalletUser | null>(null);

  // Restore session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WalletUser;
        setUser(parsed);
        onConnect(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = useCallback(() => {
    showConnect({
      appDetails: {
        name: "Agent Commerce Network",
        icon: "/logo.svg",
      },
      onFinish: (data) => {
        const userData = data.userSession.loadUserData() as {
          profile: { stxAddress: { testnet: string; mainnet: string } };
        };
        const network = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? "devnet";
        const address =
          network === "mainnet"
            ? userData.profile.stxAddress.mainnet
            : userData.profile.stxAddress.testnet;

        const walletUser: WalletUser = {
          address,
          rawUserData: userData as Record<string, unknown>,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(walletUser));
        setUser(walletUser);
        onConnect(walletUser);
      },
      onCancel: () => {},
    });
  }, [onConnect]);

  const handleDisconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    onDisconnect();
  }, [onDisconnect]);

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 font-mono">
          {user.address.slice(0, 6)}…{user.address.slice(-4)}
        </span>
        <button
          onClick={handleDisconnect}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="px-4 py-2 rounded-lg bg-stacks-500 text-white text-sm font-medium hover:bg-stacks-600 transition-colors"
    >
      Connect Wallet
    </button>
  );
}
