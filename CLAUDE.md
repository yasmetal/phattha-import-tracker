# PHATTHA Import Tracker — บันทึกสำหรับ Claude (และคนในทีม)

อัปเดตล่าสุด: 29 กันยายน 2569 (2026-09-29)

## โปรเจกต์นี้คืออะไร

เว็บฟอร์มบันทึกข้อมูลนำเข้าสินค้า (ID เลขนำเข้า, ร้านค้า, จำนวน, ชื่อพนักงาน) ของธุรกิจ PHATTHA
เป็น static site ล้วน (ไม่มี backend server ของตัวเอง) เขียนข้อมูลลง Google Sheet ผ่าน Google Apps Script
Web App แล้ว frontend อ่านข้อมูลกลับมาแสดงเป็นตาราง + แดชบอร์ดสรุปยอด/อันดับร้านค้า/แนวโน้มรายเดือน

## จุดเชื่อมต่อสำคัญ (ต้องรู้ก่อนแก้อะไร)

- **GitHub repo (ของจริง):** https://github.com/yasmetal/phattha-import-tracker — branch เริ่มต้นคือ `main`
- **เว็บที่ deploy จริง (GitHub Pages):** https://yasmetal.github.io/phattha-import-tracker/
  (build จาก branch `main` root โดยตรง ไม่มี GitHub Actions workflow)
- **Google Sheet (เก็บข้อมูลจริง):** https://docs.google.com/spreadsheets/d/1tCuhaQCkh2eHE63vIvHynb0YUNyLmbP2_awDTrxYt6s/edit
  ชื่อชีต `Data` — คอลัมน์: Timestamp, ID เลขนำเข้า, จำนวน, ชื่อพนักงานนำเข้า, ร้านค้า
- **Google Apps Script backend:** ผูกอยู่กับ Google Sheet ด้านบน (Extensions > Apps Script)
  บัญชี Google ที่เป็นเจ้าของ: retrorianyas@gmail.com
  Web App URL (ตรงกับใน `config.js`): `https://script.google.com/macros/s/AKfycbwsQ2LlIkuR8EQTa2ucmY7HkriQFdrbtooa455FQhEzXteyKPRNkKSSi2SYBPQLRYUn/exec`
  Deployment เดียวกันนี้ต้อง **redeploy เวอร์ชันใหม่ทุกครั้ง** ที่แก้ `Code.gs` (ดูขั้นตอนด้านล่าง) — แค่กด Save ในตัวแก้โค้ดไม่พอ ของเดิมจะยังรันอยู่จนกว่าจะ deploy

## โครงสร้างไฟล์

**ข้อควรระวัง:** `Code.gs` ในเครื่อง/GitHub เป็นแค่สำเนาอ้างอิง ตัวที่ "รันจริง" อยู่ในหน้า Apps Script
editor ของ Google Sheet ต้อง sync มือทุกครั้ง (ดูขั้นตอน deploy ด้านล่าง)

ไฟล์ที่ **ไม่ได้อยู่ใน GitHub repo** (เป็นไฟล์ local เท่านั้น ตั้งใจไม่ track หรือ track ไม่สำเร็จมาแต่เดิม):
`.gitignore`, `LOGO PHATTHA.ai` (ไฟล์ต้นฉบับโลโก้), `รายละเอียดแต่ละร้านค้า.xlsx` (ต้นฉบับรายชื่อร้าน)
ไฟล์เหล่านี้อยู่ในเครื่องแต่ไม่ถูก push ขึ้น GitHub — ถ้าต้องการให้ track ด้วยต้อง `git add` เพิ่มเอง

## วิธี deploy การเปลี่ยนแปลง

**แก้ frontend (index.html / style.css / script.js / config.js / shops.js):**
1. แก้ไฟล์ในเครื่อง แล้ว `git add` + `git commit` + `git push origin main`
2. GitHub Pages จะ build อัตโนมัติ ปกติภายใน ~1 นาที
3. **ข้อควรระวัง:** GitHub Pages ใช้ CDN (Fastly) cache — บางครั้งเบราว์เซอร์/CDN edge node อาจ serve ของเก่าค้างไปอีก
   ~5-10 นาทีแม้ deploy เสร็จแล้ว ตอนทดสอบให้ hard refresh (Ctrl+Shift+R) และ/หรือ fetch แบบ `cache: 'no-store'`
   เพื่อเช็คของจริงบน server ก่อนสรุปว่า fix ไม่ทำงาน

**แก้ backend (Code.gs):**
1. แก้ `Code.gs` ในเครื่อง (และ push ขึ้น GitHub ด้วยเพื่อให้เป็นสำเนาอ้างอิง — แต่ push อย่างเดียว**ไม่ทำให้ backend จริงเปลี่ยน**)
2. เปิด Google Sheet ด้านบน > Extensions > Apps Script
3. ลบโค้ดเดิมในไฟล์ Code.gs (ในหน้า Apps Script) วางโค้ดใหม่แทน กด Ctrl+S
4. **สำคัญที่สุด:** Deploy > Manage deployments > กดไอคอนดินสอ (แก้ไข) > Version: เลือก "New version" > Deploy
   ขั้นตอนนี้พลาดไม่ได้ ไม่งั้นโค้ดใหม่จะไม่มีผลกับ URL จริงที่เว็บเรียกใช้อยู่ (URL เดิมใช้ต่อได้ ไม่ต้องแก้ config.js)

## การทดสอบอย่างปลอดภัย (สำคัญ)

Google Sheet ด้านบนคือ**ข้อมูลธุรกิจจริง** ใช้คำนวณยอด/ค่าคอมมิชชั่นจริง ห้ามทดสอบส่งฟอร์มมั่ว ๆ โดยไม่ตามเก็บกวาด
วิธีทดสอบที่ใช้อยู่: ตั้ง `importId` ให้ขึ้นต้นด้วย `TEST-QA-` (เช่น `TEST-QA-DELETE-ME`) เพื่อกรองหาและลบออกได้ง่ายหลังทดสอบ
เช็คแถวทดสอบด้วย GET request ตรง ๆ ก็ได้: `fetch(APPS_SCRIPT_URL).then(r=>r.json())` แล้วกรอง `importId` ที่ขึ้นต้นด้วย `TEST-QA-`
ลบแถวทดสอบออกจาก Google Sheet ทันทีหลังทดสอบเสร็จทุกครั้ง

## ประวัติการเปลี่ยนแปลงและบทเรียน

ดูที่ [CHANGELOG.md](CHANGELOG.md)
