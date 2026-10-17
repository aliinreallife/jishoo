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
  CaretDown,
  CaretUp,
  Eye,
  EyeSlash,
  SlidersHorizontal,
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
  const optionsPanel = useRef();
  const refreshing = useRef(false), latestRefresh = useRef();
  const [position, setPosition] = useState(null),
    [geoError, setGeoError] = useState(""),
    [locating, setLocating] = useState(false),
    [activity, setActivity] = useState([]),
    [selected, setSelected] = useState(null),
    [cluster, setCluster] = useState(null),
    [people, setPeople] = useState([]),
    [peopleOpen, setPeopleOpen] = useState(false),
    [panelOpen, setPanelOpen] = useState(true),
    [peopleBusy, setPeopleBusy] = useState(false),
    [sharingBusy, setSharingBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [sharing, setSharing] = useState(me.shareLocation);
  useEffect(() => {
    setSharing(me.shareLocation);
  }, [me.shareLocation]);
  useEffect(() => {
    if (panelOpen && (selected || cluster) && optionsPanel.current) optionsPanel.current.scrollTop = 0;
  }, [panelOpen, selected, cluster]);
  useEffect(() => {
    map.current = L.map(container.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([35.7, 51.4], 14);
    L.tileLayer(data.map.url, {
      maxZoom: data.map.maxZoom,
      subdomains: data.map.subdomains,
      attribution: data.map.attribution,
    }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      // Leaflet 1.9 leaves a zoom fallback timer running after remove().
      // Finish its transition while the map pane still exists.
      const instance = map.current;
      if (instance?._animatingZoom) instance._onZoomTransitionEnd();
      instance?.remove();
      map.current = null;
    };
  }, []);
  async function refresh(p, quiet = false) {
    if (!p || refreshing.current) return;
    refreshing.current = true;
    if (!quiet) setLoading(true);
    try {
      const [activityResult, peopleResult] = await Promise.allSettled([
        api("nearby", p), me.registered ? api("discover", p) : Promise.resolve({ people: [] }),
      ]);
      if (peopleResult.status === "fulfilled") setPeople(peopleResult.value.people);
      if (activityResult.status === "rejected") throw activityResult.reason;
      const result = activityResult.value;
      setActivity(result.activity);
      setSelected(
        (current) => result.activity.find((x) => x.id === current?.id) || null,
      );
    } catch (error) {
      if (!quiet) notify(error.message);
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }
  latestRefresh.current = refresh;
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
    const update = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) latestRefresh.current(position, true);
    };
    const timer = setInterval(update, 8000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
    };
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
            setPanelOpen(true);
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
          setPanelOpen(true);
          setCluster(null);
          setSelected(item);
        });
    });
  }, [activity]);
  const visibilityMode = sharing ? (me.discoverable ? "profile" : "news") : "hidden";
  async function changeVisibility(mode) {
    if (sharingBusy || peopleBusy || mode === visibilityMode) return;
    if (mode === "profile" && !me.registered) { onAuth(); return; }
    if (mode !== "hidden" && !position) { locate(); return; }
    setSharingBusy(true);
    try {
      await api("map-visibility", { mode, ...position });
      setSharing(mode !== "hidden");
      onSharingChanged(mode !== "hidden");
      await refreshAccount();
      await refresh(position);
      notify(mode === "hidden" ? "ثبت‌ها و پروفایلت از دید بقیه پنهان شد." : mode === "profile" ? "پروفایلت برای آدم‌های نزدیک قابل دیدنه." : "فقط ثبتت با مکان تقریبی نمایش داده می‌شه.");
    } catch (error) {
      await refreshAccount();
      notify(error.message);
    } finally { setSharingBusy(false); }
  }
  return (
    <section className="real-nearby-page">
      <header className="nearby-heading">
        <div>
          <h1>این نزدیکا</h1>
          <p>جیش‌های اطراف، با مکان تقریبی</p>
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
          title="بزرگ‌نمایی نقشه"
          onClick={() => map.current?.zoomIn()}
        >
          <Plus size={21} />
          <span>بزرگ‌نمایی</span>
        </button>
        <button
          aria-label="کوچک‌نمایی نقشه"
          title="کوچک‌نمایی نقشه"
          onClick={() => map.current?.zoomOut()}
        >
          <Minus size={21} />
          <span>کوچک‌نمایی</span>
        </button>
        <button
          aria-label="مکان من"
          title="برگشت به مکان من"
          onClick={() =>
            position
              ? map.current?.setView([position.lat, position.lng], 15)
              : locate()
          }
        >
          <NavigationArrow size={22} />
          <span>مکان من</span>
        </button>
      </div>
      {!position ? (
        <div className="map-permission-card">
          <span className="dialog-icon blue">
            <MapPin size={29} weight="duotone" />
          </span>
          <h2>کی دور و برته؟</h2>
          <p>
            اجازهٔ مکان بده تا اطرافت رو ببینی. دیدن نقشه مکانت رو با کسی به
            اشتراک نمی‌ذاره.
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
          <small>تا وقتی اجازه ندی، فقط نقشهٔ پیش‌فرض تهران نمایش داده می‌شه.</small>
        </div>
      ) : (
        <div ref={optionsPanel} className={`around-panel ${peopleOpen || selected || cluster ? "is-browsing" : ""}`} id="nearby-map-options" hidden={!panelOpen}>
          <div className="around-panel-top">
            <strong>
              {loading
                ? "در حال تازه‌کردن…"
                : `${fa(activity.length)} نفر این نزدیکی`}
            </strong>
            <div className="map-panel-actions">
              <span className="map-live-state" aria-label="نقشه خودکار به‌روز می‌شه" title="نقشه هر چند ثانیه خودکار تازه می‌شه"><i aria-hidden="true" />خودکار</span>
              <button aria-label="جمع‌کردن گزینه‌های نقشه" aria-controls="nearby-map-options" aria-expanded={panelOpen} onClick={() => setPanelOpen(false)}>
                فقط نقشه <CaretDown size={17} />
              </button>
            </div>
          </div>
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
          {selected && (
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
                aria-label="بستن وضعیت روی نقشه"
                onClick={() => setSelected(null)}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <fieldset className="map-visibility-control" disabled={sharingBusy || peopleBusy}>
            <legend>من چطور دیده بشم؟</legend>
            <div className="map-visibility-modes">
              {[
                ["hidden", "پنهان", EyeSlash],
                ["news", "بی‌نام", Drop],
                ["profile", "با پروفایلم", Eye],
              ].map(([mode, label, Icon]) => <button key={mode} type="button" aria-pressed={visibilityMode === mode} aria-describedby="map-visibility-description" onClick={() => changeVisibility(mode)}>
                <Icon size={20} /><span>{label}</span>
              </button>)}
            </div>
            <p id="map-visibility-description" aria-live="polite">
              {sharingBusy ? "داریم انتخابت رو ذخیره می‌کنیم…" : visibilityMode === "hidden"
                ? "کسی موقعیت یا جیشت رو روی نقشه نمی‌بینه."
                : visibilityMode === "news"
                  ? "جیشت با مکان تقریبی دیده می‌شه؛ فقط دوستات اسمت رو می‌بینن."
                  : "آدم‌های اطراف اسم و پروفایلت رو هم می‌بینن."}
            </p>
          </fieldset>
          <button
            className="nearby-people-trigger"
            aria-expanded={peopleOpen}
            aria-controls="nearby-people-list"
            onClick={() => setPeopleOpen(!peopleOpen)}
          >
            <span>{peopleOpen ? "بستن فهرست آدم‌های نزدیک" : "دیدن آدم‌های این نزدیکا"}</span>
            <strong>
              {me.registered ? fa(people.length) : "با ورود به حساب"}
            </strong>
            {peopleOpen ? <CaretUp size={18} /> : <CaretDown size={18} />}
          </button>
            <div className="nearby-people-panel" id="nearby-people-list" hidden={!peopleOpen}>
              {me.registered ? (
                <>
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
                    روی نقشه ثبت‌های بی‌نام رو می‌بینی؛ برای دوستی با آدم‌های
                    نزدیک وارد شو.
                  </p>
                  <button className="button button-lilac" onClick={onAuth}>
                    ورود یا عضویت
                  </button>
                </>
              )}
            </div>
          {!selected && !cluster && <p className="map-empty-note">{activity.length ? "روی شخصیت‌ها بزن تا ببینی چه حالی دارن." : "این نزدیکا فعلاً آرومه."}</p>}
          <p className="map-grid-explanation">
            نقطه‌ها محل دقیق افراد نیستن. نشانگرهای یک محدوده برای خوانایی از هم
            باز می‌شن.
          </p>

        </div>
      )}
      {position && !panelOpen && (
        <button className="map-options-restore" aria-controls="nearby-map-options" aria-expanded={false} onClick={() => setPanelOpen(true)}>
          <SlidersHorizontal size={20} /> نمایش گزینه‌های نقشه
        </button>
      )}
    </section>
  );
}
