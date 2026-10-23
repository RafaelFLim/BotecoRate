import { Text } from 'react-native';
import { Formulario, Aviso, OpcaoConta } from '../components/Formulario';

export default function TelaPerfil({ usuarioLogado, onVoltar, onAbrirOpcao, onVincular, onAdministracao, onPropriedade }) {
  const local = usuarioLogado.origem === 'local';
  return <Formulario title="Minha conta" onVoltar={onVoltar}>
    <Text style={{fontSize:24,fontWeight:'700',color:'#1a1a2e'}}>{usuarioLogado.usuario}</Text>
    <Aviso>{local ? 'Conta local · neste aparelho\nVocê pode consultar bares e endereços.' : `Conta com e-mail · ${usuarioLogado.email}\n${usuarioLogado.emailVerificado ? 'E-mail confirmado.' : 'Confirme seu e-mail para participar.'}`}</Aviso>
    {usuarioLogado.papel==='admin' && usuarioLogado.emailVerificado && usuarioLogado.status==='ativo' && <OpcaoConta title="Painel administrativo" description="Gerencie permissões, acesso de usuários e modere avaliações com justificativa." onPress={onAdministracao}/>}
    {!local && usuarioLogado.emailVerificado && usuarioLogado.status==='ativo' && <OpcaoConta title="Propriedade e convites" description="Consulte convites, adicione coproprietários e transfira a propriedade com aceite de todos." onPress={onPropriedade}/>}
    <OpcaoConta title="Meus dados" description="Consulte sua conta e altere seu nome de perfil." onPress={()=>onAbrirOpcao('dados')}/>
    <OpcaoConta title="Trocar senha" description={local ? 'Altere a senha que você usa neste aparelho.' : 'Altere a senha da sua conta no BotecoRate.'} onPress={()=>onAbrirOpcao('senha')}/>
    {local && <OpcaoConta title="Usar uma conta com e-mail" description="Crie ou vincule uma conta para participar e acessar em outros aparelhos." onPress={onVincular}/>}
    {!local && !usuarioLogado.emailVerificado && <OpcaoConta title="Confirmar meu e-mail" description="Reenvie a confirmação ou confira se seu e-mail já foi confirmado." onPress={()=>onAbrirOpcao('verificacao')}/>}
    <OpcaoConta title="Acesso e segurança" description="Consulte o acesso por biometria, bloqueie o app ou saia da conta." onPress={()=>onAbrirOpcao('acesso')}/>
  </Formulario>;
}
