const $=s=>document.querySelector(s);
document.querySelector(".menu-toggle")?.addEventListener("click",()=>document.querySelector(".nav-links").classList.toggle("open"));
async function load(){
  const r=await fetch("/api/site"); const d=await r.json();
  $("#newsList").innerHTML=d.news.map(n=>`<div class="news-row"><b>${esc(n.title)}</b><small>${new Date(n.created_at).toLocaleDateString("ar-EG")}</small></div>`).join("");
  $("#programList").innerHTML=d.programs.map(p=>`<a class="field" href="#research">${esc(p.title)} <span>←</span></a>`).join("");
  $("#researchList").innerHTML=d.research.length?d.research.map((x,i)=>`<article class="card"><div class="num">${String(i+1).padStart(2,"0")}</div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p>${x.file?`<a class="btn navy" target="_blank" href="${x.file}">فتح الملف</a>`:""}</article>`).join(""):`<article class="card"><h3>لا توجد إصدارات منشورة بعد</h3><p>يمكن لمسؤول المركز إضافة البحوث من لوحة التحكم.</p></article>`;
}
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("#contactForm")?.addEventListener("submit",async e=>{e.preventDefault();const r=await fetch("/api/contact",{method:"POST",body:new URLSearchParams(new FormData(e.target)),headers:{"Content-Type":"application/x-www-form-urlencoded"}});const d=await r.json();$("#contactMsg").textContent=d.ok?"تم إرسال رسالتك بنجاح.":"تعذر إرسال الرسالة.";if(d.ok)e.target.reset()});
load();