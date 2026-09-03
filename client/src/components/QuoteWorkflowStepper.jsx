import React from "react";
import { Check, Clock, AlertTriangle, ShieldCheck, Cpu, User, FileCheck } from "lucide-react";
import { STATUS_CONFIG, normalizeWorkflowStatus } from "../utils/quoteWorkflow";
import "./QuoteWorkflowStepper.css";

const STAGES = [
  { id: "REQUESTED", name: "1. Requested", actor: "Customer", icon: User },
  { id: "AI_ANALYZED", name: "2. AI Analyzed", actor: "AI Engine", icon: Cpu },
  { id: "CUSTOMS_REVIEWED", name: "3. Customs Review", actor: "Customs Officer", icon: ShieldCheck },
  { id: "FINAL_QUOTE_SENT", name: "4. Final Quote Sent", actor: "Freight Agent", icon: FileCheck },
  { id: "ACCEPTED", name: "5. Customer Decision", actor: "Customer", icon: Check },
];

export default function QuoteWorkflowStepper({ status, requiresCustoms = true, compact = false }) {
  const normStatus = normalizeWorkflowStatus(status);
  const currentConfig = STATUS_CONFIG[normStatus] || STATUS_CONFIG.REQUESTED;
  const currentStep = currentConfig.stepIndex || 1;
  const isRejected = normStatus === "REJECTED";
  const isFlagged = normStatus === "CUSTOMS_FLAGGED";

  return (
    <div className={`qws-container ${compact ? "compact" : ""}`}>
      <div className="qws-steps">
        {STAGES.map((stage, idx) => {
          const stepNum = idx + 1;
          const isDone = currentStep > stepNum || (stepNum === 5 && normStatus === "ACCEPTED");
          const isActive = currentStep === stepNum;
          const Icon = stage.icon;

          let stepClass = "pending";
          if (isDone) stepClass = "done";
          if (isActive) {
            if (isRejected && stepNum === 5) stepClass = "rejected";
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
              {idx < STAGES.length - 1 && (
                <div className={`qws-connector ${isDone ? "done" : isActive ? "active" : ""}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
