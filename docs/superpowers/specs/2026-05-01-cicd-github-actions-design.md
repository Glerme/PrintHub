# CI/CD GitHub Actions — Print Hub

**Data:** 2026-05-01
**Status:** Aprovado

## Contexto

Print Hub é um app desktop Tauri v2 (React + Rust) sem CI/CD configurado. O objetivo é automatizar lint, testes e publicação de releases para Linux e Windows via GitHub Actions.

## Decisões

| Questão | Decisão |
|---|---|
| Trigger de release | Push de tag `v*` |
| CI em PRs | Sim — workflow separado |
| Publicação | GitHub Releases (draft) |
| Assinatura de código | Não (Windows mostrará aviso "publisher unknown") |

## Arquitetura

Dois workflows independentes em `.github/workflows/`:

```
ci.yml        — push/PR → lint + build + clippy + tests
release.yml   — tag v* → build Linux + Windows → GitHub Release draft
```

---

## Workflow 1: `ci.yml`

**Trigger:** `push` para `main`, `pull_request` targeting `main`

**Runner:** `ubuntu-22.04`

**Steps:**
1. `actions/checkout@v4`
2. `pnpm/action-setup@v4` (pnpm latest)
3. `actions/setup-node@v4` — Node 20, cache pnpm
4. `dtolnay/rust-toolchain@stable` — components: clippy
5. `Swatinem/rust-cache@v2` — workspaces: `src-tauri`
6. `apt-get`: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
7. `pnpm install --frozen-lockfile`
8. `pnpm lint`
9. `pnpm build` — gera `dist/` (necessário antes do cargo, pois `tauri-build` verifica frontendDist)
10. `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
11. `cargo test --manifest-path src-tauri/Cargo.toml`

Nenhum artefato publicado. Resultado exibido como status check no PR.

---

## Workflow 2: `release.yml`

**Trigger:** `push` com tags `v*`

**Permissions:** `contents: write`

**Strategy:** matrix com `fail-fast: false`

| platform | targets |
|---|---|
| `ubuntu-22.04` | `deb`, `appimage` |
| `windows-latest` | `msi` |

**Steps (comuns a ambas plataformas):**
1. `actions/checkout@v4`
2. `pnpm/action-setup@v4`
3. `actions/setup-node@v4` — Node 20, cache pnpm
4. `dtolnay/rust-toolchain@stable`
5. `Swatinem/rust-cache@v2` — workspaces: `src-tauri`
6. `pnpm install --frozen-lockfile`
7. `tauri-apps/tauri-action@v0`

**Step 6 apenas no Linux (condicional por `runner.os`):**
```
apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev
                   libayatana-appindicator3-dev librsvg2-dev patchelf
```

**Configuração do tauri-action:**
```
tagName:      ${{ github.ref_name }}
releaseName:  Print Hub ${{ github.ref_name }}
releaseDraft: true
prerelease:   false
args:         ${{ matrix.args }}   ← vindo da matrix entry
```

Os dois jobs rodam em paralelo e sobem os assets para a mesma release draft. A release é publicada manualmente pelo desenvolvedor após revisar.

**Token:** `GITHUB_TOKEN` automático — nenhum secret manual necessário.

---

## Fluxo de release

```
1. Bump version em src-tauri/tauri.conf.json  (ex: "0.2.0")
2. git commit -m "chore: bump version 0.2.0"
3. git tag v0.2.0
4. git push origin main --tags
5. GitHub Actions dispara release.yml
6. ~10 min depois: release draft disponível com .deb, .AppImage, .msi
7. Revisar e publicar a release no GitHub
```

---

## Arquivos a criar

```
.github/
└── workflows/
    ├── ci.yml
    └── release.yml
```

## Sem secrets manuais

`GITHUB_TOKEN` é injetado automaticamente pelo GitHub. Nenhuma configuração de repositório necessária.
