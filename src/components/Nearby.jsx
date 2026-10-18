import "./Nearby.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { blobatar } from "blobatar/blob";
import { happy, shy } from "blobatar/expression";
import { MapPin, NavigationArrow, ShieldCheck, X, Plus, Minus, Drop, Eye, EyeSlash, GlobeHemisphereWest, UsersThree, CrownSimple, ArrowClockwise, WifiSlash, MagnifyingGlassPlus, CaretDown, UserCircle as UserProfileIcon } from "@phosphor-icons/react";
import { api, relativeTime, fa } from "../api";
import { Avatar } from "./Character";
import { mapPresentation, nearestLongitude } from "../map-presentation";
import { CuteHeatLayer } from "../map-heat";
import { visibilityMode, visibilityLabel } from "../map-visibility";

export default function Nearby({ me, data, refreshAccount, onAuth, onConnect, onProfile, onPremium, onVisibility, onInvite, startingPosition, memory = {}, notify }) {
  const container = useRef(), map = useRef(), layers = useRef(), selfLayer = useRef();
  const restoredScope = memory.scope === "world" && me.registered && me.premium ? "world" : "local";
  const cameras = useRef(memory.cameras || {}), previousScope = useRef(restoredScope), selection = useRef();
  const [position, setPosition] = useState(memory.position || startingPosition || null), [view, setView] = useState(memory.view || "map"), [scope, setScope] = useState(restoredScope);
  const livePosition = useRef(position), lastPosition = useRef(position);
  livePosition.current = position;
  useEffect(() => { Object.assign(memory, { position, view, scope, cameras: cameras.current }); }, [position, view, scope, memory]);
  const [viewport, setViewport] = useState(null), [activity, setActivity] = useState([]), [worldActivity, setWorldActivity] = useState([]), [people, setPeople] = useState([]);
  const [worldInfo, setWorldInfo] = useState(null), [localLoaded, setLocalLoaded] = useState(false), [worldLoaded, setWorldLoaded] = useState(false);
  const [localDataPosition, setLocalDataPosition] = useState(null);
  const [loading, setLoading] = useState(false), [worldLoading, setWorldLoading] = useState(false), [error, setError] = useState(""), [worldError, setWorldError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null), [worldUpdatedAt, setWorldUpdatedAt] = useState(null), [online, setOnline] = useState(navigator.onLine);
  const [selected, setSelected] = useState(null), [group, setGroup] = useState(null), [geoError, setGeoError] = useState(""), [locating, setLocating] = useState(false), [peopleBusy, setPeopleBusy] = useState(false);
  const items = useMemo(() => {
    const instance = map.current;
    if (!instance || !viewport) return [];
    return (scope === "world" ? worldActivity : activity.filter(item => !item.isMe || me.shareLocation)).map(item => {
      const point = instance.latLngToContainerPoint([item.lat, nearestLongitude(item.lng, instance.getCenter().lng)]);
      return { ...item, x: point.x, y: point.y };
    });
  }, [viewport?.key, scope, activity, worldActivity, me.shareLocation]);
  const presentation = useMemo(() => mapPresentation(items, viewport?.zoom || 0, viewport?.size.x || 0, viewport?.size.y || 0), [items, viewport?.key]);
  const mode = visibilityMode(me), VisibilityIcon = mode === "hidden" ? EyeSlash : mode === "profile" ? Eye : Drop;
  selection.current = { presentation, scope };

  useEffect(() => {
    const saved = cameras.current[scope];
    const instance = L.map(container.current, { zoomControl: false, attributionControl: true });
    if (saved) instance.setView(saved.center, saved.zoom);
    else if (scope === "world") instance.fitWorld();
    else instance.setView(position ? [position.lat, position.lng] : [35.7, 51.4], position ? 15 : 14);
    map.current = instance;
    L.tileLayer(data.map.url, { maxZoom: data.map.maxZoom, subdomains: data.map.subdomains, attribution: data.map.attribution }).addTo(instance);
    layers.current = L.layerGroup().addTo(instance); selfLayer.current = L.layerGroup().addTo(instance);
    const measure = () => {
      const bounds = instance.getBounds(), size = instance.getSize(), center = instance.getCenter();
      cameras.current[previousScope.current] = { center: [center.lat, center.lng], zoom: instance.getZoom(), hasPosition: Boolean(livePosition.current) };
      const key = [bounds.toBBoxString(), instance.getZoom(), size.x, size.y].join(":");
      setViewport(current => current?.key === key ? current : { key, zoom: instance.getZoom(), bounds, size, center });
    };
    const tapMap = (event) => {
      setSelected(null); setGroup(null);
      if (selection.current.presentation.mode !== "heat") return;
      const point = instance.latLngToContainerPoint(event.latlng);
      const nearest = selection.current.presentation.visible.reduce((best, item) => {
        const distance = Math.hypot(point.x - item.x, point.y - item.y);
        return distance < (best?.distance ?? 80) ? { item, distance } : best;
      }, null);
      if (nearest) instance.setView([nearest.item.lat, nearestLongitude(nearest.item.lng, instance.getCenter().lng)], Math.min(18, instance.getZoom() + 2));
    };
    instance.on("moveend", measure); instance.on("click", tapMap);
    const resize = new ResizeObserver(() => {
      if (container.current?.clientWidth && container.current?.clientHeight) { instance.invalidateSize({ pan: false }); measure(); }
    });
    resize.observe(container.current); measure();
    return () => {
      resize.disconnect(); instance.off("moveend", measure); instance.off("click", tapMap);
      if (instance._animatingZoom) instance._onZoomTransitionEnd();
      instance.remove(); map.current = null;
    };
  }, []);
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine);
    window.addEventListener("online", changed); window.addEventListener("offline", changed);
    return () => { window.removeEventListener("online", changed); window.removeEventListener("offline", changed); };
  }, []);
  const appliedStart = useRef(startingPosition);
  useEffect(() => {
    if (startingPosition && startingPosition !== appliedStart.current) setPosition(startingPosition);
    appliedStart.current = startingPosition;
  }, [startingPosition]);
  useEffect(() => {
    if (lastPosition.current === position) return;
    lastPosition.current = position;
    if (!position || !map.current || scope !== "local" || view !== "map") return;
    map.current.setView([position.lat, position.lng], 15, { animate: false });
  }, [position]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || previousScope.current === scope) return;
    const center = instance.getCenter();
    cameras.current[previousScope.current] = { center: [center.lat, center.lng], zoom: instance.getZoom(), hasPosition: Boolean(position) };
    previousScope.current = scope;
    const saved = cameras.current[scope];
    if (saved && (scope === "world" || saved.hasPosition || !position)) instance.setView(saved.center, saved.zoom, { animate: false });
    else if (scope === "world") instance.fitWorld({ animate: false });
    else if (position) instance.setView([position.lat, position.lng], 15, { animate: false });
    setSelected(null); setGroup(null);
  }, [scope]);

  // Local activity is fetched once per person, not once per pan/zoom.
  useEffect(() => {
    if (!position || (view === "map" && scope !== "local") || (view === "people" && !me.registered)) return;
    let active = true, pending = false;
    const update = async () => {
      if (!active || pending || document.visibilityState !== "visible" || navigator.onLine === false) return;
      pending = true; setLoading(true);
      try {
        const result = await api(view === "people" ? "discover" : "nearby", position);
        if (!active) return;
        if (view === "people") setPeople(result.people);
        else { setActivity(result.activity); setLocalLoaded(true); setLocalDataPosition(`${position.lat}:${position.lng}`); }
        setUpdatedAt(Date.now()); setError("");
      } catch (failure) { if (active) setError(failure.message); }
      finally { pending = false; if (active) setLoading(false); }
    };
    update(); const timer = setInterval(update, 8000);
    window.addEventListener("focus", update); window.addEventListener("online", update); document.addEventListener("visibilitychange", update);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", update); window.removeEventListener("online", update); document.removeEventListener("visibilitychange", update); };
  }, [position, view, scope, me.registered, me.shareLocation, me.discoverable]);
  useEffect(() => {
    if (view !== "map" || scope !== "world" || !viewport) return;
    let active = true, pending = false;
    const wrap = value => ((value + 180) % 360 + 360) % 360 - 180;
    const update = async () => {
      if (!active || pending || document.visibilityState !== "visible" || navigator.onLine === false) return;
      pending = true; setWorldLoading(true);
      const bounds = viewport.bounds, full = bounds.getEast() - bounds.getWest() >= 360;
      try {
        const result = await api("world-map", undefined, { south: Math.max(-90, bounds.getSouth()), north: Math.min(90, bounds.getNorth()), west: full ? -180 : wrap(bounds.getWest()), east: full ? 180 : wrap(bounds.getEast()), zoom: viewport.zoom });
        if (!active) return;
        setWorldActivity(result.activity); setWorldInfo({ ...result, viewKey: viewport.key }); setWorldLoaded(true); setWorldUpdatedAt(Date.now()); setWorldError("");
      } catch (failure) { if (active) setWorldError(failure.message); }
      finally { pending = false; if (active) setWorldLoading(false); }
    };
    setWorldLoading(true);
    const delay = setTimeout(update, 400), timer = setInterval(update, 30000);
    window.addEventListener("online", update); document.addEventListener("visibilitychange", update);
    return () => { active = false; clearTimeout(delay); clearInterval(timer); window.removeEventListener("online", update); document.removeEventListener("visibilitychange", update); };
  }, [view, scope, viewport?.key, me.shareLocation]);

  useEffect(() => {
    if (!map.current || !selfLayer.current) return;
    selfLayer.current.clearLayers();
    if (!position) return;
    const point = [position.lat, nearestLongitude(position.lng, map.current.getCenter().lng)];
    L.circle(point, { radius: 120, color: "#a4c8f4", fillColor: "#bad9fa", fillOpacity: .18, weight: 1, interactive: false }).addTo(selfLayer.current);
    L.circleMarker(point, { radius: 7, color: "white", fillColor: "#6b9ee8", fillOpacity: 1, weight: 3, interactive: false }).addTo(selfLayer.current);
  }, [position, viewport?.key]);
  useEffect(() => {
    if (!viewport || !map.current || !layers.current) return;
    const instance = map.current;
    const result = presentation;
    setSelected(current => current ? items.find(item => item.id === current.id) || null : null);
    setGroup(current => {
      if (!current) return null;
      const points = current.points.map(point => items.find(item => item.id === point.id)).filter(Boolean);
      return points.length ? { ...current, points, count: points.reduce((sum, point) => sum + Math.max(1, Number(point.count) || 1), 0) } : null;
    });
    layers.current.clearLayers();
    if (result.mode === "heat") { new CuteHeatLayer(items).addTo(layers.current); return; }
    result.groups.forEach(item => {
      const first = item.points[0], multiple = item.count > 1;
      const element = document.createElement("div");
      element.className = `live-map-marker ${first.status} ${multiple ? "map-mascot-group" : ""} ${first.isFriend ? "friend-marker" : ""} ${result.count <= 5 ? "sparse-map-marker" : ""}`;
      const figure = document.createElement("span");
      if (!multiple && first.avatarImage) {
        const photo = document.createElement("img"); photo.src = first.avatarImage; photo.alt = ""; photo.className = "map-profile-photo"; figure.append(photo);
      } else if (!multiple && (first.profileHandle || first.isFriend || first.isMe)) {
        figure.innerHTML = blobatar(first.avatarSeed, { size: 38, tone: .23, expression: first.status === "need" ? shy : happy });
      } else {
        const mascot = document.createElement("img"); mascot.src = `/assets/${multiple || first.status === "need" ? "shy-drop.webp" : "happy-drop.webp"}`; mascot.alt = ""; figure.append(mascot);
      }
      element.append(figure);
      if (multiple) { const badge = document.createElement("span"); badge.className = "map-mascot-count"; badge.textContent = fa(item.count); element.append(badge); }
      else if (first.profileHandle || first.isFriend || first.isMe) { const name = document.createElement("strong"); name.textContent = first.name; element.append(name); }
      const title = multiple ? `${fa(item.count)} نفر در این محدوده؛ برای جزئیات بزن` : `${first.name}؛ ${first.status === "need" ? "جیش داره" : "جیش کرده"}`;
      const at = instance.containerPointToLatLng([item.x, item.y]);
      L.marker(at, { title, alt: title, icon: L.divIcon({ html: element, className: "map-avatar-icon", iconSize: [48, 57], iconAnchor: [24, 29] }) })
        .addTo(layers.current).on("click", (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          if (multiple && instance.getZoom() < 18) { instance.setView(at, Math.min(18, instance.getZoom() + 2)); return; }
          setGroup(multiple ? item : null); setSelected(multiple ? null : first);
        });
    });
  }, [items, presentation]);

  async function locate() {
    if (!navigator.geolocation) { setGeoError("این مرورگر از مکان‌یابی پشتیبانی نمی‌کنه."); return; }
    setLocating(true); setGeoError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const point = { lat: coords.latitude, lng: coords.longitude };
      setPosition(point); setLocating(false);
      if (me.shareLocation) {
        try { const result = await api("location", { ...point, enabled: true, refreshOnly: true }); if (!result.enabled) refreshAccount(); }
        catch (failure) { notify(failure.message); }
      }
    }, (failure) => {
      setLocating(false); setGeoError(failure.code === 1 ? "اجازهٔ مکان داده نشده. می‌تونی از تنظیمات مرورگرت فعالش کنی." : "مکانت پیدا نشد. دوباره امتحان کن.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  function chooseScope(next) {
    if (next === "world" && !me.registered) { onAuth(); return; }
    if (next === "world" && !me.premium) { onPremium(); return; }
    setScope(next);
  }
  function seeCharacters() {
    const instance = map.current;
    if (!instance || !presentation.visible.length) return;
    const center = L.latLngBounds(presentation.visible.map(item => [item.lat, nearestLongitude(item.lng, instance.getCenter().lng)])).getCenter();
    instance.setView(center, Math.min(18, Math.max(16, instance.getZoom() + 2)));
  }
  const worldwide = view === "map" && scope === "world", fetching = worldwide ? worldLoading : loading;
  const fetchError = worldwide ? worldError : error, lastUpdate = worldwide ? worldUpdatedAt : updatedAt;
  const loaded = worldwide ? worldLoaded : localLoaded, oldWorldView = worldwide && worldInfo?.viewKey !== viewport?.key;
  const oldView = worldwide ? oldWorldView : localDataPosition !== (position ? `${position.lat}:${position.lng}` : null);
  const count = worldwide ? worldInfo?.inView || 0 : presentation.count;
  const countLabel = view === "people" ? `${fa(people.length)} پروفایل نزدیک` : !loaded ? (worldwide || position ? "داریم نقشه رو آماده می‌کنیم…" : "اطرافت رو پیدا کنیم؟") : `${fa(count)} نفر ${oldView ? "در نمای قبلی" : "در این نما"}`;
  const refreshLabel = !online ? "اتصال قطع شده" : fetchError ? "تلاش دوباره برای دریافت" : fetching ? "در حال تازه‌شدن…" : "به‌روزرسانی خودکار";
  // A refresh is not a new result. Keep confirmed emptiness visible until data
  // changes, while avoiding an empty claim for a different, unconfirmed location.
  const empty = view === "map" && loaded && !fetchError && !oldView && count === 0;
  return <section className="real-nearby-page tab-page">
    <header className="nearby-heading"><div><h1>این نزدیکا</h1><p><ShieldCheck size={12} />{view === "people" ? "آدم‌های نزدیک، با انتخاب خودشون" : "مکان‌ها تقریبی‌ان"}</p></div><button className={`map-visibility-shortcut is-${mode}`} onClick={onVisibility} aria-label={`نمایش من روی نقشه: ${visibilityLabel(mode)}`} title="تغییر نمایش من روی نقشه"><VisibilityIcon size={17} /><span>{visibilityLabel(mode)}</span><CaretDown size={12} /></button></header>
    <div className="nearby-view-tabs" role="tablist" aria-label="بخش‌های این نزدیکا">
      <button role="tab" id="nearby-map-tab" aria-selected={view === "map"} aria-controls="nearby-map-pane" onClick={() => setView("map")}><MapPin size={20} />نقشه</button>
      <button role="tab" id="nearby-people-tab" aria-selected={view === "people"} aria-controls="nearby-list-pane" onClick={() => setView("people")}><UsersThree size={20} />آدم‌های نزدیک من</button>
    </div>
    <div className="nearby-status-strip">
      <div className="nearby-count" role="status" aria-live="polite"><strong>{countLabel}</strong><small>{!online && lastUpdate ? `آخرین دریافت: ${relativeTime(lastUpdate)}` : view === "map" ? `ثبت‌های ۳۰ دقیقهٔ اخیر${worldwide ? " · همه‌جا بی‌نام" : ""}` : "نمایش پروفایل با انتخاب خودشون"}</small></div>
      <span className={`nearby-refresh ${fetching && online ? "is-fetching" : ""} ${!online || fetchError ? "is-offline" : ""}`} title={worldwide ? "دریافت خودکار هر ۳۰ ثانیه" : "دریافت خودکار هر ۸ ثانیه"}>{online ? <ArrowClockwise size={17} aria-hidden="true" /> : <WifiSlash size={17} aria-hidden="true" />}<span>{refreshLabel}</span></span>
    </div>
    <div className="nearby-map-pane" id="nearby-map-pane" role="tabpanel" aria-labelledby="nearby-map-tab" hidden={view !== "map"} data-presentation={presentation.mode}>
      <div className="real-map" ref={container} aria-label="نقشهٔ فعالیت‌ها با مکان تقریبی" />
      <div className="map-scope-switch" role="group" aria-label="محدودهٔ نقشه"><button aria-pressed={scope === "local"} onClick={() => chooseScope("local")}><MapPin size={17} />اطراف من</button><button aria-pressed={scope === "world"} onClick={() => chooseScope("world")}><GlobeHemisphereWest size={18} />همه‌جا <CrownSimple size={15} /></button></div>
      <div className="map-controls"><button aria-label="بزرگ‌نمایی نقشه" title="بزرگ‌نمایی نقشه" onClick={() => map.current?.zoomIn()}><Plus size={21} /></button><button aria-label="کوچک‌نمایی نقشه" title="کوچک‌نمایی نقشه" onClick={() => map.current?.zoomOut()}><Minus size={21} /></button></div>
      {(position || scope === "world") && <button className="map-locate-control" aria-label="مکان من" title="مکان من" onClick={() => position ? map.current?.setView([position.lat, position.lng], 15) : locate()}><NavigationArrow size={22} /></button>}
      {!position && scope === "local" && <div className="map-permission-card"><button className="map-permission-action" onClick={locate} disabled={locating} aria-label="نمایش اطراف من" aria-busy={locating}><img src="/assets/shy-drop.webp" width="40" height="46" alt="" /><span><strong>{locating ? "داریم مکانت رو پیدا می‌کنیم…" : "نمایش اطراف من"}</strong>{geoError ? <small className="map-permission-error" role="status">{geoError}</small> : <><small>فعلاً نمای تهران؛ با اجازهٔ مکان، اطرافت رو ببین.</small><small>این کار مکانت رو منتشر نمی‌کنه.</small></>}</span><i><NavigationArrow size={21} /></i></button></div>}
      {fetchError && <p className="map-fetch-error" role="status">{fetchError}</p>}
      {empty && <div className="map-calm-state"><img src="/assets/shy-drop.webp" width="38" height="44" alt="" /><div><strong>هنوز ثبت تازه‌ای اینجا نیست</strong><p>ثبت‌های ۳۰ دقیقهٔ اخیرِ این نما</p></div><button onClick={onInvite} aria-label="دوستام رو دعوت کنم" title="دوستام رو دعوت کنم"><UsersThree size={19} /><span>دعوت</span></button></div>}
      {presentation.mode === "heat" && !selected && !group && <button className="map-heat-hint" onClick={seeCharacters}><MagnifyingGlassPlus size={19} /><span>نزدیک‌تر ببین، شخصیت‌ها پیداشون می‌شه</span></button>}
      {(selected || group) && <section className="map-selection-sheet" aria-label="جزئیات محدودهٔ انتخاب‌شده"><button className="map-selection-close" aria-label="بستن جزئیات نقشه" onClick={() => { setSelected(null); setGroup(null); }}><X size={18} /></button>
        {selected && <><div className="selected-neighbor">{selected.profileHandle || selected.isFriend || selected.isMe ? <Avatar person={selected} size={46} mood={selected.status === "need" ? "shy" : "happy"} /> : <img src={`/assets/${selected.status === "need" ? "shy-drop.webp" : "happy-drop.webp"}`} width="46" height="52" alt="" />}<div><strong>{selected.name}{selected.isFriend && <span>دوستت</span>}</strong><p>{selected.status === "need" ? "جیش داره" : "جیش کرده"} · {relativeTime(selected.createdAt)}</p></div></div>{scope !== "world" && selected.profileHandle ? <button className="map-profile-action" onClick={() => onProfile(selected.profileHandle)}><UserProfileIcon /><span>{selected.isMe ? "پروفایل من" : "دیدن پروفایل"}</span><CaretDown size={15} /></button> : <p className="map-profile-private">{scope === "world" ? "در نمای همه‌جا، ثبت‌ها همیشه بی‌نامن." : selected.profileKind === "guest" ? "مهمان جیشوئه؛ پروفایل عمومی نداره." : "بی‌نام روی نقشه‌ست؛ پروفایلش نمایش داده نمی‌شه."}</p>}</>}
        {group && <><h2>{fa(group.count)} نفر، همین حوالی</h2>{scope === "world" ? <p>ثبت‌های بی‌نام با مکان تقریبی؛ هیچ پروفایلی اینجا نمایش داده نمی‌شه.</p> : <div className="map-group-people">{group.points.map(item => <div key={item.id}><img src={`/assets/${item.status === "need" ? "shy-drop.webp" : "happy-drop.webp"}`} width="28" height="32" alt="" /><span>{item.name}</span>{item.profileHandle ? <button onClick={() => onProfile(item.profileHandle)}>پروفایل</button> : <small>{item.profileKind === "guest" ? "مهمان" : "بی‌نام"}</small>}</div>)}</div>}</>}
      </section>}
    </div>
    <div className="nearby-list-pane" id="nearby-list-pane" role="tabpanel" aria-labelledby="nearby-people-tab" hidden={view !== "people"}>
      <div className="nearby-list-intro"><UsersThree size={27} /><div><h2>آدم‌های نزدیک من</h2><p>تا ۳ کیلومتر اطرافت؛ فقط کسانی که نمایش پروفایلشون رو روشن کردن.</p></div></div>
      {!position && <div className="nearby-list-permission"><img src="/assets/shy-drop.webp" alt="قطرهٔ خجالتی جیشو" width="100" height="100" /><p>برای دیدن آدم‌های این نزدیکا، مکانت رو پیدا کنیم؟ مکانت با این کار منتشر نمی‌شه.</p>{geoError && <p className="form-error">{geoError}</p>}<button className="button button-primary" onClick={locate} disabled={locating}>{locating ? "داریم مکانت رو پیدا می‌کنیم…" : "نمایش آدم‌های نزدیک"}</button></div>}
      {position && <div className="nearby-people-panel">{me.registered ? <><div className="nearby-people-list">{people.map(person => <div className="nearby-person" key={person.id}><Avatar person={person} size={42} /><div><strong>{person.name}</strong><span dir="ltr">@{person.handle}</span><small>{person.distance}</small></div><button disabled={peopleBusy || person.connection !== null} onClick={async () => { setPeopleBusy(true); try { await onConnect(person.handle); const updated = await api("discover", position); setPeople(updated.people); } finally { setPeopleBusy(false); } }}>{person.connection === "accepted" ? "دوستید" : person.connection === "pending" ? "درخواست ثبت شده" : "درخواست دوستی"}</button></div>)}</div>{!people.length && <p className="map-empty-note">هنوز کسی نمایش پروفایلش رو در این محدوده روشن نکرده.</p>}</> : <><p>برای آشنایی با آدم‌های نزدیک، با دعوت عضو شو.</p><button className="button button-lilac" onClick={onAuth}>ورود یا عضویت</button></>}</div>}
    </div>
  </section>;
}
