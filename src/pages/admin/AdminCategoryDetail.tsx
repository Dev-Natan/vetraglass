import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useItemTypes } from "@/hooks/useItemTypes";
import { PerfisDetail } from "@/components/admin/categories/detail/PerfisDetail";
import { VidrosDetail } from "@/components/admin/categories/detail/VidrosDetail";
import { AcessoriosDetail } from "@/components/admin/categories/detail/AcessoriosDetail";
import { GenericCategoryDetail } from "@/components/admin/categories/detail/GenericCategoryDetail";
import { ItemTypeBasicEditor } from "@/components/admin/categories/detail/ItemTypeBasicEditor";



export default function AdminCategoryDetail() {
  const { isSaasAdmin } = useAuth();
  const { slug = "" } = useParams<{ slug: string }>();
  const { data: categories, isLoading: loadingC } = useProductCategories(true);
  const { data: itemTypes, isLoading: loadingT } = useItemTypes(true);

  const match = useMemo(() => {
    const c = categories?.find((x) => x.slug === slug);
    if (c) return { name: c.name, description: null as string | null };
    const t = itemTypes?.find((x) => x.slug === slug);
    if (t) return { name: t.name, description: null as string | null };
    return null;
  }, [categories, itemTypes, slug]);

  if (!isSaasAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    const key = slug.toLowerCase();
    if (["perfis", "perfil", "aluminio", "aluminium"].includes(key)) return <PerfisDetail />;
    if (["vidros", "vidro", "glass"].includes(key)) return <VidrosDetail />;
    if (["acessorios", "acessorio", "acessórios", "acessório", "accessories"].includes(key)) return <AcessoriosDetail />;
    return <GenericCategoryDetail name={match?.name ?? slug} slug={slug} description={match?.description ?? null} />;
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/categories"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {loadingC || loadingT ? <Loader2 className="h-5 w-5 animate-spin inline" /> : (match?.name ?? slug)}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">{slug}</p>
        </div>
        {renderContent()}
      </div>
    </AdminLayout>
  );
}
