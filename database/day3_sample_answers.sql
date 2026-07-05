-- Day 3: default sample answers for comparison feedback.
-- Safe to rerun. Keeps admin-authored sample answers unchanged.

UPDATE questions
SET sample_answer = CASE
  WHEN language = 'ZH' THEN CASE category
    WHEN 'PERSONAL' THEN '我叫...，来自越南。我本科/高中阶段主要学习...，并通过项目、竞赛或实习积累了相关经验。我申请贵校是因为课程方向与我的长期目标一致。入学后我会先提高专业基础和中文表达，再参加研究或实践项目，毕业后希望把所学用于中越合作或本行业发展。'
    WHEN 'SCHOOL_MAJOR' THEN '我选择这个学校和专业，是因为学校在该领域有清晰的课程体系、研究方向和实践资源。我的过往学习经历与该专业匹配，例如...。未来我计划重点学习...，参与相关项目，并把专业能力用于解决实际问题。'
    WHEN 'STUDY_PLAN' THEN '我的学习计划分为三个阶段：第一阶段适应中文授课并补强专业基础；第二阶段选择研究方向，参加课程项目和导师课题；第三阶段完成论文或实践成果，并为毕业后的职业目标做准备。'
    WHEN 'SCHOLARSHIP' THEN '我申请该奖学金是因为它能支持我专注学习和研究。我已经具备一定的学术基础与学习计划，也会保持良好成绩、积极参与校园活动，并用实际成果证明自己值得获得支持。'
    WHEN 'CAREER_PLAN' THEN '毕业后我希望从事...方向的工作。短期目标是进入相关企业/机构积累经验，中期目标是负责项目或研究工作，长期目标是推动中越在该领域的合作与发展。'
    ELSE '一个好的回答应该先直接回应问题，再结合个人经历、申请目标、具体例子和未来计划，最后说明自己与学校、专业或奖学金的匹配度。'
  END
  WHEN language = 'EN' THEN CASE category
    WHEN 'PERSONAL' THEN 'My name is ... and I come from Vietnam. My academic background is connected to this application because I have studied ... and gained experience through projects, competitions, or internships. I chose this program because it matches my long-term goal. After enrollment, I will strengthen my foundation, join research or practical projects, and apply what I learn to my future career.'
    WHEN 'SCHOOL_MAJOR' THEN 'I chose this university and major because the curriculum, research direction, and practical resources fit my interests. My previous study and experience in ... prepare me for this field. I plan to focus on ..., join relevant projects, and build skills that solve real problems.'
    WHEN 'STUDY_PLAN' THEN 'My study plan has three stages: first, adapt to the academic environment and strengthen core knowledge; second, choose a research direction and join projects; third, complete a thesis or practical outcome and prepare for my career path.'
    ELSE 'A strong answer should answer the question directly, connect personal experience with the target program, include a concrete example, and end with a clear future plan.'
  END
  ELSE CASE category
    WHEN 'PERSONAL' THEN 'Em tên là ..., đến từ Việt Nam. Nền tảng học tập của em gắn với mục tiêu apply vì em đã học ... và có kinh nghiệm qua dự án, cuộc thi hoặc thực tập. Em chọn chương trình này vì phù hợp với định hướng dài hạn. Khi nhập học, em sẽ củng cố kiến thức nền, tham gia dự án/nghiên cứu và ứng dụng kiến thức cho nghề nghiệp tương lai.'
    WHEN 'SCHOOL_MAJOR' THEN 'Em chọn trường và ngành này vì chương trình học, hướng nghiên cứu và nguồn lực thực hành phù hợp với mục tiêu của em. Kinh nghiệm trước đây về ... giúp em có nền tảng cho ngành. Em dự định tập trung học ..., tham gia dự án liên quan và phát triển năng lực giải quyết vấn đề thực tế.'
    WHEN 'STUDY_PLAN' THEN 'Kế hoạch học tập của em gồm ba giai đoạn: đầu tiên thích nghi môi trường học và bổ sung kiến thức nền; tiếp theo chọn hướng nghiên cứu, tham gia dự án/môn học chuyên sâu; cuối cùng hoàn thành sản phẩm học thuật hoặc thực tiễn và chuẩn bị cho mục tiêu nghề nghiệp.'
    WHEN 'SCHOLARSHIP' THEN 'Em xin học bổng này vì nó giúp em tập trung vào học tập và nghiên cứu. Em đã có nền tảng học thuật, kế hoạch học tập rõ ràng và cam kết duy trì kết quả tốt, tham gia hoạt động, đóng góp bằng kết quả cụ thể.'
    WHEN 'CAREER_PLAN' THEN 'Sau khi tốt nghiệp, em muốn làm việc trong lĩnh vực .... Mục tiêu ngắn hạn là tích lũy kinh nghiệm tại doanh nghiệp/tổ chức liên quan; mục tiêu trung hạn là đảm nhận dự án chuyên môn; mục tiêu dài hạn là đóng góp cho hợp tác Việt-Trung hoặc sự phát triển của ngành.'
    ELSE 'Câu trả lời tốt nên trả lời trực tiếp câu hỏi, gắn với trải nghiệm cá nhân, nêu ví dụ cụ thể, liên hệ với trường/ngành/học bổng và kết thúc bằng kế hoạch rõ ràng.'
  END
END
WHERE sample_answer IS NULL OR btrim(sample_answer) = '';
