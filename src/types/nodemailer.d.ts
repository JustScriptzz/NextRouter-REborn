declare module 'nodemailer' {
  interface SendMailOptions {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    [key: string]: unknown;
  }
  interface TransportOptions {
    host: string;
    port: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
    [key: string]: unknown;
  }
  interface Transporter {
    sendMail(options: SendMailOptions): Promise<{ messageId: string }>;
  }
  export function createTransport(options: TransportOptions): Transporter;
  const _default: { createTransport: typeof createTransport };
  export default _default;
}
