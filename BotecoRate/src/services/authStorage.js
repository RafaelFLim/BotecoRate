import { initDatabase } from '../database/database';
// Não exporta senhas; operações de autenticação ficam em authService.
export async function carregarUsuarios() {
  return (await initDatabase()).getAllAsync('SELECT id,usuario,email,papel,status FROM usuarios WHERE deleted_at IS NULL');
}
