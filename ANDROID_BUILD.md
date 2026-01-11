# Guia de Compilação Android - CaminhoSeguro

Este guia explica como compilar o app CaminhoSeguro para Android.

## Pré-requisitos

1. **Android Studio** (versão mais recente)
   - Download: https://developer.android.com/studio
   
2. **JDK 17 ou superior**
   - Android Studio já inclui o JDK

3. **Conta Google Play Console** (para publicação)
   - Taxa única: $25
   - Link: https://play.google.com/console

## Passos para Compilar

### 1. Clone ou baixe o projeto

Se estiver no Replit, baixe o projeto como ZIP (clique nos três pontos no explorador de arquivos).

### 2. Instale as dependências

```bash
npm install
```

### 3. Compile o frontend

```bash
npm run build
```

### 4. Sincronize com Capacitor

```bash
npx cap sync android
```

### 5. Abra no Android Studio

```bash
npx cap open android
```

Ou abra o Android Studio manualmente e selecione a pasta `android/`.

### 6. Configure a chave de assinatura

Para publicar na Play Store, você precisa criar uma keystore:

```bash
keytool -genkey -v -keystore caminhoseguro-release.keystore -alias caminhoseguro -keyalg RSA -keysize 2048 -validity 10000
```

### 7. Gere o APK/AAB

No Android Studio:
1. Vá em **Build > Generate Signed Bundle / APK**
2. Selecione **Android App Bundle (AAB)** para Play Store
3. Escolha sua keystore
4. Selecione **release** como build variant
5. Clique em **Finish**

O arquivo será gerado em: `android/app/release/app-release.aab`

## Testando no Emulador

1. No Android Studio, vá em **Tools > Device Manager**
2. Crie um novo dispositivo virtual (recomendado: Pixel 6, API 33+)
3. Clique no botão de play verde para executar o app

## Testando em Dispositivo Físico

1. Ative o **Modo Desenvolvedor** no seu celular:
   - Configurações > Sobre o telefone > Toque 7x no "Número da versão"
2. Ative a **Depuração USB** em Opções do desenvolvedor
3. Conecte o celular via USB
4. Selecione seu dispositivo no Android Studio e clique em play

## Publicando na Play Store

1. Acesse https://play.google.com/console
2. Crie um novo app
3. Preencha as informações do app:
   - Nome: CaminhoSeguro
   - Categoria: Social
   - Classificação de conteúdo: Preencha o questionário
4. Faça upload do arquivo AAB em **Release > Production**
5. Complete a revisão de conteúdo e políticas

## Recursos do App

- **Ícone**: Localizado em `android/app/src/main/res/mipmap-*/`
- **Splash Screen**: Configurado em `capacitor.config.ts`
- **Cores**: Violeta primário (#7c3aed)

## Solução de Problemas

### Erro de Gradle
```bash
cd android && ./gradlew clean && cd ..
npx cap sync android
```

### Erro de SDK
Abra o SDK Manager no Android Studio e instale:
- Android SDK Platform 33+
- Android SDK Build-Tools 33+

### Erro de Permissões
Certifique-se de que as permissões de localização estão no AndroidManifest.xml.

## Suporte

Para dúvidas ou problemas, entre em contato pelo app ou visite https://caminhoseguro.ltd
