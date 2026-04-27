/**
 * 計算100トレーニング - script.js
 * 固定3スロット表示 + ONNX手書き認識
 */
'use strict';

const TOTAL=100,PENALTY=5,MS_SHOW=1500;
const RANKS=[
  {key:'rocket',max:70,emoji:'🚀',label:'ロケット級',id:'rr-rocket'},
  {key:'plane',max:79,emoji:'✈️',label:'飛行機級',id:'rr-plane'},
  {key:'shinkansen',max:99,emoji:'🚄',label:'新幹線級',id:'rr-shinkansen'},
  {key:'car',max:149,emoji:'🚗',label:'自動車級',id:'rr-car'},
  {key:'bicycle',max:189,emoji:'🚲',label:'自転車級',id:'rr-bicycle'},
  {key:'walk',max:Infinity,emoji:'🚶',label:'徒歩級',id:'rr-walk'},
];

const S={mode:'keyboard',add:true,sub:true,mul:true,qs:[],idx:0,miss:0,pen:0,t0:0,pure:0,judging:false,msShowing:false,autoTimer:null,hwTimer:null,session:null,modelReady:false,useTemplate:false};
const $=id=>document.getElementById(id);

/* ===== 画面切替 ===== */
function showScr(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active')}
function selMode(m){S.mode=m;$('btn-kb').classList.toggle('active',m==='keyboard');$('btn-hw').classList.toggle('active',m==='handwriting')}

/* ===== ゲーム開始 ===== */
async function startGame(){
  S.add=$('chk-add').checked;S.sub=$('chk-sub').checked;S.mul=$('chk-mul').checked;
  if(!S.add&&!S.sub&&!S.mul){alert('種類を1つ以上選択');return}
  if(S.mode==='handwriting'&&!S.modelReady){
    showScr('screen-loading');
    try{await loadModel()}catch(e){alert('モデル読み込み失敗: '+e.message);showScr('screen-title');return}
  }
  S.qs=genQs(TOTAL);S.idx=0;S.miss=0;S.pen=0;S.judging=false;S.msShowing=false;
  $('feedback').textContent='';$('feedback').className='fb';$('ans-input').value='';
  updProg();applyMode();showScr('screen-game');renderSlots();S.t0=performance.now();
}

/* ===== 問題生成 ===== */
function genQs(n){const ops=[];if(S.add)ops.push('+');if(S.sub)ops.push('-');if(S.mul)ops.push('×');return Array.from({length:n},()=>makeQ(ops[Math.floor(Math.random()*ops.length)]))}
function makeQ(op){let a,b,ans;if(op==='+'){a=rand(0,19);b=rand(0,19);ans=a+b}else if(op==='-'){a=rand(0,19);b=rand(0,a);ans=a-b}else{a=rand(1,9);b=rand(1,9);ans=a*b}return{a,op,b,ans,userAns:null,correct:null}}
function rand(lo,hi){return Math.floor(Math.random()*(hi-lo+1))+lo}

function applyMode(){
  const kb=S.mode==='keyboard';
  $('kb-area').classList.toggle('hidden',!kb);
  $('hw-area').classList.toggle('hidden',kb);
  if(kb)setTimeout(()=>$('ans-input').focus(),80);else initCanvas();
}

/* ===== 3スロット表示 ===== */
function renderSlots(){
  const prev=S.idx>0?S.qs[S.idx-1]:null;
  const cur=S.qs[S.idx]||null;
  const next=S.idx+1<TOTAL?S.qs[S.idx+1]:null;

  // 上スロット: 前の問題（解答済み）
  $('slot-prev').innerHTML=prev?formatAnswered(prev):'';

  // 中央スロット: 現在の問題
  $('slot-cur').innerHTML=cur?`<span class="slot-expr">${cur.a}${cur.op}${cur.b}＝</span>`:'';

  // 下スロット: 次の問題（予告）
  $('slot-next').innerHTML=next?`<span class="slot-expr">${next.a}${next.op}${next.b}＝</span>`:'';

  // 入力リセット
  $('ans-input').value='';$('feedback').textContent='';$('feedback').className='fb';
  cancelTimers();
  if(S.mode==='keyboard')setTimeout(()=>$('ans-input').focus(),50);
  else{clearCanvas();$('hw-num').textContent='?'}
}

/** 解答済み問題のHTML（7-5=2 ⭕ 形式） */
function formatAnswered(q){
  if(q.correct===null)return`<span class="slot-expr">${q.a}${q.op}${q.b}＝</span>`;
  const mark=q.correct
    ?`<span class="slot-mark ok">⭕</span>`
    :`<span class="slot-mark ng">❌</span>`;
  return`<span class="slot-expr">${q.a}${q.op}${q.b}＝${q.userAns}</span>${mark}`;
}

function updProg(){$('prog-fill').style.width=(S.idx/TOTAL*100)+'%';$('prog-text').textContent=`${S.idx} / ${TOTAL}`}

/* ===== 判定 ===== */
function judge(val){
  if(S.judging||S.msShowing||isNaN(val))return;
  S.judging=true;cancelTimers();
  const q=S.qs[S.idx];
  q.userAns=val;
  if(val===q.ans){
    q.correct=true;
    showFB('⭕ 正解！','ok-fb');
  }else{
    q.correct=false;
    S.miss++;S.pen+=PENALTY;
    showFB(`❌ 不正解 (答え:${q.ans}) +5秒`,'ng-fb');
  }
  // 現在スロットを解答済みに更新
  $('slot-cur').innerHTML=formatAnswered(q);
  // 少し待ってから次へ
  setTimeout(()=>{$('feedback').textContent='';$('feedback').className='fb';advance()},q.correct?400:900);
}

function showFB(m,c){$('feedback').textContent=m;$('feedback').className=`fb ${c}`}

function advance(){
  S.idx++;updProg();
  if(S.idx>=TOTAL){S.pure=(performance.now()-S.t0)/1000;setTimeout(showResult,400);S.judging=false;return}
  // 10問突破チェック
  if(S.idx%10===0){
    showMS(S.idx,()=>{S.judging=false;renderSlots()});
  }else{
    S.judging=false;renderSlots();
  }
}

/* ===== マイルストーン（インライン表示） ===== */
function showMS(n,cb){
  S.msShowing=true;
  const badge=$('ms-badge');
  badge.textContent=`${n}問突破`;
  badge.className='ms-badge show-between';
  setTimeout(()=>{badge.className='ms-badge hidden';S.msShowing=false;cb()},MS_SHOW);
}

/* ===== キーボード入力 ===== */
function npIn(d){const inp=$('ans-input');if(inp.value.length>=3)return;inp.value+=d;onKBInput()}
function npDel(){$('ans-input').value=$('ans-input').value.slice(0,-1);cancelTimers()}
function onKBInput(){
  cancelTimers();const v=$('ans-input').value.trim();if(!v)return;
  const num=parseInt(v,10);if(isNaN(num))return;
  const q=S.qs[S.idx];
  if(num===q.ans){judge(num);return}
  if(v.length>=String(q.ans).length){judge(num);return}
  S.autoTimer=setTimeout(()=>judge(parseInt($('ans-input').value,10)),2000);
}
$('ans-input').addEventListener('input',onKBInput);
document.addEventListener('keydown',e=>{
  if(!$('screen-game').classList.contains('active')||S.mode!=='keyboard')return;
  if(e.key==='Enter'){cancelTimers();const v=$('ans-input').value.trim();if(v)judge(parseInt(v,10))}
});

function cancelTimers(){if(S.autoTimer){clearTimeout(S.autoTimer);S.autoTimer=null}if(S.hwTimer){clearTimeout(S.hwTimer);S.hwTimer=null}}
function clearInput(){cancelTimers();$('ans-input').value='';if(S.mode==='handwriting'){clearCanvas();$('hw-num').textContent='?'}$('feedback').textContent='';$('feedback').className='fb';if(S.mode==='keyboard')$('ans-input').focus()}
function quitGame(){if(confirm('タイトルに戻る？')){cancelTimers();showScr('screen-title')}}

/* ===== 結果画面 ===== */
function showResult(){
  const total=S.pure+S.pen;
  $('rc-pure').textContent=fmtTime(S.pure);$('rc-miss').textContent=`${S.miss}回`;
  $('rc-pen').textContent=`+${S.pen}秒`;$('rc-total').textContent=fmtTime(total);
  const r=RANKS.find(r=>total<=r.max)||RANKS[RANKS.length-1];
  $('res-rank-icon').textContent=r.emoji;$('res-rank-name').textContent=r.label;
  RANKS.forEach(rr=>{const el=$(rr.id);if(el)el.classList.toggle('hit',rr.key===r.key)});
  showScr('screen-result');
}
function fmtTime(s){return`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`}
function goTitle(){showScr('screen-title')}

/* =================================================================
   手書き入力
   ================================================================= */
let hwCtx=null,hwDrawing=false,hwLX=0,hwLY=0,hwHasStroke=false;

function initCanvas(){
  const c=$('hw-canvas');hwCtx=c.getContext('2d',{willReadFrequently:true});
  c.width=280;c.height=280;clearCanvas();
  if(!c._ev){
    c.addEventListener('pointerdown',e=>{e.preventDefault();hwS(e)});
    c.addEventListener('pointermove',e=>{e.preventDefault();hwM(e)});
    c.addEventListener('pointerup',e=>{e.preventDefault();hwE()});
    c.addEventListener('pointerleave',e=>{e.preventDefault();if(hwDrawing)hwE()});
    c.style.touchAction='none';c._ev=true;
  }
}
function getCP(e){const r=$('hw-canvas').getBoundingClientRect();return{x:(e.clientX-r.left)*(280/r.width),y:(e.clientY-r.top)*(280/r.height)}}
function hwS(e){hwDrawing=true;hwHasStroke=true;const p=getCP(e);hwLX=p.x;hwLY=p.y;hwCtx.beginPath();hwCtx.arc(p.x,p.y,7,0,Math.PI*2);hwCtx.fillStyle='#000';hwCtx.fill();cancelTimers()}
function hwM(e){if(!hwDrawing)return;const p=getCP(e);hwCtx.beginPath();hwCtx.moveTo(hwLX,hwLY);hwCtx.lineTo(p.x,p.y);hwCtx.strokeStyle='#000';hwCtx.lineWidth=16;hwCtx.lineCap='round';hwCtx.lineJoin='round';hwCtx.stroke();hwLX=p.x;hwLY=p.y}
function hwE(){
  hwDrawing=false;
  if(!hwHasStroke||S.judging)return;
  cancelTimers();doRecognize();
}
function clearCanvas(){if(!hwCtx)hwCtx=$('hw-canvas').getContext('2d',{willReadFrequently:true});hwCtx.fillStyle='#fff';hwCtx.fillRect(0,0,280,280);hwHasStroke=false;cancelTimers()}

async function doRecognize(){
  if(!S.modelReady||S.judging)return;
  const result=await recognizeDigits();
  if(result===null){$('hw-num').textContent='?';return}
  $('hw-num').textContent=result;
  const q=S.qs[S.idx];
  if(result===q.ans){judge(result)}
  else{S.hwTimer=setTimeout(()=>{recognizeDigits().then(r2=>{const f=(r2!==null)?r2:result;$('hw-num').textContent=f;judge(f)})},2000)}
}

async function recognizeDigits(){
  const imgData=hwCtx.getImageData(0,0,280,280);
  const ink=findInk(imgData,280,280);
  if(ink.count<30)return null;
  const segs=splitDigits(ink,280);
  let result=0;
  for(const seg of segs){const d=await predictOne(seg);if(d===null)return null;result=result*10+d}
  return result;
}

function findInk(imgData,w,h){
  const d=imgData.data;let minX=w,maxX=0,minY=h,maxY=0,count=0;const cols=new Array(w).fill(0);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(d[i]<160){count++;cols[x]++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}}
  return{minX,maxX,minY,maxY,count,cols};
}

function splitDigits(ink,w){
  const{minX,maxX,minY,maxY,cols}=ink;const bw=maxX-minX;
  if(bw<60)return[{minX,maxX,minY,maxY}];
  const s=Math.floor(bw*0.2)+minX,e=Math.floor(bw*0.8)+minX;
  let bp=-1,bl=0,gs=-1;
  for(let c=s;c<=e;c++){if(cols[c]===0){if(gs===-1)gs=c;const l=c-gs+1;if(l>bl){bl=l;bp=gs+Math.floor(l/2)}}else gs=-1}
  if(bl>=10)return[{minX,maxX:bp-1,minY,maxY},{minX:bp,maxX,minY,maxY}];
  return[{minX,maxX,minY,maxY}];
}

async function predictOne(bbox){
  const{minX,maxX,minY,maxY}=bbox;
  const bw=maxX-minX+1,bh=maxY-minY+1;
  if(bw<5||bh<5)return null;
  const size=Math.max(bw,bh),pad=Math.max(Math.round(size*0.35),12),total=size+pad*2;
  const sq=document.createElement('canvas');sq.width=total;sq.height=total;
  const sqC=sq.getContext('2d');sqC.fillStyle='#fff';sqC.fillRect(0,0,total,total);
  sqC.drawImage($('hw-canvas'),minX,minY,bw,bh,pad+Math.floor((size-bw)/2),pad+Math.floor((size-bh)/2),bw,bh);
  const sm=document.createElement('canvas');sm.width=28;sm.height=28;
  const smC=sm.getContext('2d');smC.fillStyle='#fff';smC.fillRect(0,0,28,28);
  smC.imageSmoothingEnabled=true;smC.imageSmoothingQuality='high';smC.drawImage(sq,0,0,28,28);
  const sd=smC.getImageData(0,0,28,28).data;
  const input=new Float32Array(784);
  for(let i=0;i<784;i++){const g=(sd[i*4]+sd[i*4+1]+sd[i*4+2])/3;input[i]=(255-g)/255}
  let cx=0,cy=0,cw=0;
  for(let y=0;y<28;y++)for(let x=0;x<28;x++){const v=input[y*28+x];cx+=x*v;cy+=y*v;cw+=v}
  if(cw>0){const dx=Math.round(14-cx/cw),dy=Math.round(14-cy/cw);const sh=new Float32Array(784);for(let y=0;y<28;y++)for(let x=0;x<28;x++){const nx=x-dx,ny=y-dy;if(nx>=0&&nx<28&&ny>=0&&ny<28)sh[y*28+x]=input[ny*28+nx]}input.set(sh)}

  if(S.useTemplate)return templatePredict(input);
  try{
    let tensor;const inputName=S.session.inputNames[0];
    try{tensor=new ort.Tensor('float32',input,[1,1,28,28])}catch(e){tensor=new ort.Tensor('float32',input,[1,784])}
    const feeds={};feeds[inputName]=tensor;
    const results=await S.session.run(feeds);
    const output=results[S.session.outputNames[0]].data;
    let maxV=-Infinity,maxI=0;for(let i=0;i<output.length&&i<10;i++)if(output[i]>maxV){maxV=output[i];maxI=i}
    return maxI;
  }catch(e){console.error('推論エラー:',e);return templatePredict(input)}
}

/* ===== モデル読み込み ===== */
async function loadModel(){
  $('loading-text').textContent='MNISTモデルを読み込み中…';
  const urls=['https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/mnist/model/mnist-12.onnx'];
  for(const url of urls){
    try{const resp=await fetch(url);if(!resp.ok)continue;const buf=await resp.arrayBuffer();S.session=await ort.InferenceSession.create(buf);S.modelReady=true;$('loading-text').textContent='準備完了！';await slp(300);return}catch(e){console.warn('ONNX失敗:',url,e)}
  }
  $('loading-text').textContent='フォールバックモデルを準備中…';
  await buildTemplateModel();S.modelReady=true;S.useTemplate=true;$('loading-text').textContent='準備完了！';await slp(300);
}

/* テンプレートマッチング（フォールバック） */
let templates=null;
async function buildTemplateModel(){
  const fonts=['bold 48px Arial','bold 48px serif','bold 44px sans-serif','bold 52px monospace','bold 46px Georgia','bold 50px Verdana','italic bold 46px Arial','bold 42px Courier'];
  templates=[];
  for(let digit=0;digit<=9;digit++){
    const dt=[];
    for(const font of fonts){
      const c=document.createElement('canvas');c.width=28;c.height=28;const ctx=c.getContext('2d');
      ctx.fillStyle='#000';ctx.fillRect(0,0,28,28);ctx.fillStyle='#fff';ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(String(digit),14,16);
      const d=ctx.getImageData(0,0,28,28).data;const t=new Float32Array(784);
      for(let i=0;i<784;i++)t[i]=d[i*4]/255;dt.push(t);
    }
    templates.push(dt);
  }
}

function templatePredict(input){
  if(!templates)return 0;
  let bestD=0,bestS=-1;
  for(let d=0;d<10;d++)for(const t of templates[d]){
    let s=0,n1=0,n2=0;for(let i=0;i<784;i++){s+=input[i]*t[i];n1+=input[i]*input[i];n2+=t[i]*t[i]}
    const cos=s/(Math.sqrt(n1)*Math.sqrt(n2)+1e-8);if(cos>bestS){bestS=cos;bestD=d}
  }
  return bestD;
}

function slp(ms){return new Promise(r=>setTimeout(r,ms))}
window.addEventListener('DOMContentLoaded',()=>showScr('screen-title'));
