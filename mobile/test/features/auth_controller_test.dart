/// Sessão: login, restauração, logout e derivação de perfil.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:orbit_operator/core/contracts/session_contracts.dart';
import 'package:orbit_operator/core/network/session_authenticator.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';
import 'package:orbit_operator/features/authentication/application/auth_controller.dart';
import 'package:orbit_operator/features/authentication/data/auth_repository.dart';
import 'package:orbit_operator/features/authentication/domain/session.dart';

import '../support/fakes.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

const _user = OrbitUser(
  id: 'user-1',
  email: 'tecnico@acme.com',
  displayName: 'Marina Duarte',
);

final _organization = Organization.fromJson(const {
  'id': 'org-1',
  'displayName': 'Acme Industries',
  'subscriptionStatus': 'ACTIVE',
  'primarySegment': 'HVAC_R',
  'plan': {
    'key': 'STARTER',
    'name': 'Starter',
    'capabilities': ['operations.read', 'scheduling.read'],
  },
  'businessUnits': [
    {'id': 'unit-1', 'legalName': 'Acme LTDA', 'tradeName': 'Acme'},
    {'id': 'unit-2', 'legalName': 'Filial Sul', 'tradeName': 'Sul'},
  ],
});

final _entitlements = Entitlements.fromJson(const {
  'planKey': 'STARTER',
  'subscriptionStatus': 'ACTIVE',
  'capabilities': ['operations.read', 'scheduling.read'],
});

AuthController buildController(
  AuthRepository repository, {
  SessionAuthenticator? authenticator,
}) {
  return AuthController(
    repository: repository,
    authenticator:
        authenticator ??
        SessionAuthenticator(
          storage: InMemoryTokenStorage(),
          logger: const OrbitLogger(isProduction: true),
          refreshCall: (_) async =>
              throw StateError('não deve renovar neste teste'),
        ),
  );
}

void main() {
  late _MockAuthRepository repository;

  setUp(() {
    repository = _MockAuthRepository();
    when(() => repository.loadProfile()).thenAnswer((_) async => _user);
    when(
      () => repository.loadOrganization(),
    ).thenAnswer((_) async => _organization);
    when(
      () => repository.loadEntitlements(),
    ).thenAnswer((_) async => _entitlements);
  });

  test('sem token guardado, o app abre desautenticado', () async {
    when(() => repository.readClaims()).thenAnswer((_) async => null);

    final controller = buildController(repository);
    await controller.restore();

    expect(controller.state, isA<AuthUnauthenticated>());
  });

  test('restaura a sessão e compõe organização, plano e unidades', () async {
    when(
      () => repository.readClaims(),
    ).thenAnswer((_) async => AuthRepository.decodeClaims(fakeAccessToken()));

    final controller = buildController(repository);
    await controller.restore();

    final state = controller.state;
    expect(state, isA<AuthAuthenticated>());
    final session = (state as AuthAuthenticated).session;
    expect(session.user.displayName, 'Marina Duarte');
    expect(session.organization?.displayName, 'Acme Industries');
    expect(session.capabilities, contains('scheduling.read'));
    expect(session.hasActiveSubscription, isTrue);
  });

  test('login autentica e deriva a sessão do token', () async {
    when(
      () => repository.login(
        email: any(named: 'email'),
        password: any(named: 'password'),
        mfaCode: any(named: 'mfaCode'),
      ),
    ).thenAnswer(
      (_) async => TokenPair(
        accessToken: fakeAccessToken(permissions: const ['operations.read']),
        refreshToken: 'refresh-1',
        expiresIn: 900,
      ),
    );

    final controller = buildController(repository);
    await controller.login(email: 'tecnico@acme.com', password: 'senha-longa');

    expect(controller.state, isA<AuthAuthenticated>());
  });

  test('logout limpa a sessão', () async {
    when(
      () => repository.readClaims(),
    ).thenAnswer((_) async => AuthRepository.decodeClaims(fakeAccessToken()));
    when(() => repository.logout()).thenAnswer((_) async {});

    final controller = buildController(repository);
    await controller.restore();
    await controller.logout();

    expect(controller.state, isA<AuthUnauthenticated>());
    verify(() => repository.logout()).called(1);
  });

  test('Platform Administrator não carrega organização', () async {
    when(() => repository.readClaims()).thenAnswer(
      (_) async => AuthRepository.decodeClaims(
        fakeAccessToken(
          organizationId: null,
          businessUnitId: null,
          roles: const ['PLATFORM_ADMIN'],
          permissions: const ['*', 'platform.admin'],
        ),
      ),
    );

    final controller = buildController(repository);
    await controller.restore();

    final session = (controller.state as AuthAuthenticated).session;
    expect(session.isPlatformAdmin, isTrue);
    expect(session.organization, isNull);
    verifyNever(() => repository.loadOrganization());
  });

  test('a sessão expirada pelo autenticador desautentica o app', () async {
    when(
      () => repository.readClaims(),
    ).thenAnswer((_) async => AuthRepository.decodeClaims(fakeAccessToken()));

    final storage = InMemoryTokenStorage(
      const TokenPair(
        accessToken: 'a',
        refreshToken: 'refresh-1',
        expiresIn: 900,
      ),
    );
    final authenticator = SessionAuthenticator(
      storage: storage,
      logger: const OrbitLogger(isProduction: true),
      refreshCall: (_) async => throw Exception('refresh inválido'),
    );

    final controller = buildController(
      repository,
      authenticator: authenticator,
    );
    await controller.restore();
    expect(controller.state, isA<AuthAuthenticated>());

    // O interceptor tentaria renovar e falharia.
    await authenticator.refresh('refresh-1');
    await Future<void>.delayed(Duration.zero);

    expect(controller.state, isA<AuthUnauthenticated>());
  });

  group('perfil derivado das permissões', () {
    test('quem gerencia operações usa a experiência de gestão', () async {
      when(() => repository.readClaims()).thenAnswer(
        (_) async => AuthRepository.decodeClaims(
          fakeAccessToken(
            permissions: const ['operations.read', 'operations.manage'],
          ),
        ),
      );

      final controller = buildController(repository);
      await controller.restore();

      final session = (controller.state as AuthAuthenticated).session;
      expect(session.profile, OrbitProfile.owner);
    });

    test('quem só executa usa a experiência de operação', () async {
      when(() => repository.readClaims()).thenAnswer(
        (_) async => AuthRepository.decodeClaims(
          fakeAccessToken(
            roles: const ['TECHNICIAN'],
            permissions: const ['operations.read', 'checklists.execute'],
          ),
        ),
      );

      final controller = buildController(repository);
      await controller.restore();

      final session = (controller.state as AuthAuthenticated).session;
      expect(session.profile, OrbitProfile.operator);
      expect(session.hasPermission('operations.manage'), isFalse);
    });
  });

  test('troca de unidade ativa altera o escopo das consultas', () async {
    when(
      () => repository.readClaims(),
    ).thenAnswer((_) async => AuthRepository.decodeClaims(fakeAccessToken()));

    final controller = buildController(repository);
    await controller.restore();
    expect(
      (controller.state as AuthAuthenticated).session.businessUnitId,
      'unit-1',
    );

    controller.selectBusinessUnit('unit-2');

    final session = (controller.state as AuthAuthenticated).session;
    expect(session.businessUnitId, 'unit-2');
    expect(session.businessUnit?.name, 'Sul');
  });
}
