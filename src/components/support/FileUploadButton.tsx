import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FileUploadButtonProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function FileUploadButton({
  files,
  onFilesChange,
  disabled = false,
  maxFiles = 5,
  maxSizeMB = 10,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Filter valid files
    const validFiles = selectedFiles.filter(file => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        return false;
      }
      return true;
    });

    // Limit total files
    const newFiles = [...files, ...validFiles].slice(0, maxFiles);
    onFilesChange(newFiles);
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls"
        onChange={handleChange}
        className="hidden"
      />
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={disabled || files.length >= maxFiles}
        className="h-8 w-8"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {files.map((file, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="text-xs pr-1 flex items-center gap-1"
            >
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-1 hover:bg-destructive/20 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
