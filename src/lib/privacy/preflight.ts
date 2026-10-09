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
