import { SupportAttachment } from '@/hooks/useSupportTickets';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Image, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageAttachmentsProps {
  attachments: SupportAttachment[];
  isOwn: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImageType(fileType: string): boolean {
  return fileType.startsWith('image/');
}

export function MessageAttachments({ attachments, isOwn }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  const handleDownload = async (attachment: SupportAttachment) => {
    const { data } = await supabase.storage
      .from('support-attachments')
      .createSignedUrl(attachment.file_path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => {
        const isImage = isImageType(attachment.file_type);

        if (isImage) {
          return (
            <div
              key={attachment.id}
              className="relative group cursor-pointer"
              onClick={() => handleDownload(attachment)}
            >
              <ImagePreview attachment={attachment} />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-white" />
              </div>
            </div>
          );
        }

        return (
          <button
            key={attachment.id}
            onClick={() => handleDownload(attachment)}
            className={cn(
              'flex items-center gap-2 p-2 rounded-md w-full text-left transition-colors',
              isOwn
                ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20'
                : 'bg-background hover:bg-background/80'
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{attachment.file_name}</p>
              <p className={cn(
                "text-xs",
                isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
              )}>
                {formatFileSize(attachment.file_size)}
              </p>
            </div>
            <Download className="h-4 w-4 shrink-0 opacity-60" />
          </button>
        );
      })}
    </div>
  );
}

function ImagePreview({ attachment }: { attachment: SupportAttachment }) {
  const { data } = supabase.storage
    .from('support-attachments')
    .getPublicUrl(attachment.file_path);

  // Since bucket is private, we need to use signed URL for preview
  // For now, show a placeholder with the filename
  return (
    <div className="bg-muted rounded-md p-3 flex items-center gap-2">
      <Image className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.file_size)}
        </p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
