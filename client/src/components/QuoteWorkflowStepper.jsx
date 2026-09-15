import React from "react";
import {
  Check,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  User,
  FileCheck,
  Building2,
  SearchCheck,
  Stamp,
} from "lucide-react";
import {
  STATUS_CONFIG,
  normalizeWorkflowStatus,
  getShipmentStatusFromQuoteStatus,
  getCompanyWorkflowProgress,
} from "../utils/quoteWorkflow";
import "./QuoteWorkflowStepper.css";

const STAGES = [
  { id: "REQUESTED", name: "1. Requested", actor: "Customer", icon: User },
  { id: "GENERATED", name: "2. Generated", actor: "AI Engine", icon: Cpu },
  { id: "PENDING_REVIEW", name: "3. Pending Review", actor: "Customs / Ops", icon: ShieldCheck },
  { id: "APPROVED", name: "4. Approved", actor: "Operations", icon: FileCheck },
  { id: "SENT", name: "5. Sent", actor: "Freight Agent", icon: Clock },
  { id: "ACCEPTED", name: "6. Decision", actor: "Customer", icon: Check },
];

// Icons for the seven company-workflow (M4) stages, by stage id.
const COMPANY_ICONS = {
  REQUESTED: User,
  GENERATED: Cpu,
  PENDING_REVIEW: ShieldCheck,
  COMPANY_APPROVED: Building2,
  CUSTOMS_REVIEW: SearchCheck,
  CUSTOMS_APPROVED: Stamp,
  DECISION: Check,
};

export default function QuoteWorkflowStepper({ status, m4 = null, requiresCustoms = true, compact = false }) {
  const normStatus = normalizeWorkflowStatus(status);
  const currentConfig = STATUS_CONFIG[normStatus] || STATUS_CONFIG.REQUESTED;
  const currentStep = currentConfig.stepIndex || 1;
  const isRejected = normStatus === "REJECTED";
  const isFlagged = normStatus === "CUSTOMS_FLAGGED";
  const shipmentStatus = getShipmentStatusFromQuoteStatus(normStatus);

  // A quote inside the company workflow (M4) has stages of its own, and the
  // M4 block drives them: the quote status is only a mirror of where the
  // request is, so it cannot tell "approved and with customs" from "approved
  // and on its way to the customer".
  const company = getCompanyWorkflowProgress(m4);

  const stagesList = company
    ? company.stages.map((stage) => ({ ...stage, icon: COMPANY_ICONS[stage.id] || FileCheck }))
    : STAGES.map((s, idx) =>
        idx === 0
          ? { ...s, name: normStatus === "DRAFT" ? "1. Draft (Saved)" : "1. Requested" }
          : s,
      );

  // One state per step, so both flows render through the same markup. The
  // plain flow keeps its original rule: everything before the current step is
  // done and the status's own step is the one lit up.
  const stepStates = company
    ? company.stepStates
    : stagesList.map((_, idx) => {
        const stepNum = idx + 1;
        const stepDone = currentStep > stepNum || (stepNum === 6 && normStatus === "ACCEPTED");
        if (currentStep === stepNum) {
          if (isRejected && stepNum === 6) return "rejected";
          if (isFlagged && stepNum === 3) return "flagged";
          return "active";
        }
        return stepDone ? "done" : "pending";
      });

  const stepChecked = company
    ? company.stepChecked
    : stagesList.map((_, idx) => currentStep > idx + 1 || (idx + 1 === 6 && normStatus === "ACCEPTED"));

  const statusLabel = company ? company.statusLabel : currentConfig.label;
  const statusColor = company ? company.statusColor : currentConfig.color;
  const activeReviewer = company
    ? company.activeReviewer
    : stagesList[Math.min(currentStep - 1, stagesList.length - 1)]?.actor || "Customer";

  // A connector follows the node it leaves. In the plain flow a flagged or
  // rejected current step still lights its connector, as it always has.
  const connectorClass = (state) => {
    if (state === "done") return "done";
    if (state === "active") return "active";
    return company || state === "pending" ? "" : "active";
  };

  const containerClass = ["qws-container", compact && "compact", company && "company"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <div className="qws-steps">
        {stagesList.map((stage, idx) => {
          const stepNum = idx + 1;
          const state = stepStates[idx];
          const isDone = stepChecked[idx];
          const Icon = stage.icon;
          const note = company?.notes?.[stepNum];

          return (
            <React.Fragment key={stage.id}>
              <div className={`qws-step-node ${state}`}>
                <div className="qws-marker">
                  {isDone ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : state === "rejected" ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <Icon size={14} />
                  )}
                </div>
                <div className="qws-info">
                  <span className="qws-step-title">{stage.name}</span>
                  <span className="qws-actor-badge">{stage.actor}</span>
                  {note && <span className="qws-step-sub">{note}</span>}
                </div>
              </div>
              {idx < stagesList.length - 1 && (
                <div className={`qws-connector ${connectorClass(state)}`} />
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
              style={{ backgroundColor: `${statusColor}15`, color: statusColor, borderColor: `${statusColor}40` }}
            >
              {statusLabel}
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
            <span className="qws-meta-actor">{activeReviewer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
