import React, { useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, CaretDown, CaretLeft, TreeStructure } from "@phosphor-icons/react";
import { api, fa } from "../api";
import { Avatar } from "./Character";
import { invitationForest, invitationPath } from "../invitation-tree";
import "./AdminInvitationTree.css";

function Branch({ node, depth = 0, onFocus }) {
  const [expanded, setExpanded] = useState(depth < 2);
  return <li>
    <div className={`invitation-node ${node.banned ? "suspended" : ""}`} data-member-id={node.id}>
      {node.children.length ? <button className="branch-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={`زیرشاخه‌های ${node.name}`}>
        {expanded ? <CaretDown size={17} /> : <CaretLeft size={17} />}
      </button> : <span className="branch-leaf" aria-hidden="true">•</span>}
      <Avatar person={node} size={34} />
      <div className="invitation-node-copy">
        <strong>{node.name}</strong>
        {node.handle && <span dir="ltr">@{node.handle}</span>}
        <small>{node.level ? `نسل ${fa(node.level)}` : "سرشاخه"} · {fa(node.children.length)} دعوت مستقیم{node.descendants > node.children.length ? ` · ${fa(node.descendants)} نفر در ادامه` : ""}</small>
        {node.banned && <small>حساب غیرفعال</small>}
        {node.inconsistent && <small>مسیر دعوت نیاز به بررسی داره.</small>}
      </div>
    </div>
    {expanded && node.children.length > 0 && (depth >= 4
      ? <button className="invitation-deeper" onClick={() => onFocus(node.id)}>ادامهٔ این شاخه · {fa(node.descendants)} نفر <CaretLeft size={15} /></button>
      : <ol>{node.children.map(child => <Branch key={child.id} node={child} depth={depth + 1} onFocus={onFocus} />)}</ol>)}
  </li>;
}

export default function AdminInvitationTree() {
  const [members, setMembers] = useState([]), [offset, setOffset] = useState(0), [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [search, setSearch] = useState(""), [focus, setFocus] = useState(null), [rootLimit, setRootLimit] = useState(20);
  const forest = useMemo(() => invitationForest(members), [members]);
  async function load(append = false) {
    setBusy(true); setError("");
    try {
      const result = await api("admin-invitation-tree", undefined, { offset: append ? offset : 0 });
      setMembers(previous => append ? [...new Map([...previous, ...result.members].map(item => [item.id, item])).values()] : result.members);
      setHasMore(result.hasMore); setOffset(result.nextOffset || 0);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  const term = search.trim().replace(/^@/, "").toLocaleLowerCase("fa");
  const matches = term ? [...forest.nodes.values()].filter(node => `${node.name} ${node.handle || ""}`.toLocaleLowerCase("fa").includes(term)).slice(0, 12) : [];
  const focused = forest.nodes.get(focus), roots = focused ? [focused] : forest.roots.slice(0, rootLimit);
  function showBranch(id) { setFocus(id); setSearch(""); }
  return <section className="admin-invitation-tree" aria-labelledby="invitation-tree-title">
    <header><div><h2 id="invitation-tree-title"><TreeStructure size={22} /> درخت دعوت‌ها</h2><p>هر شاخه می‌گه چه کسی عضو بعدی رو دعوت کرده.</p></div>
      <button className="tree-refresh" disabled={busy} onClick={() => load()} aria-label="تازه‌سازی درخت دعوت‌ها"><ArrowsClockwise size={20} /></button>
    </header>
    <p className="invitation-generations">نسل ۱: دعوت مستقیم · نسل ۲: دعوتِ دعوت‌شده‌ها</p>
    <div className="invitation-tree-totals"><span>{fa(members.length)} عضو{hasMore ? " بارگذاری‌شده" : ""}</span><span>{fa(forest.levels)} نسل{hasMore ? " در این بخش" : ""}</span></div>
    <label className="tree-search-label">پیداکردن شاخهٔ یک نفر<input aria-label="جستجو در درخت دعوت‌ها" placeholder="اسم یا شناسه، مثلاً ali" value={search} onChange={event => setSearch(event.target.value)} /></label>
    {term && <div className="invitation-tree-results" aria-label="نتیجهٔ جستجوی درخت">{matches.length ? matches.map(node => <button key={node.id} onClick={() => showBranch(node.id)}><strong>{node.name}</strong><span dir="ltr">@{node.handle || "—"}</span><CaretLeft size={16} /></button>) : <p>بین اعضای بارگذاری‌شده پیدا نشد.</p>}</div>}
    {focused && <div className="invitation-focus"><button onClick={() => setFocus(null)}>همهٔ شاخه‌ها</button><p>{invitationPath(forest.nodes, focus).map((node, index) => <React.Fragment key={node.id}>{index > 0 && <span aria-hidden="true"> ← </span>}<button onClick={() => showBranch(node.id)}>{node.name}</button></React.Fragment>)}</p></div>}
    {error && <p className="form-error" role="alert">{error}<button onClick={() => load()}>دوباره تلاش کن</button></p>}
    {!members.length && busy ? <p role="status">داریم مسیر دعوت‌ها رو می‌چینیم…</p> : !members.length && !error ? <p>هنوز عضوی برای نمایش نیست.</p> : <ol className="invitation-forest" aria-label="شاخه‌های دعوت اعضا">{roots.map(node => <Branch key={node.id + (focus || "all")} node={node} onFocus={showBranch} />)}</ol>}
    {!focused && forest.roots.length > rootLimit && <button className="tree-more" onClick={() => setRootLimit(rootLimit + 20)}>شاخه‌های بیشتر</button>}
    {hasMore && <button className="tree-more" disabled={busy} onClick={() => load(true)}>{busy ? "در حال بارگذاری…" : "بارگذاری ادامهٔ درخت"}</button>}
    <p className="invitation-tree-note">فقط عضویت‌های کامل شمرده می‌شن. سرشاخه یعنی دعوت‌کننده‌ای در فهرست فعلی ثبت نشده.{hasMore ? " برای دیدن ادامهٔ نسل‌ها، باقی اعضا رو هم بارگذاری کن." : ""}</p>
  </section>;
}
