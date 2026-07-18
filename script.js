// ระบบบันทึกข้อมูลนำเข้าสินค้า - PHATTHA
// เชื่อมต่อกับ Google Apps Script Web App (บันทึกข้อมูลลง Google Sheet ใน Google Drive)

const FETCH_TIMEOUT_MS = 15000;
const DEDUCTION_RATE = 0.03; // หัก 3%

const form = document.getElementById("importForm");
const submitBtn = document.getElementById("submitBtn");
const formStatus = document.getElementById("formStatus");
const tableBody = document.getElementById("dataTableBody");
const refreshBtn = document.getElementById("refreshBtn");

const monthSelect = document.getElementById("monthSelect");
const summaryTotalEl = document.getElementById("summaryTotal");
const summaryNetEl = document.getElementById("summaryNet");
const summaryEmptyEl = document.getElementById("summaryEmpty");

// Modal elements
const submitModal = document.getElementById("submitModal");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const stepEls = {
  config: document.getElementById("stepConfig"),
  send: document.getElementById("stepSend"),
  receive: document.getElementById("stepReceive"),
  save: document.getElementById("stepSave"),
};

let allRows = [];

/* ---------------- Shop dropdown ---------------- */

const shopSelect = document.getElementById("shopName");

function populateShopSelect() {
  if (!shopSelect || typeof SHOP_LIST === "undefined") return;
  SHOP_LIST.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    shopSelect.appendChild(opt);
  });
}

populateShopSelect();

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(n, decimals) {
  if (isNaN(n)) return "0";
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: decimals || 0,
    maximumFractionDigits: decimals || 0,
  });
}

/* ---------------- Modal / step status ---------------- */

function resetModalSteps() {
  Object.values(stepEls).forEach((el) => {
    el.className = "step pending";
    el.querySelector(".step-icon").textContent = "⏳";
  });
  modalMessage.textContent = "";
  modalMessage.className = "modal-message";
}

function openModal() {
  resetModalSteps();
  submitModal.classList.remove("hidden");
}

function closeModal() {
  submitModal.classList.add("hidden");
}

function setStep(key, state) {
  const el = stepEls[key];
  if (!el) return;
  el.className = "step " + state;
  const icon = el.querySelector(".step-icon");
  if (state === "active") icon.textContent = "⏳";
  else if (state === "done") icon.textContent = "✅";
  else if (state === "failed") icon.textContent = "❌";
  else icon.textContent = "⏳";
}

function failAt(key, message) {
  setStep(key, "failed");
  modalMessage.textContent = message;
  modalMessage.className = "modal-message error";
}

modalCloseBtn.addEventListener("click", closeModal);
submitModal.addEventListener("click", (e) => {
  if (e.target === submitModal) closeModal();
});

/* ---------------- Data loading ---------------- */

function renderRows(rows) {
  if (!rows || rows.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="empty-row">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  const sorted = rows.slice().reverse(); // ล่าสุดขึ้นก่อน
  tableBody.innerHTML = sorted
    .map((row) => {
      const timestamp = row.timestamp || row.Timestamp || "";
      const importId = row.importId || row["ID เลขนำเข้า"] || "";
      const shopName = row.shopName || row["ร้านค้า"] || "-";
      const quantity = row.quantity || row["จำนวน"] || "";
      const employeeName = row.employeeName || row["ชื่อพนักงานนำเข้า"] || "";
      return `<tr>
        <td>${formatDate(timestamp)}</td>
        <td>${escapeHtml(importId)}</td>
        <td>${escapeHtml(shopName)}</td>
        <td>${escapeHtml(String(quantity))}</td>
        <td>${escapeHtml(employeeName)}</td>
      </tr>`;
    })
    .join("");
}

/* ---------------- Monthly summary ---------------- */

function monthKeyOf(row) {
  const raw = row.timestamp || row.Timestamp || "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "long" });
}

function populateMonthSelect(rows) {
  const keys = new Set(rows.map(monthKeyOf).filter(Boolean));
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  keys.add(currentKey);

  const sortedKeys = Array.from(keys).sort().reverse();
  const previousValue = monthSelect.value;

  monthSelect.innerHTML = sortedKeys
    .map((k) => `<option value="${k}">${monthLabel(k)}</option>`)
    .join("");

  if (previousValue && sortedKeys.includes(previousValue)) {
    monthSelect.value = previousValue;
  } else {
    monthSelect.value = currentKey;
  }
}

function renderSummary() {
  const selectedKey = monthSelect.value;
  const monthRows = allRows.filter((r) => monthKeyOf(r) === selectedKey);

  if (monthRows.length === 0) {
    summaryTotalEl.textContent = "0";
    summaryNetEl.textContent = "0";
    summaryEmptyEl.style.display = "block";
    return;
  }

  summaryEmptyEl.style.display = "none";

  const total = monthRows.reduce((sum, r) => {
    const q = Number(r.quantity || r["จำนวน"] || 0);
    return sum + (isNaN(q) ? 0 : q);
  }, 0);

  const net = total * (1 - DEDUCTION_RATE);

  summaryTotalEl.textContent = formatNumber(Math.round(total), 0);
  summaryNetEl.textContent = formatNumber(net, 2);
}

monthSelect.addEventListener("change", renderSummary);

async function loadData() {
  if (!isConfigured()) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ใน config.js</td></tr>';
    summaryEmptyEl.textContent = "ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ใน config.js";
    summaryEmptyEl.style.display = "block";
    return;
  }
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "GET" });
    const data = await res.json();
    const rows = data.rows || data || [];
    allRows = Array.isArray(rows) ? rows : [];
    renderRows(allRows);
    populateMonthSelect(allRows);
    renderSummary();
  } catch (err) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</td></tr>';
    console.error(err);
  }
}

/* ---------------- Form submit with step-by-step verification ---------------- */

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const importId = document.getElementById("importId").value.trim();
  const shopName = shopSelect ? shopSelect.value : "";
  const quantity = document.getElementById("quantity").value;
  const employeeName = document.getElementById("employeeName").value.trim();

  if (!importId || !shopName || !quantity || !employeeName) {
    setStatus("กรุณากรอกข้อมูลให้ครบทุกช่อง (รวมถึงเลือกร้านค้า)", "error");
    return;
  }

  submitBtn.disabled = true;
  openModal();

  // ขั้นที่ 1: ตรวจสอบการตั้งค่า
  setStep("config", "active");
  if (!isConfigured()) {
    failAt("config", "ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ในไฟล์ config.js กรุณาตั้งค่าตามขั้นตอนใน README ก่อนใช้งาน");
    submitBtn.disabled = false;
    return;
  }
  setStep("config", "done");

  const payload = { importId, shopName, quantity: Number(quantity), employeeName };

  // ขั้นที่ 2: ส่งข้อมูลไปเซิร์ฟเวอร์
  setStep("send", "active");
  let res;
  try {
    res = await fetchWithTimeout(APPS_SCRIPT_URL, {
      method: "POST",
      // ใช้ text/plain เพื่อเลี่ยง CORS preflight (Apps Script ไม่รองรับ OPTIONS)
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const isAbort = err && err.name === "AbortError";
    failAt(
      "send",
      isAbort
        ? "หมดเวลาเชื่อมต่อเซิร์ฟเวอร์ (network timeout) กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
        : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ อาจเป็นเพราะเครือข่ายขัดข้องหรือ URL ใน config.js ไม่ถูกต้อง"
    );
    console.error(err);
    submitBtn.disabled = false;
    return;
  }
  setStep("send", "done");

  // ขั้นที่ 3: ตรวจสอบการตอบกลับ
  setStep("receive", "active");
  if (!res.ok) {
    failAt("receive", `เซิร์ฟเวอร์ตอบกลับด้วยสถานะผิดพลาด (HTTP ${res.status}) กรุณาตรวจสอบการ Deploy Apps Script`);
    submitBtn.disabled = false;
    return;
  }
  let result;
  try {
    result = await res.json();
  } catch (err) {
    failAt("receive", "เซิร์ฟเวอร์ตอบกลับมาแต่รูปแบบข้อมูลไม่ถูกต้อง (ไม่ใช่ JSON) กรุณาตรวจสอบโค้ด Apps Script");
    console.error(err);
    submitBtn.disabled = false;
    return;
  }
  setStep("receive", "done");

  // ขั้นที่ 4: ยืนยันว่าบันทึกลง Sheet สำเร็จจริง
  setStep("save", "active");
  if (result && (result.status === "success" || result.ok)) {
    setStep("save", "done");
    modalMessage.textContent = "บันทึกข้อมูลสำเร็จ ข้อมูลถูกเพิ่มลง Google Sheet เรียบร้อยแล้ว";
    modalMessage.className = "modal-message success";
    setStatus("บันทึกข้อมูลสำเร็จ", "success");
    form.reset();
    await loadData();
  } else {
    failAt("save", "บันทึกไม่สำเร็จ: " + (result && result.message ? result.message : "เซิร์ฟเวอร์ไม่ยืนยันการบันทึก"));
    setStatus("บันทึกข้อมูลไม่สำเร็จ", "error");
  }

  submitBtn.disabled = false;
});

refreshBtn.addEventListener("click", loadData);

loadData();
