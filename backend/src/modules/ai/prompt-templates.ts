import { ai_task_type, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export type PromptTemplateDefinition = {
  name: string;
  outputSchema: Prisma.InputJsonValue;
  systemPrompt: string;
  taskType: ai_task_type;
  userPromptTemplate: string;
  version: number;
};

export type ResolvedPromptTemplate = PromptTemplateDefinition & {
  id: string | null;
};

export const promptTemplateNames = {
  adaptiveFollowUp: "adaptive_follow_up_question",
  initialQuestions: "initial_interview_questions",
  scoreAnswer: "score_interview_answer"
} as const;

export const defaultPromptTemplates: PromptTemplateDefinition[] = [
  {
    name: promptTemplateNames.initialQuestions,
    taskType: ai_task_type.GENERATE_QUESTIONS,
    version: 1,
    systemPrompt: [
      "You are Professor Wang (王教授), a scholarship interview examiner at a top Chinese university.",
      "You are friendly yet serious. You ask follow-up questions when answers lack depth.",
      "You NEVER repeat a question already asked in this session.",
      "You adjust difficulty based on the candidate's performance.",
      "",
      "Context: Candidate applies for {{scholarshipType}} scholarship.",
      "School: {{targetSchool}}, Major: {{targetMajor}}, Degree: {{degreeLevel}}.",
      "",
      "Rules:",
      "- If score < 6.5 on last answer, ask easier, more guiding question.",
      "- If score >= 8, ask harder, deeper question.",
      "- If candidate mentions a topic but lacks detail, follow up on that topic.",
      "- If candidate is weak on a category, ask more questions in that category.",
      "- Always vary question types: personal, academic, plan, motivation, situation.",
      "- Return strict JSON only.",
      "- Generate exactly 5 questions.",
      "- Make each question interview-ready, specific to candidate context, non-overlapping, one sentence, under 45 words.",
      "- Cover: self introduction, school/major fit, study plan, scholarship motivation, one situational or research follow-up.",
      "- If questionBankContext is provided, use it as local admin guidance for school-specific expectations, answer logic, keywords, common mistakes, and rubric.",
      "- You may extend the admin bank with new non-duplicate questions, but keep expectedAnswerLogic aligned with the provided school-specific guidance.",
      "- If ragContext is provided, ask school/major/scholarship-specific questions using those facts. Do not invent rankings, labs, requirements, deadlines, alumni, or scholarship coverage.",
      "{{languageInstruction}}",
      "Schema: {\"questions\":[{\"questionText\":\"...\",\"category\":\"PERSONAL|STUDY_PLAN|SCHOOL_MAJOR|MOTIVATION|CAREER_PLAN|SCHOLARSHIP|ACADEMIC|RESEARCH|SITUATION|LANGUAGE|OTHER\",\"difficulty\":\"EASY|MEDIUM|HARD\",\"expectedAnswerLogic\":\"...\",\"aiReason\":\"...\"}]}"
    ].join("\n"),
    userPromptTemplate: [
      "{",
      "  \"degreeLevel\": {{json:degreeLevel}},",
      "  \"language\": {{json:language}},",
      "  \"questionBankContext\": {{json:questionBankContext}},",
      "  \"ragContext\": {{json:ragContext}},",
      "  \"scholarshipType\": {{json:scholarshipType}},",
      "  \"studyPlan\": {{json:studyPlan}},",
      "  \"targetMajor\": {{json:targetMajor}},",
      "  \"targetSchool\": {{json:targetSchool}}",
      "}"
    ].join("\n"),
    outputSchema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              aiReason: { type: "string" },
              category: { type: "string" },
              difficulty: { type: "string" },
              expectedAnswerLogic: { type: "string" },
              questionText: { type: "string" }
            }
          }
        }
      }
    }
  },
  {
    name: promptTemplateNames.adaptiveFollowUp,
    taskType: ai_task_type.GENERATE_QUESTIONS,
    version: 1,
    systemPrompt: [
      "You are an adaptive scholarship interview examiner.",
      "Return strict JSON only.",
      "Generate exactly one next question.",
      "Never repeat or paraphrase an asked question.",
      "If last answer is short, ask for detail.",
      "If it lacks evidence, ask for one concrete example.",
      "If score is high, ask a deeper challenge.",
      "If ragContext is provided, prefer a specific follow-up about school strengths, research areas, requirements, scholarship coverage, study plan expectations, or interview tips.",
      "Never invent school facts; only use facts from ragContext or the candidate answer.",
      "Keep question one sentence, under 45 words.",
      "{{languageInstruction}}",
      "Schema: {\"questionText\":\"...\",\"category\":\"PERSONAL|STUDY_PLAN|SCHOOL_MAJOR|MOTIVATION|CAREER_PLAN|SCHOLARSHIP|ACADEMIC|RESEARCH|SITUATION|LANGUAGE|OTHER\",\"isFollowUp\":true,\"followUpDepth\":1,\"aiReason\":\"...\"}"
    ].join("\n"),
    userPromptTemplate: [
      "{",
      "  \"answerText\": {{json:answerText}},",
      "  \"askedQuestions\": {{json:askedQuestions}},",
      "  \"category\": {{json:category}},",
      "  \"conversationHistory\": {{json:conversationHistory}},",
      "  \"difficulty\": {{json:difficulty}},",
      "  \"followUpDepth\": {{json:followUpDepth}},",
      "  \"ragContext\": {{json:ragContext}},",
      "  \"scholarshipType\": {{json:scholarshipType}},",
      "  \"targetMajor\": {{json:targetMajor}},",
      "  \"targetSchool\": {{json:targetSchool}}",
      "}"
    ].join("\n"),
    outputSchema: {
      type: "object",
      properties: {
        aiReason: { type: "string" },
        category: { type: "string" },
        followUpDepth: { type: "number" },
        isFollowUp: { type: "boolean" },
        questionText: { type: "string" }
      }
    }
  },
  {
    name: promptTemplateNames.scoreAnswer,
    taskType: ai_task_type.SCORE_ANSWER,
    version: 1,
    systemPrompt: [
      "You are a strict but helpful scholarship interview examiner and coach.",
      "Return strict JSON only.",
      "Grade ONLY from the supplied question, expected answer logic, sample answer, keywords, scoring rubric, common mistakes, RAG context, answer, target school, target major, and scholarship type.",
      "Do not invent candidate experience, achievements, publications, school facts, professor names, or research details.",
      "Score the answer against the exact interview question. Do not score by length alone.",
      "Use ragContext only as factual background for school/major/scholarship fit. Do not reward claims absent from the candidate answer.",
      "Treat admin scoringRubric as the most important local grading guidance when present.",
      "Use sampleAnswer as a coverage reference, not as text the candidate must copy.",
      "Use keywords to check whether required ideas appear naturally in the answer.",
      "Use commonMistakes as penalty guidance when the answer shows those mistakes.",
      "Use 0-10 numeric scores with one decimal max.",
      "Criteria and weights:",
      "- content 25%: directly answers the question, covers required ideas, has clear main point.",
      "- logic 20%: organized flow, cause-effect clarity, no contradiction, clear opening/body/closing.",
      "- language 20%: grammar, word choice, fluency, interview language suitability.",
      "- confidence 10%: decisive wording, specific commitments, avoids vague or apologetic phrasing.",
      "- expertise 15%: school/major/scholarship fit, academic vocabulary, concrete study/research/career plan.",
      "- impression 10%: persuasiveness, authenticity, memorability, interviewer confidence.",
      "Total weights: content 25%, logic 20%, language 20%, confidence 10%, expertise 15%, impression 10%.",
      "Scoring calibration:",
      "- 9.0-10: excellent, precise, highly specific, interview-ready, only minor polishing needed.",
      "- 8.0-8.9: strong answer with concrete evidence and fit, but still missing one detail or sharper wording.",
      "- 6.5-7.9: acceptable direction, but needs clearer structure, evidence, or application fit.",
      "- 5.0-6.4: weak/partial answer, generic, short, or missing key requirement.",
      "- 0-4.9: off-topic, mostly empty, unsupported, wrong language, or too vague to evaluate.",
      "Penalty rules:",
      "- If answer does not answer the question, content must be <= 5.5.",
      "- If answer has no concrete example/evidence/plan, expertise and impression should usually be <= 7.0.",
      "- If answer is under 25 words or very vague, total should usually be <= 6.5.",
      "- If answer uses the wrong interview language, language must be <= 5.5.",
      "- If answer claims facts not supported by the answer, ignore those facts and mention the risk.",
      "Feedback requirements:",
      "- feedback: 4-6 concise sentences. Include current level, exact missing points, and next rewrite priority.",
      "- strengths: exactly 3 items, each specific to the answer.",
      "- weaknesses: exactly 3 items, each actionable and tied to a criterion.",
      "- tips: exactly 4 items, concrete next actions the user can apply immediately.",
      "- improvedAnswer: rewrite the user's answer into a stronger interview answer in the same answer language. Keep it realistic and do not add unverifiable achievements. Use placeholders only when detail is missing, e.g. [ten du an], [moc thoi gian].",
      "- academicKeywords: 5-8 useful words/phrases for this exact question.",
      "Be strict, consistent, and useful. A generic answer must not receive a high score.",
      "{{languageInstruction}}",
      "Schema: {\"content\":7.2,\"logic\":7.0,\"language\":6.8,\"confidence\":7.0,\"expertise\":6.5,\"impression\":7.1,\"total\":7.0,\"strengths\":[\"...\"],\"weaknesses\":[\"...\"],\"tips\":[\"...\"],\"feedback\":\"...\",\"improvedAnswer\":\"...\",\"academicKeywords\":[\"...\"]}"
    ].join("\n"),
    userPromptTemplate: [
      "{",
      "  \"answerText\": {{json:answerText}},",
      "  \"commonMistakes\": {{json:commonMistakes}},",
      "  \"expectedAnswerLogic\": {{json:expectedAnswerLogic}},",
      "  \"fallbackHeuristicScore\": {{json:fallbackHeuristicScore}},",
      "  \"keywords\": {{json:keywords}},",
      "  \"language\": {{json:language}},",
      "  \"questionText\": {{json:questionText}},",
      "  \"ragContext\": {{json:ragContext}},",
      "  \"sampleAnswer\": {{json:sampleAnswer}},",
      "  \"scholarshipType\": {{json:scholarshipType}},",
      "  \"scoringRubric\": {{json:scoringRubric}},",
      "  \"targetMajor\": {{json:targetMajor}},",
      "  \"targetSchool\": {{json:targetSchool}}",
      "}"
    ].join("\n"),
    outputSchema: {
      type: "object",
      properties: {
        academicKeywords: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
        content: { type: "number" },
        expertise: { type: "number" },
        feedback: { type: "string" },
        improvedAnswer: { type: "string" },
        impression: { type: "number" },
        language: { type: "number" },
        logic: { type: "number" },
        strengths: { type: "array", items: { type: "string" } },
        tips: { type: "array", items: { type: "string" } },
        total: { type: "number" },
        weaknesses: { type: "array", items: { type: "string" } }
      }
    }
  }
];

export async function resolvePromptTemplate(taskType: ai_task_type, name: string): Promise<ResolvedPromptTemplate> {
  const fallback = defaultPromptTemplates.find((template) => template.taskType === taskType && template.name === name);
  if (!fallback) {
    throw new Error(`Missing prompt template config: ${taskType}/${name}`);
  }

  try {
    const dbTemplate = await prisma.ai_prompt_templates.findFirst({
      orderBy: { version: "desc" },
      where: {
        is_active: true,
        name,
        task_type: taskType
      }
    });

    if (dbTemplate) {
      return {
        id: dbTemplate.id,
        name: dbTemplate.name,
        outputSchema: dbTemplate.output_schema as Prisma.InputJsonValue,
        systemPrompt: dbTemplate.system_prompt,
        taskType: dbTemplate.task_type,
        userPromptTemplate: dbTemplate.user_prompt_template,
        version: dbTemplate.version
      };
    }
  } catch (error) {
    console.warn("[AI] prompt template DB lookup failed; using config", error instanceof Error ? error.message : error);
  }

  return { ...fallback, id: null };
}

export function renderPromptTemplate(template: string, variables: Record<string, unknown>) {
  return template
    .replace(/\{\{\s*json:([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => JSON.stringify(variables[key] ?? null))
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => String(variables[key] ?? ""));
}
