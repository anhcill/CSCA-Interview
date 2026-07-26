let activeQuestionAudio: HTMLAudioElement | null = null;
let finishActiveQuestionAudio: (() => void) | null = null;

export function stopQuestionAudio() {
  if (!activeQuestionAudio) return;
  activeQuestionAudio.pause();
  activeQuestionAudio.currentTime = 0;
  finishActiveQuestionAudio?.();
}

export function playAudioUrl(
  audioUrl: string,
  errorMessage = "Không phát được audio câu hỏi."
) {
  return new Promise<void>((resolve, reject) => {
    stopQuestionAudio();
    const audio = new Audio(audioUrl);
    activeQuestionAudio = audio;
    audio.preload = "auto";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeQuestionAudio === audio) activeQuestionAudio = null;
      if (finishActiveQuestionAudio === finish) finishActiveQuestionAudio = null;
      resolve();
    };
    finishActiveQuestionAudio = finish;
    audio.onended = finish;
    audio.onerror = () => {
      if (settled) return;
      settled = true;
      if (activeQuestionAudio === audio) activeQuestionAudio = null;
      if (finishActiveQuestionAudio === finish) finishActiveQuestionAudio = null;
      reject(new Error(errorMessage));
    };

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => reject(new Error(errorMessage)));
    }
  });
}
