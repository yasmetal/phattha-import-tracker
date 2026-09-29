// ระบบบันทึกข้อมูลนำเข้าสินค้า - PHATTHA
// เชื่อมต่อกับ Google Apps Script Web App (บันทึกข้อมูลลง Google Sheet ใน Google Drive)

const FETCH_TIMEOUT_MS = 15000;
const DEDUCTION_RATE = 0.03; // หัก 3%
const ALL_SHOPS = "__ALL__";
const UNKNOWN_SHOP = "(ไม่ระบุร้าน)"; // ป้ายกำกับข้อมูลเก่าที่ไม่มีชื่อร้าน (ไม่ใช่ร้านค้าจริง)

const form = document.getElementById("importForm");
const submitBtn = document.getElementById("submitBtn");
const formStatus = document.getElementById("formStatus");
const tableBody = document.getElementById("dataTableBody");
const refreshBtn = document.getElementById("refreshBtn");
const recordSearch = document.getElementById("recordSearch");

const monthSelect = document.getElementById("monthSelect");
const summaryTotalEl = document.getElementById("summaryTotal");
const summaryNetEl = document.getElementById("summaryNet");
const summaryCountEl = document.getElementById("summaryCount");
const summaryShopsEl = document.getElementById("summaryShops");
const summaryEmptyEl = document.getElementById("summaryEmpty");

// Dashboard elements
const dashShopSelect = document.getElementById("dashShopSelect");
const dashMonthSelect = document.getElementById("dashMonthSelect");
const dashTotalEl = document.getElementById("dashTotal");
const dashNetEl = document.getElementById("dashNet");
const dashCountEl = document.getElementById("dashCount");
const dashAllTimeEl = document.getElementById("dashAllTime");
const rankCard = document.getElementById("rankCard");
const shopRankingEl = document.getElementById("shopRanking");
const rankEmptyEl = document.getElementById("rankEmpty");
const trendCard = document.getElementById("trendCard");
const trendChartEl = document.getElementById("trendChart");
const shopRecentCard = document.getElementById("shopRecentCard");
const shopRecentBody = document.getElementById("shopRecentBody");

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

/* ---------------- Helpers ---------------- */

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

function rowField(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return "";
}

function rowTimestamp(row) { return rowField(row, "timestamp", "Timestamp"); }
function rowImportId(row) { return rowField(row, "importId", "ID เลขนำเข้า"); }
function rowQuantity(row) {
  const q = Number(rowField(row, "quantity", "จำนวน") || 0);
  return isNaN(q) ? 0 : q;
}
function rowEmployee(row) { return rowField(row, "employeeName", "ชื่อพนักงานนำเข้า"); }
function rowShop(row) { return rowField(row, "shopName", "ร้านค้า") || UNKNOWN_SHOP; }

function monthKeyOf(row) {
  const d = new Date(rowTimestamp(row));
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { year: "numeric", month: "long" });
}

function monthLabelShort(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { year: "2-digit", month: "short" });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/* ---------------- Tabs ---------------- */

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ---------------- Shop dropdown + custom input ---------------- */

const CUSTOM_SHOP = "__CUSTOM__";
const shopSelect = document.getElementById("shopSelect");
const shopNameCustom = document.getElementById("shopNameCustom");

function populateShopSelect() {
  if (!shopSelect || typeof SHOP_LIST === "undefined") return;
  const options = SHOP_LIST.slice()
    .sort((a, b) => a.localeCompare(b, "th"))
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join("");
  shopSelect.innerHTML =
    '<option value="" selected disabled>— เลือกร้านค้า —</option>' +
    options +
    `<option value="${CUSTOM_SHOP}">✏️ พิมพ์ชื่อร้านเอง (ร้านใหม่)</option>`;

  // datalist ช่วย autocomplete ตอนพิมพ์เอง
  const dl = document.getElementById("shopsDatalist");
  if (dl) {
    dl.innerHTML = SHOP_LIST.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("");
  }
}

function syncCustomShopVisibility() {
  const isCustom = shopSelect.value === CUSTOM_SHOP;
  shopNameCustom.style.display = isCustom ? "" : "none";
  shopNameCustom.required = isCustom;
  if (isCustom) shopNameCustom.focus();
  else shopNameCustom.value = "";
}

shopSelect.addEventListener("change", syncCustomShopVisibility);

function getSelectedShopName() {
  if (shopSelect.value === CUSTOM_SHOP) return shopNameCustom.value.trim();
  return (shopSelect.value || "").trim();
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

/* ---------------- Records table ---------------- */

function renderRows(rows) {
  if (!rows || rows.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="empty-row">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  const sorted = rows.slice().reverse(); // ล่าสุดขึ้นก่อน
  tableBody.innerHTML = sorted
    .map(
      (row) => `<tr>
        <td>${formatDate(rowTimestamp(row))}</td>
        <td>${escapeHtml(rowImportId(row))}</td>
        <td>${escapeHtml(rowShop(row))}</td>
        <td>${formatNumber(rowQuantity(row))}</td>
        <td>${escapeHtml(rowEmployee(row))}</td>
      </tr>`
    )
    .join("");
}

function applyRecordSearch() {
  const q = (recordSearch.value || "").trim().toLowerCase();
  if (!q) {
    renderRows(allRows);
    return;
  }
  const filtered = allRows.filter((r) => {
    return (
      String(rowImportId(r)).toLowerCase().includes(q) ||
      String(rowShop(r)).toLowerCase().includes(q) ||
      String(rowEmployee(r)).toLowerCase().includes(q)
    );
  });
  renderRows(filtered);
}

recordSearch.addEventListener("input", applyRecordSearch);

/* ---------------- Month selects ---------------- */

function populateMonthSelects(rows) {
  const keys = new Set(rows.map(monthKeyOf).filter(Boolean));
  keys.add(currentMonthKey());
  const sortedKeys = Array.from(keys).sort().reverse();

  [monthSelect, dashMonthSelect].forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = sortedKeys.map((k) => `<option value="${k}">${monthLabel(k)}</option>`).join("");
    sel.value = prev && sortedKeys.includes(prev) ? prev : currentMonthKey();
  });
}

function populateDashShopSelect(rows) {
  const shopsInData = new Set(rows.map(rowShop).filter((s) => s && s !== UNKNOWN_SHOP));
  const listed = typeof SHOP_LIST !== "undefined" ? SHOP_LIST : [];
  listed.forEach((s) => shopsInData.add(s));
  const shops = Array.from(shopsInData).sort((a, b) => a.localeCompare(b, "th"));

  const prev = dashShopSelect.value;
  dashShopSelect.innerHTML =
    `<option value="${ALL_SHOPS}">🏪 ทุกร้านค้า (ภาพรวม)</option>` +
    shops.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  dashShopSelect.value = prev && (prev === ALL_SHOPS || shops.includes(prev)) ? prev : ALL_SHOPS;
}

/* ---------------- Summary (tab 1) ---------------- */

function renderSummary() {
  const selectedKey = monthSelect.value;
  const monthRows = allRows.filter((r) => monthKeyOf(r) === selectedKey);

  if (monthRows.length === 0) {
    summaryTotalEl.textContent = "0";
    summaryNetEl.textContent = "0";
    summaryCountEl.textContent = "0";
    summaryShopsEl.textContent = "0";
    summaryEmptyEl.textContent = "ยังไม่มีข้อมูลในเดือนนี้";
    summaryEmptyEl.style.display = "block";
    return;
  }

  summaryEmptyEl.style.display = "none";
  const total = monthRows.reduce((sum, r) => sum + rowQuantity(r), 0);
  // นับเฉพาะร้านที่มีชื่อจริง ไม่นับรายการเก่าที่ไม่ได้ระบุร้าน (UNKNOWN_SHOP) เป็น "ร้าน"
  const shops = new Set(monthRows.map(rowShop).filter((s) => s !== UNKNOWN_SHOP));

  summaryTotalEl.textContent = formatNumber(Math.round(total));
  summaryNetEl.textContent = formatNumber(total * (1 - DEDUCTION_RATE), 2);
  summaryCountEl.textContent = formatNumber(monthRows.length);
  summaryShopsEl.textContent = formatNumber(shops.size);
}

monthSelect.addEventListener("change", renderSummary);

/* ---------------- Dashboard (tab 2) ---------------- */

function renderDashboard() {
  const monthKey = dashMonthSelect.value;
  const shop = dashShopSelect.value;
  const isAll = shop === ALL_SHOPS;

  const shopRows = isAll ? allRows : allRows.filter((r) => rowShop(r) === shop);
  const monthRows = shopRows.filter((r) => monthKeyOf(r) === monthKey);

  // KPI
  const total = monthRows.reduce((s, r) => s + rowQuantity(r), 0);
  const allTime = shopRows.reduce((s, r) => s + rowQuantity(r), 0);
  dashTotalEl.textContent = formatNumber(Math.round(total));
  dashNetEl.textContent = formatNumber(total * (1 - DEDUCTION_RATE), 2);
  dashCountEl.textContent = formatNumber(monthRows.length);
  dashAllTimeEl.textContent = formatNumber(Math.round(allTime));

  // อันดับร้านค้า — เฉพาะโหมดภาพรวม
  if (isAll) {
    rankCard.style.display = "";
    trendCard.style.display = "none";
    shopRecentCard.style.display = "none";
    renderRanking(monthKey);
  } else {
    rankCard.style.display = "none";
    trendCard.style.display = "";
    shopRecentCard.style.display = "";
    renderTrend(shopRows);
    renderShopRecent(shopRows);
  }
}

function renderRanking(monthKey) {
  // ไม่นับรายการที่ไม่ได้ระบุชื่อร้าน (ข้อมูลเก่าก่อนมีการเก็บชื่อร้าน) เข้าอันดับ
  // เพราะไม่ใช่ร้านค้าจริง และจะบังตัวเลขของร้านค้าจริงจนดูภาพรวมไม่ได้
  const monthRows = allRows.filter((r) => monthKeyOf(r) === monthKey && rowShop(r) !== UNKNOWN_SHOP);
  const byShop = new Map();
  monthRows.forEach((r) => {
    const s = rowShop(r);
    byShop.set(s, (byShop.get(s) || 0) + rowQuantity(r));
  });

  const ranked = Array.from(byShop.entries()).sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    shopRankingEl.innerHTML = "";
    rankEmptyEl.textContent = "ยังไม่มีข้อมูลในเดือนนี้";
    rankEmptyEl.style.display = "block";
    return;
  }
  rankEmptyEl.style.display = "none";

  const max = ranked[0][1] || 1;
  shopRankingEl.innerHTML = ranked
    .map(
      ([s, qty], i) => `<div class="rank-row">
        <span class="rank-no">${i + 1}</span>
        <div class="rank-main">
          <div class="rank-shop" data-shop="${escapeHtml(s)}" title="ดูแดชบอร์ดร้านนี้">${escapeHtml(s)}</div>
          <div class="rank-bar-track"><div class="rank-bar" style="width:${Math.max(4, (qty / max) * 100)}%"></div></div>
        </div>
        <span class="rank-value">${formatNumber(Math.round(qty))}</span>
      </div>`
    )
    .join("");

  // คลิกชื่อร้านเพื่อเจาะดูร้านนั้น
  shopRankingEl.querySelectorAll(".rank-shop").forEach((el) => {
    el.addEventListener("click", () => {
      dashShopSelect.value = el.dataset.shop;
      renderDashboard();
    });
  });
}

function renderTrend(shopRows) {
  // 6 เดือนล่าสุด (นับจากเดือนปัจจุบันย้อนหลัง)
  const now = new Date();
  const keys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const totals = keys.map((k) =>
    shopRows.filter((r) => monthKeyOf(r) === k).reduce((s, r) => s + rowQuantity(r), 0)
  );
  const max = Math.max(...totals, 1);

  trendChartEl.innerHTML = keys
    .map(
      (k, i) => `<div class="trend-col">
        <span class="trend-value">${totals[i] > 0 ? formatNumber(Math.round(totals[i])) : ""}</span>
        <div class="trend-bar" style="height:${Math.max(3, (totals[i] / max) * 100)}%"></div>
        <span class="trend-label">${monthLabelShort(k)}</span>
      </div>`
    )
    .join("");
}

function renderShopRecent(shopRows) {
  const recent = shopRows.slice().reverse().slice(0, 10);
  if (recent.length === 0) {
    shopRecentBody.innerHTML = '<tr><td colspan="4" class="empty-row">ยังไม่มีข้อมูลของร้านนี้</td></tr>';
    return;
  }
  shopRecentBody.innerHTML = recent
    .map(
      (r) => `<tr>
        <td>${formatDate(rowTimestamp(r))}</td>
        <td>${escapeHtml(rowImportId(r))}</td>
        <td>${formatNumber(rowQuantity(r))}</td>
        <td>${escapeHtml(rowEmployee(r))}</td>
      </tr>`
    )
    .join("");
}

dashShopSelect.addEventListener("change", renderDashboard);
dashMonthSelect.addEventListener("change", renderDashboard);

/* ---------------- Data loading ---------------- */

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
    applyRecordSearch();
    populateMonthSelects(allRows);
    populateDashShopSelect(allRows);
    renderSummary();
    renderDashboard();
  } catch (err) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="empty-row">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชอีกครั้ง</td></tr>';
    summaryEmptyEl.textContent = "โหลดข้อมูลไม่สำเร็จ ลองกดปุ่ม “รีเฟรช” ด้านบนอีกครั้ง";
    summaryEmptyEl.style.display = "block";
    rankEmptyEl.textContent = "โหลดข้อมูลไม่สำเร็จ ลองกดปุ่ม “รีเฟรช” ด้านบนอีกครั้ง";
    rankEmptyEl.style.display = "block";
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
  const shopName = getSelectedShopName();
  const quantityRaw = document.getElementById("quantity").value.trim();
  const quantity = Number(quantityRaw);
  const quantityValid = quantityRaw !== "" && Number.isFinite(quantity) && quantity >= 0;
  const employeeName = document.getElementById("employeeName").value.trim();

  if (!importId || !shopName || !quantityValid || !employeeName) {
    let message = "กรุณากรอกข้อมูลให้ครบทุกช่อง";
    if (shopSelect.value === CUSTOM_SHOP && !shopName) {
      message = "กรุณาพิมพ์ชื่อร้านค้าในช่องที่แสดงขึ้นมา";
    } else if (quantityRaw !== "" && !quantityValid) {
      message = "กรุณากรอกจำนวนเป็นตัวเลขที่ถูกต้อง (ต้องไม่ติดลบ)";
    }
    setStatus(message, "error");
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

  const payload = { importId, shopName, quantity, employeeName };

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
    syncCustomShopVisibility();
    await loadData();
  } else {
    failAt("save", "บันทึกไม่สำเร็จ: " + (result && result.message ? result.message : "เซิร์ฟเวอร์ไม่ยืนยันการบันทึก"));
    setStatus("บันทึกข้อมูลไม่สำเร็จ", "error");
  }

  submitBtn.disabled = false;
});

refreshBtn.addEventListener("click", loadData);

/* ---------------- Init ---------------- */

// แสดงสถานะ "กำลังโหลด" ทันทีตั้งแต่เปิดหน้า เพราะ Google Apps Script บางครั้งใช้เวลาหลายวินาที
// กว่าจะตอบกลับครั้งแรก (cold start) - ถ้าไม่มีตัวบ่งชี้นี้ ผู้ใช้จะเห็นเลข 0 / "ยังไม่มีข้อมูล"
// ค้างอยู่ระหว่างรอ แล้วเข้าใจผิดว่าข้อมูลหาย
[summaryTotalEl, summaryNetEl, summaryCountEl, summaryShopsEl, dashTotalEl, dashNetEl, dashCountEl, dashAllTimeEl].forEach(
  (el) => (el.textContent = "…")
);
summaryEmptyEl.textContent = "กำลังโหลดข้อมูล...";
summaryEmptyEl.style.display = "block";
rankEmptyEl.textContent = "กำลังโหลดข้อมูล...";
rankEmptyEl.style.display = "block";

populateShopSelect();
loadData();
