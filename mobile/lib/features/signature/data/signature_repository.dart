/// Assinatura profissional e aceite do cliente (MB-03).
///
/// ```text
/// GET    /mobile/field/me/signature
/// POST   /mobile/field/me/signature/uploads     → reserva URL assinada
/// PUT    <url assinada>                          → bytes
/// POST   /mobile/field/me/signature              → confirma e ativa
/// DELETE /mobile/field/me/signature
///
/// GET  /mobile/field/operations/:id/customer-acknowledgement/preparation
/// POST /mobile/field/operations/:id/customer-acknowledgement
/// ```
///
/// ## Três coisas que não se misturam
///
/// A **assinatura profissional** pertence ao usuário. O **aceite do cliente**
/// pertence à execução. A **finalização do documento** é outra coisa ainda, e
/// não está aqui. Fundir qualquer par delas — no código ou na tela — apaga uma
/// distinção que o domínio mantém de propósito.
library;

import '../../../core/contracts/mobile_signature_contracts.dart';
import '../../../core/network/orbit_api_client.dart';

class SignatureRepository {
  const SignatureRepository({required OrbitApiClient client})
    : _client = client;

  final OrbitApiClient _client;

  /// Situação da própria assinatura.
  ///
  /// Só a própria: não há endpoint para gerenciar a de outro profissional, e
  /// o app não inventa um.
  Future<MobileSignatureStatus> status() async {
    final data = await _client.get<Map<String, dynamic>>(
      '/mobile/field/me/signature',
    );
    return MobileSignatureStatus.fromJson(data);
  }

  /// Cadastra ou substitui a assinatura, em três passos.
  ///
  /// Reservar, enviar, confirmar — nessa ordem. A assinatura só passa a valer
  /// no terceiro passo: enquanto os bytes estão no storage e ninguém
  /// confirmou, o servidor não a considera ativa, e o app também não deve.
  Future<MobileSignatureUploadResult> upload({
    required String fileName,
    required String mimeType,
    required List<int> bytes,
  }) async {
    final reservation = MobileSignatureUploadReservation.fromJson(
      await _client.post<Map<String, dynamic>>(
        '/mobile/field/me/signature/uploads',
        body: MobileSignatureUploadReservationInput(
          fileName: fileName,
          mimeType: mimeType,
          sizeBytes: bytes.length,
        ).toJson(),
      ),
    );

    await _client.putBytes(
      url: reservation.url,
      bytes: bytes,
      headers: reservation.requiredHeaders,
    );

    return MobileSignatureUploadResult.fromJson(
      await _client.post<Map<String, dynamic>>(
        '/mobile/field/me/signature',
        body: MobileSignatureUploadInput(reservation.fileId).toJson(),
      ),
    );
  }

  Future<MobileSignatureStatus> revoke() async {
    final data = await _client.delete<Map<String, dynamic>>(
      '/mobile/field/me/signature',
    );
    return MobileSignatureStatus.fromJson(data);
  }

  /// O resumo congelado que o cliente revisa.
  Future<CustomerAcknowledgementPreparation> acknowledgementPreparation(
    String operationId,
  ) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/mobile/field/operations/${Uri.encodeComponent(operationId)}'
      '/customer-acknowledgement/preparation',
    );
    return CustomerAcknowledgementPreparation.fromJson(data);
  }

  /// Registra a ciência do cliente.
  ///
  /// `contentVersion` e `contentHash` voltam **verbatim** da preparação: é o
  /// que amarra o aceite ao texto que o cliente leu. Se o atendimento mudou no
  /// meio, o servidor recusa com 409 em vez de registrar concordância com
  /// outro conteúdo.
  ///
  /// Nada aqui toca o cadastro do cliente. `signerName` é de quem deu ciência
  /// naquele atendimento — pode ser o zelador, e não vira nome do cliente.
  Future<CustomerAcknowledgementResult> acknowledge(
    String operationId, {
    required String signerName,
    required String contentVersion,
    required String contentHash,
    required String commandId,
    String? signatureStorageFileId,
    String? contactId,
  }) async {
    final data = await _client.post<Map<String, dynamic>>(
      '/mobile/field/operations/${Uri.encodeComponent(operationId)}'
      '/customer-acknowledgement',
      body: {
        'signerName': signerName,
        'expectedVersion': contentVersion,
        'contentHash': contentHash,
        'commandId': commandId,
        'occurredAt': DateTime.now().toUtc().toIso8601String(),
        if (signatureStorageFileId != null)
          'signatureStorageFileId': signatureStorageFileId,
        if (contactId != null) 'contactId': contactId,
      },
    );
    return CustomerAcknowledgementResult.fromJson(data);
  }
}
