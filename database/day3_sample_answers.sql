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
    WHEN 'PERSONAL' THEN 'Em ten la ..., den tu Viet Nam. Nen tang hoc tap cua em gan voi muc tieu apply vi em da hoc ... va co kinh nghiem qua du an, cuoc thi hoac thuc tap. Em chon chuong trinh nay vi phu hop voi dinh huong dai han. Khi nhap hoc, em se cung co kien thuc nen, tham gia du an/nghien cuu va ung dung kien thuc cho nghe nghiep tuong lai.'
    WHEN 'SCHOOL_MAJOR' THEN 'Em chon truong va nganh nay vi chuong trinh hoc, huong nghien cuu va nguon luc thuc hanh phu hop voi muc tieu cua em. Kinh nghiem truoc day ve ... giup em co nen tang cho nganh. Em du dinh tap trung hoc ..., tham gia du an lien quan va phat trien nang luc giai quyet van de thuc te.'
    WHEN 'STUDY_PLAN' THEN 'Ke hoach hoc tap cua em gom ba giai doan: dau tien thich nghi moi truong hoc va bo sung kien thuc nen; tiep theo chon huong nghien cuu, tham gia du an/mon hoc chuyen sau; cuoi cung hoan thanh san pham hoc thuat hoac thuc tien va chuan bi cho muc tieu nghe nghiep.'
    WHEN 'SCHOLARSHIP' THEN 'Em xin hoc bong nay vi no giup em tap trung vao hoc tap va nghien cuu. Em da co nen tang hoc thuat, ke hoach hoc tap ro rang va cam ket duy tri ket qua tot, tham gia hoat dong, dong gop bang ket qua cu the.'
    WHEN 'CAREER_PLAN' THEN 'Sau khi tot nghiep, em muon lam viec trong linh vuc .... Muc tieu ngan han la tich luy kinh nghiem tai doanh nghiep/to chuc lien quan; muc tieu trung han la dam nhan du an chuyen mon; muc tieu dai han la dong gop cho hop tac Viet-Trung hoac su phat trien cua nganh.'
    ELSE 'Cau tra loi tot nen tra loi truc tiep cau hoi, gan voi trai nghiem ca nhan, neu vi du cu the, lien he voi truong/nganh/hoc bong va ket thuc bang ke hoach ro rang.'
  END
END
WHERE sample_answer IS NULL OR btrim(sample_answer) = '';
