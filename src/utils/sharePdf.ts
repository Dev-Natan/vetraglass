import { supabase } from '@/integrations/supabase/client';
import { elementToPdfBlob } from '@/utils/printableToPdf';
import { getWhatsappLink, openWhatsapp } from '@/utils/whatsapp';

const BUCKET_NAME = 'client-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SharePdfOptions {
  element: HTMLElement;
  fileName: string;
  userId: string;
  companyId?: string;
  clientId?: string;
}

export interface SharePdfResult {
  publicUrl: string;
  path: string;
}

/**
 * Render a DOM element to PDF, upload to a private storage bucket,
 * and return a signed URL that can be shared via WhatsApp or email.
 */
export async function uploadPdfForSharing({
  element,
  fileName,
  userId,
  companyId,
  clientId,
}: SharePdfOptions): Promise<SharePdfResult> {
  const blob = await elementToPdfBlob(element);

  const safeFileName = fileName
    .replace(/[^a-zA-Z0-9_.\-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();

  const folderParts = [userId, companyId, clientId].filter(Boolean);
  const path = `${folderParts.join('/')}/${Date.now()}_${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Falha ao enviar PDF: ${uploadError.message}`);
  }

  const { data, error: signedError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !data?.signedUrl) {
    throw new Error(`Falha ao gerar link de download: ${signedError?.message || 'unknown'}`);
  }

  return { publicUrl: data.signedUrl, path };
}

interface ShareMessageOptions {
  url: string;
  recipientName?: string | null;
  documentLabel?: string;
}

function buildWhatsAppMessage({
  url,
  recipientName,
  documentLabel = 'documento',
}: ShareMessageOptions): string {
  const greeting = recipientName ? `Olá ${recipientName},` : 'Olá,';
  return `${greeting} segue o ${documentLabel} solicitado:\n${url}\n\nAtenciosamente, Vetra Glass.`;
}

function buildEmailBody({
  url,
  recipientName,
  documentLabel = 'documento',
}: ShareMessageOptions): string {
  const greeting = recipientName ? `Olá ${recipientName},` : 'Olá,';
  return `${greeting}%0D%0A%0D%0ASegue o ${documentLabel} solicitado:%0D%0A${encodeURIComponent(url)}%0D%0A%0D%0AAtenciosamente,%0D%0AVetra Glass.`;
}

/**
 * Open WhatsApp with a pre-filled message containing the document link.
 * Returns true if a valid link could be generated.
 */
export function shareViaWhatsApp(
  phone: string | null | undefined,
  options: ShareMessageOptions,
): boolean {
  const message = buildWhatsAppMessage(options);
  return openWhatsapp(phone, message);
}

/**
 * Get a WhatsApp share link (without opening it).
 */
export function getWhatsAppShareLink(
  phone: string | null | undefined,
  options: ShareMessageOptions,
): string {
  const message = buildWhatsAppMessage(options);
  return getWhatsappLink(phone, message);
}

/**
 * Open the user's default email client with a pre-filled message.
 * Uses a `mailto:` link because transactional email infrastructure
 * is optional; the link contains the signed document URL.
 */
export function shareViaEmail(
  email: string | null | undefined,
  subject: string,
  options: ShareMessageOptions,
): boolean {
  if (!email || !email.includes('@')) return false;
  const body = buildEmailBody(options);
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`;
  const a = document.createElement('a');
  a.href = mailto;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
