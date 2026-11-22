export interface VslChoreoStep {
  word: string;
  pose:
    | 'wave'
    | 'friend'
    | 'point_forward'
    | 'point_self'
    | 'flower_bloom'
    | 'open_palm'
    | 'fist_strong'
    | 'help_lift'
    | 'two_parallel';
  arrow: 'right_arc' | 'down_bounce' | 'forward' | 'inward' | 'up_open';
  desc: string;
}

export interface VslChoreoCourse {
  id: string;
  title: string;
  category: string;
  steps: VslChoreoStep[];
}

export const VSL_CHOREO_COURSES: VslChoreoCourse[] = [
  {
    id: 'PHRASE_INTRO',
    title: '"Xin chào bạn Nam, tôi là Lan"',
    category: 'Giới thiệu bản thân',
    steps: [
      {
        word: 'XIN CHÀO',
        pose: 'wave',
        arrow: 'right_arc',
        desc: 'Bàn tay mở ngang thái dương, vẫy nhẹ vòng ra phía trước kèm nụ cười.',
      },
      {
        word: 'BẠN',
        pose: 'friend',
        arrow: 'down_bounce',
        desc: 'Hai ngón trỏ móc nhẹ vào nhau trước ngực biểu thị sự thân thiết.',
      },
      {
        word: 'NAM (Tên riêng)',
        pose: 'point_forward',
        arrow: 'forward',
        desc: 'Đưa tay mở hướng nhẹ về phía người đối diện (hoặc đánh vần N-A-M).',
      },
      {
        word: 'TÔI',
        pose: 'point_self',
        arrow: 'inward',
        desc: 'Dùng ngón trỏ chỉ nhẹ vào giữa ngực của bản thân.',
      },
      {
        word: 'LÀ LAN',
        pose: 'flower_bloom',
        arrow: 'up_open',
        desc: 'Chụm các đầu ngón tay ngang cằm rồi mở xòe nhẹ như bông hoa lan.',
      },
    ],
  },
  {
    id: 'PHRASE_HEALTH',
    title: '"Hôm nay bạn có khỏe không?"',
    category: 'Hỏi thăm sức khỏe',
    steps: [
      {
        word: 'HÔM NAY',
        pose: 'open_palm',
        arrow: 'down_bounce',
        desc: 'Hai bàn tay ngửa đưa nhẹ xuống ngang tầm bụng biểu thị hiện tại.',
      },
      {
        word: 'BẠN',
        pose: 'point_forward',
        arrow: 'forward',
        desc: 'Đưa bàn tay mở hướng về phía người đang trò chuyện.',
      },
      {
        word: 'KHỎE KHÔNG?',
        pose: 'fist_strong',
        arrow: 'up_open',
        desc: 'Nắm hai tay đặt trước ngực và nhướn nhẹ lông mày biểu thị câu hỏi.',
      },
    ],
  },
  {
    id: 'PHRASE_HELP_WAY',
    title: '"Làm ơn chỉ giúp tôi đường ra bến xe"',
    category: 'Hỏi đường & Trợ giúp',
    steps: [
      {
        word: 'LÀM ƠN / GIÚP',
        pose: 'help_lift',
        arrow: 'up_open',
        desc: 'Bàn tay trái ngửa đỡ dưới nắm tay phải rồi cùng nâng nhẹ lên.',
      },
      {
        word: 'TÔI',
        pose: 'point_self',
        arrow: 'inward',
        desc: 'Ngón trỏ chỉ nhẹ vào giữa ngực của bản thân.',
      },
      {
        word: 'ĐƯỜNG ĐI',
        pose: 'two_parallel',
        arrow: 'forward',
        desc: 'Hai bàn tay úp song song đưa lướt thẳng về phía trước như con đường.',
      },
    ],
  },
];

export type HandSvgKey =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'DD'
  | 'E'
  | 'I'
  | 'L'
  | 'O'
  | 'U'
  | 'V'
  | 'ILY'
  | 'HELLO'
  | 'THANKS'
  | 'HELP';

export interface VslLessonItem {
  id: string;
  code: string;
  title: string;
  category: 'phrases' | 'alphabet' | 'numbers' | 'medical';
  catLabel: string;
  svgKey: HandSvgKey;
  instruction: string;
  tip: string;
}

export const VSL_LESSONS_DATA: VslLessonItem[] = [
  {
    id: 'PHRASE_LAN',
    code: 'CUM_CHAO_LAN',
    title: 'Cụm: "Xin chào bạn Nam, tôi là Lan"',
    category: 'phrases',
    catLabel: 'Cụm Câu Giao Tiếp',
    svgKey: 'HELLO',
    instruction:
      'Thực hiện chuỗi 4 cử chỉ liên tiếp: Chào ngang trán -> Chỉ người đối diện -> Chỉ bản thân -> Mở tay hình hoa lan.',
    tip: 'Bộ Ghép Cụm Từ AI tự động nối thành câu hoàn chỉnh.',
  },
  {
    id: 'PHRASE_HELP_BUS',
    code: 'HOI_DUONG',
    title: 'Cụm: "Làm ơn chỉ đường ra bến xe"',
    category: 'phrases',
    catLabel: 'Cụm Câu Giao Tiếp',
    svgKey: 'HELP',
    instruction:
      'Nâng tay ra hiệu nhờ giúp đỡ, sau đó đưa hai bàn tay song song hướng về phía trước chỉ lối đi.',
    tip: 'Dùng khi giao tiếp ngoài đường phố hoặc nhà ga.',
  },
  {
    id: 'VSL_HELLO',
    code: 'XIN_CHAO',
    title: 'Xin chào (VSL)',
    category: 'phrases',
    catLabel: 'Cụm Câu Giao Tiếp',
    svgKey: 'HELLO',
    instruction:
      'Đưa bàn tay mở lên ngang thái dương/trán và vẫy nhẹ hướng ra phía trước kèm biểu cảm thân thiện.',
    tip: 'Giữ các ngón tay khép tự nhiên, cổ tay thả lỏng.',
  },
  {
    id: 'VSL_THANKS',
    code: 'CAM_ON',
    title: 'Cảm ơn (VSL)',
    category: 'phrases',
    catLabel: 'Cụm Câu Giao Tiếp',
    svgKey: 'THANKS',
    instruction:
      'Đặt các đầu ngón tay chạm nhẹ vào vùng cằm/môi rồi đưa thẳng bàn tay hướng về phía người đối diện.',
    tip: 'Kết hợp gật đầu nhẹ để thể hiện sự trân trọng.',
  },
  {
    id: 'VSL_ILY',
    code: 'TOI_YEU_BAN',
    title: 'Tôi yêu bạn (Ký hiệu ILY)',
    category: 'phrases',
    catLabel: 'Cụm Câu Giao Tiếp',
    svgKey: 'ILY',
    instruction:
      'Mở đồng thời ngón cái, ngón trỏ và ngón út (kết hợp 3 chữ cái I - L - Y), gập ngón giữa và áp út.',
    tip: 'Ký hiệu quốc tế được cộng đồng người khiếm thính yêu thích.',
  },
  {
    id: 'VSL_A',
    code: 'A',
    title: 'Chữ A (VSL)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'A',
    instruction:
      'Khép chặt 4 ngón tay vào lòng bàn tay, ngón cái duỗi thẳng áp sát vào cạnh ngoài của ngón trỏ.',
    tip: 'Không để ngón cái đè ngang lên phía trước các ngón tay.',
  },
  {
    id: 'VSL_AW',
    code: 'Ă',
    title: 'Chữ Ă (Có dấu trăng)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'A',
    instruction:
      'Tạo hình chữ A chuẩn VSL, sau đó dùng ngón trỏ vẽ một vòng cung nhỏ (dấu trăng) phía trên.',
    tip: 'Đặc trưng riêng của bảng chữ cái Ngôn ngữ Ký hiệu Việt Nam.',
  },
  {
    id: 'VSL_AA',
    code: 'Â',
    title: 'Chữ Â (Có dấu mũ)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'A',
    instruction:
      'Tạo hình chữ A chuẩn VSL, sau đó vẽ một nét gập chữ V ngược (dấu mũ ^) ở phía trên.',
    tip: 'Thực hiện dứt khoát ngay sau khi định hình chữ A.',
  },
  {
    id: 'VSL_B',
    code: 'B',
    title: 'Chữ B (VSL)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'B',
    instruction:
      'Duỗi thẳng 4 ngón tay khép sát nhau hướng lên trên, ngón cái gập ngang vào giữa lòng bàn tay.',
    tip: 'Lòng bàn tay hướng thẳng về phía người đối diện.',
  },
  {
    id: 'VSL_C',
    code: 'C',
    title: 'Chữ C (VSL)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'C',
    instruction:
      'Uốn cong cả 4 ngón tay và ngón cái tạo thành hình vòng cung chữ C rõ nét.',
    tip: 'Khoảng cách giữa đầu ngón trỏ và ngón cái mở vừa phải.',
  },
  {
    id: 'VSL_D',
    code: 'D',
    title: 'Chữ D (VSL)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'D',
    instruction:
      'Giơ thẳng ngón trỏ lên trên, 3 ngón còn lại chụm đầu ngón chạm vào đầu ngón cái tạo vòng tròn.',
    tip: 'Phân biệt với chữ Đ bằng cách không có nét gạch ngang.',
  },
  {
    id: 'VSL_DD',
    code: 'Đ',
    title: 'Chữ Đ (VSL)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'DD',
    instruction:
      'Tạo hình chữ D chuẩn VSL, sau đó đưa ngang bàn tay hoặc vạch nét ngang biểu thị thanh ngang chữ Đ.',
    tip: 'Rất quan trọng khi đánh vần tên riêng tiếng Việt.',
  },
  {
    id: 'VSL_EE',
    code: 'Ê',
    title: 'Chữ Ê (Có dấu mũ)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'E',
    instruction:
      'Khép cong 4 ngón tay trên ngón cái tạo chữ E, sau đó vẽ dấu mũ ^ phía trên.',
    tip: 'Giữ bàn tay ngang tầm vai.',
  },
  {
    id: 'VSL_OO',
    code: 'Ô',
    title: 'Chữ Ô (Có dấu mũ)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'O',
    instruction: 'Tạo vòng tròn khép kín chữ O rồi vẽ dấu mũ ^ phía trên.',
    tip: 'Phân biệt với chữ O thường bằng động tác dấu mũ.',
  },
  {
    id: 'VSL_OW',
    code: 'Ơ',
    title: 'Chữ Ơ (Có dấu móc)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'O',
    instruction: 'Tạo vòng tròn chữ O rồi vẩy nhẹ dấu móc ở góc trên bên phải.',
    tip: 'Dùng nhiều trong các từ tiếng Việt như Cảm ơn.',
  },
  {
    id: 'VSL_UW',
    code: 'Ư',
    title: 'Chữ Ư (Có dấu móc)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'U',
    instruction:
      'Giơ thẳng ngón trỏ và ngón giữa khép sát (chữ U) rồi vẩy nhẹ dấu móc bên phải.',
    tip: 'Đặc trưng của bảng chữ cái tiếng Việt VSL.',
  },
  {
    id: 'VSL_I',
    code: 'I',
    title: 'Chữ I (VSL)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'I',
    instruction:
      'Nắm 3 ngón giữa vào lòng bàn tay, ngón cái giữ phía trước và giơ thẳng ngón út lên trên.',
    tip: 'Giữ ngón út thẳng đứng.',
  },
  {
    id: 'VSL_L',
    code: 'L',
    title: 'Chữ L (VSL)',
    category: 'alphabet',
    catLabel: 'Chữ Cái & Dấu Tiếng Việt',
    svgKey: 'L',
    instruction:
      'Duỗi thẳng ngón trỏ lên trên và ngón cái sang ngang tạo góc vuông 90 độ hình chữ L.',
    tip: 'Ba ngón còn lại gập gọn vào lòng bàn tay.',
  },
  {
    id: 'VSL_NUM1',
    code: 'SO_1',
    title: 'Số 1 (Chuẩn VSL)',
    category: 'numbers',
    catLabel: 'Số Đếm VSL',
    svgKey: 'D',
    instruction: 'Giơ thẳng duy nhất ngón trỏ hướng lên trên, các ngón còn lại nắm gọn.',
    tip: 'Trong VSL, số 1 dùng ngón trỏ.',
  },
  {
    id: 'VSL_NUM2',
    code: 'SO_2',
    title: 'Số 2 (Chuẩn VSL)',
    category: 'numbers',
    catLabel: 'Số Đếm VSL',
    svgKey: 'V',
    instruction: 'Giơ thẳng ngón trỏ và ngón giữa tách nhẹ hình chữ V.',
    tip: 'Lòng bàn tay hướng ra ngoài.',
  },
  {
    id: 'VSL_HELP',
    code: 'GIUP_DO',
    title: 'Cần giúp đỡ / Hỗ trợ y tế (VSL)',
    category: 'medical',
    catLabel: 'Y Tế & Hỗ Trợ',
    svgKey: 'HELP',
    instruction:
      'Đặt bàn tay phải nắm nhẹ lên lòng bàn tay trái mở ngửa rồi cùng nâng nhẹ lên trên.',
    tip: 'Kết hợp ánh mắt rõ ràng để người xung quanh hỗ trợ kịp thời.',
  },
];

export function renderArticulatedHandCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  step: { pose: string; arrow: string },
  t: number,
  mirror: boolean,
  isDark: boolean
): void {
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  const cx = width * 0.42;
  const cy = height * 0.5;
  ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.28)';
  ctx.lineWidth = 3.5;

  // Head + shoulders silhouette reference
  ctx.beginPath();
  ctx.arc(cx, cy - height * 0.22, height * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - height * 0.24, cy + height * 0.28);
  ctx.quadraticCurveTo(cx - height * 0.22, cy - height * 0.04, cx, cy - height * 0.04);
  ctx.quadraticCurveTo(cx + height * 0.22, cy - height * 0.04, cx + height * 0.24, cy + height * 0.28);
  ctx.stroke();

  let hx = cx + height * 0.14;
  let hy = cy - height * 0.05;
  let rot = 0;
  let spread = 1;

  if (step.pose === 'wave') {
    hx = cx + height * 0.18 + t * 24;
    hy = cy - height * 0.16;
    rot = t * 0.35;
  } else if (step.pose === 'point_self') {
    hx = cx + 10;
    hy = cy + height * 0.06 + t * 8;
    spread = 0.2;
  } else if (step.pose === 'point_forward') {
    hx = cx + height * 0.12;
    hy = cy - height * 0.02 + t * 12;
    spread = 0.3;
  } else if (step.pose === 'flower_bloom') {
    hx = cx + height * 0.12;
    hy = cy - height * 0.06 - (t + 1) * 10;
    spread = 0.35 + (t + 1) * 0.35;
  } else if (step.pose === 'help_lift') {
    hx = cx + height * 0.06;
    hy = cy + height * 0.08 - (t + 1) * 16;
    spread = 0.25;
  } else {
    hx = cx + height * 0.12;
    hy = cy + t * 14;
  }

  const scale = height * 0.22;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(rot);

  const grad = ctx.createLinearGradient(-scale * 0.4, -scale * 0.6, scale * 0.4, scale * 0.5);
  grad.addColorStop(0, '#38bdf8');
  grad.addColorStop(1, '#10b981');

  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(241, 245, 249, 0.96)';
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(-scale * 0.26, -scale * 0.1, scale * 0.52, scale * 0.48, scale * 0.16);
  ctx.fill();
  ctx.stroke();

  const fingerConfigs = [
    { offsetX: -0.19, len: 0.46, angle: -0.14 * spread, extended: true },
    {
      offsetX: -0.06,
      len: 0.52,
      angle: -0.04 * spread,
      extended: step.pose !== 'point_self' && step.pose !== 'point_forward',
    },
    {
      offsetX: 0.07,
      len: 0.48,
      angle: 0.05 * spread,
      extended: step.pose !== 'point_self' && step.pose !== 'point_forward',
    },
    {
      offsetX: 0.19,
      len: 0.38,
      angle: 0.15 * spread,
      extended: step.pose !== 'point_self' && step.pose !== 'point_forward',
    },
  ];

  for (const f of fingerConfigs) {
    ctx.save();
    ctx.translate(scale * f.offsetX, -scale * 0.08);
    ctx.rotate(f.angle);
    const fLen = f.extended ? scale * f.len : scale * 0.16;
    ctx.fillStyle = f.extended
      ? 'rgba(56, 189, 248, 0.25)'
      : isDark
        ? 'rgba(30, 41, 59, 0.95)'
        : 'rgba(203, 213, 225, 0.95)';
    ctx.strokeStyle = f.extended ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-scale * 0.055, -fLen, scale * 0.11, fLen, scale * 0.055);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(0, -fLen * 0.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(-scale * 0.25, scale * 0.16);
  ctx.rotate(-0.65 * spread);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-scale * 0.32, -scale * 0.055, scale * 0.34, scale * 0.11, scale * 0.055);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // Motion Arrow Indicator
  ctx.save();
  ctx.strokeStyle = '#f59e0b';
  ctx.fillStyle = '#f59e0b';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([7, 5]);

  if (step.arrow === 'right_arc') {
    ctx.beginPath();
    ctx.arc(hx, hy - 42, 34, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(hx + t * 26, hy - 72, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (step.arrow === 'forward' || step.arrow === 'inward') {
    const dir = step.arrow === 'forward' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(hx - 24 * dir, hy + 48);
    ctx.lineTo(hx + 36 * dir, hy + 48);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(hx + 42 * dir, hy + 48);
    ctx.lineTo(hx + 30 * dir, hy + 41);
    ctx.lineTo(hx + 30 * dir, hy + 55);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(hx + 42, hy + 20);
    ctx.lineTo(hx + 42, hy - 36);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(hx + 42, hy - 42);
    ctx.lineTo(hx + 35, hy - 30);
    ctx.lineTo(hx + 49, hy - 30);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

export interface AiSignStep {
  word: string;
  pose: string;
  arrow: string;
}

export function buildAiSignQueueFromVietnamese(sentence: string): AiSignStep[] {
  const words = sentence.replace(/[.!?,]/g, '').split(/\s+/).filter(Boolean);
  const poses = ['wave', 'open_palm', 'point_forward', 'flower_bloom', 'help_lift', 'fist_strong'];
  const arrows = ['right_arc', 'forward', 'down_bounce', 'up_open'];
  const queue: AiSignStep[] = [];

  for (let i = 0; i < words.length; i += 2) {
    const chunk = words.slice(i, i + 2).join(' ').toUpperCase();
    const stepIdx = Math.floor(i / 2);
    queue.push({
      word: chunk,
      pose: poses[stepIdx % poses.length],
      arrow: arrows[stepIdx % arrows.length],
    });
  }
  return queue.length > 0 ? queue : [{ word: 'XIN CHÀO', pose: 'wave', arrow: 'right_arc' }];
}
