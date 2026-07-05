export function playAudioUrl(audioUrl: string, errorMessage = "Không phát được audio câu hỏi.") {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(audioUrl);

    audio.preload = "auto";
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error(errorMessage));

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => reject(new Error(errorMessage)));
    }
  });
}
