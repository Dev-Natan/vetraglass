import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { AluminumColorsEditor } from "./AluminumColorsEditor";

function AcessoriosInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sobre os Acessórios</CardTitle>
        <CardDescription>
          Acessórios (puxadores, fechaduras, roldanas, escovas, etc.) são cadastrados
          diretamente em <strong>Item Templates</strong> e podem ser vinculados a qualquer
          Linha de Perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Acessórios <strong>compartilham a mesma paleta de cores dos perfis de alumínio</strong>.
            Alterações feitas na aba <em>Cores de Alumínio</em> refletem automaticamente aqui.
          </AlertDescription>
        </Alert>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>• Não possuem espessura como o vidro.</p>
          <p>• Não possuem linhas próprias — herdam as linhas dos perfis.</p>
          <p>• Preço e estoque são gerenciados por empresa em <strong>Meus Preços</strong> e <strong>Estoque</strong>.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AcessoriosDetail() {
  return (
    <Tabs defaultValue="info">
      <TabsList className="mb-6">
        <TabsTrigger value="info">Informações</TabsTrigger>
        <TabsTrigger value="colors">Cores de Alumínio</TabsTrigger>
      </TabsList>
      <TabsContent value="info"><AcessoriosInfo /></TabsContent>
      <TabsContent value="colors"><AluminumColorsEditor /></TabsContent>
    </Tabs>
  );
}
