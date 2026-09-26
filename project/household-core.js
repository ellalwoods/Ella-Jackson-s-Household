// Shared data model + view-model builder for all Household dashboard variants.
const DS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ML=['January','February','March','April','May','June','July','August','September','October','November','December'];
const PAL=['oklch(0.66 0.07 60)','oklch(0.76 0.09 95)','oklch(0.62 0.07 245)','oklch(0.66 0.08 35)','oklch(0.64 0.07 295)','oklch(0.70 0.06 210)','oklch(0.58 0.04 80)','oklch(0.76 0.07 130)'];
export const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const mondayOf=d=>addDays(d,-((d.getDay()+6)%7));
const weeksBetween=(a,b)=>Math.round((mondayOf(b)-mondayOf(a))/604800000);
const money=n=>'$'+Math.round(n).toLocaleString('en-AU');
const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const uid=p=>p+Math.random().toString(36).slice(2,8);
const norm=s=>s.trim().toLowerCase();
const rgb=h=>{const n=parseInt(h.replace('#',''),16);return [n>>16,n>>8&255,n&255]};
const tint=(h,t)=>{const [r,g,b]=rgb(h);const f=v=>Math.round(v+(255-v)*t);return `rgb(${f(r)},${f(g)},${f(b)})`};
const fgFor=h=>{const [r,g,b]=rgb(h);return (0.299*r+0.587*g+0.114*b)/255>0.6?'#1F1D1A':'#FFFFFF'};

function seed(){
  const mon=mondayOf(new Date()),start=iso(mon);
  const recipes=[
    {id:'r1',name:'Red lentil dal',cost:9,ings:['red lentils','onion','garlic','ginger','coconut milk','rice']},
    {id:'r2',name:'Spaghetti bolognese',cost:16,ings:['beef mince','spaghetti','tinned tomatoes','onion','garlic']},
    {id:'r3',name:'Barramundi tacos',cost:23,ings:['barramundi','tortillas','red cabbage','lime','avocado']}
  ];
  const meals={};
  [[0,'r1','E'],[2,'r2','J'],[4,'r3','E']].forEach(([i,r,c])=>meals[iso(addDays(mon,i))]={r,cook:c});
  const P=(name,state,note='')=>({id:uid('p'),name,state,note});
  return {
    people:{E:{income:0},J:{income:0}},
    cats:[
      {id:'c1',name:'Rent',amount:780,split:50,color:PAL[0]},
      {id:'c2',name:'Groceries',amount:200,split:50,color:PAL[1]},
      {id:'c3',name:'Power & internet',amount:80,split:50,color:PAL[2]},
      {id:'c4',name:'Leisure',amount:100,split:50,color:PAL[3]}
    ],
    recipes,meals,
    pantry:[P('rice','full'),P('onion','full'),P('garlic','out'),P('tinned tomatoes','low','1 tin left')],
    chores:[
      {id:'h1',name:'Bins out',who:'alt',type:'weekly',every:1,days:[1],start},
      {id:'h2',name:'Vacuum',who:'J',type:'weekly',every:1,days:[5],start},
      {id:'h3',name:'Clean bathroom',who:'E',type:'weekly',every:2,days:[6],start},
      {id:'h4',name:'Grocery shop',who:'both',type:'weekly',every:1,days:[6],start}
    ],
    done:{},bought:{},period:'weekly'
  };
}
const blankChore=()=>({name:'',who:'E',type:'weekly',every:1,days:[],dom:1,date:iso(new Date())});
const DATA_KEYS=['people','cats','recipes','meals','pantry','chores','done','bought','period'];

export function initState(key){
  let data=null;
  try{data=JSON.parse(localStorage.getItem(key))}catch(e){}
  return {ready:true,...(data||seed()),weekOff:0,monthOff:0,cal:false,open:{},newCat:{name:'',amount:''},newRec:{name:'',cost:'',ings:''},newItem:'',draft:blankChore(),editing:null,copied:false,canShare:typeof navigator!=='undefined'&&!!navigator.share};
}
export function persist(state,key){
  if(!state.ready)return;
  const d={};DATA_KEYS.forEach(k=>d[k]=state[k]);
  try{localStorage.setItem(key,JSON.stringify(d))}catch(e){}
}
function occurs(c,d){
  const wd=(d.getDay()+6)%7;
  if(c.type==='weekly'){const w=weeksBetween(parse(c.start),d);return w>=0&&w%(c.every||1)===0&&c.days.includes(wd)}
  if(c.type==='monthly')return d.getDate()===Number(c.dom);
  if(c.type==='once')return iso(d)===c.date;
  return false;
}
function whoFor(c,d){
  if(c.who!=='alt')return c.who;
  const k=Math.floor(weeksBetween(parse(c.start),d)/(c.every||1));
  return ((k%2)+2)%2===0?'E':'J';
}

export const DEFAULT_THEME={ink:'#1F1D1A',onInk:'#F5F2EC',surface:'#FFFFFF',line:'#E3DDD2',muted:'#6F685E',faint:'#A89F92',track:'#EEE9E1',
  selBg:'#FFFFFF',fullBg:'#1F1D1A',fullFg:'#F5F2EC',lowBg:'#E8B64C',lowFg:'#1F1D1A',outBg:'#C8553D',outFg:'#FFFFFF',
  chipIn:'#E7E1D6',chipLowBg:'#F3E3BF',chipLowFg:'#6B4A0E',calBg:'#FBF9F5',emptyMeal:'#F1EDE6',mealTint:0.9};

export function build(cmp,T){
  T={...DEFAULT_THEME,...(T||{})};
  const s=cmp.state,set=p=>cmp.setState(p);
  const eHex=cmp.props.ellaColor||'#E98AB0',jHex=cmp.props.jacksonColor||'#174A3C';
  const E={key:'E',name:'Ella',initial:'E',color:eHex,fg:fgFor(eHex),pale:tint(eHex,0.8),soft:tint(eHex,0.9)};
  const J={key:'J',name:'Jackson',initial:'J',color:jHex,fg:fgFor(jHex),pale:tint(jHex,0.86),soft:tint(jHex,0.93)};
  const split=`linear-gradient(90deg, ${eHex} 50%, ${jHex} 50%)`;
  const B={key:'both',name:'Both',initial:'E+J',color:split,fg:T.ink,pale:T.track,soft:T.track};
  const P={E,J,both:B};
  const today=new Date(),todayIso=iso(today);
  const mon=addDays(mondayOf(today),s.weekOff*7);
  const dates=[0,1,2,3,4,5,6].map(i=>addDays(mon,i));
  const rById={};s.recipes.forEach(r=>rById[r.id]=r);
  const pantryBy={};s.pantry.forEach(p=>pantryBy[norm(p.name)]=p);
  const toggleDone=k=>cmp.setState(st=>{const done={...st.done};done[k]?delete done[k]:done[k]=1;return {done}});
  const open=s.open||{};
  const tog=k=>()=>cmp.setState(st=>({open:{...st.open,[k]:!st.open[k]}}));

  let eC=0,jC=0,doneC=0,totalC=0,mealCost=0,planned=0;
  const days=dates.map((d,i)=>{
    const k=iso(d),m=s.meals[k],r=m&&rById[m.r];
    if(r){mealCost+=r.cost;planned++}
    const chores=s.chores.filter(c=>occurs(c,d)).map(c=>{
      const w=whoFor(c,d),p=P[w],dk=c.id+'|'+k,done=!!s.done[dk];
      if(w==='E'||w==='both')eC++;if(w==='J'||w==='both')jC++;totalC++;if(done)doneC++;
      return {name:c.name,who:w,whoName:p.name,color:p.color,pale:p.pale,soft:p.soft,ring:w==='both'?T.ink:p.color,checkBg:done?(w==='both'?T.ink:p.color):T.surface,check:done?'✓':'',checkFg:w==='E'?E.fg:'#fff',deco:done?'line-through':'none',op:done?0.5:1,done,toggle:()=>toggleDone(dk)};
    });
    const cook=m&&r?(P[m.cook]||E):null;
    const setCook=who=>()=>cmp.setState(st=>{const meals={...st.meals};if(!meals[k])return null;meals[k]={...meals[k],cook:who};return {meals}});
    const cookBtn=p=>{const on=!!(cook&&cook.key===p.key);return {on,bg:on?p.color:T.surface,fg:on?p.fg:T.ink,onClick:setCook(p.key)}};
    return {label:DS[i],long:DL[i],short:DS[i].slice(0,2),num:d.getDate(),dateLabel:`${d.getDate()} ${MS[d.getMonth()]}`,isToday:k===todayIso,
      todayTag:k===todayIso?'Today':'',
      hasMeal:!!r,mealName:r?r.name:'Nothing planned',mealCost:r?money(r.cost):'—',
      cook:cook||{name:'',color:'transparent',pale:T.emptyMeal,soft:T.emptyMeal,initial:'',fg:T.ink},
      mealBg:cook?tint(cook.color,T.mealTint):T.emptyMeal,
      recipeId:r?r.id:'',chores,
      choresE:chores.filter(c=>c.who==='E'),choresJ:chores.filter(c=>c.who==='J'),choresB:chores.filter(c=>c.who==='both'),
      emptyChores:chores.length?'':'—',
      onRecipe:e=>{const v=e.target.value;cmp.setState(st=>{const meals={...st.meals};if(!v)delete meals[k];else meals[k]={r:v,cook:(meals[k]&&meals[k].cook)||'E'};return {meals}})},
      cookE:cookBtn(E),cookJ:cookBtn(J)};
  });

  // shopping
  const need={};
  dates.forEach((d,i)=>{const m=s.meals[iso(d)],r=m&&rById[m.r];if(!r)return;r.ings.forEach(n=>{const key=norm(n);if(!need[key])need[key]={name:n,days:[]};if(!need[key].days.includes(DS[i]))need[key].days.push(DS[i])})});
  const wk=iso(mon);
  const toggleBought=key=>()=>cmp.setState(st=>{const bought={...st.bought},bk=wk+'|'+key;bought[bk]?delete bought[bk]:bought[bk]=1;return {bought}});
  const buy=[],top=[],stock=[];
  Object.keys(need).sort().forEach(key=>{
    const it=need[key],p=pantryBy[key],checked=!!s.bought[wk+'|'+key];
    const row={name:it.name,key,meals:it.days.join(', '),note:p&&p.note?p.note:'',checked,check:checked?'✓':'',checkBg:checked?T.ink:T.surface,checkBgLow:checked?T.lowBg:T.surface,deco:checked?'line-through':'none',op:checked?0.5:1,toggle:toggleBought(key)};
    if(p&&p.state==='full')stock.push(it.name);else if(p&&p.state==='low')top.push(row);else buy.push(row);
  });
  const shop={buy,top,buyCount:buy.length,topCount:top.length,stockCount:stock.length,stockNames:stock.length?stock.join(', '):'Nothing from this week',
    emptyMsg:buy.length?'':(planned?'Everything is already in the cupboard.':'Plan some dinners to build a list.'),
    anyChecked:[...buy,...top].some(i=>i.checked),hasTop:top.length>0};
  const weekTitle=`${mon.getDate()} ${MS[mon.getMonth()]}`;
  const listText=()=>['Shopping list — week of '+weekTitle,'','TO BUY',...buy.map(i=>`[ ] ${i.name} (${i.meals})`),'','TOP UP (running low)',...top.map(i=>`[ ] ${i.name}${i.note?' — '+i.note:''}`)].join('\n');

  // budget
  const mult={weekly:1,fortnightly:2,monthly:52/12}[s.period]||1;
  const catSum=s.cats.reduce((a,c)=>a+Number(c.amount||0),0);
  const catTotal=catSum||1;
  let acc=0,eSpend=0,jSpend=0;const stops=[];
  const updCat=(id,patch)=>cmp.setState(st=>({cats:st.cats.map(c=>c.id===id?{...c,...patch}:c)}));
  const cats=s.cats.map(c=>{
    const a=Number(c.amount||0),pct=a/catTotal*100;
    stops.push(`${c.color} ${acc}% ${acc+pct}%`);acc+=pct;
    const e=a*c.split/100,j=a-e;eSpend+=e;jSpend+=j;
    return {name:c.name,color:c.color,amount:Math.round(a*mult),amountLabel:money(a*mult),pct:Math.round(pct)+'%',w:pct+'%',split:c.split,jSplit:100-c.split,eW:c.split+'%',jW:(100-c.split)+'%',eAmt:money(e*mult),jAmt:money(j*mult),
      onName:ev=>updCat(c.id,{name:ev.target.value}),onAmount:ev=>updCat(c.id,{amount:Number(ev.target.value||0)/mult}),
      onSplit:ev=>updCat(c.id,{split:Number(ev.target.value)}),onDelete:()=>cmp.setState(st=>({cats:st.cats.filter(x=>x.id!==c.id)}))};
  });
  const eInc=Number(s.people.E.income||0),jInc=Number(s.people.J.income||0);
  const eRatio=(eInc+jInc)?Math.round(eInc/(eInc+jInc)*100):50;
  const incomeRows=[[E,eInc,eSpend],[J,jInc,jSpend]].map(([p,inc,sp])=>({name:p.name,color:p.color,pale:p.pale,fg:p.fg,income:inc?Math.round(inc*mult):'',pays:money(sp*mult),left:inc?money((inc-sp)*mult):'—',share:inc?Math.round(sp/inc*100)+'% of income':'add income',w:(catSum?sp/catSum*100:50)+'%',
    onIncome:ev=>{const v=Number(ev.target.value||0)/mult;cmp.setState(st=>({people:{...st.people,[p.key]:{income:v}}}))}}));
  const groc=s.cats.find(c=>/grocer/i.test(c.name));
  const gBudget=groc?Number(groc.amount):0;
  const grocery={used:money(mealCost),budget:gBudget?money(gBudget):'—',w:gBudget?Math.min(100,mealCost/gBudget*100)+'%':'0%',pct:gBudget?Math.round(mealCost/gBudget*100)+'%':'—'};

  // recipes
  const recipes=s.recipes.map(r=>{
    const on=dates.map((d,i)=>{const m=s.meals[iso(d)];return m&&m.r===r.id?DS[i]:null}).filter(Boolean);
    return {name:r.name,cost:money(r.cost),planned:on.length?'This week: '+on.join(', '):'Not on this week',count:r.ings.length+' ingredients',
      ings:r.ings.map(n=>{const p=pantryBy[norm(n)],st=p&&p.state;
        return st==='full'?{name:n,bg:T.chipIn,border:`1px solid ${T.chipIn}`,fg:T.ink}:st==='low'?{name:n,bg:T.chipLowBg,border:`1px solid ${T.chipLowBg}`,fg:T.chipLowFg}:{name:n,bg:'transparent',border:`1px dashed ${T.faint}`,fg:T.muted}}),
      onDelete:()=>cmp.setState(st=>({recipes:st.recipes.filter(x=>x.id!==r.id)}))};
  });

  // pantry
  const STATES=[['full','Full',T.fullBg,T.fullFg],['low','Low',T.lowBg,T.lowFg],['out','Replace',T.outBg,T.outFg]];
  const updP=(id,patch)=>cmp.setState(st=>({pantry:st.pantry.map(p=>p.id===id?{...p,...patch}:p)}));
  const pantry=s.pantry.map(p=>{
    const key=norm(p.name),inWeek=need[key]?need[key].days:[];
    const inRec=s.recipes.filter(r=>r.ings.some(n=>norm(n)===key)).length;
    const cur=STATES.find(x=>x[0]===p.state)||STATES[0];
    return {name:p.name,note:p.note,stateLabel:cur[1],stateBg:cur[2],stateFg:cur[3],
      uses:inWeek.length?`This week: ${inWeek.join(', ')}`:inRec?`In ${inRec} recipe${inRec>1?'s':''}`:'Not in a recipe',
      states:STATES.map(([v,l,bg,fg])=>({label:l,bg:p.state===v?bg:'transparent',fg:p.state===v?fg:T.muted,onClick:()=>updP(p.id,{state:v})})),
      onNote:e=>updP(p.id,{note:e.target.value}),onDelete:()=>cmp.setState(st=>({pantry:st.pantry.filter(x=>x.id!==p.id)}))};
  });

  // chore editor
  const dr=s.draft;
  const setDr=patch=>cmp.setState(st=>({draft:{...st.draft,...patch}}));
  const WHO=[['E','Ella',eHex],['J','Jackson',jHex],['both','Both',split],['alt','Take turns',split]];
  const whoOpts=WHO.map(([v,l,dot])=>({label:l,dot,on:dr.who===v,bg:dr.who===v?T.ink:T.surface,fg:dr.who===v?T.onInk:T.ink,onClick:()=>setDr({who:v})}));
  const typeOpts=[['weekly','Weekly'],['monthly','Monthly'],['once','One-off']].map(([v,l])=>({label:l,bg:dr.type===v?T.selBg:'transparent',fg:dr.type===v?T.ink:T.muted,onClick:()=>setDr({type:v})}));
  const dayOpts=DS.map((l,i)=>{const on=dr.days.includes(i);return {label:l.slice(0,2),bg:on?T.ink:T.surface,fg:on?T.onInk:T.ink,onClick:()=>setDr({days:on?dr.days.filter(x=>x!==i):[...dr.days,i].sort()})}});
  const whoLabel=w=>({E:'Ella',J:'Jackson',both:'Both',alt:'Take turns'})[w];
  const summary=c=>c.type==='weekly'?`${c.every>1?`Every ${c.every} weeks`:'Weekly'} · ${c.days.length?c.days.map(i=>DS[i]).join(', '):'no days set'}`:c.type==='monthly'?`Monthly on the ${ord(Number(c.dom))}`:`Once · ${(()=>{const d=parse(c.date);return `${d.getDate()} ${MS[d.getMonth()]}`})()}`;
  const choreList=s.chores.map(c=>({name:c.name,who:whoLabel(c.who),summary:summary(c),dot:c.who==='E'?eHex:c.who==='J'?jHex:split,
    onEdit:()=>cmp.setState(st=>({editing:c.id,draft:{...blankChore(),...c},open:{...st.open,chores:true}})),
    onDelete:()=>cmp.setState(st=>({chores:st.chores.filter(x=>x.id!==c.id),editing:st.editing===c.id?null:st.editing,draft:st.editing===c.id?blankChore():st.draft}))}));
  const saveDraft=()=>{
    const d=s.draft;if(!d.name.trim())return;
    const clean={name:d.name.trim(),who:d.who,type:d.type,every:Number(d.every)||1,days:d.days,dom:Math.min(28,Math.max(1,Number(d.dom)||1)),date:d.date};
    cmp.setState(st=>st.editing?{chores:st.chores.map(c=>c.id===st.editing?{...c,...clean}:c),editing:null,draft:blankChore()}:{chores:[...st.chores,{id:uid('h'),start:iso(mondayOf(new Date())),...clean}],draft:blankChore()});
  };

  // calendar
  const mFirst=new Date(today.getFullYear(),today.getMonth()+s.monthOff,1);
  const gStart=mondayOf(mFirst);
  const mLast=new Date(mFirst.getFullYear(),mFirst.getMonth()+1,0);
  const nCells=Math.ceil((Math.round((mLast-gStart)/86400000)+1)/7)*7;
  const selStart=iso(mon),selEnd=iso(dates[6]);
  const calCells=Array.from({length:nCells},(_,i)=>{
    const d=addDays(gStart,i),k=iso(d),m=s.meals[k],r=m&&rById[m.r],inM=d.getMonth()===mFirst.getMonth();
    const dots=s.chores.filter(c=>occurs(c,d)).map(c=>({color:P[whoFor(c,d)].color}));
    const inSel=k>=selStart&&k<=selEnd;
    return {num:d.getDate(),meal:r?r.name:'',dots,opacity:inM?1:0.35,isToday:k===todayIso,inSel,
      border:k===todayIso?`1.5px solid ${T.ink}`:`1px solid ${T.line}`,bg:inSel?T.surface:T.calBg,
      onClick:()=>cmp.setState({weekOff:weeksBetween(today,d),cal:false})};
  });

  const offLabel=o=>o===0?'This week':o===1?'Next week':o===-1?'Last week':o>0?`${o} weeks ahead`:`${-o} weeks ago`;
  const sun=dates[6];
  const seg=on=>({bg:on?T.selBg:'transparent',fg:on?T.ink:T.muted});
  const chev=k=>open[k]?'−':'+';

  return {
    ready:true,E,J,B,dayHeads:DS,
    weekRange:`${mon.getDate()} ${MS[mon.getMonth()]} – ${sun.getDate()} ${MS[sun.getMonth()]}`,
    monthLabel:`${ML[mFirst.getMonth()]} ${mFirst.getFullYear()}`,
    navLabel:s.cal?`${ML[mFirst.getMonth()]} ${mFirst.getFullYear()}`:`${mon.getDate()} ${MS[mon.getMonth()]} – ${sun.getDate()} ${MS[sun.getMonth()]}`,
    navSub:s.cal?(s.monthOff===0?'This month':'Planning ahead'):offLabel(s.weekOff),
    weekNo:'Week '+Math.ceil(((mon-new Date(mon.getFullYear(),0,1))/86400000+1)/7),
    prev:()=>cmp.setState(st=>st.cal?{monthOff:st.monthOff-1}:{weekOff:st.weekOff-1}),
    next:()=>cmp.setState(st=>st.cal?{monthOff:st.monthOff+1}:{weekOff:st.weekOff+1}),
    goToday:()=>set({weekOff:0,monthOff:0}),
    cal:!!s.cal,notCal:!s.cal,toggleCal:()=>cmp.setState(st=>({cal:!st.cal,monthOff:st.cal?st.monthOff:weeksToMonthOff(st.weekOff)})),
    calLabel:s.cal?'Back to week':'Month view',
    weekBtn:seg(!s.cal),monthBtn:seg(!!s.cal),setWeekView:()=>set({cal:false}),setMonthView:()=>cmp.setState(st=>({cal:true,monthOff:weeksToMonthOff(st.weekOff)})),
    calCells,days,weekMealCost:money(mealCost),mealsPlanned:planned,
    groceryNote:gBudget?`${Math.round(mealCost/gBudget*100)}% of groceries`:'',
    choreSplit:{e:eC,j:jC,total:totalC,done:doneC,doneLabel:`${doneC}/${totalC} done`,eW:(eC+jC)?(eC/(eC+jC)*100)+'%':'50%',jW:(eC+jC)?(jC/(eC+jC)*100)+'%':'50%'},
    shop,copyLabel:s.copied?'Copied ✓':'Copy',canShare:!!s.canShare,
    copyList:()=>{const t=listText();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{set({copied:true});setTimeout(()=>set({copied:false}),1600)}).catch(()=>{})},
    downloadList:()=>{const b=new Blob([listText()],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`shopping-list-${wk}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},
    shareList:()=>{navigator.share({title:'Shopping list',text:listText()}).catch(()=>{})},
    moveToCupboard:()=>cmp.setState(st=>{
      const pick=[...buy,...top].filter(i=>i.checked);const pantry=[...st.pantry];const bought={...st.bought};
      pick.forEach(i=>{const idx=pantry.findIndex(p=>norm(p.name)===i.key);if(idx>=0)pantry[idx]={...pantry[idx],state:'full'};else pantry.push({id:uid('p'),name:i.name,state:'full',note:''});delete bought[wk+'|'+i.key]});
      return {pantry,bought};
    }),
    periods:[['weekly','Week'],['fortnightly','Fortnight'],['monthly','Month']].map(([v,l])=>({label:l,...seg(s.period===v),onClick:()=>set({period:v})})),
    periodWord:{weekly:'per week',fortnightly:'per fortnight',monthly:'per month'}[s.period],
    donutBg:catSum?`conic-gradient(${stops.join(',')})`:T.track,cats,hasCats:cats.length>0,catsEmpty:cats.length?'':'No categories yet',
    incomeRows,grocery,totalSpend:money(catSum*mult),
    incomeRatio:`${eRatio}/${100-eRatio}`,
    splitByIncome:()=>cmp.setState(st=>({cats:st.cats.map(c=>({...c,split:eRatio}))})),
    splitEven:()=>cmp.setState(st=>({cats:st.cats.map(c=>({...c,split:50}))})),
    newCat:s.newCat,
    onNewCatName:e=>cmp.setState(st=>({newCat:{...st.newCat,name:e.target.value}})),
    onNewCatAmt:e=>cmp.setState(st=>({newCat:{...st.newCat,amount:e.target.value}})),
    addCat:()=>{const n=s.newCat.name.trim();if(!n)return;cmp.setState(st=>({cats:[...st.cats,{id:uid('c'),name:n,amount:Number(st.newCat.amount||0)/mult,split:50,color:PAL[st.cats.length%PAL.length]}],newCat:{name:'',amount:''}}))},
    recipeOpts:s.recipes.map(r=>({id:r.id,name:`${r.name} · ${money(r.cost)}`})),
    recipes,recipeCount:recipes.length,recipesEmpty:recipes.length?'':'No recipes yet — add your first below.',newRec:s.newRec,
    onRecName:e=>cmp.setState(st=>({newRec:{...st.newRec,name:e.target.value}})),
    onRecCost:e=>cmp.setState(st=>({newRec:{...st.newRec,cost:e.target.value}})),
    onRecIngs:e=>cmp.setState(st=>({newRec:{...st.newRec,ings:e.target.value}})),
    addRecipe:()=>{const r=s.newRec;if(!r.name.trim())return;cmp.setState(st=>({recipes:[...st.recipes,{id:uid('r'),name:r.name.trim(),cost:Number(r.cost||0),ings:r.ings.split(',').map(x=>x.trim()).filter(Boolean)}],newRec:{name:'',cost:'',ings:''}}))},
    pantry,pantryCount:pantry.length,pantryEmpty:pantry.length?'':'Cupboard is empty.',newItem:s.newItem,
    pantryLow:s.pantry.filter(p=>p.state!=='full').length,
    onNewItem:e=>set({newItem:e.target.value}),
    addItem:()=>{const n=s.newItem.trim();if(!n)return;cmp.setState(st=>({pantry:[{id:uid('p'),name:n,state:'full',note:''},...st.pantry],newItem:''}))},
    draft:dr,draftTitle:s.editing?'Edit chore':'New chore',draftCta:s.editing?'Save changes':'Add chore',isEditing:!!s.editing,
    whoOpts,typeOpts,dayOpts,draftWeekly:dr.type==='weekly',draftMonthly:dr.type==='monthly',draftOnce:dr.type==='once',
    onDraftName:e=>setDr({name:e.target.value}),onDraftEvery:e=>setDr({every:Number(e.target.value)}),
    onDraftDom:e=>setDr({dom:e.target.value}),onDraftDate:e=>setDr({date:e.target.value}),
    saveDraft,cancelDraft:()=>set({editing:null,draft:blankChore()}),choreList,choreCount:choreList.length,
    open,chev:{recipes:chev('recipes'),pantry:chev('pantry'),budget:chev('budget'),chores:chev('chores'),meals:chev('meals')},
    toggleRecipes:tog('recipes'),togglePantry:tog('pantry'),toggleBudget:tog('budget'),toggleChores:tog('chores'),toggleMeals:tog('meals')
  };
  function weeksToMonthOff(wo){const d=addDays(mondayOf(today),wo*7+3);return (d.getFullYear()-today.getFullYear())*12+d.getMonth()-today.getMonth()}
}
