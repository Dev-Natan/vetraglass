import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Municipio {
  id: string;
  codigo_ibge: string;
  nome_municipio: string;
  uf_codigo: string;
  uf_nome: string;
}

interface MunicipioIbgeSearchProps {
  value: string;
  onChange: (codigo: string, municipio?: Municipio) => void;
}

export default function MunicipioIbgeSearch({ value, onChange }: MunicipioIbgeSearchProps) {
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedMunicipio, setSelectedMunicipio] = useState<Municipio | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch selected municipio details
  const { data: currentMunicipio } = useQuery({
    queryKey: ["municipio-ibge", value],
    queryFn: async () => {
      if (!value || value.length < 7) return null;
      const { data, error } = await supabase
        .from("municipios_ibge")
        .select("*")
        .eq("codigo_ibge", value)
        .maybeSingle();
      if (error) throw error;
      return data as Municipio | null;
    },
    enabled: !!value && value.length >= 7,
  });

  useEffect(() => {
    if (currentMunicipio) {
      setSelectedMunicipio(currentMunicipio);
      setSearch("");
    }
  }, [currentMunicipio]);

  // Search municipios
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["municipios-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      
      // Search by name or code
      const isCodeSearch = /^\d+$/.test(search);
      
      let query = supabase
        .from("municipios_ibge")
        .select("*")
        .order("nome_municipio");
      
      if (isCodeSearch) {
        query = query.ilike("codigo_ibge", `${search}%`);
      } else {
        query = query.ilike("nome_municipio", `%${search}%`);
      }
      
      const { data, error } = await query.limit(15);
      if (error) throw error;
      return data as Municipio[];
    },
    enabled: search.length >= 2 && showResults,
  });

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (municipio: Municipio) => {
    setSelectedMunicipio(municipio);
    onChange(municipio.codigo_ibge, municipio);
    setSearch("");
    setShowResults(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch(newValue);
    setShowResults(true);
    
    // If user clears the input, clear the selection
    if (!newValue && selectedMunicipio) {
      setSelectedMunicipio(null);
      onChange("");
    }
  };

  const handleFocus = () => {
    if (search.length >= 2) {
      setShowResults(true);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>Código IBGE do Município</Label>
      
      {selectedMunicipio && !showResults ? (
        <div 
          className="flex items-center gap-2 p-2 border rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
          onClick={() => {
            setShowResults(true);
            setSearch("");
          }}
        >
          <MapPin className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="font-medium text-sm">{selectedMunicipio.nome_municipio}</div>
            <div className="text-xs text-muted-foreground">
              {selectedMunicipio.uf_nome} • Código: {selectedMunicipio.codigo_ibge}
            </div>
          </div>
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : (
        <div className="relative">
          <Input
            value={search}
            onChange={handleInputChange}
            onFocus={handleFocus}
            placeholder="Digite o nome ou código do município..."
            className="pr-8"
          />
          {isLoading ? (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}

      {showResults && searchResults && searchResults.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto bg-popover border rounded-md shadow-lg">
          {searchResults.map((municipio) => (
            <div
              key={municipio.id}
              className={cn(
                "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent transition-colors",
                municipio.codigo_ibge === value && "bg-accent"
              )}
              onClick={() => handleSelect(municipio)}
            >
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{municipio.nome_municipio}</div>
                <div className="text-xs text-muted-foreground">
                  {municipio.uf_nome} • {municipio.codigo_ibge}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && search.length >= 2 && !isLoading && searchResults?.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg p-3 text-center text-sm text-muted-foreground">
          Nenhum município encontrado
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Busque pelo nome do município ou código IBGE de 7 dígitos
      </p>
    </div>
  );
}
