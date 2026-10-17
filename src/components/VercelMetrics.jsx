import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { redactMetricEvent } from "../observability";

const beforeSend = event => redactMetricEvent(event, location.href);
export default function VercelMetrics({ analytics, speed, page }) {
  return <>
    {analytics && <Analytics route={page} path={page} beforeSend={beforeSend} mode="production" debug={false} />}
    {speed && <SpeedInsights route={page} beforeSend={beforeSend} sampleRate={0.1} debug={false} />}
  </>;
}
