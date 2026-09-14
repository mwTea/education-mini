'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// 静态资源：字体（打印页 @font-face）与预生成的偏旁部首练习 PDF
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
app.use('/assets/fonts', (req, res, next) => {
  if (!fs.existsSync(FONT_DIR)) return next();
  // 字体跨域：wx.loadFontFace 在开发者工具里按 Web 字段加载，必须带 CORS 头
  return express.static(FONT_DIR, { maxAge: '7d', setHeaders: (r) => r.set('Access-Control-Allow-Origin', '*') })(req, res, next);
});
const RADICAL_DIR = path.join(__dirname, '..', 'assets', 'radicals');
app.use('/assets/radicals', (req, res, next) => {
  if (!fs.existsSync(RADICAL_DIR)) return next();
  return express.static(RADICAL_DIR, { maxAge: '30d', setHeaders: (r) => r.set('Access-Control-Allow-Origin', '*') })(req, res, next);
});

// 便于 H5 / 本地网页调试直接跨域访问；小程序本身不校验
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Client-ID, X-User-Token');
    res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    return res.sendStatus(204);
  }
  return next();
});

// 管理后台：手机 H5 单页（数据走 /api/v1/admin/*，Token 鉴权）
app.get('/admin', (req, res) => {
  res.type('html').send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>字帖出题器 · 后台</title><style>
  body{font-family:-apple-system,sans-serif;background:#f4f6f8;margin:0;padding:16px;color:#333}
  .card{background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
  h2{font-size:16px;margin:0 0 12px} .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .num{font-size:26px;font-weight:700;color:#2f7fa8}.lbl{font-size:12px;color:#999}
  input,button{font-size:14px;padding:10px;border-radius:8px;border:1px solid #ddd;box-sizing:border-box}
  input{flex:1;width:100%} button{background:#2f7fa8;color:#fff;border:none;width:100%;margin-top:8px}
  .bar{height:8px;background:#2f7fa8;border-radius:4px;min-width:2px;display:inline-block;vertical-align:bottom;margin-right:4px}
  .row{display:flex;gap:8px;align-items:center;margin-top:8px}.tip{font-size:12px;color:#999;margin-top:6px}
  </style></head><body>
  <div class="card"><h2>登录</h2><input id="tk" placeholder="管理口令" type="password"><button onclick="save()">进入</button></div>
  <div id="bd" style="display:none">
    <div class="card"><h2>概览</h2><div class="grid" id="st"></div></div>
    <div class="card"><h2>近 7 日生成量</h2><div id="days"></div></div>
    <div class="card"><h2>类型分布</h2><div id="types"></div></div>
    <div class="card"><h2>开通会员</h2>
      <input id="oid" placeholder="openid（可在概览接口查或用户提供）">
      <div class="row"><input id="d" type="number" value="30" style="flex:1"><span style="font-size:13px;color:#999">天</span></div>
      <button onclick="vip()">开通</button><div class="tip" id="vtip"></div></div>
  </div>
  <script>
  const A='/api/v1/admin';let T=localStorage.kb_tk||'';
  if(T){document.getElementById('tk').value=T;load();}
  function save(){T=document.getElementById('tk').value;localStorage.kb_tk=T;load();}
  async function load(){try{const r=await fetch(A+'/stats?token='+T);if(!r.ok)throw new Error(await r.text());
    const d=await r.json();document.getElementById('bd').style.display='block';
    document.getElementById('st').innerHTML=[['累计用户',d.totalUsers],['今日活跃',d.activeToday],['今日生成',d.generatedToday],['会员数',d.vipUsers]]
      .map(x=>'<div><div class="num">'+x[1]+'</div><div class="lbl">'+x[0]+'</div></div>').join('');
    const days=Object.entries(d.byDay).sort().slice(-7);const mx=Math.max(...days.map(x=>x[1]),1);
    document.getElementById('days').innerHTML=days.map(x=>'<div style="margin:4px 0"><span class="bar" style="width:'+(x[1]/mx*70)+'%"></span><span style="font-size:12px;color:#666">'+x[0].slice(5)+' · '+x[1]+'</span></div>').join('')||'暂无';
    document.getElementById('types').innerHTML=Object.entries(d.byType).map(x=>'<div style="font-size:13px;margin:4px 0">'+({chinese:'语文',english:'英语',math:'数学'}[x[0]]||x[0])+'：'+x[1]+' 份</div>').join('')||'暂无';
  }catch(e){alert('加载失败：口令错误或服务异常');}}
  async function vip(){const o=document.getElementById('oid').value.trim(),d=+document.getElementById('d').value;
    if(!o||!d)return;const r=await fetch(A+'/vip?token='+T,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({openid:o,days:d})});
    const j=await r.json();document.getElementById('vtip').textContent=j.ok?('已开通至 '+j.vipUntil.slice(0,10)):j.error;}
  </script></body></html>`);
});

app.get('/', (req, res) => {
  res.json({ name: 'copybook-backend', health: '/api/health', docs: '见仓库根目录 README.md' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
