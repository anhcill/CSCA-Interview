-- ============================================================
-- Seed MVP Ngày 2-4
-- Chạy sau database/schema_full.sql
-- Bao gồm: admin demo, 3 trường, 5 ngành, học bổng mẫu, 20 câu hỏi
-- ============================================================

SET client_min_messages TO WARNING;

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
  updated_at = NOW();

INSERT INTO admission_seasons (name, admission_year, status, starts_at, ends_at, note)
VALUES (
  'Mùa tuyển sinh 2026',
  2026,
  'ACTIVE',
  '2026-01-01',
  '2026-12-31',
  'Dữ liệu mẫu cho MVP Ngày 2-4'
)
ON CONFLICT (name, admission_year) DO UPDATE
SET status = 'ACTIVE', note = EXCLUDED.note, updated_at = NOW();

INSERT INTO schools (name, name_zh, name_en, city, province, website_url, description)
VALUES
  ('Đại học Bắc Kinh', '北京大学', 'Peking University', 'Bắc Kinh', 'Bắc Kinh', 'https://www.pku.edu.cn', 'Trường đại học trọng điểm tại Trung Quốc.'),
  ('Đại học Thanh Hoa', '清华大学', 'Tsinghua University', 'Bắc Kinh', 'Bắc Kinh', 'https://www.tsinghua.edu.cn', 'Trường mạnh về kỹ thuật, công nghệ và nghiên cứu.'),
  ('Đại học Phúc Đán', '复旦大学', 'Fudan University', 'Thượng Hải', 'Thượng Hải', 'https://www.fudan.edu.cn', 'Trường tổng hợp tại Thượng Hải.')
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

INSERT INTO scholarships (name, code, description)
VALUES
  ('Học bổng Chính phủ Trung Quốc', 'CSC', 'Chinese Government Scholarship'),
  ('Học bổng Giáo viên tiếng Trung Quốc tế', 'CIS', 'International Chinese Language Teachers Scholarship'),
  ('Học bổng trường', 'UNIVERSITY', 'Học bổng do trường cấp'),
  ('Học bổng tỉnh', 'PROVINCE', 'Học bổng do tỉnh/thành phố cấp'),
  ('Tự túc', 'SELF_FUNDED', 'Không sử dụng học bổng')
ON CONFLICT (name) DO UPDATE
SET code = EXCLUDED.code, description = EXCLUDED.description, updated_at = NOW();

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
    ('BACHELOR', 'PERSONAL', 'EASY', 'VI', 'Hãy giới thiệu ngắn gọn về bản thân và mục tiêu du học Trung Quốc của bạn.', 'Trả lời theo cấu trúc: thông tin cá nhân, nền tảng học tập, lý do muốn du học, mục tiêu ngắn hạn.', 'bản thân, mục tiêu, du học Trung Quốc, ngành học', 'Trả lời quá dài, kể lan man, không nêu mục tiêu rõ ràng.', '{"relevance":25,"logic":25,"specificity":25,"language":25}'),
    ('BACHELOR', 'SCHOOL_MAJOR', 'MEDIUM', 'VI', 'Vì sao bạn chọn trường và ngành học này?', 'Nêu hiểu biết về trường, sự phù hợp của ngành với năng lực cá nhân và kế hoạch tương lai.', 'trường, ngành, phù hợp, năng lực, kế hoạch', 'Chỉ nói vì trường nổi tiếng, không liên hệ với profile cá nhân.', '{"relevance":30,"logic":25,"specificity":30,"language":15}'),
    ('BACHELOR', 'STUDY_PLAN', 'MEDIUM', 'VI', 'Kế hoạch học tập của bạn trong năm đầu tiên tại Trung Quốc là gì?', 'Chia thành học thuật, ngôn ngữ, thích nghi môi trường và hoạt động hỗ trợ mục tiêu học tập.', 'năm đầu, học thuật, tiếng Trung, thích nghi, kế hoạch', 'Nêu kế hoạch chung chung, không có hành động cụ thể.', '{"relevance":25,"logic":30,"specificity":30,"language":15}'),
    ('BACHELOR', 'SCHOLARSHIP', 'MEDIUM', 'VI', 'Nếu nhận học bổng, bạn sẽ sử dụng cơ hội đó như thế nào?', 'Nêu cam kết học tập, quản lý thời gian, đóng góp cộng đồng và giữ thành tích.', 'học bổng, cam kết, thành tích, đóng góp', 'Chỉ nói học bổng giúp giảm chi phí.', '{"relevance":25,"logic":25,"specificity":30,"language":20}'),
    ('BACHELOR', 'LANGUAGE', 'EASY', 'VI', 'Bạn đã chuẩn bị năng lực tiếng Trung như thế nào trước khi apply?', 'Nêu chứng chỉ, thói quen học, kế hoạch tăng kỹ năng nghe nói đọc viết và cách luyện phỏng vấn.', 'HSK, HSKK, nghe nói, kế hoạch, luyện tập', 'Chỉ liệt kê chứng chỉ, không nói cách cải thiện.', '{"relevance":25,"logic":25,"specificity":25,"language":25}'),
    ('BACHELOR', 'CAREER_PLAN', 'MEDIUM', 'VI', 'Sau khi tốt nghiệp đại học, bạn dự định phát triển sự nghiệp ra sao?', 'Kết nối ngành học, kỹ năng sẽ học tại Trung Quốc và mục tiêu nghề nghiệp 3-5 năm.', 'sự nghiệp, kỹ năng, 3-5 năm, ngành học', 'Nói mục tiêu quá chung hoặc không liên quan ngành.', '{"relevance":30,"logic":25,"specificity":25,"language":20}'),
    ('BACHELOR', 'SITUATION', 'HARD', 'VI', 'Nếu gặp khó khăn trong năm đầu du học, bạn sẽ xử lý như thế nào?', 'Nêu cách nhận diện vấn đề, tìm hỗ trợ từ trường, quản lý cảm xúc và duy trì tiến độ học.', 'khó khăn, thích nghi, hỗ trợ, kỷ luật', 'Trả lời cảm tính, thiếu giải pháp cụ thể.', '{"relevance":25,"logic":30,"specificity":25,"language":20}'),
    ('BACHELOR', 'ACADEMIC', 'MEDIUM', 'VI', 'Môn học hoặc dự án nào thể hiện rõ nhất năng lực học thuật của bạn?', 'Mô tả bối cảnh, vai trò cá nhân, kết quả và bài học liên quan ngành apply.', 'môn học, dự án, kết quả, vai trò', 'Kể thành tích nhưng không rút ra năng lực.', '{"relevance":25,"logic":25,"specificity":30,"language":20}'),
    ('BACHELOR', 'PERSONAL', 'EASY', 'ZH', '请简单介绍一下你自己。', '用中文 nói ngắn: tên, nền tảng học tập, ngành muốn học, lý do chọn Trung Quốc.', '自我介绍, 专业, 中国, 学习计划', 'Học thuộc máy móc, phát âm vội, thiếu mục tiêu.', '{"relevance":25,"logic":25,"specificity":20,"language":30}'),
    ('BACHELOR', 'SCHOOL_MAJOR', 'MEDIUM', 'ZH', '你为什么选择这个大学和这个专业？', 'Nêu lý do chọn trường/ngành bằng cấu trúc: hiểu biết, phù hợp, kế hoạch học tập.', '大学, 专业, 适合, 学习计划', 'Chỉ nói trường nổi tiếng, thiếu ví dụ cá nhân.', '{"relevance":30,"logic":25,"specificity":20,"language":25}'),
    ('MASTER', 'PERSONAL', 'EASY', 'VI', 'Hãy giới thiệu về nền tảng học thuật và kinh nghiệm liên quan đến chương trình thạc sĩ bạn apply.', 'Tóm tắt ngành đã học, dự án, nghiên cứu, kỹ năng và lý do học tiếp.', 'nền tảng, dự án, nghiên cứu, kỹ năng', 'Kể quá nhiều chi tiết không liên quan.', '{"relevance":25,"logic":25,"specificity":30,"language":20}'),
    ('MASTER', 'RESEARCH', 'HARD', 'VI', 'Bạn muốn nghiên cứu hướng nào trong thời gian học thạc sĩ và vì sao?', 'Nêu vấn đề nghiên cứu, lý do chọn hướng, nền tảng đã có, phương pháp dự kiến và giá trị ứng dụng.', 'nghiên cứu, vấn đề, phương pháp, ứng dụng, nền tảng', 'Nói quá rộng, không có vấn đề nghiên cứu cụ thể.', '{"relevance":25,"logic":30,"specificity":30,"language":15}'),
    ('MASTER', 'SCHOLARSHIP', 'MEDIUM', 'VI', 'Tại sao bạn cho rằng mình phù hợp với học bổng này?', 'Kết nối thành tích, định hướng học tập, khả năng đóng góp và cam kết sau khi tốt nghiệp.', 'học bổng, thành tích, đóng góp, cam kết, phù hợp', 'Chỉ nói cần hỗ trợ tài chính, không chứng minh giá trị bản thân.', '{"relevance":30,"logic":25,"specificity":30,"language":15}'),
    ('MASTER', 'ACADEMIC', 'HARD', 'VI', 'Hãy trình bày một đề tài hoặc dự án học thuật bạn từng thực hiện.', 'Nêu mục tiêu, phương pháp, vai trò cá nhân, kết quả và liên hệ với định hướng thạc sĩ.', 'đề tài, phương pháp, vai trò, kết quả', 'Không làm rõ đóng góp cá nhân.', '{"relevance":25,"logic":25,"specificity":35,"language":15}'),
    ('MASTER', 'STUDY_PLAN', 'MEDIUM', 'VI', 'Kế hoạch học tập của bạn trong 2 năm thạc sĩ là gì?', 'Chia theo học phần, nghiên cứu, công bố/kết quả, kỹ năng và kết nối với giảng viên/phòng lab.', '2 năm, học phần, nghiên cứu, kỹ năng, kết quả', 'Kế hoạch mơ hồ, thiếu mốc thời gian.', '{"relevance":25,"logic":30,"specificity":30,"language":15}'),
    ('MASTER', 'CAREER_PLAN', 'MEDIUM', 'VI', 'Chương trình thạc sĩ này sẽ giúp gì cho mục tiêu nghề nghiệp của bạn?', 'Nêu khoảng cách năng lực hiện tại, năng lực cần học, cơ hội tại chương trình và kế hoạch sau tốt nghiệp.', 'mục tiêu nghề nghiệp, năng lực, sau tốt nghiệp', 'Không chứng minh được chương trình là bước cần thiết.', '{"relevance":30,"logic":25,"specificity":25,"language":20}'),
    ('MASTER', 'LANGUAGE', 'MEDIUM', 'VI', 'Nếu chương trình yêu cầu học bằng tiếng Trung hoặc tiếng Anh, bạn đã chuẩn bị ra sao?', 'Nêu chứng chỉ, kinh nghiệm học thuật bằng ngoại ngữ, kế hoạch cải thiện và cách theo kịp lớp.', 'HSK, IELTS, học thuật, ngoại ngữ', 'Chỉ nói sẽ cố gắng, thiếu kế hoạch cụ thể.', '{"relevance":25,"logic":25,"specificity":25,"language":25}'),
    ('MASTER', 'SITUATION', 'HARD', 'VI', 'Nếu giáo sư đặt câu hỏi phản biện về kế hoạch nghiên cứu, bạn sẽ xử lý như thế nào?', 'Thể hiện thái độ tiếp thu, bảo vệ luận điểm bằng dữ liệu, điều chỉnh giả thuyết và hỏi lại thông tin cần làm rõ.', 'phản biện, dữ liệu, giả thuyết, tiếp thu', 'Phòng thủ quá mức hoặc trả lời vòng vo.', '{"relevance":25,"logic":35,"specificity":25,"language":15}'),
    ('MASTER', 'RESEARCH', 'HARD', 'ZH', '你硕士阶段的研究方向是什么？为什么？', 'Trả lời bằng tiếng Trung: hướng nghiên cứu, nền tảng, lý do chọn, giá trị ứng dụng.', '研究方向, 背景, 方法, 应用价值', 'Dùng từ chuyên ngành sai hoặc trả lời quá chung.', '{"relevance":25,"logic":30,"specificity":20,"language":25}'),
    ('MASTER', 'CAREER_PLAN', 'MEDIUM', 'EN', 'How will this program support your long-term career plan?', 'Answer with a clear link between current background, target skills, program resources and long-term career direction.', 'career plan, program fit, skills, long-term goal', 'Generic answer without connection to the chosen program.', '{"relevance":30,"logic":25,"specificity":25,"language":20}')
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
