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
  batches?: any[];
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
  const [selectedBatchIdForOrder, setSelectedBatchIdForOrder] = useState('');
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const medicineSearchRef = useRef<HTMLDivElement>(null);

  const [basket, setBasket] = useState<Array<{ productId: string; batchId: string; qtyBoxes: number }>>([]);
  const [currentQtyBoxes, setCurrentQtyBoxes] = useState('5');
  
  // Pricing mode: false = flat selling price, true = volume tier pricing
  const [useTierPricing, setUseTierPricing] = useState(false);
  
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
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnItems, setReturnItems] = useState<Array<{ orderItemId: string; quantity: number; maxQty: number; name: string; pricePerUnit: number; tabletsPerBox: number }>>([]);
  const [returnReason, setReturnReason] = useState('Wrong item delivered');
  const [returnLoading, setReturnLoading] = useState(false);
  const [adjustBilling, setAdjustBilling] = useState(false);

  // Order detail modal (click order ID)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Drawer / details modal for customer profile & history
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<Retailer | null>(null);
  const [editingCreditLimit, setEditingCreditLimit] = useState('');
  const [editingLifetimeSpend, setEditingLifetimeSpend] = useState('');
  const [savingCustomerInfo, setSavingCustomerInfo] = useState(false);

  // Print preview state
  const [printPreviewOrder, setPrintPreviewOrder] = useState<Order | null>(null);
  const [manualBarcodeText, setManualBarcodeText] = useState('');

  // Partial payment settlements mapping stored in local storage to survive page refresh
  const [settlements, setSettlements] = useState<Record<string, number>>({});
  const [settleAmount, setSettleAmount] = useState('');
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [settleLogs, setSettleLogs] = useState<Record<string, any[]>>({});

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

  // Filters
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [showB2BOrderCreator, setShowB2BOrderCreator] = useState(false);

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

  // Orders filter
  const filteredOrders = orders.filter(o => {
    // Exclude walkin customer data
    const isWalkin = o.retailer.pharmacyName === 'Walk-in Customer (POS)' || o.retailer.registrationNumber === 'WALKIN-POS-SECURE';
    if (isWalkin) return false;

    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = !filterSearch ||
      o.retailer.pharmacyName.toLowerCase().includes(filterSearch.toLowerCase()) ||
      o.id.toLowerCase().includes(filterSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

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

    const storedLogs = localStorage.getItem('medhub_settle_logs');
    if (storedLogs) setSettleLogs(JSON.parse(storedLogs));
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

  const addToBasket = (productId: string, batchId: string, qty: number) => {
    setBasket(prev => {
      const exists = prev.find(i => i.productId === productId && i.batchId === batchId);
      if (exists) {
        return prev.map(i => (i.productId === productId && i.batchId === batchId) ? { ...i, qtyBoxes: i.qtyBoxes + qty } : i);
      }
      return [...prev, { productId, batchId, qtyBoxes: qty }];
    });
  };

  const removeFromBasket = (productId: string, batchId: string) => {
    setBasket(prev => prev.filter(i => !(i.productId === productId && i.batchId === batchId)));
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
      // For barcode scan, auto-pick the recommended batch (earliest expiry, in-stock)
      const mProd = matchedProduct as any;
      const sortedBatches = [...(mProd.batches || [])]
        .filter((b: any) => new Date(b.expiryDate) > new Date())
        .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      const autoBatchId = sortedBatches.find((b: any) => b.availableBaseUnits > 0)?.id || '';
      addToBasket(matchedProduct.id, autoBatchId, 1);
      setSuccessMsg(`Scanned: Added 1 Box of "${matchedProduct.name}" to order basket.`);
      setBarcodeInput('');
      logActivity('BARCODE_SCAN', `Scanned medicine barcode: ${matchedProduct.sku} - ${matchedProduct.name}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setError(`No product registered with code/SKU: "${cleanedInput}"`);
    }
    if (scannerInputRef.current) scannerInputRef.current.focus();
  };

  const calculateBasketSummary = () => {
    let subtotalPrice = 0;
    const basketItems = basket.map(item => {
      const prod = products.find(p => p.id === item.productId) as any;
      if (!prod) return { name: '', sku: '', qty: 0, pricePerBox: 0, subtotal: 0, batchId: '' };

      // Use the selected batch's selling price, or fall back to earliest active batch
      const allBatches = (prod.batches || []) as any[];
      const selectedBatch = item.batchId ? allBatches.find((b: any) => b.id === item.batchId) : null;
      const sortedBatches = [...allBatches].sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      const activeBatch = sortedBatches.find((b: any) => b.availableBaseUnits > 0);
      const baseSellPrice: number = (selectedBatch ?? activeBatch ?? sortedBatches[0])?.sellingPricePerBox ?? 0;

      let pricePerBox = baseSellPrice;
      // Only apply tier logic when useTierPricing is enabled
      if (useTierPricing) {
        try {
          const tiers = JSON.parse(prod.tierPricingJson || '[]');
          const matchingTier = tiers.find((t: any) => item.qtyBoxes >= t.minQty && item.qtyBoxes <= (t.maxQty || 999999));
          if (matchingTier) pricePerBox = matchingTier.pricePerBox;
        } catch (e) {}
      }
      const subtotal = item.qtyBoxes * pricePerBox;
      subtotalPrice += subtotal;
      return { name: prod.name, sku: prod.sku, qty: item.qtyBoxes, pricePerBox, subtotal, batchId: item.batchId };
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
    
    // Check for loss making deal: selling price below buying price
    for (const item of basketItems) {
      const prod = products.find(p => p.sku === item.sku) as any;
      if (prod) {
        const latestBatch = prod.batches?.length > 0 ? prod.batches[prod.batches.length - 1] : null;
        if (latestBatch) {
          const buyPrice = latestBatch.purchasePricePerBox;
          const sellPriceAfterDiscount = item.pricePerBox * (1 - (parseFloat(orderDiscountPercent) || 0) / 100);
          if (sellPriceAfterDiscount < buyPrice) {
            setError(`Cannot make loss-making deal: ${item.name} selling price (after discount) Rs. ${sellPriceAfterDiscount.toFixed(2)} is below buying price Rs. ${buyPrice.toFixed(2)}.`);
            return;
          }
        }
      }
    }

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
    if (inputPaid <= 0) return;
    const finalPaid = Math.min(currentPaid + inputPaid, totalAmount);
    
    const updated = { ...settlements, [orderId]: finalPaid };
    setSettlements(updated);
    localStorage.setItem('medhub_order_payments', JSON.stringify(updated));

    // Log this payment entry with date
    const newEntry = { amount: inputPaid, date: new Date().toISOString() };
    const existingLog = settleLogs[orderId] || [];
    const updatedLogs = { ...settleLogs, [orderId]: [...existingLog, newEntry] };
    setSettleLogs(updatedLogs);
    localStorage.setItem('medhub_settle_logs', JSON.stringify(updatedLogs));

    setSettleAmount('');
    setSettlingOrderId(null);
    setSuccessMsg(`Payment recorded. Rs. ${inputPaid.toLocaleString()} paid for Order ${orderId.substring(0, 8)}.`);
    logActivity('SETTLE_PAYMENT', `Recorded payment of Rs.${inputPaid} for Order ${orderId}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Print dispatch shipping label
  const printDispatchLabel = (order: Order) => {
    setPrintPreviewOrder(order);
    setManualBarcodeText(`ORD-${order.id.substring(0, 12).toUpperCase()}`);
    logActivity('PRINT_PREVIEW_OPEN', `Opened dispatch label print preview for Order ${order.id.substring(0, 8)}`);
  };

  const openReturnModal = (order: Order) => {
    setReturnOrderId(order.id);
    setReturnOrder(order);
    setReturnItems(order.items.map(i => ({
      orderItemId: i.id,
      quantity: 0,
      maxQty: i.quantity,
      name: i.product.name,
      pricePerUnit: i.pricePerUnit,
      tabletsPerBox: i.product.tabletsPerStrip * i.product.stripsPerBox,
    })));
    setReturnReason('Wrong item delivered');
    setAdjustBilling(false);
  };

  // Compute estimated refund in Rs. based on entered quantities
  const computeRefundPreview = () => {
    let refund = 0;
    for (const ri of returnItems) {
      if (ri.quantity > 0) {
        const tabletsToReturn = ri.quantity * ri.tabletsPerBox;
        refund += Math.min(tabletsToReturn, ri.maxQty) * ri.pricePerUnit;
      }
    }
    return refund;
  };

  const handleReturn = async () => {
    if (!returnOrderId) return;
    setReturnLoading(true);
    setError('');
    try {
      const itemsToReturn = returnItems.filter(i => i.quantity > 0).map(i => ({ orderItemId: i.orderItemId, quantity: i.quantity, reason: returnReason }));
      if (itemsToReturn.length === 0) { setError('Please enter a return quantity for at least one item.'); setReturnLoading(false); return; }
      const res = await fetch(`/api/orders/${returnOrderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToReturn, reason: returnReason, adjustBilling })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Return failed');
      const advanceNote = data.advanceBalanceCredited
        ? ` Rs. ${parseFloat(data.refundValue).toFixed(2)} credited as advance balance.`
        : '';
      setSuccessMsg(`Products returned to inventory successfully. Stock has been restored.${advanceNote}`);
      logActivity('PRODUCT_RETURN', `Returned items from order ${returnOrderId.substring(0, 8)} — Reason: ${returnReason}`);
      setReturnOrderId(null);
      setReturnOrder(null);
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
            onClick={() => setShowB2BOrderCreator(prev => !prev)}
            className="btn-ghost"
            style={{ padding: '6px 14px', background: showB2BOrderCreator ? '#0EA5E9' : 'white', border: '1.5px solid #0EA5E9', color: showB2BOrderCreator ? 'white' : '#0EA5E9', borderRadius: 10, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <ShoppingCart style={{ width: 13, height: 13 }} />
            {showB2BOrderCreator ? 'Hide Order Box' : 'Show Order Box'}
          </button>
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
      <div style={{ display: 'grid', gridTemplateColumns: showB2BOrderCreator ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Orders Table */}
        <div style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          {/* Table header + filters */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ width: 13, height: 13, color: '#0EA5E9' }} /> Orders Log
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: '#94A3B8', textTransform: 'uppercase', marginLeft: 4 }}>({filteredOrders.length})</span>
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Simple / Detail view selector */}
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 10, marginRight: 8 }}>
                <button
                  onClick={() => setViewMode('simple')}
                  style={{
                    padding: '4px 10px', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: viewMode === 'simple' ? 'white' : 'transparent',
                    color: viewMode === 'simple' ? '#0EA5E9' : '#64748B',
                    boxShadow: viewMode === 'simple' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Simple View
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  style={{
                    padding: '4px 10px', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: viewMode === 'detail' ? 'white' : 'transparent',
                    color: viewMode === 'detail' ? '#0EA5E9' : '#64748B',
                    boxShadow: viewMode === 'detail' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Detail View
                </button>
              </div>

              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '4px 10px' }}>
                <Search style={{ width: 12, height: 12, color: '#94A3B8' }} />
                <input type="text" placeholder="Search order / pharmacy..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: 11, width: 150, color: '#1E293B' }} />
              </div>
              {/* Status pills */}
              {(['all','PENDING','DISPATCHED','DELIVERED','RETURNED'] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, border: '1.5px solid', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    background: filterStatus === s ? '#0EA5E9' : 'white',
                    color: filterStatus === s ? 'white' : '#64748B',
                    borderColor: filterStatus === s ? '#0EA5E9' : '#E2E8F0',
                  }}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center' }}><span style={{ fontSize: 12, color: '#64748B' }}>Loading sales log...</span></div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Package style={{ width: 28, height: 28, color: '#CBD5E1', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>NO ORDERS MATCH FILTERS</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  {viewMode === 'simple' ? (
                    <tr>
                      <th>Order / Date</th>
                      <th>Customer</th>
                      <th>Location</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th>Retailer Scan</th>
                      <th>Net / Due</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Order / Date</th>
                      <th>Customer</th>
                      <th>Location</th>
                      <th>Items Detailed</th>
                      <th>Total Amount</th>
                      <th>Discount</th>
                      <th>Net Due</th>
                      <th>Paid / Owed</th>
                      <th>Override Reason</th>
                      <th>Allocations</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const s = statusStyles[order.status] || { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' };
                    const isScanned = scannedOrders[order.id] || order.status === 'DELIVERED';
                    const paid = settlements[order.id] || 0;
                    const due = Math.max(order.netAmount - paid, 0);
                    
                    if (viewMode === 'simple') {
                      return (
                        <tr 
                          key={order.id} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDetailOrder(order)}
                        >
                          <td>
                            <button onClick={(e) => { e.stopPropagation(); setDetailOrder(order); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 800, color: '#0EA5E9', fontSize: 11, padding: 0, textDecoration: 'underline dotted' }}>
                              ORD-{order.id.substring(0, 8).toUpperCase()}
                            </button>
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
                                {item.product.name} ×{item.quantity}
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
                          <td style={{ fontFamily: 'monospace' }}>
                            <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 12 }}>Rs. {order.netAmount.toFixed(2)}</div>
                            {due > 0 && <div style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }}>Due: Rs. {due.toLocaleString()}</div>}
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
                                  <button onClick={() => handleConfirmOrder(order.id)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, borderRadius: 8, border: '1.5px solid #A7F3D0', background: '#ECFDF5', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                                    Fulfill
                                  </button>
                                  <button onClick={() => handleUnsuccessfulDispatch(order.id)} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>
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
                    } else {
                      // Detailed Table View
                      return (
                        <tr 
                          key={order.id} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDetailOrder(order)}
                        >
                          <td>
                            <button onClick={(e) => { e.stopPropagation(); setDetailOrder(order); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 800, color: '#0EA5E9', fontSize: 11, padding: 0, textDecoration: 'underline dotted' }}>
                              ORD-{order.id.substring(0, 8).toUpperCase()}
                            </button>
                            <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', display: 'block', marginTop: 2 }}>{new Date(order.createdAt).toLocaleString()}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <User style={{ width: 12, height: 12, color: '#0EA5E9', flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, fontSize: 12, color: '#1E293B' }}>{order.retailer.pharmacyName}</span>
                            </div>
                            <span style={{ fontSize: 9, color: '#64748B', display: 'block' }}>Reg: {order.retailer.registrationNumber}</span>
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
                          <td>
                            {order.items.map((item) => (
                              <div key={item.id} style={{ fontSize: 10, color: '#334155' }}>
                                <strong>{item.product.name}</strong> ({item.product.sku})
                                <br />
                                <span style={{ color: '#64748B' }}>Qty: {item.quantity} boxes @ Rs. {item.pricePerUnit}/box</span>
                              </div>
                            ))}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>
                            Rs. {order.totalAmount.toFixed(2)}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#EF4444' }}>
                            Rs. {order.discountAmount.toFixed(2)}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800 }}>
                            Rs. {order.netAmount.toFixed(2)}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 10 }}>
                            <div style={{ color: '#10B981' }}>Paid: Rs. {paid.toLocaleString()}</div>
                            <div style={{ color: due > 0 ? '#EF4444' : '#64748B' }}>Due: Rs. {due.toLocaleString()}</div>
                          </td>
                          <td style={{ fontSize: 10, color: '#DC2626', maxWidth: 120 }}>
                            {order.overrideJustification || <span style={{ color: '#94A3B8' }}>None</span>}
                          </td>
                          <td style={{ fontSize: 9, color: '#475569', maxWidth: 150 }}>
                            {order.items.flatMap(i => i.allocations || []).map((alloc, aidx) => (
                              <div key={aidx}>
                                Batch: {alloc.batchId.substring(0, 8)} (Qty: {alloc.quantity})
                              </div>
                            )) || <span style={{ color: '#94A3B8' }}>—</span>}
                          </td>
                          <td>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace', background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: 20 }}>
                              {order.status}
                            </span>
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
                                  <button onClick={() => handleConfirmOrder(order.id)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, borderRadius: 8, border: '1.5px solid #A7F3D0', background: '#ECFDF5', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                                    Fulfill
                                  </button>
                                  <button onClick={() => handleUnsuccessfulDispatch(order.id)} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>
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
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* RIGHT — Order Creator Panel */}
        {showB2BOrderCreator && (
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(14,165,233,0.25)', borderRadius: 18, padding: 20, boxShadow: '0 4px 20px rgba(14,165,233,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingCart style={{ width: 14, height: 14, color: '#0EA5E9' }} /> B2B Order Creator
              </h2>
              {/* Pricing Mode Toggle */}
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setUseTierPricing(false)}
                  style={{
                    padding: '3px 8px', border: 'none', borderRadius: 7, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                    background: !useTierPricing ? 'white' : 'transparent',
                    color: !useTierPricing ? '#0EA5E9' : '#94A3B8',
                    boxShadow: !useTierPricing ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Flat Price
                </button>
                <button
                  type="button"
                  onClick={() => setUseTierPricing(true)}
                  style={{
                    padding: '3px 8px', border: 'none', borderRadius: 7, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                    background: useTierPricing ? 'white' : 'transparent',
                    color: useTierPricing ? '#0EA5E9' : '#94A3B8',
                    boxShadow: useTierPricing ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Tier Pricing
                </button>
              </div>
            </div>
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
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 8, boxShadow: '0 8px 24px rgba(14,165,233,0.15)', zIndex: 20, maxHeight: 160, overflowY: 'auto' }}>
                          {filteredProducts.length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>No medicines found</div>
                          ) : (
                            filteredProducts.map(p => {
                              const tabletsPerBox = p.tabletsPerStrip * p.stripsPerBox;
                              return (
                                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setMedicineSearch(''); setShowMedicineDropdown(false); }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontFamily: 'inherit' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#FFF7ED')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{p.name}</div>
                                  <div style={{ fontSize: 10, color: '#64748B', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                                    <div>SKU: {p.sku}</div>
                                    {p.batches && p.batches.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 4, borderLeft: '2px solid #E2E8F0', marginTop: 2 }}>
                                        {p.batches.map((b: any) => {
                                          const bx = Math.floor(b.availableBaseUnits / tabletsPerBox);
                                          const remaining = b.availableBaseUnits % tabletsPerBox;
                                          const st = Math.floor(remaining / p.tabletsPerStrip);
                                          const tb = remaining % p.tabletsPerStrip;
                                          const expStr = new Date(b.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                          return (
                                            <span key={b.id} style={{ fontSize: 9, color: '#475569' }}>
                                              Batch: <strong>{b.batchNumber}</strong> | Stock: {bx} Bx, {st} St, {tb} Tb | Exp: {expStr}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: 9, color: '#EF4444' }}>Out of Stock</div>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {selectedProduct && (() => {
                  const prodObj = products.find(p => p.id === selectedProduct.id) as any;
                  const tiers = JSON.parse(prodObj?.tierPricingJson || '[]');
                  const allBatches: any[] = (prodObj?.batches || []);
                  // Sort batches: earliest expiry first (FIFO recommended)
                  const sortedBatches = [...allBatches]
                    .filter((b: any) => new Date(b.expiryDate) > new Date())
                    .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                  const recommendedBatchId = sortedBatches.find((b: any) => b.availableBaseUnits > 0)?.id;
                  const activeBatch = selectedBatchIdForOrder
                    ? allBatches.find((b: any) => b.id === selectedBatchIdForOrder)
                    : sortedBatches.find((b: any) => b.availableBaseUnits > 0);
                  const purchasePrice = activeBatch?.purchasePricePerBox ?? 'N/A';
                  const defaultSellingPrice = activeBatch?.sellingPricePerBox ?? 'N/A';
                  const profit = (activeBatch && typeof purchasePrice === 'number' && typeof defaultSellingPrice === 'number')
                    ? (defaultSellingPrice - purchasePrice).toFixed(2) : 'N/A';

                  return (
                    <>
                      {/* Batch Selector */}
                      {sortedBatches.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.06em' }}>Select Batch</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                            {sortedBatches.map((b: any) => {
                              const tbx = prodObj.tabletsPerStrip * prodObj.stripsPerBox;
                              const bx = Math.floor(b.availableBaseUnits / tbx);
                              const rem = b.availableBaseUnits % tbx;
                              const st = Math.floor(rem / prodObj.tabletsPerStrip);
                              const tb = rem % prodObj.tabletsPerStrip;
                              const expStr = new Date(b.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                              const isRecommended = b.id === recommendedBatchId;
                              const isSelected = (selectedBatchIdForOrder || recommendedBatchId) === b.id;
                              const isOutOfStock = b.availableBaseUnits === 0;
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => setSelectedBatchIdForOrder(b.id)}
                                  disabled={isOutOfStock}
                                  style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '7px 10px', border: isSelected ? '1.5px solid #0EA5E9' : '1.5px solid #E2E8F0',
                                    borderRadius: 8, background: isSelected ? '#F0F9FF' : (isOutOfStock ? '#F8FAFC' : 'white'),
                                    cursor: isOutOfStock ? 'not-allowed' : 'pointer', textAlign: 'left',
                                    opacity: isOutOfStock ? 0.5 : 1, fontFamily: 'inherit', width: '100%'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <span style={{ fontWeight: 700, fontSize: 11, color: '#1E293B', fontFamily: 'monospace' }}>{b.batchNumber}</span>
                                      {isRecommended && (
                                        <span style={{ fontSize: 8, fontWeight: 800, background: '#0EA5E9', color: 'white', padding: '1px 5px', borderRadius: 4 }}>⭐ RECOMMENDED</span>
                                      )}
                                      {isOutOfStock && (
                                        <span style={{ fontSize: 8, fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: 4 }}>OUT OF STOCK</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 9, color: '#64748B' }}>
                                      Exp: <strong>{expStr}</strong> &nbsp;|&nbsp; Stock: {bx} Bx, {st} St, {tb} Tb
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 10 }}>
                                    <div style={{ color: '#64748B' }}>Buy: Rs.{b.purchasePricePerBox}</div>
                                    <div style={{ fontWeight: 700, color: '#0EA5E9' }}>Sell: Rs.{b.sellingPricePerBox}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Medicine Info Box */}
                      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: 10, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontWeight: 800, color: '#0284C7' }}>Batch Info:</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Buying Price:</span>
                          <span style={{ fontWeight: 700 }}>Rs. {purchasePrice}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Selling Price:</span>
                          <span style={{ fontWeight: 700, color: '#0EA5E9' }}>Rs. {defaultSellingPrice}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                          <span>Profit / Box:</span>
                          <span style={{ fontWeight: 700 }}>Rs. {profit}</span>
                        </div>
                        {tiers.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ fontWeight: 700, color: '#0284C7', marginBottom: 2 }}>Volume Tiers:</div>
                            {tiers.map((t: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 6, color: '#0369A1', fontSize: 10 }}>
                                <span>{t.minQty}–{t.maxQty || '∞'} boxes:</span>
                                <span style={{ fontWeight: 700 }}>Rs. {t.pricePerBox}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" min="1" placeholder="Qty (boxes)" value={currentQtyBoxes} onChange={(e) => setCurrentQtyBoxes(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="input-crisp" style={{ width: 90, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }} />
                  <button type="button" className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 11 }}
                    onClick={() => {
                      if (selectedProductId) {
                        const prodObj = products.find(p => p.id === selectedProductId) as any;
                        const sortedBatches = [...(prodObj?.batches || [])]
                          .filter((b: any) => new Date(b.expiryDate) > new Date())
                          .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                        const batchId = selectedBatchIdForOrder || sortedBatches.find((b: any) => b.availableBaseUnits > 0)?.id || '';
                        addToBasket(selectedProductId, batchId, parseInt(currentQtyBoxes) || 1);
                        setSelectedProductId('');
                        setSelectedBatchIdForOrder('');
                        setCurrentQtyBoxes('5');
                        logActivity('ADD_BASKET_MANUAL', 'Added item to basket manually');
                      }
                    }}>
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
                        <button type="button" onClick={() => { logActivity('REMOVE_BASKET_ITEM', 'Removed item from basket'); removeFromBasket(basket[idx].productId, basket[idx].batchId); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}>
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
                        onFocus={(e) => e.target.select()}
                        className="input-crisp" style={{ fontSize: 11, padding: 4, width: '100%', textAlign: 'center' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>VAT / Tax %</label>
                      <input 
                        type="number" min="0" max="100" value={orderTaxPercent} 
                        onChange={e => setOrderTaxPercent(e.target.value)} 
                        onFocus={(e) => e.target.select()}
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
        )}
      </div>

      {/* ORDER DETAIL MODAL */}
      {detailOrder && (
        <div className="modal-overlay" onClick={() => setDetailOrder(null)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '680px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                  Order: ORD-{detailOrder.id.substring(0, 12).toUpperCase()}
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{detailOrder.retailer.pharmacyName} · {new Date(detailOrder.createdAt).toLocaleString()}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ ...statusStyles[detailOrder.status] && { background: statusStyles[detailOrder.status].bg, color: statusStyles[detailOrder.status].color, border: `1px solid ${statusStyles[detailOrder.status].border}` }, fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace' }}>{detailOrder.status}</span>
                <button onClick={() => setDetailOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X style={{ width: 20, height: 20 }} /></button>
              </div>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Net Payable', val: `Rs. ${detailOrder.netAmount.toFixed(2)}`, color: '#0EA5E9' },
                  { label: 'Total Paid', val: `Rs. ${(settlements[detailOrder.id] || 0).toLocaleString()}`, color: '#059669' },
                  { label: 'Remaining', val: `Rs. ${Math.max(detailOrder.netAmount - (settlements[detailOrder.id] || 0), 0).toLocaleString()}`, color: '#DC2626' },
                  { label: 'Discount', val: `- Rs. ${detailOrder.discountAmount.toFixed(2)}`, color: '#EA580C' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'monospace' }}>{val}</div>
                  </div>
                ))}
              </div>
              {/* Customer */}
              <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#0369A1', marginBottom: 10 }}>Customer Profile</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                  <div><strong>Pharmacy:</strong> {detailOrder.retailer.pharmacyName}</div>
                  <div><strong>Phone:</strong> {detailOrder.retailer.phone || 'N/A'}</div>
                  <div><strong>Credit Limit:</strong> Rs. {detailOrder.retailer.creditLimit.toLocaleString()}</div>
                  <div><strong>Address:</strong> {detailOrder.retailer.address || 'N/A'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setSelectedCustomerHistory(detailOrder.retailer); setEditingCreditLimit(detailOrder.retailer.creditLimit.toString()); setEditingLifetimeSpend(detailOrder.retailer.lifetimeSpend.toString()); setDetailOrder(null); }} className="btn-ghost" style={{ fontSize: 10, gap: 4 }}>
                    <User style={{ width: 12, height: 12 }} /> Full Profile
                  </button>
                  <a href={`https://www.google.com/maps?q=${detailOrder.retailer.latitude || 27.7172},${detailOrder.retailer.longitude || 85.3240}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: 10, gap: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                    <MapPin style={{ width: 12, height: 12 }} /> View Map
                  </a>
                </div>
              </div>
              {/* Items */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Order Items</div>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead style={{ background: '#F8FAFC' }}>
                      <tr>{['Medicine','SKU','Qty','Price','Subtotal'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Medicine' || h === 'SKU' ? 'left' : 'right', fontWeight: 700, color: '#475569', fontSize: 10 }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {detailOrder.items.map(item => {
                        const tbx = item.product.tabletsPerStrip * item.product.stripsPerBox;
                        const boxes = Math.floor(item.quantity / tbx);
                        return (
                          <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700 }}>{item.product.name}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, color: '#64748B' }}>{item.product.sku}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{boxes} boxes</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>Rs. {(item.pricePerUnit * tbx).toFixed(2)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {detailOrder.status === 'PENDING' && <button onClick={() => { handleDispatchOrder(detailOrder.id); setDetailOrder(null); }} className="btn-primary" style={{ fontSize: 11 }}><Truck style={{ width: 13, height: 13 }} /> Ship</button>}
                {detailOrder.status === 'DELIVERED' && <button onClick={() => { openReturnModal(detailOrder); setDetailOrder(null); }} className="btn-ghost" style={{ fontSize: 11, color: '#DC2626', borderColor: '#FECACA' }}><RotateCcw style={{ width: 13, height: 13 }} /> Return</button>}
                <button onClick={() => printDispatchLabel(detailOrder)} className="btn-ghost" style={{ fontSize: 11 }}><Tag style={{ width: 13, height: 13 }} /> Print Label</button>
              </div>
              <button onClick={() => setDetailOrder(null)} className="btn-primary" style={{ background: '#475569' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Return Products Modal */}
      {returnOrderId && (() => {
        const refundPreview = computeRefundPreview();
        return (
          <div className="modal-overlay" onClick={() => { setReturnOrderId(null); setReturnOrder(null); }}>
            <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '520px', border: '1.5px solid rgba(252,165,165,0.5)' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RotateCcw style={{ width: 18, height: 18 }} /> Process Product Return
                  </h3>
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Returned stock will be restored to original batches</p>
                </div>
                <button onClick={() => { setReturnOrderId(null); setReturnOrder(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
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
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', marginBottom: 10 }}>Return Quantities (in Boxes)</div>
                {returnItems.map((item, idx) => {
                  const maxBoxes = item.tabletsPerBox > 0 ? Math.floor(item.maxQty / item.tabletsPerBox) : item.maxQty;
                  return (
                    <div key={item.orderItemId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>Max: {maxBoxes} boxes | Rs. {(item.pricePerUnit * item.tabletsPerBox).toFixed(2)}/box</div>
                      </div>
                      <input type="number" min={0} max={maxBoxes} value={item.quantity}
                        onChange={e => setReturnItems(returnItems.map((r, i) => i === idx ? { ...r, quantity: parseInt(e.target.value) || 0 } : r))}
                        style={{ width: 70, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, border: '1.5px solid #FCA5A5', borderRadius: 8, padding: '6px', background: '#FEF2F2', color: '#DC2626', outline: 'none' }} />
                    </div>
                  );
                })}
              </div>

              {/* Billing Adjustment Panel */}
              <div style={{ background: refundPreview > 0 ? '#FFF7ED' : '#F8FAFC', border: `1.5px solid ${refundPreview > 0 ? '#FED7AA' : '#E2E8F0'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 16, transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: refundPreview > 0 ? 12 : 0 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DollarSign style={{ width: 14, height: 14, color: '#0EA5E9' }} /> Adjust Billing
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Credit refund value as advance balance for next order</div>
                  </div>
                  {/* Toggle switch */}
                  <button
                    type="button"
                    onClick={() => setAdjustBilling(v => !v)}
                    style={{
                      width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                      background: adjustBilling ? '#0EA5E9' : '#CBD5E1', transition: 'background 0.2s',
                      position: 'relative', flexShrink: 0
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: adjustBilling ? 22 : 3,
                      width: 20, height: 20, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>
                {adjustBilling && refundPreview > 0 && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Advance Balance to Credit</div>
                      <div style={{ fontSize: 10, color: '#059669', marginTop: 2 }}>Will be auto-applied on customer's next order</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>
                      Rs. {refundPreview.toFixed(2)}
                    </div>
                  </div>
                )}
                {adjustBilling && refundPreview === 0 && (
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 8 }}>Enter return quantities above to calculate refund amount.</div>
                )}
              </div>

              <button onClick={handleReturn} disabled={returnLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', fontSize: 12, opacity: returnLoading ? 0.7 : 1 }}>
                {returnLoading ? 'Processing...' : `Confirm Return & Restore Stock${adjustBilling && refundPreview > 0 ? ` + Credit Rs.${refundPreview.toFixed(2)}` : ''}`}
              </button>
            </div>
          </div>
        );
      })()}


      {/* Inline Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '500px', border: '1.5px solid rgba(186,230,253,0.6)' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
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

      {/* CUSTOMER PROFILE & HISTORY MODAL */}
      {selectedCustomerHistory && (
        <div className="modal-overlay" onClick={() => setSelectedCustomerHistory(null)}>
          <div 
            className="modal-card animate-scaleIn"
            style={{
              '--modal-max-width': '640px'
            } as React.CSSProperties}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
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

            {/* Body */}
            <div className="modal-body space-y-6">
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
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedCustomerHistory(null)} className="btn-primary" style={{ background: '#475569' }}>Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {printPreviewOrder && (
        <div className="modal-overlay no-print" onClick={() => setPrintPreviewOrder(null)}>
          <div
            className="modal-card animate-scaleIn"
            style={{
              '--modal-max-width': '440px'
            } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Print Dispatch Shipment Label
              </h3>
              <button onClick={() => setPrintPreviewOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Printable Area */}
            <div 
              id="print-area" 
              style={{ 
                background: 'white', 
                border: '1.5px solid #000', 
                padding: '20px', 
                borderRadius: 12, 
                color: 'black', 
                fontFamily: 'monospace',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', borderBottom: '2.5px solid #000', paddingBottom: 6, marginBottom: 12 }}>
                Dispatch Shipment Label
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>Order ID</div>
                <strong style={{ fontSize: 13 }}>ORD-{printPreviewOrder.id.substring(0, 12).toUpperCase()}</strong>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>Deliver To</div>
                <strong style={{ fontSize: 13 }}>{printPreviewOrder.retailer.pharmacyName}</strong>
                <div>{printPreviewOrder.retailer.address || 'N/A'}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>Dispatch Date</div>
                <div>{new Date(printPreviewOrder.createdAt).toLocaleDateString()}</div>
              </div>

              {/* Barcode section */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0', gap: 6 }}>
                {/* Visual Barcode rendering using pure HTML & CSS */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 48, background: 'white', padding: '4px 8px', border: '1px solid #000', borderRadius: 4, width: '100%' }}>
                  {[1,0,1,1,0,1,0,0,2,0,1,0,2,0,0,1,0,2,0,1,0,0,2,0,1,0,1,0,0,1,0,2,0,0,2,0,1,0,2,0,0,1,0,1,1,0,1,0,0].map((width, idx) => {
                    if (width === 0) return <div key={idx} style={{ width: 2, height: '100%', background: 'transparent' }} />;
                    return <div key={idx} style={{ width: width * 2, height: '100%', background: 'black' }} />;
                  })}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' }}>
                  {manualBarcodeText}
                </div>
              </div>

              {/* Items included section */}
              <div style={{ border: '1.5px solid #000', padding: '10px', borderRadius: 8, marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 4 }}>Items List</div>
                {printPreviewOrder.items.map(item => {
                  const tbx = (item.product.tabletsPerStrip || 10) * (item.product.stripsPerBox || 10);
                  const boxes = Math.floor(item.quantity / tbx);
                  return (
                    <div key={item.id} style={{ padding: '4px 0', borderBottom: '1px dashed #ccc', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.product.name}</span>
                      <strong>{boxes} boxes</strong>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 14, fontSize: 8.5, textAlign: 'center', color: '#64748B', borderTop: '1px dashed #ccc', paddingTop: 6 }}>
                Scan this label on delivery — MedHub Wholesaler Distribution
              </div>
            </div>

            {/* Editable Barcode Text Option */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="no-print">
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
                Barcode Text Override (Manual Input)
              </label>
              <input 
                type="text" 
                value={manualBarcodeText} 
                onChange={e => setManualBarcodeText(e.target.value)} 
                className="input-crisp" 
                style={{ fontSize: 12, padding: '8px 12px' }} 
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #F1F5F9', paddingTop: 14 }} className="no-print">
              <button 
                onClick={() => {
                  const printWindow = window.open('', '_blank', 'width=380,height=550');
                  if (printWindow) {
                    const pagesHtml = `
                      <div id="print-area" style="background: white; border: 1.5px solid #000; padding: 20px; border-radius: 12px; color: black; fontFamily: monospace; font-size: 12px;">
                        <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; border-bottom: 2.5px solid #000; padding-bottom: 6px; margin-bottom: 12px; font-family: monospace;">
                          Dispatch Shipment Label
                        </div>
                        <div style="margin-bottom: 8px; font-family: monospace;">
                          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748B;">Order ID</div>
                          <strong style="font-size: 13px;">ORD-${printPreviewOrder.id.substring(0, 12).toUpperCase()}</strong>
                        </div>
                        <div style="margin-bottom: 8px; font-family: monospace;">
                          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748B;">Deliver To</div>
                          <strong style="font-size: 13px;">${printPreviewOrder.retailer.pharmacyName}</strong>
                          <div>${printPreviewOrder.retailer.address || 'N/A'}</div>
                        </div>
                        <div style="margin-bottom: 12px; font-family: monospace;">
                          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748B;">Dispatch Date</div>
                          <div>${new Date(printPreviewOrder.createdAt).toLocaleDateString()}</div>
                        </div>

                        <div style="display: flex; flex-direction: column; align-items: center; margin: 14px 0; gap: 6px; font-family: monospace;">
                          <div style="display: flex; align-items: flex-end; justify-content: center; height: 48px; background: white; padding: 4px 8px; border: 1px solid #000; border-radius: 4px; width: 100%;">
                            ${[1,0,1,1,0,1,0,0,2,0,1,0,2,0,0,1,0,2,0,1,0,0,2,0,1,0,1,0,0,1,0,2,0,0,2,0,1,0,2,0,0,1,0,1,1,0,1,0,0].map((width) => {
                              if (width === 0) return '<div style="width: 2px; height: 100%; background: transparent;"></div>';
                              return `<div style="width: ${width * 2}px; height: 100%; background: black;"></div>`;
                            }).join('')}
                          </div>
                          <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.05em;">
                            ${manualBarcodeText}
                          </div>
                        </div>

                        <div style="border: 1.5px solid #000; padding: 10px; border-radius: 8px; margin-top: 10px; font-family: monospace;">
                          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748B; margin-bottom: 4px;">Items List</div>
                          ${printPreviewOrder.items.map(item => {
                            const tbx = (item.product.tabletsPerStrip || 10) * (item.product.stripsPerBox || 10);
                            const boxes = Math.floor(item.quantity / tbx);
                            return `
                              <div style="padding: 4px 0; border-bottom: 1px dashed #ccc; fontSize: 11px; display: flex; justify-content: space-between; font-family: monospace;">
                                <span>${item.product.name}</span>
                                <strong>${boxes} boxes</strong>
                              </div>
                            `;
                          }).join('')}
                        </div>

                        <div style="margin-top: 14px; font-size: 8.5px; text-align: center; color: #64748B; border-top: 1px dashed #ccc; padding-top: 6px; font-family: monospace;">
                          Scan this label on delivery — MedHub Wholesaler Distribution
                        </div>
                      </div>
                    `;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Shipment Label Print</title>
                          <style>
                            @page { size: auto; margin: 5mm; }
                            body { margin: 0; padding: 0; background-color: white; font-family: monospace; }
                          </style>
                        </head>
                        <body>
                          \${pagesHtml}
                          <script>
                            var printed = false;
                            function doPrint() {
                              if (printed) return;
                              printed = true;
                              window.print();
                              window.close();
                            }
                            window.onload = function() {
                              setTimeout(doPrint, 200);
                            };
                            // Safety fallback
                            setTimeout(doPrint, 2000);
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                  logActivity('PRINT_SHIPMENT_LABEL', `Printed dispatch shipping label for Order ${printPreviewOrder.id.substring(0, 8)}`);
                }}
                className="btn-primary" 
                style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
              >
                Print Label
              </button>
              <button 
                onClick={() => setPrintPreviewOrder(null)} 
                className="btn-ghost" 
                style={{ padding: '12px 18px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
