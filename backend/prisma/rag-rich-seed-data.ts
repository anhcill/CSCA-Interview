import { DegreeLevel, type PrismaClient } from "@prisma/client";

type SchoolSeed = {
  key: string;
  matchNames: string[];
  data: {
    name: string;
    nameEn: string;
    nameZh: string;
    city: string;
    province: string;
    websiteUrl: string;
    description: string;
    ranking: number;
    rankingType: string;
    strongMajors: string;
    researchAreas: string;
    admissionRequirements: string;
    interviewTips: string;
    programLanguage: string;
    campusInfo: string;
    notableAlumni: string;
    achievements: string;
    isActive: boolean;
  };
};

type MajorSeed = {
  key: string;
  matchNames: string[];
  data: {
    name: string;
    nameEn: string;
    nameZh: string;
    degreeLevel: DegreeLevel;
    description: string;
    requirements: string;
    researchAreas: string;
    researchLabs: string;
    careerOutcomes: string;
    interviewFocus: string;
    isActive: boolean;
  };
};

type ScholarshipSeed = {
  key: string;
  matchNames: string[];
  data: {
    name: string;
    code: string;
    description: string;
    requirements: string;
    deadline: string;
    coverage: string;
    studyPlanRequirements: string;
    interviewFormat: string;
    commonInterviewQuestions: string[];
    tips: string;
    isActive: boolean;
  };
};

type SeedStats = {
  schools: number;
  majors: number;
  scholarships: number;
  schoolMajors: number;
  schoolScholarships: number;
};

export async function seedRagKnowledge(prisma: PrismaClient): Promise<SeedStats> {
  const schoolIdsByKey = new Map<string, string[]>();
  const majorIdByKey = new Map<string, string>();
  const scholarshipIdsByKey = new Map<string, string[]>();

  for (const school of schoolSeeds) {
    schoolIdsByKey.set(school.key, await upsertSchool(prisma, school));
  }

  for (const major of majorSeeds) {
    majorIdByKey.set(major.key, await upsertMajor(prisma, major));
  }

  for (const scholarship of scholarshipSeeds) {
    scholarshipIdsByKey.set(scholarship.key, await upsertScholarship(prisma, scholarship));
  }

  let schoolMajors = 0;
  let schoolScholarships = 0;

  for (const link of schoolMajorLinks) {
    const schoolIds = schoolIdsByKey.get(link.schoolKey) ?? [];
    for (const majorKey of link.majorKeys) {
      const majorId = majorIdByKey.get(majorKey);
      if (!majorId) continue;
      for (const schoolId of schoolIds) {
        await upsertSchoolMajor(prisma, schoolId, majorId, link.note);
        schoolMajors += 1;
      }
    }
  }

  for (const link of schoolScholarshipLinks) {
    const schoolIds = schoolIdsByKey.get(link.schoolKey) ?? [];
    for (const scholarshipKey of link.scholarshipKeys) {
      const scholarshipIds = scholarshipIdsByKey.get(scholarshipKey) ?? [];
      for (const schoolId of schoolIds) {
        for (const scholarshipId of scholarshipIds) {
          await upsertSchoolScholarship(prisma, schoolId, scholarshipId, link.note);
          schoolScholarships += 1;
        }
      }
    }
  }

  return {
    majors: majorSeeds.length,
    scholarships: scholarshipSeeds.length,
    schoolMajors,
    schoolScholarships,
    schools: schoolSeeds.length
  };
}

async function upsertSchool(prisma: PrismaClient, seed: SchoolSeed) {
  const matches = await prisma.school.findMany({
    where: {
      OR: seed.matchNames.flatMap((name) => [
        { name: { equals: name, mode: "insensitive" as const } },
        { nameEn: { equals: name, mode: "insensitive" as const } },
        { nameZh: { equals: name, mode: "insensitive" as const } }
      ])
    },
    orderBy: { name: "asc" }
  });

  if (!matches.length) {
    const created = await prisma.school.create({ data: seed.data });
    return [created.id];
  }

  const primary = matches.find((school) => school.name.toLowerCase() === seed.data.name.toLowerCase()) ?? matches[0];
  const ids: string[] = [];

  for (const school of matches) {
    const keepLocalName = school.id !== primary.id;
    const updated = await prisma.school.update({
      data: keepLocalName
        ? {
            achievements: seed.data.achievements,
            admissionRequirements: seed.data.admissionRequirements,
            campusInfo: seed.data.campusInfo,
            city: school.city ?? seed.data.city,
            description: seed.data.description,
            interviewTips: seed.data.interviewTips,
            isActive: true,
            nameEn: seed.data.nameEn,
            nameZh: seed.data.nameZh,
            notableAlumni: seed.data.notableAlumni,
            programLanguage: seed.data.programLanguage,
            province: school.province ?? seed.data.province,
            ranking: seed.data.ranking,
            rankingType: seed.data.rankingType,
            researchAreas: seed.data.researchAreas,
            strongMajors: seed.data.strongMajors,
            websiteUrl: school.websiteUrl ?? seed.data.websiteUrl
          }
        : seed.data,
      where: { id: school.id }
    });
    ids.push(updated.id);
  }

  return ids;
}

async function upsertMajor(prisma: PrismaClient, seed: MajorSeed) {
  const matches = await prisma.major.findMany({
    where: {
      degreeLevel: seed.data.degreeLevel,
      OR: seed.matchNames.flatMap((name) => [
        { name: { equals: name, mode: "insensitive" as const } },
        { nameEn: { equals: name, mode: "insensitive" as const } },
        { nameZh: { equals: name, mode: "insensitive" as const } }
      ])
    },
    orderBy: { name: "asc" }
  });

  if (!matches.length) {
    const created = await prisma.major.create({ data: seed.data });
    return created.id;
  }

  const primary = matches.find((major) => major.name.toLowerCase() === seed.data.name.toLowerCase()) ?? matches[0];
  await prisma.major.update({
    data: seed.data,
    where: { id: primary.id }
  });

  for (const major of matches.filter((item) => item.id !== primary.id)) {
    await prisma.major.update({
      data: {
        careerOutcomes: seed.data.careerOutcomes,
        description: seed.data.description,
        interviewFocus: seed.data.interviewFocus,
        isActive: true,
        nameEn: seed.data.nameEn,
        nameZh: seed.data.nameZh,
        requirements: seed.data.requirements,
        researchAreas: seed.data.researchAreas,
        researchLabs: seed.data.researchLabs
      },
      where: { id: major.id }
    });
  }

  return primary.id;
}

async function upsertScholarship(prisma: PrismaClient, seed: ScholarshipSeed) {
  const matches = await prisma.scholarship.findMany({
    where: {
      OR: [
        { code: { equals: seed.data.code, mode: "insensitive" as const } },
        ...seed.matchNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } }))
      ]
    },
    orderBy: { name: "asc" }
  });

  if (!matches.length) {
    const created = await prisma.scholarship.create({ data: seed.data });
    return [created.id];
  }

  const ids: string[] = [];
  for (const scholarship of matches) {
    const keepLocalName = scholarship.name !== seed.data.name;
    const updated = await prisma.scholarship.update({
      data: keepLocalName
        ? {
            code: scholarship.code ?? seed.data.code,
            commonInterviewQuestions: seed.data.commonInterviewQuestions,
            coverage: seed.data.coverage,
            deadline: seed.data.deadline,
            description: seed.data.description,
            interviewFormat: seed.data.interviewFormat,
            isActive: true,
            requirements: seed.data.requirements,
            studyPlanRequirements: seed.data.studyPlanRequirements,
            tips: seed.data.tips
          }
        : seed.data,
      where: { id: scholarship.id }
    });
    ids.push(updated.id);
  }

  return ids;
}

async function upsertSchoolMajor(prisma: PrismaClient, schoolId: string, majorId: string, note: string) {
  const existing = await prisma.school_majors.findFirst({
    where: {
      admission_season_id: null,
      major_id: majorId,
      school_id: schoolId
    }
  });

  if (existing) {
    await prisma.school_majors.update({
      data: { note },
      where: { id: existing.id }
    });
    return;
  }

  await prisma.school_majors.create({
    data: {
      major_id: majorId,
      note,
      school_id: schoolId
    }
  });
}

async function upsertSchoolScholarship(prisma: PrismaClient, schoolId: string, scholarshipId: string, note: string) {
  const existing = await prisma.school_scholarships.findFirst({
    where: {
      admission_season_id: null,
      scholarship_id: scholarshipId,
      school_id: schoolId
    }
  });

  if (existing) {
    await prisma.school_scholarships.update({
      data: { note },
      where: { id: existing.id }
    });
    return;
  }

  await prisma.school_scholarships.create({
    data: {
      note,
      scholarship_id: scholarshipId,
      school_id: schoolId
    }
  });
}

const schoolSeeds: SchoolSeed[] = [
  {
    key: "tsinghua",
    matchNames: ["Tsinghua University", "Đại học Thanh Hoa", "清华大学", "Thanh Hoa"],
    data: {
      achievements: "Leading Chinese university for engineering, computer science, public policy, economics, and innovation entrepreneurship.",
      admissionRequirements: "Strong GPA, clear research or study plan, language proof matching program track, academic recommendation letters, and evidence of fit with target department.",
      campusInfo: "Main campus in Haidian District, Beijing; strong lab ecosystem, international student services, and entrepreneurship network.",
      city: "Beijing",
      description: "Elite research university in Beijing, especially strong for engineering, computer science, AI, architecture, public policy, and management.",
      interviewTips: "Prepare why Tsinghua, why China, why this major, fit with lab or department, research plan, career contribution, and examples of discipline under pressure.",
      isActive: true,
      name: "Tsinghua University",
      nameEn: "Tsinghua University",
      nameZh: "清华大学",
      notableAlumni: "Xi Jinping, Yang Zhenning, Hu Jintao, Zhu Rongji.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Beijing",
      ranking: 1,
      rankingType: "China elite research university",
      researchAreas: "Artificial intelligence, computer systems, robotics, electronic engineering, energy, architecture, public policy, economics and management.",
      strongMajors: "Computer Science, Artificial Intelligence, Engineering, Architecture, Automation, Economics and Management.",
      websiteUrl: "https://www.tsinghua.edu.cn"
    }
  },
  {
    key: "peking",
    matchNames: ["Peking University", "Đại học Bắc Kinh", "北京大学", "Bắc Kinh"],
    data: {
      achievements: "One of China's top comprehensive universities with deep strengths in humanities, sciences, medicine, economics, law, and information science.",
      admissionRequirements: "Strong academic transcript, high-quality personal statement, language proof, recommendation letters, and clear intellectual motivation.",
      campusInfo: "Historic Yanyuan campus in Beijing near Zhongguancun; strong academic culture and international programs.",
      city: "Beijing",
      description: "Comprehensive research university known for academic breadth, humanities, sciences, medicine, economics, law, and interdisciplinary research.",
      interviewTips: "Show intellectual curiosity, independent thinking, why PKU culture fits you, and how your plan connects to China and your home country.",
      isActive: true,
      name: "Peking University",
      nameEn: "Peking University",
      nameZh: "北京大学",
      notableAlumni: "Tu Youyou, Li Keqiang, Lu Xun studied at predecessor institutions.",
      programLanguage: "Chinese, English, and mixed tracks depending on school.",
      province: "Beijing",
      ranking: 2,
      rankingType: "China comprehensive research university",
      researchAreas: "Basic sciences, medicine, economics, law, public policy, Chinese studies, AI, data science, environmental studies.",
      strongMajors: "Chinese Language, Economics, Law, Medicine, Computer Science, International Relations.",
      websiteUrl: "https://www.pku.edu.cn"
    }
  },
  {
    key: "fudan",
    matchNames: ["Fudan University", "Đại học Phúc Đán", "复旦大学", "Phúc Đán"],
    data: {
      achievements: "Top Shanghai-based comprehensive university with strong medicine, economics, journalism, international relations, and data science programs.",
      admissionRequirements: "Competitive GPA, program-specific prerequisites, language certificate, study plan, and recommendation letters.",
      campusInfo: "Main Handan campus in Shanghai; strong links to finance, media, medicine, and international organizations.",
      city: "Shanghai",
      description: "Top comprehensive university in Shanghai, strong in medicine, economics, management, journalism, social sciences, and international studies.",
      interviewTips: "Explain why Shanghai, why Fudan's interdisciplinary environment, how your major connects to city resources, and your career plan.",
      isActive: true,
      name: "Fudan University",
      nameEn: "Fudan University",
      nameZh: "复旦大学",
      notableAlumni: "Chen Yinke, Yu Youren, many leaders in media, medicine, finance, and academia.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Shanghai",
      ranking: 3,
      rankingType: "China comprehensive research university",
      researchAreas: "Medicine, economics, international relations, journalism, data science, public health, Chinese studies.",
      strongMajors: "Clinical Medicine, Economics, Journalism, International Relations, Business, Data Science.",
      websiteUrl: "https://www.fudan.edu.cn"
    }
  },
  {
    key: "zhejiang",
    matchNames: ["Zhejiang University", "Đại học Chiết Giang", "浙江大学", "ZJU"],
    data: {
      achievements: "C9 League university with major strengths in computer science, engineering, agriculture, medicine, and innovation.",
      admissionRequirements: "Strong STEM or major background, clear research plan, language certificate, supervisor or department fit, and recommendation letters.",
      campusInfo: "Zijingang and Yuquan campuses in Hangzhou; strong digital economy and entrepreneurship ecosystem.",
      city: "Hangzhou",
      description: "Top C9 research university in Hangzhou, known for engineering, computer science, AI, agriculture, medicine, and entrepreneurship.",
      interviewTips: "Connect your plan to Hangzhou's digital economy, ZJU labs, practical research output, and long-term contribution.",
      isActive: true,
      name: "Zhejiang University",
      nameEn: "Zhejiang University",
      nameZh: "浙江大学",
      notableAlumni: "Shi Yigong, Chu Kochen, many founders and technology leaders.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Zhejiang",
      ranking: 4,
      rankingType: "China C9 League research university",
      researchAreas: "Artificial intelligence, CAD and computer graphics, control science, biomedical engineering, agriculture, medicine, e-commerce.",
      strongMajors: "Computer Science, Artificial Intelligence, Engineering, Agriculture, Medicine, Business.",
      websiteUrl: "https://www.zju.edu.cn"
    }
  },
  {
    key: "sjtu",
    matchNames: ["Shanghai Jiao Tong University", "Đại học Giao thông Thượng Hải", "上海交通大学", "SJTU"],
    data: {
      achievements: "C9 League university with top engineering, medicine, computer science, shipbuilding, mechanical engineering, and business programs.",
      admissionRequirements: "Strong GPA, STEM foundation, language proof, research or project evidence, and clear department fit.",
      campusInfo: "Xuhui and Minhang campuses in Shanghai; close links with technology, finance, and advanced manufacturing.",
      city: "Shanghai",
      description: "Major C9 research university in Shanghai with strong engineering, medicine, computer science, and management programs.",
      interviewTips: "Prepare concrete engineering or project examples, explain why Shanghai, and show how your plan fits applied research.",
      isActive: true,
      name: "Shanghai Jiao Tong University",
      nameEn: "Shanghai Jiao Tong University",
      nameZh: "上海交通大学",
      notableAlumni: "Jiang Zemin, Qian Xuesen, many engineers, entrepreneurs, and academics.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Shanghai",
      ranking: 5,
      rankingType: "China C9 League research university",
      researchAreas: "Mechanical engineering, computer science, AI, biomedical engineering, medicine, naval architecture, management.",
      strongMajors: "Engineering, Computer Science, Medicine, Business, Mechanical Engineering, Artificial Intelligence.",
      websiteUrl: "https://www.sjtu.edu.cn"
    }
  },
  {
    key: "ustc",
    matchNames: ["University of Science and Technology of China", "Đại học Khoa học và Công nghệ Trung Quốc", "中国科学技术大学", "USTC"],
    data: {
      achievements: "C9 League university famous for science, quantum information, computer science, mathematics, physics, and elite research training.",
      admissionRequirements: "Very strong math or science foundation, research potential, language proof, recommendation letters, and clear academic motivation.",
      campusInfo: "Located in Hefei with close links to Chinese Academy of Sciences research institutes.",
      city: "Hefei",
      description: "Research-intensive university under Chinese Academy of Sciences, especially strong in science, quantum, computer science, and engineering.",
      interviewTips: "Be ready to discuss research interests, math/science foundation, lab fit, and why intensive academic training suits you.",
      isActive: true,
      name: "University of Science and Technology of China",
      nameEn: "University of Science and Technology of China",
      nameZh: "中国科学技术大学",
      notableAlumni: "Guo Guangcan, Pan Jianwei, many leading scientists and technologists.",
      programLanguage: "Chinese and selected English research tracks.",
      province: "Anhui",
      ranking: 6,
      rankingType: "China C9 League science university",
      researchAreas: "Quantum information, computer science, mathematics, physics, chemistry, materials, AI, robotics.",
      strongMajors: "Physics, Mathematics, Computer Science, Artificial Intelligence, Materials Science, Engineering.",
      websiteUrl: "https://www.ustc.edu.cn"
    }
  },
  {
    key: "nanjing",
    matchNames: ["Nanjing University", "Đại học Nam Kinh", "南京大学", "NJU"],
    data: {
      achievements: "C9 League comprehensive university with strengths in sciences, humanities, software, astronomy, and earth sciences.",
      admissionRequirements: "Strong transcript, language proof, recommendation letters, study plan, and program-specific prerequisites.",
      campusInfo: "Gulou and Xianlin campuses in Nanjing; strong academic tradition and international student support.",
      city: "Nanjing",
      description: "Historic comprehensive research university strong in science, humanities, software, astronomy, earth science, and international studies.",
      interviewTips: "Show academic depth, explain why Nanjing and NJU, and connect your plan with research or cultural context.",
      isActive: true,
      name: "Nanjing University",
      nameEn: "Nanjing University",
      nameZh: "南京大学",
      notableAlumni: "Many scholars in astronomy, physics, literature, and public service.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Jiangsu",
      ranking: 7,
      rankingType: "China C9 League comprehensive university",
      researchAreas: "Astronomy, physics, chemistry, software engineering, earth sciences, Chinese studies, environmental science.",
      strongMajors: "Software Engineering, Physics, Astronomy, Chinese Language, Environmental Science, International Relations.",
      websiteUrl: "https://www.nju.edu.cn"
    }
  },
  {
    key: "wuhan",
    matchNames: ["Wuhan University", "Đại học Vũ Hán", "武汉大学", "WHU"],
    data: {
      achievements: "Comprehensive university known for law, surveying and mapping, remote sensing, economics, medicine, and Chinese language programs.",
      admissionRequirements: "Solid GPA, language proof, study plan, recommendation letters, and major-specific background.",
      campusInfo: "Beautiful Luojia Mountain campus in Wuhan; strong central China academic and industry connections.",
      city: "Wuhan",
      description: "Comprehensive university in Wuhan with strong law, remote sensing, surveying, economics, medicine, and Chinese language programs.",
      interviewTips: "Mention why central China, how the major fits your background, and how you will adapt academically and culturally.",
      isActive: true,
      name: "Wuhan University",
      nameEn: "Wuhan University",
      nameZh: "武汉大学",
      notableAlumni: "Li Siguang, many leaders in surveying, law, medicine, and public service.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Hubei",
      ranking: 8,
      rankingType: "China comprehensive research university",
      researchAreas: "Remote sensing, geospatial science, law, economics, medicine, water resources, Chinese language education.",
      strongMajors: "Remote Sensing, Law, Economics, Medicine, Chinese Language, Computer Science.",
      websiteUrl: "https://www.whu.edu.cn"
    }
  },
  {
    key: "xjtu",
    matchNames: ["Xi'an Jiaotong University", "Đại học Giao thông Tây An", "西安交通大学", "XJTU"],
    data: {
      achievements: "C9 League university strong in energy, mechanical engineering, electrical engineering, management, and western China innovation.",
      admissionRequirements: "Strong engineering or management foundation, language proof, recommendation letters, and focused study plan.",
      campusInfo: "Located in Xi'an with strengths in advanced manufacturing, energy, and Silk Road international cooperation.",
      city: "Xi'an",
      description: "C9 research university in Xi'an known for engineering, energy, electrical engineering, management, and advanced manufacturing.",
      interviewTips: "Connect your plan to western China development, engineering application, and long-term professional contribution.",
      isActive: true,
      name: "Xi'an Jiaotong University",
      nameEn: "Xi'an Jiaotong University",
      nameZh: "西安交通大学",
      notableAlumni: "Many leaders in engineering, energy, management, and public service.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Shaanxi",
      ranking: 9,
      rankingType: "China C9 League engineering university",
      researchAreas: "Energy power, mechanical engineering, electrical engineering, AI, management, medicine, advanced manufacturing.",
      strongMajors: "Electrical Engineering, Mechanical Engineering, Energy, Management, Computer Science, Medicine.",
      websiteUrl: "https://www.xjtu.edu.cn"
    }
  },
  {
    key: "bnu",
    matchNames: ["Beijing Normal University", "Đại học Sư phạm Bắc Kinh", "北京师范大学", "BNU"],
    data: {
      achievements: "Leading Chinese university for education, psychology, Chinese language teaching, environmental studies, and teacher training.",
      admissionRequirements: "Clear education or humanities motivation, language proof, academic transcript, recommendation letters, and teaching or research evidence when available.",
      campusInfo: "Beijing campus with strong education research institutes and international Chinese language teaching resources.",
      city: "Beijing",
      description: "Top university for education, psychology, Chinese language, teacher training, and social sciences.",
      interviewTips: "Explain teaching motivation, understanding of education challenges, language-learning plan, and how you will serve learners after graduation.",
      isActive: true,
      name: "Beijing Normal University",
      nameEn: "Beijing Normal University",
      nameZh: "北京师范大学",
      notableAlumni: "Mo Yan, many educators, psychologists, and public intellectuals.",
      programLanguage: "Chinese, English, and mixed tracks depending on program.",
      province: "Beijing",
      ranking: 10,
      rankingType: "China education and humanities university",
      researchAreas: "Education, psychology, Chinese language teaching, learning sciences, environmental science, public policy.",
      strongMajors: "Education, Psychology, Chinese Language, Teaching Chinese to Speakers of Other Languages, Public Policy.",
      websiteUrl: "https://www.bnu.edu.cn"
    }
  }
];

const majorSeeds: MajorSeed[] = [
  {
    key: "cs-master",
    matchNames: ["Computer Science and Technology", "Khoa học máy tính", "Computer Science", "计算机科学与技术"],
    data: {
      careerOutcomes: "AI engineer, software engineer, research assistant, data engineer, product engineer, PhD applicant.",
      degreeLevel: DegreeLevel.MASTER,
      description: "Master-level computer science track focusing on algorithms, systems, AI, data, and applied research.",
      interviewFocus: "Programming background, math foundation, research plan, project evidence, why this lab or department, and future technical impact.",
      isActive: true,
      name: "Computer Science and Technology",
      nameEn: "Computer Science and Technology",
      nameZh: "计算机科学与技术",
      requirements: "Programming experience, data structures, algorithms, mathematics, English or Chinese language proof, and project or research evidence.",
      researchAreas: "Artificial intelligence, NLP, computer vision, software engineering, distributed systems, databases, cybersecurity.",
      researchLabs: "AI institutes, CAD and computer graphics labs, software engineering groups, data science labs depending on school."
    }
  },
  {
    key: "cs-bachelor",
    matchNames: ["Khoa học máy tính", "Computer Science", "计算机科学"],
    data: {
      careerOutcomes: "Software developer, junior AI engineer, data analyst, QA engineer, product engineer, graduate applicant in CS or AI.",
      degreeLevel: DegreeLevel.BACHELOR,
      description: "Bachelor-level computer science program covering programming, algorithms, data structures, databases, operating systems, networks, and AI basics.",
      interviewFocus: "Programming interest, math readiness, self-study habit, project examples, why China, and clear plan after graduation.",
      isActive: true,
      name: "Computer Science",
      nameEn: "Computer Science",
      nameZh: "计算机科学",
      requirements: "Strong high school math, basic programming interest or project evidence, language proof, and problem-solving ability.",
      researchAreas: "Algorithms, software development, databases, networks, AI fundamentals, data science, human-computer interaction.",
      researchLabs: "Computer science teaching labs, software project labs, data science clubs, AI student research groups."
    }
  },
  {
    key: "ai-master",
    matchNames: ["Trí tuệ nhân tạo", "Artificial Intelligence", "人工智能"],
    data: {
      careerOutcomes: "AI engineer, machine learning engineer, research scientist, data scientist, applied NLP or computer vision specialist.",
      degreeLevel: DegreeLevel.MASTER,
      description: "Artificial intelligence program focused on machine learning, deep learning, NLP, computer vision, and responsible AI.",
      interviewFocus: "Explain ML foundations, project examples, dataset thinking, ethical awareness, research direction, and fit with supervisor or lab.",
      isActive: true,
      name: "Artificial Intelligence",
      nameEn: "Artificial Intelligence",
      nameZh: "人工智能",
      requirements: "Strong programming, probability, linear algebra, machine learning basics, project portfolio, and language proof.",
      researchAreas: "Machine learning, deep learning, NLP, computer vision, recommender systems, speech technology, AI education.",
      researchLabs: "AI institute, machine learning lab, NLP lab, computer vision lab, speech and multimodal lab."
    }
  },
  {
    key: "business-master",
    matchNames: ["Quản trị kinh doanh", "Business Administration", "工商管理"],
    data: {
      careerOutcomes: "Business analyst, product manager, operations manager, startup founder, international trade manager.",
      degreeLevel: DegreeLevel.MASTER,
      description: "Business administration program focused on management, strategy, operations, marketing, finance, and entrepreneurship.",
      interviewFocus: "Leadership examples, career goal, why China market, business case thinking, cross-cultural communication, and practical impact.",
      isActive: true,
      name: "Business Administration",
      nameEn: "Business Administration",
      nameZh: "工商管理",
      requirements: "Business or related background preferred, clear career plan, quantitative readiness, language proof, and recommendation letters.",
      researchAreas: "Strategy, marketing, finance, operations, entrepreneurship, digital transformation, China business.",
      researchLabs: "Management research center, entrepreneurship center, digital economy research group."
    }
  },
  {
    key: "intl-econ-bachelor",
    matchNames: ["Kinh tế quốc tế", "International Economics", "国际经济"],
    data: {
      careerOutcomes: "International trade specialist, market analyst, policy assistant, finance analyst, graduate study in economics or business.",
      degreeLevel: DegreeLevel.BACHELOR,
      description: "Bachelor program covering economics, trade, finance, statistics, policy, and global business.",
      interviewFocus: "Interest in China economy, math readiness, current affairs, career plan, and examples of analytical thinking.",
      isActive: true,
      name: "International Economics",
      nameEn: "International Economics",
      nameZh: "国际经济",
      requirements: "High school transcript, math readiness, language proof, interest in economics and international trade.",
      researchAreas: "International trade, macroeconomics, development economics, China economy, finance, business analytics.",
      researchLabs: "Economics department centers, China economy research groups, international trade institutes."
    }
  },
  {
    key: "chinese-language-bachelor",
    matchNames: ["Ngôn ngữ Trung Quốc", "Chinese Language", "汉语言"],
    data: {
      careerOutcomes: "Translator, interpreter, Chinese teacher, international business coordinator, graduate applicant in Chinese studies or education.",
      degreeLevel: DegreeLevel.BACHELOR,
      description: "Chinese language program focused on listening, speaking, reading, writing, culture, linguistics, and cross-cultural communication.",
      interviewFocus: "Chinese learning motivation, HSK plan, cultural adaptation, future use of Chinese, and teaching or translation interest.",
      isActive: true,
      name: "Chinese Language",
      nameEn: "Chinese Language",
      nameZh: "汉语言",
      requirements: "Language-learning motivation, HSK target or current level, strong study habits, and cross-cultural readiness.",
      researchAreas: "Chinese language education, linguistics, Chinese culture, translation, intercultural communication.",
      researchLabs: "Chinese language teaching center, international Chinese education institute."
    }
  },
  {
    key: "software-bachelor",
    matchNames: ["Software Engineering", "Kỹ thuật phần mềm", "软件工程"],
    data: {
      careerOutcomes: "Software engineer, web/mobile developer, QA engineer, product engineer, startup technical cofounder.",
      degreeLevel: DegreeLevel.BACHELOR,
      description: "Bachelor program focusing on programming, software design, databases, testing, cloud systems, and product development.",
      interviewFocus: "Programming motivation, project examples, teamwork, math and logic readiness, and long-term software career plan.",
      isActive: true,
      name: "Software Engineering",
      nameEn: "Software Engineering",
      nameZh: "软件工程",
      requirements: "High school math readiness, programming interest or project evidence, language proof, and problem-solving ability.",
      researchAreas: "Software architecture, cloud systems, web engineering, databases, testing, human-computer interaction.",
      researchLabs: "Software engineering lab, cloud computing lab, data systems lab."
    }
  }
];

const scholarshipSeeds: ScholarshipSeed[] = [
  {
    key: "csc",
    matchNames: ["Chinese Government Scholarship", "Học bổng Chính phủ Trung Quốc", "CSC", "中国政府奖学金"],
    data: {
      code: "CSC",
      commonInterviewQuestions: [
        "Why China?",
        "Why this university and major?",
        "What is your study or research plan?",
        "How will you contribute after graduation?",
        "Why do you deserve this scholarship?",
        "What will you do if you face language or cultural barriers?"
      ],
      coverage: "Usually full tuition, accommodation or housing subsidy, monthly living stipend, and medical insurance. Exact coverage depends on category and university notice.",
      deadline: "Usually December to April depending on dispatching authority and university track.",
      description: "Chinese Government Scholarship for international students applying through embassy, university, or designated programs.",
      interviewFormat: "Often online or panel interview, 10-20 minutes, Chinese or English depending on program; focuses on motivation, fit, plan, and communication.",
      isActive: true,
      name: "Chinese Government Scholarship",
      requirements: "Non-Chinese citizen, good health, strong academic record, age limit usually under 25 for bachelor, under 35 for master, under 40 for PhD, language proof, recommendation letters, and study or research plan.",
      studyPlanRequirements: "Bachelor applicants should show academic motivation and career direction; master/PhD applicants should provide a focused research or study plan, often 800 words or more.",
      tips: "Do not answer only about money. Connect scholarship to academic focus, China fit, university fit, and future contribution."
    }
  },
  {
    key: "cis",
    matchNames: ["Học bổng Giáo viên tiếng Trung Quốc tế", "International Chinese Language Teachers Scholarship", "CIS", "孔子学院奖学金"],
    data: {
      code: "CIS",
      commonInterviewQuestions: [
        "Why do you want to study Chinese?",
        "How will you promote Chinese language teaching?",
        "What is your HSK or HSKK level?",
        "What do you know about Chinese culture?",
        "How will you use Chinese after graduation?"
      ],
      coverage: "Usually tuition, accommodation, living allowance, and medical insurance depending on program length.",
      deadline: "Usually several rounds from March to October depending on intake.",
      description: "Scholarship supporting Chinese language learning, international Chinese education, and teacher development.",
      interviewFormat: "Language-focused interview in Chinese or mixed Chinese-English, often 10-15 minutes.",
      isActive: true,
      name: "International Chinese Language Teachers Scholarship",
      requirements: "Interest in Chinese language education, non-Chinese citizenship, good health, HSK/HSKK score matching program category, and recommendation from Confucius Institute or partner institution when required.",
      studyPlanRequirements: "Explain Chinese-learning history, teaching interest, cultural exchange plan, HSK goals, and practical use after graduation.",
      tips: "Prepare a short Chinese self-introduction, HSK learning plan, teaching motivation, and examples of cultural exchange."
    }
  },
  {
    key: "university",
    matchNames: ["Học bổng trường", "University Scholarship", "UNIVERSITY"],
    data: {
      code: "UNIVERSITY",
      commonInterviewQuestions: [
        "Why this university?",
        "What makes your profile competitive?",
        "How will you contribute to campus life?",
        "What is your study plan?",
        "Why should the university fund you?"
      ],
      coverage: "Coverage varies by university: full or partial tuition, accommodation subsidy, living stipend, or one-time award.",
      deadline: "Usually follows university admission rounds from January to June.",
      description: "University-funded scholarships for strong international applicants.",
      interviewFormat: "Department or admissions panel interview, usually online, 10-20 minutes.",
      isActive: true,
      name: "University Scholarship",
      requirements: "Strong academic record, complete application documents, language proof, clear school fit, and competitive interview performance.",
      studyPlanRequirements: "Emphasize why the university is the right fit, how you will use its resources, and measurable academic goals.",
      tips: "Mention specific labs, courses, professors, campus resources, or city advantages. Avoid generic praise."
    }
  },
  {
    key: "province",
    matchNames: ["Học bổng tỉnh", "Provincial Scholarship", "PROVINCE"],
    data: {
      code: "PROVINCE",
      commonInterviewQuestions: [
        "Why this province or city?",
        "How will you adapt to local culture?",
        "What is your academic plan?",
        "How can you connect your country with this region?",
        "What are your financial and study preparations?"
      ],
      coverage: "Usually partial tuition support, annual award, or living subsidy depending on province and level.",
      deadline: "Usually university-managed, often March to July.",
      description: "Scholarships funded by provincial or municipal governments to attract international students.",
      interviewFormat: "University or scholarship office interview, usually online, with motivation and adaptation questions.",
      isActive: true,
      name: "Provincial Scholarship",
      requirements: "Good academic standing, admission offer or application to local university, language proof, clean conduct record, and complete documents.",
      studyPlanRequirements: "Show why the province matters to your study, career, or cultural exchange plan.",
      tips: "Learn the city and province: industry, culture, university ecosystem, climate, and student support."
    }
  },
  {
    key: "self-funded",
    matchNames: ["Tự túc", "Self-funded", "SELF_FUNDED"],
    data: {
      code: "SELF_FUNDED",
      commonInterviewQuestions: [
        "Why are you confident you can complete the program?",
        "How will you finance your study?",
        "What is your study plan?",
        "Why this university and major?",
        "How will you manage pressure abroad?"
      ],
      coverage: "No scholarship coverage; candidate pays tuition, housing, insurance, and living cost.",
      deadline: "Follows university admission deadlines.",
      description: "Self-funded application route for candidates without scholarship coverage.",
      interviewFormat: "Admissions interview focused on motivation, academic readiness, finances, and adaptation.",
      isActive: true,
      name: "Self-funded",
      requirements: "Admission eligibility, financial readiness proof, language proof, academic documents, and health check as required.",
      studyPlanRequirements: "Need clear academic and financial plan, timeline, and risk management.",
      tips: "Be honest and concrete about finance, family support, budget, and backup plan."
    }
  }
];

const schoolMajorLinks = [
  { schoolKey: "tsinghua", majorKeys: ["cs-master", "cs-bachelor", "ai-master", "business-master"], note: "Strong fit for AI, CS, engineering, and management interview practice." },
  { schoolKey: "peking", majorKeys: ["cs-master", "cs-bachelor", "intl-econ-bachelor", "chinese-language-bachelor"], note: "Good fit for comprehensive academic, economics, language, and policy-oriented plans." },
  { schoolKey: "fudan", majorKeys: ["business-master", "intl-econ-bachelor", "chinese-language-bachelor"], note: "Good fit for Shanghai business, economics, language, and social science paths." },
  { schoolKey: "zhejiang", majorKeys: ["cs-master", "cs-bachelor", "ai-master", "software-bachelor", "business-master"], note: "Strong fit for digital economy, AI, CS, and applied innovation." },
  { schoolKey: "sjtu", majorKeys: ["cs-master", "cs-bachelor", "ai-master", "software-bachelor", "business-master"], note: "Strong fit for engineering, applied CS, AI, and Shanghai career goals." },
  { schoolKey: "ustc", majorKeys: ["cs-master", "ai-master"], note: "Strong fit for research-heavy science, AI, and computing applicants." },
  { schoolKey: "nanjing", majorKeys: ["cs-master", "cs-bachelor", "software-bachelor", "chinese-language-bachelor"], note: "Good fit for academic, software, science, and humanities applicants." },
  { schoolKey: "wuhan", majorKeys: ["cs-bachelor", "software-bachelor", "intl-econ-bachelor", "chinese-language-bachelor"], note: "Good fit for central China, language, economics, and applied technology plans." },
  { schoolKey: "xjtu", majorKeys: ["cs-master", "ai-master", "business-master"], note: "Strong fit for engineering, energy, management, and western China development." },
  { schoolKey: "bnu", majorKeys: ["chinese-language-bachelor", "business-master"], note: "Strong fit for Chinese education, language, psychology, and education technology plans." }
];

const schoolScholarshipLinks = schoolSeeds.map((school) => ({
  schoolKey: school.key,
  scholarshipKeys: school.key === "bnu" ? ["csc", "cis", "university", "province", "self-funded"] : ["csc", "university", "province", "self-funded"],
  note: "Use this scholarship context to ask school-specific motivation, requirements, study plan, and contribution questions."
}));
