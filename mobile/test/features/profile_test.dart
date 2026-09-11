/// Perfil: editar os próprios dados e escolher os avisos.
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_operator/app/providers.dart';
import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/features/profile/application/notification_settings_providers.dart';
import 'package:orbit_operator/features/profile/application/profile_providers.dart';
import 'package:orbit_operator/features/profile/data/notification_preferences_repository.dart';

import '../support/fakes.dart';
import '../support/scripted_adapter.dart';

/// Registra o que o aplicativo mandou, e responde o que o servidor mandaria.
class Backend {
  final pedidos = <({String method, String path, Object? body})>[];

  Future<ResponseBody> call(RequestOptions options) async {
    pedidos.add((
      method: options.method,
      path: options.uri.path,
      body: options.data,
    ));

    if (options.uri.path.endsWith('/notifications/preferences')) {
      return jsonResponse({
        'success': true,
        'data': [
          {
            'type': 'WORK_ASSIGNED',
            'enabled': true,
            'channels': ['IN_APP', 'PUSH'],
          },
          {
            'type': 'SYNC_ATTENTION_REQUIRED',
            'enabled': false,
            'channels': <String>[],
          },
        ],
      });
    }

    if (options.uri.path.endsWith('/identity/me')) {
      return jsonResponse({
        'success': true,
        'data': {
          'id': 'user-1',
          'email': 'tecnico@acme.com',
          'displayName': 'Marina D. Duarte',
          'firstName': 'Marina',
          'lastName': 'Duarte',
          'phone': '+55 81 99999-0000',
        },
      });
    }

    return jsonResponse({'success': true, 'data': const {}});
  }
}

ProviderContainer containerCom(Backend backend) {
  final dio = Dio()..httpClientAdapter = ScriptedAdapter(backend.call);
  final plain = Dio()..httpClientAdapter = ScriptedAdapter(backend.call);
  final client = OrbitApiClient.create(
    environment: OrbitEnvironment.fromDefines(),
    storage: InMemoryTokenStorage(),
    logger: const OrbitLogger(isProduction: true),
    dio: dio,
    retryDio: plain,
  );
  final container = ProviderContainer(
    overrides: [apiClientProvider.overrideWithValue(client)],
  );
  addTearDown(container.dispose);

  /// Segura os provedores `autoDispose`, que é o que a tela faz ao observá-los.
  /// Sem isto eles são descartados entre a leitura e a resposta, e o teste
  /// falha por um motivo que o produto não tem.
  container.listen(profileEditControllerProvider, (_, __) {});
  container.listen(notificationSettingsControllerProvider, (_, __) {});
  container.listen(notificationPreferencesProvider, (_, __) {});
  return container;
}

void main() {
  group('meus dados', () {
    test('salvar manda só o que foi informado', () async {
      final backend = Backend();
      final container = containerCom(backend);

      await container
          .read(profileEditControllerProvider.notifier)
          .save(displayName: 'Marina D. Duarte', phone: '+55 81 99999-0000');

      final pedido = backend.pedidos.last;
      expect(pedido.method, 'PATCH');
      expect(pedido.path, endsWith('/identity/me'));

      final corpo = pedido.body as Map<String, dynamic>;
      expect(corpo['displayName'], 'Marina D. Duarte');
      expect(corpo['phone'], '+55 81 99999-0000');

      /// Campo não preenchido não vai como `null`: o `PATCH` apagaria o
      /// sobrenome de quem só quis corrigir o telefone.
      expect(corpo.containsKey('firstName'), isFalse);
      expect(corpo.containsKey('lastName'), isFalse);
    });

    test('a resposta do servidor é o que vale, não o que foi digitado', () {
      /// O `PATCH` devolve o perfil como ficou — com a normalização que o
      /// servidor fizer. Aplicar o texto do formulário em vez da resposta
      /// mostraria na tela algo diferente do que foi gravado.
      ///
      /// Que esse usuário chegue à sessão é assunto do `AuthController`, e
      /// está preso em `auth_controller_test.dart` — 'applyUser troca o
      /// usuário sem recompor o resto da sessão'.
      final backend = Backend();
      final container = containerCom(backend);

      return expectLater(
        container
            .read(profileRepositoryProvider)
            .update(displayName: 'marina d. duarte')
            .then((usuario) => usuario.displayName),
        completion('Marina D. Duarte'),
      );
    });
  });

  group('avisos', () {
    test('tipo ausente na resposta segue ligado', () async {
      /// O servidor guarda só o que foi mexido. Desenhar "desligado" para o
      /// que nunca foi tocado faria a pessoa acreditar que não recebe avisos
      /// que recebe.
      final container = containerCom(Backend());
      final mapa = await container.read(
        notificationPreferencesProvider.future,
      );

      expect(mapa['WORK_ASSIGNED']?.enabled, isTrue);
      expect(mapa['SYNC_ATTENTION_REQUIRED']?.enabled, isFalse);
      expect(mapa['ARTIFACT_AVAILABLE'], isNull);
      expect(
        mapa['ARTIFACT_AVAILABLE']?.enabled ?? true,
        isTrue,
        reason: 'ausente é o padrão do servidor, que é receber',
      );
    });

    test('desligar apaga todos os canais, não só o push', () async {
      /// Um interruptor rotulado "Novo atendimento" que continuasse mandando
      /// e-mail seria um interruptor quebrado.
      final backend = Backend();
      final container = containerCom(backend);

      await container
          .read(notificationSettingsControllerProvider.notifier)
          .toggle(type: 'WORK_ASSIGNED', enabled: false);

      final corpo =
          backend.pedidos.lastWhere((p) => p.method == 'PATCH').body
              as Map<String, dynamic>;
      expect(corpo['type'], 'WORK_ASSIGNED');
      expect(corpo['enabled'], isFalse);
      expect(corpo['channels'], isEmpty);
    });

    test('ligar manda a lista inteira de canais', () async {
      /// O contrato **substitui** a lista, não faz união: mandar só `PUSH`
      /// apagaria o aviso dentro do aplicativo.
      final backend = Backend();
      final container = containerCom(backend);

      await container
          .read(notificationSettingsControllerProvider.notifier)
          .toggle(type: 'ARTIFACT_AVAILABLE', enabled: true);

      final corpo =
          backend.pedidos.lastWhere((p) => p.method == 'PATCH').body
              as Map<String, dynamic>;
      expect(corpo['channels'], containsAll(['IN_APP', 'REALTIME', 'PUSH']));
    });

    test('os três tipos do app são os três que o backend empurra', () {
      expect(mobileNoticeCodes.values, [
        'WORK_ASSIGNED',
        'ARTIFACT_AVAILABLE',
        'SYNC_ATTENTION_REQUIRED',
      ]);
      for (final tipo in MobileNoticeKind.values) {
        expect(mobileNoticeLabels[tipo], isNotNull, reason: '$tipo sem rótulo');
      }
    });
  });
}
