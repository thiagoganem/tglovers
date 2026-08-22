#!/bin/bash
# ==============================================================================
# Setup Git para o projeto tglovers (conta: thiagoganem)
#
# Este script configura o git local para usar a identidade e chave SSH
# correta do thiagoganem. Execute sempre que clonar o projeto ou se
# o push der erro de permissão.
#
# Uso: bash scripts/setup-git.sh
# ==============================================================================

set -e

echo "🔧 Configurando Git para o projeto tglovers (thiagoganem)..."

# Identidade de commit
git config user.name "thiagoganem"
git config user.email "282404121+thiagoganem@users.noreply.github.com"
echo "✅ user.name = $(git config user.name)"
echo "✅ user.email = $(git config user.email)"

# Remote com host SSH correto (github-thiagoganem usa a chave certa)
EXPECTED_URL="git@github-thiagoganem:thiagoganem/tglovers.git"
CURRENT_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ "$CURRENT_URL" != "$EXPECTED_URL" ]; then
    git remote set-url origin "$EXPECTED_URL"
    echo "✅ remote origin atualizado: $EXPECTED_URL"
else
    echo "✅ remote origin já está correto: $EXPECTED_URL"
fi

# Verificação rápida de conectividade SSH
echo ""
echo "🔑 Testando conexão SSH com github-thiagoganem..."
if ssh -T git@github-thiagoganem 2>&1 | grep -q "successfully authenticated"; then
    echo "✅ SSH autenticado com sucesso!"
else
    echo "⚠️  Não foi possível verificar a autenticação SSH."
    echo "   Verifique se ~/.ssh/config tem o host github-thiagoganem"
    echo "   e se a chave ~/.ssh/id_ed25519_thiagoganem existe."
fi

echo ""
echo "✨ Setup completo! Agora você pode fazer push normalmente:"
echo "   git push -u origin main"
