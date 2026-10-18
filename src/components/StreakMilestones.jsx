import React from 'react';
import { LockKey, ShareNetwork, Check } from '@phosphor-icons/react';
import { streakMilestones, earnedStreakMilestones } from '../../lib/streak-milestones';
import { fa } from '../api';
import MilestoneBadge from './MilestoneBadge';
import './Streak.css';
export default function StreakMilestones({ best=0, onShare }) {
  const earned=earnedStreakMilestones(best);
  return <section className="streak-collection" aria-label="نشان‌های زنجیره">
    <header><div><h2>نشان‌های هر روز</h2><p>هر قدم، یه شکل تازه از ادامه‌دادن</p></div><span>{fa(earned.length)} از {fa(streakMilestones.length)}</span></header>
    <div className="streak-milestone-grid">{streakMilestones.map(item=>{
      const unlocked=best>=item.days;
      return <article className={`streak-milestone ${unlocked?'is-earned':'is-locked'}`} key={item.days} style={{'--milestone-color':item.color,'--milestone-light':item.light}}>
        <span className="milestone-period">{item.label}</span>
        <MilestoneBadge milestone={item} locked={!unlocked} size={112}/>
        <h3>{item.name}</h3><p>{fa(item.days)} روز توی یک زنجیره</p>
        {unlocked?<div className="milestone-earned"><span><Check size={13}/>مال تو شد!</span><button aria-label={`اشتراک نشان ${item.name}`} onClick={()=>onShare(item.days)}><ShareNetwork size={18}/></button></div>:<div className="milestone-locked"><LockKey size={13}/>{fa(Math.max(0,item.days-best))} روز تا این نشان</div>}
      </article>;
    })}</div>
    <p className="streak-collection-note">نشان‌هایی که گرفتی همیشه مال تو می‌مونن، حتی اگه زنجیره‌ات از نو شروع بشه. ماه‌ها در این مجموعه ۳۰روزه‌ان؛ نشان سال با ۳۶۵ روز باز می‌شه.</p>
  </section>;
}
