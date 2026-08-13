/**
 * PHATTHA - ระบบบันทึกข้อมูลนำเข้าสินค้า
 * Google Apps Script backend (เวอร์ชัน 2: เพิ่มคอลัมน์ร้านค้า)
 *
 * วิธีอัปเดต (ถ้าเคย deploy แล้ว):
 * 1. เปิด Google Sheet > Extensions > Apps Script
 * 2. ลบโค้ดเดิม วางไฟล์นี้แทน แล้วกดบันทึก
 * 3. Deploy > Manage deployments > กดไอคอนดินสอ > Version: New version > Deploy
 *    (URL เดิมจะใช้ได้ต่อ ไม่ต้องแก้ config.js)
 *
 * หมายเหตุ: คอลัมน์ "ร้านค้า" ถูกเพิ่มไว้ท้ายตาราง (คอลัมน์ E)
 * แถวข้อมูลเก่าที่ไม่มีร้านค้าจะยังแสดงผลได้ตามปกติ
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
    // เพิ่มหัวคอลัมน์ "ร้านค้า" ถ้ายังไม่มี (สำหรับชีตเก่า)
    const firstRow = sheet.getRange(1, 1, 1, 5).getValues()[0];
    if (!firstRow[4]) {
      sheet.getRange(1, 5).setValue("ร้านค้า");
    }
  }
  return sheet;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const importId = body.importId;
    const quantity = Number(body.quantity);
    const employeeName = body.employeeName;
    const shopName = body.shopName || "";

    // บังคับให้มีชื่อร้านค้าเสมอ (กันไม่ให้เกิดแถว "ไม่ระบุร้าน" เพิ่มขึ้นอีกในอนาคต)
    if (!importId || !employeeName || !shopName) {
      return jsonResponse_({ status: "error", message: "ข้อมูลไม่ครบ (ต้องมีร้านค้าด้วย)" });
    }
    // ป้องกันข้อมูลจำนวนที่ผิดปกติ (ติดลบ / ไม่ใช่ตัวเลข) ไม่ให้เข้ามาปนในชีต
    // แม้หน้าเว็บจะตรวจสอบแล้ว แต่ endpoint นี้เปิดสาธารณะ จึงต้องตรวจซ้ำฝั่งเซิร์ฟเวอร์ด้วย
    if (body.quantity === undefined || body.quantity === null || !isFinite(quantity) || quantity < 0) {
      return jsonResponse_({ status: "error", message: "จำนวนไม่ถูกต้อง (ต้องเป็นตัวเลขไม่ติดลบ)" });
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
