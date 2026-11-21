# Surpresa para a Noa

Site estático (HTML/CSS/JS). Não precisa de servidor.

## Abrir localmente
Dê dois cliques em `index.html`. (O player do YouTube precisa de internet.)

## Personalizar (tudo em `config.js`)
- **Textos, carta, linha do tempo, detalhes**: edite os campos.
- **Músicas**: em `tracks`, troque `id` pelo código do vídeo (o que vem depois de `youtu.be/`) e coloque o nome em `title`.
- **Galeria**: ponha a imagem em `assets/gallery/` e acrescente `{src, alt, group}` (`arte` ou `estilo`).
- **Cores**: variáveis no topo de `style.css`.

## Publicar no GitHub Pages
1. Crie um repositório e envie todos os arquivos desta pasta.
2. Em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`.
3. Aguarde alguns minutos e abra o link gerado.

A música nunca toca sozinha: só quando ela aperta o botão de play ou escolhe uma faixa.
