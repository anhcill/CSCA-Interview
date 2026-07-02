import {
  DegreeLevel,
  DifficultyLevel,
  LanguageCode,
  PrismaClient,
  QuestionCategory,
  ai_task_type
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedRagKnowledge } from "./rag-rich-seed-data.js";
import { defaultPromptTemplates } from "../src/modules/ai/prompt-templates.js";
import { passwordHashRounds } from "../src/modules/auth/auth.utils.js";

const prisma = new PrismaClient();

type QuestionSeed = {
  category: QuestionCategory;
  degreeLevel?: DegreeLevel | null;
  difficulty: DifficultyLevel;
  expected: string;
  keywords: string;
  language: LanguageCode;
  questionText: string;
  sampleAnswer: string;
};

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ai-phongvan.local";
const userEmail = process.env.SEED_USER_EMAIL ?? "user@ai-phongvan.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456";
const userPassword = process.env.SEED_USER_PASSWORD ?? "User@123456";

async function main() {
  const adminPasswordHash = await bcrypt.hash(adminPassword, passwordHashRounds);
  const userPasswordHash = await bcrypt.hash(userPassword, passwordHashRounds);

  const admin = await prisma.user.upsert({
    create: {
      email: adminEmail,
      fullName: "Demo Admin",
      isActive: true,
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN"
    },
    update: {
      fullName: "Demo Admin",
      isActive: true,
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN"
    },
    where: { email: adminEmail }
  });

  const demoUser = await prisma.user.upsert({
    create: {
      email: userEmail,
      fullName: "Demo User",
      isActive: true,
      passwordHash: userPasswordHash,
      role: "USER"
    },
    update: {
      fullName: "Demo User",
      isActive: true,
      passwordHash: userPasswordHash,
      role: "USER"
    },
    where: { email: userEmail }
  });

  const [school, major, scholarship] = await Promise.all([
    prisma.school.upsert({
      create: {
        city: "Beijing",
        description: "Top Chinese university demo target for scholarship interview practice.",
        isActive: true,
        name: "Tsinghua University",
        nameEn: "Tsinghua University",
        nameZh: "清华大学",
        province: "Beijing",
        websiteUrl: "https://www.tsinghua.edu.cn"
      },
      update: { isActive: true },
      where: { name: "Tsinghua University" }
    }),
    prisma.major.upsert({
      create: {
        degreeLevel: DegreeLevel.MASTER,
        description: "Computer Science and Technology demo major.",
        isActive: true,
        name: "Computer Science and Technology",
        nameEn: "Computer Science and Technology",
        nameZh: "计算机科学与技术"
      },
      update: { isActive: true },
      where: {
        name_degreeLevel: {
          degreeLevel: DegreeLevel.MASTER,
          name: "Computer Science and Technology"
        }
      }
    }),
    prisma.scholarship.upsert({
      create: {
        code: "CSC",
        description: "Chinese Government Scholarship demo program.",
        isActive: true,
        name: "Chinese Government Scholarship"
      },
      update: { isActive: true },
      where: { name: "Chinese Government Scholarship" }
    })
  ]);

  await prisma.userProfile.upsert({
    create: {
      careerPlan: "Work as an AI engineer, then build education technology tools for Vietnamese students.",
      degreeLevel: DegreeLevel.MASTER,
      gpa: "3.65/4.0",
      hskLevel: "HSK 5",
      researchExperience: "Built a small OCR and interview practice prototype.",
      scholarshipType: scholarship.name,
      strengths: "Self-study, persistence, product mindset.",
      studyPlan: "Year 1: strengthen Chinese and core CS courses. Year 2: join an AI research lab and complete thesis. After graduation: apply AI to accessible education products.",
      targetMajor: major.name,
      targetSchool: school.name,
      userId: demoUser.id,
      weaknesses: "Need more academic publication experience."
    },
    update: {
      degreeLevel: DegreeLevel.MASTER,
      scholarshipType: scholarship.name,
      studyPlan: "Year 1: strengthen Chinese and core CS courses. Year 2: join an AI research lab and complete thesis. After graduation: apply AI to accessible education products.",
      targetMajor: major.name,
      targetSchool: school.name
    },
    where: { userId: demoUser.id }
  });

  for (const template of defaultPromptTemplates) {
    await prisma.ai_prompt_templates.upsert({
      create: {
        created_by: admin.id,
        is_active: true,
        name: template.name,
        output_schema: template.outputSchema,
        system_prompt: template.systemPrompt,
        task_type: template.taskType,
        user_prompt_template: template.userPromptTemplate,
        version: template.version
      },
      update: {
        is_active: true,
        output_schema: template.outputSchema,
        system_prompt: template.systemPrompt,
        user_prompt_template: template.userPromptTemplate
      },
      where: {
        task_type_name_version: {
          name: template.name,
          task_type: template.taskType,
          version: template.version
        }
      }
    });
  }

  let questionCount = 0;
  for (const question of buildQuestionSeeds()) {
    await upsertQuestion(question, {
      adminId: admin.id,
      majorId: major.id,
      scholarshipId: scholarship.id,
      schoolId: school.id
    });
    questionCount += 1;
  }

  const ragStats = await seedRagKnowledge(prisma);

  console.log(`[seed] admin=${adminEmail} password=${adminPassword}`);
  console.log(`[seed] user=${userEmail} password=${userPassword}`);
  console.log(`[seed] promptTemplates=${defaultPromptTemplates.length} questions=${questionCount}`);
  console.log(`[seed] ragSchools=${ragStats.schools} ragMajors=${ragStats.majors} ragScholarships=${ragStats.scholarships}`);
}

async function upsertQuestion(
  question: QuestionSeed,
  links: { adminId: string; majorId: string; scholarshipId: string; schoolId: string }
) {
  const existing = await prisma.question.findFirst({
    where: {
      deletedAt: null,
      language: question.language,
      questionText: question.questionText
    }
  });

  const data = {
    category: question.category,
    createdBy: links.adminId,
    degreeLevel: question.degreeLevel ?? DegreeLevel.MASTER,
    difficulty: question.difficulty,
    isActive: true,
    keywords: question.keywords,
    language: question.language,
    majorId: links.majorId,
    questionText: question.questionText,
    sampleAnswer: question.sampleAnswer,
    scholarshipId: links.scholarshipId,
    schoolId: links.schoolId,
    suggestedAnswerLogic: question.expected
  };

  if (existing) {
    await prisma.question.update({
      data: {
        ...data,
        updatedBy: links.adminId
      },
      where: { id: existing.id }
    });
    return;
  }

  await prisma.question.create({ data });
}

function buildQuestionSeeds(): QuestionSeed[] {
  return [
    qv(LanguageCode.VI, QuestionCategory.PERSONAL, DifficultyLevel.EASY, "Bạn hãy giới thiệu bản thân trong 60 giây.", "Mở đầu bằng tên, nền tảng học tập, ngành apply, 1-2 điểm mạnh và mục tiêu học bổng.", "gioi thieu, ban than, diem manh", "Em là sinh viên tốt nghiệp ngành Công nghệ thông tin, quan tâm đến AI trong giáo dục. Em muốn học thạc sĩ tại Trung Quốc để phát triển năng lực nghiên cứu và xây dựng sản phẩm hỗ trợ học tập."),
    qv(LanguageCode.VI, QuestionCategory.SCHOOL_MAJOR, DifficultyLevel.MEDIUM, "Vì sao bạn chọn Tsinghua University và ngành Computer Science and Technology?", "Nêu 2 lý do chọn trường, 2 lý do chọn ngành, liên hệ năng lực bản thân và mục tiêu nghề nghiệp.", "chon truong, chon nganh, fit", "Em chọn Tsinghua vì môi trường nghiên cứu mạnh và ngành phù hợp định hướng AI. Nền tảng lập trình và dự án OCR giúp em có cơ sở để theo học chương trình này."),
    qv(LanguageCode.VI, QuestionCategory.STUDY_PLAN, DifficultyLevel.MEDIUM, "Hãy trình bày kế hoạch học tập 2 năm của bạn.", "Chia theo giai đoạn: ngôn ngữ, môn nền tảng, nghiên cứu, luận văn, kết quả đầu ra.", "ke hoach hoc tap, giai doan", "Năm đầu em sẽ hoàn thiện tiếng Trung, học các môn nền tảng và tìm nhóm nghiên cứu. Năm hai em tập trung đề tài luận văn về AI ứng dụng giáo dục và chuẩn bị công bố kết quả."),
    qv(LanguageCode.VI, QuestionCategory.SCHOLARSHIP, DifficultyLevel.MEDIUM, "Vì sao bạn xứng đáng nhận học bổng CSC?", "Nêu thành tích, tiềm năng, cam kết học tập, đóng góp sau tốt nghiệp; tránh nói chỉ vì cần tài chính.", "hoc bong, CSC, xung dang", "Em xứng đáng vì có nền tảng học tập tốt, mục tiêu rõ và đã có sản phẩm thử nghiệm. Học bổng giúp em tập trung nghiên cứu và sau này đóng góp cho giáo dục công nghệ tại Việt Nam."),
    qv(LanguageCode.VI, QuestionCategory.CAREER_PLAN, DifficultyLevel.MEDIUM, "Sau khi tốt nghiệp bạn dự định làm gì?", "Nêu kế hoạch ngắn hạn, dài hạn, nơi áp dụng kiến thức và tác động mong muốn.", "nghe nghiep, sau tot nghiep", "Ngắn hạn em muốn làm AI engineer trong lĩnh vực giáo dục. Dài hạn em muốn xây dựng nền tảng luyện phỏng vấn và học ngôn ngữ cho học sinh Việt Nam apply học bổng quốc tế."),
    qv(LanguageCode.VI, QuestionCategory.RESEARCH, DifficultyLevel.HARD, "Nếu được chọn một đề tài nghiên cứu thạc sĩ, bạn sẽ chọn gì và vì sao?", "Nêu vấn đề, câu hỏi nghiên cứu, phương pháp, dữ liệu, ý nghĩa thực tiễn.", "de tai, nghien cuu, luan van", "Em muốn nghiên cứu hệ thống đánh giá câu trả lời phỏng vấn bằng AI. Đề tài kết hợp NLP, speech và rubrics học bổng, có giá trị thực tiễn cho người học."),
    qv(LanguageCode.VI, QuestionCategory.ACADEMIC, DifficultyLevel.MEDIUM, "Môn học nào ảnh hưởng nhiều nhất đến định hướng học thuật của bạn?", "Nêu môn học, kiến thức chính, dự án/bài tập liên quan, tác động đến hướng apply.", "mon hoc, hoc thuat", "Môn Machine Learning giúp em hiểu cách mô hình học từ dữ liệu và đánh giá kết quả. Từ đó em quan tâm đến ứng dụng AI vào giáo dục và luyện phỏng vấn."),
    qv(LanguageCode.VI, QuestionCategory.SITUATION, DifficultyLevel.MEDIUM, "Nếu gặp rào cản tiếng Trung trong học kỳ đầu, bạn xử lý thế nào?", "Đưa kế hoạch cụ thể: lớp tiếng, nhóm học, ghi chú song ngữ, hỏi giảng viên, đo tiến bộ.", "tinh huong, tieng Trung", "Em sẽ học từ vựng chuyên ngành hằng ngày, tham gia nhóm học với bạn Trung Quốc, ghi chú song ngữ và trao đổi sớm với giảng viên khi chưa hiểu bài."),
    qv(LanguageCode.VI, QuestionCategory.LANGUAGE, DifficultyLevel.EASY, "Bạn đã chuẩn bị tiếng Trung như thế nào cho việc du học?", "Nêu trình độ, cách học, mục tiêu HSK/HSKK, kế hoạch giao tiếp học thuật.", "HSK, tieng Trung", "Em đã học đến HSK 5 và luyện nghe nói qua phỏng vấn mô phỏng. Trước khi nhập học em đặt mục tiêu tăng vốn từ chuyên ngành và luyện thuyết trình học thuật."),
    qv(LanguageCode.VI, QuestionCategory.PERSONAL, DifficultyLevel.MEDIUM, "Điểm yếu lớn nhất của bạn là gì và bạn đang cải thiện ra sao?", "Chọn điểm yếu thật nhưng kiểm soát được, nêu hành động cải thiện và bằng chứng tiến bộ.", "diem yeu, cai thien", "Điểm yếu của em là ít kinh nghiệm công bố học thuật. Em đang đọc paper có hệ thống, viết review hằng tuần và tìm mentor để chuẩn bị đề tài nghiên cứu tốt hơn."),
    qv(LanguageCode.VI, QuestionCategory.SCHOOL_MAJOR, DifficultyLevel.HARD, "Bạn hiểu gì về sự khác biệt giữa học ngành này ở Trung Quốc và ở Việt Nam?", "So sánh môi trường nghiên cứu, doanh nghiệp, dữ liệu, network; tránh chê bai một chiều.", "so sanh, Trung Quoc, Viet Nam", "Trung Quốc có hệ sinh thái AI lớn, nhiều phòng lab và bài toán quy mô cao. Việt Nam có nhu cầu ứng dụng giáo dục rất thực tế. Em muốn học cách nghiên cứu bài bản rồi áp dụng phù hợp ở Việt Nam."),
    qv(LanguageCode.VI, QuestionCategory.SCHOLARSHIP, DifficultyLevel.HARD, "Nếu hội đồng hỏi bạn sẽ đóng góp gì cho quan hệ Việt Nam - Trung Quốc, bạn trả lời sao?", "Liên hệ chuyên môn, giao lưu sinh viên, dự án giáo dục/công nghệ, tác động dài hạn.", "dong gop, quan he Viet Trung", "Em muốn làm cầu nối qua các dự án AI giáo dục song ngữ, chia sẻ kinh nghiệm apply học bổng và hợp tác với bạn học Trung Quốc trong sản phẩm hỗ trợ học tập."),
    qv(LanguageCode.VI, QuestionCategory.RESEARCH, DifficultyLevel.MEDIUM, "Bạn từng đọc paper hoặc tài liệu nào liên quan đến hướng nghiên cứu chưa?", "Nêu paper/sách thật nếu có; nếu chưa, nêu nhóm chủ đề đã đọc và kế hoạch đọc tiếp.", "paper, tai lieu, literature", "Em đã đọc các tài liệu về rubric-based evaluation và speech-to-text trong học ngôn ngữ. Em đang xây danh sách paper về automated speaking assessment để chuẩn bị đề tài."),
    qv(LanguageCode.VI, QuestionCategory.SITUATION, DifficultyLevel.HARD, "Nếu kết quả nghiên cứu không như kỳ vọng sau 6 tháng, bạn sẽ làm gì?", "Nêu cách kiểm tra giả thuyết, gặp supervisor, thu hẹp scope, đổi phương pháp, quản trị thời gian.", "nghien cuu that bai, dieu chinh", "Em sẽ rà soát dữ liệu và giả thuyết, trao đổi với supervisor, thu hẹp phạm vi nếu cần và đặt mốc thử nghiệm ngắn để quyết định giữ hay đổi phương pháp."),
    qv(LanguageCode.VI, QuestionCategory.CAREER_PLAN, DifficultyLevel.HARD, "Bạn muốn giải quyết vấn đề cụ thể nào trong ngành giáo dục bằng AI?", "Nêu vấn đề rõ, người dùng, cách AI hỗ trợ, rủi ro và chỉ số thành công.", "AI giao duc, van de", "Em muốn giải quyết thiếu phản hồi cá nhân khi học sinh luyện phỏng vấn. AI có thể chấm theo rubric, gợi ý sửa câu trả lời và theo dõi tiến bộ, nhưng cần minh bạch và bảo vệ dữ liệu."),
    qv(LanguageCode.VI, QuestionCategory.ACADEMIC, DifficultyLevel.HARD, "Bạn sẽ thuyết phục giáo sư nhận bạn vào nhóm nghiên cứu thế nào?", "Nêu fit nghiên cứu, kỹ năng, sản phẩm đã làm, thái độ học hỏi, kế hoạch đóng góp.", "giao su, nhom nghien cuu", "Em sẽ trình bày dự án đã làm, kỹ năng lập trình/NLP, câu hỏi nghiên cứu cụ thể và kế hoạch 90 ngày đầu để chứng minh khả năng đóng góp."),
    qv(LanguageCode.VI, QuestionCategory.PERSONAL, DifficultyLevel.HARD, "Hãy kể một lần bạn thất bại và bài học rút ra.", "Dùng STAR: tình huống, hành động, kết quả, bài học, cách áp dụng khi du học.", "that bai, bai hoc, STAR", "Trong một dự án, em từng đánh giá thấp phần dữ liệu nên tiến độ chậm. Sau đó em học cách chia mốc nhỏ, kiểm thử sớm và giao tiếp rủi ro rõ hơn với nhóm."),
    qv(LanguageCode.VI, QuestionCategory.LANGUAGE, DifficultyLevel.MEDIUM, "Nếu phải trả lời phỏng vấn bằng tiếng Trung, bạn lo nhất điều gì?", "Nêu nỗi lo cụ thể và cách luyện: cấu trúc câu, từ khóa chuyên ngành, mock interview.", "phong van tieng Trung", "Em lo nhất là dùng từ chuyên ngành chưa tự nhiên. Vì vậy em chuẩn bị bộ câu trả lời theo cấu trúc, luyện nói hằng ngày và nhờ người sửa phát âm/từ vựng."),
    qv(LanguageCode.VI, QuestionCategory.STUDY_PLAN, DifficultyLevel.HARD, "Kế hoạch học tập của bạn đo lường kết quả bằng chỉ số nào?", "Nêu KPI học thuật: điểm, HSK, paper review, lab application, prototype, thesis milestone.", "KPI, do luong, hoc tap", "Em sẽ đo bằng HSK/HSKK, điểm môn cốt lõi, số paper review mỗi tháng, tiến độ prototype, phản hồi của supervisor và mốc hoàn thành luận văn."),
    qv(LanguageCode.VI, QuestionCategory.OTHER, DifficultyLevel.MEDIUM, "Nếu không nhận học bổng này, kế hoạch của bạn là gì?", "Cho thấy cam kết với mục tiêu, có phương án B thực tế, không bi quan.", "phuong an B, commitment", "Nếu chưa nhận được học bổng, em vẫn tiếp tục học tiếng Trung, cải thiện hồ sơ nghiên cứu và apply lại hoặc tìm chương trình phù hợp khác. Mục tiêu học AI giáo dục của em không thay đổi."),

    q(LanguageCode.ZH, QuestionCategory.PERSONAL, DifficultyLevel.EASY, "介绍姓名、专业背景、申请目标和一个核心优势。", "自我介绍, 背景, 目标", "我本科阶段学习计算机相关专业，对人工智能教育应用很感兴趣。我希望通过硕士学习提高研究能力，并把技术用于帮助学生准备国际奖学金面试。", "请简单介绍一下你自己。"),
    q(LanguageCode.ZH, QuestionCategory.SCHOOL_MAJOR, DifficultyLevel.MEDIUM, "说明选择学校和专业的具体原因，并联系个人经历。", "选择学校, 专业匹配", "我选择清华大学和计算机科学与技术专业，是因为这里有强的科研环境和优秀的学术资源。我的项目经历与人工智能教育应用有关，和专业方向比较匹配。", "你为什么选择清华大学和计算机科学与技术专业？"),
    q(LanguageCode.ZH, QuestionCategory.STUDY_PLAN, DifficultyLevel.MEDIUM, "按学期或年份说明课程、语言、科研和论文计划。", "学习计划, 阶段", "第一年我会加强中文和专业基础课程，同时寻找合适的研究方向。第二年我希望加入实验室，完成与AI教育应用相关的硕士论文。", "请说明你研究生阶段的学习计划。"),
    q(LanguageCode.ZH, QuestionCategory.SCHOLARSHIP, DifficultyLevel.MEDIUM, "解释奖学金如何支持学术目标，而不只强调经济帮助。", "奖学金, 目标", "CSC奖学金能让我更专注于学习和科研。我希望利用这个机会提高专业能力，毕业后把在中国学到的知识应用到教育技术领域。", "你为什么申请中国政府奖学金？"),
    q(LanguageCode.ZH, QuestionCategory.CAREER_PLAN, DifficultyLevel.MEDIUM, "说明短期工作方向、长期愿景和社会价值。", "职业规划, 毕业后", "毕业后我希望先成为人工智能工程师，积累教育技术产品经验。长期来看，我想开发帮助学生进行面试训练和语言学习的平台。", "毕业以后你有什么职业规划？"),
    q(LanguageCode.ZH, QuestionCategory.RESEARCH, DifficultyLevel.HARD, "提出研究问题、方法、数据和应用价值。", "研究方向, 论文", "我想研究基于评分标准的面试回答自动评估。这个方向可以结合自然语言处理、语音识别和教育评价，对奖学金申请者有实际帮助。", "如果选择硕士论文题目，你会研究什么？为什么？"),
    q(LanguageCode.ZH, QuestionCategory.ACADEMIC, DifficultyLevel.MEDIUM, "说明课程内容、学到的方法和对专业方向的影响。", "课程, 学术背景", "机器学习课程对我影响最大，因为它让我理解模型如何从数据中学习，并学习如何评估模型效果。这也让我关注AI在教育场景中的应用。", "哪门课程对你的学术方向影响最大？"),
    q(LanguageCode.ZH, QuestionCategory.SITUATION, DifficultyLevel.MEDIUM, "提出具体解决步骤：语言学习、同伴帮助、请教老师、复盘。", "语言困难, 适应", "如果遇到语言困难，我会提前预习专业词汇，课后向老师和同学请教，并用中英双语整理笔记，逐步提高课堂理解能力。", "如果在中国学习时遇到语言困难，你会怎么办？"),
    q(LanguageCode.ZH, QuestionCategory.LANGUAGE, DifficultyLevel.EASY, "说明HSK水平、学习方法和下一步目标。", "中文, HSK", "我已经学习到HSK五级，并通过模拟面试练习口语。入学前我会继续积累专业词汇，提高学术表达能力。", "你为中文学习做了哪些准备？"),
    q(LanguageCode.ZH, QuestionCategory.PERSONAL, DifficultyLevel.MEDIUM, "选择真实但可改善的弱点，并说明行动和进步。", "缺点, 改进", "我的不足是学术论文发表经验不够。现在我通过阅读论文、写读书笔记和寻找导师建议来提高研究准备能力。", "你认为自己最大的不足是什么？你如何改进？"),
    q(LanguageCode.ZH, QuestionCategory.SCHOOL_MAJOR, DifficultyLevel.HARD, "比较科研环境、行业机会、数据规模和回国应用。", "中越比较, 专业", "中国在人工智能领域有更大的产业和科研生态，能让我接触更多实际问题。越南教育技术需求很大，我希望把在中国学到的方法带回去应用。", "你认为在中国学习这个专业与在越南学习有什么不同？"),
    q(LanguageCode.ZH, QuestionCategory.SCHOLARSHIP, DifficultyLevel.HARD, "联系专业、文化交流和长期合作价值。", "贡献, 中越交流", "我希望通过AI教育项目和学生经验分享，促进中越青年在学习和科技方面的交流。未来也希望参与两国教育技术合作。", "你能为中越交流做出什么贡献？"),
    q(LanguageCode.ZH, QuestionCategory.RESEARCH, DifficultyLevel.MEDIUM, "提到读过的文献方向、研究空白和继续阅读计划。", "论文, 文献", "我读过一些关于自动口语评估和NLP评分的资料。下一步我会重点阅读rubric-based evaluation和speech-to-text在教育中的应用研究。", "你读过哪些与你研究方向相关的论文或资料？"),
    q(LanguageCode.ZH, QuestionCategory.SITUATION, DifficultyLevel.HARD, "说明验证假设、缩小范围、咨询导师和调整方法。", "研究失败, 调整", "我会先检查数据和实验设计，再和导师讨论问题。如果方向太大，我会缩小研究范围，并用短周期实验验证新的方法。", "如果研究六个月后没有理想结果，你会怎么办？"),
    q(LanguageCode.ZH, QuestionCategory.CAREER_PLAN, DifficultyLevel.HARD, "提出具体教育问题、AI方案、风险和成功指标。", "AI教育, 问题", "我想解决学生练习面试时缺少个性化反馈的问题。AI可以根据评分标准给出改进建议，但必须注意隐私保护和反馈透明。", "你希望用AI解决教育领域的什么具体问题？"),
    q(LanguageCode.ZH, QuestionCategory.ACADEMIC, DifficultyLevel.HARD, "说明研究匹配、技能、项目证据和入组后计划。", "导师, 实验室", "我会展示自己做过的项目、编程能力和明确的研究问题，并提出入组前三个月的学习和实验计划，让导师看到我的执行力。", "你会如何说服导师接受你加入研究团队？"),
    q(LanguageCode.ZH, QuestionCategory.PERSONAL, DifficultyLevel.HARD, "用STAR结构讲失败、行动、结果和反思。", "失败经历, 反思", "我曾在一个项目中低估数据准备时间，导致进度延迟。后来我学会把任务拆小、提前测试数据质量，并及时和团队沟通风险。", "请讲一次失败经历以及你的收获。"),
    q(LanguageCode.ZH, QuestionCategory.LANGUAGE, DifficultyLevel.MEDIUM, "承认具体困难，并说明训练结构和专业词汇。", "中文面试, 担心", "我最担心专业词汇表达不够自然。因此我准备常见问题框架，每天练习口语，并请老师或朋友纠正表达。", "如果面试用中文进行，你最担心什么？"),
    q(LanguageCode.ZH, QuestionCategory.STUDY_PLAN, DifficultyLevel.HARD, "用KPI说明语言、课程、论文、实验室和项目成果。", "学习指标, KPI", "我会用HSK提升、核心课程成绩、每月论文阅读数量、实验进展和导师反馈来衡量学习计划是否有效。", "你如何衡量自己的学习计划是否成功？"),
    q(LanguageCode.ZH, QuestionCategory.OTHER, DifficultyLevel.MEDIUM, "表达目标稳定、方案B现实、继续提升材料。", "备选方案, 目标", "如果这次没有获得奖学金，我会继续提高中文和科研材料，寻找其他适合的项目或下一轮继续申请。我的学习目标不会改变。", "如果没有获得这个奖学金，你有什么计划？"),

    q(LanguageCode.EN, QuestionCategory.PERSONAL, DifficultyLevel.EASY, "Introduce background, target program, one strength, and academic goal.", "introduction, background, strength", "I studied computer science and became interested in AI for education. I want to pursue a master's degree in China to strengthen my research ability and build useful learning tools.", "Please introduce yourself in one minute."),
    q(LanguageCode.EN, QuestionCategory.SCHOOL_MAJOR, DifficultyLevel.MEDIUM, "Give specific school and major reasons and connect them with experience.", "school fit, major fit", "I chose Tsinghua and Computer Science because the academic environment is strong and matches my AI education direction. My OCR and interview practice project gives me a practical foundation.", "Why did you choose Tsinghua University and Computer Science and Technology?"),
    q(LanguageCode.EN, QuestionCategory.STUDY_PLAN, DifficultyLevel.MEDIUM, "Break plan into language, coursework, research, thesis, and outcomes.", "study plan, stages", "In the first year, I will strengthen Chinese and core CS courses. In the second year, I plan to join a lab, complete an AI education thesis, and prepare a research prototype.", "What is your two-year study plan?"),
    q(LanguageCode.EN, QuestionCategory.SCHOLARSHIP, DifficultyLevel.MEDIUM, "Explain merit, commitment, and how scholarship supports academic goals.", "scholarship, CSC, merit", "I deserve consideration because I have a clear goal, relevant technical background, and a project direction with social value. The scholarship would let me focus fully on study and research.", "Why do you deserve the CSC scholarship?"),
    q(LanguageCode.EN, QuestionCategory.CAREER_PLAN, DifficultyLevel.MEDIUM, "Describe short-term role, long-term vision, and impact.", "career plan, after graduation", "After graduation, I want to work as an AI engineer in education technology. Long term, I hope to build tools that help Vietnamese students prepare for global scholarship interviews.", "What do you plan to do after graduation?"),
    q(LanguageCode.EN, QuestionCategory.RESEARCH, DifficultyLevel.HARD, "Name problem, method, data, and practical value.", "research topic, thesis", "I would study automated interview answer evaluation using rubrics. It combines NLP, speech technology, and educational assessment, and can directly support scholarship applicants.", "If you could choose a master's thesis topic, what would it be and why?"),
    q(LanguageCode.EN, QuestionCategory.ACADEMIC, DifficultyLevel.MEDIUM, "Mention course, core concept, project, and influence.", "course, academic direction", "Machine Learning influenced me most because it taught me how models learn from data and how evaluation works. It pushed me toward AI applications in education.", "Which course influenced your academic direction the most?"),
    q(LanguageCode.EN, QuestionCategory.SITUATION, DifficultyLevel.MEDIUM, "Give concrete steps for language adaptation.", "language barrier, adaptation", "I would prepare technical vocabulary before class, review notes bilingually, ask classmates and teachers early, and track weekly progress in listening and speaking.", "What would you do if you faced a Chinese language barrier in the first semester?"),
    q(LanguageCode.EN, QuestionCategory.LANGUAGE, DifficultyLevel.EASY, "State language level, practice method, and next goal.", "Chinese, HSK", "I have prepared through HSK study and mock interviews. Before enrollment, I will focus on academic vocabulary and spoken fluency for classroom discussion.", "How have you prepared your Chinese language ability?"),
    q(LanguageCode.EN, QuestionCategory.PERSONAL, DifficultyLevel.MEDIUM, "Pick a real weakness and show improvement action.", "weakness, improvement", "My main weakness is limited publication experience. I am improving it by reading papers systematically, writing weekly summaries, and preparing a focused research proposal.", "What is your biggest weakness and how are you improving it?"),
    q(LanguageCode.EN, QuestionCategory.SCHOOL_MAJOR, DifficultyLevel.HARD, "Compare research ecosystem, industry exposure, data scale, and return value.", "China, Vietnam, major comparison", "China offers a larger AI research and industry ecosystem, while Vietnam has urgent education technology needs. I want to learn rigorous methods in China and adapt them to Vietnam.", "How is studying this major in China different from studying it in Vietnam?"),
    q(LanguageCode.EN, QuestionCategory.SCHOLARSHIP, DifficultyLevel.HARD, "Connect expertise, cultural exchange, and long-term cooperation.", "contribution, China Vietnam", "I can contribute by building bilingual AI education tools, sharing scholarship preparation experience, and joining student projects that encourage China-Vietnam academic exchange.", "How can you contribute to China-Vietnam exchange?"),
    q(LanguageCode.EN, QuestionCategory.RESEARCH, DifficultyLevel.MEDIUM, "Mention literature direction and next reading plan.", "papers, literature review", "I have read materials about automated speaking assessment and NLP-based scoring. Next, I plan to focus on rubric-based evaluation and speech-to-text reliability in education.", "What papers or materials have you read related to your research direction?"),
    q(LanguageCode.EN, QuestionCategory.SITUATION, DifficultyLevel.HARD, "Explain hypothesis review, supervisor feedback, scope reduction, method change.", "research setback, adjustment", "I would review my data and assumptions, discuss with my supervisor, narrow the research scope if needed, and run short experiments before deciding whether to change methods.", "What would you do if your research results were poor after six months?"),
    q(LanguageCode.EN, QuestionCategory.CAREER_PLAN, DifficultyLevel.HARD, "Define a specific education problem, AI solution, risk, and success metric.", "AI education problem", "I want to solve the lack of personalized feedback in interview practice. AI can score answers by rubric and suggest revisions, but privacy and transparency must be designed carefully.", "What specific education problem do you want to solve with AI?"),
    q(LanguageCode.EN, QuestionCategory.ACADEMIC, DifficultyLevel.HARD, "Show research fit, skills, evidence, and first 90-day plan.", "professor, research group", "I would show my project experience, programming and NLP skills, a clear research question, and a practical 90-day plan for reading, replication, and prototype work.", "How would you convince a professor to accept you into their research group?"),
    q(LanguageCode.EN, QuestionCategory.PERSONAL, DifficultyLevel.HARD, "Use STAR: situation, action, result, lesson.", "failure, lesson, STAR", "In one project, I underestimated data preparation and delayed progress. I learned to split tasks, test data quality early, and communicate risks with the team.", "Tell us about a failure and what you learned."),
    q(LanguageCode.EN, QuestionCategory.LANGUAGE, DifficultyLevel.MEDIUM, "Name concrete worry and practice method.", "Chinese interview, concern", "My biggest concern is using technical vocabulary naturally. I practice with structured answers, daily speaking drills, and correction from teachers or native speakers.", "If the interview is in Chinese, what worries you most?"),
    q(LanguageCode.EN, QuestionCategory.STUDY_PLAN, DifficultyLevel.HARD, "Use measurable indicators for language, course, reading, lab, prototype, thesis.", "KPI, study outcome", "I will measure progress by HSK improvement, core course grades, monthly paper reviews, lab feedback, prototype milestones, and thesis progress.", "How will you measure whether your study plan is successful?"),
    q(LanguageCode.EN, QuestionCategory.OTHER, DifficultyLevel.MEDIUM, "Show stable goal and realistic backup plan.", "backup plan, commitment", "If I do not receive this scholarship, I will keep improving my Chinese and research proposal, apply for other suitable programs, and try again in the next cycle.", "What is your plan if you do not receive this scholarship?")
  ];
}

function q(
  language: LanguageCode,
  category: QuestionCategory,
  difficulty: DifficultyLevel,
  expected: string,
  keywords: string,
  sampleAnswer: string,
  questionText: string
): QuestionSeed {
  return {
    category,
    degreeLevel: DegreeLevel.MASTER,
    difficulty,
    expected,
    keywords,
    language,
    questionText,
    sampleAnswer
  };
}

function qv(
  language: LanguageCode,
  category: QuestionCategory,
  difficulty: DifficultyLevel,
  questionText: string,
  expected: string,
  keywords: string,
  sampleAnswer: string
): QuestionSeed {
  return q(language, category, difficulty, expected, keywords, sampleAnswer, questionText);
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
