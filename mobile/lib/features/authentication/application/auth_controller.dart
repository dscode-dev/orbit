/// Controlador de sessão.
///
/// Um único ponto decide se há sessão, quem é o usuário e qual o escopo ativo.
/// A navegação observa este estado; as telas nunca autenticam por conta
/// própria.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/contracts/session_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../../../core/network/session_authenticator.dart';
import '../data/auth_repository.dart';
import '../domain/session.dart';

class AuthController extends StateNotifier<AuthState> {
  AuthController({
    required AuthRepository repository,
    required SessionAuthenticator authenticator,
  }) : _repository = repository,
       super(const AuthRestoring()) {
    // O autenticador avisa quando a renovação falhou de vez.
    _expiredSubscription = authenticator.onExpired.listen((_) {
      state = const AuthUnauthenticated(
        reason: 'Sua sessão expirou. Entre novamente.',
      );
    });
  }

  final AuthRepository _repository;
  late final StreamSubscription<void> _expiredSubscription;

  /// Restaura a sessão guardada ao abrir o app.
  ///
  /// Não valida o token na rede: se estiver vencido, a primeira requisição
  /// dispara a renovação pelo interceptor. Isso deixa a abertura rápida mesmo
  /// com rede ruim.
  Future<void> restore() async {
    final claims = await _repository.readClaims();
    if (claims == null) {
      state = const AuthUnauthenticated();
      return;
    }
    try {
      state = AuthAuthenticated(await _composeSession(claims));
    } on OrbitException catch (error) {
      if (error.isUnauthorized) {
        state = const AuthUnauthenticated(
          reason: 'Sua sessão expirou. Entre novamente.',
        );
        return;
      }
      rethrow;
    }
  }

  Future<void> login({
    required String email,
    required String password,
    String? mfaCode,
  }) async {
    final tokens = await _repository.login(
      email: email,
      password: password,
      mfaCode: mfaCode,
    );
    final claims = AuthRepository.decodeClaims(tokens.accessToken);
    if (claims == null) {
      throw const OrbitException(
        kind: OrbitErrorKind.parse,
        message: 'Não foi possível ler a sessão retornada pelo servidor.',
        code: 'PARSE',
      );
    }
    state = AuthAuthenticated(await _composeSession(claims));
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthUnauthenticated();
  }

  /// Troca a unidade ativa.
  ///
  /// O backend aceita `businessUnitId` como filtro em várias consultas, então a
  /// troca muda o que o app pede — sem alterar o escopo do token, que é do
  /// servidor.
  void selectBusinessUnit(String businessUnitId) {
    final current = state;
    if (current is! AuthAuthenticated) return;
    state = AuthAuthenticated(
      current.session.copyWith(activeBusinessUnitId: businessUnitId),
    );
  }

  Future<OrbitSession> _composeSession(AccessTokenClaims claims) async {
    // Perfil é obrigatório; organização e plano só existem para tenant.
    final results = await Future.wait([
      _repository.loadProfile(),
      if (claims.organizationId != null)
        _repository.loadOrganization()
      else
        Future<Organization?>.value(),
      if (claims.organizationId != null)
        _repository.loadEntitlements()
      else
        Future<Entitlements?>.value(),
    ]);

    return OrbitSession(
      user: results[0]! as OrbitUser,
      claims: claims,
      organization: results[1] as Organization?,
      entitlements: results[2] as Entitlements?,
    );
  }

  @override
  void dispose() {
    _expiredSubscription.cancel();
    super.dispose();
  }
}
