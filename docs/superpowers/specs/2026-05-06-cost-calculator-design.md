# Cost Calculator — Design Spec

**Data:** 2026-05-06  
**Status:** Aprovado

## Resumo

Calculadora de custo de impressão 3D integrada ao Print Hub. Portada do [layertrack-calc](https://github.com/Glerme/layertrack-calc). Funciona em dois contextos: tela standalone no sidebar (campos vazios) e seção no painel do FileDetail (pré-preenchida com dados do arquivo).

---

## Arquivos

### Novos

| Arquivo                             | Responsabilidade                                         |
| ----------------------------------- | -------------------------------------------------------- |
| `src/lib/calc.ts`                   | Funções puras de cálculo (sem dependências de framework) |
| `src/components/CostCalculator.tsx` | Componente compartilhado nos dois contextos              |
| `src/routes/Calculator.tsx`         | Tela standalone `/calculator`                            |

### Modificados

| Arquivo                     | Mudança                                    |
| --------------------------- | ------------------------------------------ |
| `src/routes/FileDetail.tsx` | Nova seção "Calcular custo" no `InfoPanel` |
| `src/App.tsx`               | Rota `/calculator` + ícone no sidebar      |

---

## Lógica de cálculo (`src/lib/calc.ts`)

Funções puras, sem side effects:

```ts
// Formata minutos para string de input: 135 → "2h 15m", 90 → "1h 30m"
formatMinutesToTimeInput(minutes: number): string

// Custo de um filamento: gramas × (R$/kg ÷ 1000)
calcFilamentLineCost({ gramsUsed, pricePerKg }): number

// Custo total de filamento: soma de N linhas
calcTotalFilamentCost(lines: { gramsUsed: number; pricePerKg: number }[]): number

// Custo de energia: horas × (watts ÷ 1000) × R$/kWh
calcEnergyCost({ printHours, printerWattage, energyCostPerKwh }): number

// Custo total
calcTotalCost({ filamentCost, energyCost }): number

// Preço sugerido com markup
calcSuggestedPrice({ totalCost, markupPercent }): number

// Margem = preço sugerido - custo total
calcMargin({ suggestedPrice, totalCost }): number

// Preço por kg derivado de um rolo: roll.cost / roll.initialWeightG * 1000
// Retorna null se roll.cost for null
rollPricePerKg(roll: FilamentRoll): number | null
```

Parser de tempo (portado de `layertrack-calc/src/lib/time.ts`):

```ts
// Aceita: "1h30m", "90min", "90m", "1.5h", "2h"
// Retorna horas decimais ou null se inválido
parseTimeInput(input: string): number | null
```

---

## Componente `CostCalculator`

### Props

```ts
interface CostCalculatorProps {
  prefill?: {
    gramsUsed?: number; // de estimatedFilamentG (3MF)
    printTimeMin?: number; // de estimatedPrintTimeMin (3MF)
    fileId?: number; // se presente, exibe botão "Salvar no histórico"
  };
}
```

### Linhas de filamento

Cada linha tem:

- **Select de rolo** — lista de `listFilamentRolls()` ativos. Ao selecionar, preenche `pricePerKg` automaticamente (derivado de `rollPricePerKg`) e desabilita o input manual.
- **Input R$/kg** — editável manualmente quando nenhum rolo está selecionado. Habilitado se rolo selecionado não tem `cost` cadastrado (exibe aviso).
- **Input gramas usadas** — número, mínimo 0.

Ações:

- Botão **"+ Adicionar filamento"** — adiciona nova linha vazia.
- Botão **"✕"** por linha — remove (mínimo 1 linha sempre presente).

Estado inicial:

- 1 linha com `gramsUsed = prefill.gramsUsed ?? 0`, rolo não selecionado.

### Campos de impressão

| Campo                      | Tipo                    | Persistido                   | Default                                                                             |
| -------------------------- | ----------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| Tempo de impressão         | text (`parseTimeInput`) | não                          | `""` standalone; `formatMinutesToTimeInput(prefill.printTimeMin)` quando disponível |
| Potência da impressora (W) | number                  | sim — `calc_printer_wattage` | 250                                                                                 |
| Custo energia (R$/kWh)     | number                  | sim — `calc_energy_cost_kwh` | 0.75                                                                                |
| Markup (%)                 | number                  | sim — `calc_markup_percent`  | 30                                                                                  |

**Persistência:** lê via `getSetting` no mount (com `useQuery`). Salva via `setSetting` com debounce de 500ms ao alterar.

### Resultados (live, sem submit)

Calculados reativamente a cada mudança:

- Custo filamento (soma das linhas)
- Custo energia
- **Custo total**
- **Preço sugerido** (com markup)
- Margem (preço sugerido − custo total)

Todos exibidos formatados em BRL via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

Campos incompletos (tempo inválido, R$/kg vazio em alguma linha) mostram "—" no resultado parcial. O botão "Salvar" fica desabilitado se `totalCost === 0`.

### Botão "Salvar no histórico"

Visível apenas quando `prefill.fileId` está presente.

Chama `addPrintHistory` com:

```ts
{
  fileId: prefill.fileId,
  printedAt: Date.now() / 1000,
  actualFilamentG: soma de todas as gramas,
  actualTimeMin: printHours * 60 (ou null se tempo inválido),
  filamentCost: totalFilamentCost,  // apenas custo de filamento — NÃO inclui energia
  saleValue: suggestedPrice,
  filamentRollId: rollId da primeira linha (ou null),
  status: 'success',
}
```

Após salvar: toast de sucesso + invalida `['print_history', fileId]` no TanStack Query.

---

## Rota `/calculator` (standalone)

`src/routes/Calculator.tsx` renderiza `<CostCalculator />` sem `prefill`. Layout: título + componente centralizado, mesma estrutura das outras rotas (sem sidebar interna).

Ícone no sidebar: 🧮 (ou SVG de calculadora compatível com os demais ícones do app).

---

## Integração no FileDetail

Em `InfoPanel`, nova seção colapsável após "Tags":

```tsx
<section>
  <button onClick={() => setShowCalc((v) => !v)}>
    🧮 Calcular custo {showCalc ? "▲" : "▼"}
  </button>
  {showCalc && (
    <CostCalculator
      prefill={{
        gramsUsed: file.estimatedFilamentG ?? undefined,
        printTimeMin: file.estimatedPrintTimeMin ?? undefined,
        fileId: file.id,
      }}
    />
  )}
</section>
```

---

## Settings no backend

Três novas chaves na tabela `settings` existente (sem migration — a tabela já é key/value):

| Chave                  | Tipo            | Default  |
| ---------------------- | --------------- | -------- |
| `calc_markup_percent`  | string (número) | `"30"`   |
| `calc_printer_wattage` | string (número) | `"250"`  |
| `calc_energy_cost_kwh` | string (número) | `"0.75"` |

Nenhum novo comando Rust necessário.

---

## Casos de borda

- **Rolo sem custo cadastrado:** input R$/kg fica habilitado com placeholder indicando que o rolo não tem preço. Usuário pode digitar manualmente.
- **Tempo inválido:** `parseTimeInput` retorna `null` → energia exibe "—", custo total exibe "—", botão salvar desabilitado.
- **Nenhuma linha de filamento completa:** custo filamento = 0, custo total = apenas energia.
- **Arquivo STL sem estimativas:** `prefill.gramsUsed` e `prefill.printTimeMin` são `undefined` → campos iniciam vazios, mesmo comportamento do modo standalone.

---

## Fora de escopo (v1)

- Salvar múltiplos rolos no `print_history` (apenas o primeiro é salvo em `filamentRollId`)
- Custos de suprimentos/pós-processamento (o `calcSuppliesCost` do layertrack-calc existe em `calc.ts` mas não é exposto na UI)
- Presets salvos de configuração (ex: "PLA padrão", "PETG personalizado")
