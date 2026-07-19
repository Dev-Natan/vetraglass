import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Info } from "lucide-react";

interface GenericCategoryDetailProps {
  name: string;
  slug: string;
  description?: string | null;
}

export function GenericCategoryDetail({ name, slug, description }: GenericCategoryDetailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description ?? `Gestão da categoria "${slug}".`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            Esta categoria ainda não possui um editor especializado. Use os atalhos abaixo para gerenciar
            os insumos e linhas relacionados.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/linhas"><ArrowRight className="h-4 w-4 mr-2" />Linhas de Produtos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/item-templates"><ArrowRight className="h-4 w-4 mr-2" />Item Templates</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/product-templates"><ArrowRight className="h-4 w-4 mr-2" />Product Templates</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
