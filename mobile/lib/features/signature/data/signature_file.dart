/// Validação do arquivo de assinatura, antes de gastar rede.
///
/// O backend continua sendo a autoridade — ele confere tipo, tamanho e hash de
/// novo. Isto aqui existe para não fazer o profissional esperar um upload que
/// já se sabe que vai ser recusado, e para dizer **por quê** em português.
///
/// ## Extensão não é tipo
///
/// Um arquivo chamado `assinatura.png` pode conter um JPEG — basta alguém ter
/// renomeado. Por isso a checagem é pelos **primeiros bytes**, que são o que
/// realmente identifica o formato.
library;

import 'dart:typed_data';

/// Formatos que o backend aceita (`MobileSignatureUploadReservationDto`).
const signatureMimeTypes = <String>{'image/png', 'image/jpeg', 'image/webp'};

/// Limite do contrato: 2 MB.
const signatureMaxBytes = 2000000;

/// O que impede enviar este arquivo.
enum SignatureFileProblem { empty, tooLarge, unsupportedType }

/// Resultado da checagem: o tipo detectado ou o motivo da recusa.
class SignatureFileCheck {
  const SignatureFileCheck._({this.mimeType, this.problem});

  const SignatureFileCheck.valid(String mimeType) : this._(mimeType: mimeType);
  const SignatureFileCheck.invalid(SignatureFileProblem problem)
    : this._(problem: problem);

  final String? mimeType;
  final SignatureFileProblem? problem;

  bool get isValid => mimeType != null;
}

/// O tipo real, lido dos primeiros bytes.
///
/// `null` quando não é nenhum dos formatos aceitos — inclusive quando a
/// extensão diz outra coisa.
String? detectImageMimeType(Uint8List bytes) {
  if (bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4e &&
      bytes[3] == 0x47 &&
      bytes[4] == 0x0d &&
      bytes[5] == 0x0a &&
      bytes[6] == 0x1a &&
      bytes[7] == 0x0a) {
    return 'image/png';
  }

  if (bytes.length >= 3 &&
      bytes[0] == 0xff &&
      bytes[1] == 0xd8 &&
      bytes[2] == 0xff) {
    return 'image/jpeg';
  }

  /// WEBP é um contêiner RIFF: "RIFF" nos bytes 0–3 e "WEBP" nos 8–11.
  if (bytes.length >= 12 &&
      bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46 &&
      bytes[8] == 0x57 &&
      bytes[9] == 0x45 &&
      bytes[10] == 0x42 &&
      bytes[11] == 0x50) {
    return 'image/webp';
  }

  return null;
}

/// Checa tamanho e tipo real.
SignatureFileCheck checkSignatureFile(Uint8List bytes) {
  if (bytes.isEmpty) {
    return const SignatureFileCheck.invalid(SignatureFileProblem.empty);
  }
  if (bytes.length > signatureMaxBytes) {
    return const SignatureFileCheck.invalid(SignatureFileProblem.tooLarge);
  }

  final mimeType = detectImageMimeType(bytes);
  if (mimeType == null || !signatureMimeTypes.contains(mimeType)) {
    return const SignatureFileCheck.invalid(
      SignatureFileProblem.unsupportedType,
    );
  }
  return SignatureFileCheck.valid(mimeType);
}
