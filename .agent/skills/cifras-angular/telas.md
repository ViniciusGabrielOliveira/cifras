# 📄 Especificação Completa do Site de Listas de Músicas com Cifras

Este documento descreve detalhadamente todas as páginas, fluxos e comportamentos esperados do sistema para auxiliar uma IA no desenvolvimento do projeto.

---

# 🎯 Objetivo do Sistema

Criar um site para organização e visualização de listas de músicas com cifras voltadas para celebrações católicas (missa).

O sistema deve permitir:

* Visualização rápida da lista do dia
* Navegação entre diferentes listas
* Organização por contexto litúrgico
* Leitura confortável das cifras
* Gerenciamento administrativo das listas

---

# 🏠 Página: Home (Lista do Dia)

## Comportamento principal

* Ao acessar o site, o sistema deve identificar a data atual.
* Buscar todas as listas disponíveis para o dia.
* Exibir automaticamente **a primeira lista do dia corrente**.

## Estrutura da página

### 1. Header

* Nome do sistema
* Botão de navegação (menu ou ações principais)

### 2. Seletor de Listas

Logo no topo da página deve existir um botão/controle para trocar a lista atual.

Esse seletor deve oferecer **duas formas de navegação**:

#### 🔹 Opção 1: Por Dia

* abrir um calendario para escolher o dia
* Ao selecionar uma data:

  * Mostrar todas as listas daquele dia
* Ao selecionar uma lista:

  * Carregar essa lista na Home

#### 🔹 Opção 2: Por Título (Categoria Litúrgica)

* Exibir categorias como:

  * Tempo Comum
  * Advento
  * Quaresma
  * Festas Litúrgicas
* Ao selecionar uma categoria:

  * Exibir listas relacionadas
* Ao selecionar uma lista:

  * Carregar essa lista na Home

---

# 🎵 Página/Seção: Lista de Músicas

Essa é a área principal da Home após selecionar uma lista.

## Estrutura

### 1. Nome da Lista

* Exibir título da lista
* Exibir data (se aplicável)

### 2. Navegação por Tabs (Partes da Missa)

As músicas são organizadas por partes da missa, por exemplo:

* Entrada
* Ato Penitencial
* Glória
* Salmo
* Ofertório
* Santo
* Comunhão
* Final

#### Comportamento das Tabs

* Navegação por clique
* Navegação por gesto (arrastar horizontalmente)
* Transição suave entre tabs

### 3. Lista de Músicas por Tab

Cada tab contém:

* Lista de músicas
* Cada música exibida como item clicável

### 4. Interação com Música (Accordion)

Ao clicar em uma música:

#### Comportamento esperado:

* Expandir (accordion)
* Exibir:

  * Nome da música
  * Autor
  * Cifra completa

#### Scroll automático:

* A página deve rolar automaticamente
* O título da música deve ficar no topo da tela
* A cifra deve ocupar o máximo de espaço visível possível

#### Regras adicionais:

* Apenas uma música expandida por vez 
* Animação suave de abertura

---

# 📱 Responsividade

O sistema deve ser pensado com foco em mobile:

* Tabs com scroll horizontal
* Botões grandes e acessíveis
* Leitura confortável das cifras
* Espaçamento adequado

---

# 🔐 Página: Login Admin

## Objetivo

Permitir acesso ao painel administrativo.

## Campos

* Email
* Senha

## Ações

* Login
* Feedback de erro

---

# 🛠 Página: Painel Administrativo

## Objetivo

Gerenciar listas e músicas

## Estrutura

### 1. Dashboard

* Lista de todas as listas cadastradas

### 2. CRUD de Listas

Cada lista deve possuir:

* Título
* Data (opcional)
* Categoria (tempo litúrgico)
* Conjunto de músicas organizadas por parte da missa

#### Ações:

* Criar lista
* Editar lista
* Excluir lista

---

### 3. CRUD de Músicas

Cada música deve possuir:

* Nome
* Autor
* Letra com cifra

#### Ações:

* Adicionar música à lista
* Editar música
* Remover música

---

### 4. Organização por Partes da Missa

Ao editar uma lista:

* Deve ser possível organizar músicas dentro de categorias:

  * Entrada
  * Ofertório
  * Comunhão
  * etc

* Deve permitir:

  * Reordenar músicas
  * Mover entre categorias

---

# 🔄 Regras de Negócio

* Sempre existir uma lista padrão exibida na Home (primeira do dia)
* Listas podem existir sem data (usadas por categoria)
* Uma lista pode pertencer a uma categoria litúrgica
* Uma lista possui várias músicas organizadas por seção

---

#
