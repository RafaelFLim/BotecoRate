import React, { useRef, useState } from "react";

import {
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";

import * as MediaLibrary from "expo-media-library/legacy";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

export default function TelaCamera({ onVoltar, onFotoCapturada }) {
  const cameraRef = useRef(null);

  const [facing, setFacing] = useState("back");
  const [capturedImage, setCapturedImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [mediaPermission, requestMediaPermission] =
    MediaLibrary.usePermissions({
      writeOnly: true,
    });

  async function requestPermissions() {
    try {
      const cameraResult = await requestCameraPermission();
      const mediaResult = await requestMediaPermission();

      if (!cameraResult.granted || !mediaResult.granted) {
        Alert.alert(
          "Permissoes necessarias",
          "E necessario permitir o uso da camera e o salvamento de fotos."
        );

        return;
      }

      Alert.alert(
        "Permissoes concedidas",
        "Agora voce pode tirar e salvar fotos."
      );
    } catch (error) {
      console.error("Erro ao solicitar permissoes:", error);

      Alert.alert(
        "Erro",
        "Nao foi possivel solicitar as permissoes."
      );
    }
  }

  function toggleCameraFacing() {
    setFacing(current =>
      current === "back" ? "front" : "back"
    );
  }

  async function takePicture() {
    if (!cameraRef.current || isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        throw new Error("A camera nao retornou uma foto valida.");
      }

      const fileName =
        photo.uri.split("/").pop();

      console.log("Nome do arquivo:", fileName);
      console.log("URI temporaria:", photo.uri);
      console.log(
        "Tamanho do Base64:",
        photo.base64?.length ?? 0
      );

      let permission = mediaPermission;

      if (!permission?.granted) {
        permission = await requestMediaPermission();
      }

      if (!permission.granted) {
        throw new Error(
          "A permissao para salvar a foto nao foi concedida."
        );
      }

      await MediaLibrary.saveToLibraryAsync(photo.uri);

      console.log("Status: foto salva com sucesso");
      console.log("Destino: galeria geral do celular");
      console.log("Nome do arquivo:", fileName);
      console.log("URI original:", photo.uri);

      setCapturedImage(photo.uri);
      setModalVisible(true);
      onFotoCapturada?.(photo.uri);

      Alert.alert(
        "Foto salva com sucesso",
        "A foto foi salva na galeria geral do celular."
      );
    } catch (error) {
      console.error(
        "Erro ao capturar ou salvar a foto:",
        error
      );

      Alert.alert(
        "Erro",
        error?.message ||
          "Nao foi possivel capturar ou salvar a foto."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!cameraPermission || !mediaPermission) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Verificando permissoes...
        </Text>
      </View>
    );
  }

  if (
    !cameraPermission.granted ||
    !mediaPermission.granted
  ) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>
          Permissoes necessarias
        </Text>

        <Text style={styles.permissionMessage}>
          Autorize o uso da camera e o salvamento de fotos na
          galeria.
        </Text>

        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermissions}
        >
          <Text style={styles.permissionButtonText}>
            Conceder permissoes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.permissionButton, styles.backButton]}
          onPress={onVoltar}
        >
          <Text style={styles.permissionButtonText}>
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
    >
      <View style={styles.cameraContainer}>

        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="picture"
        />

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleCameraFacing}
            disabled={isSaving}
          >
            <Image
              style={styles.icon}
              source={require("../../assets/flip.png")}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.captureButton,
              isSaving && styles.disabledButton,
            ]}
            onPress={takePicture}
            disabled={isSaving}
          >
            <Image
              style={styles.captureIcon}
              source={require("../../assets/camera.png")}
            />
          </TouchableOpacity>
        </View>

        {isSaving && (
          <View style={styles.savingContainer}>
            <Text style={styles.savingText}>
              Salvando foto...
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.voltarButton}
          onPress={onVoltar}
        >
          <Text style={styles.voltarText}>X</Text>
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={modalVisible}
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Image
              style={styles.closeIcon}
              source={require("../../assets/close.png")}
            />
          </TouchableOpacity>

          {capturedImage && (
            <Image
              style={styles.previewImage}
              source={{ uri: capturedImage }}
              resizeMode="contain"
            />
          )}

          <Text style={styles.savedMessage}>
            Foto salva na galeria
          </Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },

  loadingText: {
    color: "#fff",
    fontSize: 16,
  },

  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    backgroundColor: "#fff",
  },

  permissionTitle: {
    marginBottom: 12,
    color: "#111827",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },

  permissionMessage: {
    marginBottom: 25,
    color: "#4b5563",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },

  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    marginBottom: 12,
  },

  backButton: {
    backgroundColor: "#6b7280",
  },

  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  cameraContainer: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  buttonContainer: {
    position: "absolute",
    right: 0,
    bottom: 30,
    left: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 35,
  },

  flipButton: {
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },

  captureButton: {
    width: 76,
    height: 76,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 38,
    backgroundColor: "#fff",
  },

  disabledButton: {
    opacity: 0.5,
  },

  icon: {
    width: "65%",
    height: "65%",
    resizeMode: "contain",
  },

  captureIcon: {
    width: "65%",
    height: "65%",
    resizeMode: "contain",
  },

  savingContainer: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },

  savingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },

  voltarButton: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  voltarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.96)",
  },

  previewImage: {
    width: "100%",
    height: "80%",
  },

  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 25,
    backgroundColor: "#fff",
  },

  closeIcon: {
    width: "60%",
    height: "60%",
    resizeMode: "contain",
  },

  savedMessage: {
    position: "absolute",
    bottom: 25,
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});
