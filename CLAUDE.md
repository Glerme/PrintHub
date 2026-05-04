# Print Hub

Aplicativo desktop cross-platform (Windows + Linux) para gerenciar arquivos STL e 3MF de impressão 3D.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui
- **Backend**: Rust (Tauri v2)
- **Banco**: SQLite via `sqlx` (migrations em `src-tauri/migrations/`)
- **IPC tipada**: `tauri-specta` + `specta` (bindings gerados em `src/lib/commands.ts`)
- **State**: TanStack Query (server state) + Zustand (UI state)
- **3D viewer**: `react-three-fiber` + `three-stdlib` (STLLoader, ThreeMFLoader)
- **File watching**: `notify-debouncer-full` (debounce 500ms)

## Comandos

```bash
pnpm tauri dev          # desenvolvimento (hot reload)
pnpm tauri build        # build de produção (gera .AppImage/.deb/.msi)
pnpm test               # Vitest (frontend)
cargo test              # testes Rust (rodar de dentro de src-tauri/)
pnpm lint               # ESLint
```

## Estrutura de pastas

```
print-hub/
├── src/                         # Frontend React
│   ├── routes/                  # Uma rota por tela (Library, FileDetail, Settings…)
│   ├── components/              # Componentes reutilizáveis
│   ├── hooks/                   # React hooks customizados
│   ├── lib/
│   │   ├── commands.ts          # Bindings IPC gerados pelo tauri-specta (NÃO editar manualmente)
│   │   ├── three-loaders.ts     # STLLoader / ThreeMFLoader wrappers
│   │   └── format.ts            # Formatadores de data, moeda (BRL), peso, tempo
│   └── store/                   # Zustand stores
│       ├── library.ts           # view mode, filtros ativos, multi-select
│       └── settings.ts          # settings carregados do backend
│
└── src-tauri/                   # Backend Rust
    ├── migrations/              # SQL versionado (001_initial.sql, 002_…)
    ├── src/
    │   ├── main.rs              # Entry: registra commands, setup tasks, WAL mode
    │   ├── error.rs             # enum AppError (thiserror + Serialize)
    │   ├── commands/            # Um arquivo por domínio (files, folders, tags, prints, filament, stats, slicer, settings)
    │   ├── indexer/
    │   │   ├── scanner.rs       # Scan inicial recursivo (walkdir + spawn_blocking)
    │   │   ├── watcher.rs       # Loop do file watcher (notify-debouncer-full + mpsc)
    │   │   └── threemf.rs       # Parser 3MF: extrai thumbnail embutido + metadados (zip + quick-xml)
    │   ├── db/
    │   │   ├── mod.rs           # SqlitePool global, boot (migrate + WAL)
    │   │   └── models.rs        # Structs Rust que mapeiam tabelas
    │   └── thumbnail/
    │       └── mod.rs           # Escreve/lê cache de thumbnails STL em disco
    └── Cargo.toml
```

## Convenções

- **DB**: nomes em `snake_case`. Timestamps como `INTEGER` (Unix segundos).
- **Rust→TS**: structs em `PascalCase`, fields em `camelCase` (serde rename via specta).
- **Commands Rust**: registrar em `main.rs` com `generate_handler![]` do tauri-specta. Retornar `Result<T, AppError>`.
- **Events Tauri** (push backend→frontend): `file-added`, `file-removed`, `thumbnail-ready`, `index-progress`. Frontend escuta com `listen()` em `useReactiveCache.ts` e invalida queries via `queryClient`.
- **Migrations**: sempre criar novo arquivo numerado, nunca editar migrações já aplicadas.
- **Thumbnails**: cacheados fora do bundle em `app_data_dir()/thumbnails/<file_id>.png`. Nunca referenciar por path relativo ao bundle.
- **Soft delete**: arquivos removidos do disco recebem `deleted_at` timestamp, não são deletados do DB (preserva histórico de impressões).

## Arquitetura de tasks (Rust/tokio)

```
boot
├── spawn(initial_scan)      → emite index-progress + index-done
└── spawn(watcher_loop)      → debounce 500ms
         │ mpsc::channel
         └──► spawn(indexer_worker)
                    ├── batch upsert (transaction única quando vem em rajada)
                    ├── parse 3MF em spawn_blocking (Semaphore::new(4))
                    └── emit "file-added" / "file-removed" / "thumbnail-ready"
```

Watcher handle mantido em `State<Mutex<Watcher>>` — se dropar silencia.
Em `RunEvent::ExitRequested`: fecha canais, await tasks com timeout 2s.

## Banco de dados — tabelas principais

| Tabela            | Descrição                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `files`           | Arquivos físicos indexados (1:1 com .stl/.3mf)                                           |
| `virtual_folders` | Pastas lógicas criadas no app (schema suporta hierarquia via `parent_id`, UI MVP é flat) |
| `tags`            | Tags livres N:M com `file_tags`                                                          |
| `print_history`   | Histórico de impressões por arquivo (cliente, valor, filamento, custo, rolo)             |
| `filament_rolls`  | Inventory de rolos (marca, material, cor, peso restante, custo)                          |
| `print_queue`     | Fila de impressão ordenável                                                              |
| `settings`        | key/value (watched_folder_path, bambu_studio_path, thumbnail_cache_dir)                  |

## Detecção do Bambu Studio

| OS      | Paths verificados                                                                          |
| ------- | ------------------------------------------------------------------------------------------ |
| Linux   | `which bambu-studio`, `~/.local/bin/bambu-studio`, `~/Applications/Bambu_Studio*.AppImage` |
| Windows | `%LOCALAPPDATA%\Programs\Bambu Studio\bambu-studio.exe`, registro                          |

Path configurável manualmente em Settings → salvo em `settings.bambu_studio_path`.

## Dependências frontend principais

```
three / @react-three/fiber / @react-three/drei   # 3D viewer
three-stdlib                                      # STLLoader, ThreeMFLoader
@tanstack/react-query                            # server state
@tanstack/react-virtual                          # virtualização da listagem (10k+ arquivos)
zustand                                          # UI state
recharts                                         # gráficos do dashboard
sonner                                           # toasts
@tauri-apps/api                                  # IPC Tauri
```

## Dependências Rust principais

```toml
tauri = { version = "2", features = ["..."] }
tauri-specta = { version = "2", features = ["derive"] }
specta = "0.1"
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio", "macros", "migrate"] }
notify = "6"
notify-debouncer-full = "0.3"
tokio = { version = "1", features = ["full"] }
zip = "0.6"
quick-xml = "0.31"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
walkdir = "2"
which = "6"
```

## Variáveis de ambiente

- Qualquer valor sensível ou configurável por ambiente vai em `.env` na raiz (nunca hardcoded).
- `.env` **nunca é commitado** — está no `.gitignore`.
- Criar `.env.example` com as chaves necessárias (sem valores reais) para documentar o que precisa ser configurado.
- No Tauri, variáveis de ambiente do processo são acessíveis em Rust via `std::env::var("NOME")`.
- No frontend (Vite), apenas variáveis prefixadas com `VITE_` são expostas: `import.meta.env.VITE_NOME`.

## Pontos de atenção

- `src/lib/commands.ts` é **mantido manualmente** por enquanto. `tauri-specta` está comentado no `Cargo.toml` aguardando versão estável. Ao ativar tauri-specta, o arquivo passará a ser gerado automaticamente e **não deverá ser editado manualmente**. Sempre manter os tipos TS sincronizados com as structs Rust até lá.
- STL não tem metadados embutidos — campos `estimated_print_time_min` e `estimated_filament_g` só vêm de 3MF.
- O viewer 3D (`ThreeViewer.tsx`) é `React.lazy` + `Suspense` — só importado na rota de detalhe pra não afetar bundle inicial.
- Moeda padrão: **BRL**. Formatação via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

# Regras de qualidade

- **Antes de qualquer commit**, sempre rodar obrigatoriamente na ordem:
  1. `pnpm test --run` — testes frontend (Vitest)
  2. `cargo test` (dentro de `src-tauri/`) — testes Rust
  3. `pnpm lint` — ESLint
  - Só commitar se todos passarem sem erros.
- Antes de commitar, use a skill do Codex para auditar o código
- Use o Codex para rodar testes e simulações independentes
- Compare os resultados das duas IAs antes de aprovar mudanças
