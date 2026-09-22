const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "center.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image TEXT DEFAULT '',
  published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS research (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  file TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const admin = db.prepare("SELECT id FROM admins LIMIT 1").get();
if (!admin) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "Admin@2026";
  db.prepare("INSERT INTO admins (username,password_hash) VALUES (?,?)")
    .run(username, bcrypt.hashSync(password, 12));
}

const seedCount = db.prepare("SELECT COUNT(*) AS n FROM programs").get().n;
if (seedCount === 0) {
  const ins = db.prepare("INSERT INTO programs (title,description) VALUES (?,?)");
  [
    ["السلام وحل النزاعات", "دراسات وبحوث حول الوقاية من النزاعات وبناء السلام المجتمعي."],
    ["التنمية المستدامة", "بحوث تساعد على فهم التحديات التنموية واقتراح حلول عملية."],
    ["الحوكمة والمجتمع", "تعزيز الحوار والمشاركة والحوكمة الرشيدة وخدمة المجتمع."]
  ].forEach(x => ins.run(...x));
}
const newsCount = db.prepare("SELECT COUNT(*) AS n FROM news").get().n;
if (newsCount === 0) {
  const ins = db.prepare("INSERT INTO news (title,body) VALUES (?,?)");
  [
    ["انطلاق ورشة عمل حول السلام المجتمعي والتنمية المستدامة", "فعاليات وبرامج المركز."],
    ["المركز يوقع اتفاقية تعاون مع منظمة التنمية الدولية", "شراكات وتعاون."],
    ["إصدار تقرير جديد حول قضايا السلام في غرب كردفان", "إصدارات المركز."]
  ].forEach(x => ins.run(...x));
}

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:"lax", secure:false, maxAge: 1000*60*60*8 }
}));

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {fileSize: 10 * 1024 * 1024}
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

function auth(req,res,next){
  if (!req.session.adminId) return res.status(401).json({error:"غير مصرح"});
  next();
}

app.get("/api/site", (req,res)=>{
  res.json({
    news: db.prepare("SELECT * FROM news WHERE published=1 ORDER BY id DESC LIMIT 6").all(),
    research: db.prepare("SELECT * FROM research ORDER BY id DESC LIMIT 8").all(),
    programs: db.prepare("SELECT * FROM programs ORDER BY id DESC").all()
  });
});

app.post("/api/contact", (req,res)=>{
  const {name,email,message}=req.body;
  if(!name||!email||!message) return res.status(400).json({error:"يرجى إكمال البيانات"});
  db.prepare("INSERT INTO messages(name,email,message) VALUES(?,?,?)").run(name,email,message);
  res.json({ok:true});
});

app.post("/api/login",(req,res)=>{
  const {username,password}=req.body;
  const row=db.prepare("SELECT * FROM admins WHERE username=?").get(username||"");
  if(!row || !bcrypt.compareSync(password||"", row.password_hash))
    return res.status(401).json({error:"اسم المستخدم أو كلمة المرور غير صحيحة"});
  req.session.adminId=row.id;
  res.json({ok:true});
});
app.post("/api/logout",auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({loggedIn:!!req.session.adminId}));

app.get("/api/admin/dashboard",auth,(req,res)=>{
  res.json({
    news: db.prepare("SELECT * FROM news ORDER BY id DESC").all(),
    research: db.prepare("SELECT * FROM research ORDER BY id DESC").all(),
    programs: db.prepare("SELECT * FROM programs ORDER BY id DESC").all(),
    messages: db.prepare("SELECT * FROM messages ORDER BY id DESC").all()
  });
});

app.post("/api/admin/news",auth,upload.single("image"),(req,res)=>{
  const {title,body,published}=req.body;
  if(!title||!body) return res.status(400).json({error:"العنوان والمحتوى مطلوبان"});
  const image=req.file?"/uploads/"+req.file.filename:"";
  db.prepare("INSERT INTO news(title,body,image,published) VALUES(?,?,?,?)")
    .run(title,body,image,published==="0"?0:1);
  res.json({ok:true});
});
app.delete("/api/admin/news/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM news WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/admin/research",auth,upload.single("file"),(req,res)=>{
  const {title,description}=req.body;
  if(!title||!description) return res.status(400).json({error:"العنوان والوصف مطلوبان"});
  const file=req.file?"/uploads/"+req.file.filename:"";
  db.prepare("INSERT INTO research(title,description,file) VALUES(?,?,?)")
    .run(title,description,file);
  res.json({ok:true});
});
app.delete("/api/admin/research/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM research WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/admin/programs",auth,(req,res)=>{
  const {title,description}=req.body;
  if(!title||!description) return res.status(400).json({error:"العنوان والوصف مطلوبان"});
  db.prepare("INSERT INTO programs(title,description) VALUES(?,?)").run(title,description);
  res.json({ok:true});
});
app.delete("/api/admin/programs/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM programs WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.delete("/api/admin/messages/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM messages WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/admin/change-password",auth,(req,res)=>{
  const {currentPassword,newPassword}=req.body;
  const row=db.prepare("SELECT * FROM admins WHERE id=?").get(req.session.adminId);
  if(!bcrypt.compareSync(currentPassword||"",row.password_hash))
    return res.status(400).json({error:"كلمة المرور الحالية غير صحيحة"});
  if(!newPassword || newPassword.length < 8)
    return res.status(400).json({error:"كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"});
  db.prepare("UPDATE admins SET password_hash=? WHERE id=?")
    .run(bcrypt.hashSync(newPassword,12),req.session.adminId);
  res.json({ok:true});
});

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));

app.listen(PORT,()=>console.log(`Peace Center running on port ${PORT}`));
