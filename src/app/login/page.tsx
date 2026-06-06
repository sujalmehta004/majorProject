'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Key, RefreshCw, CheckCircle, AlertCircle, LogIn, HelpCircle, Users, Lock, Mail, ArrowRight, Activity } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [view, setView] = useState<'login' | 'reset-force'>('login');
  const [resetUserEmail, setResetUserEmail] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopId, setShopId] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotResult, setForgotResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const clearSession = async () => {
      try { await fetch('/api/auth/logout'); } catch (err) { }
    };
    clearSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, isStaff, shopId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');
      if (data.forceResetPassword) {
        setResetUserEmail(email);
        setView('reset-force');
        setLoading(false);
        return;
      }
      setSuccessMsg('Authentication successful. Redirecting to panel...');
      setTimeout(() => { router.push(data.redirectUrl); }, 800);
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
      setLoading(false);
    }
  };

  const handleForceReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetUserEmail, password: newPassword })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update password.'); }
      setSuccessMsg('Password updated. Logging you in...');
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetUserEmail, password: newPassword, isStaff: false }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        setTimeout(() => { router.push(loginData.redirectUrl); }, 1000);
      } else {
        setView('login');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotResult('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok && data.tempPassword) {
        setForgotResult(`Recovery Code: "${data.tempPassword}" (forces password update on login)`);
      } else {
        setForgotResult(data.message || 'Recovery email simulated.');
      }
    } catch (err: any) {
      setForgotResult('Failed to recover account password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EBF8FF 0%, #FCE7F3 30%, #FFF7ED 60%, #ECFDF5 100%)',
      backgroundAttachment: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(186,230,253,0.5) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(251,207,232,0.4) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 10,
        maxWidth: 1200, width: '100%', margin: '0 auto',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(226,232,240,0.5)',
        background: 'rgba(255,255,255,0.4)',
        backdropFilter: 'blur(10px)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #0EA5E9, #EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 15, color: 'white', fontFamily: 'monospace',
            boxShadow: '0 4px 10px rgba(14,165,233,0.3)',
          }}>M</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Med<span style={{ background: 'linear-gradient(to right, #0EA5E9, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
          </span>
        </Link>
        <Link href="/" style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ← Return Home
        </Link>
      </header>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
        zIndex: 5,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 420px',
          gap: 0,
          width: '100%',
          maxWidth: 900,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(186,230,253,0.5)',
          borderRadius: 24,
          boxShadow: '0 8px 40px rgba(14,165,233,0.12), 0 2px 8px rgba(14,165,233,0.06)',
          overflow: 'hidden',
        }}>
          {/* Left Panel — Illustration */}
          <div style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
            padding: '48px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative gradient orbs */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
                <Activity style={{ width: 14, height: 14, color: '#0EA5E9' }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>
                  Secure Access Gateway
                </span>
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: 'white', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 14, textTransform: 'uppercase' }}>
                MedHub<br />
                <span style={{ background: 'linear-gradient(to right, #0EA5E9, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Terminal Access
                </span>
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 280 }}>
                Verify your credentials to access the secure wholesale supply chain management workspace.
              </p>
            </div>

            {/* Feature list */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {[
                { icon: Shield, text: 'End-to-end encrypted sessions' },
                { icon: Activity, text: 'Real-time audit logging' },
                { icon: Key, text: 'Role-based access control' },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon style={{ width: 13, height: 13, color: '#0EA5E9' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{f.text}</span>
                  </div>
                );
              })}

              <div style={{
                marginTop: 24, padding: '10px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                MEDHUB CORE · PORT 5432 · POSTGIS ACTIVE
              </div>
            </div>
          </div>

          {/* Right Panel — Form */}
          <div style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {/* Alerts */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 20 }}>
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                {error}
              </div>
            )}
            {successMsg && (
              <div className="alert alert-success" style={{ marginBottom: 20 }}>
                <CheckCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                {successMsg}
              </div>
            )}

            {view === 'login' ? (
              <div className="animate-fadeIn">
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  Welcome Back
                </h1>
                <p style={{ fontSize: 12, color: '#64748B', marginBottom: 24 }}>
                  Sign in to your MedHub workspace
                </p>

                {/* Mode toggle */}
                <div style={{
                  display: 'flex',
                  background: '#F1F5F9',
                  borderRadius: 10, padding: 4,
                  marginBottom: 24,
                  border: '1px solid #E2E8F0',
                }}>
                  {[
                    { label: 'Registered User', value: false },
                    { label: 'Wholesaler Staff', value: true },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => { setIsStaff(opt.value); setError(''); }}
                      style={{
                        flex: 1, padding: '8px 12px',
                        borderRadius: 8, border: 'none',
                        fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.2s',
                        background: isStaff === opt.value ? 'white' : 'transparent',
                        color: isStaff === opt.value ? '#1E293B' : '#94A3B8',
                        boxShadow: isStaff === opt.value ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {isStaff && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        Wholesaler Shop Node ID
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Users style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94A3B8' }} />
                        <input
                          type="text" required value={shopId}
                          onChange={(e) => setShopId(e.target.value)}
                          placeholder="Shop UUID (e.g. 63a67a8c-...)"
                          className="input-crisp"
                          style={{ paddingLeft: 34, fontFamily: 'monospace', fontSize: 11 }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      {isStaff ? 'Staff Email' : 'Email Address'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94A3B8' }} />
                      <input
                        type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="input-crisp"
                        style={{ paddingLeft: 34 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94A3B8' }} />
                      <input
                        type="password" required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="input-crisp"
                        style={{ paddingLeft: 34 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                      <input
                        type="checkbox" checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ accentColor: '#0EA5E9' }}
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      style={{ fontSize: 11, fontWeight: 600, color: '#0EA5E9', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{ justifyContent: 'center', padding: '12px', fontSize: 12, marginTop: 4, width: '100%' }}
                  >
                    {loading ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} /> : <LogIn style={{ width: 14, height: 14 }} />}
                    {loading ? 'Authenticating...' : 'Sign In to Terminal'}
                  </button>
                </form>

                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>New partner?</span>
                  <Link href="/register" className="btn-ghost" style={{ fontSize: 11, padding: '6px 14px', textDecoration: 'none' }}>
                    Create Account <ArrowRight style={{ width: 11, height: 11 }} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#FFF7ED', border: '1.5px solid #FED7AA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Key style={{ width: 20, height: 20, color: '#F97316' }} />
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  Reset Password
                </h1>
                <p style={{ fontSize: 12, color: '#64748B', marginBottom: 24 }}>
                  Your account requires a forced password reset. Please establish a new password to proceed.
                </p>
                <form onSubmit={handleForceReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>New Password</label>
                    <input type="password" required placeholder="At least 6 characters"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="input-crisp" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Confirm New Password</label>
                    <input type="password" required placeholder="Confirm new password"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-crisp" />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: 'center', padding: '12px', width: '100%' }}>
                    {loading ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} /> : 'Confirm New Password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setShowForgotModal(false); setForgotEmail(''); setForgotResult(''); }}
        >
          <div
            className="animate-scaleIn"
            style={{ background: 'rgba(255,255,255,0.96)', border: '1.5px solid #BAE6FD', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(14,165,233,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #F1F5F9' }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <HelpCircle style={{ width: 16, height: 16, color: '#0EA5E9' }} />
                Password Recovery
              </h3>
              <button
                onClick={() => { setShowForgotModal(false); setForgotEmail(''); setForgotResult(''); }}
                style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}
              >
                Close
              </button>
            </div>
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Email Address</label>
                <input type="email" required placeholder="name@company.com"
                  value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                  className="input-crisp" />
              </div>
              {forgotResult && (
                <div style={{ padding: '10px 14px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, fontSize: 11, fontFamily: 'monospace', color: '#0284C7', lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {forgotResult}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: 'center', padding: '11px', width: '100%' }}>
                {loading ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} /> : 'Request Reset Code'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
