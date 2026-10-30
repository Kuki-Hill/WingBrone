import{describe,it,expect}from'vitest';import{Game,HeadGate,sequence,directions}from'../src/game';
describe('trial',()=>{
 it('balances directions and avoids triples',()=>{const a=sequence();expect(a).toHaveLength(12);for(const d of directions)expect(a.filter(v=>v===d)).toHaveLength(3);expect(a.some((d,i)=>i>1&&d===a[i-1]&&d===a[i-2])).toBe(false);});
 it('requires sustained pose and neutral rearming',()=>{const h=new HeadGate();expect(h.update(-15,0,0)).toBe(null);expect(h.update(-15,0,110)).toBe('left');expect(h.update(-15,0,500)).toBe(null);h.update(0,0,600);h.update(15,0,650);expect(h.update(15,0,760)).toBe('right');});
 it('does not score tutorial',()=>{const g=new Game();g.start();for(const d of directions){g.trigger(d);g.tick(1);}expect(g.phase).toBe('trial');expect(g.hits).toBe(0);expect(g.countdown).toBe(3);});
 it('judges event position even when frame crosses collision',()=>{const g=new Game();g.start();g.phase='trial';g.time=3.05;g.trigger(g.attacks[0]);g.tick(.7);expect(g.hits).toBe(1);expect(g.capture?.combo).toBe(1);});
 it('freezes paused attacks and ignores repeated dodges',()=>{const g=new Game();g.start();expect(g.trigger('left')).toBe(true);expect(g.trigger('right')).toBe(false);g.paused=true;g.tick(5);expect(g.time).toBe(0);});
 it('completes all misses and resets per-run state',()=>{const g=new Game();g.start();g.phase='trial';g.tick(61);expect(g.outcomes).toHaveLength(12);expect(g.phase).toBe('results');expect(g.capture).toBe(null);const run=g.run;g.start();expect(g.run).toBe(run+1);expect(g.outcomes).toHaveLength(0);});
 it('retains highest combo and chooses later equal combo',()=>{const g=new Game();g.start();g.phase='trial';for(let i=0;i<12;i++){g.time=i*5+3.1;g.dodge=null;if(i%2===0)g.trigger(g.attacks[i]);g.tick(.5);}expect(g.capture?.index).toBe(10);expect(g.best).toBe(1);});
});
