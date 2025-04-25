"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import dynamic from "next/dynamic";
import { supabase } from "./lib/db.js";


const LoginScreen = dynamic(() => import("./login_screen"), { ssr: false });

const mapContainerStyle = {
  width: "75vw",
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

  useEffect(() => {
    const init = async () => {
      // Clear OAuth hash from URL
      if (window?.location?.hash) {
        window.history.replaceState(null, null, window.location.pathname);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setRole(data?.role || null);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
  
      if (session?.user) {
        const { data } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();
  
        setRole(data?.role || null);
      } else {
        setRole(null);
      }
  
      // Remove the hash fragment from OAuth redirect
      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, null, window.location.pathname);
      }
    };
  
    checkUser();
  
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        checkUser();
      }
    });
  
    return () => subscription.unsubscribe();
  }, []);
  async function fetchData() {
    const { data, error } = await supabase
      .from("parking_restrictions")
      .select("*");
    if (!error && data) {
      setAllData(data);
      setPendingData(data.filter((item) => item.status === "pending"));
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

  if (!isLoaded) return <div>Loading map...</div>;
  if (!role) return <LoginScreen onLogin={() => window.location.reload()} />;
  if (role !== "admin") return <div>Access denied. Admins only.</div>;

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <h2>Pending Approvals</h2>
        {pendingData.map((item) => (
          <div
            key={item.id}
            className="pending-card"
            onClick={() => {
              setSelectedItemId(item.id);
              setMapCenter({ lat: item.Latitude, lng: item.Longitude });
            }}
          >
            <p><strong>Road:</strong> {item["Road Name"]}</p>
            <p><strong>Type:</strong> {item["Restriction Type"]}</p>
            <p><strong>Zone:</strong> {item["Controlled Parking Zone"]}</p>
            <p><strong>Times:</strong> {item["Times Of Operation"]}</p>

            {selectedItemId === item.id && (
              <div className="edit-box">
                <h4>Edit & Approve</h4>
                {editableFields.map((field) => (
                  <input
                    key={field}
                    className="input-field"
                    placeholder={field}
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
                {item["Image URL"] && (
                  <img
                    src={item["Image URL"]}
                    alt="parking"
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
                  Save & Approve
                </button>
                <button onClick={() => deleteData(item.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </aside>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={15}
        center={mapCenter}
      >
        {allData.map((item) => (
          <Marker
            key={item.id}
            position={{ lat: item.Latitude, lng: item.Longitude }}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
