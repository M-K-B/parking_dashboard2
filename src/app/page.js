
"use client";

import { useState, useEffect } from "react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import dynamic from "next/dynamic";
import { supabase } from "./lib/db.js";

const LoginScreen = dynamic(() => import("./login_screen"), { ssr: false });

const mapContainerStyle = {
  width: "100%",
  height: "100vh",
};

const center = {
  lat: 51.5074,
  lng: -0.1278,
};

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

export default function AdminMap() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });

  const [role, setRole] = useState(null);
  const [allData, setAllData] = useState([]);
  const [pendingData, setPendingData] = useState([]);
  const [formState, setFormState] = useState({});
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [mapCenter, setMapCenter] = useState(center);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: user } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setRole(user?.role ?? false);
      } else {
        setRole(false);
      }
    };
  
    checkUser();
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) checkUser();
      else setRole(false);
    });
  
    return () => subscription.unsubscribe();
  }, []);
  

  useEffect(() => {
    if (role === "admin") fetchData();
  }, [role]);

  async function fetchData() {
    try {
      const res = await fetch("https://funny-bear-93.deno.dev/api/v1/getAllData");
      const data = await res.json();
      setAllData(data);
      setPendingData(data.filter((d) => d.status === "pending"));
    } catch (err) {
      console.error("Failed to fetch API data", err);
    }
  }

  async function updateData(id, changes) {
    await supabase.from("parking_restrictions").update(changes).eq("id", id);
    setSelectedItemId(null);
    fetchData();
  }

  async function deleteData(id) {
    await supabase.from("parking_restrictions").delete().eq("id", id);
    setSelectedItemId(null);
    fetchData();
  }

  const filtered = filter
    ? pendingData.filter((item) => item.Postcode?.toLowerCase().includes(filter.toLowerCase()))
    : pendingData;

  if (!isLoaded) return <div>Loading map...</div>;
  if (!role) return <LoginScreen onLogin={() => window.location.reload()} />;
  if (role !== "admin") return <div>Access denied. Admins only.</div>;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2>Pending Approvals</h2>
        <input
          placeholder="Filter by postcode"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-input"
        />
        {filtered.map((item) => (
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
                {editableFields.map((field) => (
                  <input
                    key={field}
                    placeholder={field}
                    className="input-field"
                    value={(formState[item.id]?.[field] ?? item[field]) ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          [field]: e.target.value,
                        },
                      }))
                    }
                  />
                ))}
                {item["Image URL"] && <img src={item["Image URL"]} className="image-preview" />}
                <button onClick={() => updateData(item.id, {
                  ...formState[item.id],
                  status: "approved",
                  approved_at: new Date().toISOString(),
                })}>Approve</button>
                <button onClick={() => deleteData(item.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </aside>

      <main className="map-container">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={13}
          center={mapCenter}
        >
          {allData.map((item) => (
            <Marker
              key={item.id}
              position={{ lat: item.Latitude, lng: item.Longitude }}
            />
          ))}
        </GoogleMap>
      </main>
    </div>
  );
}