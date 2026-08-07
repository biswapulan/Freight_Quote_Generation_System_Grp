import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getTawkIdentity } from "../api/auth";
import { useAuth } from "../context/AuthContext";

const SCRIPT_ID = "tawk-to-widget";
const SCRIPT_URL = "https://embed.tawk.to/6a75be34e014d81d4ab62026/1jvduu0r0";

export function openSupportChat() {
  window.__openTawkChat = true;
  window.Tawk_API?.showWidget?.();
  window.Tawk_API?.maximize?.();
}

export default function TawkChat() {
  const { token, user } = useAuth();
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isSupportPage = location.pathname === "/dashboard/support";
  const shouldLoadWidget = isLandingPage || isSupportPage;

  useEffect(() => {
    if (!shouldLoadWidget || document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = SCRIPT_URL;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.head.appendChild(script);
  }, [shouldLoadWidget]);

  useEffect(() => {
    const updateWidgetVisibility = () => {
      if (isLandingPage) {
        window.__openTawkChat = false;
        window.Tawk_API?.showWidget?.();
      } else if (isSupportPage && window.__openTawkChat) {
        window.Tawk_API?.showWidget?.();
        window.Tawk_API?.maximize?.();
      } else {
        window.Tawk_API?.hideWidget?.();
      }
    };

    updateWidgetVisibility();
    window.Tawk_API = window.Tawk_API || {};
    const previousOnLoad = window.Tawk_API.onLoad;
    window.Tawk_API.onLoad = () => {
      previousOnLoad?.();
      updateWidgetVisibility();
    };
  }, [isLandingPage, isSupportPage]);

  useEffect(() => {
    if (!user || !token) {
      window.Tawk_API?.logout?.();
      return;
    }
    getTawkIdentity(token).then((identity) => {
      const login = () => window.Tawk_API?.login?.(identity, () => {});
      if (window.Tawk_API?.login) return login();
      window.Tawk_API = window.Tawk_API || {};
      const previousOnLoad = window.Tawk_API.onLoad;
      window.Tawk_API.onLoad = () => { previousOnLoad?.(); login(); };
    }).catch(() => {});
  }, [token, user]);

  return null;
}
