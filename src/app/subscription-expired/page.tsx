import React from 'react';
import Link from 'next/link';

export default function SubscriptionExpiredPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Neon Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-red-600/5 rounded-full blur-[90px] pointer-events-none" />
      
      {/* Monochromatic Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-lg border border-red-500/30 bg-black/60 backdrop-blur-xl p-8 rounded-2xl shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] text-center">
        {/* Red Alert Symbol */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-950/50 border border-red-500/50 flex items-center justify-center text-red-500 animate-pulse">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white mb-2 uppercase">
          Access Revoked
        </h1>
        <h2 className="text-lg font-medium text-red-400 mb-6 tracking-wide">
          Subscription Expired
        </h2>

        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          The deployment evaluation period or active subscription contract associated with this tenant node has terminated. All core workflows, marketplace listings, and API transactions have been securely locked.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="mailto:support@medhub.io?subject=MedHub%20Subscription%20Renewal"
            className="w-full py-3 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors text-sm shadow-[0_0_15px_rgba(239,68,68,0.4)]"
          >
            Contact System Operations
          </a>
          <Link
            href="/"
            className="w-full py-3 px-4 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 font-medium transition-colors text-sm"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
      
      {/* Bottom status watermark */}
      <div className="absolute bottom-6 text-zinc-600 text-xs font-mono select-none tracking-widest uppercase">
        MEDHUB CORE SECURE LAYER // TENANT_LOCK_ACTIVE
      </div>
    </main>
  );
}
