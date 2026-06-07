"use client";

import React, { useState } from "react";
import {
  Users,
  UserPlus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Key,
  Edit,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { logActivity } from "@/components/WholesalerLayout";

interface StaffUser {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  plainPassword: string | null;
  allowedFeatures: string;
  createdAt: string;
}

interface StaffClientProps {
  initialStaff: StaffUser[];
  initialLogs: any[];
}

const AVAILABLE_FEATURES = [
  { key: "Dashboard", label: "Dashboard Home" },
  { key: "Medicines", label: "Manage Medicines" },
  { key: "Orders", label: "Sales & Orders" },
  { key: "POS", label: "POS Billing" },
  { key: "Billing", label: "Billing & Profits" },
  { key: "Profile", label: "Distributor Profile" },
  { key: "Logs", label: "Activity Logs" },
];

export default function StaffClient({
  initialStaff,
  initialLogs,
}: StaffClientProps) {
  const [staff, setStaff] = useState<StaffUser[]>(initialStaff);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>(
    AVAILABLE_FEATURES.map((f) => f.key),
  );

  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editAllowedFeatures, setEditAllowedFeatures] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    setError("");
    try {
      const staffRes = await fetch("/api/wholesaler/staff");
      const staffData = await staffRes.json();
      if (!staffRes.ok)
        throw new Error(staffData.error || "Failed to fetch employees");
      setStaff(staffData.staff);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Failed to refresh data.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!email || !password || !fullName) {
      setError("Please fill in all employee credentials.");
      return;
    }
    if (allowedFeatures.length === 0) {
      setError("Please select at least one allowed feature.");
      return;
    }
    try {
      const res = await fetch("/api/wholesaler/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, allowedFeatures }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account.");
      setSuccessMsg(`Employee account created for "${fullName}" successfully.`);
      setEmail("");
      setPassword("");
      setFullName("");
      setAllowedFeatures(AVAILABLE_FEATURES.map((f) => f.key));
      const staffRes = await fetch("/api/wholesaler/staff");
      const staffData = await staffRes.json();
      if (staffRes.ok) setStaff(staffData.staff);
    } catch (err: any) {
      setError(err.message || "Failed to create staff.");
    }
  };

  const handleOpenEdit = (emp: StaffUser) => {
    setEditingStaff(emp);
    setEditEmail(emp.email);
    setEditFullName(emp.fullName || "");
    setEditPassword("");
    setEditIsActive(emp.isActive);
    setEditAllowedFeatures(
      emp.allowedFeatures ? emp.allowedFeatures.split(",") : [],
    );
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/wholesaler/staff/${editingStaff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editEmail,
          fullName: editFullName,
          password: editPassword || undefined,
          isActive: editIsActive,
          allowedFeatures: editAllowedFeatures,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to update employee account.");
      setSuccessMsg(`Updated settings for "${editFullName}" successfully.`);
      setEditingStaff(null);
      const staffRes = await fetch("/api/wholesaler/staff");
      const staffData = await staffRes.json();
      if (staffRes.ok) setStaff(staffData.staff);
    } catch (err: any) {
      setError(err.message || "Failed to update employee.");
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${name}"? This cannot be undone.`,
      )
    )
      return;
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/wholesaler/staff/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account.");
      setSuccessMsg(`Staff account "${name}" has been deleted.`);
      const staffRes = await fetch("/api/wholesaler/staff");
      const staffData = await staffRes.json();
      if (staffRes.ok) setStaff(staffData.staff);
    } catch (err: any) {
      setError(err.message || "Failed to delete employee.");
    }
  };

  const handleToggleFeature = (key: string, isEditMode = false) => {
    if (isEditMode) {
      setEditAllowedFeatures((prev) =>
        prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
      );
    } else {
      setAllowedFeatures((prev) =>
        prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
      );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
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
            <Users style={{ width: 22, height: 22, color: "#F97316" }} />
            Employee Directory &amp; Access Control
          </h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
            Manage staff login details, configure feature permissions, and
            review credentials.
          </p>
        </div>
        <button
          onClick={refreshData}
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw
            style={{ width: 14, height: 14, color: "#F97316" }}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error animate-scaleIn">
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success animate-scaleIn">
          <CheckCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* LEFT: Add New Employee Form */}
        <div
          className="card"
          style={{ background: "rgba(255,255,255,0.85)", padding: 24 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderBottom: "1px solid #F1F5F9",
              paddingBottom: 12,
              marginBottom: 20,
            }}
          >
            <UserPlus style={{ width: 14, height: 14, color: "#F97316" }} />
            <h3
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "#1E293B",
              }}
            >
              Add New Employee
            </h3>
          </div>

          <form
            onSubmit={handleCreateStaff}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ram Bahadur"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-crisp"
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Email / Username
              </label>
              <input
                type="email"
                required
                placeholder="e.g. ram@distributor.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-crisp"
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Password (Visible)
              </label>
              <input
                type="text"
                required
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-crisp"
                style={{ fontFamily: "monospace" }}
              />
            </div>

            {/* Permissions */}
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 10,
                }}
              >
                Allowed Features
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  background: "#F8FAFC",
                  border: "1.5px solid #E0F2FE",
                  borderRadius: 10,
                  padding: "8px 10px",
                }}
              >
                {AVAILABLE_FEATURES.map((f) => {
                  const isChecked = allowedFeatures.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => handleToggleFeature(f.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "none",
                        background: isChecked
                          ? "rgba(14,165,233,0.08)"
                          : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          border: `2px solid ${isChecked ? "#0EA5E9" : "#CBD5E1"}`,
                          background: isChecked ? "#0EA5E9" : "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                      >
                        {isChecked && (
                          <span
                            style={{
                              color: "white",
                              fontSize: 9,
                              fontWeight: 900,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isChecked ? "#1E293B" : "#64748B",
                        }}
                      >
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{
                justifyContent: "center",
                width: "100%",
                padding: "11px",
              }}
            >
              Register Staff Account
            </button>
          </form>
        </div>

        {/* RIGHT: Staff Directory */}
        <div
          className="card"
          style={{ background: "rgba(255,255,255,0.85)", padding: 24 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderBottom: "1px solid #F1F5F9",
              paddingBottom: 12,
              marginBottom: 20,
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
            <h3
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "#1E293B",
              }}
            >
              Distributor Staff Roster — {staff.length} accounts
            </h3>
          </div>

          {staff.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "#94A3B8",
                fontStyle: "italic",
                fontSize: 12,
              }}
            >
              No staff accounts registered yet.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {staff.map((emp) => (
                <div
                  key={emp.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    padding: 18,
                    background: "#FAFCFF",
                    border: "1.5px solid #E0F2FE",
                    borderRadius: 16,
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  className="hover:scale-[1.01] hover:shadow-md"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          color: "#1E293B",
                        }}
                      >
                        {emp.fullName || "—"}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748B",
                          fontFamily: "monospace",
                          marginTop: 2,
                        }}
                      >
                        {emp.email}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 12,
                        background: emp.isActive ? "#D1FAE5" : "#F1F5F9",
                        color: emp.isActive ? "#065F46" : "#475569",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {emp.isActive ? "• ACTIVE" : "DISABLED"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "white",
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "6px 12px",
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#1E293B",
                    }}
                  >
                    <Key
                      style={{
                        width: 12,
                        height: 12,
                        color: "#F97316",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "#64748B", marginRight: 4 }}>
                      Passcode:
                    </span>{" "}
                    {emp.plainPassword || "N/A"}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        color: "#94A3B8",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      Allowed Access
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {emp.allowedFeatures ? (
                        emp.allowedFeatures.split(",").map((f) => (
                          <span
                            key={f}
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              background: "#F0F9FF",
                              border: "1px solid #BAE6FD",
                              color: "#0EA5E9",
                              padding: "2px 7px",
                              borderRadius: 6,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {f}
                          </span>
                        ))
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: "#94A3B8",
                            fontStyle: "italic",
                          }}
                        >
                          None
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      borderTop: "1px solid #F1F5F9",
                      paddingTop: 12,
                      marginTop: 4,
                    }}
                  >
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="btn-ghost"
                      style={{ flex: 1, padding: "6px", fontSize: 11, gap: 4 }}
                    >
                      <Edit
                        style={{ width: 12, height: 12, color: "#0EA5E9" }}
                      />
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteStaff(emp.id, emp.fullName || emp.email)
                      }
                      className="btn-danger"
                      style={{ flex: 1, padding: "6px", fontSize: 11, gap: 4 }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingStaff && (
        <div
          className="modal-overlay no-print"
          onClick={() => setEditingStaff(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="modal-card animate-scaleIn"
            style={
              {
                "--modal-max-width": "500px",
                border: "1.5px solid rgba(186,230,253,0.6)",
                boxShadow: "0 24px 64px rgba(14,165,233,0.18)",
                padding: 28,
              } as React.CSSProperties
            }
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #F1F5F9",
                paddingBottom: 14,
                marginBottom: 20,
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
                <Edit style={{ width: 16, height: 16, color: "#F97316" }} />
                Modify Staff Permissions
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
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

            <form
              onSubmit={handleUpdateStaff}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 6,
                  }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="input-crisp"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 6,
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="input-crisp"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 6,
                  }}
                >
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new plain passcode"
                  className="input-crisp"
                  style={{ fontFamily: "monospace" }}
                />
              </div>

              {/* Account Status Toggle */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#F8FAFC",
                  border: "1.5px solid #E0F2FE",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Account Status:
                </span>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {editIsActive ? (
                    <>
                      <ToggleRight
                        style={{ width: 32, height: 32, color: "#0EA5E9" }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#0EA5E9",
                        }}
                      >
                        ENABLED
                      </span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft
                        style={{ width: 32, height: 32, color: "#94A3B8" }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#94A3B8",
                        }}
                      >
                        DISABLED
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Feature Checklist */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#64748B",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                  }}
                >
                  Features Checklist
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                    background: "#F8FAFC",
                    border: "1.5px solid #E0F2FE",
                    borderRadius: 10,
                    padding: "8px 10px",
                  }}
                >
                  {AVAILABLE_FEATURES.map((f) => {
                    const isChecked = editAllowedFeatures.includes(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => handleToggleFeature(f.key, true)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: "none",
                          background: isChecked
                            ? "rgba(14,165,233,0.08)"
                            : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            border: `2px solid ${isChecked ? "#0EA5E9" : "#CBD5E1"}`,
                            background: isChecked ? "#0EA5E9" : "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "all 0.15s",
                          }}
                        >
                          {isChecked && (
                            <span
                              style={{
                                color: "white",
                                fontSize: 9,
                                fontWeight: 900,
                              }}
                            >
                              ✓
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isChecked ? "#1E293B" : "#64748B",
                          }}
                        >
                          {f.key}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  paddingTop: 8,
                  borderTop: "1px solid #F1F5F9",
                }}
              >
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: "center", padding: "12px" }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="btn-ghost"
                  style={{ padding: "12px 20px" }}
                >
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
