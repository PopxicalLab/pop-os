// qrcode-terminal ships no types of its own.
declare module 'qrcode-terminal' {
  export function generate(qr: string, options?: { small?: boolean }, callback?: () => void): void;
}
