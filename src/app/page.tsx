'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ShoppingBag, Package, Activity, MapPin, Zap, Globe,
  HeartPulse, FileText, BarChart3, Workflow, ShieldAlert, Lock,
  ChevronRight, Database, ScanLine, Building2, Pill, UserCheck,
  Receipt, Truck, TrendingUp, CheckCircle2, Star, Sparkles,
  Package2, ClipboardList, CreditCard, Users, RefreshCw,
  BarChart, FileBarChart, Boxes, Tags, ArrowDownCircle,
  ChevronDown, BadgeCheck, Bell, ShoppingCart, Search
} from 'lucide-react';
import './landing.css';

/* ── INTERSECTION OBSERVER REVEAL ── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ── ANIMATED COUNTER ── */
function Counter({ val, suffix = '' }: { val: number | string; suffix?: string }) {
  const [v, setV] = useState<number | string>(typeof val === 'number' ? 0 : val);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (typeof val !== 'number') return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      let c = 0; const step = val / 40;
      const t = setInterval(() => { c += step; if (c >= val) { setV(val); clearInterval(t); } else setV(Math.floor(c)); }, 25);
      obs.disconnect();
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [val]);
  return <span ref={ref}>{v}{suffix}</span>;
}

/* ── CONNECTION FLOW NODE ── */
function FlowNode({ icon: Icon, title, sub, color, borderColor, bgColor, step }: any) {
  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: 'white', border: `2.5px solid ${borderColor}`, borderRadius: 22, padding: '24px 28px', minWidth: 180, boxShadow: `0 8px 32px ${color}18`, transition: 'all 0.3s ease', cursor: 'default' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 18px 48px ${color}28`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${color}18`; }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, position: 'absolute', top: -6, right: 24, animation: 'badge-ping 2s ease-in-out infinite' }} />
        <div style={{ width: 56, height: 56, borderRadius: 16, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Icon style={{ width: 26, height: 26, color }} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 4 }}>STEP {step}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748B' }}>{sub}</div>
      </div>
    </div>
  );
}

/* ── TIMELINE STEP ── */
function TimelineStep({ num, title, desc, color, bg, border, chips, idx, visible }: any) {
  return (
    <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-24px)', transition: `opacity 0.6s ${idx * 0.1}s, transform 0.6s ${idx * 0.1}s`, position: 'relative', paddingLeft: 52, marginBottom: 40 }}>
      {/* Number bubble */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 14, fontFamily: 'JetBrains Mono', boxShadow: `0 4px 16px ${color}55`, animation: `timeline-pulse 2s ${idx * 0.3}s ease-in-out infinite` }} >
        {num}
      </div>
      {/* Content card */}
      <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 18, padding: '20px 22px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, marginBottom: 12 }}>{desc}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((c: string) => (
            <span key={c} style={{ fontSize: 10, fontWeight: 800, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 5, background: `${color}15`, color, border: `1px solid ${color}30` }}>{c}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeDemo, setActiveDemo] = useState<'geo' | 'pos'>('geo');
  const [radius, setRadius] = useState('5');
  const [posCart, setPosCart] = useState([
    { name: 'Paracetamol 500mg', price: 15, qty: 2 },
    { name: 'Amoxicillin 250mg', price: 45, qty: 1 },
  ]);
  const [barcodeInput, setBarcodeInput] = useState('');

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const pharmacies = [
    { name: 'Kanti Pharmacy', km: 1.2, open: true },
    { name: 'Patan Health Care', km: 3.8, open: true },
    { name: 'Swayambhu Pharma', km: 5.1, open: false },
    { name: 'Kathmandu Central', km: 7.4, open: true },
  ];

  // section refs for reveal
  const secFeatures = useReveal();
  const secTimeline = useReveal();
  const secWholesaler = useReveal();
  const secRetailer = useReveal();
  const secB2C = useReveal();
  const secVerify = useReveal();

  return (
    <main className="lp">

      {/* ══ NAVBAR ══ */}
      <nav className="lp-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div className="lp-logo-icon">M</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Med<span style={{ color: '#F97316' }}>Hub</span>
            </div>
            <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Pharma Ledger & B2C Platform
            </div>
          </div>
        </Link>

        <div className="lp-nav-links-wrap" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[['#how', 'How It Works'], ['#wholesaler', 'Wholesaler'], ['#retailer', 'Retailer'], ['#b2c', 'Patient'], ['#verify', 'Verification'], ['#demo', 'Live Demo']].map(([href, label]) => (
            <a key={href} href={href} className="nav-link-item" style={{ padding: '7px 13px', borderRadius: 8, transition: 'all 0.18s' }}>{label}</a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/buy-medicine" style={{ padding: '9px 18px', borderRadius: 10, background: '#F0FDF4', color: '#16A34A', fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1.5px solid #BBF7D0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShoppingBag style={{ width: 14, height: 14 }} /> Buy Medicine</span>
          </Link>
          <Link href="/login" style={{ padding: '9px 18px', borderRadius: 10, background: '#FFF7ED', color: '#EA580C', fontWeight: 700, fontSize: 13, textDecoration: 'none', border: '1.5px solid #FED7AA' }}>Sign In</Link>
          <Link href="/register" className="btn-o" style={{ padding: '9px 18px', fontSize: 13 }}>
            Register <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>
      </nav>

      {/* ══ HERO — TWO COLUMN ══ */}
      <section style={{ position: 'relative', minHeight: '96vh', paddingTop: 92, paddingBottom: 40, overflow: 'hidden', background: 'radial-gradient(ellipse 110% 80% at 30% -10%, #FFF7ED 0%, #F0FDF4 50%, #FFFCF8 100%)' }}>
        {/* Subtle parallax blobs (behind content) */}
        <div className="px-layer" style={{ position: 'absolute', top: '5%', left: '-4%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,#FF6B0018,transparent 70%)', transform: `translateY(${scrollY * 0.2}px)`, pointerEvents: 'none' }} />
        <div className="px-layer" style={{ position: 'absolute', bottom: '0%', right: '-4%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,#22C55E14,transparent 70%)', transform: `translateY(${scrollY * -0.14}px)`, pointerEvents: 'none' }} />

        <div style={{ maxWidth: '90vw', width: '90%', margin: '0 auto', padding: '40px 24px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

          {/* ── LEFT: Text content ── */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 18px 7px 10px', borderRadius: 100, background: '#FFF7ED', border: '2px solid #FFEDD5', color: '#EA580C', fontSize: 12, fontWeight: 700, marginBottom: 22 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' }}>⚡</div>
              Nepal's Verified Pharma Ledger & B2C Network
            </div>

            <h1 style={{ fontSize: 'clamp(38px, 4.5vw, 62px)', fontWeight: 800, lineHeight: 1.07, color: '#0F172A', marginBottom: 22, letterSpacing: '-0.036em' }}>
              Unified Drug Wholesale,
              <br />
              <span style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #10B981 45%, #059669 100%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'shimmer-grad 4s linear infinite' }}>
                Retail & B2C Marketplace
              </span>
            </h1>

            <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.76, marginBottom: 34 }}>
              MedHub connects <strong style={{ color: '#F97316' }}>wholesale distributors</strong> to <strong style={{ color: '#16A34A' }}>licensed pharmacies</strong> via B2B FIFO batch ordering, and empowers <strong style={{ color: '#7C3AED' }}>patients</strong> to find verified stock nearby — all governed by a single Superadmin-locked compliance ledger with PAN, DDA & NMC verification.
            </p>

            {/* Key benefit bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 34 }}>
              {[
                { dot: '#F97316', text: 'FIFO inventory lock — prevents expired stock dispensing' },
                { dot: '#22C55E', text: 'Code128 auto-barcode for every registered drug batch' },
                { dot: '#8B5CF6', text: 'NMC doctor verification for Class-A prescription drugs' },
                { dot: '#14B8A6', text: 'WebSocket real-time sync across all dashboards & roles' },
              ].map(b => (
                <div key={b.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.dot, marginTop: 6, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: '#334155', fontWeight: 600, lineHeight: 1.5 }}>{b.text}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 36 }}>
              <Link href="/register" className="btn-o"><Building2 style={{ width: 17, height: 17 }} /> Get Started</Link>
              <Link href="/buy-medicine" className="btn-g"><ShoppingBag style={{ width: 17, height: 17 }} /> Buy Medicine Near You</Link>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { val: 'FIFO', label: 'Stock Allocation', color: '#F97316' },
                { val: '3-Tier', label: 'Role System', color: '#22C55E' },
                { val: 'AES-256', label: 'Encryption', color: '#8B5CF6' },
                { val: 'NMC+DDA', label: 'Compliance', color: '#14B8A6' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: 'white', borderRadius: 12, padding: '12px 8px', border: '1.5px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono', letterSpacing: '-0.02em' }}>{s.val}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Animated Platform Ecosystem SVG ── */}
          <div className="px-layer" style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 24, border: '2px solid #FED7AA', boxShadow: '0 16px 48px rgba(249,115,22,0.1)', padding: '20px 20px', position: 'relative', overflow: 'hidden', width: '100%', maxWidth: 460 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Platform Ecosystem</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Trust Architecture</div>
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#EA580C', background: '#FFF7ED', padding: '4px 10px', borderRadius: 7, border: '1px solid #FED7AA', fontFamily: 'JetBrains Mono' }}>SUPERADMIN LOCKED</div>
              </div>

              <svg viewBox="0 0 480 400" style={{ width: '100%', overflow: 'visible' }}>
                <defs>
                  <marker id="arw-o2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7z" fill="#F97316" opacity="0.8" /></marker>
                  <marker id="arw-g2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7z" fill="#22C55E" opacity="0.8" /></marker>
                  <marker id="arw-p2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7z" fill="#8B5CF6" opacity="0.8" /></marker>
                  <marker id="arw-t2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7z" fill="#14B8A6" opacity="0.8" /></marker>
                  <filter id="node-glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>

                {/* ── Superadmin center ── */}
                <circle cx="240" cy="185" r="52" fill="#0F172A" filter="url(#node-glow)" />
                <circle cx="240" cy="185" r="64" fill="none" stroke="rgba(249,115,22,0.25)" strokeWidth="1.5" strokeDasharray="6 4">
                  <animateTransform attributeName="transform" type="rotate" from="0 240 185" to="360 240 185" dur="14s" repeatCount="indefinite" />
                </circle>
                <circle cx="240" cy="185" r="76" fill="none" stroke="rgba(34,197,94,0.12)" strokeWidth="1" strokeDasharray="4 6">
                  <animateTransform attributeName="transform" type="rotate" from="360 240 185" to="0 240 185" dur="22s" repeatCount="indefinite" />
                </circle>
                <text x="240" y="178" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono">SUPERADMIN</text>
                <text x="240" y="194" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="JetBrains Mono">LOCK NODE</text>
                <text x="240" y="209" textAnchor="middle" fill="#F97316" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">COMPLIANCE HUB</text>

                {/* ── WHOLESALER node (top-left) ── */}
                <rect x="18" y="22" width="130" height="90" rx="14" fill="#FFF7ED" stroke="#F97316" strokeWidth="2" />
                <rect x="18" y="22" width="130" height="26" rx="14" fill="#F97316" />
                <rect x="18" y="36" width="130" height="12" fill="#F97316" />
                <text x="83" y="40" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono">WHOLESALER</text>
                <text x="83" y="62" textAnchor="middle" fill="#92400E" fontSize="9" fontFamily="JetBrains Mono">PAN / VAT ID</text>
                <text x="83" y="76" textAnchor="middle" fill="#92400E" fontSize="9" fontFamily="JetBrains Mono">Business License</text>
                <rect x="44" y="84" width="78" height="18" rx="5" fill="#FDBA74" />
                <text x="83" y="97" textAnchor="middle" fill="#7C2D12" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">✓ PAN VERIFIED</text>
                {/* Floating live dot */}
                <circle cx="148" cy="22" r="5" fill="#22C55E">
                  <animate attributeName="r" values="5;7;5" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
                </circle>

                {/* ── RETAILER node (top-right) ── */}
                <rect x="332" y="22" width="130" height="90" rx="14" fill="#F0FDF4" stroke="#22C55E" strokeWidth="2" />
                <rect x="332" y="22" width="130" height="26" rx="14" fill="#22C55E" />
                <rect x="332" y="36" width="130" height="12" fill="#22C55E" />
                <text x="397" y="40" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono">RETAILER</text>
                <text x="397" y="62" textAnchor="middle" fill="#166534" fontSize="9" fontFamily="JetBrains Mono">DDA LICENSE</text>
                <text x="397" y="76" textAnchor="middle" fill="#166534" fontSize="9" fontFamily="JetBrains Mono">Drug Registration</text>
                <rect x="358" y="84" width="78" height="18" rx="5" fill="#86EFAC" />
                <text x="397" y="97" textAnchor="middle" fill="#14532D" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">✓ DDA VERIFIED</text>
                <circle cx="332" cy="22" r="5" fill="#22C55E">
                  <animate attributeName="r" values="5;7;5" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite" />
                </circle>

                {/* ── PATIENT node (bottom-center) ── */}
                <rect x="170" y="300" width="140" height="85" rx="14" fill="#F5F3FF" stroke="#8B5CF6" strokeWidth="2" />
                <rect x="170" y="300" width="140" height="26" rx="14" fill="#8B5CF6" />
                <rect x="170" y="314" width="140" height="12" fill="#8B5CF6" />
                <text x="240" y="318" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono">PATIENT / B2C</text>
                <text x="240" y="340" textAnchor="middle" fill="#5B21B6" fontSize="9" fontFamily="JetBrains Mono">NMC Doctor Rx</text>
                <text x="240" y="354" textAnchor="middle" fill="#5B21B6" fontSize="9" fontFamily="JetBrains Mono">Order & Delivery</text>
                <rect x="196" y="362" width="88" height="16" rx="5" fill="#C4B5FD" />
                <text x="240" y="374" textAnchor="middle" fill="#4C1D95" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">CLASS-A RX</text>

                {/* ── LEDGER node (bottom-right small) ── */}
                <rect x="338" y="290" width="120" height="60" rx="12" fill="#F0FDFA" stroke="#14B8A6" strokeWidth="1.5" />
                <text x="398" y="316" textAnchor="middle" fill="#0F766E" fontSize="9" fontWeight="800" fontFamily="JetBrains Mono">DOUBLE-ENTRY</text>
                <text x="398" y="330" textAnchor="middle" fill="#0F766E" fontSize="9" fontFamily="JetBrains Mono">LEDGER</text>
                <text x="398" y="344" textAnchor="middle" fill="#14B8A6" fontSize="8" fontFamily="JetBrains Mono">WebSocket Sync</text>

                {/* ── Animated connector paths ── */}
                {/* Wholesaler → Superadmin */}
                <path d="M 148 68 C 200 68 210 130 192 175" stroke="#F97316" strokeWidth="1.8" fill="none" strokeDasharray="6 4" markerEnd="url(#arw-o2)">
                  <animate attributeName="stroke-dashoffset" from="0" to="-300" dur="5s" repeatCount="indefinite" />
                </path>
                {/* Retailer → Superadmin */}
                <path d="M 332 68 C 280 68 270 130 288 175" stroke="#22C55E" strokeWidth="1.8" fill="none" strokeDasharray="6 4" markerEnd="url(#arw-g2)">
                  <animate attributeName="stroke-dashoffset" from="0" to="-300" dur="5.5s" repeatCount="indefinite" />
                </path>
                {/* Superadmin → Patient */}
                <path d="M 240 237 L 240 300" stroke="#8B5CF6" strokeWidth="1.8" fill="none" strokeDasharray="6 4" markerEnd="url(#arw-p2)">
                  <animate attributeName="stroke-dashoffset" from="0" to="-200" dur="4s" repeatCount="indefinite" />
                </path>
                {/* Retailer → Ledger */}
                <path d="M 397 112 C 397 200 398 260 398 290" stroke="#14B8A6" strokeWidth="1.5" fill="none" strokeDasharray="5 4" markerEnd="url(#arw-t2)">
                  <animate attributeName="stroke-dashoffset" from="0" to="-250" dur="6s" repeatCount="indefinite" />
                </path>
                {/* B2B arc label */}
                <path d="M 148 40 Q 240 2 332 40" stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeDasharray="4 5" />
                <text x="240" y="18" textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">B2B ORDERS →</text>

                {/* Status indicators floating */}
                <rect x="160" y="130" width="76" height="22" rx="8" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1" />
                <text x="198" y="145" textAnchor="middle" fill="#EA580C" fontSize="8" fontWeight="700" fontFamily="JetBrains Mono">FIFO ALLOCATED</text>

                <rect x="244" y="130" width="76" height="22" rx="8" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1" />
                <text x="282" y="145" textAnchor="middle" fill="#16A34A" fontSize="8" fontWeight="700" fontFamily="JetBrains Mono">CREDIT CHECK</text>

                <rect x="90" y="220" width="82" height="22" rx="8" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1" />
                <text x="131" y="235" textAnchor="middle" fill="#EA580C" fontSize="8" fontWeight="700" fontFamily="JetBrains Mono">CODE128 RX</text>

                <rect x="305" y="220" width="82" height="22" rx="8" fill="#F5F3FF" stroke="#DDD6FE" strokeWidth="1" />
                <text x="346" y="235" textAnchor="middle" fill="#7C3AED" fontSize="8" fontWeight="700" fontFamily="JetBrains Mono">NMC LOOKUP</text>
              </svg>

              <p style={{ fontSize: 10.5, color: '#94A3B8', textAlign: 'center', marginTop: 8, fontFamily: 'JetBrains Mono', lineHeight: 1.6 }}>
                All platform actors verified & governed by Superadmin before B2B or B2C transactions unlock.
              </p>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.4, animation: 'float-y 2.5s ease-in-out infinite', paddingBottom: 8 }}>
          <div style={{ width: 1, height: 34, background: 'linear-gradient(to bottom, #F97316, transparent)' }} />
          <ChevronDown style={{ width: 16, height: 16, color: '#F97316' }} />
        </div>
      </section>

      {/* ══ SUPPLY CHAIN NETWORK IMAGE ══ */}
      <div style={{ background: '#0B0F1A', padding: '72px 48px', overflow: 'hidden', position: 'relative' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div className="eyebrow-tag" style={{ color: '#F97316' }}>
              <div className="eyebrow-pip" style={{ background: '#F97316' }} />
              Verified Supply Chain
            </div>
            <h2 className="sec-h2" style={{ color: 'white' }}>From Manufacturer to Patient — Every Step Audited</h2>
            <p className="sec-desc" style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 28 }}>
              Every drug batch is registered with a unique Code128 barcode at source, allocated via FIFO through the distribution chain, verified at retail level, and requires NMC prescription approval for Class-A medications.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Manufacturer', desc: 'Batch origin & registration', color: '#F97316' },
                { label: 'Wholesaler', desc: 'Barcode printing, B2B dispatch', color: '#22C55E' },
                { label: 'Retailer Pharmacy', desc: 'FIFO stock lock, POS, Rx verify', color: '#14B8A6' },
                { label: 'Patient', desc: 'Medicine ordering, prescription upload', color: '#8B5CF6' },
              ].map(n => (
                <div key={n.label} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: n.color, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{n.label}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>— {n.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="img-frame" style={{ height: 420, transform: `translateY(${scrollY * -0.04}px)`, transition: 'transform 0.15s linear' }}>
            <img src="/network.png" alt="Supply chain network visualization" />
          </div>
        </div>
      </div>

      {/* ══ CONNECTION FLOW CHART (Wholesaler ↔ Retailer ↔ Patient) ══ */}
      <section id="how" style={{ padding: '90px 48px', background: '#FFFCF8', borderTop: '1.5px solid #FFEDD5' }}>
        <div className="section-wrap">
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div className="eyebrow-tag" style={{ color: '#F97316', justifyContent: 'center' }}>
              <div className="eyebrow-pip" style={{ background: '#F97316' }} />
              Three-Tier Platform Connection
              <div className="eyebrow-pip" style={{ background: '#F97316' }} />
            </div>
            <h2 className="sec-h2">How All Three Roles Connect</h2>
            <p className="sec-desc" style={{ maxWidth: 600, margin: '0 auto' }}>A unified ledger links every actor in real time — from distributor batch to patient doorstep.</p>
          </div>

          {/* Horizontal connection flow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'nowrap', overflowX: 'auto', padding: '0 16px' }}>
            <FlowNode icon={Package2} title="Wholesaler" sub="Batch Distribution" color="#F97316" borderColor="#FED7AA" bgColor="#FFF7ED" step="01" />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px', minWidth: 120 }}>
              <div style={{ background: 'linear-gradient(135deg, #FFF7ED, #F0FDF4)', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '8px 14px', textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#EA580C', fontFamily: 'JetBrains Mono' }}>B2B ORDER</div>
                <div style={{ fontSize: 9, color: '#64748B' }}>Credit Verified</div>
              </div>
              <div style={{ height: 2, width: 80, background: 'linear-gradient(to right, #F97316, #22C55E)' }} />
              <div style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '8px 14px', textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#16A34A', fontFamily: 'JetBrains Mono' }}>FIFO LOCK</div>
                <div style={{ fontSize: 9, color: '#64748B' }}>Auto-allocated</div>
              </div>
            </div>

            <FlowNode icon={Building2} title="Retailer" sub="Pharmacy Store" color="#22C55E" borderColor="#BBF7D0" bgColor="#F0FDF4" step="02" />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px', minWidth: 120 }}>
              <div style={{ background: 'linear-gradient(135deg, #F0FDF4, #F5F3FF)', border: '1.5px solid #DDD6FE', borderRadius: 12, padding: '8px 14px', textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', fontFamily: 'JetBrains Mono' }}>B2C ORDER</div>
                <div style={{ fontSize: 9, color: '#64748B' }}>Rx Upload</div>
              </div>
              <div style={{ height: 2, width: 80, background: 'linear-gradient(to right, #22C55E, #8B5CF6)' }} />
              <div style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', border: '1.5px solid #C4B5FD', borderRadius: 12, padding: '8px 14px', textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', fontFamily: 'JetBrains Mono' }}>NMC CHECK</div>
                <div style={{ fontSize: 9, color: '#64748B' }}>Class-A only</div>
              </div>
            </div>

            <FlowNode icon={Users} title="Patient" sub="B2C Consumer" color="#8B5CF6" borderColor="#DDD6FE" bgColor="#F5F3FF" step="03" />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px', minWidth: 120 }}>
              <div style={{ background: 'linear-gradient(135deg, #F5F3FF, #FFF7ED)', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '8px 14px', textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#F97316', fontFamily: 'JetBrains Mono' }}>WEBSOCKET</div>
                <div style={{ fontSize: 9, color: '#64748B' }}>Live sync</div>
              </div>
              <div style={{ height: 2, width: 80, background: 'linear-gradient(to right, #8B5CF6, #F97316)' }} />
              <div style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '8px 14px', textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#EA580C', fontFamily: 'JetBrains Mono' }}>INVOICE</div>
                <div style={{ fontSize: 9, color: '#64748B' }}>VAT generated</div>
              </div>
            </div>

            <FlowNode icon={BarChart3} title="Ledger" sub="Double-Entry Settlement" color="#14B8A6" borderColor="#99F6E4" bgColor="#F0FDFA" step="04" />
          </div>
        </div>
      </section>

      {/* ══ WHOLESALER VERTICAL TIMELINE ══ */}
      <section id="wholesaler" style={{ padding: '90px 48px', background: 'white', borderTop: '1.5px solid #FFEDD5' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }} className="two-col-grid">
          {/* Left: image + stats */}
          <div ref={secWholesaler.ref}>
            <div className="eyebrow-tag" style={{ color: '#F97316' }}>
              <div className="eyebrow-pip" style={{ background: '#F97316' }} />
              Wholesale Distributor Module
            </div>
            <h2 className="sec-h2">Everything a Distributor Needs</h2>
            <p className="sec-desc" style={{ marginBottom: 28 }}>
              The Wholesaler portal is the backbone of MedHub — handling batch ingestion, Code128 barcode printing, pricing tiers, advance credit management, multi-staff access, and deep analytics all in one dashboard.
            </p>

            <div className="img-frame" style={{ height: 260, marginBottom: 24, opacity: secWholesaler.visible ? 1 : 0, transition: 'opacity 0.5s' }}>
              <img src="/warehouse.png" alt="Wholesale pharmaceutical warehouse operations" />
            </div>

            {/* Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { val: '100%', label: 'Batch Traceability', color: '#F97316', bg: '#FFF7ED' },
                { val: 'FIFO', label: 'Auto Allocation', color: '#22C55E', bg: '#F0FDF4' },
                { val: '1-Click', label: 'Invoice Print', color: '#8B5CF6', bg: '#F5F3FF' },
                { val: 'Live', label: 'Analytics Charts', color: '#14B8A6', bg: '#F0FDFA' },
              ].map(m => (
                <div key={m.label} style={{ background: m.bg, border: `1.5px solid ${m.color}30`, borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: 'JetBrains Mono' }}>{m.val}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginTop: 3 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: vertical process timeline */}
          <div ref={secTimeline.ref} style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: 17, top: 18, bottom: 60, width: 3, background: 'linear-gradient(to bottom, #F97316, #22C55E, #14B8A6, #8B5CF6)', borderRadius: 4 }} />

            {[
              { num: '1', title: 'Stock Batch Registration', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', chips: ['EXPIRY DATE', 'COST PRICE', 'MRSP PRICE', 'UNIT CONFIG'], desc: 'Register each drug batch with manufacturer name, manufacturing date, expiry date, tablets per strip, strips per box, cost per box, and maximum retail price.' },
              { num: '2', title: 'Auto Code128 Barcode Generation', color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', chips: ['CODE128', 'UNIQUE ID', 'PRINTABLE', 'SCANNABLE'], desc: 'System auto-generates a unique Code128 barcode for each batch entry — printable as physical stickers for shelf labeling and POS scanning.' },
              { num: '3', title: 'B2B Price List Management', color: '#14B8A6', bg: '#F0FDFA', border: '#99F6E4', chips: ['PRICING TIERS', 'VISIBILITY', 'DISCOUNT', 'CATALOGUE'], desc: 'Configure product pricing tiers visible to registered pharmacies. Products can be flagged as B2B-available or hidden from the wholesale catalogue.' },
              { num: '4', title: 'Incoming Order Management', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', chips: ['ORDER REVIEW', 'DISPATCH', 'INVOICE GEN', 'STATUS UPDATE'], desc: 'Review and approve pharmacy B2B orders. Dispatch triggers automatic FIFO batch allocation, stock deduction, VAT invoice generation, and WebSocket notification.' },
              { num: '5', title: 'Settlement & Payment Ledger', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', chips: ['ADVANCE BAL', 'CREDIT LIMIT', 'DOUBLE ENTRY', 'AUDIT LOG'], desc: 'Track pharmacy advance balances, set credit limits per pharmacy, and view the full double-entry ledger for every transaction with complete audit trail.' },
              { num: '6', title: 'Analytics & Reports Dashboard', color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8', chips: ['REVENUE CHART', 'TOP PRODUCTS', 'EXPIRY ALERTS', 'STAFF LOGS'], desc: 'Real-time charts for daily/monthly revenue, best-selling products by volume and margin, near-expiry batch alerts, and multi-staff activity monitoring.' },
            ].map((step, i) => (
              <TimelineStep key={i} {...step} idx={i} visible={secTimeline.visible} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ RETAILER FEATURES ══ */}
      <section id="retailer" style={{ padding: '90px 48px', background: '#F0FDF4', borderTop: '1.5px solid #BBF7D0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }} className="two-col-grid" ref={secRetailer.ref}>
          {/* Left: timeline for retailer */}
          <div>
            <div className="eyebrow-tag" style={{ color: '#16A34A' }}>
              <div className="eyebrow-pip" style={{ background: '#22C55E' }} />
              Retail Pharmacy Module
            </div>
            <h2 className="sec-h2">Complete Retail Pharmacy Workflow</h2>
            <p className="sec-desc" style={{ marginBottom: 32 }}>
              Retail pharmacies get a full-featured store management platform — from purchasing stock via the B2B portal to walk-in POS billing and online patient order management.
            </p>

            {/* Vertical retailer steps */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 17, top: 18, bottom: 60, width: 3, background: 'linear-gradient(to bottom, #22C55E, #14B8A6, #F97316)', borderRadius: 4 }} />
              {[
                { num: '1', title: 'B2B Wholesale Purchasing', color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', chips: ['ORDER CREATION', 'ADVANCE CHECK', 'FIFO BATCH', 'CREDIT LIMIT'], desc: 'Browse the wholesale catalogue, place purchase orders, and the system automatically verifies advance balance and allocates the earliest-expiring batch.' },
                { num: '2', title: 'Walk-in POS Counter', color: '#14B8A6', bg: '#F0FDFA', border: '#99F6E4', chips: ['BARCODE SCAN', 'STOCK DEDUCT', 'VAT INVOICE', 'THERMAL PRINT'], desc: 'Physical walk-in sales terminal with barcode scanning for instant product lookup, real-time stock deduction, and one-click VAT-compliant invoice printing.' },
                { num: '3', title: 'Online B2C Order Fulfillment', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', chips: ['ONLINE ORDERS', 'RX REVIEW', 'NMC CHECK', 'DISPATCH'], desc: 'Receive patient online orders, review uploaded prescription images for Class-A drugs, verify NMC license numbers, and mark for dispatch.' },
                { num: '4', title: 'Customer & Billing Management', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', chips: ['CUSTOMER DB', 'ORDER HISTORY', 'CREDIT NOTES', 'RETURNS'], desc: 'Maintain a full customer database with order history, manage billing cycles, issue credit notes, and process medicine return requests.' },
              ].map((step, i) => (
                <TimelineStep key={i} {...step} idx={i} visible={secRetailer.visible} />
              ))}
            </div>
          </div>

          {/* Right: pharmacy image + feature chips */}
          <div style={{ opacity: secRetailer.visible ? 1 : 0, transform: secRetailer.visible ? 'translateX(0)' : 'translateX(28px)', transition: 'opacity 0.7s 0.2s, transform 0.7s 0.2s' }}>
            <div className="img-frame" style={{ height: 340, marginBottom: 28 }}>
              <img src="/pharmacy.png" alt="Retail pharmacy store with digital POS" />
            </div>

            {/* Feature chip grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Real-time Inventory', icon: Boxes, color: '#22C55E' },
                { label: 'Advance Balance', icon: CreditCard, color: '#F97316' },
                { label: 'Supplier Bills', icon: ClipboardList, color: '#8B5CF6' },
                { label: 'Sales Analytics', icon: BarChart, color: '#14B8A6' },
                { label: 'DDA Compliance', icon: BadgeCheck, color: '#EC4899' },
                { label: 'Staff Multi-Login', icon: Users, color: '#F59E0B' },
              ].map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'white', borderRadius: 12, border: `1.5px solid ${f.color}20`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 16, height: 16, color: f.color }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══ B2C PATIENT SECTION ══ */}
      <section id="b2c" style={{ padding: '90px 48px', background: 'white', borderTop: '1.5px solid #DDD6FE' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }} className="two-col-grid" ref={secB2C.ref}>

          {/* Left: image + delivery steps */}
          <div style={{ opacity: secB2C.visible ? 1 : 0, transform: secB2C.visible ? 'translateX(0)' : 'translateX(-28px)', transition: 'opacity 0.7s, transform 0.7s' }}>
            <div className="img-frame" style={{ height: 320, marginBottom: 28 }}>
              <img src="/delivery.png" alt="Patient online medicine order delivery tracking" />
            </div>

            {/* Order flow pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { step: 1, label: 'Patient searches nearby pharmacy by radius', color: '#8B5CF6', icon: Search },
                { step: 2, label: 'Selects medicine & uploads NMC prescription', color: '#F97316', icon: FileText },
                { step: 3, label: 'Pharmacy verifies Rx & doctor NMC number', color: '#22C55E', icon: BadgeCheck },
                { step: 4, label: 'Order dispatched with tracking & notification', color: '#14B8A6', icon: Bell },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 14, height: 14, color: 'white' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: content */}
          <div style={{ opacity: secB2C.visible ? 1 : 0, transform: secB2C.visible ? 'translateX(0)' : 'translateX(28px)', transition: 'opacity 0.7s 0.2s, transform 0.7s 0.2s' }}>
            <div className="eyebrow-tag" style={{ color: '#7C3AED' }}>
              <div className="eyebrow-pip" style={{ background: '#8B5CF6' }} />
              B2C Consumer Platform
            </div>
            <h2 className="sec-h2">Buy Verified Medicines Online</h2>
            <p className="sec-desc" style={{ marginBottom: 28 }}>
              Patients use the public-facing B2C portal to search pharmacies by radius, browse available stock, and order medicines with doorstep delivery. Class-A prescription drugs require NMC-verified doctor credentials.
            </p>

            {/* Feature grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { title: 'Geolocation Radius Pharmacy Finder', icon: MapPin, color: '#8B5CF6', desc: 'Uses Haversine formula with PostGIS coordinates to locate pharmacies stocking the required medicine within a selected km radius.' },
                { title: 'Class-A NMC Prescription Check', icon: ShieldAlert, color: '#F97316', desc: 'Upload prescription image and enter prescribing doctor\'s NMC registration number. Pharmacy staff manually verify both before dispatch approval.' },
                { title: 'Single Flat Delivery Fee', icon: Truck, color: '#22C55E', desc: 'A flat delivery fee is set per pharmacy — automatically added to the order total. No hidden charges on any medicine purchase.' },
                { title: 'Real-Time Order Tracking', icon: Activity, color: '#14B8A6', desc: 'WebSocket-powered live order status transitions: Pending → Verified → Dispatched → Delivered — with instant in-app notifications.' },
              ].map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px', borderRadius: 14, background: '#FAFAFA', border: '1.5px solid #F1F5F9', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${f.color}08`; (e.currentTarget as HTMLElement).style.borderColor = `${f.color}30`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA'; (e.currentTarget as HTMLElement).style.borderColor = '#F1F5F9'; }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 20, height: 20, color: f.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{f.title}</div>
                      <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.6 }}>{f.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES DARK SECTION — ALL 9 MODULES ══ */}
      <section id="features" style={{ background: '#0B0F1A', padding: '90px 48px' }}>
        <div className="section-wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 54, flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div className="eyebrow-tag" style={{ color: '#FB923C' }}>
                <div className="eyebrow-pip" style={{ background: '#F97316' }} />
                Complete Platform Capabilities
              </div>
              <h2 className="sec-h2" style={{ color: 'white' }}>9 Specialized Modules,<br />One Unified Codebase</h2>
            </div>
            <div className="img-frame" style={{ width: 320, height: 200, flexShrink: 0 }}>
              <img src="/analytics.png" alt="Analytics dashboard with revenue charts" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { icon: HeartPulse, color: '#F97316', badgeBg: 'rgba(249,115,22,0.15)', badge: 'TRACEABILITY', title: 'End-to-End Drug Traceability', desc: 'Every tablet tracked from manufacturer batch to final patient sale via Code128 barcodes. Enables rapid counterfeit detection and batch recall.' },
              { icon: Boxes, color: '#22C55E', badgeBg: 'rgba(34,197,94,0.15)', badge: 'FIFO INVENTORY', title: 'Automatic FIFO Stock Allocation', desc: 'System selects the earliest-expiring batch automatically on every order, minimizing write-offs and preventing expired stock from being dispensed.' },
              { icon: ScanLine, color: '#14B8A6', badgeBg: 'rgba(20,184,166,0.15)', badge: 'POS TERMINAL', title: 'Walk-In Counter POS', desc: 'Barcode scanner terminal at pharmacy counter. Scan to identify product, auto-deduct from inventory, calculate VAT, and print thermal receipt.' },
              { icon: Globe, color: '#6366F1', badgeBg: 'rgba(99,102,241,0.15)', badge: 'GEO SEARCH', title: 'Haversine Radius Medicine Finder', desc: 'Patients submit GPS coordinates; PostGIS finds pharmacies within radius that have the required medicine in stock — live availability check.' },
              { icon: Zap, color: '#F59E0B', badgeBg: 'rgba(245,158,11,0.15)', badge: 'REAL-TIME', title: 'WebSocket Live Dashboard Sync', desc: 'All order status changes, stock updates, and payment confirmations broadcast instantly via WebSocket — no polling, no page refresh needed.' },
              { icon: Lock, color: '#EF4444', badgeBg: 'rgba(239,68,68,0.15)', badge: 'SECURITY', title: 'JWT Role-Based Authentication', desc: 'Separate JWT tokens per role. Bcrypt-hashed passwords. Subscription expiry auto-enforcement. Middleware-level route isolation.' },
              { icon: Receipt, color: '#8B5CF6', badgeBg: 'rgba(139,92,246,0.15)', badge: 'BILLING ENGINE', title: 'Automated VAT Invoice Generation', desc: 'Instant A4 and thermal-format invoice generation for every transaction with VAT breakdown, batch reference, and pharma-compliant layout.' },
              { icon: Database, color: '#06B6D4', badgeBg: 'rgba(6,182,212,0.15)', badge: 'POSTGIS', title: 'Spatial Database & Analytics', desc: 'PostgreSQL with PostGIS powers coordinate-based geospatial queries, atomic FIFO ledger transactions, and complex analytics joins.' },
              { icon: UserCheck, color: '#EC4899', badgeBg: 'rgba(236,72,153,0.15)', badge: 'SUPERADMIN', title: 'Superadmin Compliance Matrix', desc: 'Centralized dashboard to approve partner registrations (PAN/DDA/NMC verification), manage subscription tiers, and audit all system activity.' },
            ].map((f, i) => {
              const { ref, visible } = useReveal(0.1);
              const Icon = f.icon;
              return (
                <div key={f.title} ref={ref} className="card-dark" style={{ padding: 26, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)', transition: `opacity 0.5s ${i * 0.05}s, transform 0.5s ${i * 0.05}s` }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: f.badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Icon style={{ width: 22, height: 22, color: f.color }} />
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 800, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 8px', borderRadius: 4, background: f.badgeBg, color: f.color, display: 'inline-block', marginBottom: 8 }}>{f.badge}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.48)', lineHeight: 1.66 }}>{f.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ VERIFICATION SECTION ══ */}
      <section id="verify" style={{ padding: '90px 48px', background: '#FFF7ED', borderTop: '2px solid #FED7AA' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }} className="two-col-grid" ref={secVerify.ref}>
          <div style={{ opacity: secVerify.visible ? 1 : 0, transform: secVerify.visible ? 'translateX(0)' : 'translateX(-24px)', transition: 'opacity 0.7s, transform 0.7s' }}>
            <div className="eyebrow-tag" style={{ color: '#EA580C' }}>
              <div className="eyebrow-pip" style={{ background: '#F97316' }} />
              Multi-Tier Identity & Compliance
            </div>
            <h2 className="sec-h2">PAN, DDA & NMC Verification System</h2>
            <p className="sec-desc" style={{ marginBottom: 28 }}>
              No unverified actor can transact. The Superadmin manually audits every registration — creating a zero-tolerance environment for unregulated pharmaceutical distribution.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: '🏢', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', title: 'Wholesaler: PAN & VAT Tax Registration', desc: 'Distributors submit Permanent Account Number (PAN), VAT registration certificate, and trade license. Superadmin manually activates the wholesale account after audit.' },
                { icon: '💊', color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', title: 'Pharmacy: DDA Drug Administration License', desc: 'Retail pharmacies must hold a valid Drug Administration Department (DDA) license number. Verified before first B2B stock purchase is permitted.' },
                { icon: '🩺', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', title: 'Doctor: NMC Council License for Rx Drugs', desc: 'Class-A restricted medicines require the prescribing doctor\'s Nepal Medical Council (NMC) number plus an uploaded prescription photo before dispatch.' },
                { icon: '🔒', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', title: 'Subscription-Gated Access Control', desc: 'All business accounts must maintain active subscriptions. Expired accounts are auto-redirected to renewal — blocking API access and dashboard entry.' },
              ].map((c, i) => (
                <div key={c.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px', background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 16, transition: 'all 0.2s', cursor: 'default' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(6px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: `0 2px 8px ${c.color}20` }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{c.title}</div>
                    <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: SVG matrix diagram */}
          <div style={{ background: 'white', borderRadius: 24, padding: 32, border: '2px solid #FED7AA', boxShadow: '0 12px 48px rgba(249,115,22,0.1)', opacity: secVerify.visible ? 1 : 0, transform: secVerify.visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s 0.25s, transform 0.7s 0.25s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', fontFamily: 'JetBrains Mono' }}>Verification Matrix — Trust Layer</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#EA580C', background: '#FFF7ED', padding: '4px 10px', borderRadius: 7, border: '1px solid #FED7AA' }}>SUPERADMIN LOCK</span>
            </div>
            <svg viewBox="0 0 460 300" style={{ width: '100%' }}>
              {/* Wholesaler */}
              <rect x="10" y="20" width="130" height="75" rx="12" fill="#FFF7ED" stroke="#F97316" strokeWidth="2" />
              <text x="75" y="46" textAnchor="middle" fill="#EA580C" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">WHOLESALER</text>
              <text x="75" y="63" textAnchor="middle" fill="#9A3412" fontSize="8" fontFamily="JetBrains Mono">PAN / VAT ID</text>
              <text x="75" y="77" textAnchor="middle" fill="#9A3412" fontSize="8" fontFamily="JetBrains Mono">Business License</text>
              <rect x="46" y="83" width="58" height="16" rx="5" fill="#FDBA74" />
              <text x="75" y="95" textAnchor="middle" fill="#7C2D12" fontSize="8" fontWeight="700" fontFamily="JetBrains Mono">✓ VERIFIED</text>

              {/* Retailer */}
              <rect x="320" y="20" width="130" height="75" rx="12" fill="#F0FDF4" stroke="#22C55E" strokeWidth="2" />
              <text x="385" y="46" textAnchor="middle" fill="#16A34A" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">RETAILER</text>
              <text x="385" y="63" textAnchor="middle" fill="#14532D" fontSize="8" fontFamily="JetBrains Mono">DDA LICENSE</text>
              <text x="385" y="77" textAnchor="middle" fill="#14532D" fontSize="8" fontFamily="JetBrains Mono">Drug Registration</text>
              <rect x="356" y="83" width="58" height="16" rx="5" fill="#86EFAC" />
              <text x="385" y="95" textAnchor="middle" fill="#14532D" fontSize="8" fontWeight="700" fontFamily="JetBrains Mono">✓ VERIFIED</text>

              {/* Patient */}
              <rect x="165" y="215" width="130" height="65" rx="12" fill="#F5F3FF" stroke="#8B5CF6" strokeWidth="2" />
              <text x="230" y="240" textAnchor="middle" fill="#7C3AED" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">PATIENT</text>
              <text x="230" y="257" textAnchor="middle" fill="#5B21B6" fontSize="8" fontFamily="JetBrains Mono">NMC Doctor Rx</text>
              <rect x="201" y="265" width="58" height="16" rx="5" fill="#C4B5FD" />
              <text x="230" y="277" textAnchor="middle" fill="#4C1D95" fontSize="8" fontWeight="700" fontFamily="JetBrains Mono">CLASS-A RX</text>

              {/* Center Superadmin */}
              <circle cx="230" cy="138" r="44" fill="#0F172A" stroke="#F97316" strokeWidth="2.5" />
              <circle cx="230" cy="138" r="56" fill="none" stroke="rgba(249,115,22,0.2)" strokeWidth="1.5" strokeDasharray="5 4" style={{ animation: 'dash-move 12s linear infinite' }} />
              <text x="230" y="132" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="JetBrains Mono">SUPERADMIN</text>
              <text x="230" y="148" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="7.5" fontFamily="JetBrains Mono">LOCK NODE</text>

              {/* Paths */}
              <path d="M 140 58 C 180 58 200 110 196 125" stroke="#F97316" strokeWidth="1.5" fill="none" strokeDasharray="4 4" markerEnd="url(#ao)" style={{ animation: 'dash-move 10s linear infinite' }} />
              <path d="M 320 58 C 280 58 260 110 264 125" stroke="#22C55E" strokeWidth="1.5" fill="none" strokeDasharray="4 4" markerEnd="url(#ag)" style={{ animation: 'dash-move 10s linear infinite reverse' }} />
              <path d="M 230 215 L 230 195" stroke="#8B5CF6" strokeWidth="1.5" fill="none" strokeDasharray="4 4" markerEnd="url(#ap)" style={{ animation: 'dash-move 8s linear infinite' }} />

              <defs>
                <marker id="ao" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="#F97316" /></marker>
                <marker id="ag" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="#22C55E" /></marker>
                <marker id="ap" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="#8B5CF6" /></marker>
              </defs>

              {/* B2B arc */}
              <path d="M 140 45 Q 230 8 320 45" stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeDasharray="4 5" />
              <text x="230" y="22" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono">B2B ORDERS</text>
            </svg>
            <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 12, fontFamily: 'JetBrains Mono' }}>
              All partners receive Superadmin approval before any B2B or B2C transaction is permitted.
            </p>
          </div>
        </div>
      </section>

      {/* ══ INTERACTIVE LIVE DEMO ══ */}
      <section id="demo" style={{ padding: '90px 48px', background: 'white', borderTop: '1.5px solid #E2E8F0' }}>
        <div className="section-wrap">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div className="eyebrow-tag" style={{ color: '#F59E0B', justifyContent: 'center' }}>
              <div className="eyebrow-pip" style={{ background: '#F59E0B' }} />
              Interactive Sandboxes
            </div>
            <h2 className="sec-h2">Try Core Platform Features Live</h2>
            <p className="sec-desc" style={{ maxWidth: 520, margin: '0 auto' }}>No account needed. Interact with live simulations of geo search, Rx token generation, and POS billing.</p>
          </div>

          {/* Tab strip */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
            {[
              { id: 'geo', label: 'Radius Geo Search', color: '#8B5CF6', activeBg: '#8B5CF6', icon: MapPin },
              { id: 'pos', label: 'POS Barcode Scanner', color: '#22C55E', activeBg: '#22C55E', icon: ScanLine },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setActiveDemo(t.id as any)} className="demo-tab-btn"
                  style={{ borderColor: activeDemo === t.id ? t.color : '#E2E8F0', background: activeDemo === t.id ? t.activeBg : 'white', color: activeDemo === t.id ? 'white' : '#64748B' }}>
                  <Icon style={{ width: 15, height: 15 }} />{t.label}
                </button>
              );
            })}
          </div>

          {/* Demo window */}
          <div style={{ background: '#0B0F1A', borderRadius: 22, overflow: 'hidden', boxShadow: '0 20px 80px rgba(11,15,26,0.2)' }}>
            <div style={{ background: '#1E2235', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['#EF4444', '#F59E0B', '#22C55E'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
              <span style={{ marginLeft: 8, fontSize: 11.5, fontFamily: 'JetBrains Mono', color: 'rgba(255,255,255,0.3)' }}>
                medhub://{activeDemo === 'geo' ? 'patient/find-pharmacy' : 'retailer/pos-terminal'}
              </span>
            </div>
            <div style={{ padding: '28px 32px' }}>

              {/* GEO */}
              {activeDemo === 'geo' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                  <div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 18, fontFamily: 'JetBrains Mono' }}>// 27.7172°N, 85.3240°E — Kathmandu</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Search Radius:</span>
                      {['1', '3', '5', '10'].map(r => (
                        <button key={r} onClick={() => setRadius(r)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: radius === r ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)', color: radius === r ? '#A78BFA' : 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 12, fontFamily: 'JetBrains Mono', outline: radius === r ? '1px solid rgba(139,92,246,0.5)' : '1px solid transparent' }}>
                          {r}km
                        </button>
                      ))}
                    </div>
                    {pharmacies.map((p, i) => {
                      const inR = p.km <= parseFloat(radius);
                      return (
                        <div key={i} className="geo-pharmacy-row" style={{ background: inR ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', border: inR ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)', color: inR ? '#4ADE80' : 'rgba(255,255,255,0.3)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin style={{ width: 13, height: 13 }} />{p.name}</span>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>{p.km}km {inR ? '· In Range ✓' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                  <svg viewBox="0 0 280 220" style={{ width: '100%', borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <defs>
                      <radialGradient id="rg1" cx="50%" cy="50%"><stop offset="0%" stopColor="#F97316" stopOpacity="0.15" /><stop offset="100%" stopColor="#F97316" stopOpacity="0" /></radialGradient>
                    </defs>
                    {[40,80,120,160,200].map(v => (<React.Fragment key={v}><line x1={v} y1={0} x2={v} y2={220} stroke="rgba(255,255,255,0.04)" /><line x1={0} y1={v} x2={280} y2={v} stroke="rgba(255,255,255,0.04)" /></React.Fragment>))}
                    <circle cx={140} cy={110} r={parseFloat(radius) * 12} fill="url(#rg1)" stroke="rgba(249,115,22,0.3)" strokeWidth="1.5" strokeDasharray="5 4" style={{ animation: 'dash-move 10s linear infinite' }} />
                    <circle cx={140} cy={110} r={7} fill="#F97316" /><circle cx={140} cy={110} r={16} fill="none" stroke="#F97316" strokeWidth="1" opacity="0.3" style={{ animation: 'dash-move 6s linear infinite' }} />
                    <text x={140} y={128} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="JetBrains Mono">YOU</text>
                    {[{ x: 100, y: 78, km: 1.2 }, { x: 175, y: 125, km: 3.8 }, { x: 85, y: 140, km: 5.1 }, { x: 188, y: 68, km: 7.4 }].map((p, i) => {
                      const inR = p.km <= parseFloat(radius);
                      return (<g key={i}><circle cx={p.x} cy={p.y} r={6} fill={inR ? '#22C55E' : 'rgba(255,255,255,0.15)'} />{inR && <circle cx={p.x} cy={p.y} r={12} fill="none" stroke="#22C55E" strokeWidth="1" opacity="0.3" />}</g>);
                    })}
                  </svg>
                </div>
              )}

              {/* POS */}
              {activeDemo === 'pos' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                  <div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16, fontFamily: 'JetBrains Mono' }}>// WALK-IN COUNTER POS TERMINAL</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <input className="lp-input" value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} placeholder="Scan barcode or enter SKU..." style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', color: 'white' }} />
                      <button onClick={() => { if (barcodeInput) { setPosCart(c => [...c, { name: barcodeInput.slice(0,20), price: 22, qty: 1 }]); setBarcodeInput(''); }}} style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#F97316,#EA580C)', color: 'white', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 3px 12px rgba(249,115,22,0.35)', fontFamily: 'Plus Jakarta Sans' }}>
                        Scan
                      </button>
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 12 }}>
                      {posCart.map((item, i) => (
                        <div key={i} className="pos-item-row" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{item.name}</span>
                          <span style={{ fontFamily: 'JetBrains Mono', color: '#FB923C', fontWeight: 800 }}>Rs. {item.price * item.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                        <span>Subtotal</span><span style={{ fontFamily: 'JetBrains Mono' }}>Rs. {posCart.reduce((a, b) => a + b.price * b.qty, 0)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                        <span>VAT 13%</span><span style={{ fontFamily: 'JetBrains Mono' }}>Rs. {Math.round(posCart.reduce((a, b) => a + b.price * b.qty, 0) * 0.13)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900 }}>
                        <span style={{ color: 'white' }}>TOTAL</span>
                        <span style={{ fontFamily: 'JetBrains Mono', color: '#F97316' }}>Rs. {Math.round(posCart.reduce((a, b) => a + b.price * b.qty, 0) * 1.13)}</span>
                      </div>
                    </div>
                    <button style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
                      ✓ Process & Print VAT Invoice
                    </button>
                  </div>
                  <svg viewBox="0 0 220 290" style={{ width: '100%', borderRadius: 14, background: 'white', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                    <rect x="15" y="10" width="190" height="44" rx="10" fill="#0F172A" />
                    <text x="110" y="29" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono">MEDHUB POS</text>
                    <text x="110" y="46" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="JetBrains Mono">VAT INVOICE</text>
                    <line x1="25" y1="63" x2="195" y2="63" stroke="#F1F5F9" strokeDasharray="3 3" />
                    {posCart.slice(0, 5).map((item, i) => (<React.Fragment key={i}>
                      <text x="25"  y={79+i*22} fill="#475569" fontSize="8" fontFamily="JetBrains Mono">{item.name.slice(0, 20)}</text>
                      <text x="195" y={79+i*22} textAnchor="end" fill="#F97316" fontSize="8" fontFamily="JetBrains Mono" fontWeight="700">Rs.{item.price * item.qty}</text>
                    </React.Fragment>))}
                    <line x1="25" y1="180" x2="195" y2="180" stroke="#F1F5F9" strokeDasharray="3 3" />
                    <text x="25"  y="196" fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono">VAT 13%</text>
                    <text x="195" y="196" textAnchor="end" fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono">Rs.{Math.round(posCart.reduce((a,b)=>a+b.price*b.qty,0)*0.13)}</text>
                    <rect x="15" y="205" width="190" height="36" rx="8" fill="#FFF7ED" />
                    <text x="25"  y="228" fill="#0F172A" fontSize="12" fontWeight="800" fontFamily="JetBrains Mono">TOTAL</text>
                    <text x="195" y="228" textAnchor="end" fill="#F97316" fontSize="12" fontWeight="800" fontFamily="JetBrains Mono">Rs.{Math.round(posCart.reduce((a,b)=>a+b.price*b.qty,0)*1.13)}</text>
                    <text x="110" y="262" textAnchor="middle" fill="#CBD5E1" fontSize="7" fontFamily="JetBrains Mono">medhub.np · GST Registered · Thank You!</text>
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══ TECH STRIP ══ */}
      <div className="tech-strip">
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', fontFamily: 'JetBrains Mono', marginRight: 12 }}>TECH STACK</span>
        {[{ l: 'Next.js 16', c: '#FFFFFF' }, { l: 'TypeScript', c: '#60A5FA' }, { l: 'PostgreSQL', c: '#4ADE80' }, { l: 'PostGIS', c: '#34D399' }, { l: 'Prisma ORM', c: '#A78BFA' }, { l: 'WebSockets', c: '#FB923C' }, { l: 'JWT Auth', c: '#F87171' }, { l: 'bcrypt', c: '#C084FC' }, { l: 'React', c: '#38BDF8' }, { l: 'Lucide', c: '#F472B6' }].map(t => (
          <span key={t.l} className="tech-chip" style={{ color: t.c }}>{t.l}</span>
        ))}
      </div>

      {/* ══ CTA ══ */}
      <div style={{ background: '#0B0F1A', padding: '80px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', borderRadius: 28, padding: '72px 64px', textAlign: 'center', background: 'linear-gradient(135deg, #111827 0%, #1E2235 100%)', border: '1.5px solid rgba(249,115,22,0.2)', boxShadow: '0 20px 80px rgba(11,15,26,0.4)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30%', left: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.1), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-30%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.08), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px 6px 8px', borderRadius: 100, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: '#FB923C', fontSize: 12, fontWeight: 700, marginBottom: 22 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' }}>🚀</span>
              Ready to Join the Network?
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', marginBottom: 14 }}>
              Start Your Verified Pharma<br />Business Today
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.72 }}>
              Register as a Wholesale Distributor or Retail Pharmacy and get access to Nepal's most advanced pharmaceutical ledger network.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" className="btn-o"><Building2 style={{ width: 18, height: 18 }} /> Register Partner Business</Link>
              <Link href="/buy-medicine" className="btn-g"><ShoppingBag style={{ width: 18, height: 18 }} /> Buy Medicine Online</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <footer className="lp-footer">
        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'rgba(255,255,255,0.22)' }}>
          MedHub Pharmaceutical Ledger Network · All Rights Reserved
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[{ l: '⚡ 12ms WS', c: '#4ADE80' }, { l: '📦 FIFO Active', c: '#FB923C' }, { l: '🔒 PAN/DDA', c: '#A78BFA' }, { l: '🌐 PostGIS', c: '#38BDF8' }].map(p => (
            <div key={p.l} className="footer-badge" style={{ color: p.c, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 12px' }}>{p.l}</div>
          ))}
        </div>
      </footer>
    </main>
  );
}
