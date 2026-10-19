import React from "react";
import "./PublicBase.css";
import { releases } from "../releases";
import "./ReleaseNotes.css";

export default function ReleasePage() {
  return <main className="release-page" dir="rtl">
    <a href="/" className="release-home">جیشو 💧</a>
    <h1>تازه‌های جیشو</h1><p>هر بار یه کم راحت‌تر، یه کم قشنگ‌تر.</p>
    {releases.map((release) => <article key={release.version}>
      <span className="release-version">نسخهٔ {release.label}</span><h2>{release.title}</h2>
      <ul>{release.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </article>)}
    <a className="release-ack" href="/home">برم تو جیشو</a>
  </main>;
}
