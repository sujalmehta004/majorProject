'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Activity, MapPin, Award, ArrowRight, CheckCircle, HeartPulse, Sparkles, Globe, Cpu, Zap, Package, Users, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import NetworkCanvas from '@/components/NetworkCanvas';

export default function LandingPage() {
  const [radius, setRadius] = useState('5');
  const [pharmacies, setPharmacies] = useState([
    { name: 'Kanti Pharmacy', lat: 27.7210, lng: 85.3210, distance: 0 },
    { name: 'Patan Health Care', lat: 27.6710, lng: 85.3190, distance: 0 },
    { name: 'Kathmandu Clinic Dispensary', lat: 27.7120, lng: 85.3245, distance: 0 },
    { name: 'Swayambhu Pharma', lat: 27.7150, lng: 85.2900, distance: 0 },
  ]);
  const userLat = 27.7172;
  const userLng = 85.3240;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const updated = pharmacies.map(p => ({
      ...p,
      distance: parseFloat(calculateDistance(userLat, userLng, p.lat, p.lng).toFixed(2))
    }));
    setPharmacies(updated);
    const clearSessionOnBack = async () => {
      try { await fetch('/api/auth/logout'); } catch (err) { }
    };
    clearSessionOnBack();
  }, []);

  const [posCart, setPosCart] = useState<any[]>([
    { name: 'Paracetamol 500mg (P203)', price: 15, qty: 2 },
    { name: 'Amoxicillin 250mg (A540)', price: 45, qty: 1 }
  ]);
  const [barcodeInput, setBarcodeInput] = useState('PRODUCT-903-BATCH-401');
  const [rxSigned, setRxSigned] = useState(false);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #EBF8FF 0%, #FCE7F3 30%, #FFF7ED 60%, #ECFDF5 100%)', position: 'relative', overflowX: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <NetworkCanvas />

      {/* Background blobs */}
      <div style={{ position: 'absolute', top: '15%', left: '10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(186,230,253,0.4) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(251,207,232,0.35) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none', filter: 'blur(60px)' }} />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(to right, rgba(226,232,240,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(226,232,240,0.4) 1px, transparent 1px)',
        backgroundSize: '4rem 4rem',
      }} />

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'relative', zIndex: 10,
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 72,
        borderBottom: '1px solid rgba(226,232,240,0.6)',
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #0EA5E9, #EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 16, color: 'white',
            boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
            fontFamily: 'monospace',
          }}>M</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#1E293B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Med<span style={{ background: 'linear-gradient(to right, #0EA5E9, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
          </span>
        </div>

        {/* Nav Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/login" style={{
            padding: '8px 16px', borderRadius: 10,
            border: '1.5px solid #E0F2FE', background: 'rgba(255,255,255,0.9)',
            color: '#475569', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            textDecoration: 'none', transition: 'all 0.2s',
          }}>
            Sign In
          </Link>
          <Link href="/register" style={{
            padding: '8px 18px', borderRadius: 10,
            background: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
            color: 'white', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            textDecoration: 'none', transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(14,165,233,0.3)',
          }}>
            Register Partner
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: 900, margin: '0 auto',
        padding: '80px 24px 60px',
        textAlign: 'center',
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 20,
          border: '1.5px solid #BAE6FD', background: '#F0F9FF',
          color: '#0284C7', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          marginBottom: 24,
        }}>
          <Activity style={{ width: 12, height: 12 }} className="animate-pulse" />
          Decentralized Medical Supply Network
        </div>

        {/* H1 */}
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 60px)',
          fontWeight: 900, lineHeight: 1.05,
          color: '#1E293B', letterSpacing: '-0.03em',
          textTransform: 'uppercase', marginBottom: 20,
        }}>
          Connected Pharmaceutical<br />
          <span style={{
            background: 'linear-gradient(to right, #0EA5E9, #6366F1, #EC4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Supply Chain Ledger
          </span>
        </h1>

        <p style={{
          fontSize: 15, color: '#64748B', maxWidth: 560, margin: '0 auto 36px',
          lineHeight: 1.7, fontWeight: 400,
        }}>
          MedHub connects wholesale distributors, retail pharmacies, doctor clinics, and walk-in consumers onto a single secure network — optimizing costings, automating FIFO stock dispatches, and tracking expirations.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <Link href="/buy-medicine" style={{
            padding: '14px 28px', borderRadius: 12,
            background: 'linear-gradient(135deg, #EC4899, #F59E0B)',
            color: 'white', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(236,72,153,0.35)',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.2s',
          }}>
            Buy Medicine <ShoppingBag style={{ width: 14, height: 14 }} />
          </Link>
          <Link href="/register" style={{
            padding: '14px 28px', borderRadius: 12,
            background: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
            color: 'white', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(14,165,233,0.35)',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.2s',
          }}>
            Get Started <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: 32, marginTop: 48,
        }}>
          {[
            { label: 'Network Latency', value: '12ms', color: '#10B981' },
            { label: 'PostGIS Active', value: 'LIVE', color: '#0EA5E9' },
            { label: 'FIFO Dispatch', value: 'AUTO', color: '#F97316' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px 80px',
        borderTop: '1px solid rgba(226,232,240,0.6)',
        paddingTop: 60,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#94A3B8', marginBottom: 8,
          }}>
            Platform Capabilities
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1E293B', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
            Everything in One Terminal
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            {
              icon: HeartPulse, color: '#0EA5E9', bg: '#F0F9FF',
              title: 'Traceability & Safety',
              desc: 'Every drug batch number, barcode, and expiry date is fully traceable — preventing counterfeits and stock anomalies.',
              badge: 'OBJ 1',
            },
            {
              icon: Package, color: '#F97316', bg: '#FFF7ED',
              title: 'FIFO Stock Optimization',
              desc: 'Automated FIFO batch selection algorithms minimize inventory write-offs and maximize warehouse throughput.',
              badge: 'OBJ 2',
            },
            {
              icon: Users, color: '#10B981', bg: '#ECFDF5',
              title: 'Connected Onboarding',
              desc: 'Secure workspace environment for wholesalers, retailers, clinics, and staff users to trade on one platform.',
              badge: 'OBJ 3',
            },
            {
              icon: Shield, color: '#6366F1', bg: '#EFF6FF',
              title: 'B2B Credit Guards',
              desc: 'Overdue debt checks and limit controls enforce strict credit safeguards across all order transactions.',
              badge: 'GUARD',
            },
            {
              icon: Sparkles, color: '#EC4899', bg: '#FDF2F8',
              title: 'Walk-in POS Billing',
              desc: 'Process physical walk-in customers with a dedicated POS terminal — print A4 invoices instantly.',
              badge: 'POS',
            },
            {
              icon: Globe, color: '#7C3AED', bg: '#F5F3FF',
              title: 'Geo-Location Network',
              desc: 'PostGIS-powered pharmacy geolocation finder allows consumers to discover nearby drug outlets with GPS precision.',
              badge: 'GEO',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                style={{
                  background: 'rgba(255,255,255,0.80)',
                  backdropFilter: 'blur(12px)',
                  border: '1.5px solid rgba(186,230,253,0.5)',
                  borderRadius: 16,
                  padding: 24,
                  boxShadow: '0 2px 8px rgba(14,165,233,0.06)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: card.bg, color: card.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon style={{ width: 20, height: 20 }} />
                  </div>
                  <div>
                    <span style={{
                      fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: card.color, fontFamily: 'monospace',
                      background: card.bg, padding: '2px 6px', borderRadius: 4,
                    }}>
                      {card.badge}
                    </span>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginTop: 4, letterSpacing: '-0.01em' }}>
                      {card.title}
                    </h3>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7 }}>{card.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── INTERACTIVE SANDBOX ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px 80px',
        borderTop: '1px solid rgba(226,232,240,0.6)',
        paddingTop: 60,
      }}>
        <details style={{ cursor: 'pointer' }}>
          <summary style={{
            listStyle: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#94A3B8', marginBottom: 8,
            userSelect: 'none',
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.6)',
            border: '1.5px solid rgba(226,232,240,0.8)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu style={{ width: 14, height: 14, color: '#0EA5E9' }} />
              Interactive Platform Sandbox Demos
            </span>
            <span>▼</span>
          </summary>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>
            {/* Simulation 1 */}
            <div style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1.5px solid rgba(186,230,253,0.5)',
              borderRadius: 16, padding: 20,
              boxShadow: '0 2px 8px rgba(14,165,233,0.06)',
            }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#0284C7', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <MapPin style={{ width: 14, height: 14 }} />
                Geolocation Finder
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Radius:</span>
                <select
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="select-crisp"
                  style={{ width: 'auto', padding: '4px 28px 4px 8px', fontSize: 11 }}
                >
                  <option value="1">1 km</option>
                  <option value="3">3 km</option>
                  <option value="5">5 km</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pharmacies.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '6px 10px', borderRadius: 8,
                      color: p.distance <= parseFloat(radius) ? '#059669' : '#94A3B8',
                      fontWeight: p.distance <= parseFloat(radius) ? 700 : 500,
                      fontSize: 11,
                      background: p.distance <= parseFloat(radius) ? '#ECFDF5' : 'transparent',
                    }}
                  >
                    <span>{p.name}</span>
                    <span style={{ fontFamily: 'monospace' }}>{p.distance} km</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulation 2 */}
            <div style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1.5px solid rgba(251,207,232,0.5)',
              borderRadius: 16, padding: 20,
              boxShadow: '0 2px 8px rgba(236,72,153,0.05)',
            }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#BE185D', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Activity style={{ width: 14, height: 14 }} />
                Digital Prescriptions
              </h3>
              <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>Dr. A. R. Sharma, MD</div>
                <div style={{ fontSize: 9, color: '#94A3B8', fontFamily: 'monospace' }}>License #1982-NEPAL</div>
              </div>
              {!rxSigned ? (
                <button
                  onClick={() => setRxSigned(true)}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #EC4899, #BE185D)' }}
                >
                  Create Digital Prescription
                </button>
              ) : (
                <div style={{ padding: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.06em' }}>Token Generated</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', marginTop: 4, letterSpacing: '0.05em' }}>RX-TKN-98234-A7</div>
                </div>
              )}
            </div>

            {/* Simulation 3 */}
            <div style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1.5px solid rgba(254,215,170,0.5)',
              borderRadius: 16, padding: 20,
              boxShadow: '0 2px 8px rgba(249,115,22,0.05)',
            }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#C2410C', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Award style={{ width: 14, height: 14 }} />
                Pharmacy Checkout
              </h3>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="input-crisp"
                  style={{ fontSize: 11 }}
                  placeholder="SKU / barcode"
                />
                <button
                  onClick={() => {
                    if (barcodeInput) {
                      setPosCart([...posCart, { name: `Scanned (${barcodeInput.split('-')[0]})`, price: 20, qty: 1 }]);
                      setBarcodeInput('');
                    }
                  }}
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap', padding: '8px 14px' }}
                >
                  Scan
                </button>
              </div>
              <div style={{ maxHeight: 80, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {posCart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', padding: '2px 0' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.name}</span>
                    <span style={{ fontWeight: 700, color: '#1E293B', fontFamily: 'monospace', marginLeft: 8 }}>Rs. {item.price * item.qty}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: '#1E293B' }}>
                <span>Total</span>
                <span style={{ fontFamily: 'monospace', color: '#F97316' }}>
                  Rs. {posCart.reduce((a, b) => a + b.price * b.qty, 0)}
                </span>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        position: 'relative', zIndex: 5,
        maxWidth: 1200, margin: '0 auto',
        padding: '20px 24px',
        borderTop: '1px solid rgba(226,232,240,0.6)',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        background: 'rgba(255,255,255,0.3)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          MedHub Core Network · Port 5432 · PostGIS Active
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {['12ms Latency', 'FIFO Active', 'Encrypted'].map((t) => (
            <span key={t} style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap style={{ width: 10, height: 10, color: '#10B981' }} />
              {t}
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}
