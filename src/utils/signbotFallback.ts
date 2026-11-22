export function generateSignBotFallbackReply(query: string): string {
  const q = query.toLowerCase();

  if (
    q.includes('chào') ||
    q.includes('hello') ||
    q.includes('hi') ||
    q.includes('bạn là ai')
  ) {
    return 'Xin chào! Tôi là SignBot — trợ lý của SignLens. Tôi có thể hướng dẫn bạn tạo hoặc tham gia phòng gọi video hai thiết bị, bật nhận diện ngôn ngữ ký hiệu VSL, tạo phụ đề văn bản hoặc học VSL.';
  }

  if (
    q.includes('học') ||
    q.includes('bài học') ||
    q.includes('youtube') ||
    q.includes('thư viện')
  ) {
    return 'Để học ngôn ngữ ký hiệu VSL: (1) Vào mục "Học VSL" trên thanh điều hướng. (2) Chọn bài học mô phỏng bàn tay 2D theo từng bước, bảng chữ cái hoặc dán link YouTube để lưu bài học mới.';
  }

  if (
    q.includes('camera') ||
    q.includes('micro') ||
    q.includes('quyền') ||
    q.includes('không nhận') ||
    q.includes('lỗi cam')
  ) {
    return 'Cách xử lý khi chưa bật được camera hoặc micro: (1) Mở cài đặt quyền trang web (biểu tượng ổ khóa trên thanh địa chỉ) và chọn Cho phép Camera & Micro. (2) Đảm bảo trang đang mở bằng HTTPS. (3) Nhấn "Thử cấp quyền lại" ở màn hình kiểm tra thiết bị trước khi vào cuộc gọi.';
  }

  if (
    q.includes('kết nối') ||
    q.includes('gọi') ||
    q.includes('phòng') ||
    q.includes('qr') ||
    q.includes('video')
  ) {
    return 'Để gọi video hai thiết bị trên SignLens: (1) Bấm "Bắt đầu gọi video" để vào trang Kết nối cuộc gọi. (2) Nhấn "Tạo phòng gọi video" để nhận mã phòng và mã QR mời người kia quét bằng điện thoại hoặc mở liên kết mời. (3) Kiểm tra camera/micro rồi nhấn "Tham gia cuộc gọi".';
  }

  if (
    q.includes('phụ đề') ||
    q.includes('srt') ||
    q.includes('văn bản') ||
    q.includes('dịch')
  ) {
    return 'Trong cuộc gọi video, khu vực phụ đề hiển thị trực tiếp nội dung từ nhận diện VSL, giọng nói tiếng Việt và khung chat hai chiều. Ngoài ra bạn có thể vào mục "Phụ đề & Văn bản" để tóm tắt giấy tờ và xuất file phụ đề .SRT.';
  }

  if (
    q.includes('admin') ||
    q.includes('quản trị') ||
    q.includes('tài khoản') ||
    q.includes('upload')
  ) {
    return 'Khu vực Tài khoản & Admin nằm ở góc phải thanh điều hướng. Quản trị viên có thể đăng nhập (hoặc thiết lập mật khẩu lần đầu), quản lý kho bài học và truy cập SignLens Studio.';
  }

  if (
    q.includes('vẫy tay') ||
    q.includes('xin chào') ||
    q.includes('nhận diện') ||
    q.includes('landmark') ||
    q.includes('studio') ||
    q.includes('huấn luyện')
  ) {
    return 'SignLens dùng MediaPipe HandLandmarker theo dõi 21 khớp bàn tay ngay trên trình duyệt. Trong SignLens Studio, bạn có thể ghi mẫu ký hiệu VSL riêng, huấn luyện mô hình k-NN và bật nhận diện ngay trong phòng gọi video.';
  }

  return 'Cảm ơn câu hỏi của bạn! Bạn có thể hỏi tôi về: "Cách tạo phòng gọi video & quét QR", "Cách cấp quyền camera/micro", "Nhận diện VSL trong cuộc gọi", "Tạo phụ đề .SRT" hoặc "Học VSL".';
}
