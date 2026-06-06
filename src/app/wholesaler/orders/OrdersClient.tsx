'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, Database, Package, ShoppingCart, User, Clock, 
  CreditCard, ShieldAlert, CheckCircle, AlertCircle, Trash2, ArrowRight, Barcode, 
  HelpCircle, RotateCcw, Printer, Search, X, Tag, MapPin, Plus, DollarSign, Percent, AlertTriangle, Eye, Landmark
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';
import { useSSEListener } from '@/hooks/useRealtimeData';

interface Retailer {
  id: string;
  pharmacyName: string;
  creditLimit: number;
  lifetimeSpend: number;
  registrationNumber: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  user?: {
    email: string;
    fullName?: string | null;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  tierPricingJson: string;
}

interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  pricePerUnit: number;
  allocations?: Array<{ id: string; batchId: string; quantity: number }>;
}

interface Order {
  id: string;
  retailerId: string;
  retailer: Retailer;
  status: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  overrideJustification?: string;
  createdAt: string;
  items: OrderItem[];
}

interface OrdersClientProps {
  profileId: string;
  retailers: Retailer[];
}

const PaymentBadge = ({ method = 'COD' }: { method?: string }) => (
  <span style={{
    fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
    fontFamily: 'monospace', letterSpacing: '0.05em',
    background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0',
    padding: '2px 8px', borderRadius: 12
  }}>💵 COD</span>
);

export default function OrdersClient({ profileId, retailers: initialRetailers }: OrdersClientProps) {
  const [retailers, setRetailers] = useState<Retailer[]>(initialRetailers);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Customer search combobox
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Medicine search combobox
  const [medicineSearch, setMedicineSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const medicineSearchRef = useRef<HTMLDivElement>(null);

  const [basket, setBasket] = useState<Array<{ productId: string; qtyBoxes: number }>>([]);
  const [currentQtyBoxes, setCurrentQtyBoxes] = useState('5');
  
  // Custom discount & tax/VAT
  const [orderDiscountPercent, setOrderDiscountPercent] = useState('0');
  const [orderTaxPercent, setOrderTaxPercent] = useState('13'); // 13% default VAT
  
  // Barcode scanner
  const [barcodeInput, setBarcodeInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);
  
  const [creditBlockMessage, setCreditBlockMessage] = useState('');
  const [overrideJustification, setOverrideJustification] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  // Return flow state
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<Array<{ orderItemId: string; quantity: number; maxQty: number; name: string }>>([]);
  const [returnReason, setReturnReason] = useState('Wrong item delivered');
  const [returnLoading, setReturnLoading] = useState(false);

  // Drawer / details modal for customer profile & history
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<Retailer | null>(null);
  const [editingCreditLimit, setEditingCreditLimit] = useState('');
  const [editingLifetimeSpend, setEditingLifetimeSpend] = useState('');
  const [savingCustomerInfo, setSavingCustomerInfo] = useState(false);

  // Partial payment settlements mapping stored in local storage to survive page refresh
  const [settlements, setSettlements] = useState<Record<string, number>>({});
  const [settleAmount, setSettleAmount] = useState('');
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);

  // Retailer barcode scan simulations
  const [scannedOrders, setScannedOrders] = useState<Record<string, boolean>>({});

  // Add customer modal inline
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addPharmacy, setAddPharmacy] = useState('');
  const [addContact, setAddContact] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Filtered lists
  const filteredRetailers = retailers.filter(r =>
    r.pharmacyName.toLowerCase().includes(customerSearch.toLowerCase())
  );
  
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(medicineSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(medicineSearch.toLowerCase())
  );

  const selectedRetailer = retailers.find(r => r.id === selectedRetailerId);
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const fetchOrdersAndProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, orderRes, customerRes] = await Promise.all([
        fetch('/api/wholesaler/products'),
        fetch(`/api/orders?wholesalerId=${profileId}`),
        fetch('/api/wholesaler/customers')
      ]);
      const prodData = await prodRes.json();
      const orderData = await orderRes.json();
      const customerData = await customerRes.json();

      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to fetch products');
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to fetch orders');
      if (customerRes.ok && customerData.customers) {
        setRetailers(customerData.customers);
      }
      
      setProducts(prodData.products);
      setOrders(orderData.orders);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching orders data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndProducts();
    // Load local storage payments & scan records
    const storedSettlements = localStorage.getItem('medhub_order_payments');
    if (storedSettlements) setSettlements(JSON.parse(storedSettlements));

    const storedScans = localStorage.getItem('medhub_retailer_scans');
    if (storedScans) setScannedOrders(JSON.parse(storedScans));
  }, []);

  // SSE real-time auto-refresh
  useSSEListener(profileId, (type) => {
    if (['ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'INVENTORY_UPDATED', 'RETAILER_UPDATED'].includes(type as string)) {
      fetchOrdersAndProducts();
    }
  });

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
      if (medicineSearchRef.current && !medicineSearchRef.current.contains(e.target as Node)) {
        setShowMedicineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addToBasket = (prodId: string, qtyToAdd: number) => {
    if (!prodId || qtyToAdd <= 0) return;
    const existing = basket.find(item => item.productId === prodId);
    if (existing) {
      setBasket(basket.map(item => item.productId === prodId ? { ...item, qtyBoxes: item.qtyBoxes + qtyToAdd } : item));
    } else {
      setBasket([...basket, { productId: prodId, qtyBoxes: qtyToAdd }]);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!barcodeInput.trim()) return;
    const cleanedInput = barcodeInput.trim().toUpperCase();
    let matchedProduct = products.find(p => p.sku.toUpperCase() === cleanedInput);
    if (!matchedProduct) {
      matchedProduct = products.find(p => p.id.substring(0, 8).toUpperCase() === cleanedInput.split('-')[0]);
    }
    if (matchedProduct) {
      addToBasket(matchedProduct.id, 1);
      setSuccessMsg(`Scanned: Added 1 Box of "${matchedProduct.name}" to order basket.`);
      setBarcodeInput('');
      logActivity('BARCODE_SCAN', `Scanned medicine barcode: ${matchedProduct.sku} - ${matchedProduct.name}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setError(`No product registered with code/SKU: "${cleanedInput}"`);
    }
    if (scannerInputRef.current) scannerInputRef.current.focus();
  };

  const removeFromBasket = (productId: string) => setBasket(basket.filter(item => item.productId !== productId));

  const calculateBasketSummary = () => {
    let subtotalPrice = 0;
    const basketItems = basket.map(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return { name: '', sku: '', qty: 0, pricePerBox: 0, subtotal: 0 };
      let pricePerBox = 100;
      try {
        const tiers = JSON.parse(prod.tierPricingJson || '[]');
        const matchingTier = tiers.find((t: any) => item.qtyBoxes >= t.minQty && item.qtyBoxes <= (t.maxQty || 999999));
        if (matchingTier) pricePerBox = matchingTier.pricePerBox;
        else if (tiers.length > 0) pricePerBox = tiers[0].pricePerBox;
      } catch (e) {}
      const subtotal = item.qtyBoxes * pricePerBox;
      subtotalPrice += subtotal;
      return { name: prod.name, sku: prod.sku, qty: item.qtyBoxes, pricePerBox, subtotal };
    });

    const discPct = parseFloat(orderDiscountPercent) || 0;
    const taxPct = parseFloat(orderTaxPercent) || 0;

    const discountAmount = subtotalPrice * (discPct / 100);
    const taxAmount = (subtotalPrice - discountAmount) * (taxPct / 100);
    const netAmount = subtotalPrice - discountAmount + taxAmount;

    return { basketItems, total: subtotalPrice, discountAmount, netAmount, taxAmount };
  };

  const { basketItems, total, discountAmount, netAmount, taxAmount } = calculateBasketSummary();

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccessMsg(''); setCreditBlockMessage('');
    if (basket.length === 0) { setError('Please add at least one product to the basket.'); return; }
    try {
      const payload: Record<string, any> = {
        retailerId: selectedRetailerId,
        wholesalerId: profileId,
        items: basket,
        discountAmount,
        netAmount,
      };
      if (showOverrideInput && overrideJustification) payload.overrideJustification = overrideJustification;
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'CREDIT_BLOCKED') { setCreditBlockMessage(data.reason); setShowOverrideInput(true); return; }
        throw new Error(data.error || 'Failed to submit B2B order.');
      }
      setSuccessMsg(`B2B Order submitted. Transaction ID: ${data.order.id}`);
      logActivity('SUBMIT_ORDER', `Created sales bill. Transaction ID: ${data.order.id}`);
      setBasket([]); setOverrideJustification(''); setShowOverrideInput(false); setCreditBlockMessage('');
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to checkout order.');
    }
  };

  const handleDispatchOrder = async (orderId: string) => {
    setError(''); setSuccessMsg('');
    try {
      const res = await fetch(`/api/orders/${orderId}/dispatch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch shipment');
      setSuccessMsg(`Order ${orderId.substring(0, 8)} dispatched for transport.`);
      logActivity('DISPATCH_SHIPMENT', `Dispatched sales order shipment: ${orderId}`);
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch order.');
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    setError(''); setSuccessMsg('');
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm delivery');
      setSuccessMsg(`Delivery confirmed for Order ${orderId.substring(0, 8)}.`);
      logActivity('SIMULATE_DELIVERY', `Delivery confirmation for order: ${orderId}`);
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm delivery.');
    }
  };

  const handleUnsuccessfulDispatch = async (orderId: string) => {
    setError(''); setSuccessMsg('');
    try {
      // Mark as returned/cancelled delivery
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [], // Empty returns all items
          reason: 'Delivery failed / returned to sender'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel dispatch');
      setSuccessMsg(`Order ${orderId.substring(0, 8)} marked as Unsuccessful dispatch. Stock restored.`);
      logActivity('UNSUCCESSFUL_DELIVERY', `Order ${orderId} dispatch returned due to failed delivery.`);
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to process unsuccessful delivery.');
    }
  };

  // Simulate retailer scanning dispatched barcode
  const toggleRetailerScan = (orderId: string) => {
    const updated = { ...scannedOrders, [orderId]: !scannedOrders[orderId] };
    setScannedOrders(updated);
    localStorage.setItem('medhub_retailer_scans', JSON.stringify(updated));
    logActivity('RETAILER_SCAN_BARCODE', `Simulated retailer scan barcode for Order: ${orderId}`);
    
    // Automatically transition to Delivered if scanned
    if (updated[orderId]) {
      handleConfirmOrder(orderId);
    }
  };

  // Settle payments
  const handleSettleSubmit = (orderId: string, totalAmount: number) => {
    const currentPaid = settlements[orderId] || 0;
    const inputPaid = parseFloat(settleAmount) || 0;
    const finalPaid = Math.min(currentPaid + inputPaid, totalAmount);
    
    const updated = { ...settlements, [orderId]: finalPaid };
    setSettlements(updated);
    localStorage.setItem('medhub_order_payments', JSON.stringify(updated));
    setSettleAmount('');
    setSettlingOrderId(null);
    setSuccessMsg(`Payment recorded. Rs. ${inputPaid.toLocaleString()} paid for Order ${orderId.substring(0, 8)}.`);
    logActivity('SETTLE_PAYMENT', `Recorded payment of Rs.${inputPaid} for Order ${orderId}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Print dispatch shipping label
  const printDispatchLabel = (order: Order) => {
    const w = window.open('', '_blank', 'width=600,height=500');
    if (!w) return;
    const itemsHtml = order.items.map(i => `<div style="padding:4px 0;border-bottom:1px dashed #ccc;font-size:11px;">${i.product.name} (${i.product.sku}) — ${i.quantity} units</div>`).join('');
    
    w.document.write(`<html><head><title>Dispatch Label</title>
      <style>
        @page{size:100mm 150mm;margin:0}
        body{margin:0;padding:6mm;font-family:'Courier New',monospace;font-size:12px;color:#000;background:#fff;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;}
        .header{font-size:16px;font-weight:900;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:6px;margin-bottom:10px}
        .field{margin-bottom:6px;font-size:11px}
        .label{font-size:9px;font-weight:700;text-transform:uppercase;color:#555}
        .barcode-section{display:flex;flex-direction:column;align-items:center;margin:10px 0;}
        .barcode-line{font-size:26px;font-weight:900;letter-spacing:0.1em;text-align:center;border:2px solid #000;padding:8px;margin-bottom:2px;width:100%;box-sizing:border-box;}
        .barcode-text{font-size:10px;font-weight:800;letter-spacing:0.05em;font-family:monospace;}
        .items-section{border:1px solid #ccc;padding:8px;border-radius:4px;margin-top:8px}
        .footer{margin-top:10px;font-size:9px;text-align:center;color:#888;border-top:1px dashed #ccc;padding-top:6px}
        .no-print-btn{display:block;margin:12px auto 0;padding:8px 16px;background:#0EA5E9;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;}
        @media print{.no-print-btn{display:none;}}
      </style>
    </head>
    <body>
      <div>
        <div class="header">Dispatch Shipment Label</div>
        <div class="field"><div class="label">Order ID</div>ORD-${order.id.substring(0, 12).toUpperCase()}</div>
        <div class="field"><div class="label">Deliver To</div><strong>${order.retailer.pharmacyName}</strong><br>${order.retailer.address || ''}</div>
        <div class="field"><div class="label">Dispatch Date</div>${new Date(order.createdAt).toLocaleDateString()}</div>
        
        <div class="barcode-section">
          <div class="barcode-line">||| ${order.id.substring(0, 12).toUpperCase()} |||</div>
          <div class="barcode-text">ORD-${order.id.substring(0, 12).toUpperCase()}</div>
        </div>
        
        <div class="items-section"><div class="label">Items Included</div>${itemsHtml}</div>
      </div>
      <div>
        <div class="footer">Scan this label on delivery — MedHub Wholesaler Distribution</div>
        <button class="no-print-btn" onclick="window.print()">Print Document</button>
      </div>
    </body></html>`);
    w.document.close();
    logActivity('PRINT_DISPATCH_LABEL', `Printed dispatch label for Order ${order.id.substring(0, 8)}`);
  };

  // Open return modal
  const openReturnModal = (order: Order) => {
    setReturnOrderId(order.id);
    setReturnItems(order.items.map(i => ({
      orderItemId: i.id,
      quantity: 0,
      maxQty: i.quantity,
      name: i.product.name
    })));
    setReturnReason('Wrong item delivered');
  };

  const handleReturn = async () => {
    if (!returnOrderId) return;
    setReturnLoading(true);
    setError('');
    try {
      const itemsToReturn = returnItems.filter(i => i.quantity > 0).map(i => ({ orderItemId: i.orderItemId, quantity: i.quantity, reason: returnReason }));
      if (itemsToReturn.length === 0) { setError('Please enter a return quantity for at least one item.'); setReturnLoading(false); return; }
      const res = await fetch(`/api/orders/${returnOrderId}/return`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: itemsToReturn, reason: returnReason }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Return failed');
      setSuccessMsg('Products returned to inventory successfully. Stock has been restored.');
      logActivity('PRODUCT_RETURN', `Returned items from order ${returnOrderId.substring(0, 8)} — Reason: ${returnReason}`);
      setReturnOrderId(null);
      setReturnItems([]);
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReturnLoading(false);
    }
  };

  // Save Customer profile updates (credit limit & spend)
  const saveCustomerProfileChanges = async () => {
    if (!selectedCustomerHistory) return;
    setSavingCustomerInfo(true);
    try {
      const res = await fetch('/api/wholesaler/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomerHistory.id,
          creditLimit: parseFloat(editingCreditLimit),
          lifetimeSpend: parseFloat(editingLifetimeSpend)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update customer info');
      setSuccessMsg(`Updated profile data for ${selectedCustomerHistory.pharmacyName}`);
      setSelectedCustomerHistory(data.customer);
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingCustomerInfo(false);
    }
  };

  // Add new customer inline form POST
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetch('/api/wholesaler/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacyName: addPharmacy, fullName: addContact, phone: addPhone, email: addEmail, address: addAddress })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');
      setSuccessMsg(`${addPharmacy} added to registry.`);
      setSelectedRetailerId(data.customer.id);
      setCustomerSearch('');
      setShowAddCustomerModal(false);
      setAddPharmacy(''); setAddContact(''); setAddPhone(''); setAddEmail(''); setAddAddress('');
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // Alert Registered Customer
  const alertRetailer = async (customerName: string) => {
    setSuccessMsg(`Alert notification broadcasted to ${customerName}'s retailer dashboard!`);
    await logActivity('BROADCAST_ALERT', `Sent critical payment/dispatch alert to retailer: ${customerName}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
    PENDING:    { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    PICKING:    { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    DISPATCHED: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
    DELIVERED:  { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
    RETURNED:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(14,165,233,0.2)', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.06)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Truck style={{ width: 22, height: 22, color: '#0EA5E9' }} />
            B2B Sales &amp; Order Management
          </h1>
          <p style={{ fontSize: 12, color: '#64748B' }}>Create, dispatch, and track B2B pharmacy orders with credit limit enforcement.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="btn-ghost"
            style={{ padding: '6px 14px', background: 'white', border: '1.5px solid #0EA5E9', color: '#0EA5E9', borderRadius: 10, fontSize: 11, fontWeight: 700 }}
          >
            <Plus style={{ width: 13, height: 13, marginRight: 4 }} />
            Add Customer
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#059669' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite', boxShadow: '0 0 0 2px rgba(16,185,129,0.25)' }} />
            LIVE
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{error}</span></div>}
      {successMsg && <div className="alert alert-success"><CheckCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{successMsg}</span></div>}

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Orders Table */}
        <div style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <h2 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ width: 13, height: 13, color: '#0EA5E9' }} /> Recent Orders Log
            </h2>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: '#94A3B8', textTransform: 'uppercase' }}>
              {orders.length} orders
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center' }}><span style={{ fontSize: 12, color: '#64748B' }}>Loading sales log...</span></div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Package style={{ width: 28, height: 28, color: '#CBD5E1', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>NO SALES ORDERS IN LOG</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order / Date</th>
                    <th>Customer</th>
                    <th>Location</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Retailer Scan</th>
                    <th>Net Payable</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const s = statusStyles[order.status] || { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' };
                    const isScanned = scannedOrders[order.id] || order.status === 'DELIVERED';
                    return (
                      <tr 
                        key={order.id} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedCustomerHistory(order.retailer);
                          setEditingCreditLimit(order.retailer.creditLimit.toString());
                          setEditingLifetimeSpend(order.retailer.lifetimeSpend.toString());
                        }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1E293B', fontSize: 11, display: 'block' }}>ORD-{order.id.substring(0, 8).toUpperCase()}</span>
                          <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', display: 'block', marginTop: 2 }}>{new Date(order.createdAt).toLocaleString()}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User style={{ width: 12, height: 12, color: '#0EA5E9', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 12, color: '#1E293B' }}>{order.retailer.pharmacyName}</span>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <a 
                            href={`https://www.google.com/maps?q=${order.retailer.latitude || 27.7172},${order.retailer.longitude || 85.3240}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#0EA5E9', fontWeight: 600 }}
                          >
                            <MapPin style={{ width: 12, height: 12 }} /> Map
                          </a>
                        </td>
                        <td style={{ maxWidth: 160 }}>
                          {order.items.map((item) => (
                            <div key={item.id} style={{ fontSize: 10, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.product.name} ({item.quantity} tabs)
                            </div>
                          ))}
                        </td>
                        <td>
                          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace', background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: 20 }}>
                            {order.status}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {order.status === 'DISPATCHED' ? (
                            <button 
                              onClick={() => toggleRetailerScan(order.id)}
                              style={{
                                border: 'none', background: isScanned ? '#ECFDF5' : '#FFF7ED',
                                color: isScanned ? '#059669' : '#D97706',
                                fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 8, cursor: 'pointer'
                              }}
                            >
                              {isScanned ? '✓ Scanned' : '⚡ Simulate Scan'}
                            </button>
                          ) : (
                            <span style={{ fontSize: 10, color: '#64748B' }}>
                              {order.status === 'DELIVERED' ? '✓ Received' : '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#1E293B', display: 'block', fontSize: 12 }}>Rs. {order.netAmount.toFixed(2)}</span>
                          {order.overrideJustification && (
                            <span style={{ fontSize: 9, color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                              <ShieldAlert style={{ width: 10, height: 10 }} /> Hold Bypassed
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {(order.status === 'PENDING' || order.status === 'DISPATCHED') && (
                              <button onClick={() => printDispatchLabel(order)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10, gap: 3 }} title="Print Dispatch Label">
                                <Tag style={{ width: 10, height: 10 }} /> Label
                              </button>
                            )}
                            {order.status === 'PENDING' && (
                              <button onClick={() => handleDispatchOrder(order.id)} className="btn-primary" style={{ padding: '5px 12px', fontSize: 10, gap: 4 }}>
                                <Truck style={{ width: 11, height: 11 }} /> Ship
                              </button>
                            )}
                            {order.status === 'DISPATCHED' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => handleConfirmOrder(order.id)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderRadius: 8, border: '1.5px solid #A7F3D0', background: '#ECFDF5', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                                  Fulfill
                                </button>
                                <button onClick={() => handleUnsuccessfulDispatch(order.id)} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>
                                  Fail
                                </button>
                              </div>
                            )}
                            {order.status === 'DELIVERED' && (
                              <>
                                <span style={{ fontSize: 10, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <CheckCircle style={{ width: 13, height: 13 }} /> Fulfilled
                                </span>
                                <button onClick={() => openReturnModal(order)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10, gap: 3, color: '#DC2626', borderColor: '#FECACA' }} title="Process Return">
                                  <RotateCcw style={{ width: 10, height: 10 }} /> Return
                                </button>
                              </>
                            )}
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

        {/* RIGHT — Order Creator Panel */}
        <div style={{ background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(14,165,233,0.25)', borderRadius: 18, padding: 20, boxShadow: '0 4px 20px rgba(14,165,233,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
            <h2 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingCart style={{ width: 14, height: 14, color: '#0EA5E9' }} /> B2B Order Creator
            </h2>
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Scan barcodes or select medicines to create a pharmacy order.</p>
          </div>

          {retailers.length === 0 ? (
            <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
              No registered pharmacy found. Click "Add Customer" above to register one first.
            </div>
          ) : (
            <>
              {/* Customer Search Combobox */}
              <div ref={customerSearchRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B', marginBottom: 6 }}>
                  Customer Pharmacy
                </label>
                {selectedRetailer ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 10, padding: '8px 12px' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0284C7' }}>{selectedRetailer.pharmacyName}</div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Limit: Rs. {selectedRetailer.creditLimit.toLocaleString()}</div>
                    </div>
                    <button onClick={() => { setSelectedRetailerId(''); setCustomerSearch(''); setBasket([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '8px 12px' }}>
                      <Search style={{ width: 13, height: 13, color: '#94A3B8', flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Search pharmacy name..."
                        value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', color: '#1E293B' }}
                      />
                    </div>
                    {showCustomerDropdown && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 10, boxShadow: '0 8px 24px rgba(14,165,233,0.15)', zIndex: 20, maxHeight: 200, overflowY: 'auto' }}>
                        {filteredRetailers.length === 0 ? (
                          <div style={{ padding: '12px 14px', fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>No matching pharmacy found</div>
                        ) : (
                          filteredRetailers.map(r => (
                            <button key={r.id} onClick={() => { setSelectedRetailerId(r.id); setCustomerSearch(''); setShowCustomerDropdown(false); setBasket([]); logActivity('CHANGE_ORDER_CUSTOMER', `Selected: ${r.pharmacyName}`); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{r.pharmacyName}</div>
                              <div style={{ fontSize: 10, color: '#64748B' }}>Credit: Rs. {r.creditLimit.toLocaleString()}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Barcode Scanner */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Barcode style={{ width: 12, height: 12, color: '#0EA5E9' }} /> Barcode Scanner
                </div>
                <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: 6 }}>
                  <input ref={scannerInputRef} type="text" placeholder="Scan SKU or barcode..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)}
                    className="input-crisp" style={{ fontFamily: 'monospace', fontSize: 11, flex: 1 }} />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 14px', fontSize: 10, whiteSpace: 'nowrap' }}>Scan</button>
                </form>
              </div>

              {/* Searchable Medicine Combobox */}
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94A3B8' }}>Select Medicine</div>
                <div ref={medicineSearchRef} style={{ position: 'relative' }}>
                  {selectedProduct ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 8, padding: '6px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#C2410C' }}>{selectedProduct.name} ({selectedProduct.sku})</div>
                      <button onClick={() => { setSelectedProductId(''); setMedicineSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search medicine SKU or name..."
                        value={medicineSearch}
                        onChange={e => { setMedicineSearch(e.target.value); setShowMedicineDropdown(true); }}
                        onFocus={() => setShowMedicineDropdown(true)}
                        className="input-crisp"
                        style={{ width: '100%', fontSize: 12 }}
                      />
                      {showMedicineDropdown && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1.5px solid #FED7AA', borderRadius: 8, boxShadow: '0 8px 24px rgba(249,115,22,0.15)', zIndex: 20, maxHeight: 160, overflowY: 'auto' }}>
                          {filteredProducts.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>No medicines found</div>
                          ) : (
                            filteredProducts.map(p => (
                              <button key={p.id} onClick={() => { setSelectedProductId(p.id); setMedicineSearch(''); setShowMedicineDropdown(false); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#FFF7ED')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{p.name}</div>
                                <div style={{ fontSize: 10, color: '#64748B' }}>SKU: {p.sku}</div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" min="1" placeholder="Qty (boxes)" value={currentQtyBoxes} onChange={(e) => setCurrentQtyBoxes(e.target.value)}
                    className="input-crisp" style={{ width: 90, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }} />
                  <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 11 }}
                    onClick={() => { if (selectedProductId) { addToBasket(selectedProductId, parseInt(currentQtyBoxes) || 1); setSelectedProductId(''); setCurrentQtyBoxes('5'); logActivity('ADD_BASKET_MANUAL', 'Added item to basket manually'); } }}>
                    Add to Order
                  </button>
                </div>
              </div>

              {/* Basket */}
              {basket.length > 0 && (
                <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284C7', paddingBottom: 8, borderBottom: '1px solid #BAE6FD', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Order Basket</span><span>Qty × Price</span>
                  </div>
                  {basketItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{item.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748B' }}>{item.qty} × Rs.{item.pricePerBox}</span>
                        <button type="button" onClick={() => { logActivity('REMOVE_BASKET_ITEM', 'Removed item from basket'); removeFromBasket(basket[idx].productId); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid #BAE6FD', paddingTop: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Discount %</label>
                      <input 
                        type="number" min="0" max="100" value={orderDiscountPercent} 
                        onChange={e => setOrderDiscountPercent(e.target.value)} 
                        className="input-crisp" style={{ fontSize: 11, padding: 4, width: '100%', textAlign: 'center' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>VAT / Tax %</label>
                      <input 
                        type="number" min="0" max="100" value={orderTaxPercent} 
                        onChange={e => setOrderTaxPercent(e.target.value)} 
                        className="input-crisp" style={{ fontSize: 11, padding: 4, width: '100%', textAlign: 'center' }} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Totals */}
              {basket.length > 0 && (
                <div style={{ background: '#1E293B', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', marginBottom: 6 }}>
                    <span>Subtotal Price:</span><span>Rs. {total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#EF4444', fontFamily: 'monospace', marginBottom: 6 }}>
                    <span>Discount Amount:</span><span>- Rs. {discountAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#10B981', fontFamily: 'monospace', marginBottom: 6 }}>
                    <span>VAT / Tax Amount:</span><span>+ Rs. {taxAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: 'white', fontFamily: 'monospace', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span>NET DUE:</span><span style={{ color: '#FB923C' }}>Rs. {netAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Credit Block */}
              {creditBlockMessage && (
                <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <ShieldAlert style={{ width: 16, height: 16, color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#DC2626', marginBottom: 4 }}>Credit Block Active</div>
                      <p style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.6 }}>{creditBlockMessage}</p>
                    </div>
                  </div>
                  {showOverrideInput && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 4 }}>Manager Override Reason</label>
                      <textarea rows={2} value={overrideJustification} onChange={(e) => setOverrideJustification(e.target.value)}
                        placeholder="e.g. Approved by manager — partial cash payment received" className="input-crisp" style={{ lineHeight: 1.5, width: '100%' }} />
                    </div>
                  )}
                </div>
              )}

              {/* Submit */}
              <form onSubmit={handlePlaceOrder}>
                <button type="submit" disabled={basket.length === 0 || !selectedRetailerId} className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 12, opacity: (basket.length === 0 || !selectedRetailerId) ? 0.5 : 1, cursor: (basket.length === 0 || !selectedRetailerId) ? 'not-allowed' : 'pointer' }}>
                  {showOverrideInput && overrideJustification ? 'Bypass Hold & Create Invoice' : 'Confirm Order & Create Invoice'}
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Return Products Modal */}
      {returnOrderId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid rgba(252,165,165,0.5)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(220,38,38,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RotateCcw style={{ width: 18, height: 18 }} /> Process Product Return
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Returned stock will be restored to original batches</p>
              </div>
              <button onClick={() => setReturnOrderId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em', marginBottom: 6 }}>Return Reason</label>
              <select value={returnReason} onChange={e => setReturnReason(e.target.value)} className="input-crisp" style={{ width: '100%' }}>
                <option>Wrong item delivered</option>
                <option>Delivery failed / returned to sender</option>
                <option>Defective / damaged goods</option>
                <option>Order cancelled by customer</option>
                <option>Quantity mismatch</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', marginBottom: 10 }}>Return Quantities</div>
              {returnItems.map((item, idx) => (
                <div key={item.orderItemId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>Max returnable: {item.maxQty} units</div>
                  </div>
                  <input type="number" min={0} max={item.maxQty} value={item.quantity}
                    onChange={e => setReturnItems(returnItems.map((r, i) => i === idx ? { ...r, quantity: parseInt(e.target.value) || 0 } : r))}
                    style={{ width: 70, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, border: '1.5px solid #FCA5A5', borderRadius: 8, padding: '6px', background: '#FEF2F2', color: '#DC2626', outline: 'none' }} />
                </div>
              ))}
            </div>

            <button onClick={handleReturn} disabled={returnLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', fontSize: 12, opacity: returnLoading ? 0.7 : 1 }}>
              {returnLoading ? 'Processing...' : 'Confirm Return & Restore Stock'}
            </button>
          </div>
        </div>
      )}

      {/* Inline Add Customer Modal */}
      {showAddCustomerModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="animate-scaleIn" style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid rgba(186,230,253,0.6)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(14,165,233,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                  Register Customer Pharmacy
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Add a new pharmacy account to your retailer directory</p>
              </div>
              <button onClick={() => setShowAddCustomerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Pharmacy Name *</label>
                  <input required value={addPharmacy} onChange={e => setAddPharmacy(e.target.value)} placeholder="Sunrise Pharmacy" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Contact Person *</label>
                  <input required value={addContact} onChange={e => setAddContact(e.target.value)} placeholder="Ram Shrestha" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Phone Number *</label>
                  <input required value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="98XXXXXXXX" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Email Address *</label>
                  <input required type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="pharmacy@email.com" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Address</label>
                <input value={addAddress} onChange={e => setAddAddress(e.target.value)} placeholder="Street, City, District" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
              </div>
              <button type="submit" disabled={addLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', fontSize: 12 }}>
                {addLoading ? 'Registering...' : 'Register Customer Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER PROFILE & HISTORY SLIDE-OUT DRAWER */}
      {selectedCustomerHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedCustomerHistory(null)}>
          <div 
            style={{
              width: '100%', maxWidth: 520, background: 'white', height: '100%',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
              animation: 'slideInRight 0.3s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Customer Profile Details
                </h3>
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>B2B retailer information, limits control, statements, and settle accounts</p>
              </div>
              <button onClick={() => setSelectedCustomerHistory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Profile details */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#1E293B' }}>{selectedCustomerHistory.pharmacyName}</div>
                <div style={{ fontSize: 12, color: '#64748B', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Reg Number:</strong> {selectedCustomerHistory.registrationNumber}</div>
                  <div><strong>Email:</strong> {selectedCustomerHistory.user?.email || 'N/A'}</div>
                  <div><strong>Phone:</strong> {selectedCustomerHistory.phone || 'N/A'}</div>
                  <div><strong>Address:</strong> {selectedCustomerHistory.address || 'N/A'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <a 
                    href={`https://www.google.com/maps?q=${selectedCustomerHistory.latitude || 27.7172},${selectedCustomerHistory.longitude || 85.3240}`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn-ghost" style={{ padding: '6px 12px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'white' }}
                  >
                    <MapPin style={{ width: 12, height: 12 }} /> View on Google Maps
                  </a>
                  <button 
                    onClick={() => alertRetailer(selectedCustomerHistory.pharmacyName)}
                    className="btn-ghost" style={{ padding: '6px 12px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'white', color: '#EA580C', borderColor: '#FED7AA' }}
                  >
                    <AlertTriangle style={{ width: 12, height: 12 }} /> Alert Retailer
                  </button>
                </div>
              </div>

              {/* B2B Controls (Credit Limit, Loyalty spend) */}
              <div style={{ border: '1.5px solid #BAE6FD', background: '#F0F9FF', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#0369A1', letterSpacing: '0.05em' }}>B2B Controls & Loyalty</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 850, color: '#0284C7', textTransform: 'uppercase', marginBottom: 4 }}>Credit Limit (Rs.)</label>
                    <input 
                      type="number" value={editingCreditLimit} 
                      onChange={e => setEditingCreditLimit(e.target.value)} 
                      className="input-crisp" style={{ fontSize: 12, padding: '6px 10px', background: 'white', border: '1.5px solid #BAE6FD', width: '100%' }} 
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 850, color: '#0284C7', textTransform: 'uppercase', marginBottom: 4 }}>Lifetime Spend (Rs.)</label>
                    <input 
                      type="number" value={editingLifetimeSpend} 
                      onChange={e => setEditingLifetimeSpend(e.target.value)} 
                      className="input-crisp" style={{ fontSize: 12, padding: '6px 10px', background: 'white', border: '1.5px solid #BAE6FD', width: '100%' }} 
                    />
                  </div>
                </div>
                <button 
                  onClick={saveCustomerProfileChanges} 
                  disabled={savingCustomerInfo}
                  className="btn-primary" style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: 10, background: '#0EA5E9' }}
                >
                  {savingCustomerInfo ? 'Saving...' : 'Save B2B Limits'}
                </button>
              </div>

              {/* Statement Ledger & Settle Invoice */}
              <div>
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em', marginBottom: 10 }}>Transaction Statement</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {orders.filter(o => o.retailerId === selectedCustomerHistory.id).length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>No orders found for this customer.</div>
                  ) : (
                    orders.filter(o => o.retailerId === selectedCustomerHistory.id).map(o => {
                      const totalAmt = o.netAmount;
                      const paidAmt = settlements[o.id] || 0;
                      const isFullyPaid = paidAmt >= totalAmt;
                      return (
                        <div key={o.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>ORD-{o.id.substring(0, 8).toUpperCase()}</div>
                            <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Net: Rs. {totalAmt.toLocaleString()} | Paid: Rs. {paidAmt.toLocaleString()}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: isFullyPaid ? '#ECFDF5' : '#FFF7ED', color: isFullyPaid ? '#059669' : '#D97706' }}>
                              {isFullyPaid ? 'Paid' : 'Unpaid'}
                            </span>
                            {!isFullyPaid && (
                              <div>
                                {settlingOrderId === o.id ? (
                                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                    <input 
                                      type="number" placeholder="Amt" value={settleAmount} 
                                      onChange={e => setSettleAmount(e.target.value)} 
                                      className="input-crisp" style={{ width: 60, fontSize: 10, padding: 4 }} 
                                    />
                                    <button 
                                      onClick={() => handleSettleSubmit(o.id, totalAmt)}
                                      style={{ padding: '4px 8px', fontSize: 9, background: '#10B981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                    >
                                      Settle
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSettlingOrderId(o.id); }}
                                    style={{ background: 'none', border: 'none', color: '#0EA5E9', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    Settle Payment
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC', textAlign: 'right' }}>
              <button onClick={() => setSelectedCustomerHistory(null)} className="btn-primary" style={{ background: '#475569' }}>Close Drawer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
