import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Formulario, Aviso, Botao } from '../components/Formulario';

export default function TelaAcessoConta({onVoltar, onContaLocal, onContaEmail}) {
  return <Formulario title="Perfil" onVoltar={onVoltar}>
    <Text style={styles.title}>Como você quer entrar?</Text>
    <Aviso>Escolha o tipo de conta para entrar ou se cadastrar. Você também pode continuar consultando os bares sem uma conta.</Aviso>
    <TouchableOpacity accessibilityRole="button" style={styles.card} onPress={onContaLocal}>
      <View style={styles.row}><Text style={styles.cardTitle}>Conta local</Text><Text style={styles.arrow}>→</Text></View>
      <Text style={styles.badge}>Neste aparelho · acesso offline</Text>
      <Text style={styles.description}>Entre ou crie uma conta com usuário e senha para consultar os bares e endereços disponíveis neste aparelho.</Text>
      <Text style={styles.action}>Acessar conta local</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={styles.card} onPress={onContaEmail}>
      <View style={styles.row}><Text style={styles.cardTitle}>Conta com e-mail</Text><Text style={styles.arrow}>→</Text></View>
      <Text style={styles.badge}>Conexão para entrar ou se cadastrar</Text>
      <Text style={styles.description}>Entre, crie uma conta ou recupere sua senha. Confirme seu e-mail para participar das avaliações e usar sua conta em outros aparelhos.</Text>
      <Text style={styles.action}>Acessar conta com e-mail</Text>
    </TouchableOpacity>
    <Botao secondary onPress={onVoltar}>Voltar aos bares</Botao>
  </Formulario>;
}

const styles=StyleSheet.create({
  title:{fontSize:24,fontWeight:'700',color:'#1a1a2e',marginBottom:4},
  card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#ddd6fe',borderRadius:16,padding:20,marginVertical:10},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  cardTitle:{fontSize:20,fontWeight:'700',color:'#1a1a2e'},
  arrow:{fontSize:24,color:'#6c63ff'},
  badge:{fontSize:13,color:'#6c63ff',marginTop:8,fontWeight:'600'},
  description:{fontSize:15,color:'#4b5563',lineHeight:23,marginVertical:14},
  action:{fontSize:15,color:'#6c63ff',fontWeight:'700'},
});
