-- ============================================================
-- Seed Ngày 1: dữ liệu mẫu để đăng nhập và demo luồng MVP
-- Chạy sau khi đã chạy database/schema_full.sql
-- ============================================================

SET client_min_messages TO WARNING;

-- Tài khoản admin demo:
-- Email: admin@interviewai.vn
-- Mật khẩu: Admin@123456
WITH admin_user AS (
  INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    is_active,
    email_verified_at
  )
  VALUES (
    'Quản trị viên InterviewAI',
    'admin@interviewai.vn',
    crypt('Admin@123456', gen_salt('bf', 10)),
    'SUPER_ADMIN',
    TRUE,
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = TRUE,
    email_verified_at = NOW(),
    updated_at = NOW()
  RETURNING id
),
season AS (
  INSERT INTO admission_seasons (name, admission_year, status, starts_at, ends_at, note)
  VALUES (
    'Mùa tuyển sinh 2026',
    2026,
    'ACTIVE',
    '2026-01-01',
    '2026-12-31',
    'Dữ liệu mẫu cho MVP Ngày 1'
  )
  ON CONFLICT (name, admission_year) DO UPDATE
  SET status = 'ACTIVE', updated_at = NOW()
  RETURNING id
)
INSERT INTO schools (name, name_zh, name_en, city, province, website_url, description)
VALUES
  (
    'Đại học Bắc Kinh',
    '北京大学',
    'Peking University',
    'Bắc Kinh',
    'Bắc Kinh',
    'https://www.pku.edu.cn',
    'Trường đại học trọng điểm tại Trung Quốc.'
  ),
  (
    'Đại học Thanh Hoa',
    '清华大学',
    'Tsinghua University',
    'Bắc Kinh',
    'Bắc Kinh',
    'https://www.tsinghua.edu.cn',
    'Trường mạnh về kỹ thuật, công nghệ và nghiên cứu.'
  ),
  (
    'Đại học Phúc Đán',
    '复旦大学',
    'Fudan University',
    'Thượng Hải',
    'Thượng Hải',
    'https://www.fudan.edu.cn',
    'Trường tổng hợp tại Thượng Hải.'
  )
ON CONFLICT (name) DO UPDATE
SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  city = EXCLUDED.city,
  province = EXCLUDED.province,
  website_url = EXCLUDED.website_url,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO majors (name, name_zh, name_en, degree_level, description)
VALUES
  ('Kinh tế quốc tế', '国际经济', 'International Economics', 'BACHELOR', 'Ngành phù hợp ứng viên quan tâm thương mại và kinh tế quốc tế.'),
  ('Ngôn ngữ Trung Quốc', '汉语言', 'Chinese Language', 'BACHELOR', 'Ngành phù hợp ứng viên muốn phát triển năng lực tiếng Trung và văn hóa Trung Quốc.'),
  ('Khoa học máy tính', '计算机科学', 'Computer Science', 'BACHELOR', 'Ngành về lập trình, dữ liệu, AI và hệ thống phần mềm.'),
  ('Quản trị kinh doanh', '工商管理', 'Business Administration', 'MASTER', 'Ngành thạc sĩ về quản trị, chiến lược và vận hành doanh nghiệp.'),
  ('Trí tuệ nhân tạo', '人工智能', 'Artificial Intelligence', 'MASTER', 'Ngành thạc sĩ về machine learning, dữ liệu và ứng dụng AI.')
ON CONFLICT (name, degree_level) DO UPDATE
SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  updated_at = NOW();

INSERT INTO questions (
  degree_level,
  category,
  difficulty,
  language,
  question_text,
  suggested_answer_logic,
  keywords,
  common_mistakes,
  scoring_rubric,
  created_by
)
SELECT
  data.degree_level::degree_level,
  data.category::question_category,
  data.difficulty::difficulty_level,
  data.language::language_code,
  data.question_text,
  data.suggested_answer_logic,
  data.keywords,
  data.common_mistakes,
  data.scoring_rubric::jsonb,
  (SELECT id FROM users WHERE email = 'admin@interviewai.vn')
FROM
(
  VALUES
    (
      'BACHELOR',
      'PERSONAL',
      'EASY',
      'VI',
      'Hãy giới thiệu ngắn gọn về bản thân và mục tiêu du học Trung Quốc của bạn.',
      'Trả lời theo cấu trúc: thông tin cá nhân, nền tảng học tập, lý do muốn du học, mục tiêu ngắn hạn.',
      'bản thân, mục tiêu, du học Trung Quốc, ngành học',
      'Trả lời quá dài, kể lan man, không nêu mục tiêu rõ ràng.',
      '{"relevance":25,"logic":25,"specificity":25,"language":25}'
    ),
    (
      'BACHELOR',
      'SCHOOL_MAJOR',
      'MEDIUM',
      'VI',
      'Vì sao bạn chọn trường và ngành học này?',
      'Nêu hiểu biết về trường, sự phù hợp của ngành với năng lực cá nhân và kế hoạch tương lai.',
      'trường, ngành, phù hợp, năng lực, kế hoạch',
      'Chỉ nói vì trường nổi tiếng, không liên hệ với profile cá nhân.',
      '{"relevance":30,"logic":25,"specificity":30,"language":15}'
    ),
    (
      'BACHELOR',
      'STUDY_PLAN',
      'MEDIUM',
      'VI',
      'Kế hoạch học tập của bạn trong năm đầu tiên tại Trung Quốc là gì?',
      'Chia thành học thuật, ngôn ngữ, thích nghi môi trường và hoạt động hỗ trợ mục tiêu học tập.',
      'năm đầu, học thuật, tiếng Trung, thích nghi, kế hoạch',
      'Nêu kế hoạch chung chung, không có hành động cụ thể.',
      '{"relevance":25,"logic":30,"specificity":30,"language":15}'
    ),
    (
      'MASTER',
      'RESEARCH',
      'HARD',
      'VI',
      'Bạn muốn nghiên cứu hướng nào trong thời gian học thạc sĩ và vì sao?',
      'Nêu vấn đề nghiên cứu, lý do chọn hướng, nền tảng đã có, phương pháp dự kiến và giá trị ứng dụng.',
      'nghiên cứu, vấn đề, phương pháp, ứng dụng, nền tảng',
      'Nói quá rộng, không có vấn đề nghiên cứu cụ thể.',
      '{"relevance":25,"logic":30,"specificity":30,"language":15}'
    ),
    (
      'MASTER',
      'SCHOLARSHIP',
      'MEDIUM',
      'VI',
      'Tại sao bạn cho rằng mình phù hợp với học bổng này?',
      'Kết nối thành tích, định hướng học tập, khả năng đóng góp và cam kết sau khi tốt nghiệp.',
      'học bổng, thành tích, đóng góp, cam kết, phù hợp',
      'Chỉ nói cần hỗ trợ tài chính, không chứng minh giá trị của bản thân.',
      '{"relevance":30,"logic":25,"specificity":30,"language":15}'
    )
) AS data (
  degree_level,
  category,
  difficulty,
  language,
  question_text,
  suggested_answer_logic,
  keywords,
  common_mistakes,
  scoring_rubric
)
WHERE NOT EXISTS (
  SELECT 1
  FROM questions q
  WHERE q.question_text = data.question_text
);

RESET client_min_messages;
