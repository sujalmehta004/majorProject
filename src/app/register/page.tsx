'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Check, Sparkles, Building, AlertCircle, RefreshCw, Key, Building2, Hospital, Pill, ArrowRight, Mail, Lock, MapPin, Phone, Eye, EyeOff, FileText, X, ShieldCheck } from 'lucide-react';
import { isValidEmail, isValidPhone } from '@/lib/validation';

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<'fields' | 'pricing' | 'otp'>('fields');
  const [role, setRole] = useState<'WHOLESALER' | 'RETAILER' | 'CLINIC'>('WHOLESALER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const [registrationImages, setRegistrationImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);

  const [otpCode, setOtpCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchPackages = async () => {
      setLoadingPackages(true);
      try {
        const res = await fetch('/api/superadmin/packages');
        const data = await res.json();
        if (res.ok && data.packages) {
          setPackages(data.packages);
          const active = data.packages.find((p: any) => p.isActive);
          if (active) setSelectedPackage(active);
        }
      } catch (err) {
        console.error('Failed to fetch subscription packages:', err);
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, []);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please provide login credentials.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address (e.g. name@company.com).'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters long.'); return; }

    if (role === 'WHOLESALER') {
      if (!companyName || !taxId || !wholesalerAddress || !wholesalerPhone) { setError('Please fill in all Distributor details.'); return; }
      if (!isValidPhone(wholesalerPhone)) { setError('Distributor phone number must be exactly 10 digits.'); return; }
    } else if (role === 'RETAILER') {
      if (!pharmacyName || !registrationNumber || !retailerAddress || !retailerPhone) { setError('Please fill in all Pharmacy details.'); return; }
      if (!isValidPhone(retailerPhone)) { setError('Pharmacy phone number must be exactly 10 digits.'); return; }
    } else if (role === 'CLINIC') {
      if (!clinicName || !licenseNumber || !clinicAddress || !clinicPhone) { setError('Please fill in all Clinic details.'); return; }
      if (!isValidPhone(clinicPhone)) { setError('Clinic phone number must be exactly 10 digits.'); return; }
    }

    if (!agreedTerms) {
      setError('You must accept the Terms & Conditions to proceed with registration.');
      return;
    }
    setStep('pricing');
  };

  const handleSendOtpRequest = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch verification code.');
      setSuccessMsg(`Verification code generated successfully.`);
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
    const payload: Record<string, any> = {
      email, password, role, otpCode, registrationImages,
      packageName: selectedPackage?.name || 'Free Plan',
      packagePrice: selectedPackage?.price ?? 0,
    };
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
                      const isDisabled = r.id === 'CLINIC';
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && setRole(r.id as any)}
                          style={{
                            padding: '14px 10px',
                            border: role === r.id ? `2px solid ${r.color}` : '1.5px solid #E2E8F0',
                            borderRadius: 12,
                            background: isDisabled ? '#F8FAFC' : role === r.id ? r.bg : 'white',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
                            fontFamily: 'inherit',
                            transition: 'all 0.2s',
                            opacity: isDisabled ? 0.6 : 1,
                            position: 'relative',
                          }}
                        >
                          {isDisabled && (
                            <span style={{
                              position: 'absolute', top: 4, right: 4,
                              fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
                              background: '#F1F5F9', color: '#64748B',
                              padding: '2px 5px', borderRadius: 4, border: '1px solid #CBD5E1'
                            }}>
                              Coming Soon
                            </span>
                          )}
                          <Icon style={{ width: 20, height: 20, color: isDisabled ? '#94A3B8' : role === r.id ? r.color : '#94A3B8', margin: '0 auto 6px' }} />
                          <div style={{ fontSize: 11, fontWeight: 700, color: isDisabled ? '#94A3B8' : role === r.id ? r.color : '#64748B' }}>{r.label}</div>
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
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="input-crisp" style={{ paddingLeft: 32, borderColor: email && !isValidEmail(email) ? '#EF4444' : undefined }} />
                    </div>
                    {email && !isValidEmail(email) && (
                      <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600, display: 'block', marginTop: 3 }}>
                        Invalid email structure (e.g. name@company.com)
                      </span>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94A3B8' }} />
                      <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create passcode" className="input-crisp" style={{ paddingLeft: 32, paddingRight: 36 }} />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: 0 }}
                        tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                      </button>
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
                            <input
                              type="tel"
                              required
                              maxLength={10}
                              value={wholesalerPhone}
                              onChange={(e) => setWholesalerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              placeholder="10-digit number (e.g. 9812345678)"
                              className="input-crisp"
                              style={{ paddingLeft: 32, fontFamily: 'monospace' }}
                            />
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
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={retailerPhone}
                            onChange={(e) => setRetailerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="10-digit number (e.g. 9812345678)"
                            className="input-crisp"
                            style={{ fontFamily: 'monospace' }}
                          />
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
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={clinicPhone}
                            onChange={(e) => setClinicPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="10-digit number (e.g. 9812345678)"
                            className="input-crisp"
                            style={{ fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Registration Document Images Upload (Up to 10 images, max 500MB each) */}
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16, marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                      📷 Business Registration & License Images (Up to 10 photos)
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
                      Upload photos of your DDA registration certificate, VAT/PAN certificate, citizenship, or store license (Max 500MB per image).
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      id="registration-image-input"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        const maxAllowed = 10;
                        setUploadingImages(true);
                        const { compressImageToBase64 } = await import('@/lib/imageCompressor');

                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          if (registrationImages.length + i >= maxAllowed) {
                            alert('You can upload up to 10 registration images maximum.');
                            break;
                          }
                          if (file.size > 500 * 1024) {
                            alert(`File "${file.name}" exceeds the 500 KB size limit. Please choose a smaller image.`);
                            continue;
                          }
                          try {
                            const compressed = await compressImageToBase64(file);
                            setRegistrationImages(prev => {
                              if (prev.length >= maxAllowed) return prev;
                              return [...prev, compressed];
                            });
                          } catch (err) {
                            console.error('Failed to compress image:', err);
                          }
                        }
                        setUploadingImages(false);
                        e.target.value = '';
                      }}
                    />

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {registrationImages.map((imgSrc, idx) => (
                        <div key={idx} style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #CBD5E1', position: 'relative', background: '#000' }}>
                          <img src={imgSrc} alt={`Doc ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => setRegistrationImages(prev => prev.filter((_, i) => i !== idx))}
                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.75)', color: '#FFFFFF', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {registrationImages.length < 10 && (
                        <label
                          htmlFor="registration-image-input"
                          style={{
                            width: 64, height: 64, borderRadius: 8, border: '2px dashed #0EA5E9', background: '#F0F9FF',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#0EA5E9', fontSize: 11, fontWeight: 800, textAlign: 'center', padding: 2
                          }}
                        >
                          {uploadingImages ? '...' : `+ Photo\n(${registrationImages.length}/10)`}
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions Acceptance Box */}
                <div style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: 10, padding: 14, marginTop: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <FileText style={{ width: 14, height: 14, color: '#0EA5E9' }} />
                      <span>Terms & Conditions & Compliance</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      style={{ background: 'none', border: 'none', color: '#0EA5E9', fontSize: 11, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
                    >
                      Read Full Terms & Policy
                    </button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                    <input
                      type="checkbox"
                      required
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      style={{ marginTop: 2, accentColor: '#0EA5E9', width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span>
                      I agree to MedHub's <strong>Terms of Service</strong> & <strong>Privacy Policy</strong>. I understand and acknowledge that <strong>Superadmin</strong> has administrative oversight to review my registered profile, PAN/VAT ID, uploaded documents, and transaction logs for verification and compliance.
                    </span>
                  </label>
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

              {loadingPackages ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: '#94A3B8', fontSize: 13 }}>
                  <RefreshCw style={{ width: 16, height: 16, animation: 'spin 0.8s linear infinite' }} />
                  Loading available plans...
                </div>
              ) : packages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>No subscription plans available at this time. Please contact the administrator.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: packages.length === 1 ? '1fr' : '1fr 1fr', gap: 16 }}>
                  {packages.map((pkg: any, idx: number) => {
                    const isSelected = selectedPackage?.id === pkg.id;
                    const features: string[] = pkg.features ? pkg.features.split(',').map((f: string) => f.trim()).filter(Boolean) : [];
                    const isFree = pkg.price === 0;
                    const accentColor = isFree ? '#0EA5E9' : idx === 1 ? '#10B981' : '#F97316';
                    const bgColor = isFree ? '#F0F9FF' : idx === 1 ? '#ECFDF5' : '#FFF7ED';
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => pkg.isActive && setSelectedPackage(pkg)}
                        style={{
                          border: isSelected ? `2px solid ${accentColor}` : '1.5px solid #E2E8F0',
                          background: isSelected ? `linear-gradient(to br, ${bgColor}, white)` : 'rgba(248,250,252,0.7)',
                          borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden',
                          cursor: pkg.isActive ? 'pointer' : 'not-allowed',
                          opacity: pkg.isActive ? 1 : 0.5,
                          transition: 'all 0.2s',
                          boxShadow: isSelected ? `0 0 0 4px ${accentColor}22` : 'none',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, right: 0, background: pkg.isActive ? accentColor : '#94A3B8', color: 'white', fontSize: 8, fontWeight: 800, fontFamily: 'monospace', padding: '3px 10px', borderBottomLeftRadius: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {pkg.isActive ? (isFree ? 'Free Trial' : 'Active') : 'Unavailable'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {isFree
                            ? <Sparkles style={{ width: 18, height: 18, color: accentColor }} />
                            : <Building style={{ width: 18, height: 18, color: accentColor }} />}
                          <span style={{ fontSize: 13, fontWeight: 800, color: pkg.isActive ? '#1E293B' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{pkg.name}</span>
                        </div>
                        {pkg.description && (
                          <div style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>{pkg.description}</div>
                        )}
                        <div style={{ fontSize: 28, fontWeight: 900, color: pkg.isActive ? '#1E293B' : '#94A3B8', fontFamily: 'monospace', marginBottom: 16 }}>
                          Rs. {Number(pkg.price).toLocaleString('en-IN')} <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>/ year</span>
                        </div>
                        {features.length > 0 && (
                          <ul style={{ listStyle: 'none', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {features.map((f: string) => (
                              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: pkg.isActive ? '#475569' : '#94A3B8' }}>
                                <Check style={{ width: 14, height: 14, color: pkg.isActive ? '#10B981' : '#CBD5E1', flexShrink: 0 }} />
                                {f}
                              </li>
                            ))}
                          </ul>
                        )}
                        {pkg.isActive ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedPackage(pkg); handleSendOtpRequest(); }}
                            disabled={loading}
                            className="btn-primary"
                            style={{ width: '100%', justifyContent: 'center', padding: '11px', background: isSelected ? accentColor : undefined }}
                          >
                            {loading && isSelected ? <RefreshCw style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} /> : null}
                            {isSelected ? `Continue with ${pkg.name}` : `Select ${pkg.name}`}
                          </button>
                        ) : (
                          <button type="button" disabled style={{ width: '100%', justifyContent: 'center', padding: '11px', background: '#E2E8F0', color: '#94A3B8', border: 'none', borderRadius: 10, cursor: 'not-allowed', fontWeight: 700, fontSize: 12 }}>
                            Plan Currently Unavailable
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowTermsModal(false)}
        >
          <div
            style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#E0F2FE', padding: 8, borderRadius: 10, display: 'flex' }}>
                  <ShieldCheck style={{ width: 20, height: 20, color: '#0284C7' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>Terms of Service & Regulatory Policy</h3>
                  <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>MedHub Pharmaceutical Supply Chain Platform</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', fontSize: 12, color: '#334155', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: 12, borderRadius: 8, color: '#92400E', fontSize: 11, fontWeight: 600 }}>
                <strong>Notice:</strong> By registering on MedHub, you agree to comply with Nepal Department of Drug Administration guidelines and platform verification protocols.
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>1. Superadmin Oversight & Administrative Access</h4>
                <p style={{ margin: 0 }}>
                  You explicitly acknowledge and consent that authorized <strong>Superadmin</strong> accounts have full administrative privileges to view, verify, audit, approve, or reject your organization's registered details, PAN/VAT identifiers, uploaded license documents, and system activity logs.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>2. Document & PAN Verification Standards</h4>
                <p style={{ margin: 0 }}>
                  All registered partners must provide valid, non-duplicate PAN/VAT ID credentials and legible supporting registration documents (maximum 10 images, max 500 KB per image). Registration attempts with duplicate PAN IDs will be flagged for Superadmin review.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>3. Pharmaceutical Stock & FEFO Inventory Protocol</h4>
                <p style={{ margin: 0 }}>
                  Wholesalers and Retailers agree to adhere strictly to First-Expiry, First-Out (FEFO) inventory management standards. Batch pricing, manufacturing details, and expiration dates must reflect genuine stock records.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>4. Data Protection & Security Controls</h4>
                <p style={{ margin: 0 }}>
                  Passwords are encrypted using industry-standard bcrypt hashing (12 salt rounds). Session credentials are encapsulated in secure HTTP-Only cookies. Sensitive business data is isolated via multi-tenant database scoping.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>5. Account Lock & Suspension Policy</h4>
                <p style={{ margin: 0 }}>
                  MedHub reserves the right to suspend or lock accounts that submit fraudulent licensing documents, invalid PAN details, or engage in unauthorized pharmaceutical distribution.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748B' }}>MedHub Compliance & Governance</span>
              <button
                type="button"
                onClick={() => { setAgreedTerms(true); setShowTermsModal(false); }}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: 12 }}
              >
                Accept & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
