import React from "react";
import { Check, Clock, AlertTriangle, ShieldCheck, Cpu, User, FileCheck } from "lucide-react";
import { STATUS_CONFIG, normalizeWorkflowStatus, getShipmentStatusFromQuoteStatus } from "../utils/quoteWorkflow";
import "./QuoteWorkflowStepper.css";

const STAGES = [
  { id: "REQUESTED", name: "1. Requested", actor: "Customer", icon: User },
  { id: "GENERATED", name: "2. Generated", actor: "AI Engine", icon: Cpu },
  { id: "PENDING_REVIEW", name: "3. Pending Review", actor: "Customs / Ops", icon: ShieldCheck },
  { id: "APPROVED", name: "4. Approved", actor: "Operations", icon: FileCheck },
  { id: "SENT", name: "5. Sent", actor: "Freight Agent", icon: Clock },
  { id: "ACCEPTED", name: "6. Decision", actor: "Customer", icon: Check },
];

export default function QuoteWorkflowStepper({ status, requiresCustoms = true, compact = false }) {
  const normStatus = normalizeWorkflowStatus(status);
  const currentConfig = STATUS_CONFIG[normStatus] || STATUS_CONFIG.REQUESTED;
  const currentStep = currentConfig.stepIndex || 1;
  const isRejected = normStatus === "REJECTED";
  const isFlagged = normStatus === "CUSTOMS_FLAGGED";
  const shipmentStatus = getShipmentStatusFromQuoteStatus(normStatus);

  const stagesList = STAGES.map((s, idx) => {
    if (idx === 0) {
      return {
        ...s,
        name: normStatus === "DRAFT" ? "1. Draft (Saved)" : "1. Requested",
      };
    }
    return s;
  });

  return (
    <div className={`qws-container ${compact ? "compact" : ""}`}>
      <div className="qws-steps">
        {stagesList.map((stage, idx) => {
          const stepNum = idx + 1;
          const isDone = currentStep > stepNum || (stepNum === 6 && normStatus === "ACCEPTED");
          const isActive = currentStep === stepNum;
          const Icon = stage.icon;

          let stepClass = "pending";
          if (isDone) stepClass = "done";
          if (isActive) {
            if (isRejected && stepNum === 6) stepClass = "rejected";
            else if (isFlagged && stepNum === 3) stepClass = "flagged";
            else stepClass = "active";
          }

          return (
            <React.Fragment key={stage.id}>
              <div className={`qws-step-node ${stepClass}`}>
                <div className="qws-marker">
                  {isDone ? (
                    <Check size={13} strokeWidth={3} />
                  ) : isActive && isRejected ? (
                    <AlertTriangle size={13} />
                  ) : (
                    <Icon size={13} />
                  )}
                </div>
                <div className="qws-info">
                  <span className="qws-step-title">{stage.name}</span>
                  <span className="qws-actor-badge">{stage.actor}</span>
                </div>
              </div>
              {idx < stagesList.length - 1 && (
                <div className={`qws-connector ${isDone ? "done" : isActive ? "active" : ""}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #e2e8f0", fontSize: "11px", color: "#64748b" }}>
          <span><strong>Quote Status:</strong> <span style={{ color: currentConfig.color, fontWeight: 700 }}>{currentConfig.label}</span></span>
          <span style={{ color: "#cbd5e1" }}>•</span>
          <span><strong>Shipment Status:</strong> <span style={{ color: "#0284c7", fontWeight: 700 }}>{shipmentStatus}</span></span>
          <span style={{ color: "#cbd5e1" }}>•</span>
          <span><strong>Active Actor:</strong> {stagesList[Math.min(currentStep - 1, 5)]?.actor || "Customer"}</span>
        </div>
      )}
    </div>
  );
}
