import React from "react";
import { currentRelease, releases } from "../releases";
import "./ReleaseNotes.css";

export function ReleaseNotes({ onClose }) {
  return <div className="release-notes" dir="rtl">
    <img src="/assets/happy-drop.webp" width="100" height="100" alt="قطرهٔ خوشحال جیشو" />
    <span className="release-version">تازه‌های جیشو · {currentRelease.label}</span>
    <h2>{currentRelease.title}</h2>
    <ul>{currentRelease.items.map((item) => <li key={item}>{item}</li>)}</ul>
    <button className="release-ack" onClick={onClose}>چه خوب! بریم تو جیشو</button>
    <a href="/changelog">دیدن همهٔ تغییرها</a>
  </div>;
}
export function ReleasePage() {
  return <main className="release-page" dir="rtl">
    <a href="/" className="release-home">جیشو 💧</a>
    <h1>تازه‌های جیشو</h1><p>هر بار یه کم راحت‌تر، یه کم قشنگ‌تر.</p>
    {releases.map((release) => <article key={release.version}>
      <span className="release-version">نسخهٔ {release.label}</span><h2>{release.title}</h2>
      <ul>{release.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </article>)}
    <a className="release-ack" href="/#/home">برم تو جیشو</a>
  </main>;
}
