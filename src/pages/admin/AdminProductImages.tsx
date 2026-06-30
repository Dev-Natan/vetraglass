import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ImageIcon,
  ImageUp,
  Package,
  Search,
  Trash2,
  Filter,
  Loader2,
} from "lucide-react";
import { resolveProductImageUrl } from "@/utils/imageUrl";
import { processFileWithWhiteBackground } from "@/utils/imageBackgroundProcessor";

interface TemplateRow {
  id: string;
  name: string;
  linha: string | null;
  category: string | null;
  image_url: string | null;
}

export default function AdminProductImages() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [linhaFilter, setLinhaFilter] = useState<string>("__all__");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [missingOnly, setMissingOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery<TemplateRow[]>({
    queryKey: ["admin-product-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_templates")
        .select("id, name, linha, category, image_url")
        .order("linha", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as TemplateRow[];
    },
  });

  const linhas = useMemo(() => {
    const set = new Set<string>();
    (templates || []).forEach((t) => t.linha && set.add(t.linha));
    return Array.from(set).sort();
  }, [templates]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (templates || []).forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    return (templates || []).filter((t) => {
      if (missingOnly && t.image_url) return false;
      if (linhaFilter !== "__all__" && t.linha !== linhaFilter) return false;
      if (categoryFilter !== "__all__" && t.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [templates, search, linhaFilter, categoryFilter, missingOnly]);

  const handleUpload = async (template: TemplateRow, file: File) => {
    setBusyId(template.id);
    try {
      const processed = await processFileWithWhiteBackground(file).catch(() => file);
      const fileName = `${template.id}.png`;
      const { error: uploadError } = await supabase.storage
        .from("product-templates")
        .upload(fileName, processed, {
          upsert: true,
          contentType: "image/png",
          cacheControl: "0",
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("product-templates")
        .getPublicUrl(fileName);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("product_templates")
        .update({ image_url: newUrl })
        .eq("id", template.id);
      if (updateError) throw updateError;

      toast.success("Imagem atualizada");
      queryClient.invalidateQueries({ queryKey: ["admin-product-images"] });
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("row-level security") || err?.code === "42501") {
        toast.error(
          "Acesso negado. Apenas o administrador SaaS (natanjk7@gmail.com) pode alterar imagens de templates.",
        );
      } else {
        toast.error("Erro ao enviar imagem: " + msg);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (template: TemplateRow) => {
    if (!template.image_url) return;
    if (!confirm(`Remover a imagem de "${template.name}"?`)) return;
    setBusyId(template.id);
    try {
      const fileName = `${template.id}.png`;
      await supabase.storage.from("product-templates").remove([fileName]);
      const { error } = await supabase
        .from("product_templates")
        .update({ image_url: null })
        .eq("id", template.id);
      if (error) throw error;
      toast.success("Imagem removida");
      queryClient.invalidateQueries({ queryKey: ["admin-product-images"] });
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
    } catch (err: any) {
      toast.error("Erro ao remover imagem: " + (err?.message || err));
    } finally {
      setBusyId(null);
    }
  };

  const stats = useMemo(() => {
    const total = templates?.length || 0;
    const withImage = (templates || []).filter((t) => !!t.image_url).length;
    return { total, withImage, missing: total - withImage };
  }, [templates]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Imagens de Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie todas as imagens dos templates de produtos do sistema.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total de templates</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Com imagem</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.withImage}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sem imagem</p>
              <p className="text-2xl font-bold text-amber-600">{stats.missing}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={linhaFilter} onValueChange={setLinhaFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Linha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as linhas</SelectItem>
                {linhas.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={missingOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setMissingOnly((v) => !v)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Sem imagem
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum template encontrado com esses filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((template) => {
              const imgUrl = resolveProductImageUrl(template.image_url);
              const isBusy = busyId === template.id;
              return (
                <Card key={template.id} className="overflow-hidden group">
                  <div className="relative aspect-square bg-muted/30 flex items-center justify-center">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={template.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground/40">
                        <Package className="w-12 h-12" />
                        <span className="text-xs mt-1">Sem imagem</span>
                      </div>
                    )}

                    {isBusy && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}

                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <div className="flex flex-col items-center text-white gap-1">
                        <ImageUp className="w-6 h-6" />
                        <span className="text-xs font-medium">
                          {imgUrl ? "Trocar imagem" : "Adicionar imagem"}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(template, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <h3
                      className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]"
                      title={template.name}
                    >
                      {template.name}
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {template.linha && (
                        <Badge variant="secondary" className="text-xs">
                          {template.linha}
                        </Badge>
                      )}
                      {template.category && (
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      )}
                    </div>
                    {imgUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 text-xs text-destructive hover:text-destructive"
                        disabled={isBusy}
                        onClick={() => handleRemove(template)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remover
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
