import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExcelDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isLoading?: boolean;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
}

export function ExcelDropzone({ 
  onFilesSelected, 
  isLoading,
  selectedFiles,
  onRemoveFile 
}: ExcelDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );
    
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input
    e.target.value = '';
  }, [onFilesSelected]);

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "border-2 border-dashed transition-all cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-muted-foreground/25 hover:border-primary/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('excel-file-input')?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-10">
          {isLoading ? (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Processando arquivos...</p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-medium mb-1">
                Arraste e solte arquivos Excel aqui
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: .xlsx, .xls
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <input
        id="excel-file-input"
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Arquivos selecionados ({selectedFiles.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="text-sm">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-destructive/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(index);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
