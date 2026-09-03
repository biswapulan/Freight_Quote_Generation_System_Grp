import "./Logo.css";
import "./AuthPage.css";
import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheck, FaEnvelope, FaLock, FaUser, FaArrowLeft, FaSpinner, FaShieldAlt, FaBoxes, FaGlobeAmericas, FaCog, FaCrosshairs, FaBuilding, FaShoppingCart } from "react-icons/fa";
import { login as loginRequest, signup, forgotPassword } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

function AuthPage() {
const navigate = useNavigate();
const auth = useAuth();
const [searchParams] = useSearchParams();

const [mode, setMode] = useState(
  searchParams.get("mode") === "signup" ? "signup" : "login"
); // login | forgot | signup

const [showPassword, setShowPassword] = useState(false);
const [loading, setLoading] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

const [loginData, setLoginData] = useState({ email: "", password: "" });

const [forgotEmail, setForgotEmail] = useState("");
const [resetSent, setResetSent] = useState(false);

const [step, setStep] = useState(1);

const [signupData, setSignupData] = useState({
fullName: "",
email: "",
password: "",
confirmPassword: "",
role: "retail",
companyName: "",
gstNumber: "",
});

const [signupDone, setSignupDone] = useState(false);

function switchMode(next) {
setMode(next);
setStep(1);
setResetSent(false);
setSignupDone(false);
setShowPassword(false);
setErrorMsg("");
setLoading(false);
}

// ---- Demo offline credentials (used when Django backend is not running) ----
const DEMO_USERS = {
  "admin@freightai.com":    { token: "demo-token-admin",    role: "admin",    name: "Admin User",      email: "admin@freightai.com",    companyName: "FreightAI HQ" },
  "agent@freightai.com":   { token: "demo-token-agent",    role: "agent",    name: "Freight Agent",    email: "agent@freightai.com",    companyName: "FreightAI HQ" },
  "business@freightai.com":{ token: "demo-token-biz",      role: "business", name: "Business User",    email: "business@freightai.com", companyName: "Apex Exports Pvt Ltd" },
  "retail@freightai.com":  { token: "demo-token-retail",   role: "retail",   name: "Retail Customer",  email: "retail@freightai.com",   companyName: null },
};
const DEMO_PASSWORD = "demo123";

async function handleLoginSubmit(e) {
e.preventDefault();
setErrorMsg("");
setLoading(true);

try {
  const data = await loginRequest(loginData);
  auth.login(data);
  navigate("/dashboard");
} catch {
  // Backend unreachable — try demo offline credentials
  const demoUser = DEMO_USERS[loginData.email.toLowerCase().trim()];
  if (demoUser && loginData.password === DEMO_PASSWORD) {
    auth.login(demoUser);
    navigate("/dashboard");
  } else if (demoUser) {
    setErrorMsg("Demo password is: demo123");
  } else {
    setErrorMsg("Unable to connect to server. Use a demo account below to explore the platform.");
  }
} finally {
  setLoading(false);
}
}

function demoLogin(email) {
  const demoUser = DEMO_USERS[email];
  if (demoUser) {
    auth.login(demoUser);
    navigate("/dashboard");
  }
}

async function handleForgotSubmit(e) {
e.preventDefault();
setErrorMsg("");
setLoading(true);

try {
await forgotPassword({ email: forgotEmail });
setResetSent(true);
} catch (error) {
setErrorMsg(error.message || "Unable to send reset link. Please try again.");
} finally {
setLoading(false);
}
}

function goNextStep(e) {
e.preventDefault();
setErrorMsg("");
if (step === 1 && signupData.fullName.trim().length < 2) return;
if (step === 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) return;
setStep((s) => Math.min(s + 1, 3));
}

function goBackStep() {
setErrorMsg("");
setStep((s) => Math.max(s - 1, 1));
}

async function handleSignupSubmit(e) {
e.preventDefault();
if (signupData.password.length < 8) return;
if (signupData.password !== signupData.confirmPassword) return;

setErrorMsg("");
setLoading(true);

try {
const data = await signup({
fullName: signupData.fullName,
email: signupData.email,
password: signupData.password,
role: signupData.role,
companyName: signupData.companyName,
gstNumber: signupData.gstNumber,
});
auth.login(data);
navigate("/dashboard");
} catch (error) {
setErrorMsg(error.message || "Unable to create account. Please try again.");
} finally {
setLoading(false);
}
}

const stepLabels = ["Details", "Email", "Password"];

return (
<div className="auth-page">

<div className="auth-brand-panel">

<div className="auth-brand-overlay"></div>

<div className="auth-brand-logo">
<Logo variant="white" size={40} />
</div>

<div className="auth-brand-copy">
<p className="auth-brand-eyebrow">Enterprise Logistics Platform</p>
<h1>Ship smarter with AI-powered freight quotes.</h1>
<p className="auth-brand-sub">
Join thousands of businesses managing global shipments, instant
quotes and live tracking from one intelligent dashboard.
</p>

<ul className="auth-brand-points">
<li><FaBoxes /> Instant AI freight quotations</li>
<li><FaGlobeAmericas /> 120+ countries supported</li>
<li><FaShieldAlt /> Secure, enterprise-grade access</li>
</ul>
</div>

<Link to="/" className="auth-brand-back">
&larr; Back to homepage
</Link>

</div>

<div className="auth-form-panel">

<div className="auth-logo-mobile">
<Logo variant="navy" size={34} />
</div>

<div className="auth-container">

<div className="auth-card">

{mode === "login" && (
<>
<div className="auth-header">
<h1>Welcome back</h1>
<p>Log in to manage your shipments and track cargo in real time.</p>
</div>

<form className="auth-form" onSubmit={handleLoginSubmit}>

<label className="field">
<span className="field-label">Email address</span>
<div className="input-wrap">
<FaEnvelope className="input-icon" />
<input
type="email"
placeholder="you@company.com"
required
value={loginData.email}
onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
/>
</div>
</label>

<label className="field">
<span className="field-label">Password</span>
<div className="input-wrap">
<FaLock className="input-icon" />
<input
type={showPassword ? "text" : "password"}
placeholder="Enter your password"
required
value={loginData.password}
onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
/>
<button
type="button"
className="toggle-visibility"
onClick={() => setShowPassword(!showPassword)}
aria-label="Toggle password visibility"
>
{showPassword ? <FaEyeSlash /> : <FaEye />}
</button>
</div>
</label>

{errorMsg && <p className="error-text">{errorMsg}</p>}

<div className="field-row">
<label className="remember">
<input type="checkbox" />
<span>Remember me</span>
</label>

<button type="button" className="link-btn" onClick={() => switchMode("forgot")}>
Forgot password?
</button>
</div>

<button type="submit" className="primary-btn" disabled={loading} aria-busy={loading}>
{loading ? <><FaSpinner className="button-loader" /> Logging in...</> : "Log In"}
</button>

<div
  style={{
    marginTop: "20px",
    borderTop: "1px solid #1e293b",
    paddingTop: "18px",
  }}
>
  <p style={{ fontSize: "12px", color: "#64748b", textAlign: "center", marginBottom: "12px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>
    Quick Demo Access
  </p>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
    {[
      { label: "Admin", icon: <FaCog size={12} />, email: "admin@freightai.com", color: "#dc2626" },
      { label: "Agent", icon: <FaCrosshairs size={12} />, email: "agent@freightai.com", color: "#0284c7" },
      { label: "Business", icon: <FaBuilding size={12} />, email: "business@freightai.com", color: "#7c3aed" },
      { label: "Retail", icon: <FaShoppingCart size={12} />, email: "retail@freightai.com", color: "#059669" },
    ].map(({ label, icon, email, color }) => (
      <button
        key={email}
        type="button"
        onClick={() => demoLogin(email)}
        style={{
          background: "transparent",
          border: `1px solid ${color}`,
          color: color,
          borderRadius: "8px",
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "700",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = color; e.currentTarget.style.color = "#fff"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = color; }}
      >
        {label}
      </button>
    ))}
  </div>
</div>

</form>

<p className="switch-line">
Don't have an account?{" "}
<button type="button" className="link-btn strong" onClick={() => switchMode("signup")}>
Sign up
</button>
</p>
</>
)}

{mode === "forgot" && (
<>
<button type="button" className="back-btn" onClick={() => switchMode("login")}>
<FaArrowLeft /> Back to login
</button>

{!resetSent ? (
<>
<div className="auth-header">
<h1>Reset your password</h1>
<p>Enter the email linked to your account and we'll send you a reset link.</p>
</div>

<form className="auth-form" onSubmit={handleForgotSubmit}>

<label className="field">
<span className="field-label">Email address</span>
<div className="input-wrap">
<FaEnvelope className="input-icon" />
<input
type="email"
placeholder="you@company.com"
required
value={forgotEmail}
onChange={(e) => setForgotEmail(e.target.value)}
/>
</div>
</label>

{errorMsg && <p className="error-text">{errorMsg}</p>}

<button type="submit" className="primary-btn" disabled={loading} aria-busy={loading}>
{loading ? <><FaSpinner className="button-loader" /> Sending...</> : "Send Reset Link"}
</button>

</form>
</>
) : (
<div className="success-state">
<div className="success-icon">
<FaCheck />
</div>
<h1>Check your inbox</h1>
<p>
We've sent a password reset link to <strong>{forgotEmail}</strong>. It should arrive within a
few minutes.
</p>
<button type="button" className="primary-btn" onClick={() => switchMode("login")}>
Return to Login
</button>
</div>
)}
</>
)}

{mode === "signup" && (
<>
{!signupDone ? (
<>
<div className="auth-header">
<h1>Create your account</h1>
<p>Get a FreightAI account to book, track and manage shipments.</p>
</div>

<div className="stepper">
{stepLabels.map((label, i) => {
const num = i + 1;
const state = num < step ? "done" : num === step ? "active" : "";
return (
<React.Fragment key={label}>
<div className={`step-dot ${state}`}>
<span className="dot-number">{num < step ? <FaCheck /> : num}</span>
<span className="dot-label">{label}</span>
</div>
{i < stepLabels.length - 1 && <div className={`step-line ${num < step ? "done" : ""}`}></div>}
</React.Fragment>
);
})}
</div>

<form
className="auth-form"
onSubmit={step === 3 ? handleSignupSubmit : goNextStep}
>

{step === 1 && (
<>
<label className="field">
<span className="field-label">Full name</span>
<div className="input-wrap">
<FaUser className="input-icon" />
<input
type="text"
placeholder="Jane Doe"
required
value={signupData.fullName}
onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
/>
</div>
</label>

{errorMsg && <p className="error-text">{errorMsg}</p>}
</>
)}

{step === 2 && (
<label className="field">
<span className="field-label">Email address</span>
<div className="input-wrap">
<FaEnvelope className="input-icon" />
<input
type="email"
placeholder="you@company.com"
required
value={signupData.email}
onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
/>
</div>
</label>
)}

{step === 3 && (
<>
<label className="field">
<span className="field-label">Password</span>
<div className="input-wrap">
<FaLock className="input-icon" />
<input
type={showPassword ? "text" : "password"}
placeholder="At least 8 characters"
required
minLength={8}
value={signupData.password}
onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
/>
<button
type="button"
className="toggle-visibility"
onClick={() => setShowPassword(!showPassword)}
aria-label="Toggle password visibility"
>
{showPassword ? <FaEyeSlash /> : <FaEye />}
</button>
</div>
</label>

<label className="field">
<span className="field-label">Confirm password</span>
<div className="input-wrap">
<FaLock className="input-icon" />
<input
type={showPassword ? "text" : "password"}
placeholder="Re-enter your password"
required
minLength={8}
value={signupData.confirmPassword}
onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
/>
</div>
</label>

{signupData.confirmPassword.length > 0 &&
signupData.password !== signupData.confirmPassword && (
<p className="error-text">Passwords don't match.</p>
)}

{errorMsg && <p className="error-text">{errorMsg}</p>}
</>
)}

<div className="step-actions">
{step > 1 && (
<button type="button" className="secondary-btn" onClick={goBackStep}>
Back
</button>
)}

<button type="submit" className="primary-btn" disabled={loading} aria-busy={loading}>
{loading ? <><FaSpinner className="button-loader" /> Creating account...</> : step === 3 ? "Create Account" : "Continue"}
</button>
</div>

</form>

<p className="switch-line">
Already have an account?{" "}
<button type="button" className="link-btn strong" onClick={() => switchMode("login")}>
Log in
</button>
</p>
</>
) : (
<div className="success-state">
<div className="success-icon">
<FaCheck />
</div>
<h1>You're all set, {signupData.fullName.split(" ")[0]}!</h1>
<p>Your FreightAI account has been created. You can now log in and start shipping smarter.</p>
<button type="button" className="primary-btn" onClick={() => switchMode("login")}>
Go to Login
</button>
</div>
)}
</>
)}

</div>

</div>

</div>

</div>
);

}

export default AuthPage;
