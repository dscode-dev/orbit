/// Tela de autenticação.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:orbit_operator/app/providers.dart';
import 'package:orbit_operator/core/contracts/session_contracts.dart';
import 'package:orbit_operator/core/errors/orbit_exception.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';
import 'package:orbit_operator/core/theme/orbit_theme.dart';
import 'package:orbit_operator/features/authentication/data/auth_repository.dart';
import 'package:orbit_operator/features/authentication/presentation/login_screen.dart';

import '../support/fakes.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

Widget wrap(Widget child, {required AuthRepository repository}) {
  return ProviderScope(
    overrides: [authRepositoryProvider.overrideWithValue(repository)],
    child: MaterialApp(theme: OrbitTheme.dark(), home: child),
  );
}

void main() {
  late _MockAuthRepository repository;

  setUp(() {
    repository = _MockAuthRepository();
    when(() => repository.loadProfile()).thenAnswer(
      (_) async => const OrbitUser(
        id: 'user-1',
        email: 'tecnico@acme.com',
        displayName: 'Marina Duarte',
      ),
    );
    when(() => repository.loadOrganization()).thenAnswer((_) async => null);
    when(() => repository.loadEntitlements()).thenAnswer((_) async => null);
  });

  testWidgets('exibe a marca e os campos de acesso', (tester) async {
    await tester.pumpWidget(wrap(const LoginScreen(), repository: repository));

    expect(find.text('Entrar'), findsWidgets);
    expect(find.byKey(const Key('login.email')), findsOneWidget);
    expect(find.byKey(const Key('login.password')), findsOneWidget);
    // O símbolo da marca aparece na autenticação.
    expect(find.byType(Image), findsOneWidget);
  });

  testWidgets('valida e-mail e senha antes de chamar o backend', (
    tester,
  ) async {
    await tester.pumpWidget(wrap(const LoginScreen(), repository: repository));

    await tester.tap(find.byKey(const Key('login.submit')));
    await tester.pump();

    expect(find.text('Informe um e-mail válido'), findsOneWidget);
    expect(find.text('A senha tem no mínimo 8 caracteres'), findsOneWidget);
    verifyNever(
      () => repository.login(
        email: any(named: 'email'),
        password: any(named: 'password'),
        mfaCode: any(named: 'mfaCode'),
      ),
    );
  });

  testWidgets('mostra a mensagem devolvida pelo backend', (tester) async {
    when(
      () => repository.login(
        email: any(named: 'email'),
        password: any(named: 'password'),
        mfaCode: any(named: 'mfaCode'),
      ),
    ).thenThrow(
      const OrbitException(
        kind: OrbitErrorKind.http,
        status: 401,
        message: 'Invalid credentials',
        code: 'UNAUTHORIZED',
      ),
    );

    await tester.pumpWidget(wrap(const LoginScreen(), repository: repository));
    await tester.enterText(
      find.byKey(const Key('login.email')),
      'tecnico@acme.com',
    );
    await tester.enterText(
      find.byKey(const Key('login.password')),
      'senha-longa',
    );
    await tester.tap(find.byKey(const Key('login.submit')));
    await tester.pumpAndSettle();

    expect(find.text('Invalid credentials'), findsOneWidget);
  });

  testWidgets('revela o campo de MFA quando o backend exige', (tester) async {
    when(
      () => repository.login(
        email: any(named: 'email'),
        password: any(named: 'password'),
        mfaCode: any(named: 'mfaCode'),
      ),
    ).thenThrow(
      const OrbitException(
        kind: OrbitErrorKind.http,
        status: 401,
        message: 'MFA code is required',
        code: 'UNAUTHORIZED',
      ),
    );

    await tester.pumpWidget(wrap(const LoginScreen(), repository: repository));
    await tester.enterText(
      find.byKey(const Key('login.email')),
      'tecnico@acme.com',
    );
    await tester.enterText(
      find.byKey(const Key('login.password')),
      'senha-longa',
    );
    await tester.tap(find.byKey(const Key('login.submit')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('login.mfa')), findsOneWidget);
  });

  testWidgets('autentica com credenciais válidas', (tester) async {
    when(
      () => repository.login(
        email: any(named: 'email'),
        password: any(named: 'password'),
        mfaCode: any(named: 'mfaCode'),
      ),
    ).thenAnswer(
      (_) async => TokenPair(
        accessToken: fakeAccessToken(),
        refreshToken: 'refresh-1',
        expiresIn: 900,
      ),
    );

    await tester.pumpWidget(wrap(const LoginScreen(), repository: repository));
    await tester.enterText(
      find.byKey(const Key('login.email')),
      'tecnico@acme.com',
    );
    await tester.enterText(
      find.byKey(const Key('login.password')),
      'senha-longa',
    );
    await tester.tap(find.byKey(const Key('login.submit')));
    await tester.pumpAndSettle();

    verify(
      () => repository.login(
        email: 'tecnico@acme.com',
        password: 'senha-longa',
        mfaCode: null,
      ),
    ).called(1);
  });
}
