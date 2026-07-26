import { SystemLoading } from "@/components/ui/system-loading";
import {
  getInterviewCompletionCopy,
  type InterviewCompletionStage
} from "./interview-completion-copy";

export type { InterviewCompletionStage } from "./interview-completion-copy";

export function InterviewCompletionLoading({
  stage
}: {
  stage: InterviewCompletionStage;
}) {
  const copy = getInterviewCompletionCopy(stage);

  return (
    <SystemLoading
      description={copy.description}
      fullScreen
      title={copy.title}
    />
  );
}
