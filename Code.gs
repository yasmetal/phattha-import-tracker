/**
 * PHATTHA - ระบบบันทึกข้อมูลนำเข้าสินค้า
 * Google Apps Script backend
 *
 * วิธีใช้:
 * 1. เปิด Google Sheet ที่ต้องการใช้เก็บข้อมูล (แถวแรกควรมีหัวตาราง
 *    Timestamp, ID เลขนำเข้า, จำนวน, ชื่อพนักงานนำเข้า)
 * 2. เมนู Extensions > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ทั้งหมดแทน
 * 4. กด Deploy > New deployment > เลือกประเภท "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. คัดลอก URL ที่ได้ (ลงท้ายด้วย /exec) ไปใส่ใน config.js -> APPS_SCRIPT_URL
 */

const SHEET_NAME = "Data"; // ชื่อชีตที่จะใช้เก็บข้อมูล (แก้ได้ถ้าต้องการ)
const HEADERS = ["Timestamp", "ID เลขนำเข้า", "จำนวน", "ชื่อพนักงานนำเข้า"];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // ถ้าไม่พบชีตชื่อ "Data" ให้ใช้ชีตแรกที่เปิดอยู่แทน
    sheet = ss.getSheets()[0];
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const importId = body.importId;
    const quantity = body.quantity;
    const employeeName = body.employeeName;

    if (!importId || quantity === undefined || quantity === null || !employeeName) {
      return jsonResponse_({ status: "error", message: "ข้อมูลไม่ครบ" });
    }

    const sheet = getSheet_();
    sheet.appendRow([new Date(), importId, quantity, employeeName]);

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
