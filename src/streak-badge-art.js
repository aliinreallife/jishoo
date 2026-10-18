// Plain canvas geometry is shared by UI badges and exported PNGs. No SVG/DOM capture.
function circle(ctx,x,y,r,fill) { ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill(); }
function polygon(ctx,points,fill) { ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill(); }
function leaf(ctx,x,y,angle,color) { ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.ellipse(0,0,5,11,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.restore(); }
function sparkle(ctx,x,y,r,color) { polygon(ctx,[[x,y-r],[x+r*.25,y-r*.25],[x+r,y],[x+r*.25,y+r*.25],[x,y+r],[x-r*.25,y+r*.25],[x-r,y],[x-r*.25,y-r*.25]],color); }
function drop(ctx,x,y,r,fill,ink) {
  ctx.beginPath();ctx.moveTo(x,y-r);ctx.bezierCurveTo(x-r*.3,y-r*.45,x-r*.8,y,x-r*.8,y+r*.25);ctx.bezierCurveTo(x-r*.8,y+r*1.2,x+r*.8,y+r*1.2,x+r*.8,y+r*.25);ctx.bezierCurveTo(x+r*.8,y,x+r*.3,y-r*.45,x,y-r);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=1.2;ctx.stroke();
  circle(ctx,x-r*.28,y+r*.22,1.4,ink);circle(ctx,x+r*.28,y+r*.22,1.4,ink);
  ctx.beginPath();ctx.arc(x,y+r*.33,r*.16,0,Math.PI);ctx.stroke();
  circle(ctx,x-r*.5,y+r*.4,1.8,'#efb2b3');circle(ctx,x+r*.5,y+r*.4,1.8,'#efb2b3');
}
export function drawStreakBadge(ctx,item,x,y,size) {
  ctx.save();ctx.translate(x,y);ctx.scale(size/120,size/120);
  const {light,color,accent,shape,motif}=item;
  // Ribbons sit behind each medal; ornament and silhouette vary by milestone.
  polygon(ctx,[[30,72],[52,78],[43,117],[30,106],[18,111]],accent);
  polygon(ctx,[[68,78],[90,72],[102,111],[90,106],[77,117]],accent);
  ctx.globalAlpha=.22;polygon(ctx,[[37,81],[43,82],[36,108],[30,106]],'#fff');polygon(ctx,[[77,82],[83,81],[90,106],[84,108]],'#fff');ctx.globalAlpha=1;
  const gradient=ctx.createLinearGradient(25,10,95,90);gradient.addColorStop(0,light);gradient.addColorStop(1,accent);
  ctx.beginPath();
  if(shape==='shield') {ctx.moveTo(60,5);ctx.quadraticCurveTo(83,18,104,20);ctx.lineTo(99,59);ctx.quadraticCurveTo(91,88,60,102);ctx.quadraticCurveTo(29,88,21,59);ctx.lineTo(16,20);ctx.quadraticCurveTo(37,18,60,5);}
  else if(shape==='heart') {ctx.moveTo(60,100);ctx.bezierCurveTo(5,73,7,20,36,15);ctx.quadraticCurveTo(50,11,60,29);ctx.quadraticCurveTo(70,11,84,15);ctx.bezierCurveTo(113,20,115,73,60,100);}
  else { const n=shape==='sun'?32:shape==='flower'?64:80;for(let i=0;i<n;i++){const a=i/n*Math.PI*2-Math.PI/2,r=shape==='sun'?(i%2?40:50):shape==='flower'?45+5*Math.cos(i/n*Math.PI*16):46+3*Math.cos(i/n*Math.PI*24);const px=60+Math.cos(a)*r,py=53+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);} }
  ctx.closePath();ctx.fillStyle=gradient;ctx.shadowColor=color+'33';ctx.shadowBlur=5;ctx.shadowOffsetY=3;ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=3;ctx.strokeStyle='#fffdf4';ctx.stroke();
  circle(ctx,60,53,32,'#fffaf0');ctx.beginPath();ctx.arc(60,53,28.5,0,Math.PI*2);ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.stroke();
  if(motif==='sprout'||motif==='garden'){ctx.beginPath();ctx.moveTo(60,61);ctx.quadraticCurveTo(57,42,62,32);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();leaf(ctx,52,39,-.8,accent);leaf(ctx,67,35,.8,color);if(motif==='garden'){for(let i=0;i<6;i++)leaf(ctx,60+Math.cos(i*Math.PI/3)*19,49+Math.sin(i*Math.PI/3)*19,i*Math.PI/3,'#dba6bc');}drop(ctx,60,61,10,light,color);}
  if(motif==='flower'){for(let i=0;i<8;i++)circle(ctx,60+Math.cos(i*Math.PI/4)*15,51+Math.sin(i*Math.PI/4)*15,8,accent);drop(ctx,60,51,11,'#fff3b5',color);}
  if(motif==='moon'){circle(ctx,57,49,19,color);circle(ctx,66,42,17,'#fffaf0');sparkle(ctx,77,64,5,accent);drop(ctx,52,60,8,light,color);}
  if(motif==='sun'){for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(60+Math.cos(a)*19,52+Math.sin(a)*19);ctx.lineTo(60+Math.cos(a)*24,52+Math.sin(a)*24);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}circle(ctx,60,52,16,'#f3d16e');drop(ctx,60,51,10,'#fff4b8',color);}
  if(motif==='twins'){drop(ctx,48,53,13,'#b9dce9',color);drop(ctx,71,53,13,'#ffe9a2',color);sparkle(ctx,60,33,4,accent);}
  if(motif==='comet'){polygon(ctx,[[29,34],[74,44],[62,67]],accent);ctx.beginPath();ctx.moveTo(28,46);ctx.lineTo(49,59);ctx.strokeStyle='#e1bf62';ctx.lineWidth=3;ctx.stroke();drop(ctx,66,54,17,'#c4dcfa',color);sparkle(ctx,79,31,4,accent);}
  if(motif==='crown'){polygon(ctx,[[38,44],[35,27],[49,36],[60,22],[71,36],[85,27],[82,44]],'#e6c46e');drop(ctx,60,61,18,'#ffe8a3',color);for(let i=0;i<5;i++){leaf(ctx,22-i*2,74-i*10,-.7,accent);leaf(ctx,98+i*2,74-i*10,.7,accent);}circle(ctx,60,21,3,'#fff6d6');sparkle(ctx,16,24,6,color);sparkle(ctx,105,37,5,color);}
  if(motif==='garden'||motif==='comet') {sparkle(ctx,16,22,5,accent);sparkle(ctx,104,82,4,color);}
  ctx.restore();
}
