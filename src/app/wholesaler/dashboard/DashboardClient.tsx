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
  MapPin,
  Truck,
  LayoutDashboard,
  TrendingUp,
  Zap,
  Clock,
  Bell,
  X,
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
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          border: "1.5px solid #E0F2FE",
          padding: "12px 16px",
          borderRadius: 12,
          boxShadow: "0 10px 25px rgba(14,165,233,0.1)",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            color: "#64748B",
            marginBottom: 6,
          }}
        >
          {label}
        </p>
        {payload.map((p: any) => (
          <p
            key={p.name}
            style={{ fontSize: 12, fontWeight: 700, color: p.color }}
          >
            {p.name}: Rs. {p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SectionBreaker = ({ title, desc, icon: Icon }: { title: string; desc?: string; icon?: any }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 16px' }} className="no-print">
    {Icon && (
      <div style={{ padding: '6px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 13, height: 13, color: '#F97316' }} />
      </div>
    )}
    <div style={{ flexShrink: 0 }}>
      <h4 style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B' }}>{title}</h4>
      {desc && <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{desc}</p>}
    </div>
    <div style={{ flexGrow: 1, height: '1px', background: 'linear-gradient(to right, rgba(226,232,240,0.8), rgba(226,232,240,0.1))', marginLeft: 12 }} />
  </div>
);

export default function DashboardClient({
  profileId,
  metrics,
  auditLogs,
}: DashboardClientProps) {
  const [widgets, setWidgets] = useState({
    medicinesRegistered: true,
    activeBatches: true,
    pendingOrders: true,
    inTransitDeliveries: true,
    nearExpiryAlerts: true,
    financialLedger: true,
    recentActivity: true,
    terminalStatus: true,
    quickActions: true,
  });

  const [showConfig, setShowConfig] = useState(false);
  const [period, setPeriod] = useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("monthly");

  // Load user threshold settings
  const [lowStockBoxes, setLowStockBoxes] = useState(10);
  const [lowStockStrips, setLowStockStrips] = useState(0);
  const [lowStockTablets, setLowStockTablets] = useState(0);
  const [expiryDays, setExpiryDays] = useState(30);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("medhub_dashboard_widgets");
      if (saved) {
        try {
          setWidgets(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse dashboard widgets config", e);
        }
      }

      const storedLowStockBoxes = localStorage.getItem("medhub_low_stock_threshold_boxes");
      if (storedLowStockBoxes) {
        setLowStockBoxes(parseInt(storedLowStockBoxes, 10));
      } else {
        const storedOld = localStorage.getItem("medhub_low_stock_threshold");
        if (storedOld) setLowStockBoxes(parseInt(storedOld, 10));
      }
      const storedLowStockStrips = localStorage.getItem("medhub_low_stock_threshold_strips");
      if (storedLowStockStrips) {
        setLowStockStrips(parseInt(storedLowStockStrips, 10));
      }
      const storedLowStockTablets = localStorage.getItem("medhub_low_stock_threshold_tablets");
      if (storedLowStockTablets) {
        setLowStockTablets(parseInt(storedLowStockTablets, 10));
      }

      const storedExpiry = localStorage.getItem("medhub_expiry_alert_days");
      if (storedExpiry) setExpiryDays(parseInt(storedExpiry, 10));
    }
  }, []);

  // Real-time telemetry via SWR + SSE
  const { data: analyticsData } = useRealtimeData<{
    chartData: Array<{
      label: string;
      revenue: number;
      profit: number;
      orders: number;
    }>;
    period: string;
    totalOrders: number;
    allProductStocks: Array<{ id: string; name: string; sku: string; units: number; stripsPerBox?: number; tabletsPerStrip?: number }>;
  }>(
    `/api/wholesaler/analytics?period=${period}&wholesalerId=${profileId}`,
    profileId,
  );

  const { data: batchesResponse } = useRealtimeData<{
    success: boolean;
    batches: Array<{
      id: string;
      batchNumber: string;
      availableBaseUnits: number;
      expiryDate: string;
      product: { name: string; sku: string };
    }>;
  }>(`/api/wholesaler/batches`, profileId);

  // Compute Alerts dynamically based on custom thresholds
  const lowStockItems =
    analyticsData?.allProductStocks?.filter(
      (item) => {
        // default multipliers if not sent by api (or use standard 10 per box / 10 per strip if missing)
        const spb = item.stripsPerBox || 10;
        const tps = item.tabletsPerStrip || 10;
        const totalThresholdUnits = (lowStockBoxes * spb * tps) + (lowStockStrips * tps) + lowStockTablets;
        return item.units < totalThresholdUnits;
      }
    ) || [];

  const expiringBatches =
    batchesResponse?.batches?.filter((batch) => {
      if (batch.availableBaseUnits <= 0) return false;
      const expiry = new Date(batch.expiryDate);
      const diffTime = expiry.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= expiryDays;
    }) || [];

  const totalPeriodRevenue =
    analyticsData?.chartData?.reduce((acc, curr) => acc + curr.revenue, 0) || 0;
  const totalPeriodProfit =
    analyticsData?.chartData?.reduce((acc, curr) => acc + curr.profit, 0) || 0;
  const totalPeriodOrders =
    analyticsData?.chartData?.reduce((acc, curr) => acc + curr.orders, 0) || 0;

  const toggleWidget = (key: keyof typeof widgets) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    localStorage.setItem("medhub_dashboard_widgets", JSON.stringify(updated));
  };

  const statCards = [
    {
      key: "medicinesRegistered",
      label: "Medicines Registered",
      value: metrics.productCount,
      unit: "SKUs",
      icon: Package,
      href: "/wholesaler/inventory",
      color: "#F97316",
      bg: "#FFF7ED",
    },
    {
      key: "activeBatches",
      label: "Active Batches",
      value: metrics.activeBatches,
      unit: "batches",
      icon: Database,
      href: "/wholesaler/inventory",
      color: "#0EA5E9",
      bg: "#F0F9FF",
    },
    {
      key: "pendingOrders",
      label: "Pending Orders",
      value: metrics.pendingOrders,
      unit: "orders",
      icon: ShieldAlert,
      href: "/wholesaler/orders",
      color: metrics.pendingOrders > 0 ? "#DC2626" : "#64748B",
      bg: metrics.pendingOrders > 0 ? "#FEF2F2" : "#F8FAFC",
    },
    {
      key: "inTransitDeliveries",
      label: "In-Transit",
      value: metrics.dispatchedOrders,
      unit: "shipped",
      icon: Truck,
      href: "/wholesaler/orders",
      color: "#10B981",
      bg: "#ECFDF5",
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          background: "rgba(255,255,255,0.80)",
          backdropFilter: "blur(16px)",
          border: "1.5px solid rgba(186,230,253,0.5)",
          borderRadius: 20,
          padding: "20px 24px",
          boxShadow: "0 2px 12px rgba(14,165,233,0.07)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#1E293B",
              letterSpacing: "-0.02em",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <LayoutDashboard
              style={{ width: 22, height: 22, color: "#F97316" }}
            />
            Operations Overview
          </h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
            Real-time summary of your wholesale supply chain —{" "}
            {metrics.companyName}
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowConfig(true)}
            className="btn-ghost"
            style={{ display: "none", alignItems: "center", gap: 6 }}
          >
            <Settings style={{ width: 14, height: 14, color: "#F97316" }} />
            Customize Widgets
          </button>
          {showConfig && (
            <div className="modal-overlay" onClick={() => setShowConfig(false)}>
              <div
                className="modal-card animate-scaleIn"
                style={
                  {
                    "--modal-max-width": "420px",
                    border: "1.5px solid #FED7AA",
                  } as React.CSSProperties
                }
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #F1F5F9",
                    paddingBottom: 14,
                    padding: "22px 28px 16px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#1E293B",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Settings
                      style={{ width: 16, height: 16, color: "#F97316" }}
                    />
                    Customize Widgets
                  </h3>
                  <button
                    onClick={() => setShowConfig(false)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94A3B8",
                      padding: 4,
                    }}
                  >
                    <X style={{ width: 20, height: 20 }} />
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "20px 28px",
                  }}
                >
                  {[
                    { key: "medicinesRegistered", label: "Medicines Stat" },
                    { key: "activeBatches", label: "Active Batches" },
                    { key: "pendingOrders", label: "Pending Orders" },
                    { key: "inTransitDeliveries", label: "In-Transit" },
                    { key: "nearExpiryAlerts", label: "Near-Expiry Alerts" },
                    { key: "financialLedger", label: "Revenue & Profits" },
                    { key: "recentActivity", label: "Activity Logs" },
                    { key: "terminalStatus", label: "Terminal Status" },
                    { key: "quickActions", label: "Quick Actions" },
                  ].map((w) => {
                    const isActive = widgets[w.key as keyof typeof widgets];
                    return (
                      <button
                        key={w.key}
                        type="button"
                        onClick={() =>
                          toggleWidget(w.key as keyof typeof widgets)
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "none",
                          background: isActive
                            ? "rgba(249,115,22,0.06)"
                            : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          color: isActive ? "#1E293B" : "#94A3B8",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        {isActive ? (
                          <CheckSquare
                            style={{
                              width: 16,
                              height: 16,
                              color: "#F97316",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <Square
                            style={{
                              width: 16,
                              height: 16,
                              color: "#CBD5E1",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: isActive ? "none" : "line-through",
                          }}
                        >
                          {w.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: "0 28px 22px" }}>
                  <button
                    type="button"
                    onClick={() => setShowConfig(false)}
                    className="btn-primary"
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #F97316, #F59E0B)",
                      border: "none",
                      padding: "12px",
                      justifyContent: "center",
                    }}
                  >
                    Apply Selection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Near-Expiry & Low-Stock Alerts Section */}
      {widgets.nearExpiryAlerts && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Low Stock Alerts */}
          {lowStockItems.length > 0 && (
            <div
              className="alert alert-error animate-scaleIn"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    padding: 8,
                    background: "rgba(220,38,38,0.15)",
                    borderRadius: 10,
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    style={{ width: 18, height: 18, color: "#DC2626" }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#991B1B",
                    }}
                  >
                    Low Stock Alert
                  </div>
                  <p style={{ fontSize: 12, marginTop: 2, color: "#7F1D1D" }}>
                    The following items are below your low stock threshold ({lowStockBoxes} boxes, {lowStockStrips} strips, {lowStockTablets} tablets):{" "}
                    {lowStockItems.map((item, idx) => (
                      <span key={item.sku}>
                        {idx > 0 && ", "}
                        <strong>{item.name}</strong> ({item.units} units left)
                      </span>
                    ))}
                  </p>
                </div>
              </div>
              <Link
                href="/wholesaler/inventory"
                className="btn-ghost"
                style={{
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  padding: "6px 14px",
                  color: "#DC2626",
                  background: "rgba(220,38,38,0.08)",
                }}
              >
                Restock Now
              </Link>
            </div>
          )}

          {/* Expiry Alerts */}
          {expiringBatches.length > 0 && (
            <div
              className="alert alert-warning animate-scaleIn"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    padding: 8,
                    background: "rgba(245,158,11,0.15)",
                    borderRadius: 10,
                    flexShrink: 0,
                  }}
                >
                  <Clock style={{ width: 18, height: 18, color: "#D97706" }} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#92400E",
                    }}
                  >
                    Batch Expiration Warnings
                  </div>
                  <p style={{ fontSize: 12, marginTop: 2, color: "#78350F" }}>
                    <strong style={{ fontFamily: "monospace" }}>
                      {expiringBatches.length}
                    </strong>{" "}
                    batches expiring within your alert range of{" "}
                    <strong>{expiryDays}</strong> days:{" "}
                    {expiringBatches.slice(0, 3).map((b, idx) => (
                      <span key={b.id}>
                        {idx > 0 && ", "}
                        <strong>{b.product.name}</strong> (Batch:{" "}
                        {b.batchNumber}, Expiry:{" "}
                        {new Date(b.expiryDate).toLocaleDateString()})
                      </span>
                    ))}
                    {expiringBatches.length > 3 &&
                      ` and ${expiringBatches.length - 3} more.`}
                  </p>
                </div>
              </div>
              <Link
                href="/wholesaler/inventory"
                className="btn-ghost"
                style={{
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  padding: "6px 14px",
                  color: "#D97706",
                  background: "rgba(245,158,11,0.08)",
                }}
              >
                View Batches
              </Link>
            </div>
          )}
        </div>
      )}

      <SectionBreaker title="Operational Telemetry" desc="High level catalog and dispatch counters" icon={Activity} />

      {/* Stat Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 24,
        }}
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          if (!widgets[card.key as keyof typeof widgets]) return null;

          // Generate a vibrant colorful shadow based on the card color
          const shadowColor =
            card.color === "#F97316"
              ? "rgba(249,115,22,0.18)"
              : card.color === "#0EA5E9"
                ? "rgba(14,165,233,0.18)"
                : card.color === "#10B981"
                  ? "rgba(16,185,129,0.18)"
                  : card.color === "#DC2626"
                    ? "rgba(220,38,38,0.18)"
                    : "rgba(148,163,184,0.15)";

          return (
            <Link
              key={card.key}
              href={card.href}
              className="stat-card hover:-translate-y-1 transition-all duration-300"
              style={{
                textDecoration: "none",
                boxShadow: `0 10px 25px ${shadowColor}, 0 1px 3px rgba(0,0,0,0.02)`,
                border: `1.5px solid ${card.bg}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  className="stat-card-icon shadow-inner"
                  style={{ background: card.bg, color: card.color }}
                >
                  <Icon style={{ width: 20, height: 20 }} />
                </div>
                <ArrowRight
                  style={{ width: 14, height: 14, color: "#CBD5E1" }}
                />
              </div>
              <div>
                <div className="stat-card-label">{card.label}</div>
                <div className="stat-card-value" style={{ color: card.color }}>
                  {card.value}
                  <span className="stat-card-unit">{card.unit}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <SectionBreaker title="Financial Analysis" desc="Revenue and profitability insights" icon={TrendingUp} />

      {/* Financial Ledger Card & Recharts Bar Graph */}
      {widgets.financialLedger && (
        <div
          className="card"
          style={{ background: "rgba(255,255,255,0.85)", padding: 24 }}
        >
          {/* Header with selector */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              borderBottom: "1px solid #F1F5F9",
              paddingBottom: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "#1E293B",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <TrendingUp
                  style={{ width: 14, height: 14, color: "#F97316" }}
                />
                Revenue & Profit Analysis
              </h3>
              <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                Interactive sales & margin ledger
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 6,
                background: "#F1F5F9",
                padding: 3,
                borderRadius: 10,
              }}
            >
              {(["daily", "weekly", "monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                    background: period === p ? "white" : "transparent",
                    color: period === p ? "#F97316" : "#64748B",
                    boxShadow:
                      period === p ? "0 1px 4px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Stats grids */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)",
                border: "1px solid #FED7AA",
                borderRadius: 16,
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#C2410C",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Period Revenue
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#EA580C",
                  fontFamily: "monospace",
                  marginTop: 4,
                }}
              >
                Rs. {totalPeriodRevenue.toLocaleString()}
              </div>
              <p style={{ fontSize: 10, color: "#9A3412", marginTop: 4 }}>
                Sales in selected range
              </p>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #F0F9FF, #E0F2FE)",
                border: "1px solid #BAE6FD",
                borderRadius: 16,
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#0369A1",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Period Profit
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#0284C7",
                  fontFamily: "monospace",
                  marginTop: 4,
                }}
              >
                Rs. {totalPeriodProfit.toLocaleString()}
              </div>
              <p style={{ fontSize: 10, color: "#075985", marginTop: 4 }}>
                Estimated margin
              </p>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                border: "1px solid #A7F3D0",
                borderRadius: 16,
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#047857",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Transactions
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#059669",
                  fontFamily: "monospace",
                  marginTop: 4,
                }}
              >
                {totalPeriodOrders}
                <span
                  style={{
                    fontSize: 11,
                    color: "#065F46",
                    fontWeight: 600,
                    marginLeft: 6,
                  }}
                >
                  orders
                </span>
              </div>
              <p style={{ fontSize: 10, color: "#065F46", marginTop: 4 }}>
                Order count
              </p>
            </div>
          </div>

          {/* Chart visualization */}
          <div style={{ height: 280, width: "100%" }}>
            {analyticsData?.chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData.chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(14,165,233,0.04)" }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: 11,
                      fontWeight: 700,
                      paddingTop: 10,
                    }}
                  />
                  <Bar
                    name="Revenue"
                    dataKey="revenue"
                    fill="#F97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    name="Profit"
                    dataKey="profit"
                    fill="#38BDF8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#94A3B8",
                  fontSize: 12,
                  fontStyle: "italic",
                }}
              >
                Loading ledger analytics...
              </div>
            )}
          </div>
        </div>
      )}

      <SectionBreaker title="Activity & Terminal Telemetry" desc="Audit trails and hardware terminal connections" icon={Clock} />

      {/* Activity Logs + Sidebar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 16,
        }}
      >
        {/* Activity Log Table */}
        {widgets.recentActivity && (
          <div
            className="card"
            style={{ background: "rgba(255,255,255,0.85)", padding: 24 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #F1F5F9",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "#1E293B",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#F97316",
                    display: "inline-block",
                  }}
                />
                Recent Operations Log
              </h3>
              <Link
                href="/wholesaler/logs"
                className="btn-ghost"
                style={{
                  padding: "4px 12px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                View All <ArrowRight style={{ width: 11, height: 11 }} />
              </Link>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          color: "#94A3B8",
                          fontStyle: "italic",
                          fontSize: 12,
                        }}
                      >
                        No recent activity recorded.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontSize: 10,
                            color: "#64748B",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              fontFamily: "monospace",
                              color: "#C2410C",
                              background: "#FFF7ED",
                              border: "1px solid #FED7AA",
                              padding: "2px 8px",
                              borderRadius: 6,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td
                          style={{
                            fontSize: 11,
                            maxWidth: 240,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={log.details}
                        >
                          {log.details}
                        </td>
                        <td
                          style={{
                            fontSize: 10,
                            color: "#64748B",
                            fontFamily: "monospace",
                          }}
                        >
                          {log.user
                            ? log.user.fullName || log.user.email.split("@")[0]
                            : "System"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Terminal Status */}
          {widgets.terminalStatus && (
            <div
              className="card"
              style={{ background: "rgba(255,255,255,0.85)", padding: 20 }}
            >
              <div
                style={{
                  borderBottom: "1px solid #F1F5F9",
                  paddingBottom: 12,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Activity style={{ width: 14, height: 14, color: "#F97316" }} />
                <h3
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "#1E293B",
                  }}
                >
                  Terminal Node Info
                </h3>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <MapPin
                  style={{
                    width: 16,
                    height: 16,
                    color: "#F97316",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "#94A3B8",
                      letterSpacing: "0.06em",
                    }}
                  >
                    GPS Node Location
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "monospace",
                      color: "#1E293B",
                      marginTop: 2,
                    }}
                  >
                    {metrics.latitude && metrics.longitude
                      ? `${metrics.latitude.toFixed(4)}N, ${metrics.longitude.toFixed(4)}E`
                      : "UNCONFIGURED"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  {
                    label: "System Monitor",
                    value: (
                      <span className="status-pill status-pill-active">
                        Stable
                      </span>
                    ),
                  },
                  {
                    label: "Dispatch Queue",
                    value: (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: "monospace",
                          color: "#1E293B",
                        }}
                      >
                        FIFO ALGO
                      </span>
                    ),
                  },
                  {
                    label: "Company Node",
                    value: (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#1E293B",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 130,
                        }}
                        title={metrics.companyName}
                      >
                        {metrics.companyName}
                      </span>
                    ),
                  },
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: i < 2 ? 8 : 0,
                      borderBottom: i < 2 ? "1px solid #F8FAFC" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#64748B",
                      }}
                    >
                      {row.label}
                    </span>
                    {row.value}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {widgets.quickActions && (
            <div
              className="card"
              style={{ background: "rgba(255,255,255,0.85)", padding: 20 }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94A3B8",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Zap style={{ width: 12, height: 12, color: "#F97316" }} />
                Quick Actions
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link
                  href="/wholesaler/pos"
                  className="btn-primary"
                  style={{
                    justifyContent: "center",
                    width: "100%",
                    textAlign: "center",
                  }}
                >
                  Launch POS Terminal
                </Link>
                <Link
                  href="/wholesaler/inventory"
                  className="btn-ghost"
                  style={{
                    justifyContent: "center",
                    width: "100%",
                    textAlign: "center",
                  }}
                >
                  Manage Stock Registry
                </Link>
                <Link
                  href="/wholesaler/orders"
                  className="btn-ghost"
                  style={{
                    justifyContent: "center",
                    width: "100%",
                    textAlign: "center",
                  }}
                >
                  View Pending Orders
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
