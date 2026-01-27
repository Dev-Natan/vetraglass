

# Integração do Mapa de Localização do Cliente

## Resumo
Criar um componente `MapaClienteDialog` que exibe o endereço do cliente em um mapa interativo usando Leaflet, permitindo arrastar o marcador para ajustar a localização e salvar as coordenadas no banco de dados.

---

## Infraestrutura Existente

| Recurso | Status |
|---------|--------|
| Colunas `latitude`/`longitude` na tabela `clients` | ✅ Já existe |
| Dependências `react-leaflet` e `leaflet` | ✅ Instalados |
| Edge function `geocode-address` | ✅ Funcionando |
| Tipos TypeScript atualizados | ✅ Incluem lat/lng |

---

## Implementação

### 1. Criar componente MapaClienteDialog

**Novo arquivo:** `src/components/clientes/MapaClienteDialog.tsx`

Funcionalidades:
- Exibe mapa Leaflet com marcador na posição do cliente
- Se cliente já tem coordenadas salvas, usa diretamente
- Se não tem, chama edge function `geocode-address` para buscar
- Marcador arrastável para ajuste fino da posição
- Botão salvar atualiza `latitude`/`longitude` no banco

```text
┌────────────────────────────────────────────┐
│  📍 Localização do Cliente                 │
├────────────────────────────────────────────┤
│                                            │
│         ┌──────────────────────┐           │
│         │                      │           │
│         │    🗺️ MAPA LEAFLET   │           │
│         │       📍 (arraste)   │           │
│         │                      │           │
│         └──────────────────────┘           │
│                                            │
│  📌 Rua das Flores, 123 - São Paulo/SP     │
│                                            │
│  💡 Arraste o pino para ajustar posição    │
│                                            │
│  ┌──────────┐  ┌─────────────────────┐     │
│  │ Cancelar │  │ ✅ Salvar Posição   │     │
│  └──────────┘  └─────────────────────┘     │
└────────────────────────────────────────────┘
```

---

### 2. Adaptar código compartilhado ao projeto

Mudanças principais do código original:

| Original | Adaptação |
|----------|-----------|
| `base44.functions.invoke('geocode')` | `supabase.functions.invoke('geocode-address')` |
| `base44.entities.Cliente.update()` | `supabase.from('clients').update()` |
| `cliente.endereco`, `cliente.numero` | `client.address` (já inclui número) |
| `cliente.cidade`, `cliente.estado` | `client.city`, `client.state` |
| `cliente.nome` | `client.name` |

---

### 3. Integrar ao ClientQuickActions

Atualizar o botão "Mapa" para abrir o diálogo ao invés do Google Maps:

```typescript
// ClientQuickActions.tsx
const [mapDialogOpen, setMapDialogOpen] = useState(false);

// Botão "Ver no Mapa" → abre MapaClienteDialog
<Button onClick={() => setMapDialogOpen(true)}>
  <MapPin /> Ver Mapa
</Button>

<MapaClienteDialog 
  open={mapDialogOpen}
  onClose={() => setMapDialogOpen(false)}
  client={client}
/>
```

---

### 4. Adicionar aba "Mapa" no Client360Dialog

Nova aba na visão 360° do cliente:

```typescript
// Client360Dialog.tsx
<TabsTrigger value="mapa">
  <MapPin /> Mapa
</TabsTrigger>

<TabsContent value="mapa">
  <MapaClienteEmbed client={client} />
</TabsContent>
```

---

### 5. Adicionar CSS do Leaflet

Importar estilos no componente:

```typescript
import 'leaflet/dist/leaflet.css';
```

E corrigir ícones padrão do Leaflet (bug conhecido):

```typescript
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
```

---

## Fluxo de Funcionamento

```text
┌─────────────────┐
│ Abrir Dialog    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐    Sim     ┌──────────────────┐
│ Tem lat/lng?    │───────────▶│ Exibir no mapa   │
└────────┬────────┘            └──────────────────┘
         │ Não
         ▼
┌─────────────────┐    Não     ┌──────────────────┐
│ Tem endereço?   │───────────▶│ Erro: sem dados  │
└────────┬────────┘            └──────────────────┘
         │ Sim
         ▼
┌─────────────────┐
│ Chamar geocode  │
│ edge function   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐    Não     ┌──────────────────┐
│ Encontrou?      │───────────▶│ Erro: não achado │
└────────┬────────┘            └──────────────────┘
         │ Sim
         ▼
┌─────────────────┐
│ Exibir no mapa  │
│ (marcador drag) │
└────────┬────────┘
         │ Usuário arrasta
         ▼
┌─────────────────┐
│ Habilita botão  │
│ "Salvar"        │
└────────┬────────┘
         │ Clica
         ▼
┌─────────────────┐
│ UPDATE clients  │
│ SET lat/lng     │
└─────────────────┘
```

---

## Arquivos Afetados

| Ação | Arquivo |
|------|---------|
| **Criar** | `src/components/clientes/MapaClienteDialog.tsx` |
| Editar | `src/components/clientes/ClientQuickActions.tsx` |
| Editar | `src/components/clientes/Client360Dialog.tsx` |

---

## Detalhes Técnicos

### Chamada da Edge Function

```typescript
const { data, error } = await supabase.functions.invoke('geocode-address', {
  body: {
    client_id: client.id,
    address: client.address,
    city: client.city,
    state: client.state,
  },
});

if (data?.success) {
  setPosition([data.latitude, data.longitude]);
}
```

### Salvamento das Coordenadas

```typescript
const handleSave = async () => {
  if (!position || !client) return;

  const { error } = await supabase
    .from('clients')
    .update({
      latitude: position[0],
      longitude: position[1],
    })
    .eq('id', client.id);

  if (!error) {
    toast.success('Localização salva!');
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    onClose();
  }
};
```

### Marcador Arrastável

```typescript
<Marker
  position={position}
  draggable={true}
  eventHandlers={{
    dragend: (e) => {
      const marker = e.target;
      const newPos = marker.getLatLng();
      setPosition([newPos.lat, newPos.lng]);
      setHasChanged(true);
    },
  }}
>
  <Popup>{client.name}</Popup>
</Marker>
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Link abre Google Maps externo | Mapa embutido no sistema |
| Não salva coordenadas | Coordenadas persistidas |
| Sem ajuste de posição | Marcador arrastável |
| Geocode manual | Geocode automático |

