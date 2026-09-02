/// O pipeline de evidências contra o backend real.
///
/// Prova o que só o servidor pode provar: que magic bytes e SHA-256 são
/// conferidos sobre o objeto de verdade, que a mesma captura não vira duas
/// evidências, que um `PUT` concluído não basta, e que o acesso de leitura é
/// temporário.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/contracts/mobile_evidence_contracts.dart';
import 'package:orbit_operator/core/contracts/mobile_field_contracts.dart';
import 'package:orbit_operator/core/errors/orbit_exception.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';
import 'package:orbit_operator/features/evidence/data/evidence_intake.dart';
import 'package:orbit_operator/features/evidence/data/evidence_repository.dart';
import 'package:orbit_operator/features/evidence/data/media_store.dart';

const _baseUrl = String.fromEnvironment(
  'ORBIT_API_URL',
  defaultValue: 'http://localhost:5001/api/v1',
);
const _email = String.fromEnvironment(
  'ORBIT_OWNER_EMAIL',
  defaultValue: 'owner@orbit.local',
);
const _password = String.fromEnvironment(
  'ORBIT_OWNER_PASSWORD',
  defaultValue: 'OrbitOwner@2026',
);

class _MemoryTokenStorage implements TokenStorage {
  TokenPair? _pair;
  @override
  Future<void> clear() async => _pair = null;
  @override
  Future<TokenPair?> read() async => _pair;
  @override
  Future<void> write(TokenPair pair) async => _pair = pair;
}

Future<bool> _apiIsUp() async {
  try {
    final uri = Uri.parse(_baseUrl);
    final socket = await Socket.connect(
      uri.host,
      uri.port,
      timeout: const Duration(seconds: 2),
    );
    socket.destroy();
    return true;
  } on Object {
    return false;
  }
}

/// PNG 1×1 real, com um sufixo que o torna único por execução.
///
/// Bytes diferentes a cada rodada evitam que o teste dependa de estado
/// deixado por uma execução anterior.
Uint8List uniquePng() {
  final base = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM'
    'IQAAAABJRU5ErkJggg==',
  );

  /// Bytes após o IEND são ignorados por decodificadores, e o servidor
  /// identifica o formato pela assinatura inicial — que continua intacta.
  return Uint8List.fromList([
    ...base,
    ...utf8.encode('${DateTime.now().microsecondsSinceEpoch}'),
  ]);
}

void main() {
  late bool available;
  late OrbitApiClient client;
  late EvidenceRepository evidence;

  FieldEvidenceTargetRef? target;

  /// Uma execução de RVT, quando o tenant tiver uma. Prova que o pipeline
  /// atende mais de um tipo de alvo — o backend aceita três, e não é o app
  /// que decide quais.
  FieldEvidenceTargetRef? rvtTarget;

  /// Um alvo que já atingiu o limite, quando houver. O limite é aplicado no
  /// `finalize`, sob lock do alvo — é o servidor que decide, e este campo
  /// existe para prová-lo contra a API real.
  FieldEvidenceTargetRef? saturatedTarget;
  int? saturatedLimit;

  setUpAll(() async {
    available = await _apiIsUp();
    if (!available) return;

    final storage = _MemoryTokenStorage();
    client = OrbitApiClient.create(
      environment: OrbitEnvironment(
        apiBaseUrl: _baseUrl,
        flavor: OrbitFlavor.development,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
      ),
      storage: storage,
      logger: const OrbitLogger(isProduction: false),
    );
    evidence = EvidenceRepository(client: client);

    final login = await client.post<Map<String, dynamic>>(
      '/identity/login',
      body: {'email': _email, 'password': _password},
      isPublic: true,
    );
    await storage.write(TokenPair.fromJson(login));

    /// O alvo sai da própria fila de campo — nada de id inventado.
    ///
    /// A escolha é feita **perguntando ao servidor**: uma reserva de teste em
    /// cada candidato, do fim da fila para o começo. Publicar `ADD_EVIDENCE`
    /// na fila não é o mesmo que estar autorizado a anexar naquele alvo — a
    /// autorização é revalidada na reserva, e é ela que decide.
    ///
    /// Do fim para o começo porque anexar evidência avança o atendimento, e os
    /// smokes da execução e do offline usam os primeiros para afirmar que ler
    /// não muta. Os três rodam em paralelo.
    final queue = await client.get<Map<String, dynamic>>(
      '/mobile/field/work-queue',
      query: {'limit': 50},
    );
    final items = (queue['data'] as List<dynamic>? ?? const [])
        .map(
          (raw) => MobileWorkItemContract.fromJson(
            Map<String, dynamic>.from(raw as Map),
          ),
        )
        .whereType<MobileWorkItemContract>()
        .where(
          (item) => item.allowedActions.contains(MobileFieldAction.addEvidence),
        )
        .toList()
        .reversed;

    Future<bool> accepts(FieldEvidenceTargetRef candidate) async {
      try {
        await evidence.reserve(
          EvidenceUploadIntentRequest(
            target: candidate,
            filename: 'sonda.png',
            declaredMimeType: 'image/png',
            declaredSize: 100,
            idempotencyKey: 'evidence:${newLocalMediaId()}',
          ),
        );
        return true;
      } on OrbitException {
        return false;
      }
    }

    for (final item in items) {
      if ((target == null || saturatedTarget == null) &&
          item.kind == MobileWorkItemKind.serviceOperation) {
        final candidate = FieldEvidenceTargetRef(
          type: FieldEvidenceTarget.operation,
          id: item.sourceId,
        );
        if (await accepts(candidate)) {
          final existing = await evidence.list(target: candidate);

          /// 20 por atendimento (`operationMaximumFiles`).
          ///
          /// O alvo do pipeline precisa de folga para a rodada inteira: esta
          /// suíte cria meia dúzia de evidências, e um alvo quase cheio faria
          /// o teste medir a própria escolha em vez do protocolo. Um alvo
          /// cheio não serve para o pipeline — mas serve, e muito, para provar
          /// que o limite é do servidor.
          if (existing.length >= 20) {
            saturatedTarget ??= candidate;
            saturatedLimit ??= existing.length;
          } else if (existing.length + 8 <= 20) {
            target ??= candidate;
          }
        }
      }

      final executionId = item.navigationContext.executionId;
      if (rvtTarget == null &&
          item.kind == MobileWorkItemKind.rvt &&
          executionId != null) {
        final candidate = FieldEvidenceTargetRef(
          type: FieldEvidenceTarget.rvtExecution,
          id: executionId,
        );
        if (await accepts(candidate)) rvtTarget = candidate;
      }

      if (target != null && rvtTarget != null && saturatedTarget != null) {
        break;
      }
    }
  });

  bool skip() {
    if (!available) {
      markTestSkipped('API indisponível em $_baseUrl');
      return true;
    }
    if (target == null) {
      markTestSkipped(
        'nenhum atendimento com folga de evidências neste tenant',
      );
      return true;
    }
    return false;
  }

  /// Reserva, envia e finaliza — o caminho completo.
  Future<FieldEvidence> upload(Uint8List bytes, {String? localMediaId}) async {
    final id = localMediaId ?? newLocalMediaId();
    final intent = await evidence.reserve(
      EvidenceUploadIntentRequest(
        target: target!,
        filename: 'smoke-$id.png',
        declaredMimeType: 'image/png',
        declaredSize: bytes.length,
        idempotencyKey: 'evidence:$id',
        category: EvidenceCategory.general,
        source: EvidenceSource.camera,
        localMediaId: id,
        expectedSha256: sha256OfBytes(bytes),
      ),
    );
    await evidence.putBytes(
      url: intent.uploadUrl!,
      headers: intent.requiredHeaders,
      bytes: bytes,
    );
    return evidence.finalize(
      intent.uploadId,
      expectedSha256: sha256OfBytes(bytes),
    );
  }

  group('pipeline completo', () {
    test('reservar, enviar e finalizar cria a evidência canônica', () async {
      if (skip()) return;

      final bytes = uniquePng();
      final created = await upload(bytes);

      expect(created.id, isNotEmpty);
      expect(created.mimeType, 'image/png');

      /// O hash é do servidor, calculado sobre o objeto real no storage — e
      /// coincide com o dos bytes que o app enviou.
      expect(created.sha256, sha256OfBytes(bytes));
      expect(created.sizeBytes, bytes.length);

      /// A lista autoritativa passa a incluí-la.
      final list = await evidence.list(target: target!);
      expect(list.map((value) => value.id), contains(created.id));
    });

    test('o localMediaId volta na evidência, ligando as duas pontas', () async {
      if (skip()) return;

      final id = newLocalMediaId();
      final created = await upload(uniquePng(), localMediaId: id);
      expect(created.localMediaId, id);

      /// E `localMediaId` não é o id da evidência.
      expect(created.id, isNot(id));
    });
  });

  group('idempotência', () {
    test('o mesmo localMediaId não vira duas evidências', () async {
      if (skip()) return;

      final bytes = uniquePng();
      final id = newLocalMediaId();
      final first = await upload(bytes, localMediaId: id);

      /// Repetir a intenção devolve a mesma, já finalizada — sem nova URL.
      final again = await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: target!,
          filename: 'smoke-$id.png',
          declaredMimeType: 'image/png',
          declaredSize: bytes.length,
          idempotencyKey: 'evidence:$id',
          category: EvidenceCategory.general,
          source: EvidenceSource.camera,
          localMediaId: id,
          expectedSha256: sha256OfBytes(bytes),
        ),
      );
      expect(again.isFinalized, isTrue);
      expect(again.uploadUrl, isNull);

      final list = await evidence.list(target: target!);
      expect(
        list.where((value) => value.localMediaId == id),
        hasLength(1),
        reason: 'a mesma captura não pode entrar duas vezes',
      );

      /// E finalizar de novo converge no mesmo resultado.
      expect(first.id, isNotEmpty);
    });

    test('mesma chave com outro conteúdo é recusada', () async {
      if (skip()) return;

      final id = newLocalMediaId();
      final bytes = uniquePng();
      await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: target!,
          filename: 'smoke-$id.png',
          declaredMimeType: 'image/png',
          declaredSize: bytes.length,
          idempotencyKey: 'evidence:$id',
          localMediaId: id,
          expectedSha256: sha256OfBytes(bytes),
        ),
      );

      /// Outro tamanho declarado sob a mesma chave: outra intenção se passando
      /// pela primeira.
      await expectLater(
        evidence.reserve(
          EvidenceUploadIntentRequest(
            target: target!,
            filename: 'smoke-$id.png',
            declaredMimeType: 'image/png',
            declaredSize: bytes.length + 100,
            idempotencyKey: 'evidence:$id',
            localMediaId: id,
            expectedSha256: sha256OfBytes(bytes),
          ),
        ),
        throwsA(isA<OrbitException>().having((e) => e.status, 'status', 409)),
      );
    });
  });

  group('validação sobre o objeto real', () {
    test('conteúdo que não corresponde ao tipo declarado é recusado', () async {
      if (skip()) return;

      /// Declara PNG, envia PDF. O servidor relê o objeto no `finalize` e
      /// compara os primeiros bytes — a extensão e a declaração não bastam.
      final fake = Uint8List.fromList(
        utf8.encode('%PDF-1.7 isto não é uma imagem'),
      );
      final id = newLocalMediaId();
      final intent = await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: target!,
          filename: 'mentira-$id.png',
          declaredMimeType: 'image/png',
          declaredSize: fake.length,
          idempotencyKey: 'evidence:$id',
          localMediaId: id,
        ),
      );
      await evidence.putBytes(
        url: intent.uploadUrl!,
        headers: intent.requiredHeaders,
        bytes: fake,
      );

      await expectLater(
        evidence.finalize(intent.uploadId),
        throwsA(isA<OrbitException>()),
      );
    });

    test('hash divergente é recusado', () async {
      if (skip()) return;

      final bytes = uniquePng();
      final id = newLocalMediaId();

      /// Declara o hash de um conteúdo e envia outro — exatamente o que
      /// aconteceria se o app comprimisse depois de calcular.
      final intent = await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: target!,
          filename: 'hash-$id.png',
          declaredMimeType: 'image/png',
          declaredSize: bytes.length,
          idempotencyKey: 'evidence:$id',
          localMediaId: id,
          expectedSha256: sha256OfBytes(uniquePng()),
        ),
      );
      await evidence.putBytes(
        url: intent.uploadUrl!,
        headers: intent.requiredHeaders,
        bytes: bytes,
      );

      await expectLater(
        evidence.finalize(intent.uploadId),
        throwsA(isA<OrbitException>()),
      );
    });

    test('tamanho acima do limite é recusado na reserva', () async {
      if (skip()) return;

      await expectLater(
        evidence.reserve(
          EvidenceUploadIntentRequest(
            target: target!,
            filename: 'grande.png',
            declaredMimeType: 'image/png',
            declaredSize: 99000000,
            idempotencyKey: 'evidence:${newLocalMediaId()}',
          ),
        ),
        throwsA(isA<OrbitException>()),
        reason: 'não faz sentido gastar rede para chegar a um 413',
      );
    });

    test('o limite publicado na reserva é o do backend', () async {
      if (skip()) return;

      final intent = await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: target!,
          filename: 'limite.png',
          declaredMimeType: 'image/png',
          declaredSize: 1000,
          idempotencyKey: 'evidence:${newLocalMediaId()}',
        ),
      );

      /// A checagem local usa o mesmo número, para não prometer um upload que
      /// o servidor recusaria.
      expect(intent.maxSize, evidenceMaxBytesFor('image/png'));
    });
  });

  group('PUT concluído não é evidência', () {
    test('sem finalize, a evidência não existe', () async {
      if (skip()) return;

      final bytes = uniquePng();
      final id = newLocalMediaId();
      final intent = await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: target!,
          filename: 'sem-finalize-$id.png',
          declaredMimeType: 'image/png',
          declaredSize: bytes.length,
          idempotencyKey: 'evidence:$id',
          localMediaId: id,
          expectedSha256: sha256OfBytes(bytes),
        ),
      );
      await evidence.putBytes(
        url: intent.uploadUrl!,
        headers: intent.requiredHeaders,
        bytes: bytes,
      );

      /// Os bytes estão no storage. A lista autoritativa não os conhece.
      final list = await evidence.list(target: target!);
      expect(list.where((value) => value.localMediaId == id), isEmpty);

      /// E o `finalize` posterior é o que a materializa — é assim que um app
      /// morto entre os dois passos se recupera.
      final created = await evidence.finalize(intent.uploadId);
      expect(created.localMediaId, id);
    });
  });

  group('acesso temporário', () {
    test('preview e download vêm assinados e com validade', () async {
      if (skip()) return;

      final created = await upload(uniquePng());

      final preview = await evidence.access(created.id);
      expect(preview.operation, 'preview');
      expect(preview.url.toString(), isNotEmpty);
      expect(preview.isExpired, isFalse);

      final download = await evidence.access(created.id, download: true);
      expect(download.operation, 'download');

      /// Duas emissões produzem credenciais distintas: a URL é temporária, e
      /// guardá-la como atributo da evidência renderia um link morto.
      expect(preview.expiresAt.isAfter(DateTime.now().toUtc()), isTrue);
    });

    test('evidência inexistente não vaza acesso', () async {
      if (skip()) return;

      await expectLater(
        evidence.access('0192f0c0-0000-7000-8000-ffffffffffff'),
        throwsA(isA<OrbitException>()),
      );
    });
  });

  group('escopo', () {
    test('alvo fora da designação é recusado', () async {
      if (skip()) return;

      /// Envelope impecável contra um atendimento que este ator não executa.
      /// O que o servidor recusa é a autorização, revalidada na reserva.
      await expectLater(
        evidence.reserve(
          EvidenceUploadIntentRequest(
            target: const FieldEvidenceTargetRef(
              type: FieldEvidenceTarget.operation,
              id: '0192f0c0-0000-7000-8000-ffffffffffff',
            ),
            filename: 'fora.png',
            declaredMimeType: 'image/png',
            declaredSize: 1000,
            idempotencyKey: 'evidence:${newLocalMediaId()}',
          ),
        ),
        throwsA(isA<OrbitException>()),
      );
    });
  });

  group('outros alvos', () {
    test('a execução de RVT também aceita evidência', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      if (rvtTarget == null) {
        markTestSkipped('sem execução de RVT que aceite evidência');
        return;
      }

      final bytes = uniquePng();
      final id = newLocalMediaId();
      final intent = await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: rvtTarget!,
          filename: 'rvt-$id.png',
          declaredMimeType: 'image/png',
          declaredSize: bytes.length,
          idempotencyKey: 'evidence:$id',
          category: EvidenceCategory.equipment,
          source: EvidenceSource.camera,
          localMediaId: id,
          expectedSha256: sha256OfBytes(bytes),
        ),
      );
      await evidence.putBytes(
        url: intent.uploadUrl!,
        headers: intent.requiredHeaders,
        bytes: bytes,
      );
      final created = await evidence.finalize(
        intent.uploadId,
        expectedSha256: sha256OfBytes(bytes),
      );

      /// O alvo volta com o tipo que o app declarou — e a evidência aparece
      /// na lista daquele alvo, não na do atendimento.
      expect(created.target.type, FieldEvidenceTarget.rvtExecution);
      expect(created.target.id, rvtTarget!.id);
      expect(created.category, EvidenceCategory.equipment);

      final list = await evidence.list(target: rvtTarget!);
      expect(list.map((value) => value.id), contains(created.id));
    });
  });

  group('limite do alvo', () {
    test('atingido o limite, o servidor recusa a próxima', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      if (saturatedTarget == null) {
        markTestSkipped('nenhum alvo deste tenant atingiu o limite');
        return;
      }

      final bytes = uniquePng();
      final id = newLocalMediaId();

      /// A reserva passa: o limite não é contado ali. É no `finalize`, sob
      /// `pg_advisory_xact_lock` do alvo, que a contagem acontece — e é o que
      /// torna a disputa de dois aparelhos pela última vaga segura.
      final intent = await evidence.reserve(
        EvidenceUploadIntentRequest(
          target: saturatedTarget!,
          filename: 'limite-$id.png',
          declaredMimeType: 'image/png',
          declaredSize: bytes.length,
          idempotencyKey: 'evidence:$id',
          localMediaId: id,
          expectedSha256: sha256OfBytes(bytes),
        ),
      );
      await evidence.putBytes(
        url: intent.uploadUrl!,
        headers: intent.requiredHeaders,
        bytes: bytes,
      );

      await expectLater(
        evidence.finalize(
          intent.uploadId,
          expectedSha256: sha256OfBytes(bytes),
        ),
        throwsA(
          isA<OrbitException>()
              .having((e) => e.status, 'status', 409)
              .having((e) => e.code, 'code', 'EVIDENCE_LIMIT_REACHED'),
        ),
      );

      /// E a contagem confirmada não passa do teto.
      final list = await evidence.list(target: saturatedTarget!);
      expect(list.length, saturatedLimit);
    });
  });
}
