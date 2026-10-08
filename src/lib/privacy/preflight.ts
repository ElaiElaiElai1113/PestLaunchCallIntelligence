export function privacyRisk(text: string): boolean {
  return (
    /\b(card number|credit card|security code|cvv|expiration date)\b/i.test(
      text,
    ) ||
    /\b(?:\d[ -]?){13,19}\b/.test(text) ||
    /\b\d{3}[-.) ]+\d{3}[-. ]+\d{4}\b/.test(text) ||
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)
  );
}
export function validAudioHeader(bytes: Uint8Array, extension: string) {
  const text = (start: number, end: number) =>
    Buffer.from(bytes.slice(start, end)).toString("ascii");
  if (extension === "wav")
    return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
  if (extension === "m4a") return text(4, 8) === "ftyp";
  return (
    text(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}
