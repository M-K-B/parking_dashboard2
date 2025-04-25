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

  // 1️⃣ Check auth & role
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: user, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        } else {
          setRole(user?.role || null);
        }
      } else {
        setRole(null);
      }

      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, null, window.location.pathname);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) checkUser();
      else setRole(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2️⃣ Load data on admin
  useEffect(() => {
    if (role === "admin") {
      fetchAllMapData();
      fetchPendingData();
    }
  }, [role]);

  // 3️⃣ Real-time listen for pending changes
  useEffect(() => {
    const subscription = supabase
      .from("parking_restrictions")
      .on("INSERT", payload => {
        if (payload.new.status === "pending") {
          setPendingData(prev => [...prev, payload.new]);
        }
      })
      .on("UPDATE", payload => {
        const updated = payload.new;
        setPendingData(prev => {
          if (updated.status === "pending") {
            return prev.map(item => item.id === updated.id ? updated : item);
          }
          return prev.filter(item => item.id !== updated.id);
        });
      })
      .on("DELETE", payload => {
        setPendingData(prev => prev.filter(item => item.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch helpers
  async function fetchAllMapData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return console.error("No access token.");
      const res = await fetch("https://funny-bear-93.deno.dev/api/v1/getAllData", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setAllData(data || []);
    } catch (err) {
      console.error("Error fetching parking data", err);
    }
  }

  async function fetchPendingData() {
    try {
      const { data, error } = await supabase
        .from("parking_restrictions")
        .select("*")
        .eq("status", "pending");

      if (error) console.error("Error fetching pending data", error);
      else setPendingData(data || []);
    } catch (err) {
      console.error("Unexpected error fetching pending data", err);
    }
  }

  async function updateData(id, changes) {
    await supabase.from("parking_restrictions").update(changes).eq("id", id);
    setSelectedItemId(null);
    // fetchPendingData(); // no longer needed for INSERT/UPDATE because of real-time
  }

  async function deleteData(id) {
    await supabase.from("parking_restrictions").delete().eq("id", id);
    setSelectedItemId(null);
    // fetchPendingData();
  }

  const filteredPending = filter
    ? pendingData.filter(item =>
        item.Postcode?.toLowerCase().includes(filter.toLowerCase())
      )
    : pendingData;

  const filteredAllData = typeFilter
    ? allData.filter(item => item["Restriction Type"] === typeFilter)
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
                    value={(formState[item.id]?.[field] ?? item[field]) ?? ""}
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

                <button onClick={() => deleteData(item.id)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </aside>

      <main className="map-container">
        {/* Filter Buttons */}
        <div style={{ padding: "10px", background: "#fff", zIndex: 10 }}>
          <button onClick={() => setTypeFilter("")}>Show All</button>
          {[...new Set(allData.map(i => i["Restriction Type"]))].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                marginLeft: "5px",
                backgroundColor: restrictionColors[type] || "gray",
                color: "white",
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Map */}
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
              <div style={{ maxWidth: "250px" }}>
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
                    style={{ width: "100%", marginTop: "5px" }}
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
