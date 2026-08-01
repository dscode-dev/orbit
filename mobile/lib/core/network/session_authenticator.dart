/// Renovação de sessão com rotação segura.
///
/// O backend **consome o refresh token a cada uso** e emite um novo par
/// (`AuthenticationService.refresh` → `rotateSession`). Isso torna a corrida de
/// renovação um problema real no mobile: a tela inicial dispara várias
/// requisições em paralelo e, se cada 401 disparasse o seu próprio refresh, a
/// primeira rotacionaria o token e as demais chegariam ao backend com um token
/// já consumido — derrubando a sessão do usuário sem motivo.
///
/// Duas proteções, no mesmo espírito da implementação web:
///
/// 1. **Chamada única em voo** — requisições concorrentes aguardam a mesma
///    `Future`, em vez de cada uma chamar `/identity/refresh`.
/// 2. **Janela de rotação** — quem chega logo depois da rotação, ainda com o
///    token antigo em mãos, recebe o par recém-emitido em vez de tentar
///    consumir um token já usado.
library;

import 'dart:async';

import '../observability/orbit_logger.dart';
import '../storage/token_storage.dart';

/// Executa a chamada de refresh no backend. Injetado para não acoplar o
/// autenticador ao Dio (e para poder ser testado sem rede).
typedef RefreshCall = Future<TokenPair> Function(String refreshToken);

class SessionAuthenticator {
  SessionAuthenticator({
    required TokenStorage storage,
    required RefreshCall refreshCall,
    required OrbitLogger logger,
    Duration rotationGrace = const Duration(seconds: 15),
  }) : _storage = storage,
       _refreshCall = refreshCall,
       _logger = logger,
       _rotationGrace = rotationGrace;

  final TokenStorage _storage;
  final RefreshCall _refreshCall;
  final OrbitLogger _logger;
  final Duration _rotationGrace;

  Future<TokenPair?>? _inFlight;
  String? _inFlightToken;
  _Rotation? _lastRotation;

  /// Sessão encerrada — a interface reage voltando para o login.
  final _expired = StreamController<void>.broadcast();
  Stream<void> get onExpired => _expired.stream;

  /// Renova o par de tokens; `null` quando a sessão não pode ser recuperada.
  Future<TokenPair?> refresh(String usedRefreshToken) {
    final recent = _lastRotation;
    if (recent != null &&
        recent.consumedToken == usedRefreshToken &&
        !recent.isExpired(_rotationGrace)) {
      // Requisição que saiu antes da rotação: entrega o par já emitido.
      return Future.value(recent.pair);
    }

    final pending = _inFlight;
    if (pending != null && _inFlightToken == usedRefreshToken) return pending;

    final future = _performRefresh(usedRefreshToken);
    _inFlight = future;
    _inFlightToken = usedRefreshToken;
    return future;
  }

  Future<TokenPair?> _performRefresh(String usedRefreshToken) async {
    try {
      final pair = await _refreshCall(usedRefreshToken);
      await _storage.write(pair);
      _lastRotation = _Rotation(
        consumedToken: usedRefreshToken,
        pair: pair,
        at: DateTime.now(),
      );
      _logger.info('sessão renovada');
      return pair;
    } on Object catch (error) {
      // Falha de renovação encerra a sessão: o refresh token não vale mais.
      _logger.warning('renovação de sessão falhou', data: {'motivo': '$error'});
      await _storage.clear();
      _lastRotation = null;
      _expired.add(null);
      return null;
    } finally {
      _inFlight = null;
      _inFlightToken = null;
    }
  }

  /// Descarta o estado ao encerrar a sessão manualmente.
  void reset() {
    _inFlight = null;
    _inFlightToken = null;
    _lastRotation = null;
  }

  Future<void> dispose() async => _expired.close();
}

class _Rotation {
  const _Rotation({
    required this.consumedToken,
    required this.pair,
    required this.at,
  });

  final String consumedToken;
  final TokenPair pair;
  final DateTime at;

  bool isExpired(Duration grace) => DateTime.now().difference(at) > grace;
}
