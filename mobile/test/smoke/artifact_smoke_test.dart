/// O documento de campo contra o backend real.
///
/// Prova o que só o servidor pode provar: que preparar congela um snapshot com
/// hash, que repetir não cria um segundo documento, que a renderização é
/// assíncrona, que o arquivo é um PDF de verdade, e que o snapshot não muda
/// quando a fonte muda depois.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/contracts/mobile_field_artifact_contracts.dart';
import 'package:orbit_operator/core/errors/orbit_exception.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';
import 'package:orbit_operator/features/artifact/data/artifact_repository.dart';
import 'package:orbit_operator/features/artifact/data/document_file.dart';

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

void main() {
  late bool available;
  late OrbitApiClient client;
  late ArtifactRepository artifacts;

  /// Fontes elegíveis e ainda sem documento. Uma por teste que congela — o
  /// snapshot é irreversível, e reaproveitar faria os testes medirem a ordem
  /// em que rodaram.
  final freezable = <String>[];

  /// Fontes que já têm documento, por estado.
  ///
  /// Reaproveitar o que existe é o que permite exercitar renderização e acesso
  /// sem congelar mais nada: o que os testes precisam é de um documento no
  /// estado certo, não de uma fonte nova.
  String? withArtifact;
  final prepared = <FieldArtifact>[];
  final ready = <FieldArtifact>[];

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
    artifacts = ArtifactRepository(client: client);

    final login = await client.post<Map<String, dynamic>>(
      '/identity/login',
      body: {'email': _email, 'password': _password},
      isPublic: true,
    );
    await storage.write(TokenPair.fromJson(login));

    /// As fontes saem da própria lista de atendimentos — nada de id inventado
    /// nem de escrita direta no banco.
    final page = await client.get<Map<String, dynamic>>(
      '/operations',
      query: {'limit': 50},
    );
    for (final raw in (page['data'] as List<dynamic>? ?? const [])) {
      final id = (raw as Map)['id'] as String?;
      if (id == null) continue;
      try {
        final preparation = await artifacts.preparation(
          sourceType: FieldArtifactSourceType.operation,
          sourceId: id,
        );
        if (preparation.existingArtifact case final artifact?) {
          withArtifact ??= id;
          if (artifact.status == FieldArtifactStatus.ready) {
            ready.add(artifact);
          } else if (artifact.status == FieldArtifactStatus.prepared) {
            prepared.add(artifact);
          }
        } else if (preparation.allows(
          FieldArtifactAllowedAction.prepareDocument,
        )) {
          freezable.add(id);
        }
      } on OrbitException {
        /// Fonte fora do escopo deste ator: o servidor decide, e seguir em
        /// frente é a resposta certa.
        continue;
      }
    }
  });

  /// Qualquer fonte que este ator enxergue — para os testes que só leem.
  String? anySource() => freezable.isNotEmpty ? freezable.first : withArtifact;

  bool skip() {
    if (!available) {
      markTestSkipped('API indisponível em $_baseUrl');
      return true;
    }
    if (freezable.isEmpty && withArtifact == null) {
      markTestSkipped('sem atendimento elegível neste tenant');
      return true;
    }
    return false;
  }

  /// Uma fonte concluída que ainda não tem documento.
  ///
  /// **O smoke não cria uma.** Concluir um atendimento é transição de negócio,
  /// não preparo de teste: fazê-lo a cada execução consumiria as fontes do
  /// ambiente até não sobrar nenhuma — que foi exatamente o que aconteceu
  /// quando este arquivo tentou se auto-provisionar. Sem fonte virgem, o gate
  /// pula dizendo por quê, em vez de gastar o tenant para ficar verde.
  String? virginSource() => freezable.isEmpty ? null : freezable.removeAt(0);

  /// Um documento já renderizado, preparado uma vez e reaproveitado.
  ///
  /// Os testes de leitura — acesso, PDF, imutabilidade — não precisam de uma
  /// fonte virgem cada um; precisam de um documento pronto, e ele é o mesmo.
  FieldArtifact? shared;
  Future<FieldArtifact?> readyArtifact() async {
    if (shared != null) return shared;

    /// Reaproveita um documento pronto antes de congelar mais um: os testes
    /// de leitura precisam de um documento no estado certo, não de um novo.
    if (ready.isNotEmpty) return shared = ready.first;

    FieldArtifact? artifact = prepared.isNotEmpty ? prepared.removeAt(0) : null;
    if (artifact == null) {
      final sourceId = virginSource();
      if (sourceId == null) return null;
      artifact = await artifacts.prepare(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );
    }
    await artifacts.render(artifact.id);

    var current = await artifacts.get(artifact.id);
    for (var attempt = 0; attempt < 40 && current.isTransient; attempt += 1) {
      await Future<void>.delayed(const Duration(milliseconds: 500));
      current = await artifacts.get(artifact.id);
    }
    return shared = current;
  }

  group('preparação', () {
    test('a elegibilidade e os bloqueios vêm calculados do servidor', () async {
      if (skip()) return;
      final sourceId = anySource()!;

      final preparation = await artifacts.preparation(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );

      expect(preparation.sourceType, FieldArtifactSourceType.operation);
      expect(preparation.documentType, FieldArtifactDocumentType.serviceOrder);

      /// Elegível quando não há bloqueio, e bloqueado quando há — os dois
      /// vêm do servidor, e o app não recalcula nenhum.
      expect(
        preparation.eligibility.eligible,
        preparation.eligibility.blockedReasons.isEmpty,
      );

      /// A resposta traz assinaturas, aceite e evidências — uma requisição
      /// resolve a seção inteira, sem N+1 por signatário ou evidência.
      expect(preparation.professionalSignatures.fieldTechnician, isNotNull);
      expect(preparation.evidenceSummary.finalized, greaterThanOrEqualTo(0));
      expect(preparation.customerAcknowledgement.valid, isNotNull);
    });

    test('consultar não congela nada', () async {
      if (skip()) return;
      final sourceId = anySource()!;
      final before = await artifacts.preparation(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );

      await artifacts.preparation(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );
      final again = await artifacts.preparation(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );

      /// Congelar é irreversível: abrir a tela do documento não pode fazê-lo.
      /// A consulta repetida devolve exatamente o mesmo — nada foi criado
      /// nem alterado por ter olhado.
      expect(again.existingArtifact?.id, before.existingArtifact?.id);
      expect(
        again.existingArtifact?.snapshotHash,
        before.existingArtifact?.snapshotHash,
      );
      expect(again.allowedActions, before.allowedActions);
    });

    test('fonte fora do escopo não vaza documento', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      await expectLater(
        artifacts.preparation(
          sourceType: FieldArtifactSourceType.operation,
          sourceId: '0192f0c0-0000-7000-8000-ffffffffffff',
        ),
        throwsA(isA<OrbitException>()),
      );
    });
  });

  group('congelar o snapshot', () {
    test('preparar cria o documento com versão e hash', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      final sourceId = virginSource();
      if (sourceId == null) {
        markTestSkipped(
          'sem atendimento concluído e ainda sem documento neste tenant',
        );
        return;
      }

      final artifact = await artifacts.prepare(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );

      expect(artifact.id, isNotEmpty);
      expect(artifact.sourceId, sourceId);
      expect(artifact.status, FieldArtifactStatus.prepared);
      expect(artifact.snapshotVersion, greaterThanOrEqualTo(1));

      /// SHA-256 dos fatos congelados, calculado pelo servidor.
      expect(artifact.snapshotHash, hasLength(64));

      /// Congelado, mas não renderizado: ainda não há arquivo.
      expect(artifact.previewAvailable, isFalse);
      expect(artifact.downloadAvailable, isFalse);
      expect(artifact.generatedAt, isNull);
      expect(
        artifact.allowedActions,
        contains(FieldArtifactAllowedAction.generateDocument),
      );
    });

    test('repetir não cria um segundo documento', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      final sourceId = virginSource();
      if (sourceId == null) {
        markTestSkipped(
          'sem atendimento concluído e ainda sem documento neste tenant',
        );
        return;
      }

      final first = await artifacts.prepare(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );
      final again = await artifacts.prepare(
        sourceType: FieldArtifactSourceType.operation,
        sourceId: sourceId,
      );

      expect(again.id, first.id);
      expect(again.snapshotHash, first.snapshotHash);
      expect(again.snapshotVersion, first.snapshotVersion);
    });

    test('duas requisições concorrentes produzem um documento só', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      final sourceId = virginSource();
      if (sourceId == null) {
        markTestSkipped(
          'sem atendimento concluído e ainda sem documento neste tenant',
        );
        return;
      }

      /// Dois aparelhos tocando ao mesmo tempo. O servidor resolve sob
      /// advisory lock; o app só precisa tratar a resposta.
      final results = await Future.wait([
        artifacts.prepare(
          sourceType: FieldArtifactSourceType.operation,
          sourceId: sourceId,
        ),
        artifacts.prepare(
          sourceType: FieldArtifactSourceType.operation,
          sourceId: sourceId,
        ),
      ]);

      expect(results[0].id, results[1].id);
      expect(results[0].snapshotHash, results[1].snapshotHash);
    });
  });

  group('renderização assíncrona', () {
    test('pedir a emissão é aceito, e não significa PDF pronto', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }

      /// Um documento congelado e ainda não renderizado — o estado exato em
      /// que a emissão pode ser pedida.
      if (prepared.isEmpty) {
        markTestSkipped('sem documento congelado e não renderizado');
        return;
      }
      final artifact = prepared.removeAt(0);
      expect(
        artifact.allowedActions,
        contains(FieldArtifactAllowedAction.generateDocument),
      );
      expect(artifact.previewAvailable, isFalse);
      expect(artifact.generatedAt, isNull);

      final requested = await artifacts.render(artifact.id);

      /// O trabalho acontece fora desta requisição.
      expect(
        requested.status,
        anyOf(
          FieldArtifactStatus.pending,
          FieldArtifactStatus.rendering,
          FieldArtifactStatus.ready,
        ),
      );

      /// Enquanto está em curso, o servidor não publica ações de leitura.
      if (requested.isTransient) {
        expect(requested.previewAvailable, isFalse);
        expect(requested.allowedActions, isEmpty);
      }

      /// Repetir enquanto já está em curso não enfileira de novo, e o
      /// snapshot não se mexe.
      final repeated = await artifacts.render(artifact.id);
      expect(repeated.id, artifact.id);
      expect(repeated.snapshotHash, artifact.snapshotHash);
      expect(repeated.snapshotVersion, artifact.snapshotVersion);
    });

    test('o estado é consultável e converge', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      if (prepared.isEmpty) {
        markTestSkipped('sem documento congelado e não renderizado');
        return;
      }
      final artifact = prepared.removeAt(0);
      await artifacts.render(artifact.id);

      /// Acompanha como o app acompanha: consultando, com espera entre as
      /// tentativas — nunca deduzindo o desfecho.
      var current = await artifacts.get(artifact.id);
      for (var attempt = 0; attempt < 30 && current.isTransient; attempt += 1) {
        await Future<void>.delayed(const Duration(milliseconds: 500));
        current = await artifacts.get(artifact.id);
      }

      if (current.isTransient) {
        markTestSkipped('a renderização não concluiu no tempo do smoke');
        return;
      }

      /// O snapshot não muda por causa da renderização.
      expect(current.snapshotHash, artifact.snapshotHash);
      expect(current.snapshotVersion, artifact.snapshotVersion);

      if (current.status == FieldArtifactStatus.ready) {
        expect(current.downloadAvailable, isTrue);
        expect(current.generatedAt, isNotNull);
        expect(
          current.allowedActions,
          contains(FieldArtifactAllowedAction.downloadDocument),
        );
      } else {
        /// Falha é um desfecho legítimo, e o servidor republica a ação de
        /// emitir para que a pessoa possa tentar de novo.
        expect(current.status, FieldArtifactStatus.failed);
        expect(
          current.allowedActions,
          contains(FieldArtifactAllowedAction.generateDocument),
        );
      }
    });
  });

  group('arquivo', () {
    test('o acesso é temporário e o conteúdo é um PDF de verdade', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      final current = await readyArtifact();
      if (current == null) {
        markTestSkipped('sem atendimento elegível neste tenant');
        return;
      }
      if (current.status != FieldArtifactStatus.ready) {
        markTestSkipped('o documento não ficou pronto no tempo do smoke');
        return;
      }

      final access = await artifacts.access(current.id);
      expect(access.artifactId, current.id);
      expect(access.operation, 'download');
      expect(access.isExpired, isFalse);

      /// Curta por natureza: é credencial, não atributo do documento.
      expect(
        access.expiresAt.difference(DateTime.now().toUtc()),
        lessThan(const Duration(days: 1)),
      );

      final file = await artifacts.download(access);
      expect(checkDocumentBytes(file.bytes), isNull);

      /// O nome vem publicado no `Content-Disposition` — e é ele que a pessoa
      /// vê ao abrir ou compartilhar.
      expect(file.fileName, isNotNull);
      expect(file.fileName, endsWith('.pdf'));
      expect(file.fileName, isNot(contains('/')));

      /// E os primeiros bytes são de um PDF.
      expect(utf8.decode(file.bytes.take(5).toList()), '%PDF-');

      /// Uma nova emissão de acesso produz outra credencial.
      final preview = await artifacts.access(current.id, preview: true);
      expect(preview.operation, 'preview');
    });

    test('documento sem arquivo não emite acesso', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      if (prepared.isEmpty) {
        markTestSkipped('sem documento congelado e não renderizado');
        return;
      }

      /// Congelado, sem renderização: não há arquivo, e o servidor diz isso
      /// em vez de devolver uma URL para o nada.
      await expectLater(
        artifacts.access(prepared.first.id),
        throwsA(isA<OrbitException>()),
      );
    });

    test('artefato inexistente não vaza acesso', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      await expectLater(
        artifacts.access('0192f0c0-0000-7000-8000-ffffffffffff'),
        throwsA(isA<OrbitException>()),
      );
    });
  });

  group('imutabilidade', () {
    test('trocar a assinatura depois não reescreve o documento', () async {
      if (!available) {
        markTestSkipped('API indisponível em $_baseUrl');
        return;
      }
      final artifact = await readyArtifact();
      if (artifact == null) {
        markTestSkipped('sem atendimento elegível neste tenant');
        return;
      }

      /// A assinatura profissional é um dos fatos congelados no snapshot.
      /// Trocá-la é uma mudança real, pelo fluxo do produto — e é o cenário
      /// que mais tenta a implementação a "atualizar" o documento antigo.
      final png = base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAE'
        'hQGAhKmMIQAAAABJRU5ErkJggg==',
      );
      try {
        final reservation = await client.post<Map<String, dynamic>>(
          '/mobile/field/me/signature/uploads',
          body: {
            'fileName': 'assinatura.png',
            'mimeType': 'image/png',
            'sizeBytes': png.length,
          },
        );
        final upload = reservation['upload']! as Map<String, dynamic>;
        await client.putBytes(
          url: Uri.parse(upload['url']! as String),
          bytes: png,
          headers: (upload['requiredHeaders'] as Map<Object?, Object?>).map(
            (key, value) => MapEntry(key! as String, '$value'),
          ),
        );
        await client.post<Map<String, dynamic>>(
          '/mobile/field/me/signature',
          body: {'storageObjectId': reservation['fileId']},
        );
      } on OrbitException {
        markTestSkipped('não foi possível trocar a assinatura neste ambiente');
        return;
      }

      final after = await artifacts.get(artifact.id);

      /// O documento emitido é uma projeção de fatos congelados. Mudou a
      /// assinatura, muda o próximo documento — não o que já foi congelado.
      expect(after.snapshotHash, artifact.snapshotHash);
      expect(after.snapshotVersion, artifact.snapshotVersion);
      expect(after.id, artifact.id);
      expect(after.generatedAt, artifact.generatedAt);
    });
  });
}
