'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Check, Sparkles, Building, AlertCircle, RefreshCw, Key, Building2, Hospital, Pill, ArrowRight, Mail, Lock, MapPin, Phone } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<'fields' | 'pricing' | 'otp'>('fields');
  const [role, setRole] = useState<'WHOLESALER' | 'RETAILER' | 'CLINIC'>('WHOLESALER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [wholesalerAddress, setWholesalerAddress] = useState('');
  const [wholesalerPhone, setWholesalerPhone] = useState('');

  const [pharmacyName, setPharmacyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [retailerAddress, setRetailerAddress] = useState('');
  const [retailerPhone, setRetailerPhone] = useState('');
  const [latitude, setLatitude] = useState('27.7172');
  const [longitude, setLongitude] = useState('85.3240');

  const [clinicName, setClinicName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please provide login credentials.'); return; }
    if (role === 'WHOLESALER' && (!companyName || !taxId || !wholesalerAddress || !wholesalerPhone)) { setError('Please fill in all Distributor details.'); return; }
    if (role === 'RETAILER' && (!pharmacyName || !registrationNumber || !retailerAddress || !retailerPhone)) { setError('Please fill in all Pharmacy details.'); return; }
    if (role === 'CLINIC' && (!clinicName || !licenseNumber || !clinicAddress || !clinicPhone)) { setError('Please fill in all Clinic details.'); return; }
    setStep('pricing');
  };

  const handleSendOtpRequest = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setSimulatedOtp('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch verification code.');
      setSuccessMsg(`Verification code generated successfully.`);
      if (data.otpCode) setSimulatedOtp(data.otpCode);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to initialize verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) { setError('Please enter the 6-digit verification code.'); return; }
    setLoading(true);
    setError('');
    const payload: Record<string, any> = { email, password, role, otpCode };
    if (role === 'WHOLESALER') { payload.companyName = companyName; payload.taxId = taxId; payload.address = wholesalerAddress; payload.phone = wholesalerPhone; }
    else if (role === 'RETAILER') { payload.pharmacyName = pharmacyName; payload.registrationNumber = registrationNumber; payload.address = retailerAddress; payload.phone = retailerPhone; payload.latitude = parseFloat(latitude); payload.longitude = parseFloat(longitude); }
    else if (role === 'CLINIC') { payload.clinicName = clinicName; payload.licenseNumber = licenseNumber; payload.address = clinicAddress; payload.phone = clinicPhone; }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      if (role === 'WHOLESALER') router.push('/wholesaler/dashboard');
      else if (role === 'RETAILER') router.push('/retailer/dashboard');
      else router.push('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'WHOLESALER', label: 'Medicine Distributor', icon: Building2, color: '#0EA5E9', bg: '#F0F9FF' },
    { id: 'RETAILER', label: 'Retail Pharmacy', icon: Pill, color: '#10B981', bg: '#ECFDF5' },
    { id: 'CLINIC', label: 'Doctor Clinic', icon: Hospital, color: '#EC4899', bg: '#FDF2F8' },
  ];

  const stepProg = step === 'fields' ? 1 : step === 'pricing' ? 2 : 3;

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EBF8FF 0%, #FFF7ED 50%, #ECFDF5 100%)',
      backgroundAttachment: 'fixed',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Blobs */}
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(186,230,253,0.45) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 450, height: 450, background: 'radial-gradient(circle, rgba(187,247,208,0.35) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none' }} />

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 10,
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(226,232,240,0.5)',
        background: 'rgba(255,255,255,0.4)',
        backdropFilter: 'blur(10px)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #0EA5E9, #10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 15, color: 'white', fontFamily: 'monospace',
            boxShadow: '0 4px 10px rgba(14,165,233,0.3)',
          }}>M</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Med<span style={{ background: 'linear-gradient(to right, #0EA5E9, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>Already registered?</span>
          <Link href="/login" className="btn-ghost" style={{ fontSize: 11, padding: '6px 14px', textDecoration: 'none' }}>
            Sign In <ArrowRight style={{ width: 11, height: 11 }} />
          </Link>
        </div>
      </header>

      {/* Main */}
      <div style={{ position: 'relative', zIndex: 5, maxWidth: 720, margin: '40px auto', padding: '0 24px 60px' }}>
        {/* Step Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32, background: 'rgba(255,255,255,0.7)', borderRadius: 12, padding: '12px 20px', border: '1.5px solid rgba(186,230,253,0.4)', backdropFilter: 'blur(10px)' }}>
          {[
            { n: 1, label: 'Account Details' },
            { n: 2, label: 'Choose Plan' },
            { n: 3, label: 'Verify Email' },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  background: stepProg >= s.n ? 'linear-gradient(135deg, #0EA5E9, #6366F1)' : '#F1F5F9',
                  color: stepProg >= s.n ? 'white' : '#94A3B8',
                  boxShadow: stepProg === s.n ? '0 2px 8px rgba(14,165,233,0.4)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {stepProg > s.n ? <Check style={{ width: 12, height: 12 }} /> : s.n}
                </div>
                <span style={{ fontSize: 11, fontWeight: stepProg >= s.n ? 700 : 500, color: stepProg >= s.n ? '#1E293B' : '#94A3B8' }}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div style={{ width: 32, height: 2, background: stepProg > s.n ? 'linear-gradient(to right, #0EA5E9, #6366F1)' : '#E2E8F0', borderRadius: 2, flexShrink: 0, transition: 'all 0.3s' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(186,230,253,0.5)',
          borderRadius: 22,
          padding: '36px 36px',
          boxShadow: '0 8px 40px rgba(14,165,233,0.10)',
        }}>
          {/* Alerts */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
              {error}
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success" style={{ marginBottom: 20 }}>
              <Check style={{ width: 14, height: 14, flexShrink: 0 }} />
              {successMsg}
            </div>
          )}

          {/* Step 1: Fields */}
          {step === 'fields' && (
            <div className="animate-fadeIn">
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', marginBottom: 4 }}>
                Create Partner Account
              </h1>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 28 }}>
                Select your business role and enter your details to join the MedHub network.
              </p>

              <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Role Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Your Business Role
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {roles.map((r) => {
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRole(r.id as any)}
                          style={{
                            padding: '14px 10px',
                            border: role === r.id ? `2px solid ${r.color}` : '1.5px solid #E2E8F0',
                            borderRadius: 12,
                            background: role === r.id ? r.bg : 'white',
                            cursor: 'pointer',
                            textAlign: 'center',
                            fontFamily: 'inherit',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Icon style={{ width: 20, height: 20, color: role === r.id ? r.color : '#94A3B8', margin: '0 auto 6px' }} />
                          <div style={{ fontSize: 11, fontWeight: 700, color: role === r.id ? r.color : '#64748B' }}>{r.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Credentials */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94A3B8' }} />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="input-crisp" style={{ paddingLeft: 32 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94A3B8' }} />
                      <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create passcode" className="input-crisp" style={{ paddingLeft: 32 }} />
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 20 }}>
                  {/* Role-specific fields */}
                  {role === 'WHOLESALER' && (
                    <div className="animate-fadeIn">
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Distributor Information</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Company Name</label>
                          <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Kathmandu Distributors" className="input-crisp" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>PAN / VAT ID</label>
                          <input type="text" required value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="e.g. PAN-9028347" className="input-crisp" style={{ fontFamily: 'monospace' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Warehouse Address</label>
                          <div style={{ position: 'relative' }}>
                            <MapPin style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94A3B8' }} />
                            <input type="text" required value={wholesalerAddress} onChange={(e) => setWholesalerAddress(e.target.value)} placeholder="e.g. Koteshwor, Kathmandu" className="input-crisp" style={{ paddingLeft: 32 }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Phone Number</label>
                          <div style={{ position: 'relative' }}>
                            <Phone style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94A3B8' }} />
                            <input type="tel" required value={wholesalerPhone} onChange={(e) => setWholesalerPhone(e.target.value)} placeholder="+977-1-440234" className="input-crisp" style={{ paddingLeft: 32, fontFamily: 'monospace' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {role === 'RETAILER' && (
                    <div className="animate-fadeIn">
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Pharmacy Information</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Pharmacy Name</label>
                          <input type="text" required value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} placeholder="e.g. Kanti Pharmacy" className="input-crisp" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Drug License No.</label>
                          <input type="text" required value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="DDA-8923-KTM" className="input-crisp" style={{ fontFamily: 'monospace' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Pharmacy Address</label>
                          <div style={{ position: 'relative' }}>
                            <MapPin style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94A3B8' }} />
                            <input type="text" required value={retailerAddress} onChange={(e) => setRetailerAddress(e.target.value)} placeholder="Maharajgunj, Kathmandu" className="input-crisp" style={{ paddingLeft: 32 }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Phone</label>
                          <input type="tel" required value={retailerPhone} onChange={(e) => setRetailerPhone(e.target.value)} placeholder="+977-1-472093" className="input-crisp" style={{ fontFamily: 'monospace' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#94A3B8', marginBottom: 4 }}>Latitude</label>
                            <input type="text" required value={latitude} onChange={(e) => setLatitude(e.target.value)} className="input-crisp" style={{ fontFamily: 'monospace', fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#94A3B8', marginBottom: 4 }}>Longitude</label>
                            <input type="text" required value={longitude} onChange={(e) => setLongitude(e.target.value)} className="input-crisp" style={{ fontFamily: 'monospace', fontSize: 11 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {role === 'CLINIC' && (
                    <div className="animate-fadeIn">
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#EC4899', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Clinic Information</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Clinic Name</label>
                          <input type="text" required value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. Metro Care Center" className="input-crisp" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Council License No.</label>
                          <input type="text" required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="NMC-7823-A" className="input-crisp" style={{ fontFamily: 'monospace' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Clinic Address</label>
                          <div style={{ position: 'relative' }}>
                            <MapPin style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94A3B8' }} />
                            <input type="text" required value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="Lazimpat, Kathmandu" className="input-crisp" style={{ paddingLeft: 32 }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>Phone</label>
                          <input type="tel" required value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="+977-1-401984" className="input-crisp" style={{ fontFamily: 'monospace' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '13px', width: '100%', fontSize: 12 }}>
                  Continue to Plan Selection <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Pricing */}
          {step === 'pricing' && (
            <div className="animate-fadeIn">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', marginBottom: 4 }}>Choose Your Plan</h1>
                  <p style={{ fontSize: 12, color: '#64748B' }}>Select an operational subscription package to activate your node.</p>
                </div>
                <button onClick={() => setStep('fields')} style={{ fontSize: 11, fontWeight: 700, color: '#0EA5E9', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>
                  ← Edit Profile
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Free Plan */}
                <div style={{
                  border: '2px solid #0EA5E9', background: 'linear-gradient(to br, #F0F9FF, white)',
                  borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, background: '#0EA5E9', color: 'white', fontSize: 8, fontWeight: 800, fontFamily: 'monospace', padding: '3px 10px', borderBottomLeftRadius: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Free Trial
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Sparkles style={{ width: 18, height: 18, color: '#F97316' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Free Plan</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>365 days full access</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', marginBottom: 16 }}>
                    Rs. 0 <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>/ year</span>
                  </div>
                  <ul style={{ listStyle: 'none', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['Complete Distributor Tools', 'Inventory Packaging Tools', 'Expiry Tracking Alerts'].map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#475569' }}>
                        <Check style={{ width: 14, height: 14, color: '#10B981', flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={handleSendOtpRequest} disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
                    {loading ? <RefreshCw style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} /> : null}
                    Select Free Plan
                  </button>
                </div>

                {/* Paid Plan */}
                <div style={{ border: '1.5px solid #E2E8F0', background: 'rgba(248,250,252,0.7)', borderRadius: 16, padding: 24, opacity: 0.65 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Building style={{ width: 18, height: 18, color: '#94A3B8' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Paid Package</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>Priority support node</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#64748B', fontFamily: 'monospace', marginBottom: 16 }}>
                    Rs. 10,000 <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>/ year</span>
                  </div>
                  <ul style={{ listStyle: 'none', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['Unlimited Pharmacy Links', 'Custom Letterhead Invoicing', 'Priority API Integrations'].map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94A3B8' }}>
                        <Check style={{ width: 14, height: 14, color: '#CBD5E1', flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={handleSendOtpRequest} disabled={loading} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
                    Select Paid Plan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: OTP */}
          {step === 'otp' && (
            <div className="animate-fadeIn">
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#FFF7ED', border: '1.5px solid #FED7AA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Key style={{ width: 22, height: 22, color: '#F97316' }} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', marginBottom: 4 }}>
                Email Verification
              </h1>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 24 }}>
                A 6-digit verification code has been dispatched to <strong>{email}</strong>.
              </p>

              {simulatedOtp && (
                <div style={{
                  padding: '14px 16px', background: '#F0F9FF', border: '1.5px solid #BAE6FD',
                  borderRadius: 12, marginBottom: 20,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284C7', marginBottom: 6 }}>
                    Simulated Email Inbox — For Testing
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                    MedHub Code: <span style={{ background: 'white', border: '1px solid #BAE6FD', borderRadius: 6, padding: '2px 10px', color: '#0EA5E9' }}>{simulatedOtp}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleRegisterVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text" required maxLength={6}
                    value={otpCode} onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="e.g. 123456"
                    className="input-crisp"
                    style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.2em', padding: '14px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>
                    {loading ? <RefreshCw style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} /> : null}
                    Verify & Create Account
                  </button>
                  <button type="button" onClick={handleSendOtpRequest} disabled={loading} className="btn-ghost" style={{ padding: '12px 20px' }}>
                    Resend
                  </button>
                </div>

                <button type="button" onClick={() => setStep('pricing')} style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', textAlign: 'center' }}>
                  ← Back to pricing
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
