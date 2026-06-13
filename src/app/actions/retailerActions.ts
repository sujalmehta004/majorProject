'use server';

import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { OrderStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { broadcastToRetailer, broadcastToWholesaler } from '@/app/api/events/route';

/**
 * Helper to assert session user is a Retailer or Retailer Staff
 */
async function assertRetailer() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
    throw new Error('Unauthorized');
  }

  // Find retailer profile
  let retailer = null;
  if (user.role === 'RETAILER') {
    retailer = await db.retailerProfile.findUnique({
      where: { userId: user.userId },
    });
  } else {
    const dbUser = await db.user.findUnique({
      where: { id: user.userId },
    });
    if (dbUser && dbUser.retailerId) {
      retailer = await db.retailerProfile.findUnique({
        where: { id: dbUser.retailerId },
      });
    }
  }

  if (!retailer) {
    throw new Error('Retailer profile not found');
  }

  return { user, retailer };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INVENTORY ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function ingestInventoryBatchAction(data: {
  productId?: string; // If selecting existing product
  name?: string;
  sku?: string;
  category?: string;
  tabletsPerStrip?: number;
  stripsPerBox?: number;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
}) {
  const { user, retailer } = await assertRetailer();

  let productId = data.productId;

  // If creating a new product catalog node
  if (!productId) {
    if (!data.name || !data.sku) {
      throw new Error('Product name and SKU are required for new entries.');
    }

    // Check SKU uniqueness for this retailer
    const existing = await db.product.findFirst({
      where: {
        retailerId: retailer.id,
        sku: data.sku,
      },
    });

    if (existing) {
      throw new Error(`Product SKU "${data.sku}" already exists in your inventory.`);
    }

    const prod = await db.product.create({
      data: {
        retailerId: retailer.id,
        name: data.name,
        sku: data.sku,
        category: data.category || 'Uncategorized',
        tabletsPerStrip: data.tabletsPerStrip || 10,
        stripsPerBox: data.stripsPerBox || 10,
      },
    });
    productId = prod.id;
  }

  const qty = parseInt(String(data.quantity));
  const expDate = new Date(data.expiryDate);

  const inventoryItem = await db.retailerInventory.upsert({
    where: {
      retailerId_productId_batchNumber: {
        retailerId: retailer.id,
        productId: productId!,
        batchNumber: data.batchNumber,
      },
    },
    update: {
      quantity: {
        increment: qty,
      },
      expiryDate: expDate,
    },
    create: {
      retailerId: retailer.id,
      productId: productId!,
      batchNumber: data.batchNumber,
      quantity: qty,
      expiryDate: expDate,
    },
    include: {
      product: true,
    },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'RETAIL_INVENTORY_ADD',
      userId: user.userId,
      details: `Manual intake: Product ${inventoryItem.product.name}, Batch ${data.batchNumber}, Qty ${qty}`,
    },
  });

  broadcastToRetailer(retailer.id, 'INVENTORY_UPDATE');

  return { success: true, inventoryItem };
}

export async function updateInventoryQuantityAction(id: string, quantity: number, buyingPrice?: number, sellingPrice?: number) {
  const { user, retailer } = await assertRetailer();

  const item = await db.retailerInventory.update({
    where: { id },
    data: {
      quantity: parseInt(String(quantity)),
      ...(buyingPrice !== undefined ? { buyingPrice: parseFloat(String(buyingPrice)) } : {}),
      ...(sellingPrice !== undefined ? { sellingPrice: parseFloat(String(sellingPrice)) } : {}),
    },
    include: {
      product: true,
    },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'RETAIL_INVENTORY_UPDATE',
      userId: user.userId,
      details: `Updated inventory: Product ${item.product.name}, Batch ${item.batchNumber}, Qty ${item.quantity}, Buying Rs. ${item.buyingPrice}, Selling Rs. ${item.sellingPrice}`,
    },
  });

  broadcastToRetailer(retailer.id, 'INVENTORY_UPDATE');

  return { success: true, item };
}

export async function deleteInventoryBatchAction(id: string) {
  const { user, retailer } = await assertRetailer();

  const item = await db.retailerInventory.delete({
    where: { id },
    include: { product: true },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'RETAIL_INVENTORY_DELETE',
      userId: user.userId,
      details: `Deleted inventory batch: Product ${item.product.name}, Batch ${item.batchNumber}`,
    },
  });

  broadcastToRetailer(retailer.id, 'INVENTORY_UPDATE');

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CUSTOM SUPPLIER ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createCustomSupplierAction(data: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const { user, retailer } = await assertRetailer();

  if (!data.name) throw new Error('Supplier name is required');

  const supplier = await db.supplier.create({
    data: {
      retailerId: retailer.id,
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'CREATE_CUSTOM_SUPPLIER',
      userId: user.userId,
      details: `Created custom supplier: ${data.name}`,
    },
  });

  return { success: true, supplier };
}

export async function updateCustomSupplierAction(id: string, data: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const { user } = await assertRetailer();

  const supplier = await db.supplier.update({
    where: { id },
    data: {
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'UPDATE_CUSTOM_SUPPLIER',
      userId: user.userId,
      details: `Updated custom supplier: ${data.name}`,
    },
  });

  return { success: true, supplier };
}

export async function deleteCustomSupplierAction(id: string) {
  const { user } = await assertRetailer();

  const supplier = await db.supplier.delete({
    where: { id },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'DELETE_CUSTOM_SUPPLIER',
      userId: user.userId,
      details: `Deleted custom supplier: ${supplier.name}`,
    },
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. POS counter Counter Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function createPOSSaleAction(data: {
  items: Array<{ productId: string; qty: number; packaging: 'box' | 'strip' | 'tablet' }>;
  customerName?: string;
  customerPhone?: string;
  paidAmount: number;
  paymentMethod: string;
  discountAmount?: number;
  taxAmount?: number;
}) {
  const { user, retailer } = await assertRetailer();

  if (!data.items || !data.items.length) {
    throw new Error('No items in basket');
  }

  // Link POS order to the linked wholesaler or first existing wholesaler
  let wholesalerId = retailer.wholesalerId;
  if (!wholesalerId) {
    const firstWholesaler = await db.wholesalerProfile.findFirst();
    if (!firstWholesaler) {
      throw new Error('No wholesalers exist in database to link POS order');
    }
    wholesalerId = firstWholesaler.id;
  }

  let totalAmount = 0;
  const computedItems: any[] = [];

  for (const item of data.items) {
    const product = await db.product.findUnique({
      where: { id: item.productId },
    });

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const tabletsPerBox = product.tabletsPerStrip * product.stripsPerBox;
    let baseUnitsNeeded = 0;

    if (item.packaging === 'box') {
      baseUnitsNeeded = item.qty * tabletsPerBox;
    } else if (item.packaging === 'strip') {
      baseUnitsNeeded = item.qty * product.tabletsPerStrip;
    } else {
      baseUnitsNeeded = item.qty;
    }

    // Retrieve active retail inventories
    const retailStocks = await db.retailerInventory.findMany({
      where: {
        retailerId: retailer.id,
        productId: product.id,
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const totalAvailable = retailStocks.reduce((sum, s) => sum + s.quantity, 0);
    if (totalAvailable < baseUnitsNeeded) {
      throw new Error(`Insufficient stock for Product ${product.name}. Available: ${totalAvailable} units, Requested: ${baseUnitsNeeded} units.`);
    }

    let pricePerBox = 0;
    const stockWithPrice = retailStocks.find((s) => s.sellingPrice && s.sellingPrice > 0);
    if (stockWithPrice) {
      pricePerBox = stockWithPrice.sellingPrice;
    } else {
      try {
        const tiers = JSON.parse(product.tierPricingJson || '[]');
        if (tiers.length > 0) {
          pricePerBox = tiers[0].pricePerBox;
        }
      } catch (e) {}
    }
    if (pricePerBox <= 0) {
      pricePerBox = 100;
    }

    const pricePerBaseUnit = pricePerBox / tabletsPerBox;
    const itemSubtotal = baseUnitsNeeded * pricePerBaseUnit;
    totalAmount += itemSubtotal;

    computedItems.push({
      productId: product.id,
      quantity: baseUnitsNeeded,
      pricePerUnit: pricePerBaseUnit,
      productName: product.name,
      retailStocks,
    });
  }

  const discountAmount = data.discountAmount || 0;
  const taxAmount = data.taxAmount || 0;
  const netAmount = totalAmount - discountAmount + taxAmount;
  const dueAmount = Math.max(netAmount - data.paidAmount, 0);

  const customerDetails = `B2C POS: ${data.customerName || 'Walk-in'}, Phone: ${data.customerPhone || 'N/A'} | Paid: Rs.${data.paidAmount.toFixed(2)} | Method: ${data.paymentMethod || 'CASH'} | Due: Rs.${dueAmount.toFixed(2)}`;

  // Run transaction
  const completedOrder = await db.$transaction(async (tx) => {
    // 1. Create order
    const order = await tx.order.create({
      data: {
        wholesalerId: wholesalerId!,
        retailerId: retailer.id,
        status: OrderStatus.DELIVERED,
        totalAmount,
        discountAmount,
        netAmount,
        overrideJustification: customerDetails,
      },
    });

    // 2. Decrement RetailerInventory and create items
    for (const item of computedItems) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
        },
      });

      let remaining = item.quantity;
      for (const stock of item.retailStocks) {
        if (remaining <= 0) break;
        const toTake = Math.min(stock.quantity, remaining);

        await tx.retailerInventory.update({
          where: { id: stock.id },
          data: {
            quantity: {
              decrement: toTake,
            },
          },
        });

        remaining -= toTake;
      }
    }

    return order;
  });

  await db.systemAuditLog.create({
    data: {
      action: 'B2C_POS_SALE',
      userId: user.userId,
      details: `Processed POS B2C Sale. Total: Rs. ${netAmount.toFixed(2)}. customer: ${data.customerName || 'Walk-in'}`,
    },
  });

  return { success: true, order: completedOrder, paidAmount: data.paidAmount, dueAmount };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. B2B DELIVERY CONFIRMATION (BARCODE RESOLVING)
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmB2BDeliveryAction(
  barcode: string,
  customPrices?: { productId: string; buyingPrice: number; sellingPrice: number }[],
  settleNow?: boolean,
  settleAmount?: number,
  settleMethod?: string
) {
  const { user, retailer } = await assertRetailer();

  if (!barcode) {
    throw new Error('Barcode is required');
  }

  // Strip prefix "ORD-" if present
  let orderIdToSearch = barcode.trim();
  if (orderIdToSearch.toUpperCase().startsWith('ORD-')) {
    orderIdToSearch = orderIdToSearch.substring(4);
  }

  // Find the order
  const order = await db.order.findFirst({
    where: {
      retailerId: retailer.id,
      OR: [
        { id: { equals: orderIdToSearch, mode: 'insensitive' } },
        { id: { startsWith: orderIdToSearch, mode: 'insensitive' } },
        { id: { contains: orderIdToSearch, mode: 'insensitive' } },
      ],
    },
    include: {
      inTransitLogs: {
        include: {
          batch: true,
        },
      },
      wholesaler: true,
    },
  });

  if (!order) {
    throw new Error(`No matching pending/dispatched order found for barcode: ${barcode}`);
  }

  if (order.status !== OrderStatus.DISPATCHED) {
    throw new Error(`Order status is ${order.status}. It must be DISPATCHED to confirm delivery.`);
  }

  const confirmedOrder = await db.$transaction(async (tx) => {
    // 1. Update order status
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.DELIVERED,
        ...(settleNow
          ? {
              settleStatus: 'PENDING_VERIFICATION',
              settleAmount: settleAmount || order.netAmount,
              settleMethod: settleMethod || 'CASH',
            }
          : {}),
      },
    });

    // 2. Map transit logs to RetailerInventory
    for (const transit of order.inTransitLogs) {
      const customPrice = customPrices?.find((cp) => cp.productId === transit.productId);
      const wholesalerPricePerBox = transit.batch.sellingPricePerBox || 100;
      const buyingPrice = customPrice ? customPrice.buyingPrice : wholesalerPricePerBox;
      const sellingPrice = customPrice ? customPrice.sellingPrice : wholesalerPricePerBox * 1.25;

      await tx.retailerInventory.upsert({
        where: {
          retailerId_productId_batchNumber: {
            retailerId: retailer.id,
            productId: transit.productId,
            batchNumber: transit.batch.batchNumber,
          },
        },
        update: {
          quantity: {
            increment: transit.quantity,
          },
          buyingPrice,
          sellingPrice,
          expiryDate: transit.batch.expiryDate,
        },
        create: {
          retailerId: retailer.id,
          productId: transit.productId,
          batchNumber: transit.batch.batchNumber,
          quantity: transit.quantity,
          expiryDate: transit.batch.expiryDate,
          buyingPrice,
          sellingPrice,
        },
      });
    }

    // 3. Delete transit logs
    await tx.inTransitLog.deleteMany({
      where: { orderId: order.id },
    });

    // 4. Record audit log
    await tx.systemAuditLog.create({
      data: {
        action: 'RETAIL_DELIVERY_CONFIRM_BARCODE',
        userId: user.userId,
        details: `Confirmed delivery via barcode search for Order ${order.id}. Wholesaler: ${order.wholesaler.companyName}`,
      },
    });

    // 5. Fetch full order
    const full = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        wholesaler: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return full;
  });

  broadcastToRetailer(retailer.id, 'INVENTORY_UPDATE');
  broadcastToRetailer(retailer.id, 'ORDER_UPDATE');
  broadcastToRetailer(retailer.id, 'BILLING_UPDATE');
  if (confirmedOrder?.wholesalerId) {
    broadcastToWholesaler(confirmedOrder.wholesalerId, 'ORDER_UPDATE');
    broadcastToWholesaler(confirmedOrder.wholesalerId, 'BILLING_UPDATE');
  }

  return { success: true, order: confirmedOrder };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STAFF CRUD ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createRetailStaffAction(data: {
  email: string;
  passwordHash: string;
  fullName: string;
  allowedFeatures: string;
}) {
  const { user, retailer } = await assertRetailer();

  // Validate email
  const existing = await db.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new Error('Email is already registered');
  }

  const passHash = await bcrypt.hash(data.passwordHash, 10);

  const staffUser = await db.user.create({
    data: {
      email: data.email,
      passwordHash: passHash,
      role: Role.RETAILER_STAFF,
      fullName: data.fullName,
      allowedFeatures: data.allowedFeatures,
      retailerId: retailer.id,
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year subscription for staff
      plainPassword: data.passwordHash,
    },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'CREATE_RETAIL_STAFF',
      userId: user.userId,
      details: `Created shop employee account: ${data.fullName} (${data.email})`,
    },
  });

  return { success: true, staff: staffUser };
}

export async function updateRetailStaffAction(id: string, data: {
  fullName?: string;
  allowedFeatures?: string;
  passwordHash?: string;
  isActive?: boolean;
}) {
  const { user } = await assertRetailer();

  const updatePayload: any = {
    fullName: data.fullName,
    allowedFeatures: data.allowedFeatures,
    isActive: data.isActive,
  };

  if (data.passwordHash) {
    updatePayload.passwordHash = await bcrypt.hash(data.passwordHash, 10);
    updatePayload.plainPassword = data.passwordHash;
  }

  const staffUser = await db.user.update({
    where: { id },
    data: updatePayload,
  });

  await db.systemAuditLog.create({
    data: {
      action: 'UPDATE_RETAIL_STAFF',
      userId: user.userId,
      details: `Updated shop employee account: ${staffUser.fullName} (${staffUser.email})`,
    },
  });

  return { success: true, staff: staffUser };
}

export async function deleteRetailStaffAction(id: string) {
  const { user } = await assertRetailer();

  const staffUser = await db.user.delete({
    where: { id },
  });

  await db.systemAuditLog.create({
    data: {
      action: 'DELETE_RETAIL_STAFF',
      userId: user.userId,
      details: `Deleted shop employee account: ${staffUser.fullName} (${staffUser.email})`,
    },
  });

  return { success: true };
}

export async function settleB2CDueAction(orderId: string, settleAmount: number) {
  const { retailer } = await assertRetailer();

  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order || order.retailerId !== retailer.id) {
    throw new Error('Order not found');
  }

  // Parse current overrideJustification
  let justification = order.overrideJustification || '';
  const dueMatch = justification.match(/Due:\s*Rs\.\s*([\d.]+)/);
  const paidMatch = justification.match(/Paid:\s*Rs\.\s*([\d.]+)/);

  if (dueMatch) {
    const currentDue = parseFloat(dueMatch[1]);
    const currentPaid = paidMatch ? parseFloat(paidMatch[1]) : 0;
    const newPaid = currentPaid + settleAmount;
    const newDue = Math.max(currentDue - settleAmount, 0);

    // Reconstruct justification
    justification = justification
      .replace(/Paid:\s*Rs\.\s*[\d.]+/, `Paid: Rs.${newPaid.toFixed(2)}`)
      .replace(/Due:\s*Rs\.\s*[\d.]+/, `Due: Rs.${newDue.toFixed(2)}`);

    if (newDue === 0) {
      justification += ` | Settled: Rs.${settleAmount.toFixed(2)} on ${new Date().toLocaleDateString()}`;
    }
  }

  const updatedOrder = await db.order.update({
    where: { id: orderId },
    data: {
      overrideJustification: justification,
      settleStatus: 'VERIFIED',
      settleAmount: order.settleAmount + settleAmount,
    },
  });

  // Log in systemAuditLog
  await db.systemAuditLog.create({
    data: {
      action: 'B2C_POS_SETTLEMENT',
      userId: (await getSessionUser())?.userId || '',
      details: `Settle B2C POS due for order #${orderId.substring(0, 8).toUpperCase()}. Paid Rs. ${settleAmount.toFixed(2)}.`,
    },
  });

  // Broadcast event
  broadcastToRetailer(retailer.id, 'BILLING_UPDATE');

  return { success: true, order: updatedOrder };
}

