import React, { useEffect, useRef } from 'react';
import { drawStreakBadge } from '../streak-badge-art';
export default function MilestoneBadge({ milestone, size=100, locked=false }) {
  const canvas=useRef();
  useEffect(()=>{const node=canvas.current;const ctx=node.getContext('2d');ctx.clearRect(0,0,node.width,node.height);drawStreakBadge(ctx,milestone,0,0,node.width);},[milestone,size]);
  return <span className={`milestone-art ${locked?'is-locked':''}`} style={{width:size,height:size}} role="img" aria-label={`نشان ${milestone.name}${locked?'؛ هنوز باز نشده':''}`}><canvas ref={canvas} width={size*2} height={size*2} aria-hidden="true" /></span>;
}
