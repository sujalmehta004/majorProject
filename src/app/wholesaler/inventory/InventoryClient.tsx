'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, Database, Search, Plus, Calendar, DollarSign, FileText, 
  ChevronDown, ChevronUp, Printer, Check, AlertCircle, RefreshCw, Barcode, Globe, X,
  Edit2, Eye, LayoutGrid, SlidersHorizontal, Settings, Trash
} from 'lucide-react';
import { uomToString, UOMToBaseUnits } from '@/lib/uom';
import { logActivity } from '@/components/WholesalerLayout';
import { useSSEListener } from '@/hooks/useRealtimeData';

interface Product {
  id: string;
  name: string;
  sku: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  tierPricingJson: string;
  category?: string;
  createdAt: string;
}

interface Batch {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  totalBaseUnits: number;
  availableBaseUnits: number;
  manufacturingCost: number;
  invoiceData: string;
  barcodeUrl: string;
  purchasePricePerBox: number;
  sellingPricePerBox: number;
  supplierName: string | null;
  manufacturerName: string | null;
  supplierId?: string | null;
  purchaseDate: string;
  product: Product;
}

interface InventoryClientProps {
  profileId: string;
}

export default function InventoryClient({ profileId }: InventoryClientProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dual-view states
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('detail');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    sku: true,
    tabletsPerStrip: true,
    stripsPerBox: true,
    tabletsPerBox: true,
    availableStock: true,
    purchasePrice: true,
    sellingPrice: true,
    actions: true,
  });

  // Filter states
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'lowstock' | 'out'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'good' | 'near' | 'expired'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<{id: string; name: string} | null>(null);
  const [pendingDeleteBatch, setPendingDeleteBatch] = useState<{id: string; batchNumber: string; productName: string} | null>(null);
  
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductIdForBatch, setSelectedProductIdForBatch] = useState('');
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  // Print menu state
  const [printingBatch, setPrintingBatch] = useState<Batch | null>(null);
  const [printingBatchNumber, setPrintingBatchNumber] = useState<string | null>(null);
  const [selectedBatchNumberToPrint, setSelectedBatchNumberToPrint] = useState('');
  const [manualBarcodeTexts, setManualBarcodeTexts] = useState<Record<string, string>>({});
  // Print preview modal state (single or multi-copy thermal label)
  const [printPreviewBatch, setPrintPreviewBatch] = useState<Batch | null>(null);
  const [printPreviewBatchCopies, setPrintPreviewBatchCopies] = useState(1);

  // Thresholds loaded from settings / localStorage
  const [lowStockBoxes, setLowStockBoxes] = useState(10);
  const [lowStockStrips, setLowStockStrips] = useState(0);
  const [lowStockTablets, setLowStockTablets] = useState(0);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30);

  // Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newTabletsPerStrip, setNewTabletsPerStrip] = useState('10');
  const [newStripsPerBox, setNewStripsPerBox] = useState('10');
  const [newProductCategory, setNewProductCategory] = useState('Uncategorized');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [pricingTiers, setPricingTiers] = useState<Array<{ minQty: number; maxQty: number; pricePerBox: number }>>([]);

  // Batch Form State
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchExpiry, setNewBatchExpiry] = useState('');
  const [batchBoxes, setBatchBoxes] = useState('0');
  const [batchStrips, setBatchStrips] = useState('0');
  const [batchTablets, setBatchTablets] = useState('0');
  const [newManufacturingCost, setNewManufacturingCost] = useState('0.5'); 
  const [newInvoiceData, setNewInvoiceData] = useState('');
  const [purchasePricePerBox, setPurchasePricePerBox] = useState('50');
  const [sellingPricePerBox, setSellingPricePerBox] = useState('100');
  const [supplierName, setSupplierName] = useState('');
  const [manufacturerName, setManufacturerName] = useState('');
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // Quick Add Supplier inline Modal State
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
  const [quickSupName, setQuickSupName] = useState('');
  const [quickSupContact, setQuickSupContact] = useState('');
  const [quickSupPhone, setQuickSupPhone] = useState('');
  const [quickSupEmail, setQuickSupEmail] = useState('');
  const [quickSupAddress, setQuickSupAddress] = useState('');
  const [quickSupLoading, setQuickSupLoading] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const prodRes = await fetch('/api/wholesaler/products');
      const prodData = await prodRes.json();
      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to fetch products');
      setProducts(prodData.products);

      const batchRes = await fetch('/api/wholesaler/batches');
      const batchData = await batchRes.json();
      if (!batchRes.ok) throw new Error(batchData.error || 'Failed to fetch batches');
      setBatches(batchData.batches);

      try {
        const supRes = await fetch('/api/wholesaler/suppliers');
        const supData = await supRes.json();
        if (supRes.ok && supData.suppliers) {
          setSuppliers(supData.suppliers);
        }
      } catch (e) {
        console.error('Failed to fetch suppliers:', e);
      }

      // Load alert thresholds
      const storedBoxes = localStorage.getItem('medhub_low_stock_threshold_boxes');
      const storedStrips = localStorage.getItem('medhub_low_stock_threshold_strips');
      const storedTablets = localStorage.getItem('medhub_low_stock_threshold_tablets');
      if (storedBoxes) setLowStockBoxes(parseInt(storedBoxes, 10));
      if (storedStrips) setLowStockStrips(parseInt(storedStrips, 10));
      if (storedTablets) setLowStockTablets(parseInt(storedTablets, 10));

      const storedExpiry = localStorage.getItem('medhub_expiry_alert_days');
      if (storedExpiry) setExpiryWarningDays(parseInt(storedExpiry, 10));
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // SSE: auto-refresh inventory whenever data changes (works for local + server mutations)
  useSSEListener(profileId, (type) => {
    if (type === 'INVENTORY_UPDATED') {
      fetchData();
    }
  });

  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewInvoiceData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newProductName || !newProductSku) {
      setError('Product Name and SKU are required.');
      return;
    }

    try {
      const categoryToSubmit = showCustomCategoryInput && customCategory.trim() ? customCategory.trim() : newProductCategory;
      const method = editingProduct ? 'PUT' : 'POST';
      const bodyPayload = {
        id: editingProduct?.id,
        name: newProductName,
        sku: newProductSku,
        tabletsPerStrip: parseInt(newTabletsPerStrip),
        stripsPerBox: parseInt(newStripsPerBox),
        category: categoryToSubmit,
        tierPricing: pricingTiers,
      };

      const res = await fetch('/api/wholesaler/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register/update product');

      setSuccessMsg(`Product "${newProductName}" ${editingProduct ? 'updated' : 'registered'} successfully.`);
      setShowProductModal(false);
      setEditingProduct(null);
      
      setNewProductName('');
      setNewProductSku('');
      setNewTabletsPerStrip('10');
      setNewStripsPerBox('10');
      setNewProductCategory('Uncategorized');
      setCustomCategory('');
      setShowCustomCategoryInput(false);
      setPricingTiers([]);

      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit product.');
    }
  };

  const handleAddBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const targetProduct = products.find(p => p.id === selectedProductIdForBatch);
    if (!targetProduct) {
      setError('Selected product not found.');
      return;
    }

    if (!newBatchNumber || !newBatchExpiry || !newManufacturingCost) {
      setError('Batch Number, Expiry Date, and Manufacturing Cost are required.');
      return;
    }

    const boxes = parseInt(batchBoxes) || 0;
    const strips = parseInt(batchStrips) || 0;
    const tablets = parseInt(batchTablets) || 0;

    const totalBaseUnits = UOMToBaseUnits(
      boxes,
      strips,
      tablets,
      targetProduct.tabletsPerStrip,
      targetProduct.stripsPerBox
    );

    if (totalBaseUnits <= 0 && !editingBatch) {
      setError('Please provide a quantity greater than 0.');
      return;
    }

    const buyPrice = parseFloat(purchasePricePerBox) || 0;
    const sellPrice = parseFloat(sellingPricePerBox) || 0;
    if (sellPrice < buyPrice) {
      setError(`Default selling price (${sellPrice}) cannot be set below the buying price (${buyPrice}).`);
      return;
    }
    for (const tier of pricingTiers) {
      if (tier.pricePerBox < buyPrice) {
        setError(`Volume pricing tier price (${tier.pricePerBox}) cannot be set below the buying price (${buyPrice}) of the medicine.`);
        return;
      }
    }

    try {
      const selectedSup = suppliers.find(s => s.id === selectedSupplierId);
      const finalSupplierName = selectedSup ? selectedSup.name : supplierName;

      const method = editingBatch ? 'PUT' : 'POST';
      const bodyPayload = {
        id: editingBatch?.id,
        productId: selectedProductIdForBatch,
        batchNumber: newBatchNumber,
        expiryDate: new Date(newBatchExpiry).toISOString(),
        totalBaseUnits: totalBaseUnits,
        availableBaseUnits: totalBaseUnits,
        manufacturingCost: parseFloat(newManufacturingCost),
        invoiceData: newInvoiceData || undefined,
        purchasePricePerBox: parseFloat(purchasePricePerBox),
        sellingPricePerBox: parseFloat(sellingPricePerBox),
        supplierName: finalSupplierName || undefined,
        manufacturerName,
        supplierId: selectedSupplierId || undefined,
        tierPricing: pricingTiers,
      };

      const res = await fetch('/api/wholesaler/batches', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ingest/update batch');

      setSuccessMsg(`Batch "${newBatchNumber}" ${editingBatch ? 'updated' : 'ingested'} successfully.`);
      setShowBatchModal(false);
      setEditingBatch(null);

      setNewBatchNumber('');
      setNewBatchExpiry('');
      setBatchBoxes('0');
      setBatchStrips('0');
      setBatchTablets('0');
      setNewManufacturingCost('0.5');
      setNewInvoiceData('');
      setPurchasePricePerBox('50');
      setSellingPricePerBox('100');
      setSupplierName('');
      setManufacturerName('');
      setSelectedSupplierId('');

      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit batch.');
    }
  };

  const addPricingTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const nextMin = lastTier ? lastTier.maxQty + 1 : 1;
    setPricingTiers([...pricingTiers, { minQty: nextMin, maxQty: nextMin + 99, pricePerBox: 100 }]);
  };

  const removePricingTier = (index: number) => {
    // Allow removing ALL tiers — no minimum restriction
    setPricingTiers(pricingTiers.filter((_, idx) => idx !== index));
  };

  const updatePricingTier = (index: number, key: 'minQty' | 'maxQty' | 'pricePerBox', value: number) => {
    const updated = [...pricingTiers];
    updated[index] = { ...updated[index], [key]: value };
    setPricingTiers(updated);
  };

  const getProductTotalStock = (productId: string) => {
    return batches
      .filter(b => b.productId === productId && new Date(b.expiryDate) > new Date())
      .reduce((acc, curr) => acc + curr.availableBaseUnits, 0);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setNewProductName(prod.name);
    setNewProductSku(prod.sku);
    setNewTabletsPerStrip(prod.tabletsPerStrip.toString());
    setNewStripsPerBox(prod.stripsPerBox.toString());
    setNewProductCategory(prod.category || 'Uncategorized');
    setCustomCategory('');
    setShowCustomCategoryInput(false);
    try {
      setPricingTiers(JSON.parse(prod.tierPricingJson || '[]'));
    } catch (e) {
      setPricingTiers([]);
    }
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/wholesaler/products?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete product');
      setSuccessMsg(`Medicine "${name}" has been deleted successfully.`);
      setPendingDeleteProduct(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete medicine.');
      setPendingDeleteProduct(null);
    }
  };

  const handleDeleteBatch = async (id: string, batchNumber: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/wholesaler/batches?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete batch');
      setSuccessMsg(`Batch "${batchNumber}" has been deleted successfully.`);
      setPendingDeleteBatch(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete batch.');
      setPendingDeleteBatch(null);
    }
  };

  const openIngestBatch = (product: Product) => {
    setSelectedProductIdForBatch(product.id);
    setEditingBatch(null);
    try {
      setPricingTiers(JSON.parse(product.tierPricingJson || '[]'));
    } catch (e) {
      setPricingTiers([]);
    }
    setNewBatchNumber('');
    setNewBatchExpiry('');
    setBatchBoxes('0');
    setBatchStrips('0');
    setBatchTablets('0');
    setNewManufacturingCost('0.5');
    setNewInvoiceData('');
    setPurchasePricePerBox('50');
    setSellingPricePerBox('100');
    setSupplierName('');
    setManufacturerName('');
    setSelectedSupplierId('');
    setShowBatchModal(true);
  };

  const openEditBatch = (batch: Batch) => {
    setEditingBatch(batch);
    setSelectedProductIdForBatch(batch.productId);
    setNewBatchNumber(batch.batchNumber);
    setNewBatchExpiry(batch.expiryDate.split('T')[0]);

    try {
      setPricingTiers(JSON.parse(batch.product.tierPricingJson || '[]'));
    } catch (e) {
      setPricingTiers([]);
    }
    
    // Convert base units back to Box/Strip/Tab UOM inline
    const tabletsPerBox = batch.product.tabletsPerStrip * batch.product.stripsPerBox;
    const boxes = Math.floor(batch.availableBaseUnits / tabletsPerBox);
    const remainingTablets = batch.availableBaseUnits % tabletsPerBox;
    const strips = Math.floor(remainingTablets / batch.product.tabletsPerStrip);
    const tablets = remainingTablets % batch.product.tabletsPerStrip;

    setBatchBoxes(boxes.toString());
    setBatchStrips(strips.toString());
    setBatchTablets(tablets.toString());

    setNewManufacturingCost(batch.manufacturingCost.toString());
    setPurchasePricePerBox(batch.purchasePricePerBox.toString());
    setSellingPricePerBox(batch.sellingPricePerBox.toString());
    setSupplierName(batch.supplierName || '');
    setManufacturerName(batch.manufacturerName || '');
    setSelectedSupplierId(batch.supplierId || '');
    setShowBatchModal(true);
  };

  // ── Print functions ──
  const printThermalBarcode = async (productName: string, sku: string, batchNumber: string, expiryDate: string, barcodeUrl: string) => {
    await logActivity('PRINT_THERMAL_BARCODE', `Printed thermal label for medicine: ${productName} (Batch: ${batchNumber})`);
    
    const printWindow = window.open('', '_blank', 'width=380,height=280');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Thermal Label Print</title>
          <style>
            @page { size: 50mm 30mm; margin: 0; }
            body {
              margin: 0; padding: 2.5mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 8px; font-weight: bold; text-align: center;
              width: 50mm; height: 30mm; box-sizing: border-box;
              display: flex; flex-direction: column; justify-content: space-between; align-items: center;
              background-color: white; color: black;
            }
            .header {
              font-size: 9px; font-weight: 900; text-transform: uppercase;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
              width: 100%; border-bottom: 0.5px solid black; padding-bottom: 1px;
            }
            .details { font-size: 7px; display: flex; justify-content: space-between; width: 100%; margin: 1px 0; }
            .barcode-img { height: 10mm; width: auto; max-width: 100%; image-rendering: pixelated; }
            .barcode-text { font-size: 8px; font-family: monospace; font-weight: 900; margin: 1px 0; letter-spacing: 0.1em; }
            .footer { font-size: 6.5px; width: 100%; border-top: 0.5px solid black; padding-top: 1px; }
          </style>
        </head>
        <body>
          <div class="header">${productName}</div>
          <div class="details"><span>SKU: ${sku}</span><span>B: ${batchNumber}</span></div>
          <img id="barcodeImg" class="barcode-img" src="${barcodeUrl}" />
          <div class="barcode-text">${sku}-${batchNumber}</div>
          <div class="footer">EXPIRY: ${new Date(expiryDate).toLocaleDateString()}</div>
          <script>
            var printed = false;
            function doPrint() {
              if (printed) return;
              printed = true;
              window.print();
              window.close();
            }
            var img = document.getElementById('barcodeImg');
            if (img && img.complete) {
              setTimeout(doPrint, 200);
            } else if (img) {
              img.onload = function() { setTimeout(doPrint, 200); };
              img.onerror = function() { setTimeout(doPrint, 200); };
            }
            // Safety fallback in case image events don't fire
            setTimeout(doPrint, 2000);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printBatchWiseThermalLabels = async (productName: string, sku: string, batchNumber: string, expiryDate: string, barcodeUrl: string, totalBoxes: number) => {
    await logActivity('PRINT_BATCH_BARCODES', `Printed ${totalBoxes} label copies for Batch: ${batchNumber}`);
    
    const printWindow = window.open('', '_blank', 'width=380,height=280');
    if (!printWindow) return;

    let pagesHtml = '';
    for (let i = 0; i < Math.max(totalBoxes, 1); i++) {
      pagesHtml += `
        <div class="label-page">
          <div class="header">${productName}</div>
          <div class="details"><span>SKU: ${sku}</span><span>B: ${batchNumber} (${i+1}/${totalBoxes})</span></div>
          <img class="barcode-img" src="${barcodeUrl}" />
          <div class="barcode-text">${sku}-${batchNumber}</div>
          <div class="footer">EXPIRY: ${new Date(expiryDate).toLocaleDateString()}</div>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Batch Label Print</title>
          <style>
            @page { size: 50mm 30mm; margin: 0; }
            body { margin: 0; padding: 0; background-color: white; }
            .label-page {
              page-break-after: always;
              margin: 0; padding: 2.5mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 8px; font-weight: bold; text-align: center;
              width: 50mm; height: 30mm; box-sizing: border-box;
              display: flex; flex-direction: column; justify-content: space-between; align-items: center;
              color: black;
            }
            .header {
              font-size: 9px; font-weight: 900; text-transform: uppercase;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
              width: 100%; border-bottom: 0.5px solid black; padding-bottom: 1px;
            }
            .details { font-size: 7px; display: flex; justify-content: space-between; width: 100%; margin: 1px 0; }
            .barcode-img { height: 10mm; width: auto; max-width: 100%; image-rendering: pixelated; }
            .barcode-text { font-size: 8px; font-family: monospace; font-weight: 900; margin: 1px 0; letter-spacing: 0.1em; }
            .footer { font-size: 6.5px; width: 100%; border-top: 0.5px solid black; padding-top: 1px; }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            var printed = false;
            function doPrint() {
              if (printed) return;
              printed = true;
              window.print();
              window.close();
            }
            // Wait for all images to load before printing
            var imgs = Array.from(document.querySelectorAll('img'));
            if (imgs.length === 0) {
              setTimeout(doPrint, 300);
            } else {
              var loadedCount = 0;
              imgs.forEach(function(img) {
                function onReady() { loadedCount++; if (loadedCount >= imgs.length) setTimeout(doPrint, 200); }
                if (img.complete) { onReady(); } else { img.onload = onReady; img.onerror = onReady; }
              });
            }
            // Safety fallback
            setTimeout(doPrint, 3000);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printBatchSummarySheet = async (batch: Batch) => {
    await logActivity('PRINT_BATCH_SUMMARY', `Printed summary sheet for Batch ${batch.batchNumber}`);
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Batch Summary Sheet</title>
          <style>
            body { font-family: system-ui, sans-serif; color: #1E293B; padding: 40px; }
            .container { border: 1.5px solid #E2E8F0; padding: 30px; border-radius: 20px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            h2 { margin: 0 0 10px; font-size: 20px; font-weight: 900; color: #F97316; border-bottom: 2px solid #E2E8F0; padding-bottom: 10px; }
            .field { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; font-weight: 600; border-bottom: 1px dashed #F1F5F9; padding-bottom: 8px; }
            .label { color: #64748B; }
            .value { color: #1E293B; font-family: monospace; }
            .barcode-box { display: flex; flex-direction: column; align-items: center; margin-top: 20px; border: 1.5px solid #BAE6FD; background: #F0F9FF; padding: 20px; border-radius: 12px; }
            .barcode-img { height: 16mm; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Batch Inventory Summary Sheet</h2>
            <div class="field"><span class="label">Medicine Name:</span><span class="value">${batch.product.name}</span></div>
            <div class="field"><span class="label">SKU / Code:</span><span class="value">${batch.product.sku}</span></div>
            <div class="field"><span class="label">Batch number:</span><span class="value">${batch.batchNumber}</span></div>
            <div class="field"><span class="label">Expiry date:</span><span class="value">${new Date(batch.expiryDate).toLocaleDateString()}</span></div>
            <div class="field"><span class="label">Ingested quantity:</span><span class="value">${batch.totalBaseUnits} units</span></div>
            <div class="field"><span class="label">Available quantity:</span><span class="value">${batch.availableBaseUnits} units</span></div>
            <div class="field"><span class="label">Purchase Price/Box:</span><span class="value">Rs. ${batch.purchasePricePerBox.toFixed(2)}</span></div>
            <div class="field"><span class="label">Selling Price/Box:</span><span class="value">Rs. ${batch.sellingPricePerBox.toFixed(2)}</span></div>
            <div class="field"><span class="label">Supplier:</span><span class="value">${batch.supplierName || 'N/A'}</span></div>
            <div class="field"><span class="label">Manufacturer:</span><span class="value">${batch.manufacturerName || 'N/A'}</span></div>
            <div class="field"><span class="label">Purchase Date:</span><span class="value">${new Date(batch.purchaseDate).toLocaleDateString()}</span></div>
            
            <div class="barcode-box">
              <img id="barcodeImg" class="barcode-img" src="${batch.barcodeUrl}" />
              <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.1em; color: #0284C7;">${batch.product.sku}-${batch.batchNumber}</div>
            </div>
          </div>
          <script>
            var printed = false;
            function doPrint() {
              if (printed) return;
              printed = true;
              window.print();
              window.close();
            }
            var img = document.getElementById('barcodeImg');
            if (img && img.complete) {
              setTimeout(doPrint, 300);
            } else if (img) {
              img.onload = function() { setTimeout(doPrint, 300); };
              img.onerror = function() { setTimeout(doPrint, 300); };
            }
            setTimeout(doPrint, 3000);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ── Filters & Column toggle execution ──
  const filteredProducts = products.filter(p => {
    // 1. Text Search query
    const productBatches = batches.filter(b => b.productId === p.id);
    const matchBatch = productBatches.some(b => b.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchText = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      matchBatch;
    if (!matchText) return false;

    // 2. Batch Search Filter
    if (batchSearchQuery.trim()) {
      const hasBatchMatch = productBatches.some(b => b.batchNumber.toLowerCase().includes(batchSearchQuery.toLowerCase()));
      if (!hasBatchMatch) return false;
    }

    // 3. Stock level filters
    const totalStock = getProductTotalStock(p.id);
    if (stockFilter === 'out' && totalStock > 0) return false;
    if (stockFilter === 'instock' && totalStock === 0) return false;
    if (stockFilter === 'lowstock') {
      const thresholdTablets = (lowStockBoxes * p.stripsPerBox * p.tabletsPerStrip) + (lowStockStrips * p.tabletsPerStrip) + lowStockTablets;
      const isLow = totalStock > 0 && totalStock < thresholdTablets;
      if (!isLow) return false;
    }

    // 4. Expiry filters
    if (expiryFilter !== 'all') {
      const hasMatch = productBatches.some(b => {
        const expiry = new Date(b.expiryDate);
        const isExpired = expiry < new Date();
        const diffTime = expiry.getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (expiryFilter === 'expired') return isExpired;
        if (expiryFilter === 'near') return !isExpired && diffDays <= expiryWarningDays;
        if (expiryFilter === 'good') return !isExpired && diffDays > expiryWarningDays;
        return true;
      });
      if (!hasMatch && productBatches.length > 0) return false;
    }

    // 5. Category filter
    if (categoryFilter !== 'all') {
      const prodCat = p.category || 'Uncategorized';
      if (prodCat !== categoryFilter) return false;
    }

    return true;
  });

  // Sub-renderer for batch listings under a product
  function renderBatchesSection(product: Product) {
    const productBatches = batches.filter(b => b.productId === product.id);

    return (
      <div style={{ borderTop: '1px solid #F1F5F9', padding: '20px', background: 'rgba(248,250,252,0.6)' }} className="space-y-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            Active Batches in Warehouse
          </h4>
          <button
            onClick={() => { setSelectedProductIdForBatch(product.id); setEditingBatch(null); setShowBatchModal(true); }}
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: 10 }}
          >
            <Plus style={{ width: 11, height: 11 }} /> Ingest New Batch
          </button>
        </div>

        {productBatches.length === 0 ? (
          <div className="border border-dashed border-slate-200 bg-white py-6 text-center rounded-2xl">
            <p className="text-zinc-550 text-xs">No active batches ingested. Use &ldquo;Ingest Batch&rdquo; to add medicine stocks.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Status</th>
                  <th>Expiry Date</th>
                  <th>Supplier / Manufacturer</th>
                  <th>Available Stock</th>
                  <th>Buy / Sell Price</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {productBatches.map((batch) => {
                  const expiry = new Date(batch.expiryDate);
                  const isExpired = expiry < new Date();
                  const diffTime = expiry.getTime() - new Date().getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const isNearExpiry = !isExpired && diffDays <= expiryWarningDays;

                  const batchUomStr = uomToString(batch.availableBaseUnits, product.tabletsPerStrip, product.stripsPerBox);
                  return (
                    <tr key={batch.id}>
                      <td>
                        <span className="font-mono font-bold text-zinc-900">{batch.batchNumber}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${isExpired ? 'status-pill-danger' : isNearExpiry ? 'status-pill-warning' : 'status-pill-active'}`} style={{ color: isNearExpiry ? '#D97706' : undefined, background: isNearExpiry ? '#FEF3C7' : undefined }}>
                          {isExpired ? 'Expired' : isNearExpiry ? 'Near Expiry' : 'Good'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-zinc-700">
                          <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          {new Date(batch.expiryDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold text-zinc-800">{batch.manufacturerName || '—'}</div>
                        <div className="text-[10px] text-zinc-500">{batch.supplierName || '—'}</div>
                      </td>
                      <td>
                        <div className="font-bold font-mono text-zinc-800">{batchUomStr}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">{batch.availableBaseUnits} units</div>
                      </td>
                      <td>
                        <div className="text-zinc-550 text-[11px]">Buy: Rs. {batch.purchasePricePerBox.toFixed(2)}</div>
                        <div className="text-orange-600 font-bold text-[11px]">Sell: Rs. {batch.sellingPricePerBox.toFixed(2)}</div>
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEditBatch(batch)}
                            className="btn-ghost py-1 px-2.5 text-[10px] cursor-pointer"
                          >
                            <Edit2 style={{ width: 11, height: 11 }} />
                            Edit
                          </button>
                          <button
                            onClick={() => setPrintingBatch(batch)}
                            className="btn-ghost py-1 px-2.5 text-[10px] cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                            Print Label
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
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(14,165,233,0.2)', borderRadius: 20,
        padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)'
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Package style={{ width: 22, height: 22, color: '#0EA5E9' }} />
            Medications Catalog & Registry
          </h1>
          <p style={{ fontSize: 12, color: '#64748B' }}>Register medicines, manage warehouse stock batches, and print barcode thermal labels.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Dual View Selector */}
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 10 }}>
            <button
              onClick={() => setViewMode('simple')}
              style={{
                padding: '6px 12px', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: viewMode === 'simple' ? 'white' : 'transparent',
                color: viewMode === 'simple' ? '#0EA5E9' : '#64748B',
                boxShadow: viewMode === 'simple' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <LayoutGrid style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />
              Simple
            </button>
            <button
              onClick={() => setViewMode('detail')}
              style={{
                padding: '6px 12px', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: viewMode === 'detail' ? 'white' : 'transparent',
                color: viewMode === 'detail' ? '#0EA5E9' : '#64748B',
                boxShadow: viewMode === 'detail' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <Eye style={{ width: 13, height: 13, display: 'inline', marginRight: 4 }} />
              Detail View
            </button>
          </div>

          <button
            onClick={() => { setEditingProduct(null); setPricingTiers([]); setShowProductModal(true); }}
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #0EA5E9, #6366F1)', border: 'none', color: '#white' }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Add New Medicine
          </button>
          <button
            onClick={() => { setPrintingBatchNumber(''); setSelectedBatchNumberToPrint(''); }}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer style={{ width: 14, height: 14, color: '#0EA5E9' }} />
            Print Batch Labels
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#059669', cursor: 'default' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite', boxShadow: '0 0 0 2px rgba(16,185,129,0.25)' }} />
            LIVE
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && <div className="alert alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />{error}</div>}
      {successMsg && <div className="alert alert-success"><Check style={{ width: 14, height: 14, flexShrink: 0 }} />{successMsg}</div>}

      {/* Filter & Column Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="filter-bar" style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, padding: '14px 20px',
          background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(226,232,240,0.8)', borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}>
          {/* Search */}
          <div className="filter-field" style={{ minWidth: 200, flex: '1 1 200px' }}>
            <label className="filter-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
              <Search style={{ width: 12, height: 12, color: '#0EA5E9' }} />Search Catalog
            </label>
            <input
              type="text"
              placeholder="Search SKU or medicine name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-input"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10,
                outline: 'none', background: 'white', transition: 'border-color 0.2s'
              }}
            />
          </div>

          {/* Batch Search */}
          <div className="filter-field" style={{ minWidth: 150, flex: '1 1 150px', position: 'relative' }}>
            <label className="filter-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
              <Barcode style={{ width: 12, height: 12, color: '#0EA5E9' }} />Batch Number
            </label>
            <input
              type="text"
              placeholder="Search Batch ID..."
              value={batchSearchQuery}
              onChange={(e) => setBatchSearchQuery(e.target.value)}
              className="filter-input"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10,
                outline: 'none', background: 'white', transition: 'border-color 0.2s'
              }}
            />
            {batchSearchQuery && batches.filter(b => b.batchNumber.toLowerCase().includes(batchSearchQuery.toLowerCase())).length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 10,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                maxHeight: 200, overflowY: 'auto', marginTop: 4
              }}>
                {batches
                  .filter(b => b.batchNumber.toLowerCase().includes(batchSearchQuery.toLowerCase()))
                  .slice(0, 10)
                  .map(b => {
                    const tabletsPerBox = b.product.tabletsPerStrip * b.product.stripsPerBox;
                    const boxes = Math.floor(b.availableBaseUnits / tabletsPerBox);
                    const remainingTablets = b.availableBaseUnits % tabletsPerBox;
                    const strips = Math.floor(remainingTablets / b.product.tabletsPerStrip);
                    const tablets = remainingTablets % b.product.tabletsPerStrip;
                    const stockStr = `${boxes} Bx, ${strips} St, ${tablets} Tb`;
                    const expiryStr = new Date(b.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    return (
                      <div
                        key={b.id}
                        onClick={() => setBatchSearchQuery(b.batchNumber)}
                        style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 2 }}
                        className="hover:bg-orange-50"
                      >
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{b.batchNumber} <span style={{ fontWeight: 400, color: '#64748B' }}>({b.product.name})</span></div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>Expiry: {expiryStr} | Stock: {stockStr}</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
 
          {/* Stock Level Filter */}
          <div className="filter-field" style={{ minWidth: 140 }}>
            <label className="filter-label" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Stock Status</label>
            <select
              value={stockFilter}
              onChange={(e: any) => setStockFilter(e.target.value)}
              className="filter-select"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10,
                outline: 'none', background: 'white', cursor: 'pointer'
              }}
            >
              <option value="all">All Levels</option>
              <option value="instock">In Stock</option>
              <option value="lowstock">Low Stock Alerts</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
 
          {/* Expiry Filter */}
          <div className="filter-field" style={{ minWidth: 140 }}>
            <label className="filter-label" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Expiry Status</label>
            <select
              value={expiryFilter}
              onChange={(e: any) => setExpiryFilter(e.target.value)}
              className="filter-select"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10,
                outline: 'none', background: 'white', cursor: 'pointer'
              }}
            >
              <option value="all">All Lifespans</option>
              <option value="good">Good Shelf Life</option>
              <option value="near">Expiring Warning</option>
              <option value="expired">Expired Batches</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="filter-field" style={{ minWidth: 140 }}>
            <label className="filter-label" style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Category Filter</label>
            <select
              value={categoryFilter}
              onChange={(e: any) => setCategoryFilter(e.target.value)}
              className="filter-select"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10,
                outline: 'none', background: 'white', cursor: 'pointer'
              }}
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(['Uncategorized', 'Gel', 'Drink', 'Tablet', 'Capsule', 'Injection', 'Syrup', 'Ointment', ...products.map(p => p.category || 'Uncategorized')])).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || batchSearchQuery || stockFilter !== 'all' || expiryFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setBatchSearchQuery('');
                setStockFilter('all');
                setExpiryFilter('all');
                setCategoryFilter('all');
              }}
              className="btn-ghost"
              style={{
                alignSelf: 'flex-end', height: 38, padding: '0 14px', display: 'flex',
                alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 10,
                background: '#FFF1F2', border: '1.5px solid #FECDD3', color: '#E11D48',
                fontWeight: 600
              }}
            >
              Clear Filters
            </button>
          )}
          </div>

          {/* Detail View Column Selector Trigger */}
          {viewMode === 'detail' && (
            <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'flex-end' }}>
              <button
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className="btn-ghost"
                style={{
                  height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                  border: '1.5px solid #E2E8F0', borderRadius: 10, background: 'white', fontWeight: 600, color: '#475569'
                }}
              >
                <SlidersHorizontal style={{ width: 14, height: 14, color: '#0EA5E9' }} />
                Columns
              </button>
              {showColumnPicker && (
                <div
                  className="animate-scaleIn"
                  style={{
                    position: 'absolute', right: 0, marginTop: 8, zIndex: 30, width: 200,
                    background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 14,
                    padding: 12, boxShadow: '0 10px 30px rgba(14,165,233,0.12)'
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.08em', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 8 }}>Select Columns</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(visibleColumns).map(([col, val]) => (
                      <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={() => setVisibleColumns({ ...visibleColumns, [col]: !val })}
                          style={{ accentColor: '#0EA5E9' }}
                        />
                        {col.replace(/([A-Z])/g, ' $1').toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Main List Rendering */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.7)', borderRadius: 16, border: '1.5px solid #F1F5F9' }}>
          <RefreshCw style={{ width: 24, height: 24, color: '#0EA5E9' }} className="animate-spin" />
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Synchronizing medicine library...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 16, border: '1.5px dashed #E2E8F0' }}>
          <Package style={{ width: 32, height: 32, color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>No matching medicines found.</p>
        </div>
      ) : viewMode === 'simple' ? (
        /* ══ SIMPLE VIEW: NORMAL GENERIC CARDS ══ */
        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const totalTablets = getProductTotalStock(product.id);
            const totalUomStr = uomToString(totalTablets, product.tabletsPerStrip, product.stripsPerBox);
            const isExpanded = expandedProduct === product.id;
            const thresholdTablets = (lowStockBoxes * product.stripsPerBox * product.tabletsPerStrip) + (lowStockStrips * product.tabletsPerStrip) + lowStockTablets;
            const isLowStock = totalTablets > 0 && totalTablets < thresholdTablets;

            return (
              <div
                key={product.id}
                style={{
                  background: 'rgba(255,255,255,0.88)', border: isExpanded ? '1.5px solid #0EA5E9' : '1.5px solid #E2E8F0',
                  borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: isLowStock ? '#FEF2F2' : '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Database style={{ width: 16, height: 16, color: isLowStock ? '#EF4444' : '#0EA5E9' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: '#1E293B' }}>{product.name}</span>
                        {isLowStock && <span style={{ fontSize: 9, fontWeight: 800, background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#EF4444', padding: '1px 6px', borderRadius: 4 }}>LOW STOCK</span>}
                      </div>
                      <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>SKU Code: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{product.sku}</span></p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#94A3B8' }}>Available Stock</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', fontFamily: 'monospace', marginTop: 2 }}>{totalUomStr}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditProduct(product); }}
                      className="btn-ghost"
                      style={{ padding: '6px 12px' }}
                    >
                      <Edit2 style={{ width: 12, height: 12, color: '#64748B' }} />
                      Edit Info
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedProduct(isExpanded ? null : product.id); }}
                      className="btn-ghost"
                      style={{ padding: '6px 12px', border: '1.5px solid #BAE6FD', background: '#F0F9FF', color: '#0284C7' }}
                    >
                      <Database style={{ width: 12, height: 12 }} />
                      Batch Info
                    </button>
                    {isExpanded ? <ChevronUp style={{ width: 16, height: 16, color: '#CBD5E1' }} /> : <ChevronDown style={{ width: 16, height: 16, color: '#CBD5E1' }} />}
                  </div>
                </div>

                {isExpanded && renderBatchesSection(product)}
              </div>
            );
          })}
        </div>
      ) : (
        /* ══ DETAIL VIEW: FULL COMPREHENSIVE REGISTRY TABLE ══ */
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 20 }}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  {visibleColumns.sku && <th>SKU</th>}
                  {visibleColumns.tabletsPerStrip && <th>Tabs/Strip</th>}
                  {visibleColumns.stripsPerBox && <th>Strips/Box</th>}
                  {visibleColumns.tabletsPerBox && <th>Tabs/Box</th>}
                  {visibleColumns.availableStock && <th>Total Stock</th>}
                  {visibleColumns.purchasePrice && <th>Buy Price/Box</th>}
                  {visibleColumns.sellingPrice && <th>Sell Price/Box</th>}
                  {visibleColumns.actions && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const totalTablets = getProductTotalStock(product.id);
                  const totalUomStr = uomToString(totalTablets, product.tabletsPerStrip, product.stripsPerBox);
                  const isExpanded = expandedProduct === product.id;
                  const activeBatches = batches.filter(b => b.productId === product.id && new Date(b.expiryDate) > new Date());
                  const buyPrices = activeBatches.map(b => b.purchasePricePerBox);
                  const sellPrices = activeBatches.map(b => b.sellingPricePerBox);
                  const buyStr = buyPrices.length === 0 ? '—' : buyPrices.length === 1 ? `Rs.${buyPrices[0]}` : `Rs.${Math.min(...buyPrices)}–${Math.max(...buyPrices)}`;
                  const sellStr = sellPrices.length === 0 ? '—' : sellPrices.length === 1 ? `Rs.${sellPrices[0]}` : `Rs.${Math.min(...sellPrices)}–${Math.max(...sellPrices)}`;

                  return (
                    <React.Fragment key={product.id}>
                      <tr style={{ background: isExpanded ? 'rgba(14,165,233,0.02)' : 'transparent' }}>
                        <td>
                          <button
                            onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#1E293B', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                          >
                            <Database style={{ width: 13, height: 13, color: '#0EA5E9' }} />
                            {product.name}
                          </button>
                        </td>
                        {visibleColumns.sku && <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{product.sku}</td>}
                        {visibleColumns.tabletsPerStrip && <td style={{ fontFamily: 'monospace' }}>{product.tabletsPerStrip}</td>}
                        {visibleColumns.stripsPerBox && <td style={{ fontFamily: 'monospace' }}>{product.stripsPerBox}</td>}
                        {visibleColumns.tabletsPerBox && <td style={{ fontFamily: 'monospace' }}>{product.tabletsPerStrip * product.stripsPerBox}</td>}
                        {visibleColumns.availableStock && (
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {totalUomStr}
                          </td>
                        )}
                        {visibleColumns.purchasePrice && (
                          <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>{buyStr}</td>
                        )}
                        {visibleColumns.sellingPrice && (
                          <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#0EA5E9' }}>{sellStr}</td>
                        )}
                        {visibleColumns.actions && (
                          <td className="text-right">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button onClick={() => openEditProduct(product)} className="btn-ghost py-1 px-2.5 text-[10px]">
                                <Edit2 style={{ width: 11, height: 11 }} /> Edit
                              </button>
                              <button onClick={() => openIngestBatch(product)} className="btn-ghost py-1 px-2.5 text-[10px]">
                                <Plus style={{ width: 11, height: 11 }} /> Batch
                              </button>
                              <button onClick={() => setExpandedProduct(isExpanded ? null : product.id)} className="btn-ghost py-1 px-2.5 text-[10px]" style={{ border: '1.5px solid #BAE6FD', background: '#F0F9FF', color: '#0284C7' }}>
                                <Database style={{ width: 11, height: 11 }} /> Batch Info
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ background: '#FAFCFF', padding: '16px 24px' }}>
                            {renderBatchesSection(product)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Register/Edit Product */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '560px', border: '1.5px solid rgba(251,146,60,0.25)', boxShadow: '0 25px 50px -12px rgba(249,115,22,0.18)', padding: 28, gap: 20 } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {editingProduct ? 'Edit Medicine Configuration' : 'Register New Medicine'}
                </h3>
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Configure name, SKU, and tablets/strips count</p>
              </div>
              <button onClick={() => { setShowProductModal(false); setEditingProduct(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Medicine Name *</label>
                  <input
                    type="text" required value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. Cetamol 500mg" className="input-crisp" style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Medicine Code (SKU) *</label>
                  <input
                    type="text" required value={newProductSku} onChange={(e) => setNewProductSku(e.target.value)}
                    placeholder="e.g. CET-500" className="input-crisp" style={{ width: '100%', fontSize: 12, textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Tablets Per Strip *</label>
                  <input
                    type="number" min="1" required value={newTabletsPerStrip} onChange={(e) => setNewTabletsPerStrip(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="input-crisp" style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Strips Per Box *</label>
                  <input
                    type="number" min="1" required value={newStripsPerBox} onChange={(e) => setNewStripsPerBox(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="input-crisp" style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Medicine Category</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {!showCustomCategoryInput ? (
                    <select
                      value={newProductCategory}
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setShowCustomCategoryInput(true);
                        } else {
                          setNewProductCategory(e.target.value);
                        }
                      }}
                      className="select-crisp"
                      style={{ flex: 1, fontSize: 12 }}
                    >
                      {Array.from(new Set(['Uncategorized', 'Gel', 'Drink', 'Tablet', 'Capsule', 'Injection', 'Syrup', 'Ointment', ...products.map(p => p.category || 'Uncategorized')])).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="ADD_NEW" style={{ fontWeight: 'bold', color: '#EA580C' }}>+ Add Custom Category...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                      <input
                        type="text"
                        placeholder="Enter category name..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="input-crisp"
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomCategoryInput(false);
                          setCustomCategory('');
                        }}
                        className="btn-ghost"
                        style={{ padding: '6px 12px', fontSize: 10 }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit" className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #0EA5E9, #6366F1)', marginTop: 8, fontSize: 12, border: 'none', color: '#white' }}
              >
                {editingProduct ? 'Save Modifications' : 'Register Medication'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Ingest/Edit Stock Batch */}
      {showBatchModal && (
        <div className="modal-overlay" onClick={() => { setShowBatchModal(false); setEditingBatch(null); }}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '560px', border: '1.5px solid rgba(14,165,233,0.25)', boxShadow: '0 25px 50px -12px rgba(14,165,233,0.18)', padding: 28, gap: 20 } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {editingBatch ? 'Modify Ingested Batch' : 'Ingest Active Stock Batch'}
                </h3>
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Ingest units count, expiry date, purchase price, and supplier info</p>
              </div>
              <button onClick={() => { setShowBatchModal(false); setEditingBatch(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Batch ID / Number *</label>
                  <input
                    type="text" required value={newBatchNumber} onChange={(e) => setNewBatchNumber(e.target.value)}
                    placeholder="e.g. CET-2026-B1" className="input-crisp" style={{ width: '100%', fontSize: 12, textTransform: 'uppercase', fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Expiry Date *</label>
                  <input
                    type="date" required value={newBatchExpiry} onChange={(e) => setNewBatchExpiry(e.target.value)}
                    className="input-crisp" style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* UOM Inputs */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Stock Ingestion Count</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 12, borderRadius: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#94A3B8', textAlign: 'center', marginBottom: 4 }}>BOXES</label>
                    <input
                      type="number" min="0" value={batchBoxes} onChange={(e) => setBatchBoxes(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="input-crisp" style={{ width: '100%', textAlign: 'center', fontWeight: 'bold', fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#94A3B8', textAlign: 'center', marginBottom: 4 }}>STRIPS</label>
                    <input
                      type="number" min="0" value={batchStrips} onChange={(e) => setBatchStrips(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="input-crisp" style={{ width: '100%', textAlign: 'center', fontWeight: 'bold', fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#94A3B8', textAlign: 'center', marginBottom: 4 }}>TABLETS</label>
                    <input
                      type="number" min="0" value={batchTablets} onChange={(e) => setBatchTablets(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="input-crisp" style={{ width: '100%', textAlign: 'center', fontWeight: 'bold', fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              {/* Buying / Selling Cost overrides */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Buying Price (Per Box) (Rs.) *</label>
                  <input
                    type="number" step="0.01" min="0" required value={purchasePricePerBox}
                    onChange={(e) => {
                      setPurchasePricePerBox(e.target.value);
                      const targetProduct = products.find(p => p.id === selectedProductIdForBatch);
                      if (targetProduct) {
                        const tabs = targetProduct.tabletsPerStrip * targetProduct.stripsPerBox;
                        setNewManufacturingCost((parseFloat(e.target.value) / tabs).toFixed(4));
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className="input-crisp" style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Default Selling Price (Per Box) (Rs.) *</label>
                  <input
                    type="number" step="0.01" min="0" required value={sellingPricePerBox}
                    onChange={(e) => setSellingPricePerBox(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="input-crisp" style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Manufacturer / Supplier Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Manufacturer Name</label>
                  <input
                    type="text" value={manufacturerName} onChange={(e) => setManufacturerName(e.target.value)}
                    placeholder="e.g. Deurali Janta" className="input-crisp" style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Supplier *</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickSupplierModal(true)}
                      style={{ fontSize: 10, fontWeight: 800, color: '#EA580C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      + Quick Add
                    </button>
                  </div>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value);
                      const matched = suppliers.find(s => s.id === e.target.value);
                      if (matched) {
                        setSupplierName(matched.name);
                      } else {
                        setSupplierName('');
                      }
                    }}
                    className="select-crisp"
                    style={{ width: '100%', fontSize: 12 }}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing Tiers Section in Batch Modal */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volume Pricing Tiers (Per Box)</label>
                  <button
                    type="button" onClick={addPricingTier}
                    style={{
                      padding: '4px 10px', borderRadius: 8, border: '1.5px solid #FED7AA', background: '#FFF7ED',
                      color: '#EA580C', fontSize: 10, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    + Add Tier
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
                  {pricingTiers.map((tier, index) => (
                    <div key={index} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ flexGrow: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number" min="1" placeholder="Min Qty" value={tier.minQty}
                          onChange={(e) => updatePricingTier(index, 'minQty', parseInt(e.target.value) || 0)}
                          className="input-crisp" style={{ width: 70, textAlign: 'center', fontSize: 12, padding: '4px 8px' }}
                        />
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>to</span>
                        <input
                          type="number" placeholder="Max Qty" value={tier.maxQty}
                          onChange={(e) => updatePricingTier(index, 'maxQty', parseInt(e.target.value) || 0)}
                          className="input-crisp" style={{ width: 80, textAlign: 'center', fontSize: 12, padding: '4px 8px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Rs.</span>
                        <input
                          type="number" placeholder="Price" value={tier.pricePerBox}
                          onChange={(e) => updatePricingTier(index, 'pricePerBox', parseInt(e.target.value) || 0)}
                          className="input-crisp" style={{ width: 90, fontSize: 12, padding: '4px 8px', fontWeight: 700, color: '#EA580C' }}
                        />
                      </div>
                      <button
                        type="button" onClick={() => removePricingTier(index)}
                        style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
                        title="Remove tier"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit" className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #0EA5E9, #6366F1)', marginTop: 8, fontSize: 12, border: 'none', color: '#white' }}
              >
                {editingBatch ? 'Save Batch Modifications' : 'Confirm Batch Ingestion'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PRINT BARCODE OPTIONS MENU MODAL */}
      {printingBatch && (
        <div className="modal-overlay no-print" onClick={() => setPrintingBatch(null)}>
          <div
            className="animate-scaleIn"
            style={{ background: 'rgba(255,255,255,0.98)', border: '1.5px solid #BAE6FD', borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 50px rgba(14,165,233,0.15)', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer style={{ width: 16, height: 16, color: '#0EA5E9' }} />
                Print Label Options
              </h3>
              <button onClick={() => setPrintingBatch(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setPrintPreviewBatch(printingBatch);
                  setPrintPreviewBatchCopies(1);
                  if (printingBatch.id) {
                    setManualBarcodeTexts(prev => ({ ...prev, [printingBatch.id]: printingBatch.batchNumber }));
                  }
                  setPrintingBatch(null);
                }}
                className="btn-primary" style={{ justifyContent: 'center', width: '100%', padding: 12, background: 'linear-gradient(135deg, #0EA5E9, #6366F1)', border: 'none', color: '#white' }}
              >
                Single Thermal Label
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const totalBoxes = Math.floor(printingBatch.availableBaseUnits / (printingBatch.product.tabletsPerStrip * printingBatch.product.stripsPerBox)) || 1;
                  setPrintPreviewBatch(printingBatch);
                  setPrintPreviewBatchCopies(totalBoxes);
                  if (printingBatch.id) {
                    setManualBarcodeTexts(prev => ({ ...prev, [printingBatch.id]: printingBatch.batchNumber }));
                  }
                  setPrintingBatch(null);
                }}
                className="btn-ghost" style={{ justifyContent: 'center', width: '100%', padding: 12 }}
              >
                Print All Copies ({Math.floor(printingBatch.availableBaseUnits / (printingBatch.product.tabletsPerStrip * printingBatch.product.stripsPerBox))} pcs)
              </button>

              <button
                type="button"
                onClick={() => {
                  printBatchSummarySheet(printingBatch);
                  setPrintingBatch(null);
                }}
                className="btn-ghost" style={{ justifyContent: 'center', width: '100%', padding: 12 }}
              >
                A4 Summary Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL (SINGLE BATCH OR COPIES) */}
      {printPreviewBatch && (
        <div className="modal-overlay no-print">
          <div
            className="animate-scaleIn"
            style={{
              background: 'rgba(255,255,255,0.98)',
              border: '1.5px solid #BAE6FD',
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 420,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(14,165,233,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Thermal Label Print Preview
              </h3>
              <button onClick={() => setPrintPreviewBatch(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Printable Area */}
            <div 
              id="print-area" 
              style={{ 
                background: 'white', 
                border: '1.5px solid #000', 
                padding: '16px', 
                borderRadius: 8, 
                color: 'black', 
                fontFamily: 'monospace',
                fontSize: 11,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              {Array.from({ length: printPreviewBatchCopies }).map((_, copyIndex) => (
                <div key={copyIndex} style={{ pageBreakAfter: copyIndex < printPreviewBatchCopies - 1 ? 'always' : 'avoid', padding: '10px 0', borderBottom: copyIndex < printPreviewBatchCopies - 1 ? '2px dashed #000' : 'none' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: 4, marginBottom: 8 }}>
                    MEDHUB PHARMACEUTICAL
                  </div>
                  <div><strong>MED:</strong> {printPreviewBatch.product.name}</div>
                  <div><strong>SKU:</strong> {printPreviewBatch.product.sku}</div>
                  <div><strong>BATCH:</strong> {printPreviewBatch.batchNumber}</div>
                  <div><strong>EXP:</strong> {new Date(printPreviewBatch.expiryDate).toLocaleDateString()}</div>
                  
                  {/* Barcode representation */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 40, background: 'white', padding: '4px 6px', border: '1px solid #000', borderRadius: 4, width: '100%' }}>
                      {[1,0,1,1,0,1,0,0,2,0,1,0,2,0,0,1,0,2,0,1,0,0,2,0,1,0,1,0,0,1,0,2,0,0,2,0,1,0,2,0,0,1,0,1,1,0,1,0,0].map((width, idx) => {
                        if (width === 0) return <div key={idx} style={{ width: 1.5, height: '100%', background: 'transparent' }} />;
                        return <div key={idx} style={{ width: width * 1.5, height: '100%', background: 'black' }} />;
                      })}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>
                      {manualBarcodeTexts[printPreviewBatch.id] || printPreviewBatch.batchNumber}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Manual input barcode number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="no-print">
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
                Barcode Text Override (Manual Input)
              </label>
              <input 
                type="text" 
                value={manualBarcodeTexts[printPreviewBatch.id] || printPreviewBatch.batchNumber} 
                onChange={e => setManualBarcodeTexts(prev => ({ ...prev, [printPreviewBatch.id]: e.target.value }))} 
                className="input-crisp" 
                style={{ fontSize: 12, padding: '8px 12px' }} 
              />
            </div>

            {/* Copies selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="no-print">
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
                Print Copies (Boxes Count)
              </label>
              <input 
                type="number" 
                min={1}
                value={printPreviewBatchCopies} 
                onChange={e => setPrintPreviewBatchCopies(Math.max(1, parseInt(e.target.value) || 1))} 
                className="input-crisp" 
                style={{ fontSize: 12, padding: '8px 12px' }} 
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #F1F5F9', paddingTop: 14 }} className="no-print">
              <button 
                onClick={() => {
                  // Build standalone print window instead of window.print() (which prints the full page)
                  const copies = printPreviewBatchCopies;
                  const batch = printPreviewBatch;
                  const barcodeText = manualBarcodeTexts[batch.id] || batch.batchNumber;
                  let pagesHtml = '';
                  for (let i = 0; i < Math.max(copies, 1); i++) {
                    pagesHtml += `
                      <div class="label-page">
                        <div class="header">MEDHUB PHARMACEUTICAL</div>
                        <div class="med">${batch.product.name}</div>
                        <div class="details"><span>SKU: ${batch.product.sku}</span><span>BATCH: ${batch.batchNumber}${copies > 1 ? ` (${i+1}/${copies})` : ''}</span></div>
                        <div class="barcode-text">${barcodeText}</div>
                        <div class="footer">EXPIRY: ${new Date(batch.expiryDate).toLocaleDateString()}</div>
                      </div>
                    `;
                  }
                  const printWindow = window.open('', '_blank', 'width=800,height=600');
                  if (!printWindow) return;
                  printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Label</title><style>
                    @page { margin: 20px; }
                    body { font-family: monospace; color: black; margin: 0; padding: 0; }
                    .label-page { page-break-after: always; padding: 16px; border: 2px solid #000; max-width: 300px; margin: 0 auto; }
                    .label-page:last-child { page-break-after: avoid; }
                    .header { font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
                    .med { font-size: 15px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; }
                    .details { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; }
                    .barcode-text { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; border: 1px solid #000; padding: 6px; margin: 6px 0; background: #fff; }
                    .footer { font-size: 10px; border-top: 1px solid #000; padding-top: 4px; text-align: center; }
                  </style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};<\/script></body></html>`);
                  printWindow.document.close();
                  logActivity('PRINT_THERMAL_BARCODE', `Printed barcode labels for batch: ${batch.batchNumber}`);
                }}
                className="btn-primary" 
                style={{ flex: 1, padding: '12px', justifyContent: 'center', background: 'linear-gradient(135deg, #0EA5E9, #6366F1)', border: 'none', color: '#white' }}
              >
                Print Label
              </button>
              <button 
                onClick={() => setPrintPreviewBatch(null)} 
                className="btn-ghost" 
                style={{ padding: '12px 18px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT BATCH-WISE LABELS MODAL (MULTI-MEDICINE PRINT) */}
      {printingBatchNumber !== null && (
        <div className="modal-overlay no-print">
          <div
            className="animate-scaleIn"
            style={{
              background: 'rgba(255,255,255,0.98)',
              border: '1.5px solid #BAE6FD',
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(14,165,233,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Print Labels By Batch Number
              </h3>
              <button onClick={() => setPrintingBatchNumber(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Select Batch */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Select Batch Number</label>
              <select 
                value={selectedBatchNumberToPrint} 
                onChange={e => setSelectedBatchNumberToPrint(e.target.value)} 
                className="select-crisp"
                style={{ width: '100%' }}
              >
                <option value="">-- Choose Batch --</option>
                {Array.from(new Set(batches.map(b => b.batchNumber))).filter(Boolean).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            {selectedBatchNumberToPrint && (
              <>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Medicines found in batch <strong>{selectedBatchNumberToPrint}</strong>:
                </div>
                
                {/* Print Preview Container */}
                <div 
                  id="print-area"
                  style={{
                    background: 'white',
                    border: '1.5px solid #000',
                    padding: '16px',
                    borderRadius: 8,
                    color: 'black',
                    fontFamily: 'monospace',
                    fontSize: 11
                  }}
                >
                  {batches.filter(b => b.batchNumber === selectedBatchNumberToPrint).map((b, idx, arr) => (
                    <div key={b.id} style={{ pageBreakAfter: idx < arr.length - 1 ? 'always' : 'avoid', padding: '10px 0', borderBottom: idx < arr.length - 1 ? '2px dashed #000' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: 4, marginBottom: 8 }}>
                        MEDHUB BATCH LABEL
                      </div>
                      <div><strong>MEDICINE:</strong> {b.product.name}</div>
                      <div><strong>SKU:</strong> {b.product.sku}</div>
                      <div><strong>BATCH NO:</strong> {b.batchNumber}</div>
                      <div><strong>EXPIRY:</strong> {new Date(b.expiryDate).toLocaleDateString()}</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 40, background: 'white', padding: '4px 6px', border: '1px solid #000', borderRadius: 4, width: '100%' }}>
                          {[1,0,1,1,0,1,0,0,2,0,1,0,2,0,0,1,0,2,0,1,0,0,2,0,1,0,1,0,0,1,0,2,0,0,2,0,1,0,2,0,0,1,0,1,1,0,1,0,0].map((width, idx) => {
                            if (width === 0) return <div key={idx} style={{ width: 1.5, height: '100%', background: 'transparent' }} />;
                            return <div key={idx} style={{ width: width * 1.5, height: '100%', background: 'black' }} />;
                          })}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>
                          {manualBarcodeTexts[b.id] || b.batchNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #F1F5F9', paddingTop: 14 }} className="no-print">
                  <button 
                    onClick={() => {
                      const batchNum = selectedBatchNumberToPrint;
                      const batchList = batches.filter(b => b.batchNumber === batchNum);
                      let pagesHtml = '';
                      batchList.forEach((b, idx) => {
                        const barcodeText = manualBarcodeTexts[b.id] || b.batchNumber;
                        pagesHtml += `
                          <div class="label-page">
                            <div class="header">MEDHUB BATCH LABEL</div>
                            <div class="med">${b.product.name}</div>
                            <div class="details"><span>SKU: ${b.product.sku}</span><span>BATCH: ${b.batchNumber}</span></div>
                            <div class="barcode-text">${barcodeText}</div>
                            <div class="footer">EXPIRY: ${new Date(b.expiryDate).toLocaleDateString()}</div>
                          </div>
                        `;
                      });
                      const printWindow = window.open('', '_blank', 'width=800,height=600');
                      if (!printWindow) return;
                      printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Labels</title><style>
                        @page { margin: 20px; }
                        body { font-family: monospace; color: black; margin: 0; padding: 0; }
                        .label-page { page-break-after: always; padding: 16px; border: 2px solid #000; max-width: 300px; margin: 0 auto; }
                        .label-page:last-child { page-break-after: avoid; }
                        .header { font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
                        .med { font-size: 15px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; }
                        .details { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; }
                        .barcode-text { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; border: 1px solid #000; padding: 6px; margin: 6px 0; background: #fff; }
                        .footer { font-size: 10px; border-top: 1px solid #000; padding-top: 4px; text-align: center; }
                      </style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};<\/script></body></html>`);
                      printWindow.document.close();
                      logActivity('PRINT_BATCH_LABEL_ALL', `Printed batch label sheets for all medicines of batch: ${batchNum}`);
                    }}
                    className="btn-primary" 
                    style={{ flex: 1, padding: '12px', justifyContent: 'center', background: 'linear-gradient(135deg, #F97316, #F59E0B)' }}
                  >
                    Print All Labels
                  </button>
                  <button 
                    onClick={() => setPrintingBatchNumber(null)} 
                    className="btn-ghost" 
                    style={{ padding: '12px 18px' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {pendingDeleteProduct && (
        <div className="modal-overlay" onClick={() => setPendingDeleteProduct(null)}>
          <div
            className="animate-scaleIn"
            style={{
              background: 'rgba(255,255,255,0.99)',
              border: '2px solid #FECDD3',
              borderRadius: 20,
              padding: 32,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 20px 60px rgba(239,68,68,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash style={{ width: 22, height: 22, color: '#EF4444' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#1E293B' }}>Delete Medicine?</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>This action is permanent and cannot be undone.</div>
              </div>
            </div>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
              You are about to permanently delete:
              <div style={{ marginTop: 6, fontWeight: 900, fontSize: 14, color: '#DC2626' }}>"{pendingDeleteProduct.name}"</div>
              <div style={{ marginTop: 4, fontSize: 11, color: '#B91C1C' }}>All associated stock batches will also be deleted.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleDeleteProduct(pendingDeleteProduct.id, pendingDeleteProduct.name)}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}
              >
                <Trash style={{ width: 15, height: 15 }} /> Yes, Delete Permanently
              </button>
              <button
                onClick={() => setPendingDeleteProduct(null)}
                className="btn-ghost"
                style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE BATCH CONFIRMATION MODAL */}
      {pendingDeleteBatch && (
        <div className="modal-overlay" onClick={() => setPendingDeleteBatch(null)}>
          <div
            className="animate-scaleIn"
            style={{
              background: 'rgba(255,255,255,0.99)',
              border: '2px solid #FECDD3',
              borderRadius: 20,
              padding: 32,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 20px 60px rgba(239,68,68,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash style={{ width: 22, height: 22, color: '#EF4444' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#1E293B' }}>Delete Stock Batch?</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>This action is permanent and cannot be undone.</div>
              </div>
            </div>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
              You are about to permanently delete:
              <div style={{ marginTop: 6, fontWeight: 900, fontSize: 14, color: '#DC2626' }}>Batch "{pendingDeleteBatch.batchNumber}"</div>
              <div style={{ marginTop: 2, fontSize: 11, color: '#B91C1C' }}>Medicine: {pendingDeleteBatch.productName}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleDeleteBatch(pendingDeleteBatch.id, pendingDeleteBatch.batchNumber)}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}
              >
                <Trash style={{ width: 15, height: 15 }} /> Yes, Delete Batch
              </button>
              <button
                onClick={() => setPendingDeleteBatch(null)}
                className="btn-ghost"
                style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* QUICK ADD SUPPLIER INLINE MODAL */}
      {showQuickSupplierModal && (
        <div className="modal-overlay" style={{ zIndex: 110 }} onClick={() => setShowQuickSupplierModal(false)}>
          <div
            className="modal-card animate-scaleIn"
            style={{ '--modal-max-width': '420px', padding: 24 } as React.CSSProperties}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase' }}>Quick Add Supplier</h3>
              <button onClick={() => setShowQuickSupplierModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!quickSupName) return;
                setQuickSupLoading(true);
                try {
                  const res = await fetch('/api/wholesaler/suppliers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: quickSupName,
                      contactPerson: quickSupContact || undefined,
                      phone: quickSupPhone || undefined,
                      email: quickSupEmail || undefined,
                      address: quickSupAddress || undefined
                    })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed to add supplier');
                  setSuppliers(prev => [...prev, data.supplier]);
                  setSelectedSupplierId(data.supplier.id);
                  setSupplierName(data.supplier.name);

                  // Reset form fields
                  setQuickSupName('');
                  setQuickSupContact('');
                  setQuickSupPhone('');
                  setQuickSupEmail('');
                  setQuickSupAddress('');
                  setShowQuickSupplierModal(false);
                } catch (err: any) {
                  alert(err.message || 'Error creating supplier');
                } finally {
                  setQuickSupLoading(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Supplier Name *</label>
                <input
                  type="text" required value={quickSupName} onChange={e => setQuickSupName(e.target.value)}
                  className="input-crisp" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Contact Person</label>
                <input
                  type="text" value={quickSupContact} onChange={e => setQuickSupContact(e.target.value)}
                  className="input-crisp" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Phone</label>
                  <input
                    type="text" value={quickSupPhone} onChange={e => setQuickSupPhone(e.target.value)}
                    className="input-crisp" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Email</label>
                  <input
                    type="email" value={quickSupEmail} onChange={e => setQuickSupEmail(e.target.value)}
                    className="input-crisp" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Address</label>
                <input
                  type="text" value={quickSupAddress} onChange={e => setQuickSupAddress(e.target.value)}
                  className="input-crisp" style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button type="submit" disabled={quickSupLoading} className="btn-primary" style={{ flex: 1, padding: '10px', justifyContent: 'center' }}>
                  {quickSupLoading ? 'Saving...' : 'Add Supplier'}
                </button>
                <button type="button" onClick={() => setShowQuickSupplierModal(false)} className="btn-ghost" style={{ padding: '10px 14px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
