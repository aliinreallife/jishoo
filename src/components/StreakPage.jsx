import React from 'react';
import { ArrowRight, ShareNetwork, Fire, CaretLeft } from '@phosphor-icons/react';
import { fa } from '../api';
import { earnedStreakMilestones, streakMilestones } from '../../lib/streak-milestones';
import DailyStreak from './DailyStreak';
import StreakMilestones from './StreakMilestones';
import MilestoneBadge from './MilestoneBadge';
import { Mascot } from './Mascot';
import './Streak.css';
export default function StreakPage({ data,onBack,onShare }) {
  const streak=data.stats.streak;
  if(!streak)return <section className="page streak-page"><button onClick={onBack}>برگشت به من</button><p>داریم زنجیره‌ات رو آماده می‌کنیم…</p></section>;
  const currentBadge=earnedStreakMilestones(streak.current).at(-1),next=streakMilestones.find(item=>item.days>streak.current);
  return <section className="page streak-page">
    <header className="community-heading"><button aria-label="برگشت به من" onClick={onBack}><ArrowRight size={22}/></button><div><h1>قرارِ هر روز</h1><p>قطره‌قطره، تا روزهای قشنگ‌تر</p></div><button aria-label="اشتراک زنجیرهٔ من" onClick={()=>onShare()} disabled={!streak.current}><ShareNetwork size={23}/></button></header>
    <div className={`streak-hero ${currentBadge?'has-badge':''}`} style={currentBadge?{'--streak-hero-tint':currentBadge.light}:undefined}>
      <div className="streak-hero-art"><span className="streak-hero-orbit"/>{currentBadge?<MilestoneBadge milestone={currentBadge} size={190}/>:<Mascot size={163} mood={streak.current?'happy':'shy'}/>}</div>
      <span className="streak-hero-kicker"><Fire size={17} weight="duotone"/>زنجیرهٔ الان من</span>
      <h2>{fa(streak.current)} <span>روز پشت‌سرهم</span></h2>
      <p>{streak.protectedYesterday?'دیروز فریز مراقب زنجیره‌ات بود؛ امروز هنوز وقت داری.':streak.activeToday?'امروز هم به قرارمون رسیدی. فردا دوباره می‌بینیمت!':'روزی یک «جیش کردم» کافیه؛ با ریتم خودت ادامه بده.'}</p>
      {streak.current>0&&<button className="streak-share-pill" onClick={()=>onShare()}><ShareNetwork size={18}/>این زنجیره رو شریک شم<CaretLeft size={14}/></button>}
    </div>
    {next?<div className="streak-next"><div><strong>قدم بعد: {next.name}</strong><span>{fa(streak.current)} از {fa(next.days)} روز</span></div><div role="progressbar" aria-label={`پیشرفت زنجیرهٔ فعلی تا ${next.name}`} aria-valuemin={0} aria-valuemax={next.days} aria-valuenow={streak.current}><span style={{width:`${Math.min(100,streak.current/next.days*100)}%`}}/></div></div>:<p className="streak-finish-note">یه سال کنار هم؛ از اینجا به بعد، هر روز یه ادامهٔ تازه‌ست.</p>}
    <DailyStreak streak={streak}/>
    <StreakMilestones best={streak.best} onShare={onShare}/>
  </section>;
}
