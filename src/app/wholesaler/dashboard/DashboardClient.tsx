"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Database,
  ShieldAlert,
  ArrowRight,
  Activity,
  Receipt,
  Settings,
  CheckSquare,
  Square,
  AlertTriangle,
  Users,
  CreditCard,
  CheckCircle2,
  XCircle,
  MapPin,
  Truck,
  LayoutDashboard,
  TrendingUp,
  Zap,
  Clock,
  Bell,
  X,
  ArrowUpRight,
  DollarSign,
  ShoppingCart,
  BarChart2,
} from "lucide-react";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  user: {
    email: string;
    fullName?: string | null;
  } | null;
}

interface DashboardClientProps {
  profileId: string;
  metrics: {
    productCount: number;
    activeBatches: number;
    pendingOrders: number;
    dispatchedOrders: number;
    nearExpiryCount: number;
    totalRevenue: number;
    estimatedProfit: number;
    staffCount: number;
    latitude: number | null;
    longitude: number | null;
    companyName: string;
  };
  auditLogs: AuditLog[];
  pendingSettlements?: any[];
  rejectedSettlements?: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
      }}>
        <p style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: Rs. {p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardClient({
  profileId,
  metrics,
  auditLogs,
  pendingSettlements = [],
  rejectedSettlements = [],
}: DashboardClientProps) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [lowStockBoxes, setLowStockBoxes] = useState(10);
  const [lowStockStrips, setLowStockStrips] = useState(0);
  const [lowStockTablets, setLowStockTablets] = useState(0);
  const [expiryDays, setExpiryDays] = useState(30);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedBoxes = localStorage.getItem("medhub_low_stock_threshold_boxes");
      const storedStrips = localStorage.getItem("medhub_low_stock_threshold_strips");
      const storedTablets = localStorage.getItem("medhub_low_stock_threshold_tablets");
      if (storedBoxes) setLowStockBoxes(parseInt(storedBoxes, 10));
      if (storedStrips) setLowStockStrips(parseInt(storedStrips, 10));
      if (storedTablets) setLowStockTablets(parseInt(storedTablets, 10));
      const storedExpiry = localStorage.getItem("medhub_expiry_alert_days");
      if (storedExpiry) setExpiryDays(parseInt(storedExpiry, 10));
    }
  }, []);

  const handleVerifySettlement = async (orderId: string, approve: boolean) => {
    try {
      const res = await fetch('/api/wholesaler/verify-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, approve }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(approve ? 'Settlement verified and approved!' : 'Settlement request rejected.');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to verify settlement');
      }
    } catch (e) {
      alert('Error verifying settlement');
    }
  };

  const { data: analyticsData } = useRealtimeData<{
    chartData: Array<{ label: string; revenue: number; profit: number; orders: number }>;
    period: string;
    totalOrders: number;
    allProductStocks: Array<{ id: string; name: string; sku: string; units: number; stripsPerBox?: number; tabletsPerStrip?: number }>;
  }>(`/api/wholesaler/analytics?period=${period}&wholesalerId=${profileId}`, profileId);

  const { data: batchesResponse } = useRealtimeData<{
    success: boolean;
    batches: Array<{ id: string; batchNumber: string; availableBaseUnits: number; expiryDate: string; product: { name: string; sku: string } }>;
  }>(`/api/wholesaler/batches`, profileId);

  const lowStockItems = analyticsData?.allProductStocks?.filter((item) => {
    const spb = item.stripsPerBox || 10;
    const tps = item.tabletsPerStrip || 10;
    const totalThresholdUnits = (lowStockBoxes * spb * tps) + (lowStockStrips * tps) + lowStockTablets;
    return item.units < totalThresholdUnits;
  }) || [];

  const expiringBatches = batchesResponse?.batches?.filter((batch) => {
    if (batch.availableBaseUnits <= 0) return false;
    const expiry = new Date(batch.expiryDate);
    const diffTime = expiry.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= expiryDays;
  }) || [];

  const totalPeriodRevenue = analyticsData?.chartData?.reduce((acc, curr) => acc + curr.revenue, 0) || 0;
  const totalPeriodProfit = analyticsData?.chartData?.reduce((acc, curr) => acc + curr.profit, 0) || 0;
  const totalPeriodOrders = analyticsData?.chartData?.reduce((acc, curr) => acc + curr.orders, 0) || 0;

  const statCards = [
    {
      label: "Medicines Registered",
      value: metrics.productCount,
      unit: "SKUs",
      icon: Package,
      href: "/wholesaler/inventory",
      accent: "#2563EB",
      lightBg: "#EFF6FF",
    },
    {
      label: "Active Batches",
      value: metrics.activeBatches,
      unit: "batches",
      icon: Database,
      href: "/wholesaler/inventory",
      accent: "#7C3AED",
      lightBg: "#F5F3FF",
    },
    {
      label: "Pending Orders",
      value: metrics.pendingOrders,
      unit: "orders",
      icon: ShieldAlert,
      href: "/wholesaler/orders",
      accent: metrics.pendingOrders > 0 ? "#DC2626" : "#6B7280",
      lightBg: metrics.pendingOrders > 0 ? "#FEF2F2" : "#F9FAFB",
    },
    {
      label: "In-Transit",
      value: metrics.dispatchedOrders,
      unit: "shipped",
      icon: Truck,
      href: "/wholesaler/orders",
      accent: "#059669",
      lightBg: "#ECFDF5",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <LayoutDashboard style={{ width: 20, height: 20, color: "#2563EB" }} />
            Operations Overview
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {metrics.companyName} · Real-time supply chain summary
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/wholesaler/pos" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            background: "#2563EB", color: "#fff", textDecoration: "none",
            border: "none", cursor: "pointer",
          }}>
            <Zap style={{ width: 13, height: 13 }} /> Launch POS
          </Link>
        </div>
      </div>

      {/* ── Rejected Settlement Alert ── */}
      {rejectedSettlements.length > 0 && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertTriangle style={{ width: 16, height: 16, color: "#DC2626", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>
                Rejected Payment Settlements ({rejectedSettlements.length})
              </div>
              <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 1 }}>
                Awaiting manual settlement or retailer action
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rejectedSettlements.map((s: any) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12,
                background: "#fff", border: "1px solid #FECACA", borderRadius: 6, padding: "10px 14px",
              }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.retailer?.pharmacyName || "Retailer"}</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Order #{s.id.substring(0, 8).toUpperCase()}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>Rs. {s.settleAmount?.toLocaleString()}</div>
                <span style={{ fontSize: 11, color: "#6B7280" }}>{s.settleMethod || "CASH"}</span>
                <button
                  onClick={() => handleVerifySettlement(s.id, true)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 5, border: "1px solid #D1FAE5", background: "#ECFDF5", color: "#059669", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  <CheckCircle2 style={{ width: 13, height: 13 }} /> Mark Settled
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pending Settlement Verification ── */}
      {pendingSettlements.length > 0 && (
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Bell style={{ width: 16, height: 16, color: "#7C3AED", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>
                Settlement Verification Required ({pendingSettlements.length})
              </div>
              <div style={{ fontSize: 12, color: "#7C3AED", marginTop: 1 }}>
                Retailers awaiting your payment confirmation
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingSettlements.map((s: any) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12,
                background: "#fff", border: "1px solid #DDD6FE", borderRadius: 6, padding: "10px 14px",
              }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.retailer?.pharmacyName || "Retailer"}</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Order #{s.id.substring(0, 8).toUpperCase()} · {s.items?.length || 0} medicines</div>
                </div>
                {(() => {
                  const pendingSettle = (s.b2bSettlements || []).find((x: any) => x.status === 'PENDING');
                  const amt = pendingSettle ? pendingSettle.amount : (s.settleAmount || 0);
                  const method = pendingSettle ? pendingSettle.method : (s.settleMethod || 'CASH');
                  return (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>Rs. {amt.toLocaleString()}</div>
                      <span style={{ fontSize: 11, color: "#6B7280" }}>{method}</span>
                    </>
                  );
                })()}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleVerifySettlement(s.id, false)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 5, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    <XCircle style={{ width: 13, height: 13 }} /> Reject
                  </button>
                  <button
                    onClick={() => handleVerifySettlement(s.id, true)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 5, border: "none", background: "#7C3AED", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    <CheckCircle2 style={{ width: 13, height: 13 }} /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alerts ── */}
      {(lowStockItems.length > 0 || expiringBatches.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lowStockItems.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle style={{ width: 15, height: 15, color: "#DC2626", flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#991B1B" }}>Low Stock Alert — </span>
                  <span style={{ fontSize: 12, color: "#B91C1C" }}>
                    {lowStockItems.slice(0, 3).map(i => i.name).join(", ")}
                    {lowStockItems.length > 3 && ` +${lowStockItems.length - 3} more`}
                  </span>
                </div>
              </div>
              <Link href="/wholesaler/inventory" style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", textDecoration: "none", whiteSpace: "nowrap" }}>
                Restock →
              </Link>
            </div>
          )}
          {expiringBatches.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Clock style={{ width: 15, height: 15, color: "#D97706", flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Expiry Warning — </span>
                  <span style={{ fontSize: 12, color: "#B45309" }}>
                    {expiringBatches.length} batch{expiringBatches.length !== 1 ? "es" : ""} expiring within {expiryDays} days
                  </span>
                </div>
              </div>
              <Link href="/wholesaler/inventory" style={{ fontSize: 12, fontWeight: 600, color: "#D97706", textDecoration: "none", whiteSpace: "nowrap" }}>
                View →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} style={{ textDecoration: "none" }}>
              <div style={{
                background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
                padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14,
                transition: "border-color 0.15s",
                cursor: "pointer",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = card.accent)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: card.lightBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon style={{ width: 18, height: 18, color: card.accent }} />
                  </div>
                  <ArrowRight style={{ width: 14, height: 14, color: "#D1D5DB" }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF", marginBottom: 4 }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.accent, lineHeight: 1.1 }}>
                    {card.value}
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#9CA3AF", marginLeft: 4 }}>{card.unit}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Financial Analysis ── */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp style={{ width: 15, height: 15, color: "#2563EB" }} />
              Revenue & Profit Analysis
            </h2>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Interactive sales and margin ledger</p>
          </div>
          {/* Period Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 6, padding: 3 }}>
            {(["daily", "weekly", "monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                  textTransform: "capitalize", border: "none", cursor: "pointer",
                  background: period === p ? "#fff" : "transparent",
                  color: period === p ? "#2563EB" : "#6B7280",
                  boxShadow: period === p ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Summary numbers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Period Revenue", value: `Rs. ${totalPeriodRevenue.toLocaleString()}`, icon: DollarSign, color: "#2563EB" },
            { label: "Period Profit", value: `Rs. ${totalPeriodProfit.toLocaleString()}`, icon: TrendingUp, color: "#059669" },
            { label: "Transactions", value: `${totalPeriodOrders} orders`, icon: ShoppingCart, color: "#7C3AED" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 6, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Icon style={{ width: 13, height: 13, color: item.color }} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF" }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            );
          })}
        </div>

        {/* Chart */}
        <div style={{ height: 260 }}>
          {analyticsData?.chartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(37,99,235,0.04)" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar name="Revenue" dataKey="revenue" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={36} />
                <Bar name="Profit" dataKey="profit" fill="#93C5FD" radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9CA3AF", fontSize: 13 }}>
              Loading analytics...
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Logs + Quick Actions + Terminal ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>

        {/* Activity Log */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 6 }}>
              <Activity style={{ width: 14, height: 14, color: "#2563EB" }} />
              Recent Operations Log
            </h2>
            <Link href="/wholesaler/logs" style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
              View all <ArrowRight style={{ width: 11, height: 11 }} />
            </Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F9FAFB" }}>
                  <th style={{ padding: "9px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", borderBottom: "1px solid #F3F4F6" }}>Time</th>
                  <th style={{ padding: "9px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", borderBottom: "1px solid #F3F4F6" }}>Action</th>
                  <th style={{ padding: "9px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", borderBottom: "1px solid #F3F4F6" }}>Details</th>
                  <th style={{ padding: "9px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", borderBottom: "1px solid #F3F4F6" }}>User</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                      No recent activity recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #F9FAFB" }}>
                      <td style={{ padding: "11px 16px", fontFamily: "monospace", color: "#6B7280", whiteSpace: "nowrap" }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                          color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE",
                          padding: "2px 7px", borderRadius: 4, textTransform: "uppercase",
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", color: "#374151", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.details}>
                        {log.details}
                      </td>
                      <td style={{ padding: "11px 16px", color: "#6B7280", fontFamily: "monospace" }}>
                        {log.user ? log.user.fullName || log.user.email.split("@")[0] : "System"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Terminal Info */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
              <Activity style={{ width: 12, height: 12, color: "#2563EB" }} /> Terminal Node
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 6, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin style={{ width: 13, height: 13, color: "#2563EB", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF" }}>GPS Location</div>
                  <div style={{ fontSize: 11, fontWeight: 600, fontFamily: "monospace", color: "#111827", marginTop: 1 }}>
                    {metrics.latitude && metrics.longitude
                      ? `${metrics.latitude.toFixed(4)}N, ${metrics.longitude.toFixed(4)}E`
                      : "UNCONFIGURED"}
                  </div>
                </div>
              </div>
              {[
                { label: "System Monitor", value: <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "1px 8px", borderRadius: 4 }}>Stable</span> },
                { label: "Dispatch Queue", value: <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", fontFamily: "monospace" }}>FIFO</span> },
                { label: "Company Node", value: <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110, display: "block" }} title={metrics.companyName}>{metrics.companyName}</span> },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < 2 ? 8 : 0, borderBottom: i < 2 ? "1px solid #F3F4F6" : "none" }}>
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{row.label}</span>
                  {row.value}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
              <Zap style={{ width: 12, height: 12, color: "#2563EB" }} /> Quick Actions
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Link href="/wholesaler/pos" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: "#2563EB", color: "#fff", textDecoration: "none", textAlign: "center",
              }}>
                Launch POS Terminal
              </Link>
              <Link href="/wholesaler/inventory" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: "#F9FAFB", color: "#374151", textDecoration: "none", textAlign: "center",
                border: "1px solid #E5E7EB",
              }}>
                Manage Stock Registry
              </Link>
              <Link href="/wholesaler/orders" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: "#F9FAFB", color: "#374151", textDecoration: "none", textAlign: "center",
                border: "1px solid #E5E7EB",
              }}>
                View Pending Orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
