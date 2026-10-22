import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Botao } from '../components/Formulario';

export default function TelaAbertura({error, onRetry}) {
  const [details, setDetails] = useState(false);
  return <SafeAreaView style={styles.page}>
    <View style={styles.content}>
      <Image source={require('../../assets/icone.png')} style={styles.logo} accessibilityLabel="BotecoRate"/>
      <Text style={styles.title}>BotecoRate</Text>
      {error ? <>
        <Text accessibilityRole="alert" style={styles.subtitle}>Não foi possível abrir o app agora.</Text>
        <Text style={styles.message}>Tente novamente para continuar. Suas informações não serão apagadas.</Text>
        <Botao onPress={()=>{setDetails(false);onRetry();}}>Tentar novamente</Botao>
        <TouchableOpacity onPress={()=>setDetails(!details)} accessibilityRole="button"><Text style={styles.details}>{details ? 'Ocultar detalhes' : 'Ver detalhes do problema'}</Text></TouchableOpacity>
        {details && <Text selectable style={styles.message}>{error}</Text>}
      </> : <>
        <Text style={styles.subtitle}>Estamos preparando tudo para você.</Text>
        <ActivityIndicator size="large" color="#6c63ff" style={{marginTop:24}}/>
        <Text style={styles.message}>Só um instante…</Text>
      </>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#f3f4f6',justifyContent:'center',padding:28},
  content:{width:'100%',maxWidth:420,alignSelf:'center',alignItems:'stretch'},
  logo:{width:112,height:112,alignSelf:'center',borderRadius:26,marginBottom:20},
  title:{fontSize:32,fontWeight:'800',color:'#1a1a2e',textAlign:'center',marginBottom:12},
  subtitle:{fontSize:18,color:'#1a1a2e',textAlign:'center',lineHeight:26},
  message:{fontSize:15,color:'#596273',textAlign:'center',lineHeight:23,marginVertical:14},
  details:{color:'#6c63ff',textAlign:'center',padding:14},
});
