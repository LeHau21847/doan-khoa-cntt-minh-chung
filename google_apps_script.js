/**
 * ==============================================================================================
 * GOOGLE APPS SCRIPT - HỆ THỐNG LƯU TRỮ MINH CHỨNG THEO TỪNG LỚP TRÊN GOOGLE DRIVE & GOOGLE SHEET
 * ĐOÀN KHOA CÔNG NGHỆ THÔNG TIN - TRƯỜNG ĐẠI HỌC LẠC HỒNG (2026 - 2027)
 * ==============================================================================================
 * 
 * ĐẶC ĐIỂM NỔI BẬT:
 * 1. MIỄN PHÍ 100%: Dùng trực tiếp tài khoản Google Drive & Google Sheet.
 * 2. ĐỒNG BỘ 2 CHIỀU ĐA THIẾT BỊ: Máy tính, điện thoại, Admin hay Bí thư nộp ở đâu, tất cả thiết bị
 *    khác đều thấy ngay lập tức sau khi bấm Đồng bộ hoặc tải trang.
 * 3. TỰ ĐỘNG ĐIỀU HƯỚNG ẢNH: Sinh viên lớp nào nộp, ảnh tự động lưu vào đúng thư mục Google Drive của lớp đó.
 * 4. BẢO TỒN DỮ LIỆU ĐÃ NỘP 100%: Toàn bộ danh sách và ảnh đã nộp trước đó trong Google Sheet và Drive
 *    được giữ nguyên vẹn, không bao giờ bị ghi đè hay mất mát.
 * 
 * ==============================================================================================
 * HƯỚNG DẪN CẬP NHẬT TRÊN CỐC CỐC / CHROME (ĐÃ ĐĂNG NHẬP GOOGLE):
 * Bước 1: Mở dự án Google Apps Script của bạn (hoặc truy cập https://script.google.com).
 * Bước 2: Dán toàn bộ mã nguồn này thay thế mã cũ ➜ Bấm biểu tượng Lưu 💾 (Ctrl + S).
 * Bước 3: Bấm nút "Triển khai" (Deploy) ở góc trên bên phải:
 *         ➜ Chọn "Quản lý bản triển khai" (Manage deployments)
 *         ➜ Bấm biểu tượng cây bút chì ✏️ để chỉnh sửa bản triển khai hiện tại
 *         ➜ Chọn:
 *             - Phiên bản (Version): Chọn "Mới" (New)
 *             - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *             - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)  <--- BẮT BUỘC ĐỂ MÁY KHÁC ĐỒNG BỘ ĐƯỢC!
 *         ➜ Bấm nút "Triển khai" (Deploy).
 * ==============================================================================================
 */

// CẤU HÌNH HỆ THỐNG
var ROOT_FOLDER_NAME = "MINH_CHUNG_DOAN_KHOA_CNTT_2026";
var SPREADSHEET_NAME = "TongHop_MinhChung_ChiDoan_KhoaCNTT";

// DANH SÁCH 56 LỚP PHÂN THEO 4 KHÓA
var DANH_SACH_LOP = {
  "Khóa 23": ["23AI111", "23CT111", "23CT112", "23CT113", "23CT401", "23EC111", "23MC111"],
  "Khóa 24": ["24AG711", "24AG712", "24AI111", "24CT111", "24CT112", "24CT113", "24CT114", "24CT402", "24CT501", "24CT502", "24EC111", "24MC111", "24MC112"],
  "Khóa 25": ["25AG712", "25AI111", "25CT111", "25CT112", "25CT113", "25CT114", "25CT401", "25CT501", "25CT711", "25CT712", "25EC111", "25MC111", "25MC112", "25MC113"],
  "Khóa 26": ["26AG701", "26AI111", "26AT111", "26BE111", "26CT111", "26CT112", "26CT113", "26CT201", "26CT401", "26CT402", "26CT501", "26CT502", "26CT711", "26CT712", "26EC111", "26EC112", "26MC111", "26MC112", "26MC113", "26MC401", "26MC501", "26VT123"]
};

/**
 * HÀM KHỞI TẠO TỰ ĐỘNG: Tạo cấu trúc thư mục toàn bộ 56 lớp và Google Sheet
 */
function khoiTaoHeThong56Lop() {
  Logger.log("Bắt đầu khởi tạo hệ thống thư mục 56 lớp trên Google Drive...");
  
  var rootFolder = getOrCreateFolder(ROOT_FOLDER_NAME, DriveApp.getRootFolder());
  Logger.log("Thư mục gốc: " + rootFolder.getUrl());
  
  for (var khoa in DANH_SACH_LOP) {
    var khoaFolder = getOrCreateFolder(khoa, rootFolder);
    var dsLopCuaKhoa = DANH_SACH_LOP[khoa];
    
    for (var i = 0; i < dsLopCuaKhoa.length; i++) {
      var maLop = dsLopCuaKhoa[i];
      getOrCreateFolder(maLop, khoaFolder);
    }
    Logger.log("Đã tạo xong các thư mục lớp của " + khoa);
  }
  
  var ss = getOrCreateSpreadsheet(SPREADSHEET_NAME, rootFolder);
  Logger.log("Hoàn tất khởi tạo toàn bộ hệ thống! Sẵn sàng nhận minh chứng.");
  return "Đã tạo thành công thư mục 56 lớp trên Google Drive và Google Sheet!";
}

/**
 * XỬ LÝ GET: ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEET VỀ CÁC THIẾT BỊ / ADMIN
 * Hỗ trợ cả JSON và JSONP (callback) để tương thích 100% với tất cả trình duyệt và điện thoại.
 */
function doGet(e) {
  var callback = (e && e.parameter && e.parameter.callback) || "";
  var action = (e && e.parameter && e.parameter.action) || "get_all";

  try {
    if (action === "ping") {
      return respondJson({
        status: "online",
        message: "Hệ thống Google Drive & Sheets Khoa CNTT đang hoạt động tốt!",
        time: Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss")
      }, callback);
    }

    var rootFolder = getOrCreateFolder(ROOT_FOLDER_NAME, DriveApp.getRootFolder());
    var ss = getOrCreateSpreadsheet(SPREADSHEET_NAME, rootFolder);
    
    // 1. Đọc tất cả minh chứng đã nộp từ Sheet "Tất cả minh chứng"
    var submissions = [];
    var sheetData = ss.getSheetByName("Tất cả minh chứng");
    if (sheetData && sheetData.getLastRow() > 1) {
      var numRows = sheetData.getLastRow() - 1;
      var numCols = Math.max(sheetData.getLastColumn(), 13);
      var values = sheetData.getRange(2, 1, numRows, numCols).getValues();

      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        var timestamp = row[0];
        var khoa = row[1];
        var lop = row[2];
        var mssv = row[3];
        var hoten = row[4];
        var sdt = row[5];
        var loaiMinhChung = row[6];
        var doiTuong = row[7];
        var driveLinkCell = row[8];
        var folderLinkCell = row[9];
        var fileName = row[10];
        var directUrl = row[11];
        var ghiChu = row[12];

        // Lấy link ảnh xem trực tiếp
        var fileUrl = String(directUrl || "").trim();
        if (!fileUrl && typeof driveLinkCell === "string") {
          var match = driveLinkCell.match(/https:\/\/[^\s"\)]+/);
          if (match) fileUrl = match[0];
        }

        if (lop || mssv || hoten) {
          var timeStr = "";
          if (timestamp instanceof Date) {
            timeStr = Utilities.formatDate(timestamp, "GMT+7", "dd/MM/yyyy HH:mm:ss");
          } else {
            timeStr = String(timestamp || "");
          }

          submissions.push({
            timestamp: timeStr,
            khoa: String(khoa || ""),
            lop: String(lop || "").trim(),
            mssv: String(mssv || "").trim(),
            hoten: String(hoten || "").trim(),
            sdt: String(sdt || "").trim(),
            loaiMinhChung: String(loaiMinhChung || "").trim(),
            doiTuong: String(doiTuong || "").trim(),
            fileUrl: fileUrl,
            fileName: String(fileName || "").trim(),
            ghiChu: String(ghiChu || "").trim()
          });
        }
      }
    }

    // 2. Đọc danh sách Chưa kết nạp Đoàn (nếu có sheet TrangThai_DoanVien)
    var nonMembers = [];
    var sheetNM = ss.getSheetByName("TrangThai_DoanVien");
    if (sheetNM && sheetNM.getLastRow() > 1) {
      var nmValues = sheetNM.getRange(2, 1, sheetNM.getLastRow() - 1, 5).getValues();
      for (var j = 0; j < nmValues.length; j++) {
        var r = nmValues[j];
        var nmLop = String(r[1] || "").trim();
        var nmMssv = String(r[2] || "").trim();
        var statusStr = String(r[4] || "").toLowerCase();
        var isNon = (statusStr.indexOf("chưa") >= 0);
        if (nmLop && nmMssv) {
          nonMembers.push({
            lop: nmLop,
            mssv: nmMssv,
            isNonMember: isNon
          });
        }
      }
    }

    // 3. Đọc danh sách Sinh viên Admin đã thêm mới, sửa hoặc xóa (nếu có sheet QuanLy_SinhVien)
    var customStudents = { added: [], edited: [], deleted: [] };
    var sheetQL = ss.getSheetByName("QuanLy_SinhVien");
    if (sheetQL && sheetQL.getLastRow() > 1) {
      var qlValues = sheetQL.getRange(2, 1, sheetQL.getLastRow() - 1, 8).getValues();
      for (var m = 0; m < qlValues.length; m++) {
        var rowQL = qlValues[m];
        var qlLop = String(rowQL[1] || "").trim();
        var qlMssv = String(rowQL[2] || "").trim();
        var qlHoten = String(rowQL[3] || "").trim();
        var qlPhai = String(rowQL[4] || "").trim();
        var qlNgaysinh = String(rowQL[5] || "").trim();
        var qlDoiTuong = String(rowQL[6] || "").trim();
        var qlAction = String(rowQL[7] || "").trim().toUpperCase();

        if (qlLop && qlMssv) {
          if (qlAction === "THEM_MOI" || qlAction === "ADD") {
            customStudents.added.push({
              lop: qlLop,
              mssv: qlMssv,
              hoten: qlHoten,
              phai: qlPhai,
              ngaysinh: qlNgaysinh,
              isNonMember: (qlDoiTuong.toLowerCase().indexOf("chưa") >= 0)
            });
          } else if (qlAction === "CHINH_SUA" || qlAction === "EDIT") {
            customStudents.edited.push({
              lop: qlLop,
              mssv: qlMssv,
              hoten: qlHoten,
              phai: qlPhai,
              ngaysinh: qlNgaysinh,
              isNonMember: (qlDoiTuong.toLowerCase().indexOf("chưa") >= 0)
            });
          } else if (qlAction === "DA_XOA" || qlAction === "DELETE") {
            customStudents.deleted.push({
              lop: qlLop,
              mssv: qlMssv,
              hoten: qlHoten
            });
          }
        }
      }
    }

    return respondJson({
      status: "success",
      totalSubmissions: submissions.length,
      submissions: submissions,
      nonMembers: nonMembers,
      customStudents: customStudents,
      serverTime: Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss")
    }, callback);

  } catch (err) {
    return respondJson({
      status: "error",
      message: "Lỗi đồng bộ dữ liệu: " + err.toString()
    }, callback);
  }
}

/**
 * XỬ LÝ POST: TIẾP NHẬN BÀI NỘP VÀ LƯU VÀO GOOGLE DRIVE + GOOGLE SHEET
 */
function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    
    var rootFolder = getOrCreateFolder(ROOT_FOLDER_NAME, DriveApp.getRootFolder());
    var ss = getOrCreateSpreadsheet(SPREADSHEET_NAME, rootFolder);
    var nowFormatted = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");

    // TRƯỜNG HỢP 1: Cập nhật đối tượng Đoàn viên / Chưa kết nạp Đoàn
    if (data.action === "update_doan_vien_status") {
      var sheetNM = ss.getSheetByName("TrangThai_DoanVien");
      if (!sheetNM) {
        sheetNM = ss.insertSheet("TrangThai_DoanVien");
        sheetNM.appendRow(["Thời gian cập nhật", "Mã lớp", "MSSV", "Họ và tên", "Trạng thái đối tượng"]);
        sheetNM.getRange("A1:E1").setBackground("#38bdf8").setFontColor("#0f172a").setFontWeight("bold");
        sheetNM.setFrozenRows(1);
      }

      var targetLop = (data.lop || "").trim();
      var targetMssv = (data.mssv || "").trim();
      var targetHoten = (data.hoten || "").trim();
      var isNon = !!data.isNonMember;
      var statusText = isNon ? "Chưa kết nạp Đoàn" : "Đoàn viên";

      var foundRow = -1;
      if (sheetNM.getLastRow() > 1) {
        var existing = sheetNM.getRange(2, 2, sheetNM.getLastRow() - 1, 2).getValues();
        for (var k = 0; k < existing.length; k++) {
          if (String(existing[k][0]).trim() === targetLop && String(existing[k][1]).trim() === targetMssv) {
            foundRow = k + 2;
            break;
          }
        }
      }

      if (foundRow > 0) {
        sheetNM.getRange(foundRow, 1).setValue(nowFormatted);
        sheetNM.getRange(foundRow, 4).setValue(targetHoten);
        sheetNM.getRange(foundRow, 5).setValue(statusText);
      } else {
        sheetNM.appendRow([nowFormatted, targetLop, targetMssv, targetHoten, statusText]);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã cập nhật trạng thái " + statusText + " cho " + targetHoten + " (" + targetMssv + ")"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // TRƯỜNG HỢP 1B: Admin thêm sinh viên mới vào lớp
    if (data.action === "add_student") {
      var sheetQL = ss.getSheetByName("QuanLy_SinhVien");
      if (!sheetQL) {
        sheetQL = ss.insertSheet("QuanLy_SinhVien");
        sheetQL.appendRow(["Thời gian", "Mã lớp", "MSSV", "Họ và tên", "Phái", "Ngày sinh", "Đối tượng", "Hành động"]);
        sheetQL.getRange("A1:H1").setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
        sheetQL.setFrozenRows(1);
      }
      var sLop = (data.lop || "").trim();
      var sMssv = (data.mssv || "").trim();
      var sHoten = (data.hoten || "").trim();
      var sPhai = (data.phai || "Nam").trim();
      var sNgaysinh = (data.ngaysinh || "").trim();
      var sDoiTuong = data.isNonMember ? "Chưa kết nạp Đoàn" : "Đoàn viên";

      sheetQL.appendRow([nowFormatted, sLop, sMssv, sHoten, sPhai, sNgaysinh, sDoiTuong, "THEM_MOI"]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã lưu sinh viên " + sHoten + " (" + sMssv + ") vào lớp " + sLop + " trên Google Sheet!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // TRƯỜNG HỢP 1C: Admin sửa thông tin sinh viên trong lớp
    if (data.action === "edit_student") {
      var sheetQL = ss.getSheetByName("QuanLy_SinhVien");
      if (!sheetQL) {
        sheetQL = ss.insertSheet("QuanLy_SinhVien");
        sheetQL.appendRow(["Thời gian", "Mã lớp", "MSSV", "Họ và tên", "Phái", "Ngày sinh", "Đối tượng", "Hành động"]);
        sheetQL.getRange("A1:H1").setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
        sheetQL.setFrozenRows(1);
      }
      var sLop = (data.lop || "").trim();
      var sMssv = (data.mssv || "").trim();
      var sHoten = (data.hoten || "").trim();
      var sPhai = (data.phai || "Nam").trim();
      var sNgaysinh = (data.ngaysinh || "").trim();
      var sDoiTuong = data.isNonMember ? "Chưa kết nạp Đoàn" : "Đoàn viên";

      sheetQL.appendRow([nowFormatted, sLop, sMssv, sHoten, sPhai, sNgaysinh, sDoiTuong, "CHINH_SUA"]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã cập nhật thông tin sinh viên " + sHoten + " (" + sMssv + ") trong lớp " + sLop + " trên Google Sheet!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // TRƯỜNG HỢP 1D: Admin xóa sinh viên khỏi lớp
    if (data.action === "delete_student") {
      var sheetQL = ss.getSheetByName("QuanLy_SinhVien");
      if (!sheetQL) {
        sheetQL = ss.insertSheet("QuanLy_SinhVien");
        sheetQL.appendRow(["Thời gian", "Mã lớp", "MSSV", "Họ và tên", "Phái", "Ngày sinh", "Đối tượng", "Hành động"]);
        sheetQL.getRange("A1:H1").setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
        sheetQL.setFrozenRows(1);
      }
      var sLop = (data.lop || "").trim();
      var sMssv = (data.mssv || "").trim();
      var sHoten = (data.hoten || "").trim();

      sheetQL.appendRow([nowFormatted, sLop, sMssv, sHoten, "", "", "", "DA_XOA"]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Đã ghi nhận xóa sinh viên " + sHoten + " (" + sMssv + ") khỏi lớp " + sLop + " trên Google Sheet!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // TRƯỜNG HỢP 2: Nộp minh chứng (Zalo Bí thư hoặc Bài thi Nghị quyết)
    var maLop = (data.lop || "").trim();
    var khoa = (data.khoa || "").trim();
    var hoten = (data.hoten || "").trim();
    var mssv = (data.mssv || "").trim();
    var sdt = (data.sdt || "").trim();
    var loaiMinhChung = (data.loaiMinhChung || "").trim();
    var doiTuong = (data.doiTuong || (data.isNonMember ? "Chưa kết nạp Đoàn" : "Đoàn viên")).trim();
    var ghiChu = (data.ghiChu || "").trim();

    if (!khoa && maLop.length >= 2) {
      khoa = "Khóa " + maLop.substring(0, 2);
    }

    var khoaFolder = getOrCreateFolder(khoa || "Chưa phân khóa", rootFolder);
    var lopFolder = getOrCreateFolder(maLop || "Khác", khoaFolder);

    // Lưu file ảnh vào thư mục riêng của lớp
    var fileUrl = "";
    var fileName = "";
    if (data.imageBase64) {
      var contentType = data.imageType || "image/jpeg";
      var base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      var decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType);

      var timeStampStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
      var safeName = removeVietnameseAccents(hoten).replace(/\s+/g, "");

      if (loaiMinhChung.indexOf("Zalo") >= 0 || loaiMinhChung === "ZALO_BITHU") {
        fileName = "[" + maLop + "]_BITHU_ZALO_" + (safeName || "BiThu") + "_" + timeStampStr + ".jpg";
      } else {
        var safeTopic = "ThiNghiQuyet";
        if (data.topicCode) {
          safeTopic = data.topicCode;
        } else if (loaiMinhChung.indexOf("XIII") >= 0 || loaiMinhChung.indexOf("Đoàn toàn quốc") >= 0) {
          safeTopic = "NQ_Doan_XIII";
        } else if (loaiMinhChung.indexOf("XIV") >= 0 || loaiMinhChung.indexOf("Đảng") >= 0) {
          safeTopic = "NQ_Dang_XIV";
        } else if (loaiMinhChung.indexOf("CB Đoàn") >= 0 || loaiMinhChung.indexOf("CB_Doan") >= 0) {
          safeTopic = "HCM2026_CBDoan";
        } else if (loaiMinhChung.indexOf("ĐVTN") >= 0 || loaiMinhChung.indexOf("DVTN") >= 0) {
          safeTopic = "HCM2026_DVTN";
        } else if (loaiMinhChung.indexOf("lý luận") >= 0 || loaiMinhChung.indexOf("LyLuan") >= 0) {
          safeTopic = "LyLuanChinhTri";
        }
        fileName = "[" + maLop + "]_" + (mssv ? mssv + "_" : "") + (safeName || "SinhVien") + "_" + safeTopic + "_" + timeStampStr + ".jpg";
      }

      decodedBlob.setName(fileName);

      var file = lopFolder.createFile(decodedBlob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    }

    // Ghi vào Google Sheet tổng hợp (appendRow đảm bảo dữ liệu trước không bị mất)
    var sheetData = ss.getSheetByName("Tất cả minh chứng");
    sheetData.appendRow([
      nowFormatted,
      khoa,
      maLop,
      mssv,
      hoten,
      sdt,
      loaiMinhChung,
      doiTuong,
      fileUrl ? '=HYPERLINK("' + fileUrl + '", "Xem ảnh minh chứng")' : "Không có ảnh",
      '=HYPERLINK("' + lopFolder.getUrl() + '", "Mở thư mục lớp ' + maLop + '")',
      fileName,
      fileUrl,
      ghiChu
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Đã lưu thành công vào thư mục lớp " + maLop + " trên Google Drive!",
      fileUrl: fileUrl,
      folderUrl: lopFolder.getUrl(),
      fileName: fileName,
      timestamp: nowFormatted
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Lỗi xử lý: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== CÁC HÀM TIỆN ÍCH HỖ TRỢ ====================

function respondJson(data, callback) {
  var jsonStr = JSON.stringify(data);
  if (callback && /^[a-zA-Z0-9_]+$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + jsonStr + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(name, parent) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  var newFolder = parent.createFolder(name);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

function getOrCreateSpreadsheet(name, parentFolder) {
  var files = parentFolder.getFilesByName(name);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(name);
    var file = DriveApp.getFileById(ss.getId());
    parentFolder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Tạo Sheet 1: Tất cả minh chứng
    var s1 = ss.getActiveSheet();
    s1.setName("Tất cả minh chứng");
    s1.appendRow([
      "Thời gian nộp",
      "Khóa",
      "Mã lớp",
      "MSSV",
      "Họ và tên",
      "Số điện thoại / Zalo",
      "Loại minh chứng",
      "Đối tượng (Đoàn viên / Chưa kết nạp)",
      "Liên kết ảnh Drive",
      "Thư mục lớp trên Drive",
      "Tên file",
      "Direct Image URL",
      "Ghi chú"
    ]);
    s1.getRange("A1:M1").setBackground("#1f497d").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    s1.setFrozenRows(1);
    
    // Tạo Sheet 2: Danh sách 56 lớp theo dõi
    var s2 = ss.insertSheet("Theo dõi 56 lớp");
    s2.appendRow(["STT", "Khóa", "Mã lớp", "Thư mục lớp trên Drive", "Trạng thái minh chứng"]);
    s2.getRange("A1:E1").setBackground("#2e75b6").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    s2.setFrozenRows(1);
    
    var stt = 1;
    for (var k in DANH_SACH_LOP) {
      for (var j = 0; j < DANH_SACH_LOP[k].length; j++) {
        var lopCode = DANH_SACH_LOP[k][j];
        s2.appendRow([stt, k, lopCode, "Tự động cập nhật khi có minh chứng", "Chưa có minh chứng"]);
        stt++;
      }
    }
  }
  return ss;
}

function removeVietnameseAccents(str) {
  if (!str) return "";
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd');
}
