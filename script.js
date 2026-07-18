// ระบบบันทึกข้อมูลนำเข้าสินค้า - PHATTHA
// เชื่อมต่อกับ Google Apps Script Web App (บันทึกข้อมูลลง Google Sheet ใน Google Drive)

const form = document.getElementById("importForm");
const submitBtn = document.getElementById("submitBtn");
const formStatus = document.getElementById("formStatus");
const tableBody = document.getElementById("dataTableBody");
const refreshBtn = document.getElementById("refreshBtn");

function isConfigured() {
  return (
    typeof APPS_SCRIPT_URL === "string" &&
    APPS_SCRIPT_URL.startsWith("http") &&
    !APPS_SCRIPT_URL.includes("PASTE_YOUR")
  );
}

function setStatus(message, type) {
  formStatus.textContent = message;
  formStatus.className = "form-status" + (type ? " " + type : "");
}

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value || "-";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderRows(rows) {
  if (!rows || rows.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" class="empty-row">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  const sorted = rows.slice().reverse(); // ล่าสุดขึ้นก่อน
  tableBody.innerHTML = sorted
    .map((row) => {
      const timestamp = row.timestamp || row.Timestamp || "";
      const importId = row.importId || row["ID เลขนำเข้า"] || "";
      const quantity = row.quantity || row["จำนวน"] || "";
      const employeeName = row.employeeName || row["ชื่อพนักงานนำเข้า"] || "";
      return `<tr>
        <td>${formatDate(timestamp)}</td>
        <td>${escapeHtml(importId)}</td>
        <td>${escapeHtml(String(quantity))}</td>
        <td>${escapeHtml(employeeName)}</td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadData() {
  if (!isConfigured()) {
    tableBody.innerHTML =
      '<tr><td colspan="4" class="empty-row">ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ใน config.js</td></tr>';
    return;
  }
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "GET" });
    const data = await res.json();
    renderRows(data.rows || data);
  } catch (err) {
    tableBody.innerHTML =
      '<tr><td colspan="4" class="empty-row">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</td></tr>';
    console.error(err);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!isConfigured()) {
    setStatus("กรุณาตั้งค่า APPS_SCRIPT_URL ในไฟล์ config.js ก่อนใช้งาน", "error");
    return;
  }

  const importId = document.getElementById("importId").value.trim();
  const quantity = document.getElementById("quantity").value;
  const employeeName = document.getElementById("employeeName").value.trim();

  if (!importId || !quantity || !employeeName) {
    setStatus("กรุณากรอกข้อมูลให้ครบทุกช่อง", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("กำลังบันทึกข้อมูล...", "pending");

  const payload = {
    importId,
    quantity: Number(quantity),
    employeeName,
  };

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      // ใช้ text/plain เพื่อเลี่ยง CORS preflight (Apps Script ไม่รองรับ OPTIONS)
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (result.status === "success" || result.ok) {
      setStatus("บันทึกข้อมูลสำเร็จ", "success");
      form.reset();
      await loadData();
    } else {
      setStatus("เกิดข้อผิดพลาด: " + (result.message || "ไม่ทราบสาเหตุ"), "error");
    }
  } catch (err) {
    setStatus("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่", "error");
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});

refreshBtn.addEventListener("click", loadData);

loadData();
