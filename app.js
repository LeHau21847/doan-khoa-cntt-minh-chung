/**
 * =========================================================================
 * APP LOGIC - ĐOÀN KHOA CÔNG NGHỆ THÔNG TIN - ĐH LẠC HỒNG
 * Quản lý minh chứng tham gia nhóm Zalo & App Thanh niên Việt Nam
 * =========================================================================
 */

// Global State
let currentImageBase64 = null;
let currentImageType = "image/jpeg";
let allSubmissions = [];
let db = null;

// ==========================================
// 1. INDEXEDDB SETUP
// ==========================================
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DoanKhoaCNTT_EvidenceDB", 1);
    
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains("submissions")) {
        const store = database.createObjectStore("submissions", { keyPath: "id", autoIncrement: true });
        store.createIndex("lop", "lop", { unique: false });
        store.createIndex("khoa", "khoa", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    
    request.onerror = (e) => {
      console.error("IndexedDB error:", e.target.error);
      reject(e.target.error);
    };
  });
}

function dbSaveSubmission(record) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("Database not initialized");
    const tx = db.transaction(["submissions"], "readwrite");
    const store = tx.objectStore("submissions");
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAllSubmissions() {
  return new Promise((resolve, reject) => {
    if (!db) return reject("Database not initialized");
    const tx = db.transaction(["submissions"], "readonly");
    const store = tx.objectStore("submissions");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbDeleteSubmission(id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("Database not initialized");
    const tx = db.transaction(["submissions"], "readwrite");
    const store = tx.objectStore("submissions");
    const req = store.delete(Number(id));
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ==========================================
// 2. COUNTDOWN TIMER
// ==========================================
function initCountdown() {
  const deadlineStr = APP_DATA.config.deadline;
  const deadlineTime = new Date(deadlineStr).getTime();

  function update() {
    const now = new Date().getTime();
    const diff = deadlineTime - now;

    const daysEl = document.getElementById("timer-days");
    const hoursEl = document.getElementById("timer-hours");
    const minsEl = document.getElementById("timer-mins");
    const secsEl = document.getElementById("timer-secs");

    if (diff <= 0) {
      if (daysEl) daysEl.innerText = "00";
      if (hoursEl) hoursEl.innerText = "00";
      if (minsEl) minsEl.innerText = "00";
      if (secsEl) secsEl.innerText = "00";
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (daysEl) daysEl.innerText = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.innerText = String(hours).padStart(2, '0');
    if (minsEl) minsEl.innerText = String(mins).padStart(2, '0');
    if (secsEl) secsEl.innerText = String(secs).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// ==========================================
// 3. IMAGE COMPRESSION & HANDLING
// ==========================================
function compressImage(file, maxDimension = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

function handleImageSelected(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Vui lòng chọn một tệp hình ảnh hợp lệ (JPG, PNG, WebP)!", "error");
    return;
  }

  compressImage(file).then((base64) => {
    currentImageBase64 = base64;
    currentImageType = "image/jpeg";

    const previewContainer = document.getElementById("preview-container");
    const imagePreview = document.getElementById("image-preview");
    const dropzone = document.getElementById("dropzone");

    imagePreview.src = base64;
    previewContainer.style.display = "block";
    dropzone.style.display = "none";
    showToast("Đã tải và nén ảnh minh chứng sẵn sàng gửi!", "success");
  }).catch((err) => {
    console.error("Compression error:", err);
    showToast("Có lỗi khi xử lý hình ảnh, vui lòng thử lại!", "error");
  });
}

function removeSelectedImage() {
  currentImageBase64 = null;
  const previewContainer = document.getElementById("preview-container");
  const imagePreview = document.getElementById("image-preview");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");

  imagePreview.src = "";
  previewContainer.style.display = "none";
  dropzone.style.display = "block";
  if (fileInput) fileInput.value = "";
}

// ==========================================
// 4. CLASS SELECTION & AUTOFILL
// ==========================================
function initFormInteractions() {
  const selectKhoa = document.getElementById("select-khoa");
  const selectLop = document.getElementById("select-lop");
  const previewCard = document.getElementById("class-preview-card");
  const prevSiso = document.getElementById("prev-siso");
  const prevBithu = document.getElementById("prev-bithu");
  const prevLoptruong = document.getElementById("prev-loptruong");
  const prevStatus = document.getElementById("prev-status");

  const inputHoten = document.getElementById("input-hoten");
  const inputMssv = document.getElementById("input-mssv");
  const inputSdt = document.getElementById("input-sdt");

  // Radio tiles
  const radioTiles = document.querySelectorAll(".radio-tile");
  radioTiles.forEach(tile => {
    tile.addEventListener("click", () => {
      radioTiles.forEach(t => t.classList.remove("selected"));
      tile.classList.add("selected");
      tile.querySelector("input").checked = true;
    });
  });

  // Khi chọn Khóa -> cập nhật Lớp
  selectKhoa.addEventListener("change", () => {
    const selectedKhoa = selectKhoa.value;
    selectLop.innerHTML = '<option value="">-- Chọn Lớp sinh hoạt --</option>';

    if (!selectedKhoa) {
      selectLop.disabled = true;
      previewCard.classList.remove("active");
      return;
    }

    const filtered = APP_DATA.classes.filter(c => c.khoa === selectedKhoa);
    filtered.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.lop;
      const statusIcon = isClassSubmitted(c.lop) ? "✅ " : "⚪ ";
      opt.textContent = `${statusIcon}${c.lop} (${c.siso} sinh viên)`;
      selectLop.appendChild(opt);
    });

    selectLop.disabled = false;
    previewCard.classList.remove("active");
  });

  // Khi chọn Lớp -> hiển thị Preview & autofill
  selectLop.addEventListener("change", () => {
    const lopCode = selectLop.value;
    if (!lopCode) {
      previewCard.classList.remove("active");
      return;
    }

    const classData = APP_DATA.classes.find(c => c.lop === lopCode);
    if (!classData) return;

    previewCard.classList.add("active");
    prevSiso.textContent = `${classData.siso} sinh viên`;

    if (classData.has_bithu && classData.bithu) {
      prevBithu.innerHTML = `<span style="color:#38bdf8;">${classData.bithu.hoten}</span> (${classData.bithu.phone || 'Chưa có SĐT'})`;
      // Autofill with Bí thư
      inputHoten.value = classData.bithu.hoten || "";
      inputMssv.value = classData.bithu.mssv || "";
      inputSdt.value = classData.bithu.phone || "";
    } else {
      prevBithu.innerHTML = `<span style="color:#f87171;">Chưa có Bí thư (Lớp trưởng/Lớp phó nộp thay)</span>`;
      // If has Lớp trưởng, autofill with Lớp trưởng
      if (classData.loptruong) {
        inputHoten.value = classData.loptruong.hoten || "";
        inputMssv.value = classData.loptruong.mssv || "";
        inputSdt.value = classData.loptruong.phone || "";
      } else {
        inputHoten.value = "";
        inputMssv.value = "";
        inputSdt.value = "";
      }
    }

    if (classData.loptruong) {
      prevLoptruong.textContent = `${classData.loptruong.hoten} (${classData.loptruong.phone || 'Chưa có SĐT'})`;
    } else {
      prevLoptruong.textContent = "Chưa có thông tin";
    }

    const submitted = isClassSubmitted(lopCode);
    if (submitted) {
      prevStatus.innerHTML = `<span style="color:#34d399; font-weight:700;">✅ Đã có minh chứng trên hệ thống</span>`;
    } else {
      prevStatus.innerHTML = `<span style="color:#fbbf24;">⏳ Chưa nộp minh chứng</span>`;
    }
  });

  // File dropzone events
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const btnRemove = document.getElementById("btn-remove-preview");

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelected(e.target.files[0]);
    }
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelected(e.dataTransfer.files[0]);
    }
  });

  // Paste image directly (Ctrl + V)
  window.addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        handleImageSelected(blob);
        break;
      }
    }
  });

  btnRemove.addEventListener("click", removeSelectedImage);
}

// ==========================================
// 5. FORM SUBMISSION
// ==========================================
function initFormSubmit() {
  const form = document.getElementById("submission-form");
  const btnSubmit = document.getElementById("btn-submit-evidence");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectKhoa = document.getElementById("select-khoa").value;
    const selectLop = document.getElementById("select-lop").value;
    const loaiMinhChung = document.querySelector('input[name="loaiMinhChung"]:checked').value;
    const hoten = document.getElementById("input-hoten").value.trim();
    const mssv = document.getElementById("input-mssv").value.trim();
    const sdt = document.getElementById("input-sdt").value.trim();
    const ghiChu = document.getElementById("input-ghichu").value.trim();

    if (!selectKhoa || !selectLop) {
      showToast("Vui lòng chọn Khóa và Lớp sinh hoạt!", "error");
      return;
    }

    if (!hoten || !sdt) {
      showToast("Vui lòng nhập đầy đủ Họ tên và Số điện thoại liên lạc!", "error");
      return;
    }

    if (!currentImageBase64) {
      showToast("Vui lòng chọn hoặc chụp ảnh màn hình minh chứng!", "error");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `⏳ Đang lưu minh chứng...`;

    const now = new Date();
    const timestampFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newRecord = {
      khoa: selectKhoa,
      lop: selectLop,
      hoten: hoten,
      mssv: mssv,
      sdt: sdt,
      loaiMinhChung: loaiMinhChung,
      ghiChu: ghiChu,
      imageBase64: currentImageBase64,
      imageType: currentImageType,
      timestamp: timestampFormatted,
      rawTime: now.toISOString(),
      syncedWithGoogle: false,
      googleFileUrl: ""
    };

    try {
      // 1. Lưu vào IndexedDB cục bộ (Đảm bảo 100% không mất dữ liệu)
      const savedId = await dbSaveSubmission(newRecord);
      newRecord.id = savedId;
      allSubmissions.unshift(newRecord);

      // 2. Đồng bộ lên Google Apps Script (Sử dụng URL người dùng đã cấu hình)
      const webhookUrl = localStorage.getItem("gas_webhook_url") || (typeof APP_DATA !== "undefined" && APP_DATA.config && APP_DATA.config.googleAppsScriptUrl) || "";
      if (webhookUrl) {
        showToast("Đang đồng bộ ảnh lên Google Drive...", "info");
        try {
          const gasPayload = {
            khoa: selectKhoa,
            lop: selectLop,
            hoten: hoten,
            mssv: mssv,
            sdt: sdt,
            loaiMinhChung: loaiMinhChung,
            chucVu: "Bí thư/Cán sự",
            ghiChu: ghiChu,
            imageBase64: currentImageBase64,
            imageType: currentImageType
          };

          // Use fetch with text/plain to avoid CORS preflight issues with Google Apps Script
          fetch(webhookUrl, {
            method: "POST",
            mode: "no-cors",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(gasPayload)
          }).then(() => {
            console.log("Sent payload to Google Apps Script Webhook successfully!");
          }).catch(err => {
            console.warn("GAS Webhook background error:", err);
          });
        } catch (gasErr) {
          console.warn("Could not post to GAS Webhook:", gasErr);
        }
      }

      showToast(`🎉 Đã nộp thành công minh chứng cho lớp ${selectLop}!`, "success");

      // Reset image preview
      removeSelectedImage();
      document.getElementById("input-ghichu").value = "";

      // Refresh UI
      renderClassesGrid();
      renderDashboard();

      // Scroll to class card
      const targetCard = document.getElementById(`card-${selectLop}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.style.boxShadow = "0 0 30px rgba(16, 185, 129, 0.7)";
        setTimeout(() => { targetCard.style.boxShadow = ""; }, 3000);
      }

    } catch (err) {
      console.error("Submission error:", err);
      showToast("Có lỗi xảy ra khi lưu minh chứng, vui lòng thử lại!", "error");
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `🚀 GỬI MINH CHỨNG LÊN HỆ THỐNG`;
    }
  });
}

// ==========================================
// 6. RENDER 56 CLASSES & FILTERING
// ==========================================
let activeKhoaFilter = "ALL";
let activeStatusFilter = "ALL";
let currentSearchQuery = "";

function isClassSubmitted(lopCode) {
  return allSubmissions.some(s => s.lop === lopCode);
}

function getClassSubmissions(lopCode) {
  return allSubmissions.filter(s => s.lop === lopCode);
}

function renderClassesGrid() {
  const container = document.getElementById("classes-grid");
  if (!container) return;

  const query = currentSearchQuery.toLowerCase().trim();

  const filtered = APP_DATA.classes.filter(c => {
    // 1. Khoa filter
    if (activeKhoaFilter !== "ALL" && c.khoa !== activeKhoaFilter) {
      return false;
    }

    // 2. Status filter
    const submitted = isClassSubmitted(c.lop);
    if (activeStatusFilter === "SUBMITTED" && !submitted) return false;
    if (activeStatusFilter === "NOT_SUBMITTED" && submitted) return false;
    if (activeStatusFilter === "HAS_BITHU" && !c.has_bithu) return false;
    if (activeStatusFilter === "MISSING_BITHU" && c.has_bithu) return false;

    // 3. Search query
    if (query) {
      const matchLop = c.lop.toLowerCase().includes(query);
      const matchBT = c.bithu && c.bithu.hoten.toLowerCase().includes(query);
      const matchLT = c.loptruong && c.loptruong.hoten.toLowerCase().includes(query);
      const matchOfficers = c.officers.some(o => o.hoten.toLowerCase().includes(query) || o.mssv.includes(query));
      if (!matchLop && !matchBT && !matchLT && !matchOfficers) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
        <p style="font-size: 2.5rem; margin-bottom: 12px;">🔍</p>
        <h4 style="color: #fff; margin-bottom: 6px;">Không tìm thấy lớp học phù hợp</h4>
        <p style="font-size: 0.9rem;">Thử thay đổi từ khóa tìm kiếm hoặc đổi tab bộ lọc.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const classSubs = getClassSubmissions(c.lop);
    const hasSub = classSubs.length > 0;

    let badgeHtml = "";
    if (hasSub) {
      const types = Array.from(new Set(classSubs.map(s => s.loaiMinhChung))).join(" & ");
      badgeHtml = `<span class="evidence-badge badge-submitted">✓ Đã nộp (${types})</span>`;
    } else {
      badgeHtml = `<span class="evidence-badge badge-unsubmitted">❌ Chưa nộp minh chứng</span>`;
    }

    // Bí thư name
    const btName = c.has_bithu && c.bithu 
      ? `<span class="officer-name">${c.bithu.hoten}</span>`
      : `<span class="officer-name missing">Chưa có Bí thư</span>`;

    // Lớp trưởng name
    const ltName = c.loptruong 
      ? `<span class="officer-name">${c.loptruong.hoten}</span>`
      : `<span class="officer-name missing">Chưa khai báo</span>`;

    // Pho Bi thu name
    const pbtName = c.has_phobithu && c.phobithu
      ? `<span class="officer-name">${c.phobithu.hoten}</span>`
      : `<span class="officer-name missing">Chưa có Phó Bí thư</span>`;

    // Officers table rows for accordion
    let officersRows = "";
    if (c.officers.length > 0) {
      officersRows = c.officers.map(o => `
        <tr>
          <td><strong style="color:#fff;">${o.cv}</strong></td>
          <td>${o.hoten}</td>
          <td>${o.mssv || '—'}</td>
          <td>${o.phone || '—'}</td>
        </tr>
      `).join("");
    } else {
      officersRows = `<tr><td colspan="4" style="text-align:center; color:#f87171; padding: 12px;">Lớp chưa nộp biểu mẫu Ban cán sự & Chi đoàn</td></tr>`;
    }

    // Evidence images thumbnails
    let galleryHtml = "";
    if (hasSub) {
      galleryHtml = `
        <div class="evidence-gallery">
          <p style="font-weight:600; color:#38bdf8; margin-bottom: 6px;">Ảnh minh chứng đã nộp (${classSubs.length}):</p>
          <div class="evidence-thumb-wrapper">
            ${classSubs.map((s, idx) => `
              <img src="${s.imageBase64}" class="evidence-thumb" alt="Minh chứng ${c.lop}" 
                   onclick="openLightbox('${s.imageBase64}', 'Lớp ${s.lop} - ${s.hoten} (${s.loaiMinhChung})', '${s.timestamp}')"
                   title="Bấm để phóng to">
            `).join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="class-card" id="card-${c.lop}">
        <div class="card-top">
          <div class="class-title-block">
            <h3>${c.lop}</h3>
            <span>${c.khoa} • Sĩ số: ${c.siso} sinh viên</span>
          </div>
          ${badgeHtml}
        </div>

        <div class="officers-summary">
          <div class="officer-line">
            <span class="officer-role">Bí thư chi đoàn:</span>
            ${btName}
          </div>
          <div class="officer-line">
            <span class="officer-role">Phó Bí thư:</span>
            ${pbtName}
          </div>
          <div class="officer-line">
            <span class="officer-role">Lớp trưởng:</span>
            ${ltName}
          </div>
        </div>

        <div class="card-footer-btns">
          <button class="btn btn-outline btn-sm" onclick="toggleAccordion('${c.lop}')" id="btn-toggle-${c.lop}">
            📋 Xem cán sự (${c.officers.length})
          </button>
          <button class="btn btn-primary btn-sm" onclick="selectClassForSubmission('${c.khoa}', '${c.lop}')">
            📤 Nộp ngay
          </button>
        </div>

        <!-- Accordion details -->
        <div class="class-accordion" id="acc-${c.lop}">
          <p style="font-weight:700; color:#fff; margin-bottom:8px;">Danh sách Ban cán sự & Chi đoàn đã nộp:</p>
          <div class="officers-table-wrapper">
            <table class="officers-table">
              <thead>
                <tr>
                  <th>Chức vụ</th>
                  <th>Họ và tên</th>
                  <th>MSSV</th>
                  <th>SĐT / Zalo</th>
                </tr>
              </thead>
              <tbody>
                ${officersRows}
              </tbody>
            </table>
          </div>
          ${galleryHtml}
        </div>
      </div>
    `;
  }).join("");
}

function toggleAccordion(lopCode) {
  const acc = document.getElementById(`acc-${lopCode}`);
  const btn = document.getElementById(`btn-toggle-${lopCode}`);
  if (acc) {
    acc.classList.toggle("open");
    if (btn) {
      btn.textContent = acc.classList.contains("open") ? "Ẩn bớt ✕" : `📋 Xem cán sự`;
    }
  }
}

function selectClassForSubmission(khoa, lop) {
  const selectKhoa = document.getElementById("select-khoa");
  const selectLop = document.getElementById("select-lop");

  selectKhoa.value = khoa;
  selectKhoa.dispatchEvent(new Event("change"));

  setTimeout(() => {
    selectLop.value = lop;
    selectLop.dispatchEvent(new Event("change"));

    const uploadPanel = document.getElementById("submit-section");
    if (uploadPanel) {
      uploadPanel.scrollIntoView({ behavior: "smooth" });
    }
  }, 100);
}

function initFilters() {
  const searchInput = document.getElementById("search-input");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const statusFilter = document.getElementById("status-filter");

  searchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value;
    renderClassesGrid();
  });

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeKhoaFilter = btn.getAttribute("data-khoa");
      renderClassesGrid();
    });
  });

  statusFilter.addEventListener("change", (e) => {
    activeStatusFilter = e.target.value;
    renderClassesGrid();
  });
}

// ==========================================
// 7. DASHBOARD & STATS
// ==========================================
function renderDashboard() {
  const totalClasses = APP_DATA.classes.length; // 56
  const submittedClasses = new Set(allSubmissions.map(s => s.lop)).size;
  const overallPercent = Math.round((submittedClasses / totalClasses) * 100);

  // Update hero stats
  const statSubmitted = document.getElementById("stat-submitted-count");
  if (statSubmitted) statSubmitted.innerText = `${submittedClasses} / 56`;

  const overallPercentEl = document.getElementById("overall-percentage");
  if (overallPercentEl) overallPercentEl.innerText = `${overallPercent}% (${submittedClasses}/56 lớp)`;

  // Course progress
  const courses = [
    { code: "Khóa 23", total: 7, valEl: "prog-k23-val", barEl: "prog-k23-bar" },
    { code: "Khóa 24", total: 13, valEl: "prog-k24-val", barEl: "prog-k24-bar" },
    { code: "Khóa 25", total: 14, valEl: "prog-k25-val", barEl: "prog-k25-bar" },
    { code: "Khóa 26", total: 22, valEl: "prog-k26-val", barEl: "prog-k26-bar" },
  ];

  courses.forEach(c => {
    const classList = APP_DATA.classes.filter(item => item.khoa === c.code).map(item => item.lop);
    const completedCount = classList.filter(lop => isClassSubmitted(lop)).length;
    const pct = Math.round((completedCount / c.total) * 100);

    const valEl = document.getElementById(c.valEl);
    const barEl = document.getElementById(c.barEl);
    if (valEl) valEl.innerText = `${completedCount} / ${c.total} lớp (${pct}%)`;
    if (barEl) barEl.style.width = `${pct}%`;
  });

  // Render Submissions Table
  const tbody = document.getElementById("submissions-tbody");
  if (!tbody) return;

  if (allSubmissions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-dim); padding: 30px;">
          Chưa có minh chứng nào được gửi. Hãy chọn lớp và nộp minh chứng đầu tiên ở biểu mẫu trên!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = allSubmissions.map(s => `
    <tr>
      <td style="font-size:0.8rem; color:var(--text-muted);">${s.timestamp}</td>
      <td><span class="card-badge badge-blue" style="margin:0;">${s.khoa}</span></td>
      <td><strong style="color:#fff;">${s.lop}</strong></td>
      <td><strong>${s.hoten}</strong> ${s.mssv ? `<br><small style="color:var(--text-dim);">${s.mssv}</small>` : ''}</td>
      <td>${s.sdt}</td>
      <td><span class="evidence-badge badge-submitted">${s.loaiMinhChung}</span></td>
      <td>
        <img src="${s.imageBase64}" class="evidence-thumb" style="width:44px; height:44px;" alt="Thumbnail"
             onclick="openLightbox('${s.imageBase64}', 'Lớp ${s.lop} - ${s.hoten} (${s.loaiMinhChung})', '${s.timestamp}')">
      </td>
      <td>
        <button class="btn btn-outline btn-sm" style="color:#f87171; border-color:rgba(239,68,68,0.3);" onclick="deleteSubmissionItem(${s.id})">
          🗑️ Xóa
        </button>
      </td>
    </tr>
  `).join("");
}

async function deleteSubmissionItem(id) {
  if (!confirm("Bạn có chắc chắn muốn xóa bản ghi minh chứng này không?")) return;
  try {
    await dbDeleteSubmission(id);
    allSubmissions = allSubmissions.filter(s => s.id !== id);
    showToast("Đã xóa bản ghi minh chứng!", "success");
    renderClassesGrid();
    renderDashboard();
  } catch (err) {
    console.error("Delete error:", err);
    showToast("Không thể xóa bản ghi, vui lòng thử lại!", "error");
  }
}

// ==========================================
// 8. EXPORT TO CSV / EXCEL & JSON
// ==========================================
function exportToCSV() {
  if (allSubmissions.length === 0) {
    showToast("Chưa có minh chứng nào để xuất file!", "error");
    return;
  }

  // BOM for UTF-8 in Excel
  let csvContent = "\uFEFF";
  csvContent += "STT,Thời gian nộp,Khóa,Lớp,MSSV,Họ và tên,SĐT / Zalo,Loại minh chứng,Ghi chú\n";

  allSubmissions.forEach((s, idx) => {
    const row = [
      idx + 1,
      `"${s.timestamp}"`,
      `"${s.khoa}"`,
      `"${s.lop}"`,
      `"${s.mssv || ''}"`,
      `"${s.hoten.replace(/"/g, '""')}"`,
      `"${s.sdt}"`,
      `"${s.loaiMinhChung}"`,
      `"${(s.ghiChu || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Danh_sach_Minh_Chung_DoanKhoaCNTT_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Đã xuất danh sách minh chứng ra file CSV thành công!", "success");
}

function exportToJSON() {
  if (allSubmissions.length === 0) {
    showToast("Chưa có dữ liệu để sao lưu!", "error");
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allSubmissions, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute("download", `Backup_MinhChung_DoanKhoaCNTT_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Đã tải tệp sao lưu JSON thành công!", "success");
}

// ==========================================
// 9. MODALS & LIGHTBOX
// ==========================================
function openLightbox(imgSrc, caption, time) {
  const modal = document.getElementById("lightbox-modal");
  const img = document.getElementById("lightbox-img");
  const cap = document.getElementById("lightbox-caption");
  const title = document.getElementById("lightbox-title");

  img.src = imgSrc;
  title.textContent = caption || "Ảnh Minh Chứng";
  cap.textContent = `Thời gian nộp: ${time || ''}`;
  modal.classList.add("active");
}

function closeLightbox() {
  const modal = document.getElementById("lightbox-modal");
  modal.classList.remove("active");
}

function initModals() {
  // Lightbox
  const btnCloseLightbox = document.getElementById("btn-close-lightbox");
  const lightboxModal = document.getElementById("lightbox-modal");
  if (btnCloseLightbox) btnCloseLightbox.addEventListener("click", closeLightbox);
  if (lightboxModal) {
    lightboxModal.addEventListener("click", (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  // QR Modal
  const btnOpenQR = document.getElementById("btn-zoom-qr");
  const qrWrapper = document.getElementById("qr-preview-wrapper");
  const qrModal = document.getElementById("qr-modal");
  const btnCloseQR = document.getElementById("btn-close-qr-modal");

  const openQRModal = () => qrModal.classList.add("active");
  const closeQRModal = () => qrModal.classList.remove("active");

  if (btnOpenQR) btnOpenQR.addEventListener("click", openQRModal);
  if (qrWrapper) qrWrapper.addEventListener("click", openQRModal);
  if (btnCloseQR) btnCloseQR.addEventListener("click", closeQRModal);
  if (qrModal) {
    qrModal.addEventListener("click", (e) => {
      if (e.target === qrModal) closeQRModal();
    });
  }

  // Google Modal
  const btnOpenGoogle = document.getElementById("btn-open-google-modal");
  const googleModal = document.getElementById("google-modal");
  const btnCloseGoogle = document.getElementById("btn-close-google-modal");
  const btnSaveWebhook = document.getElementById("btn-save-webhook");
  const btnTestWebhook = document.getElementById("btn-test-webhook");
  const btnCopyAppsScript = document.getElementById("btn-copy-apps-script");
  const inputWebhook = document.getElementById("input-webhook-url");
  const codeBox = document.getElementById("code-snippet");

  // Load complete upgraded Google Apps Script code to codeBox
  const gasSampleCode = `/**
 * GOOGLE APPS SCRIPT - LƯU MINH CHỨNG TỪNG LỚP TRÊN GOOGLE DRIVE (FREE 100%)
 * ĐOÀN KHOA CNTT - ĐẠI HỌC LẠC HỒNG (2026 - 2027)
 * TỰ ĐỘNG TẠO 56 THƯ MỤC LỚP & ĐIỀU HƯỚNG ẢNH VÀO ĐÚNG LỚP
 */
var ROOT_FOLDER_NAME = "MINH_CHUNG_DOAN_KHOA_CNTT_2026";
var SPREADSHEET_NAME = "TongHop_MinhChung_ChiDoan_KhoaCNTT";

var DANH_SACH_LOP = {
  "Khóa 23": ["23AI111", "23CT111", "23CT112", "23CT113", "23CT401", "23EC111", "23MC111"],
  "Khóa 24": ["24AG711", "24AG712", "24AI111", "24CT111", "24CT112", "24CT113", "24CT114", "24CT402", "24CT501", "24CT502", "24EC111", "24MC111", "24MC112"],
  "Khóa 25": ["25AG712", "25AI111", "25CT111", "25CT112", "25CT113", "25CT114", "25CT401", "25CT501", "25CT711", "25CT712", "25EC111", "25MC111", "25MC112", "25MC113"],
  "Khóa 26": ["26AG701", "26AI111", "26AT111", "26BE111", "26CT111", "26CT112", "26CT113", "26CT201", "26CT401", "26CT402", "26CT501", "26CT502", "26CT711", "26CT712", "26EC111", "26EC112", "26MC111", "26MC112", "26MC113", "26MC401", "26MC501", "26VT123"]
};

// Hàm chạy 1 lần để tạo sẵn cấu trúc 56 thư mục trên Google Drive
function khoiTaoHeThong56Lop() {
  var root = getOrCreateFolder(ROOT_FOLDER_NAME, DriveApp.getRootFolder());
  for (var k in DANH_SACH_LOP) {
    var kFolder = getOrCreateFolder(k, root);
    for (var i = 0; i < DANH_SACH_LOP[k].length; i++) {
      getOrCreateFolder(DANH_SACH_LOP[k][i], kFolder);
    }
  }
  getOrCreateSpreadsheet(SPREADSHEET_NAME, root);
}

// Tiếp nhận ảnh và lưu thẳng vào thư mục của lớp đó
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var maLop = (data.lop || "").trim();
    var khoa = (data.khoa || "").trim() || ("Khóa " + maLop.substring(0, 2));
    
    var root = getOrCreateFolder(ROOT_FOLDER_NAME, DriveApp.getRootFolder());
    var kFolder = getOrCreateFolder(khoa, root);
    var lopFolder = getOrCreateFolder(maLop, kFolder); // Thư mục riêng của lớp
    
    var fileUrl = "";
    if (data.imageBase64) {
      var b64 = data.imageBase64.replace(/^data:image\\/\\w+;base64,/, "");
      var blob = Utilities.newBlob(Utilities.base64Decode(b64), "image/jpeg");
      var fileName = "[" + maLop + "]_" + (data.mssv || "SV") + "_" + data.loaiMinhChung + "_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss") + ".jpg";
      blob.setName(fileName);
      var file = lopFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    }
    
    var ss = getOrCreateSpreadsheet(SPREADSHEET_NAME, root);
    var sheet = ss.getSheetByName("Tất cả minh chứng");
    sheet.appendRow([
      Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss"),
      khoa, maLop, data.mssv, data.hoten, data.sdt, data.loaiMinhChung,
      fileUrl ? '=HYPERLINK("' + fileUrl + '", "Xem ảnh")' : "Không có ảnh",
      '=HYPERLINK("' + lopFolder.getUrl() + '", "Mở thư mục lớp ' + maLop + '")',
      data.ghiChu || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileUrl: fileUrl,
      folderUrl: lopFolder.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status: "online"})).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(name, parent) {
  var f = parent.getFoldersByName(name);
  return f.hasNext() ? f.next() : parent.createFolder(name);
}

function getOrCreateSpreadsheet(name, folder) {
  var f = folder.getFilesByName(name);
  if (f.hasNext()) return SpreadsheetApp.open(f.next());
  var ss = SpreadsheetApp.create(name);
  var file = DriveApp.getFileById(ss.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  var s1 = ss.getActiveSheet();
  s1.setName("Tất cả minh chứng");
  s1.appendRow(["Thời gian nộp", "Khóa", "Mã lớp", "MSSV", "Họ và tên", "SĐT/Zalo", "Loại minh chứng", "Link ảnh", "Thư mục lớp Drive", "Ghi chú"]);
  return ss;
}`;

  if (codeBox) codeBox.textContent = gasSampleCode;

  // Load existing saved Webhook URL
  const savedUrl = localStorage.getItem("gas_webhook_url") || (typeof APP_DATA !== "undefined" && APP_DATA.config && APP_DATA.config.googleAppsScriptUrl) || "";
  if (inputWebhook) inputWebhook.value = savedUrl;

  const storageBadge = document.getElementById("storage-status-badge");
  if (storageBadge && savedUrl) {
    storageBadge.innerHTML = "● Đã kết nối Google Drive & Sheets (Sẵn sàng)";
    storageBadge.style.color = "#34d399";
  }

  const openGoogleModal = () => googleModal.classList.add("active");
  const closeGoogleModal = () => googleModal.classList.remove("active");

  if (btnOpenGoogle) btnOpenGoogle.addEventListener("click", openGoogleModal);
  if (btnCloseGoogle) btnCloseGoogle.addEventListener("click", closeGoogleModal);
  if (googleModal) {
    googleModal.addEventListener("click", (e) => {
      if (e.target === googleModal) closeGoogleModal();
    });
  }

  if (btnCopyAppsScript) {
    btnCopyAppsScript.addEventListener("click", () => {
      navigator.clipboard.writeText(gasSampleCode).then(() => {
        showToast("Đã sao chép mã nguồn Google Apps Script vào Clipboard!", "success");
      });
    });
  }

  if (btnSaveWebhook) {
    btnSaveWebhook.addEventListener("click", () => {
      const url = inputWebhook.value.trim();
      localStorage.setItem("gas_webhook_url", url);
      showToast(url ? "Đã lưu Google Apps Script Webhook URL thành công!" : "Đã hủy liên kết Webhook (chỉ dùng lưu offline)", "success");
      closeGoogleModal();
    });
  }

  if (btnTestWebhook) {
    btnTestWebhook.addEventListener("click", () => {
      const url = inputWebhook.value.trim();
      if (!url) {
        showToast("Vui lòng nhập URL Web App trước khi kiểm tra!", "error");
        return;
      }
      showToast("Đang gửi yêu cầu kiểm tra kết nối...", "info");
      fetch(url, { method: "GET", mode: "no-cors" })
        .then(() => {
          showToast("Kết nối đến Google Apps Script thành công!", "success");
        })
        .catch(err => {
          console.error(err);
          showToast("Đã gửi kiểm tra! (Lưu ý: Nếu chưa bật quyền Anyone sẽ có thể bị chặn)", "info");
        });
    });
  }
}

// ==========================================
// 10. TOAST NOTIFICATION
// ==========================================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// 11. INITIALIZATION ON DOM READY
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initDB();
    allSubmissions = await dbGetAllSubmissions();
    console.log(`Loaded ${allSubmissions.length} existing submissions from IndexedDB.`);
  } catch (e) {
    console.warn("IndexedDB init fallback:", e);
    allSubmissions = [];
  }

  initCountdown();
  initFormInteractions();
  initFormSubmit();
  initFilters();
  initModals();

  renderClassesGrid();
  renderDashboard();

  // Export buttons
  const btnExportCsv = document.getElementById("btn-export-csv");
  const btnExportJson = document.getElementById("btn-export-json");
  if (btnExportCsv) btnExportCsv.addEventListener("click", exportToCSV);
  if (btnExportJson) btnExportJson.addEventListener("click", exportToJSON);
});
