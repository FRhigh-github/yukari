/* <yukari-loader auto-hide></yukari-loader> — hide() / show() */
(()=>{'use strict';if(customElements.get('yukari-loader'))return;
  function createRenderer(svg,frame){
    const cords=svg.querySelector('#cords'),defs=svg.querySelector('#rope-defs');
    const ns='http://www.w3.org/2000/svg';
    const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>n*n*(3-2*n),mix=(a,b,t)=>a+(b-a)*t;
    function element(name,attrs,parent){const e=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));parent.appendChild(e);return e;}
  const centerX=240;
  const base=[
    [[385,615],[339,655],[285,704],[236,724]],
    [[236,724],[203,741],[171,742],[156,723]],
    [[156,723],[138,700],[150,671],[175,658]],
    [[175,658],[196,647],[220,652],[240,665]],
    [[240,665],[278,689],[327,730],[372,779]]
  ];
  // Smooth the first cord, then mirror that exact geometry for the second.
  for(let j=1;j<base.length;j++){
    const p=base[j][0],a=base[j-1][2],b=base[j][1];
    const ax=p[0]-a[0],ay=p[1]-a[1],bx=b[0]-p[0],by=b[1]-p[1];
    const al=Math.hypot(ax,ay),bl=Math.hypot(bx,by),dx=ax/al+bx/bl,dy=ay/al+by/bl,l=Math.hypot(dx,dy);
    base[j-1][2]=[p[0]-dx/l*al,p[1]-dy/l*al];base[j][1]=[p[0]+dx/l*bl,p[1]+dy/l*bl];
  }
  const white=base.map(c=>c.map(([x,y])=>[centerX+(x-245)*1.16,204+(y-704)*1.16]));
  const gray=white.slice().reverse().map(c=>c.slice().reverse().map(([x,y])=>[centerX*2-x,y]));
  const curves=[white,gray],bounds=[];
  function bezier(c,t){const s=1-t;return{x:s*s*s*c[0][0]+3*s*s*t*c[1][0]+3*s*t*t*c[2][0]+t*t*t*c[3][0],y:s*s*s*c[0][1]+3*s*s*t*c[1][1]+3*s*t*t*c[2][1]+t*t*t*c[3][1]};}
  function mask(id){const m=element('mask',{id,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',style:'mask-type:luminance'},defs);bounds.push(m);return m;}
  const strands=curves.map((cs,i)=>{
    const points=cs.flatMap(c=>Array.from({length:96},(_,j)=>bezier(c,j/96)));points.push(bezier(cs.at(-1),1));
    const lengths=[0];points.forEach((p,j)=>{if(j)lengths.push(lengths[j-1]+Math.hypot(p.x-points[j-1].x,p.y-points[j-1].y));});
    const group=element('g',{'data-rope':i,class:i?'rope-second':'rope-first'},cords);
    const layers=[24,21].map((width,j)=>{
      const m=mask(`cord-shape-${i}-${j}`);
      const rect=element('rect',{class:j?'cord-body':'cord-edge',mask:`url(#cord-shape-${i}-${j})`},group);bounds.push(rect);
      return{width,mask:m};
    });
    const direction={x:cs[0][1][0]-cs[0][0][0],y:cs[0][1][1]-cs[0][0][1]};
    return{i,group,layers,points,lengths,direction,total:lengths.at(-1),visits:[],chunks:[]};
  });
  const mirrorError=Math.max(...strands[0].points.map((p,j)=>{const q=strands[1].points.at(-1-j);return Math.hypot(p.x+q.x-centerX*2,p.y-q.y);}));
  svg.dataset.symmetryError=mirrorError.toExponential(2);
  const crossings=[];
  for(let r=0;r<2;r++)for(let q=r;q<2;q++){
    const apts=strands[r].points,bpts=strands[q].points;
    for(let i=0;i<apts.length-1;i++)for(let j=r===q?i+3:0;j<bpts.length-1;j++){
      const a=apts[i],b=apts[i+1],c=bpts[j],d=bpts[j+1],rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
      if(Math.abs(den)<1e-8)continue;
      const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
      if(t<=0||t>=1||u<=0||u>=1)continue;
      const first={rope:r,distance:mix(strands[r].lengths[i],strands[r].lengths[i+1],t)};
      const second={rope:q,distance:mix(strands[q].lengths[j],strands[q].lengths[j+1],u)};
      const crossing={visits:[first,second],id:crossings.length};first.crossing=crossing;second.crossing=crossing;
      strands[r].visits.push(first);strands[q].visits.push(second);crossings.push(crossing);
    }
  }
  strands.forEach(s=>{s.visits.sort((a,b)=>a.distance-b.distance);s.visits.forEach((v,j)=>v.over=j%2===1);});
  if(crossings.length!==8||crossings.some(c=>c.visits.filter(v=>v.over).length!==1))throw new Error('Invalid knot crossings');
  svg.dataset.crossings=String(crossings.length);
  for(const c of crossings){
    c.over=c.visits.find(v=>v.over);c.under=c.visits.find(v=>!v.over);
    const m=mask(`under-${c.id}`),bg=element('rect',{fill:'white'},m);bounds.push(bg);
    c.cut=element('path',{fill:'none',stroke:'black','stroke-width':25,'stroke-linecap':'round','stroke-linejoin':'round'},m);
  }
  for(const s of strands)s.visits.forEach((v,j)=>{
    const lo=j?(s.visits[j-1].distance+v.distance)/2:0,hi=j<s.visits.length-1?(v.distance+s.visits[j+1].distance)/2:s.total;
    const layers=s.layers.map(layer=>{
      const group=element('g',v.over?{}:{mask:`url(#under-${v.crossing.id})`},layer.mask);
      const path=element('path',{fill:'none',stroke:'white','stroke-width':layer.width,'stroke-linecap':'butt','stroke-linejoin':'round'},group);
      const start=element('circle',{fill:'white',r:0},group),end=element('circle',{fill:'white',r:0},group);
      return{path,start,end,radius:layer.width/2};
    });
    s.chunks.push({index:j,lo,hi,layers});
  });
  function at(s,d){
    d=Math.max(0,Math.min(s.total,d));let lo=0,hi=s.lengths.length-1;
    while(lo+1<hi){const m=(lo+hi)>>1;if(s.lengths[m]<d)lo=m;else hi=m;}
    const f=(d-s.lengths[lo])/(s.lengths[hi]-s.lengths[lo]||1);return{x:mix(s.points[lo].x,s.points[hi].x,f),y:mix(s.points[lo].y,s.points[hi].y,f)};
  }
  function portion(s,lo,hi){
    lo=Math.max(0,lo);hi=Math.min(s.total,hi);if(hi<=lo)return[];
    const pts=[at(s,lo)];s.points.forEach((p,j)=>{if(s.lengths[j]>lo&&s.lengths[j]<hi)pts.push(p);});pts.push(at(s,hi));return pts;
  }
  function pathData(pts){return pts.map((p,j)=>`${j?'L':'M'}${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join(' ');}
  function cap(circle,p,r){circle.setAttribute('r',p?r:0);if(p){circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);}}
  let reach=1400,lastPainted=0;
  function measure(){
    const box=svg.getBoundingClientRect(),outer=frame.getBoundingClientRect(),ratio=410/Math.max(box.width,1);
    reach=Math.max(innerWidth,innerHeight)*ratio+500;
    const region={x:35+(outer.left-box.left)*ratio-32,y:10+(outer.top-box.top)*ratio-32,width:outer.width*ratio+64,height:outer.height*ratio+64};
    bounds.forEach(el=>Object.entries(region).forEach(([k,v])=>el.setAttribute(k,v)));
  }
  measure();
  function paint(seconds){
    lastPainted=seconds;svg.dataset.time=seconds.toFixed(3);const heads=[];
    for(const s of strands){
      const enter=ease(clamp(seconds/1.1));
      // Both ends advance together; retraction overlaps the final weaving phase.
      const feed=clamp((seconds-1.1)/4.35);
      const tail=ease(clamp((seconds-4.45)/1.8)),p=s.points[0],l=Math.hypot(s.direction.x,s.direction.y);
      const tangent=[p.x-s.direction.x/l*90,p.y-s.direction.y/l*90];
      const inlet=s.i?[[centerX-reach,460],[-200,450],tangent,[p.x,p.y]]:[[centerX+reach,65],[710,45],tangent,[p.x,p.y]];
      const inletPts=[];if(tail<enter)for(let j=0;j<=140;j++)inletPts.push(bezier(inlet,mix(tail,enter,j/140)));
      const head=s.total*feed;heads[s.i]=head;
      for(const chunk of s.chunks){
        const pts=portion(s,Math.max(0,chunk.lo-.6),Math.min(head,chunk.hi+.6));
        if(chunk.index===0&&inletPts.length)pts.unshift(...inletPts);
        const d=pathData(pts),hasHead=(feed>0&&head>chunk.lo&&head<=chunk.hi)||(feed===0&&chunk.index===0&&inletPts.length>0);
        const tip=hasHead?(feed>0?at(s,head):inletPts.at(-1)):null;
        const start=chunk.index===0&&pts.length?pts[0]:null;
        for(const layer of chunk.layers){layer.path.setAttribute('d',d);cap(layer.start,start,layer.radius);cap(layer.end,tip,layer.radius);}
      }
    }
    for(const c of crossings){const s=strands[c.over.rope],d=c.over.distance;c.cut.setAttribute('d',pathData(portion(s,d-48,Math.min(d+48,heads[s.i]))));}
  }

    return {paint,resize(){measure();paint(lastPainted);}};
  }

class YukariLoader extends HTMLElement{
  static get observedAttributes(){return ['speed'];}
  constructor(){super();this.attachShadow({mode:'open'}).innerHTML="<style>\n:host{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;overflow:hidden;background:var(--yukari-background,#faf9f6);opacity:1;transition:opacity .18s ease}:host([hidden]){display:none}:host(.leaving){opacity:0;pointer-events:none}\nsvg{width:88px;height:auto;overflow:visible;animation:pulse var(--pulse-duration,1.6s) ease-in-out infinite}\n.cord-edge{fill:#b7ae9d;stroke:none}.cord-body{fill:#eee6d7;stroke:none}.rope-second .cord-edge{fill:#8a1d22}.rope-second .cord-body{fill:#b7282e;stroke:none}\n@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}@media(prefers-reduced-motion:reduce){svg{animation:none}:host{transition:none}}\n</style><svg class=\"mark\" viewBox=\"55 75 370 250\" role=\"img\" aria-labelledby=\"logo-title logo-desc\">\n      <title id=\"logo-title\">読み込み中</title>\n      <desc id=\"logo-desc\">ゆっくり明滅する結び目。</desc>\n      <defs id=\"rope-defs\"></defs>\n      <g id=\"cords\" aria-hidden=\"true\"></g>\n      \n    </svg>";this._resize=()=>{if(this._renderer&&!this.hidden)this._renderer.resize();};this._loaded=()=>this.hide();}
  connectedCallback(){if(!this._renderer)this._renderer=createRenderer(this.shadowRoot.querySelector('svg'),this);this._renderer.paint(6.25);window.addEventListener('resize',this._resize);this.setAttribute('aria-busy',String(!this.hidden));if(this.hasAttribute('auto-hide')){if(document.readyState==='complete')queueMicrotask(()=>{if(this.isConnected)this.hide();});else window.addEventListener('load',this._loaded,{once:true});}}
  disconnectedCallback(){window.removeEventListener('resize',this._resize);window.removeEventListener('load',this._loaded);clearTimeout(this._timer);if(this._resolve){this._resolve();this._resolve=null;this._promise=null;}}
  attributeChangedCallback(){const rate=Number(this.getAttribute('speed')||1);this.style.setProperty('--pulse-duration',(1.6/(Number.isFinite(rate)?Math.max(.25,Math.min(2,rate)):1))+'s');}
  show(){clearTimeout(this._timer);if(this._resolve){this._resolve();this._resolve=null;this._promise=null;}this.hidden=false;this.classList.remove('leaving');this.setAttribute('aria-busy','true');if(this._renderer){this._renderer.resize();this._renderer.paint(6.25);}}
  hide(){if(this._promise)return this._promise;if(this.hidden)return Promise.resolve();this.setAttribute('aria-busy','false');this.classList.add('leaving');this._promise=new Promise(resolve=>{this._resolve=resolve;this._timer=setTimeout(()=>{this.hidden=true;this.classList.remove('leaving');this._resolve=null;this._promise=null;resolve();this.dispatchEvent(new CustomEvent('yukari:loaded',{bubbles:true,composed:true}));},matchMedia('(prefers-reduced-motion: reduce)').matches?0:190);});return this._promise;}
}
customElements.define('yukari-loader',YukariLoader);
})();
