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
  GlobeHemisphereWest,
  UsersThree,
  CrownSimple,
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
  onPremium,
  notify,
}) {
  const container = useRef(),
    map = useRef(),
    markers = useRef(),
    radius = useRef(),
    selfMarker = useRef();
  const optionsPanel = useRef();
  const refreshing = useRef(false), latestRefresh = useRef();
  const worldSequence = useRef(0), cameras = useRef({}), previousScope = useRef("local");
  const [position, setPosition] = useState(null),
    [view, setView] = useState("map"),
    [scope, setScope] = useState("local"),
    [worldActivity, setWorldActivity] = useState([]),
    [worldInfo, setWorldInfo] = useState(null),
    [worldLoading, setWorldLoading] = useState(false),
    [worldError, setWorldError] = useState(""),
    [geoError, setGeoError] = useState(""),
    [locating, setLocating] = useState(false),
    [activity, setActivity] = useState([]),
    [selected, setSelected] = useState(null),
    [cluster, setCluster] = useState(null),
    [people, setPeople] = useState([]),
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
    const resize = new ResizeObserver(() => { if (container.current?.clientWidth && container.current?.clientHeight) map.current?.invalidateSize({pan:false}); });
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
        view === "map" && scope === "local" ? api("nearby", p) : Promise.resolve(null),
        view === "people" && me.registered ? api("discover", p) : Promise.resolve(null),
      ]);
      if (peopleResult.status === "fulfilled" && peopleResult.value) setPeople(peopleResult.value.people);
      if (peopleResult.status === "rejected") throw peopleResult.reason;
      if (activityResult.status === "rejected") throw activityResult.reason;
      const result = activityResult.value;
      if (result) {
        setActivity(result.activity);
        setSelected(
        (current) => result.activity.find((x) => x.id === current?.id) || null,
        );
      }
    } catch (error) {
      if (!quiet) notify(error.message);
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }
  latestRefresh.current = refresh;
  useEffect(() => { if (position) latestRefresh.current(position, true); }, [view, scope, position]);
  useEffect(() => {
    if (!map.current || previousScope.current === scope) return;
    cameras.current[previousScope.current] = { center: map.current.getCenter(), zoom: map.current.getZoom(), hasPosition:Boolean(position) };
    previousScope.current = scope;
    const saved = cameras.current[scope];
    if (saved && (scope === "world" || saved.hasPosition || !position)) map.current.setView(saved.center, saved.zoom, { animate: false });
    else if (scope === "world") map.current.fitWorld({ animate: false });
    else if (position) map.current.setView([position.lat, position.lng], 15, { animate: false });
    setSelected(null); setCluster(null); setPanelOpen(true);
  }, [scope]);
  useEffect(() => {
    if (view !== "map" || scope !== "world" || !map.current) return;
    let timer;
    const instance = map.current;
    const wrap = value => ((value + 180) % 360 + 360) % 360 - 180;
    const update = async () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      const sequence = ++worldSequence.current, bounds = instance.getBounds();
      const full = bounds.getEast() - bounds.getWest() >= 360;
      setWorldLoading(true);
      try {
        const result = await api("world-map", undefined, {
          south: Math.max(-90, bounds.getSouth()), north: Math.min(90, bounds.getNorth()),
          west: full ? -180 : wrap(bounds.getWest()), east: full ? 180 : wrap(bounds.getEast()), zoom: instance.getZoom(),
        });
        if (sequence !== worldSequence.current) return;
        setWorldActivity(result.activity); setWorldInfo(result); setWorldError("");
      } catch (error) { if (sequence === worldSequence.current) setWorldError(error.message); }
      finally { if (sequence === worldSequence.current) setWorldLoading(false); }
    };
    const moved = () => { clearTimeout(timer); timer = setTimeout(update, 400); };
    instance.on("moveend", moved);
    const poll = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    update();
    return () => { ++worldSequence.current; clearTimeout(timer); clearInterval(poll); instance.off("moveend", moved); document.removeEventListener("visibilitychange", update); window.removeEventListener("online", update); };
  }, [scope, view]);
  function chooseScope(next) {
    if (next === "world" && !me.registered) { onAuth(); return; }
    if (next === "world" && !me.premium) { onPremium(); return; }
    setScope(next);
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
        if (view === "map") map.current?.setView([p.lat, p.lng], 15);
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
  const shownActivity = scope === "world" ? worldActivity : activity;
  useEffect(() => {
    if (!markers.current) return;
    markers.current.clearLayers();
    const offsets = markerOffsets(shownActivity),
      clustered = new Set();
    shownActivity.forEach((item) => {
      if (item.count > 1) {
        const badge = document.createElement("button"); badge.className = "map-cluster-count world-cluster-count";
        badge.textContent = fa(item.count); badge.setAttribute("aria-label", `${fa(item.count)} نفر؛ برای دیدن محدوده بزرگ‌نمایی کن`);
        L.marker([item.lat,item.lng], { icon: L.divIcon({html:badge,className:"map-cluster-icon",iconSize:[50,50],iconAnchor:[25,25]}) })
          .addTo(markers.current).on("click",()=>map.current?.setView([item.lat,item.lng],Math.min(19,map.current.getZoom()+2)));
        return;
      }
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
  }, [shownActivity]);
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
    <section className="real-nearby-page tab-page">
      <header className="nearby-heading">
        <div>
          <h1>این نزدیکا</h1>
          <p>{view === "people" ? "پروفایل‌های نزدیک، با انتخاب خودشون" : scope === "world" ? "ثبت‌های بی‌نام از همه‌جا" : "جیش‌های اطراف، با مکان تقریبی"}</p>
        </div>
        <span className="tiny-badge">
          <ShieldCheck size={13} /> موقعیت تقریبی
        </span>
      </header>
      <div className="nearby-view-tabs" role="tablist" aria-label="بخش‌های این نزدیکا">
        <button role="tab" id="nearby-map-tab" aria-selected={view === "map"} aria-controls="nearby-map-pane" onClick={()=>setView("map")}><MapPin size={20}/>نقشه</button>
        <button role="tab" id="nearby-people-tab" aria-selected={view === "people"} aria-controls="nearby-list-pane" onClick={()=>setView("people")}><UsersThree size={20}/>آدم‌های نزدیک من</button>
      </div>
      <div className="nearby-map-pane" id="nearby-map-pane" role="tabpanel" aria-labelledby="nearby-map-tab" hidden={view !== "map"}>
      <div
        className="real-map"
        ref={container}
        aria-label="نقشه‌ی فعالیت‌های اطراف"
      />
      <div className="map-scope-switch" role="group" aria-label="محدودهٔ نقشه">
        <button aria-pressed={scope === "local"} onClick={()=>chooseScope("local")}><MapPin size={17}/>اطراف من</button>
        <button aria-pressed={scope === "world"} onClick={()=>chooseScope("world")}><GlobeHemisphereWest size={18}/>همه‌جا <CrownSimple size={15}/></button>
      </div>
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
      {!position && scope === "local" ? (
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
        <div ref={optionsPanel} className={`around-panel ${selected || cluster ? "is-browsing" : ""}`} id="nearby-map-options" hidden={!panelOpen}>
          <div className="around-panel-top">
            <strong>
              {(scope === "world" ? worldLoading : loading)
                ? "در حال تازه‌کردن…"
                : scope === "world" ? `${fa(worldInfo?.inView)} نفر در این نما` : `${fa(activity.length)} نفر این نزدیکی`}
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
          {scope === "world" && <p className="world-map-note">ثبت‌های ۳۰ دقیقهٔ اخیر؛ بی‌نام و با مکان تقریبی. هر ۳۰ ثانیه تازه می‌شه.{worldInfo?.limited && " برای دیدن جزئیات، نزدیک‌تر شو."}</p>}
          {worldError && scope === "world" && <p className="form-error">{worldError}</p>}
          {scope === "local" && <fieldset className="map-visibility-control" disabled={sharingBusy || peopleBusy}>
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
                  ? "ثبتت با مکان تقریبی روی نقشهٔ اطراف و همه‌جا دیده می‌شه؛ فقط دوست‌های نزدیک اسمت رو می‌بینن."
                  : "آدم‌های نزدیک اسم و پروفایلت رو می‌بینن؛ ثبتت توی نقشهٔ همه‌جا بی‌نامه."}
            </p>
          </fieldset>}
          {!selected && !cluster && <p className="map-empty-note">{shownActivity.length ? "روی شخصیت‌ها بزن تا ببینی چه حالی دارن." : scope === "world" ? "این محدوده فعلاً آرومه؛ می‌تونی جاهای دیگه رو هم ببینی." : "این نزدیکا فعلاً آرومه."}</p>}
          <p className="map-grid-explanation">نقطه‌ها محل دقیق افراد نیستن. برای دیدن جزئیات، روی نقشه بزرگ‌نمایی کن.</p>
        </div>
      )}
      {(position || scope === "world") && !panelOpen && (
        <button className="map-options-restore" aria-controls="nearby-map-options" aria-expanded={false} onClick={() => setPanelOpen(true)}>
          <SlidersHorizontal size={20} /> نمایش گزینه‌های نقشه
        </button>
      )}
      </div>
      <div className="nearby-list-pane" id="nearby-list-pane" role="tabpanel" aria-labelledby="nearby-people-tab" hidden={view !== "people"}>
        <div className="nearby-list-intro"><UsersThree size={28}/><div><h2>آدم‌های نزدیک من</h2><p>تا ۳ کیلومتر اطرافت؛ فقط کسانی که نمایش پروفایلشون رو روشن کردن.</p></div></div>
        {!position && <div className="nearby-list-permission"><img src="/assets/shy-drop.webp" alt="قطرهٔ خجالتی جیشو" width="100" height="100"/><p>برای دیدن آدم‌های این نزدیکا، مکانت رو پیدا کنیم؟ مکانت با این کار منتشر نمی‌شه.</p>{geoError && <p className="form-error">{geoError}</p>}<button className="button button-primary" onClick={locate} disabled={locating}>{locating ? "داریم مکانت رو پیدا می‌کنیم…" : "نمایش آدم‌های نزدیک"}</button></div>}
        {position && <div className="nearby-people-panel" id="nearby-people-list">
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
        }
      </div>
    </section>
  );
}
