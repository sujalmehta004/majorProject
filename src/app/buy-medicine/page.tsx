'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  MapPin, Search, Compass, ShoppingBag, Mail, Phone,
  FileText, ArrowLeft, Loader, CheckCircle, X, Navigation,
  Download, Package, Map, Tag, ChevronRight, Info, Heart, Award
} from 'lucide-react';
import {
  fetchRetailersWithDistanceAction,
  searchMedicinesExpandedAction,
  placeConsumerOrderAction,
  trackConsumerOrderAction,
  cancelConsumerOrderAction
} from '@/app/actions/consumerActions';

type OrderMode = 'unit' | 'strip' | 'box';

export default function BuyMedicinePage() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Retailer list
  const [retailers, setRetailers] = useState<any[]>([]);
  const [retailersLoading, setRetailersLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Order Flow
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [orderMode, setOrderMode] = useState<OrderMode>('unit');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Checkout Form
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [useDetected, setUseDetected] = useState(true);
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Map Picker
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);

  // Success Order State
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  // Tracker State
  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Load Leaflet CDN
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).L) { setLeafletLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map when picker opens
  useEffect(() => {
    if (!showMapPicker || !leafletLoaded || !mapContainerRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const L = (window as any).L;
    const initLat = pickedLat || lat || 27.7172;
    const initLng = pickedLng || lng || 85.324;

    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([initLat, initLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
    marker.bindPopup('Drag to select delivery destination').openPopup();

    marker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      setPickedLat(parseFloat(pos.lat.toFixed(6)));
      setPickedLng(parseFloat(pos.lng.toFixed(6)));
    });

    map.on('click', (e: any) => {
      const { lat: cLat, lng: cLng } = e.latlng;
      marker.setLatLng([cLat, cLng]);
      setPickedLat(parseFloat(cLat.toFixed(6)));
      setPickedLng(parseFloat(cLng.toFixed(6)));
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    setTimeout(() => { map.invalidateSize(); }, 200);
  }, [showMapPicker, leafletLoaded]);

  // Fetch coordinates on mount
  useEffect(() => { getUserLocation(); }, []);

  const getUserLocation = () => {
    setLocationLoading(true);
    setCoordsError(null);
    if (!navigator.geolocation) {
      setCoordsError('Geolocation is disabled. Using default center.');
      setLat(27.7172); setLng(85.324);
      setLocationLoading(false);
      fetchRetailers(27.7172, 85.324);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setLocationLoading(false);
        fetchRetailers(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setCoordsError('Using default coordinates (Kathmandu).');
        setLat(27.7172); setLng(85.324);
        setLocationLoading(false);
        fetchRetailers(27.7172, 85.324);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const fetchRetailers = async (latitude: number, longitude: number) => {
    setRetailersLoading(true);
    const res = await fetchRetailersWithDistanceAction(latitude, longitude);
    if (res.success && res.retailers) setRetailers(res.retailers);
    setRetailersLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || lat === null || lng === null) return;
    setSearchLoading(true);
    setSearched(true);
    const res = await searchMedicinesExpandedAction(searchQuery, lat, lng);
    if (res.success && res.results) {
      setSearchResults(res.results);
    } else {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const openOrderModal = (item: any) => {
    setSelectedItem(item);
    setOrderMode('unit');
    setOrderQuantity(1);
    setShowOrderModal(true);
  };

  const getBaseUnits = (): number => {
    if (!selectedItem) return 0;
    const tps = selectedItem.product.tabletsPerStrip || 10;
    const spb = selectedItem.product.stripsPerBox || 10;
    if (orderMode === 'unit') return orderQuantity;
    if (orderMode === 'strip') return orderQuantity * tps;
    if (orderMode === 'box') return orderQuantity * tps * spb;
    return orderQuantity;
  };

  const getBoxPrice = (): number => selectedItem?.sellingPrice || 0;
  const getStripPrice = (): number => {
    if (!selectedItem) return 0;
    const spb = selectedItem.product.stripsPerBox || 10;
    return getBoxPrice() / spb;
  };
  const getUnitPrice = (): number => {
    if (!selectedItem) return 0;
    const tps = selectedItem.product.tabletsPerStrip || 10;
    const spb = selectedItem.product.stripsPerBox || 10;
    return getBoxPrice() / (tps * spb);
  };

  const getOrderTotal = (): number => {
    if (!selectedItem) return 0;
    return getBaseUnits() * getUnitPrice();
  };

  const getMaxQty = (): number => {
    if (!selectedItem) return 1;
    const tps = selectedItem.product.tabletsPerStrip || 10;
    const spb = selectedItem.product.stripsPerBox || 10;
    if (orderMode === 'unit') return selectedItem.quantity;
    if (orderMode === 'strip') return Math.floor(selectedItem.quantity / tps);
    if (orderMode === 'box') return Math.floor(selectedItem.quantity / (tps * spb));
    return selectedItem.quantity;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || orderSubmitting) return;
    if (!buyerName || !buyerEmail || !buyerPhone || !deliveryAddress) {
      alert('Please fill out all fields.'); return;
    }

    const baseUnits = getBaseUnits();
    if (baseUnits <= 0 || baseUnits > selectedItem.quantity) {
      alert('Invalid quantity.'); return;
    }

    setOrderSubmitting(true);
    let finalLat: number | undefined;
    let finalLng: number | undefined;

    if (useDetected) {
      finalLat = lat || undefined;
      finalLng = lng || undefined;
    } else if (pickedLat && pickedLng) {
      finalLat = pickedLat;
      finalLng = pickedLng;
    } else if (customLat && customLng) {
      finalLat = parseFloat(customLat);
      finalLng = parseFloat(customLng);
    }

    const res = await placeConsumerOrderAction({
      retailerId: selectedItem.retailerId,
      buyerName,
      buyerEmail,
      buyerPhone,
      deliveryAddress,
      latitude: finalLat,
      longitude: finalLng,
      deliveryFee: selectedItem.deliveryFee || 0,
      items: [{ productId: selectedItem.productId, quantity: baseUnits, pricePerUnit: getUnitPrice() }],
    });

    setOrderSubmitting(false);

    if (res.success && res.order) {
      setPlacedOrder(res.order);
      setShowOrderModal(false);
      downloadReceipt(res.order);
    } else {
      alert(res.error || 'Failed to place order.');
    }
  };

  const handleTrackOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackingCodeInput.trim()) return;
    setTrackingLoading(true);
    setTrackingError(null);
    setTrackedOrder(null);
    const res = await trackConsumerOrderAction(trackingCodeInput);
    setTrackingLoading(false);
    if (res.success && res.order) {
      setTrackedOrder(res.order);
    } else {
      setTrackingError(res.error || 'Order tracking code not found.');
    }
  };

  const handleCancelOrder = async (code: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    const res = await cancelConsumerOrderAction(code);
    if (res.success) {
      alert('Order cancelled successfully.');
      if (trackedOrder && trackedOrder.trackingCode === code) handleTrackOrder();
    } else {
      alert(res.error || 'Failed to cancel order.');
    }
  };

  const downloadReceipt = (order: any) => {
    const invoiceContent = `
==============================================
           MEDHUB DIGITAL RECEIPT             
==============================================
Tracking Code: ${order.trackingCode}
Status:        ${order.status}
Date:          ${new Date(order.createdAt).toLocaleString()}

Pharmacy:      ${order.retailer.pharmacyName}
Phone:         ${order.retailer.phone}
Address:       ${order.retailer.address}

CUSTOMER DETAILS:
Name:          ${order.buyerName}
Email:         ${order.buyerEmail}
Phone:         ${order.buyerPhone}
Delivery Addr: ${order.deliveryAddress}

GRAND TOTAL:   Rs. ${order.totalAmount.toFixed(2)} (Cash on Delivery)
==============================================
Thank you for ordering with MedHub!
`;
    const element = document.createElement('a');
    const file = new Blob([invoiceContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `MedHub-Receipt-${order.trackingCode}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getStatusColor = (status: string) => {
    if (status === 'PENDING') return { bg: '#FEF3C7', color: '#D97706' };
    if (status === 'SHIPPED') return { bg: '#EDE9FE', color: '#7C3AED' };
    if (status === 'DELIVERED') return { bg: '#D1FAE5', color: '#059669' };
    return { bg: '#FEE2E2', color: '#DC2626' };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', color: '#1F2937', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', color: '#FFFFFF', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -20, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: '#E0F2FE', fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: 20, backdropFilter: 'blur(4px)', transition: 'all 0.2s' }}>
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back to MedHub Home
            </Link>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>B2C Portal</span>
          </div>
          
          <div style={{ marginTop: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.025em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShoppingBag style={{ width: 36, height: 36 }} /> Find & Order Medicine
            </h1>
            <p style={{ fontSize: 15, color: '#D1FAE5', margin: '8px 0 0 0', maxWidth: 600, fontWeight: 500 }}>
              Instantly search inventory of certified pharmacies near you. Get accurate real-time pricing and choose unit, strip, or box packs.
            </p>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: 1140, margin: '30px auto 60px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 30 }}>

        {/* Left Column: Search & Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Location Status Bar */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '20px 24px', border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin style={{ width: 22, height: 22, color: '#059669' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detected Delivery Location</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 3 }}>
                  {lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Scanning coordinates...'}
                </div>
                {coordsError && <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, marginTop: 2 }}>{coordsError}</div>}
              </div>
            </div>
            <button onClick={getUserLocation} disabled={locationLoading} style={{ background: '#F3F4F6', border: 'none', padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#4B5563', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s' }}>
              {locationLoading ? <Loader className="animate-spin" style={{ width: 14, height: 14 }} /> : <Compass style={{ width: 14, height: 14 }} />}
              Sync Location
            </button>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearch} style={{ background: '#FFFFFF', borderRadius: 16, padding: 10, border: '1px solid #E5E7EB', display: 'flex', gap: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.04)' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16 }}>
              <Search style={{ width: 20, height: 20, color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Search medicine brand, generic name, category or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: 15, color: '#1F2937', fontWeight: 500 }}
              />
            </div>
            <button type="submit" disabled={searchLoading} style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', color: '#FFFFFF', border: 'none', padding: '14px 28px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
              {searchLoading ? <Loader className="animate-spin" style={{ width: 16, height: 16 }} /> : <ShoppingBag style={{ width: 16, height: 16 }} />}
              Search Inventory
            </button>
          </form>

          {/* Results section */}
          {searched && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 12, fontWeight: 900, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Available Pharmacy Matches</h3>
                <span style={{ fontSize: 11, background: '#E5E7EB', padding: '2px 8px', borderRadius: 12, fontWeight: 700, color: '#4B5563' }}>{searchResults.length} found</span>
              </div>

              {searchLoading ? (
                <div style={{ padding: 60, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Loader className="animate-spin" style={{ width: 36, height: 36, color: '#059669' }} />
                  <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 600 }}>Quering nearest local inventory lists...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: 50, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', textAlign: 'center', color: '#6B7280', fontSize: 14, fontWeight: 600 }}>
                  😔 No matching stock found in pharmacies within your service range.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {searchResults.map((item) => {
                    const tps = item.product.tabletsPerStrip || 10;
                    const spb = item.product.stripsPerBox || 10;
                    const boxPrice = item.sellingPrice;
                    const stripPrice = boxPrice / spb;
                    const unitPrice = boxPrice / (tps * spb);
                    const deliveryFee = item.deliveryFee || 0;

                    return (
                      <div key={item.id} style={{ background: '#FFFFFF', borderRadius: 18, padding: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 14, transition: 'transform 0.2s' }}>
                        {/* Upper Details */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{item.product.name}</span>
                              <span style={{ fontSize: 10, background: '#F3F4F6', color: '#4B5563', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{item.product.category}</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>Store:</span>
                              <strong style={{ color: '#059669', fontWeight: 700 }}>{item.retailer.pharmacyName}</strong>
                              <span style={{ color: '#D1D5DB' }}>•</span>
                              <span>{item.distance} km away</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: '#10B981', fontWeight: 800, background: '#ECFDF5', padding: '3px 10px', borderRadius: 20 }}>
                              {item.quantity} units in stock
                            </div>
                          </div>
                        </div>

                        {/* Middle: Prices grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                          {[
                            { title: 'Per Tablet/Unit', price: unitPrice, qtyText: '1 pc' },
                            { title: 'Per Strip', price: stripPrice, qtyText: `${tps} units` },
                            { title: 'Per Full Box', price: boxPrice, qtyText: `${tps * spb} units` },
                          ].map((p, idx) => (
                            <div key={idx} style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 12, padding: '10px 14px' }}>
                              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.title}</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#0F766E', marginTop: 2 }}>Rs. {p.price.toFixed(2)}</div>
                              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{p.qtyText} pack</div>
                            </div>
                          ))}
                        </div>

                        {/* Footer details & Action */}
                        <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, background: '#FDF2F8', color: '#DB2777', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>Exp: {new Date(item.expiryDate).toLocaleDateString()}</span>
                            {item.rack && <span style={{ fontSize: 11, background: '#FFFBEB', color: '#D97706', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontFamily: 'monospace' }}>Rack: {item.rack}</span>}
                            <span style={{ fontSize: 11, background: deliveryFee === 0 ? '#ECFDF5' : '#FFFBEB', color: deliveryFee === 0 ? '#059669' : '#D97706', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                              {deliveryFee === 0 ? '✓ Free Delivery' : `Delivery: Rs. ${deliveryFee}`}
                            </span>
                          </div>

                          <button
                            onClick={() => openOrderModal(item)}
                            style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s' }}
                          >
                            Order Now <ChevronRight style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Near Pharmacies List (Initial state) */}
          {!searched && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <h3 style={{ fontSize: 12, fontWeight: 900, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Registered Local Pharmacies</h3>
              
              {retailersLoading ? (
                <div style={{ padding: 45, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'center' }}>
                  <Loader className="animate-spin" style={{ width: 28, height: 28, color: '#059669' }} />
                </div>
              ) : retailers.length === 0 ? (
                <div style={{ padding: 25, background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', color: '#6B7280', fontSize: 13 }}>No active retailer pharmacies detected.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {retailers.map((r) => (
                    <div key={r.id} style={{ background: '#FFFFFF', borderRadius: 16, padding: 18, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontWeight: 800, color: '#111827', fontSize: 14 }}>{r.pharmacyName}</div>
                      <div style={{ fontSize: 12, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 4 }}>📍 {r.address}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>📞 {r.phone}</div>
                      
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 6 }}>
                          {r.distance} km away
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.deliveryFee === 0 ? '#2563EB' : '#D97706', background: r.deliveryFee === 0 ? '#EFF6FF' : '#FFFBEB', padding: '2px 8px', borderRadius: 6 }}>
                          {r.deliveryFee === 0 ? 'Free Delivery' : `Delivery: Rs. ${r.deliveryFee}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Tracking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Order Placement Success */}
          {placedOrder && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 4px 20px rgba(16,185,129,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#047857' }}>
                <CheckCircle style={{ width: 22, height: 22 }} />
                <span style={{ fontWeight: 800, fontSize: 15 }}>Order Registered Successfully!</span>
              </div>
              <p style={{ fontSize: 13, color: '#065F46', margin: 0, lineHeight: 1.4 }}>
                Keep your tracking code below to monitor your order progress or download a receipt.
              </p>
              
              <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: 8, border: '1px solid #D1FAE5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 15, color: '#047857' }}>{placedOrder.trackingCode}</span>
                <button
                  onClick={() => downloadReceipt(placedOrder)}
                  style={{ background: '#047857', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Download style={{ width: 12, height: 12 }} /> Invoice
                </button>
              </div>
            </div>
          )}

          {/* Tracking Form */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 24, border: '1px solid #E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 900, color: '#111827', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Navigation style={{ width: 16, height: 16, color: '#059669' }} /> Track Order Status
            </h3>
            
            <form onSubmit={handleTrackOrder} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Tracking Code (MH-XXXXXX)"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, outline: 'none' }}
              />
              <button type="submit" disabled={trackingLoading} style={{ background: '#1F2937', color: '#FFFFFF', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {trackingLoading ? <Loader className="animate-spin" style={{ width: 14, height: 14 }} /> : 'Track'}
              </button>
            </form>

            {trackingError && <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, background: '#FEE2E2', padding: '8px 12px', borderRadius: 8 }}>{trackingError}</div>}

            {trackedOrder && (() => {
              const sc = getStatusColor(trackedOrder.status);
              return (
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 800 }}>STATUS:</span>
                    <span style={{ fontSize: 11, fontWeight: 900, padding: '3px 12px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                      {trackedOrder.status}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, color: '#111827', fontSize: 13 }}>{trackedOrder.retailer.pharmacyName}</div>
                    <div style={{ color: '#4B5563', fontSize: 12, marginTop: 2 }}>Phone: {trackedOrder.retailer.phone}</div>
                  </div>

                  <div style={{ background: '#F9FAFB', padding: 12, borderRadius: 10, border: '1px solid #F3F4F6', fontSize: 12 }}>
                    <div style={{ fontWeight: 800, color: '#475569', marginBottom: 8 }}>Order Items:</div>
                    {trackedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ color: '#4B5563' }}>{item.product.name} (x{item.quantity})</span>
                        <span style={{ fontWeight: 700, color: '#111827' }}>Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</span>
                      </div>
                    ))}
                    {trackedOrder.deliveryFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#D97706', fontWeight: 700 }}>
                        <span>Delivery Fee:</span>
                        <span>Rs. {trackedOrder.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 10, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#111827', fontSize: 13 }}>
                      <span>Total Payable:</span>
                      <span>Rs. {trackedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => downloadReceipt(trackedOrder)} style={{ flex: 1, background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <FileText style={{ width: 14, height: 14 }} /> Invoice
                    </button>
                    {trackedOrder.status === 'PENDING' && (
                      <button onClick={() => handleCancelOrder(trackedOrder.trackingCode)} style={{ flex: 1, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <X style={{ width: 14, height: 14 }} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ─── Order Placement Modal ─── */}
      {showOrderModal && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 520, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#111827', margin: 0 }}>Review Order Details</h3>
              <button onClick={() => setShowOrderModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X style={{ width: 20, height: 20, color: '#6B7280' }} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Product selector info card */}
              <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.02) 0%, rgba(5,150,105,0.05) 100%)', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
                <div style={{ fontWeight: 800, color: '#111827', fontSize: 15 }}>{selectedItem.product.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Pharmacy: {selectedItem.retailer.pharmacyName}</div>
                
                {/* Pack type selection */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginTop: 12 }}>
                  {([
                    { label: 'Single Unit', price: getUnitPrice(), mode: 'unit' as OrderMode },
                    { label: 'Strip Pack', price: getStripPrice(), mode: 'strip' as OrderMode },
                    { label: 'Box Pack', price: getBoxPrice(), mode: 'box' as OrderMode },
                  ]).map(opt => (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => { setOrderMode(opt.mode); setOrderQuantity(1); }}
                      style={{ padding: '10px 4px', borderRadius: 10, border: `2px solid ${orderMode === opt.mode ? '#059669' : '#E5E7EB'}`, background: orderMode === opt.mode ? '#ECFDF5' : '#FFFFFF', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                    >
                      <div style={{ fontSize: 9, color: orderMode === opt.mode ? '#059669' : '#9CA3AF', fontWeight: 800, textTransform: 'uppercase' }}>{opt.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#0F766E', marginTop: 2 }}>Rs. {opt.price.toFixed(1)}</div>
                    </button>
                  ))}
                </div>

                {/* Adjuster */}
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                    Enter Quantity ({orderMode}s) — Limit: {getMaxQty()}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #D1D5DB', background: '#FFFFFF', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <input
                      type="number" min={1} max={getMaxQty()}
                      value={orderQuantity}
                      onChange={e => setOrderQuantity(Math.min(getMaxQty(), Math.max(1, parseInt(e.target.value) || 1)))}
                      style={{ width: 80, padding: '7px', textAlign: 'center', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 14, fontWeight: 800, outline: 'none' }}
                    />
                    <button type="button" onClick={() => setOrderQuantity(Math.min(getMaxQty(), orderQuantity + 1))} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #D1D5DB', background: '#FFFFFF', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>({getBaseUnits()} base units)</span>
                  </div>
                </div>
              </div>

              {/* Form Input Fields */}
              {[
                { label: 'Patient / Buyer Name', value: buyerName, onChange: setBuyerName, type: 'text', placeholder: 'e.g. John Doe' },
                { label: 'Email Address', value: buyerEmail, onChange: setBuyerEmail, type: 'email', placeholder: 'e.g. john@example.com' },
                { label: 'Contact Phone Number', value: buyerPhone, onChange: setBuyerPhone, type: 'text', placeholder: 'e.g. 9841XXXXXX' },
                { label: 'Delivery Location Address', value: deliveryAddress, onChange: setDeliveryAddress, type: 'text', placeholder: 'Street details, Ward No., City' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase' }}>{f.label}</label>
                  <input
                    type={f.type}
                    required
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 13, outline: 'none' }}
                  />
                </div>
              ))}

              {/* Location Picker */}
              <div style={{ border: '1px solid #E5E7EB', padding: 14, borderRadius: 14, background: '#F9FAFB' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: useDetected ? 0 : 12 }}>
                  <input type="checkbox" checked={useDetected} onChange={(e) => setUseDetected(e.target.checked)} />
                  Ship to my current GPS coordinates
                </label>

                {!useDetected && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16,185,129,0.15)' }}
                    >
                      <Map style={{ width: 16, height: 16 }} />
                      {pickedLat ? `📍 Coordinates: ${pickedLat.toFixed(5)}, ${pickedLng?.toFixed(5)}` : 'Select Location on Live Map'}
                    </button>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input type="text" placeholder="Latitude" value={customLat} onChange={(e) => setCustomLat(e.target.value)} style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 8, outline: 'none' }} />
                      <input type="text" placeholder="Longitude" value={customLng} onChange={(e) => setCustomLng(e.target.value)} style={{ padding: '8px 12px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 8, outline: 'none' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Payment Method</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" style={{ flex: 1, padding: 12, borderRadius: 10, border: '2px solid #059669', background: '#ECFDF5', color: '#065F46', fontSize: 13, fontWeight: 850 }}>
                    💵 Cash on Delivery (COD)
                  </button>
                  <button type="button" disabled style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E5E7EB', background: '#F3F4F6', color: '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: 'not-allowed', position: 'relative' }}>
                    Online Payment
                    <span style={{ fontSize: 8, background: '#6B7280', color: 'white', padding: '1px 5px', borderRadius: 4, position: 'absolute', top: -8, right: 8 }}>SOON</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 800 }}>GRAND TOTAL payable:</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>
                  Rs. {(getOrderTotal() + (selectedItem?.deliveryFee || 0)).toFixed(2)}
                  {selectedItem?.deliveryFee > 0 && (
                    <span style={{ fontSize: 11, color: '#D97706', marginLeft: 6, fontWeight: 700 }}>(+ Rs. {selectedItem.deliveryFee})</span>
                  )}
                </div>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={orderSubmitting}
                style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', color: '#FFFFFF', border: 'none', padding: '14px 28px', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
              >
                {orderSubmitting ? 'Processing...' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 660, boxShadow: '0 25px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1E293B', color: '#FFFFFF' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Map style={{ width: 18, height: 18, color: '#60A5FA' }} /> Click on Map to Select Location
                </h3>
              </div>
              <button onClick={() => setShowMapPicker(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#FFFFFF' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div ref={mapContainerRef} style={{ height: 420, width: '100%' }} />

            <div style={{ padding: '14px 20px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#4B5563', fontWeight: 700, fontFamily: 'monospace' }}>
                {pickedLat ? `📍 Selected: ${pickedLat}, ${pickedLng}` : 'Click map to place marker'}
              </div>
              <button
                onClick={() => setShowMapPicker(false)}
                style={{ background: '#059669', color: '#FFFFFF', border: 'none', padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Confirm Location Coordinates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
