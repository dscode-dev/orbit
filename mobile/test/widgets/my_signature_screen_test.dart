/// A tela da assinatura profissional, com o pipeline de três passos scriptado.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/theme/orbit_theme.dart';
import 'package:orbit_operator/features/signature/application/signature_providers.dart';
import 'package:orbit_operator/features/signature/data/signature_repository.dart';
import 'package:orbit_operator/features/signature/presentation/my_signature_screen.dart';

import '../support/fakes.dart';
import '../support/scripted_adapter.dart';

/// Um PNG 1×1 real — assinatura de arquivo válida, decodificável.
final validPng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM'
  'IQAAAABJRU5ErkJggg==',
);

Map<String, dynamic> status({bool available = false}) => {
  'signatureAvailable': available,
  'version': available ? 2 : null,
  'updatedAt': available ? '2026-08-20T10:00:00.000Z' : null,
  'roles': ['FIELD_TECHNICIAN', 'TECHNICAL_RESPONSIBLE'],
};

/// Reproduz a conversa do backend: status, reserva, PUT assinado, confirmação.
class Backend {
  Backend({this.available = false, this.failSignedPut = false});

  final bool available;
  final bool failSignedPut;
  final paths = <String>[];
  bool confirmed = false;

  Future<ResponseBody> call(RequestOptions options) async {
    /// O caminho sem o prefixo da API: o teste fala do endpoint, não da
    /// montagem da URL base.
    final path =
        '${options.method} '
        '${options.uri.path.replaceFirst(RegExp(r'^.*?(?=/mobile/|/put/)'), '')}';
    paths.add(path);

    if (path == 'GET /mobile/field/me/signature') {
      return jsonResponse({
        'success': true,
        'data': status(available: available || confirmed),
      });
    }
    if (path == 'POST /mobile/field/me/signature/uploads') {
      return jsonResponse({
        'success': true,
        'data': {
          'fileId': 'file-1',
          'upload': {
            'url': 'https://storage.example/put/file-1?sig=abc',
            'expiresAt': '2026-09-01T12:10:00.000Z',
            'requiredHeaders': {'Content-Type': 'image/png'},
          },
        },
      });
    }
    if (options.uri.host == 'storage.example') {
      if (failSignedPut) {
        return ResponseBody.fromString('', 503);
      }
      return ResponseBody.fromString('', 200);
    }
    if (path == 'POST /mobile/field/me/signature') {
      confirmed = true;
      return jsonResponse({
        'success': true,

        /// O resultado é **plano**: estende o status e acrescenta a versão
        /// substituída, como `MobileSignatureUploadResultReadModel`.
        'data': {
          ...status(available: true),
          'replacedVersion': available ? 1 : null,
        },
      });
    }
    return ResponseBody.fromString('{}', 404);
  }
}

Widget wrap(
  Backend backend, {
  double textScale = 1.0,
  double width = 400,
  Uint8List? picks,
  String fileName = 'assinatura.png',
}) {
  final dio = Dio()..httpClientAdapter = ScriptedAdapter(backend.call);
  final plain = Dio()..httpClientAdapter = ScriptedAdapter(backend.call);
  final client = OrbitApiClient.create(
    environment: OrbitEnvironment.fromDefines(),
    storage: InMemoryTokenStorage(),
    logger: const OrbitLogger(isProduction: true),
    dio: dio,
    retryDio: plain,
  );

  return ProviderScope(
    overrides: [
      signatureRepositoryProvider.overrideWithValue(
        SignatureRepository(client: client),
      ),
    ],
    child: MediaQuery(
      data: MediaQueryData(
        textScaler: TextScaler.linear(textScale),
        size: Size(width, 780),
      ),
      child: MaterialApp(
        theme: OrbitTheme.dark(),
        home: MySignatureScreen(
          source: () async =>
              picks == null ? null : (bytes: picks, fileName: fileName),
        ),
      ),
    ),
  );
}

void main() {
  setUpAll(() async => initializeDateFormatting('pt_BR'));

  Object? layoutError;
  setUp(() {
    layoutError = null;
    FlutterError.onError = (details) => layoutError ??= details.exception;
  });
  tearDown(() => FlutterError.onError = FlutterError.presentError);

  testWidgets('sem assinatura, a tela convida a cadastrar', (tester) async {
    await tester.pumpWidget(wrap(Backend()));
    await tester.pumpAndSettle();

    expect(find.text('Assinatura não cadastrada'), findsOneWidget);
    expect(find.text('Escolher imagem'), findsOneWidget);

    /// Os dois papéis compartilham a mesma assinatura — não há uma por papel.
    expect(find.text('Técnico em Campo · Responsável Técnico'), findsOneWidget);
  });

  testWidgets('com assinatura, a ação é substituir e diz o efeito real', (
    tester,
  ) async {
    await tester.pumpWidget(wrap(Backend(available: true)));
    await tester.pumpAndSettle();

    expect(find.text('Substituir assinatura'), findsWidgets);
    expect(
      find.textContaining('documentos já emitidos permanecem como estão'),
      findsOneWidget,
    );
  });

  testWidgets('o arquivo escolhido é mostrado antes de virar assinatura', (
    tester,
  ) async {
    final backend = Backend();
    await tester.pumpWidget(wrap(backend, picks: validPng));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Escolher imagem'));
    await tester.pumpAndSettle();

    expect(find.byType(Image), findsOneWidget);
    expect(find.text('Confirmar assinatura'), findsOneWidget);
    expect(find.text('Escolher outra imagem'), findsOneWidget);

    /// Nada subiu ainda: escolher não é enviar.
    expect(backend.paths.where((p) => p.startsWith('POST')), isEmpty);
  });

  testWidgets('confirmar percorre reservar, enviar e confirmar', (
    tester,
  ) async {
    final backend = Backend();
    await tester.pumpWidget(wrap(backend, picks: validPng));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Escolher imagem'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Confirmar assinatura'));
    await tester.pumpAndSettle();

    expect(backend.paths, [
      'GET /mobile/field/me/signature',
      'POST /mobile/field/me/signature/uploads',
      'PUT /put/file-1',
      'POST /mobile/field/me/signature',
      'GET /mobile/field/me/signature',
    ]);
    expect(find.text('Assinatura atualizada.'), findsOneWidget);
    expect(find.text('Assinatura cadastrada'), findsOneWidget);
  });

  testWidgets('arquivo fora do contrato é recusado sem gastar rede', (
    tester,
  ) async {
    final backend = Backend();

    /// Um PDF renomeado para `.png`: a extensão mente, os bytes não.
    await tester.pumpWidget(
      wrap(backend, picks: Uint8List.fromList(utf8.encode('%PDF-1.7 x'))),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Escolher imagem'));
    await tester.pumpAndSettle();

    expect(find.byType(Image), findsNothing);
    expect(find.text('Confirmar assinatura'), findsNothing);
    expect(find.textContaining('PNG, JPEG ou WEBP'), findsWidgets);
    expect(backend.paths.where((p) => p.startsWith('POST')), isEmpty);
  });

  testWidgets('falha no envio dos bytes não declara assinatura cadastrada', (
    tester,
  ) async {
    final backend = Backend(failSignedPut: true);
    await tester.pumpWidget(wrap(backend, picks: validPng));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Escolher imagem'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Confirmar assinatura'));
    await tester.pumpAndSettle();

    /// O arquivo órfão no storage não é uma assinatura ativa.
    expect(backend.confirmed, isFalse);
    expect(find.text('Assinatura atualizada.'), findsNothing);
    expect(find.text('Assinatura não cadastrada'), findsOneWidget);

    /// E a imagem escolhida continua na tela: repetir não deve exigir
    /// escolher de novo.
    expect(find.text('Confirmar assinatura'), findsOneWidget);
  });

  for (final scale in [1.0, 1.3, 2.0]) {
    testWidgets('não estoura com texto em ${scale}x', (tester) async {
      await tester.pumpWidget(wrap(Backend(available: true), textScale: scale));
      await tester.pumpAndSettle();
      expect(layoutError, isNull);
    });
  }

  testWidgets('tela estreita continua íntegra', (tester) async {
    await tester.pumpWidget(
      wrap(Backend(available: true), width: 280, textScale: 1.3),
    );
    await tester.pumpAndSettle();
    expect(layoutError, isNull);
  });
}
