import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { AluminumColorsEditor } from "./AluminumColorsEditor";
import { useProductLinhas } from "@/hooks/useProductLinhas";

export function PerfisDetail() {
  const { data: linhas, isLoading } = useProductLinhas(true);

  return (
    <Tabs defaultValue="colors">
      <TabsList className="mb-6">
        <TabsTrigger value="colors">Cores de Alumínio</TabsTrigger>
        <TabsTrigger value="linhas">Linhas Vinculadas</TabsTrigger>
      </TabsList>

      <TabsContent value="colors">
        <AluminumColorsEditor />
      </TabsContent>

      <TabsContent value="linhas">
        <Card>
          <CardHeader>
            <CardTitle>Linhas de Perfis</CardTitle>
            <CardDescription>Selecione uma linha para gerenciar seus perfis, preços e estoque.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(linhas ?? []).map((l) => (
                  <Link key={l.id} to={`/admin/insumos/linha/${l.slug}`}>
                    <Card className="hover:border-primary hover:shadow-md transition cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{l.name}</div>
                          {l.description && <div className="text-xs text-muted-foreground mt-1">{l.description}</div>}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {(linhas ?? []).length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">Nenhuma linha cadastrada</div>
                )}
              </div>
            )}
            <div className="mt-4">
              <Button asChild variant="outline"><Link to="/admin/linhas">Gerenciar todas as linhas</Link></Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
