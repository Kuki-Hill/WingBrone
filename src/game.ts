export type Direction = 'left'|'right'|'up'|'down';
export const directions:Direction[]=['left','right','up','down'];
export const labels:Record<Direction,string>={left:'向左',right:'向右',up:'抬头',down:'低头'};
export const vectors:Record<Direction,[number,number]>={left:[-2.6,0],right:[2.6,0],up:[0,2.2],down:[0,-2.2]};
export function sequence(){ let seed=731; const a=directions.flatMap(d=>[d,d,d]); do {for(let i=a.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}}while(a.some((d,i)=>i>1&&d===a[i-1]&&d===a[i-2]));return a; }
export type Phase='home'|'tutorial'|'trial'|'results';
export type Outcome={index:number;success:boolean;combo:number;time:number;direction:Direction};
export class Game {
 phase:Phase='home'; time=0; paused=false; countdown=0; run=0; resolved=-1; tutorialIndex=0; combo=0; best=0; hits=0; outcomes:Outcome[]=[]; dodge:{direction:Direction;start:number}|null=null; last:Outcome|null=null; attacks=sequence(); capture:Outcome|null=null;
 start(){this.run++;this.phase='tutorial';this.time=0;this.resolved=-1;this.tutorialIndex=0;this.combo=0;this.best=0;this.hits=0;this.outcomes=[];this.last=null;this.dodge=null;this.paused=false;this.countdown=0;this.capture=null;}
 get activeDirection(){return this.phase==='tutorial'?directions[this.tutorialIndex]:this.attacks[Math.min(11,Math.floor(this.time/5))];}
 get cycle(){return this.time%5;}
 get position():[number,number]{return this.positionAt(this.time);}
 positionAt(t:number):[number,number]{if(!this.dodge)return[0,0];const age=t-this.dodge.start;if(age<0||age>=.9)return[0,0];const envelope=age<.2?Math.sin(age/.2*Math.PI/2):age<.65?1:Math.cos((age-.65)/.25*Math.PI/2);const v=vectors[this.dodge.direction];return[v[0]*envelope,v[1]*envelope];}
 trigger(direction:Direction){if(this.paused||this.countdown>0||!['trial','tutorial'].includes(this.phase)||this.dodge&&this.time-this.dodge.start<.9)return false;this.dodge={direction,start:this.time};return true;}
 tick(dt:number){if(this.paused||this.phase==='home'||this.phase==='results')return;if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);return;}const next=this.time+Math.max(0,dt);
 if(this.phase==='tutorial'){this.time=next;if(this.dodge?.direction===directions[this.tutorialIndex]&&this.time-this.dodge.start>=.9){this.tutorialIndex++;this.dodge=null;if(this.tutorialIndex===4){this.phase='trial';this.time=0;this.countdown=3;}}return;}
 for(let i=this.resolved+1;i<12;i++){const event=i*5+3.5;if(event>next)break;const [x,y]=this.positionAt(event);const d=this.attacks[i];const success=d==='left'?x< -1.6:d==='right'?x>1.6:d==='up'?y>1.4:y< -1.4;this.combo=success?this.combo+1:0;this.best=Math.max(this.best,this.combo);if(success)this.hits++;const result={index:i,success,combo:this.combo,time:event,direction:d};this.outcomes.push(result);this.last=result;this.resolved=i;if(success&&(!this.capture||result.combo>=this.capture.combo))this.capture=result;}
 this.time=Math.min(60,next);if(next>=60)this.phase='results';}
}
export class HeadGate {
 armed=true;candidate:Direction|null=null;since=0;
 update(yaw:number,pitch:number,now:number,sensitivity=1):Direction|null{const values=[-yaw/12,yaw/12,pitch/9,-pitch/9].map(v=>v*sensitivity);if(Math.max(...values)<.5){this.armed=true;this.candidate=null;return null;}if(!this.armed)return null;const i=values.indexOf(Math.max(...values));if(values[i]<1){this.candidate=null;return null;}const d=directions[i];if(d!==this.candidate){this.candidate=d;this.since=now;return null;}if(now-this.since>=100){this.armed=false;this.candidate=null;return d;}return null;}
}
