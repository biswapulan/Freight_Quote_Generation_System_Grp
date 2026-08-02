import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaShip } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

function Dashboard() {
const navigate = useNavigate();
const { user, logout } = useAuth();

useEffect(() => {
if (!user) {
navigate("/login");
}
}, [user, navigate]);

function handleLogout() {
logout();
navigate("/login");
}

if (!user) {
return null;
}

return (
<main className="dashboard-page">
<section className="dashboard-panel">
<div className="dashboard-brand">
<FaShip className="dashboard-ship" />
<span>FreightAI</span>
</div>

<div className="dashboard-content">
<p className="dashboard-kicker">Account dashboard</p>
<h1>Welcome, {user.fullName}</h1>
<p>This is your dashboard.</p>
<p className="team-message">hey team start building form here. Authentication done.</p>
</div>

<button type="button" className="dashboard-logout" onClick={handleLogout}>
Log Out
</button>
</section>
</main>
);
}

export default Dashboard;
