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
                    <Check size={14} strokeWidth={2.5} />
                  ) : isActive && isRejected ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <Icon size={14} />
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
        <div className="qws-meta-bar">
          <div className="qws-meta-item">
            <span className="qws-meta-label">Quote Status:</span>
            <span
              className="qws-meta-val quote-pill"
              style={{ backgroundColor: `${currentConfig.color}15`, color: currentConfig.color, borderColor: `${currentConfig.color}40` }}
            >
              {currentConfig.label}
            </span>
          </div>
          <div className="qws-meta-divider" />
          <div className="qws-meta-item">
            <span className="qws-meta-label">Shipment Status:</span>
            <span className="qws-meta-val ship-pill">
              {shipmentStatus}
            </span>
          </div>
          <div className="qws-meta-divider" />
          <div className="qws-meta-item">
            <span className="qws-meta-label">Active Reviewer:</span>
            <span className="qws-meta-actor">
              {stagesList[Math.min(currentStep - 1, 5)]?.actor || "Customer"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
