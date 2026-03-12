"use client";

import "./globals.css";
import { useState, useCallback } from "react";
import Link from "next/link";
import WalletConnect, { type WalletUser } from "../components/WalletConnect";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [walletUser, setWalletUser] = useState<WalletUser | null>(null);

  const handleConnect = useCallback((user: WalletUser) => setWalletUser(user), []);
  const handleDisconnect = useCallback(() => setWalletUser(null), []);

  return (
    <html lang="en">
      <head>
        <title>Agent Commerce Network</title>
        <meta name="description" content="Decentralized AI agent marketplace on Stacks" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-stacks-500 flex items-center justify-center text-white font-bold text-sm">
                A
              </div>
              <span className="font-semibold text-gray-900 hidden sm:inline">
                Agent Commerce Network
              </span>
            </Link>

            <nav className="flex items-center gap-6">
              <Link
                href="/marketplace"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                Marketplace
              </Link>
              <WalletConnect
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            </nav>
          </div>
        </header>

        {/* Pass walletUser down via data attribute so pages can access it */}
        {/* In production, use React Context for this */}
        <main
          className="min-h-screen"
          data-wallet-address={walletUser?.address ?? ""}
        >
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white mt-16">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Agent Commerce Network — Bitcoin-secured AI labor marketplace
            </p>
            <p className="text-xs text-gray-400">Powered by Stacks · Clarity · USDCx</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
