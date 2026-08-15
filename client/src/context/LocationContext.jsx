import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const LocationContext = createContext(null);

// Delhi is used as the fallback origin when location access isn't granted.
const DEFAULT_LOCATION = {
  lat: 28.6139,
  lng: 77.209,
  city: "Delhi",
};

export function LocationProvider({ children }) {
  const [status, setStatus] = useState("idle"); // idle | requesting | granted | denied | unsupported
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    function requestLocation() {
      setStatus("requesting");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let city = "Your Location";

          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 600);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
              { signal: controller.signal }
            );
            clearTimeout(timer);
            if (res.ok) {
              const data = await res.json();
              city =
                data?.address?.city ||
                data?.address?.town ||
                data?.address?.village ||
                data?.address?.state ||
                "Your Location";
            }
          } catch {
            // Reverse geocoding is a nice-to-have; fall back silently.
          }

          setLocation({ lat: latitude, lng: longitude, city });
          setStatus("granted");
        },
        () => {
          setLocation(DEFAULT_LOCATION);
          setStatus("denied");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    }

    requestLocation();

    // If the person changes the location permission later (e.g. via the
    // browser's address-bar padlock) after having denied/ignored it,
    // pick that up live instead of requiring a page reload.
    let permissionStatus;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          permissionStatus = result;
          permissionStatus.onchange = () => {
            if (permissionStatus.state === "granted") {
              requestLocation();
            } else if (permissionStatus.state === "denied") {
              setLocation(DEFAULT_LOCATION);
              setStatus("denied");
            }
          };
        })
        .catch(() => {
          // Permissions API not supported for geolocation in this browser.
        });
    }

    // Also re-check whenever the tab regains focus/visibility — covers
    // browsers that don't support the Permissions "change" event.
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && statusRef.current !== "granted") {
        requestLocation();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (permissionStatus) permissionStatus.onchange = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocationContext.Provider value={{ status, location, defaultLocation: DEFAULT_LOCATION }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useUserLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useUserLocation must be used within a LocationProvider");
  }
  return ctx;
}
