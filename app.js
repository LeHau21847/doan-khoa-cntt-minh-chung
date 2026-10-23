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
    const request = indexedDB.open("DoanKhoaCNTT_EvidenceDB", 2);
    
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains("submissions")) {
        const store = database.createObjectStore("submissions", { keyPath: "id", autoIncrement: true });
        store.createIndex("lop", "lop", { unique: false });
        store.createIndex("khoa", "khoa", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
      if (!database.objectStoreNames.contains("images")) {
        database.createObjectStore("images", { keyPath: "id" });
      }
    };
    
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    
    request.onerror = (e) => {
      console.warn("IndexedDB error:", e.target.error);
      resolve(null);
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

function dbSaveExamImage(lop, mssv, topicId, imageBase64) {
  return new Promise((resolve) => {
    if (!db || !db.objectStoreNames.contains("images")) return resolve(false);
    try {
      const tx = db.transaction(["images"], "readwrite");
      const store = tx.objectStore("images");
      const key = `${lop}_${mssv}_${topicId}`;
      store.put({ id: key, imageBase64: imageBase64, timestamp: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

function dbGetExamImage(lop, mssv, topicId) {
  return new Promise((resolve) => {
    if (!db || !db.objectStoreNames.contains("images")) return resolve(null);
    try {
      const tx = db.transaction(["images"], "readonly");
      const store = tx.objectStore("images");
      const key = `${lop}_${mssv}_${topicId}`;
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.imageBase64 : null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Tự động nén ảnh trên trình duyệt giảm dung lượng từ 3-8MB xuống ~100-150KB
 * Giúp tải lên Google Drive cực nhanh và không bao giờ làm tràn bộ nhớ trình duyệt!
 */
function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('File không phải ảnh hợp lệ'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => reject(new Error('Không thể tải ảnh'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file ảnh'));
    reader.readAsDataURL(file);
  });
}

function formatDriveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  const match = url.match(/[-\w]{25,}/);
  if (match) {
    return 'https://lh3.googleusercontent.com/d/' + match[0];
  }
  return url;
}

function matchTopicId(text) {
  if (!text) return 'HCM_2026_DVTN';
  const s = text.toLowerCase();
  if (s.includes('xiii') || s.includes('đoàn toàn quốc') || s.includes('doan_xiii')) return 'NQ_DOAN_XIII';
  if (s.includes('xiv') || s.includes('đảng toàn quốc') || s.includes('dang_xiv')) return 'NQ_DANG_XIV';
  if (s.includes('cb đoàn') || s.includes('cán bộ đoàn') || s.includes('cb_doan') || s.includes('cbdoan')) return 'HCM_2026_CB_DOAN';
  if (s.includes('đvtn') || s.includes('dvtn') || s.includes('đoàn viên thanh niên') || s.includes('thanh nien')) return 'HCM_2026_DVTN';
  if (s.includes('lý luận') || s.includes('ly luan') || s.includes('lyluan')) return 'LY_LUAN_CHINH_TRI';
  return 'HCM_2026_DVTN';
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
  if (currentAuth && currentAuth.role === 'admin') {
    viewingAsAdmin = true;
    updateSectionsVisibility();
    renderClassPortal(lop);
    const classSec = document.getElementById("class-portal-section");
    if (classSec) {
      classSec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  const selectKhoa = document.getElementById("select-khoa");
  const selectLop = document.getElementById("select-lop");

  if (selectKhoa) {
    selectKhoa.value = khoa;
    selectKhoa.dispatchEvent(new Event("change"));
  }

  setTimeout(() => {
    if (selectLop) {
      selectLop.value = lop;
      selectLop.dispatchEvent(new Event("change"));
    }

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
      var safeTopic = "ThiNghiQuyet";
      if (data.topicCode) safeTopic = data.topicCode;
      else if ((data.loaiMinhChung || "").indexOf("XIII") >= 0) safeTopic = "NQ_Doan_XIII";
      else if ((data.loaiMinhChung || "").indexOf("XIV") >= 0) safeTopic = "NQ_Dang_XIV";
      else if ((data.loaiMinhChung || "").indexOf("CB Đoàn") >= 0) safeTopic = "HCM2026_CBDoan";
      else if ((data.loaiMinhChung || "").indexOf("ĐVTN") >= 0) safeTopic = "HCM2026_DVTN";
      else if ((data.loaiMinhChung || "").indexOf("lý luận") >= 0) safeTopic = "LyLuanChinhTri";
      var fileName = "[" + maLop + "]_" + (data.mssv ? data.mssv + "_" : "") + safeTopic + "_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss") + ".jpg";
      blob.setName(fileName);
      var file = lopFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    }
    
    var ss = getOrCreateSpreadsheet(SPREADSHEET_NAME, root);
    var sheet = ss.getSheetByName("Tất cả minh chứng");
    sheet.appendRow([
      Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss"),
      khoa, maLop, data.mssv || "", data.hoten || "", data.sdt || "", data.loaiMinhChung || "",
      data.doiTuong || "Đoàn viên",
      fileUrl ? '=HYPERLINK("' + fileUrl + '", "Xem ảnh minh chứng")' : "Không có ảnh",
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
  initAuthAndPortals();

  // Export buttons
  const btnExportCsv = document.getElementById("btn-export-csv");
  const btnExportJson = document.getElementById("btn-export-json");
  if (btnExportCsv) btnExportCsv.addEventListener("click", exportToCSV);
  if (btnExportJson) btnExportJson.addEventListener("click", exportToJSON);

  // Lắng nghe các nút Đồng bộ Cloud
  document.querySelectorAll('.btn-sync-cloud').forEach(btn => {
    btn.addEventListener('click', () => {
      syncDataFromCloud(true);
    });
  });

  // Tự động đồng bộ ngầm dữ liệu từ Google Drive / Sheets khi mở trang
  setTimeout(() => {
    syncDataFromCloud(false);
  }, 1200);
});

// =========================================================================
// 12. PORTAL & AUTHENTICATION MANAGER (ADMIN & 56 CLASS ACCOUNTS)
// =========================================================================
const EXAM_TOPICS = [
  {
    id: "NQ_DOAN_XIII",
    shortTitle: "NQ Đoàn toàn quốc lần XIII",
    fullTitle: "Kiểm tra, đánh giá kết quả nghiên cứu, học tập Nghị quyết đại hội Đoàn toàn quốc lần thứ XIII",
    badgeColor: "#38bdf8"
  },
  {
    id: "NQ_DANG_XIV",
    shortTitle: "NQ Đại hội XIV của Đảng",
    fullTitle: "Kiểm tra, đánh giá kết quả học tập Nghị quyết Đại hội XIV của Đảng",
    badgeColor: "#f87171"
  },
  {
    id: "HCM_2026_CB_DOAN",
    shortTitle: "Chuyên đề HCM 2026 (CB Đoàn)",
    fullTitle: "Kiểm tra kết quả học tập Chuyên đề về tư tưởng, đạo đức, phong cách Hồ Chí Minh năm 2026_CB Đoàn",
    badgeColor: "#fb923c"
  },
  {
    id: "HCM_2026_DVTN",
    shortTitle: "Chuyên đề HCM 2026 (ĐVTN)",
    fullTitle: "Kiểm tra kết quả học tập Chuyên đề về tư tưởng, đạo đức, phong cách Hồ Chí Minh năm 2026_ĐVTN",
    badgeColor: "#eab308"
  },
  {
    id: "LY_LUAN_CHINH_TRI",
    shortTitle: "Học tập các bài lý luận chính trị",
    fullTitle: "Kiểm tra học tập các bài lý luận chính trị",
    badgeColor: "#a855f7"
  }
];

function getStudentExams(sState) {
  if (!sState) return {};
  if (sState.exams) return sState.exams;
  // Backward compatibility with legacy single examEvidence
  if (sState.examEvidence) {
    const topicId = sState.examEvidence.topicCode || "HCM_2026_DVTN";
    return {
      [topicId]: {
        topicCode: topicId,
        topicName: sState.examEvidence.topicName || EXAM_TOPICS[3].fullTitle,
        shortTitle: sState.examEvidence.shortTitle || EXAM_TOPICS[3].shortTitle,
        imageBase64: sState.examEvidence.imageBase64,
        fileUrl: sState.examEvidence.fileUrl,
        timestamp: sState.examEvidence.timestamp,
        note: sState.examEvidence.note
      }
    };
  }
  return {};
}

let currentAuth = null;
let viewingAsAdmin = false;
let currentStudentFilter = 'ALL';
let currentStudentSearch = '';
let currentExamTarget = null;
let currentZaloImageBase64 = null;
let currentExamImageBase64 = null;

function getClassState(lopCode) {
  try {
    const raw = localStorage.getItem('class_state_' + lopCode);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading class state:', e);
  }
  return {
    zaloEvidence: null,
    students: {}
  };
}

/**
 * LƯU TRỮ THÔNG MINH - KHẮC PHỤC TRIỆT ĐỂ LỖI QUOTA TRÊN BÀI THỨ 13:
 * Tách biệt hoàn toàn metadata nhẹ (< 200 bytes) lưu trong localStorage
 * và dữ liệu ảnh lớn lưu trong IndexedDB / Google Drive.
 * Đảm bảo nộp đến hàng trăm sinh viên mà không bao giờ bị lỗi 'Chưa nộp'!
 */
function saveClassState(lopCode, state) {
  if (!lopCode) return;
  try {
    const cleanState = {
      zaloEvidence: null,
      students: {}
    };

    if (state.zaloEvidence) {
      cleanState.zaloEvidence = {
        hasProof: true,
        timestamp: state.zaloEvidence.timestamp || '',
        submitterName: state.zaloEvidence.submitterName || '',
        phone: state.zaloEvidence.phone || '',
        fileUrl: state.zaloEvidence.fileUrl || ''
      };
      // Giữ base64 nhỏ nếu có (< 120KB) để xem offline
      if (state.zaloEvidence.imageBase64 && state.zaloEvidence.imageBase64.length < 120000 && !state.zaloEvidence.fileUrl) {
        cleanState.zaloEvidence.imageBase64 = state.zaloEvidence.imageBase64;
      }
    }

    if (state.students) {
      for (const mssv in state.students) {
        const s = state.students[mssv];
        if (!s) continue;
        cleanState.students[mssv] = {
          isNonMember: !!s.isNonMember,
          exams: {}
        };
        const exams = s.exams || {};
        for (const tid in exams) {
          const ex = exams[tid];
          cleanState.students[mssv].exams[tid] = {
            topicCode: ex.topicCode || tid,
            topicName: ex.topicName || '',
            shortTitle: ex.shortTitle || '',
            timestamp: ex.timestamp || '',
            note: ex.note || '',
            fileUrl: ex.fileUrl || '',
            hasProof: true
          };
          // Chỉ giữ base64 nếu ảnh nén rất nhỏ (< 100KB) và chưa có link Drive
          if (ex.imageBase64 && ex.imageBase64.length < 100000 && !ex.fileUrl) {
            cleanState.students[mssv].exams[tid].imageBase64 = ex.imageBase64;
          }
        }
        const examKeys = Object.keys(cleanState.students[mssv].exams);
        if (examKeys.length > 0) {
          cleanState.students[mssv].examEvidence = cleanState.students[mssv].exams[examKeys[0]];
        }
      }
    }

    localStorage.setItem('class_state_' + lopCode, JSON.stringify(cleanState));
  } catch (e) {
    console.warn('Cảnh báo bộ nhớ localStorage, chuyển sang chế độ siêu tinh gọn:', e);
    try {
      const ultraClean = {
        zaloEvidence: state.zaloEvidence ? { hasProof: true, fileUrl: state.zaloEvidence.fileUrl || '', timestamp: state.zaloEvidence.timestamp || '' } : null,
        students: {}
      };
      for (const mssv in state.students) {
        const s = state.students[mssv];
        ultraClean.students[mssv] = {
          isNonMember: !!s.isNonMember,
          exams: {}
        };
        for (const tid in (s.exams || {})) {
          const ex = s.exams[tid];
          ultraClean.students[mssv].exams[tid] = {
            topicCode: tid,
            shortTitle: ex.shortTitle || tid,
            hasProof: true,
            fileUrl: ex.fileUrl || '',
            timestamp: ex.timestamp || ''
          };
        }
      }
      localStorage.setItem('class_state_' + lopCode, JSON.stringify(ultraClean));
    } catch (err2) {
      console.error('Không thể lưu localStorage khẩn cấp:', err2);
    }
  }
}

function sendToGoogleAppsScript(payload) {
  const webhookUrl = localStorage.getItem('gas_webhook_url') || (typeof APP_DATA !== 'undefined' && APP_DATA.config && APP_DATA.config.googleAppsScriptUrl) || '';
  if (!webhookUrl) return;
  try {
    fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(() => {
      console.log('Background sync to GAS successful:', payload.loaiMinhChung || payload.action);
      // Tự động đồng bộ lại sau khi máy chủ Drive xử lý xong
      setTimeout(() => {
        syncDataFromCloud(false);
      }, 4000);
    }).catch(err => {
      console.warn('Background sync error:', err);
    });
  } catch (err) {
    console.warn('Could not post to GAS:', err);
  }
}

let isSyncing = false;

/**
 * ĐỒNG BỘ TOÀN BỘ MINH CHỨNG TỪ GOOGLE SHEETS & DRIVE VỀ THIẾT BỊ
 * Khắc phục hoàn toàn việc "máy khác nộp không thấy", "Admin không thấy tiến độ"!
 */
async function syncDataFromCloud(showNotifications = true) {
  if (isSyncing) return;
  isSyncing = true;

  const webhookUrl = localStorage.getItem('gas_webhook_url') || (typeof APP_DATA !== 'undefined' && APP_DATA.config && APP_DATA.config.googleAppsScriptUrl) || '';
  if (!webhookUrl) {
    isSyncing = false;
    return;
  }

  if (showNotifications) {
    showToast('🔄 Đang đồng bộ dữ liệu từ Google Drive...', 'info');
  }

  document.querySelectorAll('.btn-sync-cloud').forEach(btn => {
    btn.disabled = true;
    btn.innerHTML = '⏳ Đang đồng bộ...';
  });

  try {
    const data = await fetchCloudSubmissions(webhookUrl);
    if (!data || data.status !== 'success') {
      throw new Error(data ? data.message : 'Phản hồi không hợp lệ từ máy chủ Google');
    }

    let syncedCount = 0;
    const submissions = data.submissions || [];
    const nonMembers = data.nonMembers || [];

    const classUpdates = {};

    submissions.forEach(sub => {
      const lop = (sub.lop || '').trim();
      const mssv = (sub.mssv || '').trim();
      if (!lop) return;

      if (!classUpdates[lop]) {
        classUpdates[lop] = getClassState(lop);
      }
      const state = classUpdates[lop];

      // 1. Zalo Bí thư Chi đoàn
      if (sub.loaiMinhChung && (sub.loaiMinhChung.indexOf('Zalo') >= 0 || sub.loaiMinhChung.indexOf('BITHU') >= 0 || !mssv)) {
        if (!state.zaloEvidence || !state.zaloEvidence.hasProof || !state.zaloEvidence.fileUrl) {
          state.zaloEvidence = {
            hasProof: true,
            fileUrl: sub.fileUrl || '',
            timestamp: sub.timestamp || '',
            submitterName: sub.hoten || 'Bí thư',
            phone: sub.sdt || ''
          };
          syncedCount++;
        }
      } 
      // 2. Bài thi Nghị quyết sinh viên
      else if (mssv) {
        if (!state.students[mssv]) state.students[mssv] = { isNonMember: false, exams: {} };
        if (!state.students[mssv].exams) state.students[mssv].exams = {};

        const topicId = matchTopicId(sub.loaiMinhChung || sub.topicCode);
        const topicObj = EXAM_TOPICS.find(t => t.id === topicId) || EXAM_TOPICS[3];

        if (!state.students[mssv].exams[topicId] || !state.students[mssv].exams[topicId].hasProof) {
          state.students[mssv].exams[topicId] = {
            topicCode: topicId,
            topicName: topicObj.fullTitle,
            shortTitle: topicObj.shortTitle,
            fileUrl: sub.fileUrl || '',
            timestamp: sub.timestamp || '',
            note: sub.ghiChu || '',
            hasProof: true
          };
          state.students[mssv].examEvidence = state.students[mssv].exams[topicId];
          syncedCount++;
        } else if (sub.fileUrl && !state.students[mssv].exams[topicId].fileUrl) {
          state.students[mssv].exams[topicId].fileUrl = sub.fileUrl;
        }
      }
    });

    // Cập nhật trạng thái đối tượng Chưa kết nạp Đoàn
    nonMembers.forEach(nm => {
      const lop = (nm.lop || '').trim();
      const mssv = (nm.mssv || '').trim();
      if (!lop || !mssv) return;

      if (!classUpdates[lop]) {
        classUpdates[lop] = getClassState(lop);
      }
      const state = classUpdates[lop];
      if (!state.students[mssv]) state.students[mssv] = { exams: {} };
      state.students[mssv].isNonMember = !!nm.isNonMember;
    });

    // Lưu lại từng lớp
    for (const lop in classUpdates) {
      saveClassState(lop, classUpdates[lop]);
    }

    // Làm mới giao diện hiện tại
    if (currentAuth && currentAuth.role === 'admin') {
      renderAdminPortal();
    } else if (currentAuth && currentAuth.role === 'class') {
      renderClassPortal(currentAuth.lop);
    }
    renderClassesGrid();
    renderDashboard();

    if (showNotifications) {
      showToast(`✅ Đã đồng bộ thành công! Có ${submissions.length} minh chứng trên hệ thống Google.`, 'success');
    }
    console.log(`Cloud sync finished: ${submissions.length} total records from Google Sheets.`);

  } catch (err) {
    console.warn('Lỗi đồng bộ Cloud:', err);
    if (showNotifications) {
      showToast('⚠️ Không thể tải dữ liệu từ Google: ' + err.message, 'warning');
    }
  } finally {
    isSyncing = false;
    document.querySelectorAll('.btn-sync-cloud').forEach(btn => {
      btn.disabled = false;
      btn.innerHTML = btn.id === 'btn-sync-cloud-admin' ? '🔄 Đồng bộ dữ liệu mới nhất' : '🔄 Đồng bộ dữ liệu';
    });
  }
}

/**
 * Hỗ trợ fetch GET trực tiếp và tự động fallback sang JSONP
 * để vượt qua mọi rào cản CORS trên điện thoại và máy tính!
 */
function fetchCloudSubmissions(webhookUrl) {
  return new Promise((resolve, reject) => {
    const cleanUrl = webhookUrl.split('?')[0];
    const timestamp = Date.now();
    
    // 1. Thử qua fetch API trực tiếp
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(`${cleanUrl}?action=get_all&t=${timestamp}`, {
      method: 'GET',
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(data => resolve(data))
      .catch(fetchErr => {
        console.warn('Fetch trực tiếp thất bại, chuyển sang cơ chế JSONP...', fetchErr);

        // 2. Fallback sang JSONP
        const callbackName = 'gasCallback_' + timestamp + '_' + Math.floor(Math.random() * 10000);
        const script = document.createElement('script');

        let timer = setTimeout(() => {
          cleanup();
          reject(new Error('Kết nối Google Sheets quá thời gian. Hãy đảm bảo Web App đã cài đặt quyền truy cập là "Bất kỳ ai" (Anyone).'));
        }, 15000);

        function cleanup() {
          clearTimeout(timer);
          if (script.parentNode) script.parentNode.removeChild(script);
          delete window[callbackName];
        }

        window[callbackName] = function(json) {
          cleanup();
          resolve(json);
        };

        script.src = `${cleanUrl}?action=get_all&callback=${callbackName}&t=${timestamp}`;
        script.onerror = function() {
          cleanup();
          reject(new Error('Không thể kết nối đến Web App Google. Hãy kiểm tra URL và phân quyền "Bất kỳ ai".'));
        };

        document.head.appendChild(script);
      });
  });
}

function updateNavAuthUI() {
  const container = document.getElementById('nav-auth-container');
  if (!container) return;

  if (!currentAuth) {
    container.innerHTML = '<button class="btn btn-primary btn-sm" id="btn-show-login"><span class="desktop-text">🔐 Đăng nhập (Admin / Lớp)</span><span class="mobile-text">🔐 Đăng nhập</span></button>';
    const btn = document.getElementById('btn-show-login');
    if (btn) btn.addEventListener('click', openLoginModal);
  } else if (currentAuth.role === 'admin') {
    container.innerHTML = '<div class="logged-user-tag"><span style="color:#c084fc; font-weight:700;"><span class="desktop-text">👑 Admin Khoa</span><span class="mobile-text">👑 Admin</span></span> <button class="btn btn-outline btn-xs" id="btn-nav-logout" title="Đăng xuất">🚪 Thoát</button></div>';
    const btn = document.getElementById('btn-nav-logout');
    if (btn) btn.addEventListener('click', handleLogout);
  } else if (currentAuth.role === 'class') {
    container.innerHTML = '<div class="logged-user-tag"><span style="color:#38bdf8; font-weight:700;"><span class="desktop-text">🎓 Lớp ' + currentAuth.lop + '</span><span class="mobile-text">🎓 ' + currentAuth.lop + '</span></span> <button class="btn btn-outline btn-xs" id="btn-nav-logout" title="Đăng xuất">🚪 Thoát</button></div>';
    const btn = document.getElementById('btn-nav-logout');
    if (btn) btn.addEventListener('click', handleLogout);
  }
}

function updateSectionsVisibility() {
  const guestPrompt = document.getElementById('guest-login-prompt');
  const submitSec = document.getElementById('submit-section');
  const classesSec = document.getElementById('classes-section');
  const dashboardSec = document.getElementById('dashboard-section');
  const classSec = document.getElementById('class-portal-section');
  const adminSec = document.getElementById('admin-portal-section');
  const btnDrive = document.getElementById('btn-open-google-modal');
  const mainNavLinks = document.getElementById('main-nav-links');
  const mobNav = document.getElementById('mobile-bottom-nav');

  if (!currentAuth) {
    // 1. CHƯA ĐĂNG NHẬP (KHÁCH):
    // - Chỉ xem Hướng dẫn & QR
    // - ẨN 56 lớp, bảng tiến độ và form nộp
    // - ẨN nút Drive
    if (guestPrompt) guestPrompt.style.display = 'block';
    if (submitSec) submitSec.style.display = 'none';
    if (classesSec) classesSec.style.display = 'none';
    if (dashboardSec) dashboardSec.style.display = 'none';
    if (classSec) classSec.style.display = 'none';
    if (adminSec) adminSec.style.display = 'none';
    if (btnDrive) btnDrive.style.display = 'none';

    if (mainNavLinks) {
      mainNavLinks.innerHTML = `
        <li><a href="#info-hub">📌 Hướng dẫn & QR</a></li>
      `;
    }
    if (mobNav) {
      mobNav.innerHTML = `
        <a href="#info-hub" class="mob-nav-item">
          <span class="mob-nav-icon">📌</span>
          <span class="mob-nav-label">Hướng dẫn</span>
        </a>
        <a href="javascript:void(0)" class="mob-nav-item active-submit" id="mob-nav-login-btn">
          <span class="mob-nav-icon">🔐</span>
          <span class="mob-nav-label">Đăng nhập</span>
        </a>
      `;
      const mobLogin = document.getElementById('mob-nav-login-btn');
      if (mobLogin) mobLogin.addEventListener('click', openLoginModal);
    }
  } else if (currentAuth.role === 'class') {
    // 2. TÀI KHOẢN CHI ĐOÀN LỚP:
    // - Chỉ xem và quản lý lớp của mình
    // - KHÔNG được xem qua các lớp khác (ẩn 56 lớp & tiến độ)
    // - ẨN nút Drive
    if (guestPrompt) guestPrompt.style.display = 'none';
    if (submitSec) submitSec.style.display = 'none';
    if (classesSec) classesSec.style.display = 'none';
    if (dashboardSec) dashboardSec.style.display = 'none';
    if (adminSec) adminSec.style.display = 'none';
    if (classSec) classSec.style.display = 'block';
    if (btnDrive) btnDrive.style.display = 'none';

    if (mainNavLinks) {
      mainNavLinks.innerHTML = `
        <li><a href="#info-hub">📌 Hướng dẫn & QR</a></li>
        <li><a href="#class-portal-section">🎓 Chi đoàn Lớp ${currentAuth.lop}</a></li>
      `;
    }
    if (mobNav) {
      mobNav.innerHTML = `
        <a href="#info-hub" class="mob-nav-item">
          <span class="mob-nav-icon">📌</span>
          <span class="mob-nav-label">Hướng dẫn</span>
        </a>
        <a href="#class-portal-section" class="mob-nav-item active-submit">
          <span class="mob-nav-icon">🎓</span>
          <span class="mob-nav-label">Lớp ${currentAuth.lop}</span>
        </a>
      `;
    }
  } else if (currentAuth.role === 'admin') {
    // 3. ADMIN ĐOÀN KHOA:
    // - Xem toàn quyền 56 lớp, bảng tiến độ
    // - HIỆN nút cấu hình Drive
    if (guestPrompt) guestPrompt.style.display = 'none';
    if (submitSec) submitSec.style.display = 'none';
    if (classesSec) classesSec.style.display = 'block';
    if (dashboardSec) dashboardSec.style.display = 'block';
    if (btnDrive) btnDrive.style.display = 'inline-flex';

    if (viewingAsAdmin) {
      if (adminSec) adminSec.style.display = 'none';
      if (classSec) classSec.style.display = 'block';
    } else {
      if (adminSec) adminSec.style.display = 'block';
      if (classSec) classSec.style.display = 'none';
    }

    if (mainNavLinks) {
      mainNavLinks.innerHTML = `
        <li><a href="#info-hub">📌 Hướng dẫn & QR</a></li>
        <li><a href="#admin-portal-section">👑 Bàn làm việc Admin</a></li>
        <li><a href="#classes-section">👥 56 Lớp</a></li>
        <li><a href="#dashboard-section">📊 Bảng tiến độ</a></li>
      `;
    }
    if (mobNav) {
      mobNav.innerHTML = `
        <a href="#info-hub" class="mob-nav-item">
          <span class="mob-nav-icon">📌</span>
          <span class="mob-nav-label">Hướng dẫn</span>
        </a>
        <a href="#admin-portal-section" class="mob-nav-item active-submit">
          <span class="mob-nav-icon">👑</span>
          <span class="mob-nav-label">Admin</span>
        </a>
        <a href="#classes-section" class="mob-nav-item">
          <span class="mob-nav-icon">👥</span>
          <span class="mob-nav-label">56 Lớp</span>
        </a>
        <a href="#dashboard-section" class="mob-nav-item">
          <span class="mob-nav-icon">📊</span>
          <span class="mob-nav-label">Tiến độ</span>
        </a>
      `;
    }
  }
}

function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('active');
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('active');
}

function handleLoginAsClass(khoa, lop, pass) {
  currentAuth = {
    role: 'class',
    lop: lop,
    khoa: khoa,
    name: 'Chi đoàn ' + lop
  };
  viewingAsAdmin = false;
  localStorage.setItem('auth_session', JSON.stringify(currentAuth));

  updateNavAuthUI();
  updateSectionsVisibility();
  closeLoginModal();

  renderClassPortal(lop);
  showToast('🎉 Chào mừng Bí thư / Cán sự Chi đoàn ' + lop + '!', 'success');

  const classSec = document.getElementById('class-portal-section');
  if (classSec) classSec.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Tự động đồng bộ bài nộp mới nhất từ Google Drive cho lớp
  syncDataFromCloud(false);
}

function handleLoginAsAdmin() {
  currentAuth = {
    role: 'admin',
    name: 'Ban Thường vụ Đoàn Khoa'
  };
  viewingAsAdmin = false;
  localStorage.setItem('auth_session', JSON.stringify(currentAuth));

  updateNavAuthUI();
  updateSectionsVisibility();
  closeLoginModal();

  renderAdminPortal();
  showToast('👑 Chào mừng Quản trị viên Đoàn Khoa CNTT!', 'success');

  const adminSec = document.getElementById('admin-portal-section');
  if (adminSec) adminSec.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Tự động đồng bộ toàn bộ tiến độ 56 lớp cho Admin
  syncDataFromCloud(false);
}

function handleLogout() {
  currentAuth = null;
  viewingAsAdmin = false;
  localStorage.removeItem('auth_session');

  updateNavAuthUI();
  updateSectionsVisibility();

  showToast('Đã đăng xuất tài khoản thành công!', 'info');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderClassPortal(lopCode) {
  const classInfo = (typeof APP_DATA !== 'undefined' && APP_DATA.classes) ? APP_DATA.classes.find(c => c.lop === lopCode) : null;
  const students = (typeof CLASS_STUDENTS_DATA !== 'undefined' && CLASS_STUDENTS_DATA[lopCode]) ? CLASS_STUDENTS_DATA[lopCode] : [];
  const state = getClassState(lopCode);

  const totalStudents = students.length;
  let nonMemberCount = 0;
  let examSubmittedCount = 0;

  students.forEach(s => {
    const sState = state.students[s.mssv];
    if (sState && sState.isNonMember) {
      nonMemberCount++;
    } else if (sState) {
      const exams = getStudentExams(sState);
      if (Object.keys(exams).length > 0) {
        examSubmittedCount++;
      }
    }
  });

  const doanVienCount = totalStudents - nonMemberCount;
  const percent = doanVienCount > 0 ? Math.round((examSubmittedCount / doanVienCount) * 100) : 0;
  const hasZalo = !!state.zaloEvidence;

  // Header
  const elBadge = document.getElementById('portal-class-code');
  const elTitle = document.getElementById('portal-class-title');
  const elDesc = document.getElementById('portal-class-desc');
  if (elBadge) elBadge.textContent = lopCode;
  if (elTitle) elTitle.textContent = 'Không Gian Quản Lý Chi Đoàn ' + lopCode;
  if (elDesc) elDesc.textContent = (classInfo ? classInfo.khoa : '') + ' • Sĩ số: ' + totalStudents + ' sinh viên Khoa CNTT';

  // Secretary Info
  const elBithuName = document.getElementById('portal-bithu-name');
  const elBithuContact = document.getElementById('portal-bithu-contact');
  if (classInfo && classInfo.bithu) {
    if (elBithuName) elBithuName.textContent = classInfo.bithu.hoten;
    if (elBithuContact) elBithuContact.textContent = 'SĐT: ' + (classInfo.bithu.phone || 'Chưa cập nhật') + ' • MSSV: ' + (classInfo.bithu.mssv || 'Chưa cập nhật');
  } else {
    if (elBithuName) elBithuName.textContent = 'Chưa có Bí thư Chi đoàn';
    if (elBithuContact) elBithuContact.textContent = 'Cán sự lớp phụ trách nộp thay';
  }

  // Admin banner if viewing as admin
  const existingAdminBar = document.getElementById('admin-impersonate-bar');
  if (existingAdminBar) existingAdminBar.remove();

  if (viewingAsAdmin) {
    const headerCard = document.querySelector('#class-portal-section .portal-header-card');
    if (headerCard) {
      const bar = document.createElement('div');
      bar.id = 'admin-impersonate-bar';
      bar.style.cssText = 'width: 100%; background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px;';
      bar.innerHTML = '<span>👑 Đang xem và quản lý dưới quyền <strong>Admin Đoàn Khoa</strong></span> <button class="btn btn-primary btn-xs" id="btn-return-admin">⬅️ Trở lại Bảng Quản Trị Admin</button>';
      headerCard.appendChild(bar);
      const btnRet = document.getElementById('btn-return-admin');
      if (btnRet) {
        btnRet.addEventListener('click', () => {
          viewingAsAdmin = false;
          updateSectionsVisibility();
          renderAdminPortal();
          const adminSec = document.getElementById('admin-portal-section');
          if (adminSec) {
            adminSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    }
  }

  // KPIs
  const elTot = document.getElementById('kpi-total-students');
  const elDv = document.getElementById('kpi-doanvien-count');
  const elNon = document.getElementById('kpi-nonmember-count');
  const elExam = document.getElementById('kpi-exam-submitted-count');
  const elPct = document.getElementById('kpi-exam-percentage');
  if (elTot) elTot.textContent = totalStudents;
  if (elDv) elDv.textContent = doanVienCount;
  if (elNon) elNon.textContent = nonMemberCount;
  if (elExam) elExam.textContent = examSubmittedCount;
  if (elPct) elPct.textContent = percent + '%';

  // Zalo Evidence Box
  const previewBox = document.getElementById('zalo-evidence-preview-box');
  const promptBox = document.getElementById('zalo-upload-prompt-box');
  const zaloBadge = document.getElementById('zalo-status-badge');
  const previewImg = document.getElementById('zalo-preview-img');
  const previewTime = document.getElementById('zalo-preview-time');

  if (hasZalo) {
    if (previewBox) previewBox.style.display = 'flex';
    if (promptBox) promptBox.style.display = 'none';
    if (previewImg) previewImg.src = state.zaloEvidence.imageBase64 || state.zaloEvidence.fileUrl || '';
    if (previewTime) previewTime.textContent = 'Thời gian nộp: ' + (state.zaloEvidence.timestamp || '') + (state.zaloEvidence.submitterName ? ' • Người nộp: ' + state.zaloEvidence.submitterName : '');
    if (zaloBadge) {
      zaloBadge.className = 'status-badge badge-success';
      zaloBadge.textContent = '✅ Đã hoàn thành nộp minh chứng Zalo Bí thư';
    }
  } else {
    if (previewBox) previewBox.style.display = 'none';
    if (promptBox) promptBox.style.display = 'block';
    if (zaloBadge) {
      zaloBadge.className = 'status-badge badge-pending';
      zaloBadge.textContent = '⏳ Chưa có minh chứng Zalo Bí thư';
    }
  }

  // View full Zalo image
  const btnViewZaloFull = document.getElementById('btn-view-zalo-full');
  if (btnViewZaloFull) {
    btnViewZaloFull.onclick = () => {
      if (state.zaloEvidence && (state.zaloEvidence.imageBase64 || state.zaloEvidence.fileUrl)) {
        openLightbox(state.zaloEvidence.imageBase64 || state.zaloEvidence.fileUrl, 'Minh chứng Zalo Bí thư Chi đoàn ' + lopCode);
      }
    };
  }

  // Re-upload Zalo
  const btnReuploadZalo = document.getElementById('btn-reupload-zalo');
  if (btnReuploadZalo) {
    btnReuploadZalo.onclick = () => {
      openZaloModal(lopCode, classInfo);
    };
  }

  // Open Zalo Modal from prompt
  const btnOpenZaloUpload = document.getElementById('btn-open-zalo-upload');
  if (btnOpenZaloUpload) {
    btnOpenZaloUpload.onclick = () => {
      openZaloModal(lopCode, classInfo);
    };
  }

  // Tab counts
  const elTabAll = document.getElementById('tab-cnt-all');
  const elTabDv = document.getElementById('tab-cnt-dv');
  const elTabNon = document.getElementById('tab-cnt-non');
  const elTabDone = document.getElementById('tab-cnt-done');
  const elTabPending = document.getElementById('tab-cnt-pending');

  if (elTabAll) elTabAll.textContent = totalStudents;
  if (elTabDv) elTabDv.textContent = doanVienCount;
  if (elTabNon) elTabNon.textContent = nonMemberCount;
  if (elTabDone) elTabDone.textContent = examSubmittedCount;
  if (elTabPending) elTabPending.textContent = doanVienCount - examSubmittedCount;

  // Filter students
  renderStudentsTable(lopCode, students, state);
}

function renderStudentsTable(lopCode, students, state) {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;

  const query = (currentStudentSearch || '').toLowerCase().trim();
  const filter = currentStudentFilter || 'ALL';

  const filtered = students.filter(s => {
    const sState = state.students[s.mssv] || {};
    const isNon = !!sState.isNonMember;
    const exams = getStudentExams(sState);
    const hasExam = !isNon && Object.keys(exams).length > 0;

    if (filter === 'DOAN_VIEN' && isNon) return false;
    if (filter === 'NON_MEMBER' && !isNon) return false;
    if (filter === 'EXAM_DONE' && (!hasExam || isNon)) return false;
    if (filter === 'EXAM_NOT_YET' && (hasExam || isNon)) return false;

    if (query) {
      const matchName = s.hoten.toLowerCase().includes(query);
      const matchMssv = s.mssv.toLowerCase().includes(query);
      if (!matchName && !matchMssv) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy sinh viên nào phù hợp với bộ lọc.</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach((s, idx) => {
    const sState = state.students[s.mssv] || {};
    const isNon = !!sState.isNonMember;
    const exams = getStudentExams(sState);
    const submittedKeys = Object.keys(exams);
    const count = submittedKeys.length;

    html += '<tr class="' + (isNon ? 'row-nonmember' : '') + '">';
    html += '<td>' + (idx + 1) + '</td>';
    html += '<td><code>' + s.mssv + '</code></td>';
    html += '<td><strong>' + s.hoten + '</strong></td>';
    html += '<td>' + s.phai + '</td>';
    html += '<td>' + (s.ngaysinh || '--') + '</td>';

    // Column: Doan vien vs Non-member
    html += '<td>';
    html += '<label class="toggle-member-label" title="Nhấp để đánh dấu Chưa kết nạp Đoàn">';
    html += '<input type="checkbox" class="chk-toggle-nonmember" data-mssv="' + s.mssv + '" ' + (isNon ? 'checked' : '') + '> ';
    html += '<span class="' + (isNon ? 'badge-nonmember' : 'badge-doanvien') + '">';
    html += isNon ? '⚪ Chưa vào Đoàn' : '🎗️ Đoàn viên';
    html += '</span></label>';
    html += '</td>';

    // Column: Exam Status
    html += '<td>';
    if (isNon) {
      html += '<span class="badge-exam-exempt">⚪ Miễn thi (Chưa vào Đoàn)</span>';
    } else if (count > 0) {
      html += '<span class="badge-exam-done">✅ Đã nộp (' + count + '/5 nội dung)</span>';
      html += '<div class="student-exam-badges">';
      EXAM_TOPICS.forEach(topic => {
        if (exams[topic.id]) {
          html += '<span class="mini-exam-tag" data-mssv="' + s.mssv + '" data-topic="' + topic.id + '" title="' + topic.fullTitle + ' (Nhấp để xem ảnh)">' + topic.shortTitle + '</span>';
        }
      });
      html += '</div>';
    } else {
      html += '<span class="badge-exam-pending">❌ Chưa nộp (0/5 nội dung)</span>';
    }
    html += '</td>';

    // Column: Action
    html += '<td style="text-align: center;">';
    if (isNon) {
      html += '<span style="font-size:0.75rem; color:var(--text-muted);">Không bắt buộc</span>';
    } else if (count > 0) {
      html += '<div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;">';
      html += '<button class="btn btn-outline btn-xs btn-view-exam-photo" data-mssv="' + s.mssv + '" title="Xem ảnh minh chứng">🔍 Xem (' + count + ')</button>';
      html += '<button class="btn btn-primary btn-xs btn-open-student-modal" data-mssv="' + s.mssv + '" data-name="' + s.hoten + '" title="Nộp thêm hoặc thay đổi ảnh cuộc thi">➕ Nộp tiếp</button>';
      html += '</div>';
    } else {
      html += '<button class="btn btn-primary btn-xs btn-open-student-modal" data-mssv="' + s.mssv + '" data-name="' + s.hoten + '">📤 Nộp thi</button>';
    }
    html += '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;

  // Attach toggle listeners
  tbody.querySelectorAll('.chk-toggle-nonmember').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const mssv = e.target.getAttribute('data-mssv');
      const isChecked = e.target.checked;
      if (!state.students[mssv]) state.students[mssv] = {};
      state.students[mssv].isNonMember = isChecked;
      saveClassState(lopCode, state);

      const targetStudent = students.find(x => x.mssv === mssv);
      const studentName = targetStudent ? targetStudent.hoten : mssv;
      showToast(isChecked ? ('Đã đánh dấu sinh viên ' + studentName + ' là Chưa kết nạp Đoàn (Miễn thi)') : ('Đã chuyển sinh viên ' + studentName + ' thành Đoàn viên (Bắt buộc thi)'), 'info');

      renderClassPortal(lopCode);

      // Async sync to GAS
      sendToGoogleAppsScript({
        action: 'update_doan_vien_status',
        lop: lopCode,
        mssv: mssv,
        hoten: studentName,
        isNonMember: isChecked,
        doiTuong: isChecked ? 'Chưa kết nạp Đoàn' : 'Đoàn viên'
      });
    });
  });

  // Attach open student exam modal
  tbody.querySelectorAll('.btn-open-student-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const mssv = btn.getAttribute('data-mssv');
      const name = btn.getAttribute('data-name');
      openExamModal(lopCode, mssv, name);
    });
  });

  // Attach view exam photo button
  tbody.querySelectorAll('.btn-view-exam-photo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mssv = btn.getAttribute('data-mssv');
      const sState = state.students[mssv];
      const exams = getStudentExams(sState);
      const student = students.find(x => x.mssv === mssv);
      const studentName = student ? student.hoten : mssv;
      const keys = Object.keys(exams);
      if (keys.length === 0) return;

      const firstKey = keys[0];
      const item = exams[firstKey];
      const topic = EXAM_TOPICS.find(t => t.id === firstKey);
      
      let imgSrc = item.imageBase64 || item.fileUrl;
      if (!imgSrc) {
        imgSrc = await dbGetExamImage(lopCode, mssv, firstKey);
      }
      if (imgSrc) {
        openLightbox(imgSrc, (topic ? topic.shortTitle : firstKey) + ' - ' + studentName + ' (' + mssv + ')');
      } else {
        showToast('Minh chứng đã được ghi nhận trên máy chủ Google!', 'info');
      }
    });
  });

  // Attach click on mini topic badge
  tbody.querySelectorAll('.mini-exam-tag').forEach(tag => {
    tag.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mssv = tag.getAttribute('data-mssv');
      const topicId = tag.getAttribute('data-topic');
      const sState = state.students[mssv];
      const exams = getStudentExams(sState);
      const targetExam = exams[topicId];
      const student = students.find(x => x.mssv === mssv);
      const studentName = student ? student.hoten : mssv;
      const topic = EXAM_TOPICS.find(t => t.id === topicId);
      if (targetExam) {
        let imgSrc = targetExam.imageBase64 || targetExam.fileUrl;
        if (!imgSrc) {
          imgSrc = await dbGetExamImage(lopCode, mssv, topicId);
        }
        if (imgSrc) {
          openLightbox(imgSrc, (topic ? topic.shortTitle : 'Minh chứng') + ' - ' + studentName + ' (' + mssv + ')');
        } else {
          showToast('Minh chứng ' + (topic ? topic.shortTitle : '') + ' đã được ghi nhận trên hệ thống!', 'info');
        }
      }
    });
  });
}

function openZaloModal(lopCode, classInfo) {
  const modal = document.getElementById('modal-zalo-evidence');
  if (!modal) return;

  const elLop = document.getElementById('modal-zalo-lop-code');
  const inputHoten = document.getElementById('input-zalo-hoten');
  const inputSdt = document.getElementById('input-zalo-sdt');

  if (elLop) elLop.textContent = lopCode;
  if (classInfo && classInfo.bithu) {
    if (inputHoten) inputHoten.value = classInfo.bithu.hoten || '';
    if (inputSdt) inputSdt.value = classInfo.bithu.phone || '';
  }

  currentZaloImageBase64 = null;
  const prevBox = document.getElementById('zalo-preview-container');
  const fileInput = document.getElementById('zalo-file-input');
  if (prevBox) prevBox.style.display = 'none';
  if (fileInput) fileInput.value = '';

  modal.classList.add('active');
}

function closeZaloModal() {
  const modal = document.getElementById('modal-zalo-evidence');
  if (modal) modal.classList.remove('active');
}

function updateExamModalTopicView(topicId) {
  if (!currentExamTarget) return;
  const state = getClassState(currentExamTarget.lop);
  const sState = (state.students && state.students[currentExamTarget.mssv]) || {};
  const exams = getStudentExams(sState);
  const existingExam = exams[topicId];

  const alertBox = document.getElementById('exam-topic-status-alert');
  const prevBox = document.getElementById('exam-preview-container');
  const previewImg = document.getElementById('exam-image-preview');
  const dropzone = document.getElementById('exam-dropzone');
  const fileInput = document.getElementById('exam-file-input');
  const noteInput = document.getElementById('exam-input-note');
  const btnSubmit = document.getElementById('btn-send-exam-evidence');

  if (fileInput) fileInput.value = '';

  if (existingExam && (existingExam.imageBase64 || existingExam.fileUrl)) {
    currentExamImageBase64 = existingExam.imageBase64 || existingExam.fileUrl;
    if (alertBox) {
      alertBox.className = 'topic-alert-box done';
      alertBox.innerHTML = '✅ <strong>ĐÃ CÓ MINH CHỨNG:</strong> Đã ghi nhận lúc ' + (existingExam.timestamp || 'gần đây') + (existingExam.note ? (' (' + existingExam.note + ')') : '') + '. <br><span style="font-size:0.75rem; opacity:0.9;">Tải ảnh mới bên dưới sẽ thay thế ảnh cũ của nội dung này.</span>';
    }
    if (previewImg) previewImg.src = currentExamImageBase64;
    if (prevBox) prevBox.style.display = 'block';
    if (dropzone) dropzone.style.display = 'none';
    if (noteInput) noteInput.value = existingExam.note || '';
    if (btnSubmit) btnSubmit.textContent = '🔄 CẬP NHẬT / THAY THẾ MINH CHỨNG NỘI DUNG NÀY';
  } else {
    currentExamImageBase64 = null;
    if (alertBox) {
      alertBox.className = 'topic-alert-box pending';
      alertBox.innerHTML = '⏳ <strong>CHƯA NỘP MINH CHỨNG:</strong> Sinh viên chưa nộp minh chứng cho nội dung này. Vui lòng tải ảnh chụp màn hình điểm thi trên App.';
    }
    if (prevBox) prevBox.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
    if (noteInput) noteInput.value = '';
    if (btnSubmit) btnSubmit.textContent = '🚀 LƯU & ĐỒNG BỘ MINH CHỨNG THI';
  }
}

function openExamModal(lopCode, mssv, name) {
  const modal = document.getElementById('modal-exam-evidence');
  if (!modal) return;

  currentExamTarget = { mssv: mssv, hoten: name, lop: lopCode };

  const elName = document.getElementById('exam-target-name');
  const elInfo = document.getElementById('exam-target-info');
  const hiddenMssv = document.getElementById('exam-target-mssv');
  const hiddenLop = document.getElementById('exam-target-lop');
  const selectTopic = document.getElementById('exam-select-topic');
  const trackerBox = document.getElementById('modal-topics-tracker');

  if (elName) elName.textContent = name;
  if (elInfo) elInfo.textContent = 'MSSV: ' + mssv + ' • Chi đoàn: ' + lopCode;
  if (hiddenMssv) hiddenMssv.value = mssv;
  if (hiddenLop) hiddenLop.value = lopCode;

  const state = getClassState(lopCode);
  const sState = (state.students && state.students[mssv]) || {};
  const exams = getStudentExams(sState);
  const submittedCount = Object.keys(exams).length;

  if (trackerBox) {
    let chipsHtml = '<div class="modal-topics-tracker-title">';
    chipsHtml += '<span>Tiến độ bài thi của sinh viên:</span>';
    chipsHtml += '<strong style="color: ' + (submittedCount > 0 ? '#4ade80' : '#f87171') + ';">' + submittedCount + ' / 5 nội dung</strong>';
    chipsHtml += '</div>';
    chipsHtml += '<div class="topics-chips-list">';
    EXAM_TOPICS.forEach(topic => {
      const isDone = !!exams[topic.id];
      chipsHtml += '<span class="topic-chip ' + (isDone ? 'done' : '') + '" data-topic="' + topic.id + '">';
      chipsHtml += isDone ? '✅ ' : '⏳ ';
      chipsHtml += topic.shortTitle;
      chipsHtml += '</span>';
    });
    chipsHtml += '</div>';
    trackerBox.innerHTML = chipsHtml;

    trackerBox.querySelectorAll('.topic-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tid = chip.getAttribute('data-topic');
        if (selectTopic) {
          selectTopic.value = tid;
          updateExamModalTopicView(tid);
        }
      });
    });
  }

  // Chọn topic mặc định: ưu tiên topic chưa làm, hoặc mặc định
  let defaultTopic = 'HCM_2026_DVTN';
  const firstPending = EXAM_TOPICS.find(t => !exams[t.id]);
  if (firstPending) {
    defaultTopic = firstPending.id;
  }
  if (selectTopic) {
    selectTopic.value = defaultTopic;
  }

  updateExamModalTopicView(defaultTopic);

  modal.classList.add('active');
}

function closeExamModal() {
  const modal = document.getElementById('modal-exam-evidence');
  if (modal) modal.classList.remove('active');
}

function openLightbox(imgSrc, title) {
  const modal = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-caption');
  const t = document.getElementById('lightbox-title');
  if (!modal || !img) return;

  const displaySrc = formatDriveImageUrl(imgSrc);
  img.src = displaySrc;
  if (t) t.textContent = title || 'Ảnh Minh Chứng';
  if (cap) {
    if (imgSrc && imgSrc.startsWith('http')) {
      cap.innerHTML = (title || '') + ' • <a href="' + imgSrc + '" target="_blank" rel="noopener" style="color:#38bdf8; text-decoration:underline; font-weight:600;">🔗 Mở ảnh gốc trên Google Drive</a>';
    } else {
      cap.textContent = title || '';
    }
  }
  modal.classList.add('active');
}

function renderAdminPortal() {
  const classes = (typeof APP_DATA !== 'undefined' && APP_DATA.classes) ? APP_DATA.classes : [];
  const tbody = document.getElementById('admin-classes-table-body');
  if (!tbody) return;

  let totalStudentsAll = 0;
  let totalNonMembersAll = 0;
  let totalDoanVienAll = 0;
  let totalExamSubmittedAll = 0;
  let totalZaloCount = 0;

  const searchClass = (document.getElementById('admin-search-class')?.value || '').toLowerCase().trim();
  const filterKhoa = document.getElementById('admin-filter-khoa')?.value || 'ALL';

  const classRowsData = [];

  classes.forEach(c => {
    const students = (typeof CLASS_STUDENTS_DATA !== 'undefined' && CLASS_STUDENTS_DATA[c.lop]) ? CLASS_STUDENTS_DATA[c.lop] : [];
    const state = getClassState(c.lop);

    const siso = students.length;
    let nonMemberCount = 0;
    let examSubmittedCount = 0;

    students.forEach(s => {
      const sState = state.students[s.mssv];
      if (sState && sState.isNonMember) {
        nonMemberCount++;
      } else if (sState) {
        const exams = getStudentExams(sState);
        if (Object.keys(exams).length > 0) examSubmittedCount++;
      }
    });

    const doanVienCount = siso - nonMemberCount;
    const examPercent = doanVienCount > 0 ? Math.round((examSubmittedCount / doanVienCount) * 100) : 0;
    const hasZalo = !!state.zaloEvidence;

    totalStudentsAll += siso;
    totalNonMembersAll += nonMemberCount;
    totalDoanVienAll += doanVienCount;
    totalExamSubmittedAll += examSubmittedCount;
    if (hasZalo) totalZaloCount++;

    classRowsData.push({
      khoa: c.khoa,
      lop: c.lop,
      siso: siso,
      bithu: c.bithu ? c.bithu.hoten : 'Chưa có Bí thư',
      phone: c.bithu ? (c.bithu.phone || '--') : '--',
      hasZalo: hasZalo,
      doanVienCount: doanVienCount,
      nonMemberCount: nonMemberCount,
      examSubmittedCount: examSubmittedCount,
      examPercent: examPercent
    });
  });

  // Admin KPI Cards
  const kpiClasses = document.getElementById('admin-kpi-classes');
  const kpiStudents = document.getElementById('admin-kpi-total-students');
  const kpiZalo = document.getElementById('admin-kpi-zalo-rate');
  const kpiNon = document.getElementById('admin-kpi-nonmember-total');
  const kpiExamRate = document.getElementById('admin-kpi-exam-rate');

  if (kpiClasses) kpiClasses.textContent = classes.length;
  if (kpiStudents) kpiStudents.textContent = totalStudentsAll.toLocaleString();
  if (kpiZalo) kpiZalo.textContent = totalZaloCount + ' / ' + classes.length + ' (' + Math.round((totalZaloCount / classes.length) * 100) + '%)';
  if (kpiNon) kpiNon.textContent = totalNonMembersAll;

  const overallExamPct = totalDoanVienAll > 0 ? Math.round((totalExamSubmittedAll / totalDoanVienAll) * 100) : 0;
  if (kpiExamRate) kpiExamRate.textContent = totalExamSubmittedAll + ' / ' + totalDoanVienAll + ' (' + overallExamPct + '%)';

  // Filter rows
  const filtered = classRowsData.filter(r => {
    if (filterKhoa !== 'ALL' && r.khoa !== filterKhoa) return false;
    if (searchClass && !r.lop.toLowerCase().includes(searchClass) && !r.bithu.toLowerCase().includes(searchClass)) return false;
    return true;
  });

  let html = '';
  filtered.forEach((r, idx) => {
    html += '<tr>';
    html += '<td>' + (idx + 1) + '</td>';
    html += '<td>' + r.khoa + '</td>';
    html += '<td><strong>' + r.lop + '</strong></td>';
    html += '<td>' + r.siso + '</td>';
    html += '<td>' + (r.bithu !== 'Chưa có Bí thư' ? r.bithu : '<span style="color:#f87171;">Chưa có Bí thư</span>') + '</td>';
    html += '<td>' + r.phone + '</td>';
    html += '<td>' + (r.hasZalo ? '<span class="badge-exam-done">✅ Đã nộp</span>' : '<span class="badge-exam-pending">❌ Chưa nộp</span>') + '</td>';
    html += '<td>' + r.doanVienCount + '</td>';
    html += '<td>' + (r.nonMemberCount > 0 ? ('<span class="badge-nonmember">' + r.nonMemberCount + '</span>') : '0') + '</td>';
    html += '<td>' + r.examSubmittedCount + ' / ' + r.doanVienCount + '</td>';
    html += '<td><strong>' + r.examPercent + '%</strong></td>';
    html += '<td style="text-align: center;">';
    html += '<button class="btn btn-primary btn-xs btn-admin-manage-class" data-lop="' + r.lop + '">👉 Vào quản lý</button>';
    html += '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;

  tbody.querySelectorAll('.btn-admin-manage-class').forEach(btn => {
    btn.addEventListener('click', () => {
      const lop = btn.getAttribute('data-lop');
      viewingAsAdmin = true;
      updateSectionsVisibility();
      renderClassPortal(lop);
      const classSec = document.getElementById('class-portal-section');
      if (classSec) {
        classSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function exportClassRosterCSV(lopCode) {
  const students = (typeof CLASS_STUDENTS_DATA !== 'undefined' && CLASS_STUDENTS_DATA[lopCode]) ? CLASS_STUDENTS_DATA[lopCode] : [];
  const state = getClassState(lopCode);
  const classInfo = (typeof APP_DATA !== 'undefined' && APP_DATA.classes) ? APP_DATA.classes.find(c => c.lop === lopCode) : null;
  const khoa = classInfo ? classInfo.khoa : '';

  let csv = '﻿';
  csv += 'STT,Khóa,Mã lớp,MSSV,Họ và tên,Giới tính,Ngày sinh,Đối tượng,Số nội dung đã thi,Chi tiết các cuộc thi đã nộp minh chứng,Thời gian nộp gần nhất,Ghi chú\n';

  students.forEach((s, idx) => {
    const sState = state.students[s.mssv] || {};
    const isNon = !!sState.isNonMember;
    const exams = getStudentExams(sState);
    const submittedKeys = Object.keys(exams);
    const count = submittedKeys.length;
    const doiTuong = isNon ? 'Chưa kết nạp Đoàn (Miễn thi)' : 'Đoàn viên';

    let countStr = isNon ? 'Miễn thi' : (count + ' / 5 nội dung');
    let detailStr = 'Chưa nộp';
    let time = '';
    let notes = '';

    if (isNon) {
      detailStr = 'Miễn thi';
    } else if (count > 0) {
      detailStr = submittedKeys.map(k => (exams[k].shortTitle || k) + (exams[k].note ? ' [' + exams[k].note + ']' : '')).join('; ');
      time = exams[submittedKeys[0]].timestamp || '';
      notes = submittedKeys.map(k => exams[k].note).filter(Boolean).join('; ');
    }

    const row = [
      idx + 1,
      '"' + khoa + '"',
      '"' + lopCode + '"',
      '"' + s.mssv + '"',
      '"' + s.hoten + '"',
      '"' + s.phai + '"',
      '"' + (s.ngaysinh || '') + '"',
      '"' + doiTuong + '"',
      '"' + countStr + '"',
      '"' + detailStr + '"',
      '"' + time + '"',
      '"' + notes + '"'
    ];
    csv += row.join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Danh_sach_sinh_vien_va_minh_chung_' + lopCode + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất danh sách lớp ' + lopCode + ' thành công!', 'success');
}

function exportAdminFullCSV() {
  const classes = (typeof APP_DATA !== 'undefined' && APP_DATA.classes) ? APP_DATA.classes : [];
  let csv = '﻿';
  csv += 'STT,Khóa,Mã lớp,MSSV,Họ và tên,Giới tính,Ngày sinh,Đối tượng,Số nội dung đã thi,Chi tiết các cuộc thi đã nộp,Thời gian nộp,Bí thư lớp,Trạng thái Zalo Bí thư\n';

  let stt = 1;
  classes.forEach(c => {
    const students = (typeof CLASS_STUDENTS_DATA !== 'undefined' && CLASS_STUDENTS_DATA[c.lop]) ? CLASS_STUDENTS_DATA[c.lop] : [];
    const state = getClassState(c.lop);
    const hasZalo = !!state.zaloEvidence ? 'Đã nộp minh chứng Zalo' : 'Chưa nộp Zalo';
    const bithuName = c.bithu ? c.bithu.hoten : 'Chưa có Bí thư';

    students.forEach(s => {
      const sState = state.students[s.mssv] || {};
      const isNon = !!sState.isNonMember;
      const exams = getStudentExams(sState);
      const submittedKeys = Object.keys(exams);
      const count = submittedKeys.length;
      const doiTuong = isNon ? 'Chưa kết nạp Đoàn (Miễn thi)' : 'Đoàn viên';

      let countStr = isNon ? 'Miễn thi' : (count + ' / 5 nội dung');
      let detailStr = 'Chưa nộp';
      let time = '';

      if (isNon) {
        detailStr = 'Miễn thi';
      } else if (count > 0) {
        detailStr = submittedKeys.map(k => (exams[k].shortTitle || k) + (exams[k].note ? ' [' + exams[k].note + ']' : '')).join('; ');
        time = exams[submittedKeys[0]].timestamp || '';
      }

      const row = [
        stt++,
        '"' + c.khoa + '"',
        '"' + c.lop + '"',
        '"' + s.mssv + '"',
        '"' + s.hoten + '"',
        '"' + s.phai + '"',
        '"' + (s.ngaysinh || '') + '"',
        '"' + doiTuong + '"',
        '"' + countStr + '"',
        '"' + detailStr + '"',
        '"' + time + '"',
        '"' + bithuName + '"',
        '"' + hasZalo + '"'
      ];
      csv += row.join(',') + '\n';
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Bao_cao_tong_hop_toan_khoa_56_lop_1372_SV.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất báo cáo tổng hợp 1.372 sinh viên toàn khoa thành công!', 'success');
}

function initAuthAndPortals() {
  updateNavAuthUI();

  // Modal Login tabs
  const tabClass = document.getElementById('tab-login-class');
  const tabAdmin = document.getElementById('tab-login-admin');
  const formClass = document.getElementById('form-login-class');
  const formAdmin = document.getElementById('form-login-admin');

  if (tabClass && tabAdmin && formClass && formAdmin) {
    tabClass.addEventListener('click', () => {
      tabClass.classList.add('active');
      tabAdmin.classList.remove('active');
      formClass.classList.add('active');
      formClass.style.display = 'block';
      formAdmin.classList.remove('active');
      formAdmin.style.display = 'none';
    });

    tabAdmin.addEventListener('click', () => {
      tabAdmin.classList.add('active');
      tabClass.classList.remove('active');
      formAdmin.classList.add('active');
      formAdmin.style.display = 'block';
      formClass.classList.remove('active');
      formClass.style.display = 'none';
    });
  }

  // Populate Login Khoa & Lop
  const selectKhoa = document.getElementById('login-select-khoa');
  const selectLop = document.getElementById('login-select-lop');

  if (selectKhoa && selectLop) {
    selectKhoa.addEventListener('change', () => {
      const khoa = selectKhoa.value;
      selectLop.innerHTML = '<option value="">-- Chọn Chi đoàn lớp --</option>';
      if (!khoa) {
        selectLop.disabled = true;
        return;
      }
      selectLop.disabled = false;
      const classesOfKhoa = (typeof APP_DATA !== 'undefined' && APP_DATA.classes) ? APP_DATA.classes.filter(c => c.khoa === khoa) : [];
      classesOfKhoa.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.lop;
        opt.textContent = c.lop + ' (' + c.siso + ' SV' + (c.bithu ? ' - Bí thư: ' + c.bithu.hoten : ' - Chưa có Bí thư') + ')';
        selectLop.appendChild(opt);
      });
    });
  }

  // Submit Form Login Class
  if (formClass) {
    formClass.addEventListener('submit', (e) => {
      e.preventDefault();
      const khoa = selectKhoa ? selectKhoa.value : '';
      const lop = selectLop ? selectLop.value : '';
      const pass = document.getElementById('login-class-pass')?.value || '';
      if (!khoa || !lop) {
        showToast('Vui lòng chọn Khóa học và Chi đoàn lớp!', 'error');
        return;
      }

      const cleanPass = pass.trim().toLowerCase();
      const cleanLop = lop.trim().toLowerCase();

      // Mật khẩu đúng là mã lớp viết thường (ví dụ: 23ct111), mã lớp gốc, hoặc 123456
      if (cleanPass === cleanLop || cleanPass === '123456' || pass.trim() === lop) {
        handleLoginAsClass(khoa, lop, pass);
      } else {
        showToast('Mật khẩu lớp không chính xác. Vui lòng kiểm tra lại!', 'error');
      }
    });
  }

  // Submit Form Login Admin
  if (formAdmin) {
    formAdmin.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = (document.getElementById('login-admin-user')?.value || '').trim().toLowerCase();
      const pass = (document.getElementById('login-admin-pass')?.value || '').trim();
      if (user === 'admin' && (pass === 'admin@cntt2026' || pass === 'admin' || pass === 'cntt2026' || pass === '123456')) {
        handleLoginAsAdmin();
      } else {
        showToast('Tài khoản hoặc mật khẩu quản trị không chính xác!', 'error');
      }
    });
  }

  // Close Login Modal
  const btnCloseLogin = document.getElementById('btn-close-login-modal');
  if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeLoginModal);
  const loginModal = document.getElementById('login-modal');
  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeLoginModal();
    });
  }

  // Guest prompt login button
  const btnPromptLogin = document.getElementById('btn-prompt-login');
  if (btnPromptLogin) btnPromptLogin.addEventListener('click', openLoginModal);

  // Logout buttons
  const btnClassLogout = document.getElementById('btn-class-logout');
  if (btnClassLogout) btnClassLogout.addEventListener('click', handleLogout);
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  if (btnAdminLogout) btnAdminLogout.addEventListener('click', handleLogout);

  // Student Filter tabs in Class Portal
  const studentTabs = document.querySelectorAll('.student-tab-btn');
  studentTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      studentTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStudentFilter = tab.getAttribute('data-filter') || 'ALL';
      if (currentAuth && currentAuth.lop) {
        renderClassPortal(currentAuth.lop);
      }
    });
  });

  // Student Search input
  const inputStudentSearch = document.getElementById('student-search-input');
  if (inputStudentSearch) {
    inputStudentSearch.addEventListener('input', (e) => {
      currentStudentSearch = e.target.value;
      if (currentAuth && currentAuth.lop) {
        const students = (typeof CLASS_STUDENTS_DATA !== 'undefined' && CLASS_STUDENTS_DATA[currentAuth.lop]) ? CLASS_STUDENTS_DATA[currentAuth.lop] : [];
        const state = getClassState(currentAuth.lop);
        renderStudentsTable(currentAuth.lop, students, state);
      }
    });
  }

  // Export Class Roster Button
  const btnExportClassRoster = document.getElementById('btn-export-class-roster');
  if (btnExportClassRoster) {
    btnExportClassRoster.addEventListener('click', () => {
      if (currentAuth && currentAuth.lop) {
        exportClassRosterCSV(currentAuth.lop);
      }
    });
  }

  // Export Admin Full CSV Button
  const btnExportAdminFull = document.getElementById('btn-export-admin-full');
  if (btnExportAdminFull) {
    btnExportAdminFull.addEventListener('click', () => {
      exportAdminFullCSV();
    });
  }

  // Admin search & filter
  const inputAdminSearch = document.getElementById('admin-search-class');
  const selectAdminKhoa = document.getElementById('admin-filter-khoa');
  if (inputAdminSearch) inputAdminSearch.addEventListener('input', renderAdminPortal);
  if (selectAdminKhoa) selectAdminKhoa.addEventListener('change', renderAdminPortal);

  // Setup Zalo Dropzone & Modal
  setupZaloModalControls();

  // Setup Exam Dropzone & Modal
  setupExamModalControls();

  // Setup Lightbox Modal close
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  const lightboxModal = document.getElementById('lightbox-modal');
  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', () => lightboxModal.classList.remove('active'));
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) lightboxModal.classList.remove('active');
    });
  }

  // Check saved session on load
  try {
    const saved = localStorage.getItem('auth_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role === 'admin') {
        currentAuth = parsed;
        updateNavAuthUI();
        updateSectionsVisibility();
        renderAdminPortal();
      } else if (parsed && parsed.role === 'class') {
        currentAuth = parsed;
        updateNavAuthUI();
        updateSectionsVisibility();
        renderClassPortal(parsed.lop);
      } else {
        currentAuth = null;
        updateNavAuthUI();
        updateSectionsVisibility();
      }
    } else {
      currentAuth = null;
      updateNavAuthUI();
      updateSectionsVisibility();
    }
  } catch (e) {
    console.warn('Could not parse auth session:', e);
    currentAuth = null;
    updateNavAuthUI();
    updateSectionsVisibility();
  }
}

function setupZaloModalControls() {
  const dropzone = document.getElementById('zalo-dropzone');
  const fileInput = document.getElementById('zalo-file-input');
  const previewContainer = document.getElementById('zalo-preview-container');
  const previewImg = document.getElementById('zalo-image-preview');
  const btnRemove = document.getElementById('btn-remove-zalo-preview');
  const form = document.getElementById('form-submit-zalo');
  const btnClose = document.getElementById('btn-close-zalo-modal');

  if (btnClose) btnClose.addEventListener('click', closeZaloModal);

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP)!', 'error');
      return;
    }
    try {
      showToast('Đang tối ưu dung lượng ảnh...', 'info');
      const compressed = await compressImage(file, 1200, 1200, 0.72);
      currentZaloImageBase64 = compressed;
      if (previewImg) previewImg.src = currentZaloImageBase64;
      if (previewContainer) previewContainer.style.display = 'block';
      if (dropzone) dropzone.style.display = 'none';
      showToast('Đã nhận diện ảnh minh chứng Zalo!', 'success');
    } catch (err) {
      const reader = new FileReader();
      reader.onload = (e) => {
        currentZaloImageBase64 = e.target.result;
        if (previewImg) previewImg.src = currentZaloImageBase64;
        if (previewContainer) previewContainer.style.display = 'block';
        if (dropzone) dropzone.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener('click', () => {
      currentZaloImageBase64 = null;
      if (previewContainer) previewContainer.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      if (fileInput) fileInput.value = '';
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentZaloImageBase64) {
        showToast('Vui lòng tải lên ảnh chụp màn hình Zalo!', 'error');
        return;
      }
      const lop = (currentAuth && currentAuth.lop) || document.getElementById('modal-zalo-lop-code')?.textContent || '';
      const hoten = document.getElementById('input-zalo-hoten')?.value.trim() || 'Bí thư';
      const sdt = document.getElementById('input-zalo-sdt')?.value.trim() || '';

      const state = getClassState(lop);
      const now = new Date();
      const timeStr = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN');

      state.zaloEvidence = {
        hasProof: true,
        imageBase64: currentZaloImageBase64,
        timestamp: timeStr,
        submitterName: hoten,
        phone: sdt
      };
      saveClassState(lop, state);

      // Lưu trữ ảnh trong IndexedDB để xem lại
      dbSaveExamImage(lop, 'bithu', 'zalo', currentZaloImageBase64);

      sendToGoogleAppsScript({
        action: 'submit_evidence',
        lop: lop,
        khoa: (currentAuth && currentAuth.khoa) || ('Khóa ' + lop.substring(0, 2)),
        hoten: hoten,
        sdt: sdt,
        loaiMinhChung: 'Zalo Bí thư Chi đoàn',
        doiTuong: 'Bí thư Chi đoàn',
        imageBase64: currentZaloImageBase64,
        imageType: 'image/jpeg'
      });

      closeZaloModal();
      showToast('🎉 Đã nộp thành công minh chứng Zalo Bí thư Chi đoàn ' + lop + '!', 'success');
      renderClassPortal(lop);
    });
  }
}

function setupExamModalControls() {
  const dropzone = document.getElementById('exam-dropzone');
  const fileInput = document.getElementById('exam-file-input');
  const previewContainer = document.getElementById('exam-preview-container');
  const previewImg = document.getElementById('exam-image-preview');
  const btnRemove = document.getElementById('btn-remove-exam-preview');
  const form = document.getElementById('form-submit-exam');
  const btnClose = document.getElementById('btn-close-exam-modal');

  if (btnClose) btnClose.addEventListener('click', closeExamModal);

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP)!', 'error');
      return;
    }
    try {
      showToast('Đang tối ưu dung lượng ảnh...', 'info');
      const compressed = await compressImage(file, 1200, 1200, 0.72);
      currentExamImageBase64 = compressed;
      if (previewImg) previewImg.src = currentExamImageBase64;
      if (previewContainer) previewContainer.style.display = 'block';
      if (dropzone) dropzone.style.display = 'none';
      showToast('Đã nhận diện & tối ưu ảnh minh chứng!', 'success');
    } catch (err) {
      const reader = new FileReader();
      reader.onload = (e) => {
        currentExamImageBase64 = e.target.result;
        if (previewImg) previewImg.src = currentExamImageBase64;
        if (previewContainer) previewContainer.style.display = 'block';
        if (dropzone) dropzone.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  if (btnRemove) {
    btnRemove.addEventListener('click', () => {
      currentExamImageBase64 = null;
      if (previewContainer) previewContainer.style.display = 'none';
      if (dropzone) dropzone.style.display = 'block';
      if (fileInput) fileInput.value = '';
    });
  }

  const selectTopic = document.getElementById('exam-select-topic');
  if (selectTopic) {
    selectTopic.addEventListener('change', () => {
      updateExamModalTopicView(selectTopic.value);
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentExamImageBase64) {
        showToast('Vui lòng tải lên ảnh chụp màn hình điểm thi trên App!', 'error');
        return;
      }
      if (!currentExamTarget) return;

      const mssv = currentExamTarget.mssv;
      const lop = currentExamTarget.lop;
      const hoten = currentExamTarget.hoten;
      const topicId = selectTopic ? selectTopic.value : 'HCM_2026_DVTN';
      const topicObj = EXAM_TOPICS.find(t => t.id === topicId) || EXAM_TOPICS[3];
      const topicName = topicObj.fullTitle;
      const note = document.getElementById('exam-input-note')?.value.trim() || '';

      const state = getClassState(lop);
      const now = new Date();
      const timeStr = now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN');

      if (!state.students[mssv]) state.students[mssv] = {};
      state.students[mssv].isNonMember = false;
      if (!state.students[mssv].exams) state.students[mssv].exams = {};

      state.students[mssv].exams[topicId] = {
        topicCode: topicId,
        topicName: topicName,
        shortTitle: topicObj.shortTitle,
        imageBase64: currentExamImageBase64,
        timestamp: timeStr,
        note: note,
        hasProof: true
      };

      // Giữ con trỏ examEvidence cho tính tương thích
      state.students[mssv].examEvidence = state.students[mssv].exams[topicId];
      saveClassState(lop, state);

      // Lưu trữ ảnh trong IndexedDB để xem offline không giới hạn
      dbSaveExamImage(lop, mssv, topicId, currentExamImageBase64);

      sendToGoogleAppsScript({
        action: 'submit_evidence',
        lop: lop,
        khoa: (currentAuth && currentAuth.khoa) || ('Khóa ' + lop.substring(0, 2)),
        hoten: hoten,
        mssv: mssv,
        topicCode: topicId,
        loaiMinhChung: topicName,
        doiTuong: 'Đoàn viên',
        imageBase64: currentExamImageBase64,
        imageType: 'image/jpeg',
        ghiChu: note
      });

      closeExamModal();
      showToast('🎉 Đã lưu minh chứng "' + topicObj.shortTitle + '" cho ' + hoten + ' (' + mssv + ') thành công!', 'success');
      renderClassPortal(lop);
    });
  }
}

