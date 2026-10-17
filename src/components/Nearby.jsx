import "./Nearby.css";
import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { blobatar } from "blobatar/blob";
import { happy, shy } from "blobatar/expression";
import {
  MapPin,
  NavigationArrow,
  ShieldCheck,
  X,
  Plus,
  Minus,
  Drop,
} from "@phosphor-icons/react";
import { markerOffsets } from "../map-markers";
import { api, relativeTime, fa } from "../api";
import { Avatar } from "./Character";

export default function Nearby({
  me,
  data,
  refreshAccount,
  onAuth,
  onConnect,
  onSharingChanged,
  notify,
}) {
  const container = useRef(),
    map = useRef(),
    markers = useRef(),
    radius = useRef(),
    selfMarker = useRef();
  const [position, setPosition] = useState(null),
    [geoError, setGeoError] = useState(""),
    [locating, setLocating] = useState(false),
    [activity, setActivity] = useState([]),
    [selected, setSelected] = useState(null),
    [cluster, setCluster] = useState(null),
    [people, setPeople] = useState([]),
    [peopleOpen, setPeopleOpen] = useState(false),
    [peopleBusy, setPeopleBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [sharing, setSharing] = useState(me.shareLocation);
  useEffect(() => {
    setSharing(me.shareLocation);
  }, [me.shareLocation]);
  useEffect(() => {
    map.current = L.map(container.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([35.7, 51.4], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  async function refresh(p) {
    if (!p) return;
    setLoading(true);
    try {
      const result = await api("nearby", p);
      setActivity(result.activity);
      if (me.registered) {
        const nearbyPeople = await api("discover", p);
        setPeople(nearbyPeople.people);
      }
      setSelected(
        (current) => result.activity.find((x) => x.id === current?.id) || null,
      );
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setGeoError("این مرورگر از مکان‌یابی پشتیبانی نمی‌کنه.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const p = { lat: coords.latitude, lng: coords.longitude };
        setPosition(p);
        setLocating(false);
        map.current?.setView([p.lat, p.lng], 15);
        if (sharing)
          try {
            await api("location", { ...p, enabled: true });
          } catch (error) {
            notify(error.message);
          }
        refresh(p);
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === 1
            ? "اجازه‌ی مکان داده نشده. می‌تونی از تنظیمات مرورگرت فعالش کنی."
            : "مکانت پیدا نشد. دوباره امتحان کن.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  useEffect(() => {
    if (!position || !map.current) return;
    radius.current?.remove();
    radius.current = L.circle([position.lat, position.lng], {
      radius: 120,
      color: "#87b8f0",
      fillColor: "#a5d0ff",
      fillOpacity: 0.2,
      weight: 1,
      interactive: false,
    }).addTo(map.current);
    selfMarker.current?.remove();
    selfMarker.current = L.circleMarker([position.lat, position.lng], {
      radius: 7,
      color: "white",
      fillColor: "#448ded",
      fillOpacity: 1,
      weight: 3,
      interactive: false,
    }).addTo(map.current);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh(position);
    }, 20000);
    return () => clearInterval(timer);
  }, [position]);
  useEffect(() => {
    if (!markers.current) return;
    markers.current.clearLayers();
    const offsets = markerOffsets(activity),
      clustered = new Set();
    activity.forEach((item) => {
      const offset = offsets.get(item.id);
      if (offset.cluster) {
        const key = `${item.lat}:${item.lng}`;
        if (clustered.has(key)) return;
        clustered.add(key);
        const badge = document.createElement("button");
        badge.className = "map-cluster-count";
        badge.textContent = fa(offset.cluster.length);
        badge.setAttribute(
          "aria-label",
          `${fa(offset.cluster.length)} نفر در این محدوده`,
        );
        L.marker([item.lat, item.lng], {
          icon: L.divIcon({
            html: badge,
            className: "map-cluster-icon",
            iconSize: [50, 50],
            iconAnchor: [25, 25],
          }),
        })
          .addTo(markers.current)
          .on("click", () => {
            setCluster(offset.cluster);
            setSelected(null);
          });
        return;
      }
      const element = document.createElement("div");
      element.className = `live-map-marker ${item.status} ${item.isFriend ? "friend-marker" : ""}`;
      const figure = document.createElement("span");
      if (item.avatarImage) {
        const photo = document.createElement("img");
        photo.src = item.avatarImage;
        photo.alt = "";
        photo.className = "map-profile-photo";
        figure.append(photo);
      } else if (item.isFriend || item.isMe)
        figure.innerHTML = blobatar(item.avatarSeed, {
          size: 38,
          tone: 0.23,
          expression: item.status === "need" ? shy : happy,
        });
      else {
        const mascot = document.createElement("img");
        mascot.src = `${import.meta.env.BASE_URL}assets/${item.status === "need" ? "shy-drop.webp" : "happy-drop.webp"}`;
        mascot.alt = "";
        figure.append(mascot);
      }
      element.append(figure);
      if (item.isFriend || item.isMe) {
        const label = document.createElement("strong");
        label.textContent = item.name;
        element.append(label);
      }
      const icon = L.divIcon({
        html: element,
        className: "map-avatar-icon",
        iconSize: [48, 57],
        iconAnchor: [24 - offset.x, 50 - offset.y],
      });
      L.marker([item.lat, item.lng], { icon, title: item.name })
        .addTo(markers.current)
        .on("click", () => {
          setCluster(null);
          setSelected(item);
        });
    });
  }, [activity]);
  async function changeSharing(enabled) {
    if (enabled && !position) {
      notify("اول اجازه‌ی مکان بده تا موقعیت تقریبی‌ت مشخص بشه.");
      locate();
      return;
    }
    try {
      await api("location", { enabled, ...position });
      setSharing(enabled);
      onSharingChanged(enabled);
      notify(
        enabled
          ? "فقط موقعیت تقریبی‌ت نمایش داده می‌شه."
          : "مکانت از نقشه‌ی بقیه پنهان شد.",
      );
      refresh(position);
    } catch (error) {
      notify(error.message);
    }
  }
  async function changeDiscovery() {
    if (!me.registered) {
      onAuth();
      return;
    }
    if (!position) {
      locate();
      notify("اول اطرافت رو پیدا کن، بعد نمایش پروفایلت رو انتخاب کن.");
      return;
    }
    setPeopleBusy(true);
    try {
      const enabled = !me.discoverable;
      if (enabled && !sharing) {
        await api("location", { ...position, enabled: true });
        setSharing(true);
        onSharingChanged(true);
      }
      await api("discoverable", { enabled });
      await refreshAccount();
      await refresh(position);
      notify(
        enabled
          ? "پروفایلت با موقعیت تقریبی در این نزدیکا دیده می‌شه."
          : "پروفایلت از فهرست این نزدیکا پنهان شد.",
      );
    } catch (e) {
      notify(e.message);
    } finally {
      setPeopleBusy(false);
    }
  }
  return (
    <section className="real-nearby-page">
      <header className="nearby-heading">
        <div>
          <h1>این نزدیکا</h1>
          <p>خبرهای تازه و آدم‌های نزدیکت</p>
        </div>
        <span className="tiny-badge">
          <ShieldCheck size={13} /> موقعیت تقریبی
        </span>
      </header>
      <div
        className="real-map"
        ref={container}
        aria-label="نقشه‌ی فعالیت‌های اطراف"
      />
      <div className="map-controls">
        <button
          aria-label="بزرگ‌نمایی نقشه"
          onClick={() => map.current?.zoomIn()}
        >
          <Plus size={21} />
        </button>
        <button
          aria-label="کوچک‌نمایی نقشه"
          onClick={() => map.current?.zoomOut()}
        >
          <Minus size={21} />
        </button>
        <button
          aria-label="مکان من"
          onClick={() =>
            position
              ? map.current?.setView([position.lat, position.lng], 15)
              : locate()
          }
        >
          <NavigationArrow size={22} />
        </button>
      </div>
      {!position ? (
        <div className="map-permission-card">
          <span className="dialog-icon blue">
            <MapPin size={29} weight="duotone" />
          </span>
          <h2>کی دور و برته؟</h2>
          <p>
            اجازه‌ی مکان بده تا خبرهای اطرافت رو ببینی. با این کار، مکانت برای
            بقیه نمایش داده نمی‌شه.
          </p>
          {geoError && <p className="form-error">{geoError}</p>}
          <button
            className="button button-primary"
            onClick={locate}
            disabled={locating}
          >
            {locating ? "داریم مکانت رو پیدا می‌کنیم…" : "نمایش اطراف من"}
            <NavigationArrow size={18} />
          </button>
          <small>فعلاً نقشه‌ی تهران نمایش داده شده؛ این مکان شما نیست.</small>
        </div>
      ) : (
        <div className="around-panel">
          <div className="around-panel-top">
            <strong>
              {loading
                ? "در حال تازه‌کردن…"
                : `${fa(activity.length)} خبر این نزدیکی`}
            </strong>
            <button onClick={() => refresh(position)}>تازه‌کردن</button>
          </div>
          <label className="location-choice">
            <span>
              خبر من هم با مکان تقریبی نمایش داده بشه
              <small>برای بقیه بی‌نام؛ برای دوست‌های وصل‌شده با اسم</small>
            </span>
            <input
              type="checkbox"
              className="toggle"
              checked={sharing}
              onChange={(e) => changeSharing(e.target.checked)}
            />
          </label>
          <button
            className="nearby-people-trigger"
            aria-expanded={peopleOpen}
            onClick={() => setPeopleOpen(!peopleOpen)}
          >
            <span>آدم‌های این نزدیکا</span>
            <strong>
              {me.registered ? fa(people.length) : "با ورود به حساب"}
            </strong>
            <Plus size={17} />
          </button>
          {peopleOpen && (
            <div className="nearby-people-panel">
              {me.registered ? (
                <>
                  <button
                    className="discovery-visibility"
                    aria-pressed={Boolean(me.discoverable)}
                    disabled={peopleBusy}
                    onClick={changeDiscovery}
                  >
                    <ShieldCheck size={19} />
                    <span>
                      <strong>
                        {me.discoverable
                          ? "پروفایلم اینجا دیده می‌شه"
                          : "پروفایلم در فهرست پنهانه"}
                      </strong>
                      <small>
                        {me.discoverable
                          ? "برای پنهان‌کردن بزن"
                          : "برای نمایش نام و پروفایل به آدم‌های نزدیک بزن"}
                      </small>
                    </span>
                  </button>
                  <div className="nearby-people-list">
                    {people.map((person) => (
                      <div className="nearby-person" key={person.id}>
                        <Avatar person={person} size={42} />
                        <div>
                          <strong>{person.name}</strong>
                          <span dir="ltr">@{person.handle}</span>
                          <small>{person.distance}</small>
                        </div>
                        <button
                          disabled={peopleBusy || person.connection !== null}
                          onClick={async () => {
                            setPeopleBusy(true);
                            try {
                              await onConnect(person.handle);
                              await refresh(position);
                            } finally {
                              setPeopleBusy(false);
                            }
                          }}
                        >
                          {person.connection === "accepted"
                            ? "دوستید"
                            : person.connection === "pending"
                              ? "درخواست ثبت شده"
                              : "درخواست دوستی"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {!people.length && (
                    <p className="map-empty-note">
                      هنوز کسی نمایش پروفایلش رو در این محدوده روشن نکرده.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    روی نقشه خبرهای بی‌نام رو می‌بینی؛ برای دوستی با آدم‌های
                    نزدیک وارد شو.
                  </p>
                  <button className="button button-lilac" onClick={onAuth}>
                    ورود یا عضویت
                  </button>
                </>
              )}
            </div>
          )}
          <p className="map-grid-explanation">
            نقطه‌ها محل دقیق افراد نیستن. نشانگرهای یک محدوده برای خوانایی از هم
            باز می‌شن.
          </p>
          {cluster && (
            <div className="map-cluster-list">
              <div>
                <strong>{fa(cluster.length)} نفر در این محدوده</strong>
                <button
                  aria-label="بستن فهرست محدوده"
                  onClick={() => setCluster(null)}
                >
                  <X size={18} />
                </button>
              </div>
              {cluster.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelected(item);
                    setCluster(null);
                  }}
                >
                  <span>{item.name}</span>
                  <small>
                    {item.status === "need" ? "جیش داره" : "جیش کرده"}
                  </small>
                </button>
              ))}
            </div>
          )}
          {selected ? (
            <div className="selected-neighbor">
              <Avatar
                person={selected}
                size={43}
                mood={selected.status === "need" ? "shy" : "happy"}
              />
              <div>
                <strong>
                  {selected.name}
                  {selected.isFriend && <span>دوستت</span>}
                </strong>
                <p>
                  {selected.status === "need" ? "جیش داره" : "جیش کرد"} ·{" "}
                  {relativeTime(selected.createdAt)}
                </p>
              </div>
              <button
                aria-label="بستن خبر اطراف"
                onClick={() => setSelected(null)}
              >
                <X size={17} />
              </button>
            </div>
          ) : (
            <p className="map-empty-note">
              {activity.length
                ? "روی شخصیت‌ها بزن تا خبرشون رو ببینی."
                : "هنوز خبر تازه‌ای اطرافت نیست. اولین نفر باش!"}{" "}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
