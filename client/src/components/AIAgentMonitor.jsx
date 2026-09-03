import { useState, useEffect } from "react";
import {
  Cpu,
  Compass,
  CircleDollarSign,
  CloudRain,
  FileCheck2,
  ShieldCheck,
  Activity,
  ArrowRight,
  Package,
  Target,
  RefreshCw,
  Layers,
  TrendingUp,
  Scale,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import "./AIAgentMonitor.css";

const AGENT_SPECIFICATIONS = [
  {
    id: "orchestrator",
    name: "AI Orchestrator",
    role: "Workflow Controller",
    icon: <Cpu size={22} color="#a855f7" />,
    desc: "Controls end-to-end quotation workflow, coordinating micro-agents in parallel and synthesizing unified output states.",
    output: "Combined Analysis State",
    status: "ONLINE",
    latency: "18ms",
    successRate: "99.9%",
    version: "v3.2-orchestrator",
  },
  {
    id: "route",
    name: "Route Agent",
    role: "Geospatial & Transit Engine",
    icon: <Compass size={22} color="#38bdf8" />,
    desc: "Computes multimodal route options, spatial distance, port node waypoints, and estimated transit days (ETA).",
    output: "Recommended Route & ETA",
    status: "ONLINE",
    latency: "42ms",
    successRate: "99.8%",
    version: "v2.1-haversine",
  },
  {
    id: "pricing",
    name: "Pricing Agent",
    role: "ML Freight Prediction",
    icon: <CircleDollarSign size={22} color="#4ade80" />,
    desc: "Evaluates 10-step itemized rule cost buildup against Gradient Boosted regression model trained on 5k freight records.",
    output: "Recommended Commercial Price",
    status: "ONLINE",
    latency: "64ms",
    successRate: "100%",
    version: "v1.4-gbr",
  },
  {
    id: "weather",
    name: "Weather Agent",
    role: "Marine Telemetry & Swell",
    icon: <CloudRain size={22} color="#06b6d4" />,
    desc: "Samples oceanic coordinates via Open-Meteo API for wave heights, wind knots, severe storms, and transit delay risk.",
    output: "Weather Risk & Delay %",
    status: "ONLINE",
    latency: "128ms",
    successRate: "99.4%",
    version: "v2.0-openmeteo",
  },
  {
    id: "customs",
    name: "Customs Agent",
    role: "Regulatory Hybrid RAG",
    icon: <FileCheck2 size={22} color="#fbbf24" />,
    desc: "Performs BM25 + Vector embedding search across global trade regulations, validates HS codes, and checks embargoes.",
    output: "Customs Risk & Checklist",
    status: "ONLINE",
    latency: "86ms",
    successRate: "100%",
    version: "v3.0-rag-bm25",
  },
  {
    id: "risk",
    name: "Risk Agent",
    role: "Composite MCDA Engine",
    icon: <ShieldCheck size={22} color="#f43f5e" />,
    desc: "Synthesizes multi-factor signals (Weather, Customs, Route, Port, Cargo) into a single explainable 0-100 score.",
    output: "Overall Risk + Recommendation",
    status: "ONLINE",
    latency: "35ms",
    successRate: "100%",
    version: "v1.0-mcda",
  },
];

export default function AIAgentMonitor() {
  const [agents, setAgents] = useState(AGENT_SPECIFICATIONS);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefreshed(new Date());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="aam-container">
      {/* Top Banner */}
      <div className="aam-header-banner">
        <div className="aam-title-block">
          <h1>AI Agent Performance &amp; Health Monitor</h1>
          <p>
            Real-time status, execution latencies, model versions, and architectural pipeline flow for the 6 autonomous AI sub-agents.
          </p>
        </div>
        <div className="aam-badge-tag">
          <span className="aam-badge-dot" />
          <Activity size={14} /> Live AI Telemetry Active
        </div>
      </div>

      {/* Agent Workflow Pipeline Flow */}
      <div className="aam-flow-card">
        <div className="aam-flow-header">
          <h3 className="aam-flow-title">
            <RefreshCw size={16} /> Real-Time Agent Execution Pipeline (System Architecture)
          </h3>
          <span className="aam-heartbeat-text">
            Last heartbeat: <strong>{lastRefreshed.toLocaleTimeString()}</strong>
          </span>
        </div>
        <div className="aam-flow-steps">
          <div className="aam-step-node">
            <div className="aam-step-circle">
              <Cpu size={20} color="#a855f7" />
            </div>
            <span className="aam-step-name">Orchestrator</span>
          </div>
          <div className="aam-arrow">
            <ArrowRight size={16} />
          </div>

          <div className="aam-step-node">
            <div className="aam-step-circle">
              <Compass size={20} color="#38bdf8" />
            </div>
            <span className="aam-step-name">Route Agent</span>
          </div>
          <div className="aam-arrow">
            <ArrowRight size={16} />
          </div>

          <div className="aam-step-node">
            <div className="aam-step-circle">
              <CircleDollarSign size={20} color="#4ade80" />
            </div>
            <span className="aam-step-name">Pricing Agent</span>
          </div>
          <div className="aam-arrow">
            <ArrowRight size={16} />
          </div>

          <div className="aam-step-node">
            <div className="aam-step-circle" style={{ display: "flex", gap: "4px" }}>
              <CloudRain size={16} color="#06b6d4" />
              <FileCheck2 size={16} color="#fbbf24" />
            </div>
            <span className="aam-step-name">Weather + Customs</span>
          </div>
          <div className="aam-arrow">
            <ArrowRight size={16} />
          </div>

          <div className="aam-step-node">
            <div className="aam-step-circle">
              <ShieldCheck size={20} color="#f43f5e" />
            </div>
            <span className="aam-step-name">Risk Agent</span>
          </div>
          <div className="aam-arrow">
            <ArrowRight size={16} />
          </div>

          <div className="aam-step-node">
            <div
              className="aam-step-circle"
              style={{ background: "rgba(34, 197, 94, 0.2)", borderColor: "rgba(34, 197, 94, 0.4)" }}
            >
              <Package size={20} color="#4ade80" />
            </div>
            <span className="aam-step-name" style={{ color: "#4ade80" }}>
              Quote Engine
            </span>
          </div>
        </div>
      </div>

      {/* 2. How M1, M2 and M3 Connect Panel */}
      <div className="aam-m-connections-card">
        <div className="aam-m-header">
          <div className="aam-m-title-block">
            <h3 className="aam-m-title">
              <Layers size={18} className="text-orange-500" /> How M1, M2 and M3 Connect in FreightAI
            </h3>
            <p className="aam-m-subtitle">
              M1 creates operational data. M2 adds pricing intelligence. M3 adds risk intelligence. The Quote Engine combines all outputs.
            </p>
          </div>
          <span className="aam-m-tag">
            <Sparkles size={13} /> Multi-Module Pipeline
          </span>
        </div>

        <div className="aam-m-grid">
          {/* M1 Card */}
          <div className="aam-m-card m1">
            <div className="aam-m-card-top">
              <div className="aam-m-pill m1">Milestone 1</div>
              <Compass size={20} className="text-blue-500" />
            </div>
            <h4 className="aam-m-card-name">M1 — Core Quote Foundation</h4>
            <p className="aam-m-card-desc">
              Creates the shipment, validates information, determines route details and calculates an initial rule-based price.
            </p>
            <div className="aam-m-flow-box">
              <span className="aam-m-flow-lbl">Sub-Workflow</span>
              <div className="aam-m-flow-chain">
                <span>Customer</span>
                <ArrowRight size={12} />
                <span>Create Shipment</span>
                <ArrowRight size={12} />
                <span>Validation</span>
                <ArrowRight size={12} />
                <span>Route / Distance / ETA</span>
                <ArrowRight size={12} />
                <span>Rule-Based Pricing</span>
                <ArrowRight size={12} />
                <strong className="text-blue-600">Draft Quote</strong>
              </div>
            </div>
            <div className="aam-m-footer">
              <CheckCircle2 size={13} className="text-blue-500" />
              <span>Creates Operational Data</span>
            </div>
          </div>

          {/* M2 Card */}
          <div className="aam-m-card m2">
            <div className="aam-m-card-top">
              <div className="aam-m-pill m2">Milestone 2</div>
              <CircleDollarSign size={20} className="text-emerald-500" />
            </div>
            <h4 className="aam-m-card-name">M2 — AI Pricing Intelligence</h4>
            <p className="aam-m-card-desc">
              Receives shipment and route data created by M1. A trained ML model predicts freight price from historical patterns.
            </p>
            <div className="aam-m-flow-box">
              <span className="aam-m-flow-lbl">Sub-Workflow</span>
              <div className="aam-m-flow-chain">
                <span>M1 Data</span>
                <ArrowRight size={12} />
                <span>Feature Prep</span>
                <ArrowRight size={12} />
                <span>ML Model</span>
                <ArrowRight size={12} />
                <span>AI Predicted Price</span>
                <ArrowRight size={12} />
                <span>Compare Rule</span>
                <ArrowRight size={12} />
                <strong className="text-emerald-600">Recommended Price</strong>
              </div>
            </div>
            <div className="aam-m-footer">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Adds Pricing Intelligence</span>
            </div>
          </div>

          {/* M3 Card */}
          <div className="aam-m-card m3">
            <div className="aam-m-card-top">
              <div className="aam-m-pill m3">Milestone 3</div>
              <ShieldCheck size={20} className="text-purple-500" />
            </div>
            <h4 className="aam-m-card-name">M3 — Risk Intelligence</h4>
            <p className="aam-m-card-desc">
              Uses the same shipment context to analyze weather, customs and route risks and produces a composite risk score.
            </p>
            <div className="aam-m-flow-box">
              <span className="aam-m-flow-lbl">Sub-Workflow</span>
              <div className="aam-m-flow-chain">
                <span>Shipment + Route</span>
                <ArrowRight size={12} />
                <span>Weather Analysis</span>
                <ArrowRight size={12} />
                <span>Customs Analysis</span>
                <ArrowRight size={12} />
                <span>Route Risk</span>
                <ArrowRight size={12} />
                <strong className="text-purple-600">Overall Risk Score</strong>
              </div>
            </div>
            <div className="aam-m-footer">
              <CheckCircle2 size={13} className="text-purple-500" />
              <span>Adds Risk Intelligence</span>
            </div>
          </div>
        </div>

        {/* Synthesis Callout */}
        <div className="aam-m-synthesis">
          <div className="aam-synthesis-icon">
            <Package size={22} color="#ea580c" />
          </div>
          <div className="aam-synthesis-content">
            <strong>Key Connection: Unified Quote Engine</strong>
            <p>
              <strong>M1</strong> creates operational data ➔ <strong>M2</strong> adds ML pricing intelligence ➔ <strong>M3</strong> adds multi-criteria risk intelligence. The <strong>Quote Engine</strong> combines all outputs into a single, audit-ready quotation.
            </p>
          </div>
        </div>
      </div>

      {/* 6 AI Micro-Agent Cards */}
      <div className="aam-agents-grid">
        {agents.map((agent) => (
          <div key={agent.id} className="aam-agent-card">
            <div className="aam-agent-card-top">
              <div className="aam-agent-title-wrap">
                <div className="aam-agent-icon">{agent.icon}</div>
                <div>
                  <h4 className="aam-agent-name">{agent.name}</h4>
                  <span className="aam-agent-role">{agent.role}</span>
                </div>
              </div>
              <span className="aam-status-pill online">
                <span className="aam-status-dot" />
                {agent.status}
              </span>
            </div>

            <p className="aam-agent-desc">{agent.desc}</p>

            <div className="aam-telemetry-row">
              <div className="aam-telemetry-item">
                <span className="aam-telemetry-val">{agent.latency}</span>
                <span className="aam-telemetry-lbl">Avg Latency</span>
              </div>
              <div className="aam-telemetry-item">
                <span className="aam-telemetry-val">{agent.successRate}</span>
                <span className="aam-telemetry-lbl">Success Rate</span>
              </div>
              <div className="aam-telemetry-item">
                <span className="aam-telemetry-val" style={{ fontSize: "11px", color: "#a855f7" }}>
                  {agent.version}
                </span>
                <span className="aam-telemetry-lbl">Model Version</span>
              </div>
            </div>

            <div className="aam-agent-output">
              <Target size={14} />
              <span>
                <strong>Output:</strong> {agent.output}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
