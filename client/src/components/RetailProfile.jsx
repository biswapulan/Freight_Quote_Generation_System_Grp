import { useEffect, useState } from "react";
import { FaCheckCircle, FaEnvelope, FaLock, FaUser } from "react-icons/fa";
import { updateProfile } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import "./RetailProfile.css";

export default function RetailProfile() {
  const { token, user, updateUser } = useAuth();
  const [email, setEmail] = useState(user.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => setEmail(user.email || ""), [user.email]);

  async function saveEmail(event) {
    event.preventDefault();
    setEmailError("");
    setEmailStatus("");
    if (email.trim().toLowerCase() === user.email.toLowerCase()) {
      setEmailError("Enter a different email address to update it.");
      return;
    }

    setSavingEmail(true);
    try {
      const profile = await updateProfile(token, { email: email.trim() });
      updateUser(profile);
      setEmailStatus("Email address updated successfully.");
    } catch (error) {
      setEmailError(error.message || "Unable to update your email address.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordStatus("");
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await updateProfile(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password updated successfully.");
    } catch (error) {
      setPasswordError(error.message || "Unable to update your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="retail-profile" aria-labelledby="retail-profile-title">
      <header className="retail-profile__header">
        <p className="retail-profile__eyebrow">Account settings</p>
        <h1 id="retail-profile-title">Profile</h1>
        <p>View your account details and keep your sign-in information current.</p>
      </header>

      <div className="retail-profile__grid">
        <article className="retail-profile__card retail-profile__summary">
          <div className="retail-profile__avatar" aria-hidden="true">
            {user.full_name?.trim().charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <p className="retail-profile__label">Retail account</p>
            <h2>{user.full_name}</h2>
          </div>
          <dl className="retail-profile__details">
            <div><dt><FaUser /> Name</dt><dd>{user.full_name}</dd></div>
            <div><dt><FaEnvelope /> Email address</dt><dd>{user.email}</dd></div>
          </dl>
        </article>

        <div className="retail-profile__forms">
          <form className="retail-profile__card" onSubmit={saveEmail}>
            <div className="retail-profile__card-heading"><FaEnvelope /><div><h2>Email address</h2><p>Used to sign in and receive account updates.</p></div></div>
            <label htmlFor="profile-email">Email address</label>
            <input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
            {emailError && <p className="retail-profile__message retail-profile__message--error">{emailError}</p>}
            {emailStatus && <p className="retail-profile__message retail-profile__message--success"><FaCheckCircle /> {emailStatus}</p>}
            <button type="submit" disabled={savingEmail}>{savingEmail ? "Saving..." : "Save email address"}</button>
          </form>

          <form className="retail-profile__card" onSubmit={savePassword}>
            <div className="retail-profile__card-heading"><FaLock /><div><h2>Password</h2><p>Use at least 8 characters and keep it private.</p></div></div>
            <label htmlFor="profile-current-password">Current password</label>
            <input id="profile-current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" />
            <label htmlFor="profile-new-password">New password</label>
            <input id="profile-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="8" required autoComplete="new-password" />
            <label htmlFor="profile-confirm-password">Confirm new password</label>
            <input id="profile-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="8" required autoComplete="new-password" />
            {passwordError && <p className="retail-profile__message retail-profile__message--error">{passwordError}</p>}
            {passwordStatus && <p className="retail-profile__message retail-profile__message--success"><FaCheckCircle /> {passwordStatus}</p>}
            <button type="submit" disabled={savingPassword}>{savingPassword ? "Updating..." : "Update password"}</button>
          </form>
        </div>
      </div>
    </section>
  );
}
