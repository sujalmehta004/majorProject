'use client';

import React, { useState, useEffect, useRef } from 'react';
import { formatDateNPT, formatTimeNPT, formatDateTimeNPT } from '@/lib/timezone';
import Link from 'next/link';
import {
  MapPin, Search, Compass, ShoppingBag, Mail, Phone,
  FileText, ArrowLeft, Loader, CheckCircle, X, Navigation,
  Download, Package, Map, Tag, ChevronRight, Info, AlertTriangle,
  HelpCircle, BookOpen, ShoppingCart, Trash2, Plus, Minus
} from 'lucide-react';
import {
  fetchRetailersWithDistanceAction,
  searchMedicinesExpandedAction,
  placeConsumerOrderAction,
  trackConsumerOrderAction,
  cancelConsumerOrderAction,
  reuploadConsumerOrderPrescriptionAction
} from '@/app/actions/consumerActions';
import { compressImageToBase64 } from '@/lib/imageCompressor';
import { useWebSocketEvent } from '@/lib/events';
import { isValidEmail, isValidPhone, isValidNmcNumber } from '@/lib/validation';

type OrderMode = 'unit' | 'strip' | 'box';

export interface CartItem {
  id: string; // retailer inventory id
  productId: string;
  retailerId: string;
  productName: string;
  sku: string;
  category: string;
  medicineClass?: string;
  pharmacyName: string;
  pharmacyPhone?: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  availableQuantity: number;
  boxPrice: number;
  deliveryFee: number;
  orderMode: OrderMode;
  orderQuantity: number;
  expiryDate?: string;
}

export default function BuyMedicinePage() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Tab State: 'search' | 'cart' | 'track'
  const [activeTab, setActiveTab] = useState<'search' | 'cart' | 'track'>('search');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Prescription Upload State & Doctor NMC Number
  const [prescriptionImages, setPrescriptionImages] = useState<string[]>([]);
  const [doctorNmcNumber, setDoctorNmcNumber] = useState('');

  // Checkout Form State
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [useDetected, setUseDetected] = useState(true);
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Floating Help Modal State
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Map Picker State
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchLoading, setMapSearchLoading] = useState(false);

  // Order Placed Notification State
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [reuploadImages, setReuploadImages] = useState<string[]>([]);
  const [reuploading, setReuploading] = useState(false);
  const [showReuploadSuccessModal, setShowReuploadSuccessModal] = useState(false);

  // Saved Info (localStorage)
  const LS_INFO_KEY = 'medhub_buyer_info';
  const LS_INVOICES_KEY = 'medhub_invoices';
  const [savedInfo, setSavedInfo] = useState<{ name: string; email: string; phone: string; address: string } | null>(null);
  const [savedInvoices, setSavedInvoices] = useState<string[]>([]);
  const [infoSaved, setInfoSaved] = useState(false);

  // Leaflet Map script loader
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

  const handleMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapSearchQuery.trim()) return;
    setMapSearchLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        const searchLat = parseFloat(first.lat);
        const searchLng = parseFloat(first.lon);
        setPickedLat(searchLat);
        setPickedLng(searchLng);
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([searchLat, searchLng], 16);
          markerRef.current.setLatLng([searchLat, searchLng]);
          markerRef.current.bindPopup(first.display_name).openPopup();
        }
      } else {
        alert('Location not found. Please try another place name.');
      }
    } catch (_) {
      alert('Failed to search location.');
    }
    setMapSearchLoading(false);
  };

  // Load saved buyer info & invoices from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_INFO_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSavedInfo(parsed);
        // Auto-fill fields only if they're empty
        setBuyerName(n => n || parsed.name || '');
        setBuyerEmail(e => e || parsed.email || '');
        setBuyerPhone(p => p || parsed.phone || '');
        setDeliveryAddress(a => a || parsed.address || '');
      }
    } catch (_) {}
    try {
      const rawInv = localStorage.getItem(LS_INVOICES_KEY);
      if (rawInv) setSavedInvoices(JSON.parse(rawInv));
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveMyInfo = () => {
    if (!buyerName && !buyerEmail && !buyerPhone && !deliveryAddress) {
      alert('Please fill in at least one field before saving.');
      return;
    }
    const info = { name: buyerName, email: buyerEmail, phone: buyerPhone, address: deliveryAddress };
    localStorage.setItem(LS_INFO_KEY, JSON.stringify(info));
    setSavedInfo(info);
    setInfoSaved(true);
    setTimeout(() => setInfoSaved(false), 2500);
  };

  const handleClearSavedInfo = () => {
    localStorage.removeItem(LS_INFO_KEY);
    setSavedInfo(null);
  };

  const saveInvoiceToStorage = (trackingCode: string) => {
    setSavedInvoices(prev => {
      const updated = [trackingCode, ...prev.filter(c => c !== trackingCode)].slice(0, 20);
      localStorage.setItem(LS_INVOICES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Automatic GPS Location Detection on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLat(27.7172);
      setLng(85.324);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
      },
      () => {
        setLat(27.7172);
        setLng(85.324);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // ── Real-Time WebSocket Listeners for Instant Stock Refresh ──
  useWebSocketEvent('CONSUMER_ORDER_NEW', async () => {
    if (!searchQuery.trim()) return;
    const currentLat = lat || 27.7172;
    const currentLng = lng || 85.324;
    const res = await searchMedicinesExpandedAction(searchQuery, currentLat, currentLng);
    if (res.success && res.results) setSearchResults(res.results);
  });

  useWebSocketEvent('INVENTORY_UPDATE', async () => {
    if (!searchQuery.trim()) return;
    const currentLat = lat || 27.7172;
    const currentLng = lng || 85.324;
    const res = await searchMedicinesExpandedAction(searchQuery, currentLat, currentLng);
    if (res.success && res.results) setSearchResults(res.results);
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const currentLat = lat || 27.7172;
    const currentLng = lng || 85.324;
    setSearchLoading(true);
    setSearched(true);
    const res = await searchMedicinesExpandedAction(searchQuery, currentLat, currentLng);
    if (res.success && res.results) {
      setSearchResults(res.results);
    } else {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  // Cart Management Functions
  const addToCart = (item: any, mode: OrderMode = 'unit', qty: number = 1, goToCart: boolean = false) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(c => c.id === item.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const newQty = Math.min(item.quantity, updated[existingIdx].orderQuantity + qty);
        updated[existingIdx] = {
          ...updated[existingIdx],
          orderQuantity: newQty,
        };
        return updated;
      }
      const newItem: CartItem = {
        id: item.id,
        productId: item.productId,
        retailerId: item.retailerId,
        productName: item.product.name,
        sku: item.product.sku,
        category: item.product.category,
        medicineClass: item.product.medicineClass,
        pharmacyName: item.retailer.pharmacyName,
        pharmacyPhone: item.retailer.phone,
        tabletsPerStrip: item.product.tabletsPerStrip || 10,
        stripsPerBox: item.product.stripsPerBox || 10,
        availableQuantity: item.quantity,
        boxPrice: item.sellingPrice,
        deliveryFee: item.deliveryFee || 0,
        orderMode: mode,
        orderQuantity: qty,
        expiryDate: item.expiryDate,
      };
      return [...prev, newItem];
    });

    if (goToCart) {
      setActiveTab('cart');
    }
  };

  const updateCartItemMode = (index: number, mode: OrderMode) => {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], orderMode: mode, orderQuantity: 1 };
      return updated;
    });
  };

  const updateCartItemQty = (index: number, qty: number) => {
    setCart(prev => {
      const updated = [...prev];
      const maxQty = getMaxQtyForItem(updated[index]);
      const validQty = Math.min(maxQty, Math.max(1, qty));
      updated[index] = { ...updated[index], orderQuantity: validQty };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setPrescriptionImages([]);
  };

  // Helper Calculations for Cart Item
  const getBaseUnitsForItem = (item: CartItem): number => {
    const tps = item.tabletsPerStrip || 10;
    const spb = item.stripsPerBox || 10;
    if (item.orderMode === 'unit') return item.orderQuantity;
    if (item.orderMode === 'strip') return item.orderQuantity * tps;
    if (item.orderMode === 'box') return item.orderQuantity * tps * spb;
    return item.orderQuantity;
  };

  const getUnitPriceForItem = (item: CartItem): number => {
    const tps = item.tabletsPerStrip || 10;
    const spb = item.stripsPerBox || 10;
    return item.boxPrice / (tps * spb);
  };

  const getItemSubtotal = (item: CartItem): number => {
    return getBaseUnitsForItem(item) * getUnitPriceForItem(item);
  };

  const getMaxQtyForItem = (item: CartItem): number => {
    const tps = item.tabletsPerStrip || 10;
    const spb = item.stripsPerBox || 10;
    if (item.orderMode === 'unit') return item.availableQuantity;
    if (item.orderMode === 'strip') return Math.floor(item.availableQuantity / tps);
    if (item.orderMode === 'box') return Math.floor(item.availableQuantity / (tps * spb));
    return item.availableQuantity;
  };

  // Cart Totals
  const cartSubtotal = cart.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const cartDeliveryFee = cart.length > 0 ? Math.max(...cart.map(c => c.deliveryFee || 0)) : 0;
  const cartGrandTotal = cartSubtotal + cartDeliveryFee;
  const cartHasClassA = cart.some(item => item.medicineClass === 'CLASS_A');

  // Prescription Upload Handlers
  const handlePrescriptionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const maxAllowed = 5;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (prescriptionImages.length + i >= maxAllowed) {
        alert('You can upload up to 5 prescription images maximum.');
        break;
      }
      if (file.size > 500 * 1024) {
        alert(`File "${file.name}" exceeds the 500 KB size limit. Please choose a smaller image.`);
        continue;
      }

      try {
        const compressedBase64 = await compressImageToBase64(file);
        setPrescriptionImages(prev => {
          if (prev.length >= maxAllowed) return prev;
          return [...prev, compressedBase64];
        });
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }
    e.target.value = '';
  };

  const removePrescriptionImage = (index: number) => {
    setPrescriptionImages(prev => prev.filter((_, i) => i !== index));
  };

  // Place Order for items in Cart
  const handlePlaceCartOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || orderSubmitting) return;

    if (!buyerName || !buyerEmail || !buyerPhone || !deliveryAddress) {
      alert('Please fill out all patient & delivery address fields.');
      return;
    }

    if (!isValidEmail(buyerEmail)) {
      alert('Please enter a valid email address (e.g. patient@example.com).');
      return;
    }

    if (!isValidPhone(buyerPhone)) {
      alert('Patient phone number must be exactly 10 digits.');
      return;
    }

    // MANDATORY PRESCRIPTION & DOCTOR NMC CHECK FOR CLASS A MEDICINES IN CART
    if (cartHasClassA) {
      if (prescriptionImages.length === 0) {
        alert('🚨 Prescription Required: Your cart contains Class A medicine. Please upload at least 1 image of your doctor\'s prescription before placing the order.');
        return;
      }
      if (!doctorNmcNumber.trim()) {
        alert('🚨 Doctor NMC Number Required: Your cart contains Class A medicine. Please enter your Doctor\'s NMC Registration Number before placing the order.');
        return;
      }
      if (!isValidNmcNumber(doctorNmcNumber.trim())) {
        alert('🚨 Invalid Doctor NMC Number: Please enter numbers only for the Doctor\'s NMC Registration Number (e.g. 12345).');
        return;
      }
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

    // Group cart items by retailerId
    const retailerGroupMap: Record<string, CartItem[]> = {};
    for (const item of cart) {
      if (!retailerGroupMap[item.retailerId]) {
        retailerGroupMap[item.retailerId] = [];
      }
      retailerGroupMap[item.retailerId].push(item);
    }

    let lastCreatedOrder: any = null;
    let hasError = false;

    for (const retailerId of Object.keys(retailerGroupMap)) {
      const groupItems = retailerGroupMap[retailerId];
      const orderItems = groupItems.map((item: CartItem) => ({
        productId: item.productId,
        quantity: getBaseUnitsForItem(item),
        pricePerUnit: getUnitPriceForItem(item),
      }));

      const groupDeliveryFee = Math.max(...groupItems.map((i: CartItem) => i.deliveryFee || 0));

      const res = await placeConsumerOrderAction({
        retailerId,
        buyerName,
        buyerEmail,
        buyerPhone,
        deliveryAddress,
        latitude: finalLat,
        longitude: finalLng,
        deliveryFee: groupDeliveryFee,
        prescriptionImages,
        doctorNmcNumber: doctorNmcNumber.trim() || undefined,
        items: orderItems,
      });

      if (res.success && res.order) {
        lastCreatedOrder = res.order;
      } else {
        hasError = true;
        alert(res.error || 'Failed to place order.');
        break;
      }
    }

    setOrderSubmitting(false);

    if (!hasError && lastCreatedOrder) {
      setPlacedOrder(lastCreatedOrder);
      saveInvoiceToStorage(lastCreatedOrder.trackingCode);
      clearCart();
      downloadReceipt(lastCreatedOrder);
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
Date:          ${formatDateTimeNPT(order.createdAt)}

Pharmacy:      ${order.retailer?.pharmacyName || 'MedHub Certified Pharmacy'}
Phone:         ${order.retailer?.phone || '—'}
Address:       ${order.retailer?.address || '—'}

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
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 50%, #10B981 100%)', color: '#FFFFFF', padding: '32px 32px 24px 32px' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: '#F0FDFA', fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: 20 }}>
              <ArrowLeft style={{ width: 14, height: 14 }} /> Back to MedHub Home
            </Link>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 12, fontWeight: 800, textTransform: 'uppercase' }}>Consumer Medicine Portal</span>
          </div>
          
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShoppingBag style={{ width: 32, height: 32 }} /> Search & Buy Medicine
            </h1>
            <p style={{ fontSize: 14, color: '#CCFBF1', margin: '4px 0 0 0', fontWeight: 500 }}>
              Live inventory & transparent pricing across verified pharmacies near you.
            </p>
          </div>

          {/* Navigation Tabs Header */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('search')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'search' ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                color: activeTab === 'search' ? '#0F766E' : '#FFFFFF',
                boxShadow: activeTab === 'search' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <Search style={{ width: 16, height: 16 }} /> 1. Search Medicine
            </button>

            {/* LIVE CART TAB WITH BADGE COUNT */}
            <button
              onClick={() => setActiveTab('cart')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'cart' ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                color: activeTab === 'cart' ? '#0F766E' : '#FFFFFF',
                boxShadow: activeTab === 'cart' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              <ShoppingCart style={{ width: 16, height: 16 }} />
              <span>2. My Cart</span>
              <span style={{
                background: activeTab === 'cart' ? '#0F766E' : '#FFFFFF',
                color: activeTab === 'cart' ? '#FFFFFF' : '#0F766E',
                fontSize: 11,
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: 12,
                marginLeft: 2,
              }}>
                {cart.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('track')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'track' ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                color: activeTab === 'track' ? '#0F766E' : '#FFFFFF',
                boxShadow: activeTab === 'track' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <Navigation style={{ width: 16, height: 16 }} /> 3. Track Order Status
            </button>
          </div>
        </div>
      </div>

      {/* Main Container — Full Width Layout */}
      <div style={{ width: '100%', padding: '24px 32px 80px 32px', boxSizing: 'border-box' }}>

        {/* ─── TAB 1: SEARCH MEDICINE ─── */}
        {activeTab === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

            {/* Order Placement Success Notification Banner */}
            {placedOrder && (
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 14, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#047857' }}>
                  <CheckCircle style={{ width: 24, height: 24 }} />
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>Order Placed Successfully!</div>
                    <div style={{ fontSize: 12, color: '#065F46', marginTop: 2 }}>Tracking Code: <span style={{ fontFamily: 'monospace', fontWeight: 900 }}>{placedOrder.trackingCode}</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => downloadReceipt(placedOrder)}
                    style={{ background: '#047857', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Download style={{ width: 13, height: 13 }} /> Invoice
                  </button>
                  <button
                    onClick={() => { setTrackingCodeInput(placedOrder.trackingCode); setActiveTab('track'); handleTrackOrder(); }}
                    style={{ background: '#FFFFFF', color: '#047857', border: '1px solid #A7F3D0', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Track Status →
                  </button>
                </div>
              </div>
            )}
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} style={{ background: '#FFFFFF', borderRadius: 14, padding: 8, border: '1px solid #CBD5E1', display: 'flex', gap: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.03)', width: '100%' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16 }}>
                <Search style={{ width: 20, height: 20, color: '#64748B' }} />
                <input
                  type="text"
                  placeholder="Enter brand name, generic name, category, or SKU (e.g. Paracetamol, Cetamol, Antibiotics)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', outline: 'none', width: '100%', fontSize: 15, color: '#0F172A', fontWeight: 500 }}
                />
              </div>
              <button type="submit" disabled={searchLoading} style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {searchLoading ? <Loader className="animate-spin" style={{ width: 16, height: 16 }} /> : <ShoppingBag style={{ width: 16, height: 16 }} />}
                Search
              </button>
            </form>

            {/* Results Table Section — Clean Table Layout */}
            {searched && (
              <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', width: '100%', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: '#1E293B' }}>
                    Results for "{searchQuery}" ({searchResults.length} items)
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    {searchResults.length} pharmacy stock listings
                  </span>
                </div>

                {searchResults.length === 0 ? (
                  <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B' }}>
                    <Package style={{ width: 40, height: 40, color: '#94A3B8', margin: '0 auto 8px auto' }} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>No matching medicines found</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>Try searching for another brand name, generic name, or SKU code</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <th style={{ padding: '12px 16px', fontWeight: 800 }}>Medicine & Category</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800 }}>SKU & Structure</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800 }}>Prescription Requirement</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800 }}>Pharmacy & Distance</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>In Stock</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Unit Price</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Strip Price</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Box Price</th>
                          <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((item, idx) => {
                          const tps = item.product.tabletsPerStrip || 10;
                          const spb = item.product.stripsPerBox || 10;
                          const boxPrice = item.sellingPrice;
                          const stripPrice = boxPrice / spb;
                          const unitPrice = boxPrice / (tps * spb);
                          const isClassA = item.product?.medicineClass === 'CLASS_A';
                          const isAlreadyInCart = cart.some(c => c.id === item.id);

                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                              
                              {/* Medicine & Category */}
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{item.product.name}</div>
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{item.product.category || 'General'}</div>
                              </td>

                              {/* SKU & Structure */}
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#334155' }}>{item.product.sku}</div>
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{tps}t × {spb}s ({tps * spb}/box)</div>
                              </td>

                              {/* Prescription Requirement */}
                              <td style={{ padding: '14px 16px' }}>
                                {isClassA ? (
                                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '6px 10px', display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 11, fontWeight: 900, color: '#DC2626' }}>🚨 Class A (Prescription Mandatory)</span>
                                    <span style={{ fontSize: 10, color: '#991B1B' }}>Doctor prescription upload required</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                                    ✓ Class Normal (No Rx)
                                  </span>
                                )}
                              </td>

                              {/* Pharmacy & Distance */}
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 700, color: '#0F766E', fontSize: 13 }}>{item.retailer.pharmacyName}</div>
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{item.distance} km away {item.deliveryFee === 0 ? '· Free Delivery' : `· Delivery Rs.${item.deliveryFee}`}</div>
                              </td>

                              {/* Stock */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: '#0F172A' }}>
                                {item.quantity.toLocaleString()} <span style={{ fontSize: 10, color: '#64748B', fontWeight: 400 }}>units</span>
                              </td>

                              {/* Unit Price */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0F766E' }}>
                                Rs. {unitPrice.toFixed(2)}
                              </td>

                              {/* Strip Price */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0F766E' }}>
                                Rs. {stripPrice.toFixed(2)}
                              </td>

                              {/* Box Price */}
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0F172A' }}>
                                Rs. {boxPrice.toFixed(2)}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                  <button
                                    onClick={() => addToCart(item, 'unit', 1, false)}
                                    style={{
                                      background: isAlreadyInCart ? '#ECFDF5' : '#F1F5F9',
                                      color: isAlreadyInCart ? '#047857' : '#334155',
                                      border: `1px solid ${isAlreadyInCart ? '#A7F3D0' : '#CBD5E1'}`,
                                      padding: '7px 12px',
                                      borderRadius: 8,
                                      fontSize: 12,
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}
                                  >
                                    <ShoppingCart style={{ width: 13, height: 13 }} />
                                    {isAlreadyInCart ? 'In Cart ✓' : '+ Add Cart'}
                                  </button>
                                  <button
                                    onClick={() => addToCart(item, 'unit', 1, true)}
                                    style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    Buy Now
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: MY CART TAB ─── */}
        {activeTab === 'cart' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {cart.length === 0 ? (
              <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '60px 20px', textAlign: 'center', border: '1px solid #E2E8F0', boxShadow: '0 2px 15px rgba(0,0,0,0.02)' }}>
                <ShoppingCart style={{ width: 56, height: 56, color: '#CBD5E1', margin: '0 auto 14px auto' }} />
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', margin: 0 }}>Your Cart is Currently Empty</h3>
                <p style={{ fontSize: 14, color: '#64748B', marginTop: 6, maxWidth: 450, margin: '6px auto 20px auto' }}>
                  Search and add medicines from nearby verified pharmacies to your cart to proceed with checkout.
                </p>
                <button
                  onClick={() => setActiveTab('search')}
                  style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Search style={{ width: 16, height: 16 }} /> Search & Add Medicine
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
                
                {/* Left Column: Cart Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShoppingCart style={{ width: 20, height: 20, color: '#0F766E' }} /> Cart Items ({cart.length})
                    </h3>
                    <button
                      onClick={clearCart}
                      style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Clear All Items
                    </button>
                  </div>

                  {cart.map((item, idx) => {
                    const isClassA = item.medicineClass === 'CLASS_A';
                    const unitPrice = getUnitPriceForItem(item);
                    const subtotal = getItemSubtotal(item);
                    const maxQty = getMaxQtyForItem(item);

                    return (
                      <div key={idx} style={{ background: '#FFFFFF', borderRadius: 14, padding: 18, border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        
                        {/* Header: Name, SKU, Category, Pharmacy & Remove */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>{item.productName}</div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                              Pharmacy: <strong style={{ color: '#0F766E' }}>{item.pharmacyName}</strong> · SKU: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.sku}</span>
                            </div>
                            
                            {/* Class Badge */}
                            <div style={{ marginTop: 6 }}>
                              {isClassA ? (
                                <span style={{ fontSize: 11, fontWeight: 900, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '3px 8px', borderRadius: 6, display: 'inline-block' }}>
                                  🚨 Class A (Prescription Mandatory)
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 700, background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: 6, display: 'inline-block' }}>
                                  ✓ Class Normal (No Rx)
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromCart(idx)}
                            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            title="Remove from cart"
                          >
                            <Trash2 style={{ width: 15, height: 15 }} />
                          </button>
                        </div>

                        {/* Pack Mode Selection */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, background: '#F8FAFC', padding: 4, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                          {(['unit', 'strip', 'box'] as OrderMode[]).map(m => {
                            const active = item.orderMode === m;
                            const price = m === 'box' ? item.boxPrice : m === 'strip' ? item.boxPrice / item.stripsPerBox : unitPrice;
                            const label = m === 'unit' ? 'Single Unit' : m === 'strip' ? 'Strip Pack' : 'Full Box';
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => updateCartItemMode(idx, m)}
                                style={{
                                  padding: '8px 4px',
                                  borderRadius: 8,
                                  border: `1px solid ${active ? '#0F766E' : 'transparent'}`,
                                  background: active ? '#FFFFFF' : 'transparent',
                                  color: active ? '#0F766E' : '#64748B',
                                  fontWeight: active ? 800 : 600,
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  textAlign: 'center',
                                }}
                              >
                                <div>{label}</div>
                                <div style={{ fontSize: 12, fontWeight: 800, marginTop: 1 }}>Rs.{price.toFixed(1)}</div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Quantity Controls & Subtotal */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Qty ({item.orderMode}s):</span>
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(idx, item.orderQuantity - 1)}
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Minus style={{ width: 12, height: 12 }} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={maxQty}
                              value={item.orderQuantity}
                              onChange={e => updateCartItemQty(idx, parseInt(e.target.value) || 1)}
                              style={{ width: 55, padding: '4px', textAlign: 'center', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, fontWeight: 800, outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(idx, item.orderQuantity + 1)}
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Plus style={{ width: 12, height: 12 }} />
                            </button>
                            <span style={{ fontSize: 11, color: '#64748B' }}>({getBaseUnitsForItem(item)} units)</span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>SUBTOTAL</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F766E', fontFamily: 'monospace' }}>Rs. {subtotal.toFixed(2)}</div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* Right Column: Checkout & Prescription Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Prescription Section based on Class A Presence in Cart */}
                  <div style={{
                    border: cartHasClassA ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                    borderRadius: 14,
                    padding: 16,
                    background: cartHasClassA ? '#FFFBEB' : '#FFFFFF',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: cartHasClassA ? '#B45309' : '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📄 Doctor's Prescription</span>
                        {cartHasClassA ? (
                          <span style={{ fontSize: 10, background: '#DC2626', color: '#FFF', padding: '2px 6px', borderRadius: 4, fontWeight: 900 }}>MANDATORY (CLASS A)</span>
                        ) : (
                          <span style={{ fontSize: 10, background: '#ECFDF5', color: '#047857', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>NOT REQUIRED</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{prescriptionImages.length}/5 images</span>
                    </div>

                    <p style={{ fontSize: 12, color: cartHasClassA ? '#92400E' : '#64748B', margin: 0, lineHeight: 1.4 }}>
                      {cartHasClassA
                        ? '🚨 Your cart contains Class A medicine. Prescription image upload AND Doctor NMC Registration Number are MANDATORY to complete this order.'
                        : '✓ All items in your cart are Class Normal. Prescription upload is NOT mandatory, but you can optionally attach one if desired.'
                      }
                    </p>

                    {/* Doctor NMC Registration Number Field */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: cartHasClassA ? '#B45309' : '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🩺 Doctor NMC Registration Number</span>
                        {cartHasClassA ? (
                          <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 900 }}>* REQUIRED</span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#64748B', fontWeight: 500 }}>(Optional)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="Numbers only (e.g. 12345)"
                        value={doctorNmcNumber}
                        onChange={e => setDoctorNmcNumber(e.target.value.replace(/\D/g, ''))}
                        required={cartHasClassA}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: `1.5px solid ${cartHasClassA && !doctorNmcNumber.trim() ? '#FCA5A5' : '#CBD5E1'}`,
                          background: cartHasClassA && !doctorNmcNumber.trim() ? '#FEF2F2' : '#FFFFFF',
                          fontSize: 13,
                          outline: 'none',
                          color: '#0F172A',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Uploaded Base64 Image Preview Thumbnails */}
                    {prescriptionImages.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, marginTop: 4 }}>
                        {prescriptionImages.map((img, idx) => (
                          <div key={idx} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '2px solid #CBD5E1', background: '#000' }}>
                            <img src={img} alt={`Prescription ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              onClick={() => removePrescriptionImage(idx)}
                              style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(220,38,38,0.9)', color: '#FFF', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {prescriptionImages.length < 5 && (
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', border: cartHasClassA ? '2px dashed #D97706' : '2px dashed #94A3B8', borderRadius: 10, background: '#FFFFFF', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: cartHasClassA ? '#B45309' : '#334155' }}>
                        <span>📷 Upload Prescription Image (Max 500MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePrescriptionUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Checkout Patient Form Card */}
                  <form onSubmit={handlePlaceCartOrder} style={{ background: '#FFFFFF', borderRadius: 14, padding: 20, border: '1px solid #E2E8F0', boxShadow: '0 2px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 900, color: '#0F172A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Patient & Delivery Details
                    </h4>

                    {/* Saved Info Autofill Banner */}
                    {savedInfo && (
                      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <div style={{ color: '#065F46', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          ✓ Saved info auto-filled: <span style={{ fontWeight: 500, color: '#047857' }}>{savedInfo.name}</span>
                        </div>
                        <button type="button" onClick={handleClearSavedInfo} style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Clear Saved</button>
                      </div>
                    )}

                    {[
                      { label: 'Patient / Buyer Name', value: buyerName, onChange: setBuyerName, type: 'text', placeholder: 'e.g. John Doe', maxLen: undefined },
                      { label: 'Email Address', value: buyerEmail, onChange: setBuyerEmail, type: 'email', placeholder: 'e.g. john@example.com', maxLen: undefined },
                      {
                        label: 'Contact Phone Number',
                        value: buyerPhone,
                        onChange: (val: string) => setBuyerPhone(val.replace(/\D/g, '').slice(0, 10)),
                        type: 'tel',
                        placeholder: '10-digit number (e.g. 9841234567)',
                        maxLen: 10
                      },
                      { label: 'Delivery Location Address', value: deliveryAddress, onChange: setDeliveryAddress, type: 'text', placeholder: 'Street details, Ward No., City', maxLen: undefined },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>{f.label}</label>
                        <input
                          type={f.type}
                          required
                          maxLength={f.maxLen}
                          placeholder={f.placeholder}
                          value={f.value}
                          onChange={(e) => f.onChange(e.target.value)}
                          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                        />
                      </div>
                    ))}

                    {/* Save My Info Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleSaveMyInfo}
                        style={{
                          background: infoSaved ? '#ECFDF5' : '#F8FAFC',
                          color: infoSaved ? '#047857' : '#334155',
                          border: `1px solid ${infoSaved ? '#A7F3D0' : '#CBD5E1'}`,
                          padding: '7px 14px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {infoSaved ? '✓ Information Saved!' : '💾 Save My Info for Next Time'}
                      </button>
                    </div>

                    {/* GPS Coordinates selection */}
                    <div style={{ border: '1px solid #E2E8F0', padding: 12, borderRadius: 10, background: '#F8FAFC' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: useDetected ? 0 : 10 }}>
                        <input type="checkbox" checked={useDetected} onChange={(e) => setUseDetected(e.target.checked)} />
                        Ship to my automatically detected GPS location
                      </label>

                      {!useDetected && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => setShowMapPicker(true)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: '#0F766E', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                          >
                            <Map style={{ width: 15, height: 15 }} />
                            {pickedLat ? `📍 Coordinates: ${pickedLat.toFixed(5)}, ${pickedLng?.toFixed(5)}` : 'Select Location on Live Map'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order Financial Summary */}
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>Items Subtotal:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>Rs. {cartSubtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>Delivery Fee:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: cartDeliveryFee === 0 ? '#047857' : '#D97706' }}>
                          {cartDeliveryFee === 0 ? 'Free' : `Rs. ${cartDeliveryFee.toFixed(2)}`}
                        </span>
                      </div>
                      <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: '#0F172A' }}>
                        <span>Total Payable (COD):</span>
                        <span style={{ fontFamily: 'monospace', color: '#0F766E' }}>Rs. {cartGrandTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={orderSubmitting}
                      style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
                    >
                      {orderSubmitting ? 'Processing Order…' : 'Confirm & Place Order →'}
                    </button>
                  </form>

                </div>

              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: TRACK MEDICINE ─── */}
        {activeTab === 'track' && (
          <div style={{ maxWidth: 680, margin: '0 auto', background: '#FFFFFF', borderRadius: 16, padding: 28, border: '1px solid #E2E8F0', boxShadow: '0 2px 15px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: '#0F172A', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Navigation style={{ width: 18, height: 18, color: '#0F766E' }} /> Track Order Status
            </h3>
            
            <form onSubmit={handleTrackOrder} style={{ display: 'flex', gap: 10, marginBottom: savedInvoices.length > 0 ? 8 : 20 }}>
              <input
                type="text"
                placeholder="Enter Tracking Code (e.g. MH-XXXXXX)"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: 14, outline: 'none' }}
              />
              <button type="submit" disabled={trackingLoading} style={{ background: '#0F172A', color: '#FFFFFF', border: 'none', padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {trackingLoading ? <Loader className="animate-spin" style={{ width: 16, height: 16 }} /> : 'Track Order'}
              </button>
            </form>

            {/* Saved Invoice Suggestions */}
            {savedInvoices.length > 0 && (
              <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📋 Your Recent Orders — click to track:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {savedInvoices.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setTrackingCodeInput(code);
                        setTrackedOrder(null);
                        setTrackingError(null);
                        setTimeout(() => {
                          (document.querySelector('form[data-track]') as HTMLFormElement)?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                        }, 50);
                        trackConsumerOrderAction(code).then(res => {
                          if (res.success && res.order) setTrackedOrder(res.order);
                          else setTrackingError(res.error || 'Not found.');
                        });
                      }}
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        fontSize: 12,
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: trackingCodeInput === code ? '2px solid #0F766E' : '1px solid #CBD5E1',
                        background: trackingCodeInput === code ? '#ECFDF5' : '#F8FAFC',
                        color: trackingCodeInput === code ? '#0F766E' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {trackingError && <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600, background: '#FEF2F2', padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>{trackingError}</div>}

            {trackedOrder && (() => {
              const sc = getStatusColor(trackedOrder.status);
              return (
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>TRACKING CODE</div>
                      <div style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 900, color: '#0F766E' }}>{trackedOrder.trackingCode}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, padding: '4px 14px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                      {trackedOrder.status}
                    </span>
                  </div>

                  {trackedOrder.prescriptionStatus && trackedOrder.prescriptionStatus !== 'NOT_REQUIRED' && (
                    <div style={{
                      background: trackedOrder.prescriptionStatus === 'APPROVED' ? '#ECFDF5' : trackedOrder.prescriptionStatus === 'REJECTED' ? '#FEF2F2' : '#FFFBEB',
                      border: `1px solid ${trackedOrder.prescriptionStatus === 'APPROVED' ? '#A7F3D0' : trackedOrder.prescriptionStatus === 'REJECTED' ? '#FECACA' : '#FDE68A'}`,
                      padding: '12px 16px',
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>📄 Prescription Verification:</span>
                        <span style={{
                          fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 6,
                          background: trackedOrder.prescriptionStatus === 'APPROVED' ? '#047857' : trackedOrder.prescriptionStatus === 'REJECTED' ? '#DC2626' : '#D97706',
                          color: '#FFFFFF',
                        }}>
                          {trackedOrder.prescriptionStatus === 'APPROVED' ? '✓ APPROVED' : trackedOrder.prescriptionStatus === 'REJECTED' ? '✕ REJECTED' : '⏳ PENDING REVIEW'}
                        </span>
                      </div>
                      {trackedOrder.prescriptionStatus === 'APPROVED' && (
                        <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>
                          ✓ Your prescription has been verified and approved by the pharmacy. Your order will proceed to shipping.
                        </div>
                      )}
                      {trackedOrder.prescriptionStatus === 'PENDING' && (
                        <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                          ⏳ Your prescription images are being reviewed by the pharmacist. Shipping will begin once approved.
                        </div>
                      )}
                      {trackedOrder.prescriptionStatus === 'REJECTED' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                          <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 700 }}>
                            ✕ Your prescription was rejected by the pharmacy.
                          </div>
                          {trackedOrder.prescriptionRejectReason && (
                            <div style={{ fontSize: 12, color: '#7F1D1D', background: 'rgba(220,38,38,0.07)', padding: '10px 14px', borderRadius: 8, borderLeft: '4px solid #DC2626' }}>
                              <strong>Pharmacy Rejection Note:</strong> {trackedOrder.prescriptionRejectReason}
                            </div>
                          )}

                          {/* Re-upload New Prescription Section */}
                          <div style={{ background: '#FFFFFF', border: '1.5px dashed #FCA5A5', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6 }}>
                              📷 Upload Corrected / New Prescription Images:
                            </div>

                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              id="reupload-presc-input"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const files = e.target.files;
                                if (!files) return;
                                const maxAllowed = 5;
                                for (let i = 0; i < files.length; i++) {
                                  const file = files[i];
                                  if (file.size > 500 * 1024) {
                                    alert(`File "${file.name}" exceeds the 500 KB size limit. Please choose a smaller image.`);
                                    continue;
                                  }
                                  try {
                                    const compressedBase64 = await compressImageToBase64(file);
                                    setReuploadImages(prev => {
                                      if (prev.length >= maxAllowed) return prev;
                                      return [...prev, compressedBase64];
                                    });
                                  } catch (err) {
                                    console.error('Failed to compress image:', err);
                                  }
                                }
                                e.target.value = '';
                              }}
                            />

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {reuploadImages.map((imgSrc, idx) => (
                                <div key={idx} style={{ width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid #CBD5E1', position: 'relative' }}>
                                  <img src={imgSrc} alt="New Prescription" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <button
                                    type="button"
                                    onClick={() => setReuploadImages(prev => prev.filter((_, i) => i !== idx))}
                                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}

                              {reuploadImages.length < 5 && (
                                <label
                                  htmlFor="reupload-presc-input"
                                  style={{
                                    width: 60, height: 60, borderRadius: 6, border: '2px dashed #DC2626', background: '#FEF2F2',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#DC2626', fontSize: 10, fontWeight: 800, textAlign: 'center', padding: 2
                                  }}
                                >
                                  + Upload ({reuploadImages.length}/5)
                                </label>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={reuploadImages.length === 0 || reuploading}
                              onClick={async () => {
                                if (reuploadImages.length === 0) return;
                                setReuploading(true);
                                const res = await reuploadConsumerOrderPrescriptionAction(trackedOrder.trackingCode, reuploadImages);
                                setReuploading(false);
                                if (res.success && res.order) {
                                  setTrackedOrder(res.order);
                                  setReuploadImages([]);
                                  setShowReuploadSuccessModal(true);
                                } else {
                                  alert(res.error || 'Failed to submit new prescription.');
                                }
                              }}
                              style={{
                                background: reuploadImages.length > 0 ? '#DC2626' : '#E2E8F0',
                                color: reuploadImages.length > 0 ? '#FFFFFF' : '#94A3B8',
                                border: 'none',
                                padding: '10px 16px',
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: reuploadImages.length > 0 ? 'pointer' : 'not-allowed',
                                marginTop: 4,
                                transition: 'all 0.15s',
                              }}
                            >
                              {reuploading ? 'Submitting New Prescription...' : ' Submit New Prescription for Approval'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 13 }}>
                    <div style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{trackedOrder.retailer?.pharmacyName}</div>
                    <div style={{ color: '#475569', fontSize: 12, marginBottom: 12 }}>Phone: {trackedOrder.retailer?.phone}</div>

                    <div style={{ fontWeight: 800, color: '#475569', marginBottom: 8, fontSize: 12 }}>Order Items:</div>
                    {trackedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ color: '#334155' }}>{item.product.name} (x{item.quantity})</span>
                        <span style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</span>
                      </div>
                    ))}
                    {trackedOrder.deliveryFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#D97706', fontWeight: 700 }}>
                        <span>Delivery Fee:</span>
                        <span style={{ fontFamily: 'monospace' }}>Rs. {trackedOrder.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #CBD5E1', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#0F172A', fontSize: 14 }}>
                      <span>Total Payable (COD):</span>
                      <span style={{ fontFamily: 'monospace', color: '#0F766E' }}>Rs. {trackedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => downloadReceipt(trackedOrder)} style={{ flex: 1, background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <FileText style={{ width: 15, height: 15 }} /> Download Invoice
                    </button>
                    {trackedOrder.status === 'PENDING' && (
                      <button onClick={() => handleCancelOrder(trackedOrder.trackingCode)} style={{ flex: 1, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <X style={{ width: 15, height: 15 }} /> Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ─── FLOATING HELP BUTTON (Bottom Right) ─── */}
      <button
        onClick={() => setShowHelpModal(true)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 90,
          background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)',
          color: '#FFFFFF',
          border: 'none',
          padding: '14px 22px',
          borderRadius: 30,
          fontSize: 13,
          fontWeight: 900,
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(15,118,110,0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <HelpCircle style={{ width: 18, height: 18 }} />
        <span>How to Order & Track</span>
      </button>

      {/* ─── HOW TO ORDER & TRACK HELP MODAL ─── */}
      {showHelpModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 580, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen style={{ width: 22, height: 22, color: '#0F766E' }} />
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', margin: 0 }}>Guide: How to Search, Cart & Track</h3>
              </div>
              <button onClick={() => setShowHelpModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X style={{ width: 20, height: 20, color: '#64748B' }} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#CCFBF1', color: '#0F766E', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Search & Add to Cart</div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
                    Search by medicine name or SKU. Click <strong>+ Add Cart</strong> to add items into your multi-item cart.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#CCFBF1', color: '#0F766E', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Manage Cart & Pack Sizes</div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
                    Open the <strong>2. My Cart</strong> tab. Choose <strong>Single Unit</strong>, <strong>Strip Pack</strong>, or <strong>Box Pack</strong> for each item and set quantities.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Prescription Requirements</div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
                    If <strong>ANY</strong> item in your cart is marked <span style={{ color: '#DC2626', fontWeight: 700 }}>🚨 Class A</span>, uploading doctor prescription images is <strong>MANDATORY</strong>. If all items are Class Normal, prescription upload is <strong>NOT mandatory</strong>.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#CCFBF1', color: '#0F766E', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>4</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Confirm & Track</div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 1.5 }}>
                    Enter patient details and place the order. Use your unique tracking code (<span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0F766E' }}>MH-XXXXXX</span>) in the <strong>3. Track Order Status</strong> tab anytime.
                  </div>
                </div>
              </div>

            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowHelpModal(false)}
                style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Close Guide
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── Map Picker Modal ─── */}
      {showMapPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250, padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', height: '85vh', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin style={{ width: 18, height: 18, color: '#0F766E' }} /> Select Delivery Location
              </div>
              <button onClick={() => setShowMapPicker(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}><X style={{ width: 20, height: 20 }} /></button>
            </div>

            {/* Place Search Bar inside Map */}
            <form onSubmit={handleMapSearch} style={{ padding: '10px 16px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search style={{ position: 'absolute', left: 12, top: 10, width: 16, height: 16, color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search place, landmark, city, ward (e.g. New Road, Kathmandu)..."
                  value={mapSearchQuery}
                  onChange={e => setMapSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button
                type="submit"
                disabled={mapSearchLoading}
                style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                {mapSearchLoading ? 'Searching...' : 'Search Place'}
              </button>
            </form>

            <div ref={mapContainerRef} style={{ flex: 1, width: '100%' }} />

            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
                {pickedLat ? `GPS: ${pickedLat}, ${pickedLng}` : 'Click map or search place to set coordinates'}
              </div>
              <button onClick={() => setShowMapPicker(false)} style={{ background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Confirm Destination</button>
            </div>
          </div>
        </div>
      )}

      {/* Re-upload Success Modal */}
      {showReuploadSuccessModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 480, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', border: '1px solid #E2E8F0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', border: '2px solid #A7F3D0', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 16 }}>
              ✓
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', margin: '0 0 8px 0' }}>
              Prescription Re-uploaded!
            </h3>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Your new prescription images have been submitted successfully. Your order is now <strong style={{ color: '#D97706' }}>PENDING PHARMACY REVIEW</strong>. The pharmacist will verify the updated images shortly.
            </p>
            <button
              onClick={() => setShowReuploadSuccessModal(false)}
              style={{ width: '100%', background: '#0F766E', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,118,110,0.25)' }}
            >
              Understand & Continue
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
