"use client";

import { useState, useEffect } from "react";
import { GoogleMap, Marker, InfoWindow, useLoadScript } from "@react-google-maps/api";
import dynamic from "next/dynamic";
import { supabase } from "./lib/db.js";

const LoginScreen = dynamic(() => import("./login_screen"), { ssr: false });

const mapContainerStyle = { width: "100%", height: "100vh" };
const defaultCenter = { lat: 51.5074, lng: -0.1278 };

const editableFields = [
  "Road Name",
  "Restriction Type",
  "Controlled Parking Zone",
  "Times Of Operation",
  "Maximum Stay",
  "Nearest Machine",
  "Notes",
  "Parking Spaces",
  "Postcode",
  "Valid Parking Permits",
];

const restrictionColors = {
  "Pay and Display": "blue",
  "Permit Holders Only": "green",
  "Disabled Bays": "yellow",
  "Double Yellow Lines": "red",
  "Single Yellow Lines": "orange",
};

export default function AdminMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  const [role, setRole] = useState(null);
  const [allData, setAllData] = useState([]);
  const [pendingData, setPendingData] = useState([]);
  const [formState, setFormState] = useState({});
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // 1️⃣ Auth & role
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: user, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setRole(error ? null : user.role);
      } else {
        setRole(null);
      }
      // clear hash after OAuth
      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => session?.user ? checkUser() : setRole(null)
    );
    return () => subscription.unsubscribe();
  }, []);

  // 2️⃣ Initial data load for admin
  useEffect(() => {
    if (role === "admin") {
      fetchAllMapData();
      fetchPendingData();
    }
  }, [role]);

  // 3️⃣ Real-time channel for ALL events
  useEffect(() => {
    if (role !== "admin") return;

    const channel = supabase
      .channel("custom-all-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "parking_restrictions",
        },
        payload => {
          console.log("Change received!", payload);

          const { eventType, new: newRow, old } = payload;

          // --- update allData for map ---
          setAllData(prev => {
            if (eventType === "INSERT") {
              return [...prev, newRow];
            }
            if (eventType === "UPDATE") {
              return prev.map(r => (r.id === newRow.id ? newRow : r));
            }
            if (eventType === "DELETE") {
              return prev.filter(r => r.id !== old.id);
            }
            return prev;
          });

          // --- update pendingData sidebar ---
          setPendingData(prev => {
            // on insert: add if pending
            if (eventType === "INSERT" && newRow.status === "pending") {
              return [...prev, newRow];
            }
            // on update: either update if still pending, or remove
            if (eventType === "UPDATE") {
              if (newRow.status === "pending") {
                return prev.map(r => (r.id === newRow.id ? newRow : r));
              }
              return prev.filter(r => r.id !== newRow.id);
            }
            // on delete: remove any matching
            if (eventType === "DELETE") {
              return prev.filter(r => r.id !== old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [role]);

  // Fetchers
  async function fetchAllMapData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("https://funny-bear-93.deno.dev/api/v1/getAllData", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setAllData(data || []);
    } catch (err) {
      console.error("Error fetching map data:", err);
    }
  }

  async function fetchPendingData() {
    try {
      const { data, error } = await supabase
        .from("parking_restrictions")
        .select("*")
        .eq("status", "pending");
      if (error) throw error;
      setPendingData(data || []);
    } catch (err) {
      console.error("Error fetching pending data:", err);
    }
  }

  async function updateData(id, changes) {
    await supabase.from("parking_restrictions").update(changes).eq("id", id);
    setSelectedItemId(null);
  }

  async function deleteData(id) {
    await supabase.from("parking_restrictions").delete().eq("id", id);
    setSelectedItemId(null);
  }

  // Filters
  const filteredPending = filter
    ? pendingData.filter(i =>
        i.Postcode?.toLowerCase().includes(filter.toLowerCase())
      )
    : pendingData;

  const filteredAllData = typeFilter
    ? allData.filter(i => i["Restriction Type"] === typeFilter)
    : allData;

  if (!isLoaded) return <div>Loading map...</div>;
  if (!role) return <LoginScreen onLogin={() => window.location.reload()} />;
  if (role !== "admin") return <div>Access denied. Admins only.</div>;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2>Pending Approvals</h2>
        <input
          type="text"
          placeholder="Filter by postcode"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="filter-input"
        />
        {filteredPending.length === 0 && <p>No pending records.</p>}
        {filteredPending.map(item => (
          <div
            key={item.id}
            className="pending-card"
            onClick={() => {
              setSelectedItemId(item.id);
              setMapCenter({ lat: item.Latitude, lng: item.Longitude });
            }}
          >
            <p><strong>Road:</strong> {item["Road Name"]}</p>
            <p><strong>Zone:</strong> {item["Controlled Parking Zone"]}</p>
            <p><strong>Postcode:</strong> {item.Postcode}</p>
            {selectedItemId === item.id && (
              <div className="edit-box">
                {editableFields.map(field => (
                  <input
                    key={field}
                    placeholder={field}
                    className="input-field"
                    value={(formState[item.id]?.[field] ?? item[field])}
                    onChange={e =>
                      setFormState(prev => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          [field]: e.target.value,
                        },
                      }))
                    }
                  />
                ))}
                {item["Image URL"] && (
                  <img
                    src={item["Image URL"]}
                    alt="parking sign"
                    className="image-preview"
                  />
                )}
                <button
                  onClick={() => {
                    const changes = {
                      ...formState[item.id],
                      status: "approved",
                      approved_at: new Date().toISOString(),
                    };
                    updateData(item.id, changes);
                  }}
                >
                  Approve
                </button>
                <button onClick={() => deleteData(item.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </aside>
      <main className="map-container">
        <div style={{ padding: 10, background: "#fff", zIndex: 10 }}>
          <button onClick={() => setTypeFilter("")}>Show All</button>
          {[...new Set(allData.map(i => i["Restriction Type"]))].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                marginLeft: 5,
                backgroundColor: restrictionColors[type] || "gray",
                color: "white",
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={13}
          center={mapCenter}
        >
          {filteredAllData.map(item => (
            <Marker
              key={item.id}
              position={{ lat: item.Latitude, lng: item.Longitude }}
              onClick={() => setSelectedMarker(item)}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: restrictionColors[item["Restriction Type"]] || "gray",
                fillOpacity: 1,
                strokeWeight: 1,
              }}
            />
          ))}
          {selectedMarker && (
            <InfoWindow
              position={{
                lat: selectedMarker.Latitude,
                lng: selectedMarker.Longitude,
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div style={{ maxWidth: 250 }}>
                <h3>{selectedMarker["Road Name"]}</h3>
                <p><strong>Zone:</strong> {selectedMarker["Controlled Parking Zone"]}</p>
                <p><strong>Type:</strong> {selectedMarker["Restriction Type"]}</p>
                <p><strong>Times:</strong> {selectedMarker["Times Of Operation"]}</p>
                <p><strong>Max Stay:</strong> {selectedMarker["Maximum Stay"]}</p>
                <p><strong>Postcode:</strong> {selectedMarker["Postcode"]}</p>
                {selectedMarker["Image URL"] && (
                  <img
                    src={selectedMarker["Image URL"]}
                    alt="Parking sign"
                    style={{ width: "100%", marginTop: 5 }}
                  />
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </main>
    </div>
  );
}
