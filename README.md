# PHATTHA – ระบบบันทึกข้อมูลนำเข้าสินค้า

เว็บฟอร์มสำหรับบันทึก **ID เลขนำเข้า, จำนวน, ชื่อพนักงานนำเข้า** โดยข้อมูลจะถูกบันทึกลง
Google Sheet ใน Google Drive ผ่าน Google Apps Script (ไม่มีค่าใช้จ่าย ไม่ต้องมีเซิร์ฟเวอร์)

เว็บนี้เป็น static site (HTML + JS ล้วน) โฮสต์ผ่าน GitHub Pages

## โครงสร้างไฟล์

```
index.html    หน้าเว็บหลัก (ฟอร์ม + ตารางรายการ)
style.css     ดีไซน์
script.js     ฟังก์ชันเชื่อมต่อ Apps Script
config.js     ที่เก็บลิงก์ Apps Script Web App (ต้องตั้งค่าเอง)
logo.png      โลโก้ PHATTHA
favicon.png   ไอคอนเว็บ
Code.gs       โค้ด backend สำหรับวางใน Google Apps Script
```

## ขั้นตอนการตั้งค่า (ทำครั้งเดียว)

Google Sheet ปลายทางถูกสร้างไว้ให้แล้วที่:
**https://docs.google.com/spreadsheets/d/1tCuhaQCkh2eHE63vIvHynb0YUNyLmbP2_awDTrxYt6s/edit**

### 1. เปิด Apps Script ใน Google Sheet

1. เปิดลิงก์ Google Sheet ด้านบน
2. เมนู **Extensions (ส่วนขยาย) > Apps Script**
3. ลบโค้ดตัวอย่าง (`function myFunction() {...}`) ออกให้หมด
4. เปิดไฟล์ `Code.gs` ในโปรเจกต์นี้ คัดลอกโค้ดทั้งหมด แล้ววางแทน
5. กด **บันทึก** (ไอคอนแผ่นดิสก์ หรือ Ctrl+S)

### 2. Deploy เป็น Web App

1. มุมขวาบน กด **Deploy > New deployment**
2. ที่ "Select type" กดไอคอนเฟือง เลือก **Web app**
3. ตั้งค่า:
   - **Execute as:** Me (อีเมลของคุณ)
   - **Who has access:** Anyone
4. กด **Deploy**
5. ระบบจะขอสิทธิ์ (Authorize access) — เลือกบัญชี Google ของคุณ แล้วกด **Allow**
   (อาจมีหน้าเตือน "Google hasn't verified this app" ให้กด Advanced > Go to project (unsafe) ได้ตามปกติ
   เพราะเป็นสคริปต์ของคุณเอง)
6. คัดลอก **Web app URL** ที่ได้ (ลงท้ายด้วย `/exec`)

### 3. ใส่ URL ลงในเว็บ

เปิดไฟล์ `config.js` แล้วแทนที่บรรทัด:

```js
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
```

ด้วย URL ที่คัดลอกมา เช่น:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXXXXXX/exec";
```

บันทึกไฟล์ แล้วอัปโหลด/commit ไฟล์ `config.js` ขึ้น GitHub อีกครั้ง (หรือแก้ไขไฟล์บน GitHub โดยตรง)

## การใช้งาน

เปิดเว็บผ่านลิงก์ GitHub Pages → กรอก ID เลขนำเข้า, จำนวน, ชื่อพนักงานนำเข้า → กด **บันทึกข้อมูล**
ข้อมูลจะถูกเพิ่มเป็นแถวใหม่ใน Google Sheet ทันที และตาราง "รายการล่าสุด" บนหน้าเว็บจะอัปเดตให้อัตโนมัติ

## หมายเหตุ

- ถ้ายังไม่ได้ตั้งค่า `APPS_SCRIPT_URL` เว็บจะแจ้งเตือนเมื่อกดบันทึก
- ทุกครั้งที่แก้โค้ดใน Apps Script แล้วต้องการให้ลิงก์เดิมทำงานต่อ ให้ใช้ **Deploy > Manage deployments > แก้ไข (ดินสอ) > Version: New version > Deploy** (ไม่ต้องสร้าง URL ใหม่)
- ข้อมูลทั้งหมดอยู่ใน Google Sheet ของคุณเอง สามารถเปิดดู/แก้ไข/Export ได้ตามปกติ
