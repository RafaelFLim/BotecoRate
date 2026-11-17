import { Text } from 'react-native';
import { Formulario, Aviso, OpcaoConta } from '../components/Formulario';

export default function TelaPerfil({ usuarioLogado, onVoltar, onAbrirOpcao, onVincular, onAdministracao, onPropriedade, onLixeira, onValidacaoDono, onSincronizacao }) {
  const local = usuarioLogado.origem === 'local';
  return <Formulario title="Minha conta" onVoltar={onVoltar}>
    <Text style={{fontSize:24,fontWeight:'700',color:'#1a1a2e'}}>{usuarioLogado.usuario}</Text>
    <Aviso>{local ? 'Conta local · neste aparelho\nVocê pode consultar bares e endereços.' : `Conta com e-mail · ${usuarioLogado.email}\n${usuarioLogado.emailVerificado ? 'E-mail confirmado.' : 'Confirme seu e-mail para participar.'}`}</Aviso>
    {usuarioLogado.papel==='admin' && usuarioLogado.emailVerificado && usuarioLogado.status==='ativo' && <OpcaoConta title="Painel administrativo" description="Gerencie permissões, acesso de usuários e modere avaliações com justificativa." onPress={onAdministracao}/>}
    {!local && usuarioLogado.emailVerificado && usuarioLogado.status==='ativo' && onPropriedade && <OpcaoConta title="Propriedade e convites" description="Consulte convites, adicione coproprietários e transfira a propriedade com aceite de todos." onPress={onPropriedade}/>}
    {!local && usuarioLogado.emailVerificado && usuarioLogado.status==='ativo' && <OpcaoConta title="Lixeira" description="Consulte registros excluídos e seus prazos." onPress={onLixeira}/>}
    {!local && usuarioLogado.papel!=='admin' && usuarioLogado.emailVerificado && usuarioLogado.status==='ativo' && <OpcaoConta title="Sou dono de bar" description="Solicite ou consulte sua autorização para cadastrar bares." onPress={onValidacaoDono}/>}
    <OpcaoConta title="Meus dados" description="Consulte sua conta e escolha trocar o nome de usuário ou a senha." onPress={()=>onAbrirOpcao('dados')}/>
    {!local && <OpcaoConta title="Sincronização" description="Atualize os dados e consulte alterações que aguardam envio ou revisão." onPress={onSincronizacao}/>}
    {local && <OpcaoConta title="Usar uma conta com e-mail" description="Crie ou vincule uma conta para participar e acessar em outros aparelhos." onPress={onVincular}/>}
    {!local && !usuarioLogado.emailVerificado && <OpcaoConta title="Confirmar meu e-mail" description="Reenvie a confirmação ou confira se seu e-mail já foi confirmado." onPress={()=>onAbrirOpcao('verificacao')}/>}
    <OpcaoConta title="Acesso e segurança" description="Consulte o acesso por biometria, bloqueie o app ou saia da conta." onPress={()=>onAbrirOpcao('acesso')}/>
  </Formulario>;
}
