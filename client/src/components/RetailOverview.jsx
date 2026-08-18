import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  PackageCheck,
  Clock3,
  Wallet,
  Bell,
  MapPin,
  Truck,
  LifeBuoy,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { FaFlag, FaGlobeAsia, FaBoxOpen, FaBolt, FaGlobe, FaDollarSign } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useRetailQuotes } from "../context/RetailQuotesContext";
import "./RetailOverview.css";

// ---------------------------------------------------------------------------
// Static seed content. Neither list is backed by an API yet — both follow
// the same "seed array" pattern as RetailQuotesContext so they're easy to
// extend or swap for a real feed/offers endpoint later.
// ---------------------------------------------------------------------------

const NOTICES = [
  {
    category: "Pricing",
    accent: "amber",
    headline: "BAF increased to 14% on INNSA–NLRTM lane",
    time: "2 days ago",
  },
  {
    category: "Route news",
    accent: "blue",
    headline: "New weekly direct service added: INNSA → SGSIN",
    time: "3 days ago",
  },
  {
    category: "Advisory",
    accent: "slate",
    headline: "Port congestion easing at Jebel Ali, dwell time down to 2.1 days",
    time: "4 days ago",
  },
  {
    category: "Customs",
    accent: "amber",
    headline: "UAE now requires digital COO for textile HS codes from 15 Aug",
    time: "5 days ago",
  },
  {
    category: "Route news",
    accent: "blue",
    headline: "Lane suspended: INNSA → PECLL — no vessel coverage until further notice",
    time: "6 days ago",
  },
  {
    category: "Pricing",
    accent: "amber",
    headline: "Peak season surcharge of $350/40ft starts next week on transpacific lanes",
    time: "1 week ago",
  },
  {
    category: "Advisory",
    accent: "slate",
    headline: "Red Sea diversions adding 9–12 days to Europe-bound ocean transit",
    time: "1 week ago",
  },
  {
    category: "Route news",
    accent: "blue",
    headline: "New trade lane opened: Mumbai (INNSA) → Colombo (LKCMB)",
    time: "2 weeks ago",
  },
];

const CATEGORY_CLASS = {
  Pricing: "cat-pricing",
  Customs: "cat-customs",
  "Route news": "cat-route",
  Advisory: "cat-advisory",
};

// Same shape as SpecialOffers (icon, badge, title, description, stat),
// repackaged for a logged-in retail account holder.
const OFFERS = [
  {
    icon: <FaFlag />,
    badge: "Independence Day Offer",
    title: "25% Off All Shipments",
    desc: "Book any shipment this week and save big on freight costs.",
    stat: "25% OFF · Limited week",
    slug: "independence-day-25",
  },
  {
    icon: <FaGlobeAsia />,
    badge: "World Trade Day Offer",
    title: "Free Customs Assistance",
    desc: "Complimentary customs documentation on all international shipments.",
    stat: "Free add-on · This month",
    slug: "free-customs-assist",
  },
  {
    icon: <FaBoxOpen />,
    badge: "First Shipment Offer",
    title: "Flat 30% Off Your First Order",
    desc: "New to FreightAI? Get 30% off your very first shipment.",
    stat: "30% OFF · New customers",
    slug: "first-shipment-30",
  },
  {
    icon: <FaBolt />,
    badge: "Fast Delivery",
    title: "Priority Handling",
    desc: "Priority shipment handling with optimized delivery routes.",
    stat: "Up to 40% faster",
    slug: "priority-handling",
  },
  {
    icon: <FaGlobe />,
    badge: "Global Network",
    title: "Worldwide Coverage",
    desc: "Connect with our international logistics network.",
    stat: "120+ countries",
    slug: "global-coverage",
  },
  {
    icon: <FaDollarSign />,
    badge: "Cost Savings",
    title: "Smart AI Pricing",
    desc: "AI-based pricing helps reduce unnecessary transportation costs.",
    stat: "Smart pricing",
    slug: "smart-ai-pricing",
  },
];

const STATUS_COLORS = {
  Draft: "#94a3b8",
  Issued: "#16a34a",
  Booked: "#ff9800",
  "No routing": "#f59e0b",
};

const STATUS_PILL_CLASS = {
  Draft: "draft",
  Issued: "issued",
  Booked: "booked",
  "No routing": "norouting",
};

const QUICK_ACTIONS = [
  {
    label: "Generate quote",
    sub: "Start a new freight enquiry",
    icon: PlusCircle,
    to: "/dashboard/generate-quote",
  },
  {
    label: "Saved addresses",
    sub: "Manage pickup & delivery points",
    icon: MapPin,
    to: "/dashboard/saved-addresses",
  },
  {
    label: "Carriers",
    sub: "Browse partner carrier network",
    icon: Truck,
    to: "/dashboard/carriers",
  },
  {
    label: "Support",
    sub: "Get help with a shipment",
    icon: LifeBuoy,
    to: "/dashboard/support",
  },
];

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function RetailOverview() {
  const { user } = useAuth();
  const { quotations, loading, reloadQuotes } = useRetailQuotes();

  useEffect(() => {
    reloadQuotes();
  }, [reloadQuotes]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const stats = useMemo(() => {
    const totalQuotes = quotations.length;
    const booked = quotations.filter((q) => q.status === "Booked").length;
    const awaitingRouting = quotations.filter((q) => q.status === "Draft").length;
    const totalSpend = quotations.reduce((sum, q) => sum + (q.totalNum || 0), 0);
    return { totalQuotes, booked, awaitingRouting, totalSpend };
  }, [quotations]);

  const statusBreakdown = useMemo(() => {
    const counts = {};
    quotations.forEach((q) => {
      counts[q.status] = (counts[q.status] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        count,
        color: STATUS_COLORS[status] || "#94a3b8",
      }));
  }, [quotations]);

  const donutGradient = useMemo(() => {
    const total = quotations.length || 1;
    let cursor = 0;
    const stops = statusBreakdown.map(({ color, count }) => {
      const start = (cursor / total) * 360;
      cursor += count;
      const end = (cursor / total) * 360;
      return `${color} ${start}deg ${end}deg`;
    });
    return stops.length ? `conic-gradient(${stops.join(", ")})` : "#e2e8f0";
  }, [statusBreakdown, quotations.length]);

  const recentActivity = quotations.slice(0, 5);
  const firstName = (user?.full_name || "there").split(" ")[0];

  return (
    <div className="ov-page">
      {/* 1. Welcome strip */}
      <section className="ov-hero">
        <div className="ov-hero-text">
          <div className="ov-hero-kicker">Retail account</div>
          <h1 className="ov-hero-title">Welcome back, {firstName}</h1>
          <div className="ov-hero-date">{todayLabel}</div>
        </div>
        <Link to="/dashboard/generate-quote" className="ov-hero-cta">
          <PlusCircle size={17} /> Generate quote
        </Link>
      </section>

      {/* 2. KPI row */}
      <section className="ov-kpis">
        <div className="ov-kpi-card">
          <div className="ov-kpi-icon tone-navy"><FileText size={20} /></div>
          <div className="ov-kpi-body">
            <div className="ov-kpi-title">Total quotes</div>
            <div className="ov-kpi-value">{stats.totalQuotes}</div>
            <div className="ov-kpi-sub slate">all time, this account</div>
          </div>
        </div>
        <div className="ov-kpi-card">
          <div className="ov-kpi-icon tone-green"><PackageCheck size={20} /></div>
          <div className="ov-kpi-body">
            <div className="ov-kpi-title">Booked shipments</div>
            <div className="ov-kpi-value">{stats.booked}</div>
            <div className="ov-kpi-sub green">confirmed & moving</div>
          </div>
        </div>
        <div className="ov-kpi-card">
          <div className="ov-kpi-icon tone-amber"><Clock3 size={20} /></div>
          <div className="ov-kpi-body">
            <div className="ov-kpi-title">Awaiting routing</div>
            <div className="ov-kpi-value">{stats.awaitingRouting}</div>
            <div className="ov-kpi-sub slate">drafts needing a route</div>
          </div>
        </div>
        <div className="ov-kpi-card">
          <div className="ov-kpi-icon tone-orange"><Wallet size={20} /></div>
          <div className="ov-kpi-body">
            <div className="ov-kpi-title">Total spend</div>
            <div className="ov-kpi-value">{INR.format(stats.totalSpend)}</div>
            <div className="ov-kpi-sub slate">value of raised quotes</div>
          </div>
        </div>
      </section>

      {/* 3. Latest Updates — notice board */}
      <section className="ov-card ov-notices">
        <div className="ov-card-head">
          <span className="ov-card-title"><Bell size={15} className="ov-notices-icon" /> Latest updates</span>
          <span className="ov-card-sub">Things that changed since you last looked</span>
        </div>
        <div className="ov-notice-list">
          {NOTICES.map((n, i) => (
            <div className={`ov-notice-row accent-${n.accent}`} key={i}>
              <span className={`ov-notice-tag ${CATEGORY_CLASS[n.category]}`}>{n.category}</span>
              <span className="ov-notice-headline">{n.headline}</span>
              <span className="ov-notice-time">{n.time}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Offers */}
      <section className="ov-offers">
        <div className="ov-offers-head">
          <div>
            <div className="ov-offers-eyebrow">Special offers</div>
            <div className="ov-offers-title">Exclusive logistics benefits</div>
          </div>
        </div>
        <div className="ov-offers-grid">
          {OFFERS.map((offer) => (
            <div className="ov-offer-card" key={offer.slug}>
              <div className="ov-offer-top">
                <div className="ov-offer-icon">{offer.icon}</div>
                <span className="ov-offer-badge">{offer.badge}</span>
              </div>
              <h3>{offer.title}</h3>
              <p>{offer.desc}</p>
              <div className="ov-offer-stat">{offer.stat}</div>
              <Link to={`/dashboard/generate-quote?promo=${offer.slug}`} className="ov-offer-cta">
                Apply to next quote <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Shipments by status (doughnut) + Recent activity */}
      <section className="ov-split">
        <div className="ov-card ov-status-card">
          <div className="ov-card-head">
            <span className="ov-card-title">Shipments by status</span>
          </div>
          <div className="ov-donut-wrap">
            <div className="ov-donut" style={{ background: donutGradient }}>
              <div className="ov-donut-hole">
                <div className="ov-donut-hole-value">{quotations.length}</div>
                <div className="ov-donut-hole-label">total</div>
              </div>
            </div>
            <div className="ov-legend">
              {statusBreakdown.map(({ status, count, color }) => (
                <div className="ov-legend-row" key={status}>
                  <span className="ov-legend-dot" style={{ background: color }} />
                  <span className="ov-legend-label">{status}</span>
                  <span className="ov-legend-value">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ov-card ov-activity-card">
          <div className="ov-card-head">
            <span className="ov-card-title">Recent activity</span>
            <Link to="/dashboard/shipments-history" className="ov-card-sub">View all</Link>
          </div>
          <div className="ov-activity-list">
            {recentActivity.length === 0 ? (
              <div className="ov-activity-detail">No quotes yet — generate your first one to see it here.</div>
            ) : (
              recentActivity.map((q) => (
                <div className="ov-activity-row" key={q.quoteNo}>
                  <div className="ov-activity-main">
                    <div className="ov-activity-quote">{q.quoteNo}</div>
                    <div className="ov-activity-detail">
                      {q.customerName} · {q.laneCode}
                    </div>
                  </div>
                  <div className="ov-activity-right">
                    <span className={`ov-status-pill ${STATUS_PILL_CLASS[q.status] || "draft"}`}>{q.status}</span>
                    <span className="ov-activity-time">{q.created}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 6. Quick action tiles */}
      <section className="ov-quick-grid">
        {QUICK_ACTIONS.map(({ label, sub, icon: Icon, to }) => (
          <Link className="ov-quick-tile" to={to} key={label}>
            <div className="ov-quick-icon"><Icon size={20} /></div>
            <div>
              <div className="ov-quick-title">{label}</div>
              <div className="ov-quick-sub">{sub}</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
