/**
 * ==============================================================================================
 * GOOGLE APPS SCRIPT - HỆ THỐNG LƯU TRỮ MINH CHỨNG THEO TỪNG LỚP TRÊN GOOGLE DRIVE
 * ĐOÀN KHOA CÔNG NGHỆ THÔNG TIN - TRƯỜNG ĐẠI HỌC LẠC HỒNG (2026 - 2027)
 * ==============================================================================================
 * 
 * ĐẶC ĐIỂM NỔI BẬT:
 * 1. MIỄN PHÍ 100%: Dùng trực tiếp tài khoản Google Drive (tận dụng bộ nhớ Drive có sẵn của bạn).
 * 2. TỰ ĐỘNG TẠO 56 THƯ MỤC LỚP: Tự tạo cấu trúc thư mục phân cấp Khóa 23 -> 26 và 56 lớp riêng biệt.
 * 3. TỰ ĐỘNG ĐIỀU HƯỚNG ẢNH: Sinh viên lớp nào nộp, ảnh tự động rơi vào đúng thư mục của lớp đó!
 * 4. TỰ ĐỘNG GHI GOOGLE SHEET: Bảng tổng hợp minh chứng và bảng theo dõi tiến độ từng lớp.
 * 
 * HƯỚNG DẪN 3 BƯỚC TRIỂN KHAI TRÊN TRÌNH DUYỆT CỐC CỐC (ĐÃ ĐĂNG NHẬP GOOGLE):
 * Bước 1: Mở https://script.new trên Cốc Cốc ➜ Đặt tên dự án là "HeThong_MinhChung_KhoaCNTT".
 * Bước 2: Dán toàn bộ mã này vào ➜ Bấm Lưu (Ctrl + S).
 *         (Tùy chọn: Chọn hàm "khoiTaoHeThong56Lop" rồi bấm "Chạy" để tạo ngay 56 thư mục trên Drive).
 * Bước 3: Bấm nút "Triển khai" (Deploy) ở góc trên bên phải:
 *         ➜ Chọn "Tùy chọn triển khai mới" (New deployment)
 *         ➜ Bấm biểu tượng bánh răng ⚙️ ➜ Chọn "Ứng dụng web" (Web app)
 *         ➜ Cấu hình:
 *             - Mô tả: Hệ thống tiếp nhận minh chứng
 *             - Thực thi dưới dạng (Execute as): "Tôi" (Me - tài khoản Google của bạn)
 *             - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 *         ➜ Bấm "Triển khai", cấp quyền truy cập Google Drive & Sheets.
 *         ➜ Sao chép "URL ứng dụng web" (Web App URL) và dán vào web là XONG!
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
 * Bạn có thể chọn hàm này trên thanh công cụ Apps Script và bấm "Chạy" (Run) để tạo sẵn trước.
 */
function khoiTaoHeThong56Lop() {
  Logger.log("Bắt đầu khởi tạo hệ thống thư mục 56 lớp trên Google Drive...");
  
  // 1. Thư mục gốc
  var rootFolder = getOrCreateFolder(ROOT_FOLDER_NAME, DriveApp.getRootFolder());
  Logger.log("Thư mục gốc: " + rootFolder.getUrl());
  
  // 2. Tạo 4 thư mục Khóa và 56 thư mục Lớp
  for (var khoa in DANH_SACH_LOP) {
    var khoaFolder = getOrCreateFolder(khoa, rootFolder);
    var dsLopCuaKhoa = DANH_SACH_LOP[khoa];
    
    for (var i = 0; i < dsLopCuaKhoa.length; i++) {
      var maLop = dsLopCuaKhoa[i];
      var lopFolder = getOrCreateFolder(maLop, khoaFolder);
    }
    Logger.log("Đã tạo xong các thư mục lớp của " + khoa);
  }
  
  // 3. Tạo Google Sheet tổng hợp
  var sheet = getOrCreateSpreadsheet(SPREADSHEET_NAME, rootFolder);
  Logger.log("Hoàn tất khởi tạo toàn bộ hệ thống! Sẵn sàng nhận minh chứng.");
  return "Đã tạo thành công thư mục 56 lớp trên Google Drive và Google Sheet!";
}

/**
 * XỬ LÝ TIẾP NHẬN DỮ LIỆU POST TỪ TRANG WEB
 */
function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data = JSON.parse(raw);
    
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
    
    // 1. Lấy hoặc tạo thư mục gốc
    var rootFolder = getOrCreateFolder(ROOT_FOLDER_NAME, DriveApp.getRootFolder());
    
    // 2. Lấy hoặc tạo thư mục Khóa
    var khoaFolder = getOrCreateFolder(khoa || "Chưa phân khóa", rootFolder);
    
    // 3. Lấy hoặc tạo thư mục RIÊNG CỦA LỚP
    var lopFolder = getOrCreateFolder(maLop || "Khác", khoaFolder);
    
    // 4. Lưu ảnh minh chứng vào đúng thư mục của lớp
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
    
    // 5. Ghi vào Google Sheet tổng hợp
    var ss = getOrCreateSpreadsheet(SPREADSHEET_NAME, rootFolder);
    var nowFormatted = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
    
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

/**
 * XỬ LÝ GET: Kiểm tra kết nối từ trang Web
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Hệ thống Google Drive & Sheets Khoa CNTT - ĐH Lạc Hồng đang hoạt động tốt!",
    rootFolder: ROOT_FOLDER_NAME,
    time: Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss")
  })).setMimeType(ContentService.MimeType.JSON);
}

// ==================== CÁC HÀM TIỆN ÍCH HỖ TRỢ ====================

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
