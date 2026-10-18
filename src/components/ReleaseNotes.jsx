import React from "react";
import { currentRelease } from "../current-release";
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
