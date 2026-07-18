/**
 * PHATTHA - ระบบบันทึกข้อมูลนำเข้าสินค้า
 * Google Apps Script backend (เวอร์ชัน 2: เพิ่มคอลัมน์ "ร้านค้า")
 *
 * วิธีอัปเดต (ถ้าเคย deploy แล้ว):
 * 1. เปิด Google Sheet > Extensions > Apps Script
 * 2. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ทั้งหมดแทน แล้วบันทึก (Ctrl+S)
 * 3. กด Deploy > Manage deployments > ไอคอนดินสอ (แก้ไข)
 *    > Version: เลือก "New version" > Deploy
 *    (URL เดิมจะใช้ต่อได้ ไม่ต้องแก้ config.js)
 *
 * วิธี deploy ครั้งแรก: ดู README.md
 */

const SHEET_NAME = "Data"; // ชื่อชีตที่จะใช้เก็บข้อมูล (แก้ได้ถ้าต้องการ)
const HEADERS = ["Timestamp", "ID เลขนำเข้า", "จำนวน", "ชื่อพนักงานนำเข้า", "ร้านค้า"];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // ถ้าไม่พบชีตชื่อ "Data" ให้ใช้ชีตแรกที่เปิดอยู่แทน
    sheet = ss.getSheets()[0];
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    // เพิ่มหัวคอลัมน์ "ร้านค้า" (คอลัมน์ E) อัตโนมัติถ้ายังไม่มี
    const headerE = sheet.getRange(1, 5).getValue();
    if (!headerE) {
      sheet.getRange(1, 5).setValue("ร้านค้า");
    }
  }
  return sheet;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const importId = body.importId;
    const quantity = body.quantity;
    const employeeName = body.employeeName;
    const shopName = body.shopName || "";

    if (!importId || quantity === undefined || quantity === null || !employeeName) {
      return jsonResponse_({ status: "error", message: "ข้อมูลไม่ครบ" });
    }

    const sheet = getSheet_();
    sheet.appendRow([new Date(), importId, quantity, employeeName, shopName]);

    return jsonResponse_({ status: "success" });
  } catch (err) {
    return jsonResponse_({ status: "error", message: String(err) });
  }
}

function doGet(e) {
  try {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    // แถวแรกเป็นหัวตาราง
    const rows = values.slice(1).map(function (r) {
      return {
        timestamp: r[0] instanceof Date ? r[0].toISOString() : r[0],
        importId: r[1],
        quantity: r[2],
        employeeName: r[3],
        shopName: r[4] || "",
      };
    });
    return jsonResponse_({ status: "success", rows: rows });
  } catch (err) {
    return jsonResponse_({ status: "error", message: String(err), rows: [] });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
