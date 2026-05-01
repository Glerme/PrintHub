# CI/CD GitHub Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar dois GitHub Actions workflows — um de CI (lint + testes em todo push/PR) e um de release (build multiplataforma + GitHub Release em tag `v*`).

**Architecture:** Dois arquivos YAML independentes em `.github/workflows/`. O CI roda em `ubuntu-22.04`. O release usa uma matrix com `ubuntu-22.04` (deb + appimage) e `windows-latest` (msi), rodando em paralelo via `tauri-apps/tauri-action@v0`.

**Tech Stack:** GitHub Actions, Tauri v2, pnpm, Rust stable, `tauri-apps/tauri-action@v0`, `Swatinem/rust-cache@v2`

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `.github/workflows/ci.yml` | Criar | Lint + build + clippy + testes em todo push/PR |
| `.github/workflows/release.yml` | Criar | Build Linux + Windows + GitHub Release draft em tag `v*` |

---

## Task 1: Criar workflow de CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Criar o diretório e o arquivo**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Escrever `.github/workflows/ci.yml`**

Conteúdo completo do arquivo:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-22.04

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Linux system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev

      - name: Install frontend dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Build frontend
        run: pnpm build

      - name: Clippy
        run: cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

      - name: Tests
        run: cargo test --manifest-path src-tauri/Cargo.toml
```

> **Nota:** `pnpm build` vem antes do `cargo` porque `tauri-build` (executado pelo `build.rs`) valida que `frontendDist` (a pasta `dist/`) existe. Sem isso, `cargo clippy` falha.

- [ ] **Step 3: Validar o YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML válido"
```

Saída esperada: `YAML válido`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow (lint, clippy, tests on push/PR)"
```

---

## Task 2: Criar workflow de release

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Escrever `.github/workflows/release.yml`**

Conteúdo completo do arquivo:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  publish:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: ubuntu-22.04
            args: --bundles deb,appimage
          - platform: windows-latest
            args: --bundles msi

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install Linux system dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            patchelf

      - name: Install frontend dependencies
        run: pnpm install --frozen-lockfile

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: Print Hub ${{ github.ref_name }}
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

> **Notas:**
> - `fail-fast: false` garante que se o build Windows falhar, o Linux continua (e vice-versa).
> - `patchelf` é necessário no Linux para gerar o `.AppImage`.
> - Os dois jobs rodam em paralelo e fazem upload para a mesma release draft (identificada pelo `tagName`). A `tauri-action` cria a release na primeira chamada e adiciona assets na segunda.
> - A release fica como **draft** — você a publica manualmente no GitHub após revisar os assets.

- [ ] **Step 2: Validar o YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "YAML válido"
```

Saída esperada: `YAML válido`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow (Linux + Windows builds on tag v*)"
```

---

## Task 3: Verificar estrutura final e documentar fluxo de uso

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/release.yml`

- [ ] **Step 1: Confirmar estrutura de arquivos**

```bash
find .github -type f | sort
```

Saída esperada:
```
.github/workflows/ci.yml
.github/workflows/release.yml
```

- [ ] **Step 2: Verificar que não há secrets manuais necessários**

`GITHUB_TOKEN` é injetado automaticamente pelo GitHub em todo workflow. Nenhuma configuração de repositório necessária além de ter o repositório no GitHub.

- [ ] **Step 3: Testar o fluxo de release localmente (dry-run de tag)**

Verificar que a tag de release segue o padrão correto:

```bash
# Simula como seria uma tag de release
git tag --list 'v*'
# Deve listar nenhuma (ainda não temos tags de release)
# O padrão correto é: v0.1.0, v1.0.0, v1.2.3
```

- [ ] **Step 4: Confirmar versão em tauri.conf.json antes de qualquer release**

```bash
grep '"version"' src-tauri/tauri.conf.json
```

Saída esperada:
```json
  "version": "0.1.0",
```

A tag de release deve bater com essa versão (ex: tag `v0.1.0` para version `"0.1.0"`).

- [ ] **Step 5: Commit final com resumo**

```bash
git add .
git status
# Deve mostrar working tree clean (todos os arquivos já commitados nos steps anteriores)
```

---

## Fluxo de uso após implementação

### Publicar uma nova release:

```bash
# 1. Bump da versão em src-tauri/tauri.conf.json
#    Trocar "version": "0.1.0" por "version": "0.2.0"

# 2. Commit do bump
git add src-tauri/tauri.conf.json
git commit -m "chore: bump version to 0.2.0"

# 3. Criar e subir a tag
git tag v0.2.0
git push origin main --tags

# 4. Aguardar ~10 min: GitHub Actions roda release.yml
# 5. Acessar GitHub → Releases → Draft → revisar assets → publicar
```

### Assets gerados por release:

| Arquivo | Plataforma |
|---|---|
| `Print-Hub_0.2.0_amd64.deb` | Ubuntu/Debian |
| `Print-Hub_0.2.0_amd64.AppImage` | Linux genérico |
| `Print-Hub_0.2.0_x64-setup.msi` | Windows |
