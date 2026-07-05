'use server';

import { db } from '@/lib/db';
import { sendConsumerOrderConfirmation, sendConsumerOrderStatusUpdate } from '@/lib/mailer';
import { createLedgerEntry } from '@/lib/ledger';

function generateTrackingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MH-${code}`;
}

/** Compute delivery fee from retailer's tier settings based on km distance */
function computeDeliveryFee(deliveryFeesJson: string, distanceKm: number): number {
  try {
    const tiers: { maxKm: number; fee: number }[] = JSON.parse(deliveryFeesJson || '[]');
    if (!tiers || tiers.length === 0) return 0;
    // Sort ascending by maxKm
    const sorted = [...tiers].sort((a, b) => a.maxKm - b.maxKm);
    for (const tier of sorted) {
      if (distanceKm <= tier.maxKm) {
        return tier.fee;
      }
    }
    // Beyond all tiers — use the last tier's fee
    return sorted[sorted.length - 1].fee;
  } catch {
    return 0;
  }
}

/** Haversine formula to calculate distance in km */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function fetchRetailersWithDistanceAction(buyerLat: number, buyerLng: number) {
  try {
    const retailers = await db.retailerProfile.findMany({
      select: {
        id: true,
        pharmacyName: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
        deliveryFeesJson: true,
      }
    });

    const mapped = retailers
      .filter(r => r.latitude && r.longitude && !r.pharmacyName.toLowerCase().includes('walk-in'))
      .map((r) => {
        const distance = calculateDistance(buyerLat, buyerLng, r.latitude, r.longitude);
        const deliveryFee = computeDeliveryFee(r.deliveryFeesJson || '[]', distance);
        return {
          ...r,
          distance: parseFloat(distance.toFixed(2)),
          deliveryFee,
        };
      });

    mapped.sort((a, b) => a.distance - b.distance);
    return { success: true, retailers: mapped };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function searchMedicinesExpandedAction(query: string, buyerLat: number, buyerLng: number) {
  try {
    const { success, retailers, error } = await fetchRetailersWithDistanceAction(buyerLat, buyerLng);
    if (!success || !retailers) {
      throw new Error(error || 'Failed to fetch retailers');
    }

    const normalizedQuery = query.trim().toLowerCase();

    const searchInRetailers = async (retailerIds: string[]) => {
      return db.retailerInventory.findMany({
        where: {
          retailerId: { in: retailerIds },
          quantity: { gt: 0 },
          expiryDate: { gt: new Date() },
          product: {
            OR: [
              { name: { contains: normalizedQuery, mode: 'insensitive' } },
              { sku: { contains: normalizedQuery, mode: 'insensitive' } },
              { category: { contains: normalizedQuery, mode: 'insensitive' } }
            ]
          }
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: true,
              tabletsPerStrip: true,
              stripsPerBox: true,
            }
          },
          retailer: true,
        },
      });
    };

    // Level 1: Search nearest 10 pharmacies
    const nearest10Ids = retailers.slice(0, 10).map(r => r.id);
    let results = await searchInRetailers(nearest10Ids);

    // Level 2: Search next 30 pharmacies if no results found
    if (results.length === 0 && retailers.length > 10) {
      const next30Ids = retailers.slice(10, 40).map(r => r.id);
      results = await searchInRetailers(next30Ids);
    }

    // Level 3: Search all remaining pharmacies if still no results found
    if (results.length === 0 && retailers.length > 40) {
      const allOtherIds = retailers.slice(40).map(r => r.id);
      results = await searchInRetailers(allOtherIds);
    }

    // Map distances and delivery fees back to results
    const resultsWithDistance = results.map(item => {
      const retailer = retailers.find(r => r.id === item.retailerId);
      const distance = retailer?.distance || 0;
      const deliveryFee = retailer?.deliveryFee || 0;
      const deliveryFeesJson = retailer?.deliveryFeesJson || '[]';
      return {
        ...item,
        distance,
        deliveryFee,
        deliveryFeesJson,
      };
    });

    resultsWithDistance.sort((a, b) => a.distance - b.distance);

    return { success: true, results: resultsWithDistance };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function placeConsumerOrderAction(data: {
  retailerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  deliveryAddress: string;
  latitude?: number;
  longitude?: number;
  deliveryFee?: number;
  items: { productId: string; quantity: number; pricePerUnit: number }[];
}) {
  try {
    const trackingCode = generateTrackingCode();

    // Calculate total from provided prices (no inventory deduction at order placement)
    let totalAmount = 0;
    for (const item of data.items) {
      totalAmount += item.quantity * item.pricePerUnit;
    }

    const deliveryFee = data.deliveryFee || 0;
    const grandTotal = totalAmount + deliveryFee;

    // Validate that inventory is sufficient before placing
    for (const item of data.items) {
      const inventoryItems = await db.retailerInventory.findMany({
        where: {
          retailerId: data.retailerId,
          productId: item.productId,
          quantity: { gt: 0 },
          expiryDate: { gt: new Date() },
        },
      });
      const totalAvailable = inventoryItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
      if (totalAvailable < item.quantity) {
        throw new Error(`Insufficient stock for one or more items. Please refresh and try again.`);
      }
    }

    const order = await db.consumerOrder.create({
      data: {
        trackingCode,
        retailerId: data.retailerId,
        buyerName: data.buyerName,
        buyerEmail: data.buyerEmail,
        buyerPhone: data.buyerPhone,
        deliveryAddress: data.deliveryAddress,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        paymentMethod: 'COD',
        status: 'PENDING',
        totalAmount: grandTotal,
        deliveryFee,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
          })),
        },
      },
      include: {
        retailer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Send confirmation email
    try {
      await sendConsumerOrderConfirmation(order.buyerEmail, order);
    } catch (e) {
      console.error('Failed to send confirmation email:', e);
    }

    return { success: true, order };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function trackConsumerOrderAction(code: string) {
  try {
    const trackingCode = code.trim().toUpperCase();
    const order = await db.consumerOrder.findUnique({
      where: { trackingCode },
      include: {
        retailer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: 'No order found with this tracking code.' };
    }

    return { success: true, order };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function cancelConsumerOrderAction(trackingCode: string) {
  try {
    // Only PENDING orders can be cancelled (inventory was not deducted yet)
    const existing = await db.consumerOrder.findUnique({
      where: { trackingCode },
      include: { retailer: true, items: true },
    });

    if (!existing) throw new Error('Order not found');
    if (existing.status !== 'PENDING') {
      throw new Error('Order cannot be cancelled. It is already ' + existing.status + '. Contact the pharmacy directly.');
    }

    const order = await db.consumerOrder.update({
      where: { trackingCode },
      data: { status: 'FAILED' },
      include: { retailer: true },
    });

    try {
      await sendConsumerOrderStatusUpdate(order.buyerEmail, order, 'FAILED');
    } catch (e) {
      console.error(e);
    }

    return { success: true, order };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateConsumerOrderStatusAction(orderId: string, status: string) {
  try {
    const order = await db.$transaction(async (tx) => {
      const existing = await tx.consumerOrder.findUnique({
        where: { id: orderId },
        include: {
          retailer: true,
          items: true,
        },
      });

      if (!existing) throw new Error('Order not found');

      // SHIPPED: Deduct inventory (FIFO)
      if (status === 'SHIPPED' && existing.status === 'PENDING') {
        for (const item of existing.items) {
          const inventoryItems = await tx.retailerInventory.findMany({
            where: {
              retailerId: existing.retailerId,
              productId: item.productId,
              quantity: { gt: 0 },
              expiryDate: { gt: new Date() },
            },
            orderBy: { expiryDate: 'asc' }, // FIFO: prioritize nearest expiry
          });

          const totalAvailable = inventoryItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
          if (totalAvailable < item.quantity) {
            throw new Error(`Insufficient inventory for item. Cannot ship order.`);
          }

          let remainingToDeduct = item.quantity;
          for (const batch of inventoryItems) {
            if (remainingToDeduct <= 0) break;
            if (batch.quantity >= remainingToDeduct) {
              await tx.retailerInventory.update({
                where: { id: batch.id },
                data: { quantity: batch.quantity - remainingToDeduct },
              });
              remainingToDeduct = 0;
            } else {
              remainingToDeduct -= batch.quantity;
              await tx.retailerInventory.update({
                where: { id: batch.id },
                data: { quantity: 0 },
              });
            }
          }
        }
      }

      // FAILED: Restore inventory ONLY if it was already SHIPPED (deducted)
      if (status === 'FAILED' && existing.status === 'SHIPPED') {
        for (const item of existing.items) {
          const latestBatch = await tx.retailerInventory.findFirst({
            where: {
              retailerId: existing.retailerId,
              productId: item.productId,
            },
            orderBy: { expiryDate: 'desc' },
          });

          if (latestBatch) {
            await tx.retailerInventory.update({
              where: { id: latestBatch.id },
              data: { quantity: latestBatch.quantity + item.quantity },
            });
          } else {
            await tx.retailerInventory.create({
              data: {
                retailerId: existing.retailerId,
                productId: item.productId,
                batchNumber: 'RESTORED-FAIL',
                quantity: item.quantity,
                expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                sellingPrice: item.pricePerUnit,
                buyingPrice: item.pricePerUnit * 0.8,
              },
            });
          }
        }
      }

      // DELIVERED: Record ledger/billing sale entry
      if (status === 'DELIVERED' && existing.status !== 'DELIVERED') {
        await createLedgerEntry(tx, {
          partyType: 'RETAILER',
          partyId: existing.retailerId,
          oppositePartyName: `Online Customer: ${existing.buyerName}`,
          type: 'SALE',
          credit: existing.totalAmount,
          description: `Online B2C Sale - Tracker Code: ${existing.trackingCode}`,
          orderId: existing.id,
        });
      }

      const updated = await tx.consumerOrder.update({
        where: { id: orderId },
        data: { status },
        include: {
          retailer: true,
        },
      });

      return updated;
    });

    try {
      await sendConsumerOrderStatusUpdate(order.buyerEmail, order, status);
    } catch (e) {
      console.error(e);
    }

    return { success: true, order };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Save delivery fee tier settings for a retailer */
export async function saveDeliveryFeeSettingsAction(retailerId: string, feesJson: string) {
  try {
    await db.retailerProfile.update({
      where: { id: retailerId },
      data: { deliveryFeesJson: feesJson },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Get delivery fee settings for a retailer */
export async function getDeliveryFeeSettingsAction(retailerId: string) {
  try {
    const profile = await db.retailerProfile.findUnique({
      where: { id: retailerId },
      select: { deliveryFeesJson: true },
    });
    return { success: true, deliveryFeesJson: profile?.deliveryFeesJson || '[]' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
