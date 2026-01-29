

# Plano Completo: CNPJ Opcional com Unicidade Garantida

## Objetivo

Modificar o sistema para que o CNPJ/CPF seja **opcional** durante o cadastro de empresa, mas quando informado:
1. Deve ser validado no formato correto
2. Sera vinculado exclusivamente aquela conta
3. Nao podera ser usado por outra empresa (unicidade garantida pelo banco)

---

## Etapa 1: Migracao do Banco de Dados

### 1.1 Alterar Coluna para Aceitar NULL

```sql
-- Remover a constraint NOT NULL do campo cnpj
ALTER TABLE public.companies ALTER COLUMN cnpj DROP NOT NULL;

-- O indice UNIQUE existente ja permite multiplos NULLs em PostgreSQL
-- Isso significa:
-- - Varias empresas podem ter cnpj = NULL (sem documento)
-- - Apenas UMA empresa pode ter um CNPJ especifico (ex: 12345678000199)
```

### 1.2 Atualizar Funcao RPC

```sql
CREATE OR REPLACE FUNCTION public.create_company_and_assign_admin(
  _name TEXT,
  _cnpj TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies;
  v_uid uuid;
  v_clean_cnpj TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Limpar CNPJ: se vazio ou apenas espacos, sera NULL
  v_clean_cnpj := NULLIF(TRIM(_cnpj), '');
  
  -- Se CNPJ foi informado, verificar se ja existe
  IF v_clean_cnpj IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.companies WHERE cnpj = v_clean_cnpj) THEN
      RAISE EXCEPTION 'CNPJ_JA_CADASTRADO';
    END IF;
  END IF;

  INSERT INTO public.companies (name, cnpj, phone, email, address)
  VALUES (
    _name,
    v_clean_cnpj,
    NULLIF(TRIM(_phone), ''),
    NULLIF(TRIM(_email), ''),
    NULLIF(TRIM(_address), '')
  )
  RETURNING * INTO v_company;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_uid, v_company.id, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role, is_active = true;

  PERFORM create_default_permissions(v_company.id);
  
  RETURN v_company;
END;
$$;
```

---

## Etapa 2: Atualizar Frontend - CompanySetup.tsx

### 2.1 Schema de Validacao (Zod)

**De:**
```typescript
const companySchema = z.object({
  document: z.string().refine((val) => {
    const result = validateCPFOrCNPJ(val);
    return result.valid;
  }, 'CPF ou CNPJ invalido'),
  // ...
});
```

**Para:**
```typescript
const companySchema = z.object({
  document: z.string().optional().refine((val) => {
    // Se vazio, e valido (campo opcional)
    if (!val || val.trim() === '') return true;
    // Se preenchido, deve ser CPF ou CNPJ valido
    const result = validateCPFOrCNPJ(val);
    return result.valid;
  }, 'CPF ou CNPJ invalido'),
  // ...
});
```

### 2.2 Label do Campo

**De:**
```tsx
<Label htmlFor="document">CPF ou CNPJ *</Label>
```

**Para:**
```tsx
<Label htmlFor="document">CPF ou CNPJ (opcional)</Label>
```

### 2.3 Texto Explicativo

```tsx
<p className="text-xs text-muted-foreground">
  O documento e opcional. Se informado, sera vinculado 
  exclusivamente a esta empresa e nao podera ser usado 
  em outra conta.
</p>
```

### 2.4 Submit com Tratamento de Erro

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // ...validacao...
  
  try {
    const { data: companyData, error: companyError } = await supabase
      .rpc('create_company_and_assign_admin', {
        _name: name,
        _cnpj: document ? document.replace(/\D/g, '') : null, // Envia null se vazio
        _phone: phone || null,
        _email: email || null,
        _address: address || null,
      });
    
    if (companyError) {
      // Tratar erro de CNPJ duplicado
      if (companyError.message.includes('CNPJ_JA_CADASTRADO')) {
        toast({
          title: "CNPJ ja em uso",
          description: "Este CNPJ ja esta vinculado a outra empresa no sistema.",
          variant: "destructive",
        });
        setErrors(prev => ({ ...prev, document: 'CNPJ ja cadastrado' }));
        return;
      }
      throw companyError;
    }
    
    // ... sucesso ...
  } catch (error) {
    // ... tratamento generico ...
  }
};
```

---

## Etapa 3: Atualizar Modulo de Notas Fiscais

### 3.1 Validacao Pre-Emissao

O arquivo `NovaNotaFiscalDialog.tsx` ja valida a configuracao fiscal. Precisamos adicionar verificacao de CNPJ:

```typescript
const validateFiscalConfig = async () => {
  // ... codigo existente ...
  
  // Verificar se empresa tem CNPJ (obrigatorio para NF)
  if (!company?.cnpj) {
    setConfigValidation({ 
      valid: false, 
      error: 'CNPJ da empresa e obrigatorio para emissao de notas fiscais. Configure em Dados da Empresa.',
      field: 'cnpj'
    });
    return;
  }
  
  // ... resto da validacao ...
};
```

### 3.2 Bloquear Emissao sem CNPJ

O sistema ja possui Alert para configuracao incompleta. O CNPJ ausente sera tratado como configuracao incompleta.

---

## Etapa 4: Atualizar Geracoes de PDF

### Arquivos que Usam company.cnpj

| Arquivo | Tratamento Atual | Atualizacao Necessaria |
|---------|------------------|------------------------|
| `generateSalePdf.ts` | `if (company?.cnpj)` | Ja trata como opcional |
| `generateQuotePdf.ts` | Interface exige cnpj | Atualizar interface |
| `generateContractPdf.ts` | `company?.cnpj` | Ja trata como opcional |
| `generateDailyCashPdf.ts` | Usa diretamente | Adicionar verificacao |
| `generateMaterialsListPdf.ts` | Usa diretamente | Adicionar verificacao |
| `generateGlassProductionPdf.ts` | Usa diretamente | Adicionar verificacao |

### 4.1 Exemplo de Atualizacao

**generateDailyCashPdf.ts - Linha 113:**
```typescript
// De:
const cnpjFormatted = company.cnpj.replace(/(\d{2})...

// Para:
if (company.cnpj) {
  const cnpjFormatted = company.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  doc.text(`CNPJ: ${cnpjFormatted}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;
}
```

### 4.2 Atualizar Interface Company

Em varios arquivos, a interface exige cnpj como string:

```typescript
// De:
interface Company {
  name: string;
  cnpj: string;  // obrigatorio
}

// Para:
interface Company {
  name: string;
  cnpj?: string | null;  // opcional
}
```

---

## Etapa 5: Atualizar Tipos TypeScript

O arquivo `src/types/index.ts` precisa refletir a mudanca:

```typescript
export interface Company {
  id: string;
  name: string;
  logo?: string;
  cnpj?: string | null;  // Agora opcional
}
```

---

## Resumo de Arquivos a Modificar

| Etapa | Arquivo | Tipo |
|-------|---------|------|
| 1 | Migracao SQL | Schema + RPC |
| 2 | `src/pages/CompanySetup.tsx` | Frontend |
| 3 | `src/components/notas/NovaNotaFiscalDialog.tsx` | Validacao |
| 4 | `src/utils/generateQuotePdf.ts` | PDF |
| 4 | `src/utils/generateSalePdf.ts` | PDF (ja ok) |
| 4 | `src/utils/generateContractPdf.ts` | PDF (ja ok) |
| 4 | `src/utils/generateDailyCashPdf.ts` | PDF |
| 4 | `src/utils/generateMaterialsListPdf.ts` | PDF |
| 4 | `src/utils/generateGlassProductionPdf.ts` | PDF |
| 5 | `src/types/index.ts` | TypeScript |

---

## Fluxo de Cadastro Atualizado

```text
    Usuario preenche formulario
              |
              v
    Documento informado?
        /         \
      SIM         NAO
       |           |
       v           |
   Valida formato  |
       |           |
       v           |
   Documento existe?
     /       \     |
   SIM       NAO   |
    |         |    |
    v         v    v
  ERRO!    Cria empresa (cnpj preenchido ou null)
           Empresa vinculada ao usuario
```

---

## Comportamento Esperado

### Cenario 1: Cadastro SEM documento
- Usuario preenche apenas nome
- Empresa criada com `cnpj = NULL`
- Funciona normalmente exceto emissao de NF

### Cenario 2: Cadastro COM documento valido
- Usuario preenche nome + CPF/CNPJ
- Sistema valida formato
- Empresa criada com documento vinculado
- Emissao de NF disponivel (se CNPJ)

### Cenario 3: Tentativa de usar documento ja cadastrado
- Usuario preenche documento que ja existe
- Sistema retorna erro claro: "CNPJ ja em uso"
- Usuario precisa usar outro documento ou deixar vazio

### Cenario 4: Emissao de NF sem CNPJ
- Usuario tenta emitir NF
- Sistema bloqueia com mensagem clara
- Link para configurar dados da empresa

