# 🎸 Cifras App

Aplicação web de cifras musicais em **Angular 19**, estilo Cifra Club, com renderização responsiva, editor de cifras com drag & drop e transposição de tom em tempo real.

## ✨ Features

- 🎵 Visualização de cifras com acordes posicionados acima das sílabas
- 🔁 Transposição de tom em tempo real (semitom ↑↓)
- 🎸 Diagrama de violão SVG com variações ao hover
- ✏️ Editor de cifras:
  - Drag para reposicionar acordes
  - Adicionar novos acordes por posição de caractere
  - Editar a letra de cada linha
  - Gerenciar seções (verso, refrão, intro…)
- 💾 Persistência no `localStorage` — edições sobrevivem ao reload
- 📋 Exportar/Copiar o JSON atualizado
- 📱 Responsivo — quebra de linha automática no mobile

## 🏗️ Arquitetura

```
Página → CifraService (negócio) → CifraRepository (dados)
                                        ↓
                               JSON asset (public/data/)
                               + localStorage (edições)
```

## 🚀 Deploy no GitHub Pages

### 1. Criar o repositório no GitHub

```bash
gh repo create cifras --public
# ou via github.com/new
```

### 2. Adicionar o remote e fazer push

```bash
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git push -u origin main
```

### 3. Ativar GitHub Pages via Actions

No repositório GitHub:
1. Vá em **Settings → Pages**
2. Em **Source**, selecione **GitHub Actions**
3. O workflow `.github/workflows/deploy.yml` vai rodar automaticamente a cada push na `main`

### 4. Acessar o app

```
https://SEU_USUARIO.github.io/NOME_DO_REPO/
```

> **Nota:** O `--base-href` é definido automaticamente pelo workflow usando `${{ github.event.repository.name }}`. Se o nome do repositório for `cifras`, o app ficará em `/cifras/`.

## 💻 Desenvolvimento local

```bash
cd cifras-app
npm install
npm start
# → http://localhost:4200
```

## 📦 Build de produção manual

```bash
cd cifras-app
npx ng build --configuration=production --base-href="/NOME_DO_REPO/"
```

## 📁 Estrutura do projeto

```
cifras/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD GitHub Actions
├── cifras-app/
│   ├── public/
│   │   └── data/
│   │       └── harpa-crista-porque-ele-vive.json  # mock JSON
│   └── src/app/
│       ├── models/             # Tipagens TypeScript
│       ├── core/               # Engine de transposição
│       ├── repositories/       # CifraRepository (abstract + mock)
│       ├── services/           # CifraService (regras de negócio)
│       ├── components/         # LinhaCifra, AcordeLabel, DiagramaViolao…
│       └── pages/              # CifraDetail, CifraEditor
```
